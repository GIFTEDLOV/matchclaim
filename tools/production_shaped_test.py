"""Run one representative MatchClaim case through installed GLSim consensus.

This uses the installed GLSim engine with three validator executions and local
deterministic web/model handlers. It is intentionally not a Bradbury proof and
does not use Studionet or any credential.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from glsim.consensus import run_consensus
from glsim.engine import SimEngine
from glsim.state import StateStore, TxStatus


CONTRACT = ROOT / "contracts" / "matchclaim.py"
ARTIFACT = ROOT / "artifacts" / "production-shaped-local.json"

MERCHANT = "0x" + "11" * 20
BUYER = "0x" + "22" * 20
URL = "https://competitor.example/product"


def main() -> int:
    calls = {"web": [], "model": []}

    def web_handler(data):
        calls["web"].append(data.get("url", ""))
        return {
            "ok": {
                "response": {
                    "status": 200,
                    "headers": {},
                    "body": b"Acme Phone M-1 SKU-1 NEW public USD 75.00 Buy now",
                }
            }
        }

    def llm_handler(data):
        calls["model"].append(data.get("prompt", ""))
        return {"ok": {"verdict": "MATCH_ELIGIBLE", "competitor_price_minor": 7500}}

    state = StateStore(chain_id=61127, seed="matchclaim-production-shaped")
    engine = SimEngine(state, web_handler=web_handler, llm_handler=llm_handler)
    engine.num_validators = 3
    engine.max_rotations = 2
    engine.activate()
    try:
        contract_address, _ = engine.deploy(str(CONTRACT), [], {}, MERCHANT)
        engine.call_method(
            contract_address,
            "create_policy",
            ["policy-1", "Acme Retail", "Same product, same condition, public price, same currency.", ["competitor.example"], True, False],
            {},
            MERCHANT,
        )
        engine.call_method(
            contract_address,
            "register_purchase",
            ["purchase-1", "policy-1", BUYER, "Acme Phone", "Acme", "M-1", "SKU-1", "NEW", 10000, "USD"],
            {},
            MERCHANT,
        )

        def execute_assessment():
            result = engine.call_method(
                contract_address,
                "assess_price_match",
                ["purchase-1", "assessment-1", URL],
                {},
                BUYER,
            )
            return result, b""

        consensus = run_consensus(engine, execute_assessment, engine.num_validators, engine.max_rotations)
        purchase = engine.call_method(contract_address, "get_purchase", ["purchase-1"], {}, BUYER)
        assessment = engine.call_method(contract_address, "get_assessment", ["assessment-1"], {}, BUYER)
        authorization = engine.call_method(
            contract_address,
            "get_authorization",
            [purchase["authorization_id"]],
            {},
            BUYER,
        )
        if consensus.status != TxStatus.FINALIZED:
            raise RuntimeError(f"GLSim consensus did not finalize: {consensus.error}")
        if assessment["verdict"] != "MATCH_ELIGIBLE" or authorization["authorized_credit_minor"] != 2500:
            raise RuntimeError("GLSim state consequence did not match the expected eligible case")
        if len(calls["web"]) < 2 or len(calls["model"]) < 2:
            raise RuntimeError("GLSim did not execute independent web/model paths")
        result = {
            "runtime": "glsim",
            "validators": engine.num_validators,
            "max_rotations": engine.max_rotations,
            "consensus_status": consensus.status.value,
            "consensus_votes": consensus.votes,
            "web_path_executions": len(calls["web"]),
            "model_path_executions": len(calls["model"]),
            "verdict": assessment["verdict"],
            "authorized_credit_minor": authorization["authorized_credit_minor"],
            "chain_id": 61127,
            "bradbury_proof": False,
            "studionet_used": False,
            "interpretation": "Production-shaped local consensus only; mocked local handlers, not Bradbury proof.",
        }
        ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
        ARTIFACT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    finally:
        engine.deactivate()


if __name__ == "__main__":
    raise SystemExit(main())
