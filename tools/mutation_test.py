"""Small, repeatable mutation gate for MatchClaim security assumptions.

Mutants are built in temporary shadow packages and never modify the working
tree. A mutant is killed when its focused security test fails, which means the
test suite detected the weakened invariant.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "matchclaim.py"
CORE = ROOT / "contracts" / "matchclaim_core.py"
PACKAGE_INIT = ROOT / "contracts" / "__init__.py"


@dataclass(frozen=True)
class Mutation:
    name: str
    target: str
    old: str
    new: str
    test_body: str


COMMON = r'''
import json
import re
import pytest

CONTRACT = r"{contract}"
HOST = "competitor.example"
URL = "https://competitor.example/product"

def hx(address):
    return "0x" + bytes(address).hex()

def setup(vm, deploy, owner, alice):
    c = deploy(CONTRACT)
    vm.sender = owner
    c.create_policy("policy-1", "Acme", "same product, same condition, public price", [HOST], True, False)
    c.register_purchase("purchase-1", "policy-1", hx(alice), "Phone", "Acme", "M-1", "SKU-1", "NEW", 10000, "USD")
    return c

def mocks(vm, page, result):
    vm.mock_web(re.escape(HOST), {{"status": 200, "body": page}})
    vm.mock_llm(r"Return exactly one JSON object", json.dumps(result))
'''


def _test(body: str) -> str:
    return COMMON + "\n" + body


MUTATIONS = (
    Mutation(
        "bypass-approved-hostname",
        "contract",
        "if not isinstance(approved_hosts, (list, tuple, set, frozenset)) or clean_hostname not in approved_hosts:",
        "if False:",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r"evil\.example", {"status": 200, "body": "Phone M-1 SKU-1 new USD 75.00"})
    direct_vm.mock_llm(r"Return exactly one JSON object", json.dumps({"verdict": "NOT_ELIGIBLE", "competitor_price_minor": 0}))
    with direct_vm.expect_revert():
        c.assess_price_match("purchase-1", "a-1", "https://evil.example/product")
''',
    ),
    Mutation(
        "bypass-https",
        "contract",
        'if not value.startswith("https://"):',
        "if False:",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 75.00", {"verdict": "NOT_ELIGIBLE", "competitor_price_minor": 0})
    with pytest.raises(ValueError):
        c.assess_price_match("purchase-1", "a-1", "http://competitor.example/product")
''',
    ),
    Mutation(
        "bypass-strict-result-schema",
        "contract",
        "if not isinstance(payload, dict) or set(payload.keys()) != MODEL_KEYS:",
        "if not isinstance(payload, dict):",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 75.00", {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 7500, "rationale": "extra"})
    with direct_vm.expect_revert():
        c.assess_price_match("purchase-1", "a-1", URL)
''',
    ),
    Mutation(
        "bypass-eligible-price-correlation",
        "contract",
        'if verdict == "MATCH_ELIGIBLE" and not 0 < price < paid_price_minor:',
        'if False:',
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 100.00", {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 0})
    with direct_vm.expect_revert():
        c.assess_price_match("purchase-1", "a-1", URL)
''',
    ),
    Mutation(
        "trust-leader-result",
        "contract",
        "return independent_data == leader_data",
        "return True",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 75.00", {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 7500})
    c.assess_price_match("purchase-1", "a-1", URL)
    direct_vm.clear_mocks()
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 125.00", {"verdict": "NOT_ELIGIBLE", "competitor_price_minor": 0})
    assert direct_vm.run_validator() is False
''',
    ),
    Mutation(
        "authorization-on-noneligible",
        "contract",
        'if verdict == "MATCH_ELIGIBLE":\n            authorization_id = "auth_"',
        'if True:\n            authorization_id = "auth_"',
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 125.00", {"verdict": "NOT_ELIGIBLE", "competitor_price_minor": 0})
    c.assess_price_match("purchase-1", "a-1", URL)
    assert c.get_purchase("purchase-1")["authorization_id"] == ""
''',
    ),
    Mutation(
        "mutate-credit-calculation",
        "contract",
        "authorized_credit_minor = paid_price_minor - competitor_price_minor",
        "authorized_credit_minor = paid_price_minor + competitor_price_minor",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 75.00", {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 7500})
    c.assess_price_match("purchase-1", "a-1", URL)
    assert c.get_assessment("a-1")["authorized_credit_minor"] == 2500
''',
    ),
    Mutation(
        "bypass-buyer-authority",
        "contract",
        "if storage_purchase.buyer_address != gl.message.sender_address:",
        "if False:",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_bob
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 75.00", {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 7500})
    with direct_vm.expect_revert("registered buyer"):
        c.assess_price_match("purchase-1", "a-1", URL)
''',
    ),
    Mutation(
        "capture-storage-object-in-nondet",
        "contract",
        "def leader_fn() -> dict[str, object]:\n            page_text =",
        "def leader_fn() -> dict[str, object]:\n            unused_storage_object = storage_policy\n            page_text =",
        r'''
def test_mutation_is_killed(direct_vm, direct_deploy, direct_owner, direct_alice):
    c = setup(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_alice
    mocks(direct_vm, "Phone M-1 SKU-1 new USD 75.00", {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 7500})
    c.assess_price_match("purchase-1", "a-1", URL)
    _, leader_fn, validator_fn = direct_vm._captured_validators[-1]
    captured = []
    for function in (leader_fn, validator_fn):
        for cell in function.__closure__ or ():
            captured.append(cell.cell_contents)
    assert not any(type(value).__name__ == "MerchantPolicy" for value in captured)
''',
    ),
)


def _apply_mutation(source: str, mutation: Mutation) -> str:
    if source.count(mutation.old) != 1:
        raise RuntimeError(f"mutation {mutation.name} expected one source match, found {source.count(mutation.old)}")
    return source.replace(mutation.old, mutation.new)


def main() -> int:
    killed: list[str] = []
    survived: list[str] = []
    with tempfile.TemporaryDirectory(prefix="matchclaim-mutants-") as directory:
        temp_root = Path(directory)
        for mutation in MUTATIONS:
            shadow = temp_root / mutation.name
            shadow_contracts = shadow / "contracts"
            shadow_contracts.mkdir(parents=True)
            (shadow_contracts / "__init__.py").write_text(PACKAGE_INIT.read_text(encoding="utf-8"), encoding="utf-8")
            core_source = CORE.read_text(encoding="utf-8")
            contract_source = CONTRACT.read_text(encoding="utf-8")
            if mutation.target == "core":
                core_source = _apply_mutation(core_source, mutation)
            else:
                contract_source = _apply_mutation(contract_source, mutation)
            (shadow_contracts / "matchclaim_core.py").write_text(core_source, encoding="utf-8")
            mutant_contract = shadow_contracts / "matchclaim.py"
            mutant_contract.write_text(contract_source, encoding="utf-8")
            test_file = shadow / "test_mutation.py"
            test_file.write_text(_test(mutation.test_body).replace("{contract}", str(mutant_contract)), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, "-m", "pytest", str(test_file), "-q"],
                cwd=shadow,
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                survived.append(mutation.name)
                print(f"SURVIVED {mutation.name}")
            else:
                killed.append(mutation.name)
                print(f"KILLED {mutation.name}")
        print(f"Mutation summary: killed={len(killed)} survived={len(survived)} total={len(MUTATIONS)}")
        if survived:
            print("Survived critical mutations:", ", ".join(survived))
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
