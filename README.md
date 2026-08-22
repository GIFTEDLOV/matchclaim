# MatchClaim

## Product

MatchClaim is a complete GenLayer application for retailer price-match claims. Its Intelligent Contract is the consensus and adjudication core: a merchant commits immutable price-match rules and approved competitor hostnames, registers an authenticated purchase baseline, and allows only the registered buyer to submit one public HTTPS competitor URL. GenLayer validators independently retrieve and interpret the page. An eligible result creates a permanent on-chain `PriceMatchAuthorization` with a deterministic minor-unit credit.

V1 is intentionally limited to retailer price-match claims between a merchant and a buyer. It has no uploaded evidence, private evidence, screenshots, OCR, admin override, deletion, or policy edit. The completed frontend assists the workflow and displays contract state; it does not decide claims.

## Problem

Retail price matching normally relies on a merchant backend or an operator to decide whether a competitor page shows the same product, condition, currency, availability, and lower price. That decision is the trust boundary. MatchClaim keeps the policy, purchase baseline, evidence admission, semantic evaluation, consensus result, and credit calculation in the Intelligent Contract.

## Why GenLayer

The contract needs a shared on-chain decision about public web evidence and natural-language policy interpretation. The frontend/backend must not decide product equivalence, eligibility, price, verdict, or credit. GenLayer’s leader/validator Equivalence Principle lets validators independently fetch and classify the evidence before deterministic state writes.

Official references checked for this phase:

- [Intelligent Contracts](https://docs.genlayer.com/developers/intelligent-contracts/introduction)
- [When to Use GenLayer](https://docs.genlayer.com/developers/intelligent-contracts/when-to-use-genlayer)
- [Non-determinism](https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism)
- [Storage](https://docs.genlayer.com/developers/intelligent-contracts/storage)
- [Web Access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access)
- [Equivalence Principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Finality](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/finality)
- [Development Setup and GLSim](https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup)
- [GenVM Linter](https://docs.genlayer.com/api-references/genlayer-linter)

## How it works

1. A merchant calls `create_policy`. The sender becomes the immutable policy merchant.
2. The merchant calls `register_purchase`. The policy merchant is the only allowed registrar, and the buyer address, product fields, condition, price, and currency become the immutable baseline.
3. The registered buyer calls `assess_price_match` with a new assessment ID and one URL. Deterministic URL admission runs before any web call.
4. The leader fetches bounded text and classifies it. Each validator independently fetches and classifies the same URL. The validator compares the strictly parsed two-field result, not raw webpage text and not merely the leader’s schema.
5. After consensus, deterministic code stores one immutable `ClaimAssessment`. `MATCH_ELIGIBLE` computes `paid_price_minor - competitor_price_minor` and creates exactly one permanent authorization. `NOT_ELIGIBLE` and `INCONCLUSIVE` create no authorization.

## Architecture

Trust ordering is fixed:

`merchant authentication → immutable policy/purchase baseline → exact approved-host HTTPS admission → bounded web retrieval → semantic interpretation → independent validator consensus → strict result parsing → deterministic credit → stored assessment → authorization`

Approved hosts use a bounded newline-packed representation inside `MerchantPolicy` because the current installed GenVM generic allocator does not safely construct `DynArray[str]` in-memory. The representation is canonical, immutable, hard-bounded, and does not broaden host matching. URL subdomains are not silently allowed: the hostname must exactly equal one approved hostname.

Storage-backed `MerchantPolicy` and `Purchase` values are copied to memory, then reduced to primitive immutable values before entering nondeterministic closures. The regression test checks that no storage-backed dataclass is captured.

## Use

Install the current development dependencies and run the local gates:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_pure.py tests/direct -q
python tools/mutation_test.py
$env:GENVM_VERSION = "v0.3.0-rc7"
genvm-lint check contracts/matchclaim.py --json
python tools/production_shaped_test.py
```

### Frontend workflow

The Next.js frontend lives in `frontend/` and uses GenLayerJS for direct public reads and connected-wallet writes. It provides:

- a merchant workspace for policy creation, purchase registration, and record inspection;
- a buyer route for reading a registered purchase and submitting a competitor URL;
- assessment and authorization detail pages; and
- a public authorization verifier.

Run the local UI with a real contract configuration:

```powershell
cd frontend
Copy-Item .env.example .env.local
# Fill .env.local with a real public RPC, network metadata, and deployed address.
npm install
npm run dev
```

The UI fails closed with `MatchClaim contract is not configured` when the contract address or public GenLayer settings are absent. It never injects demo chain records. Every write persists its transaction hash under `matchclaim:pending:v1`, reconciles that same hash through finality, checks execution success, and verifies the expected stored state before showing completion.

The independent digest reproducer takes fields in fixed canonical order. For example:

```powershell
python tools/reproduce_digest.py --tag result --fields-json '["MATCH_ELIGIBLE",7500]'
```

## Live proof

The Phase 4 proof is a GLSim production-shaped local consensus run with three validator executions, independently invoked web/model paths, and local deterministic handlers. It is recorded in `artifacts/production-shaped-local.json`. Local execution and GLSim are not Bradbury proof. Studionet is not used.

Bradbury release work reached a finalized contract deployment, policy, and synthetic purchase fixture. The exact semantic assessment transaction `0x9afdddb7ec37aa1e193b816a5ae5be1ad2cde7862a20202d8179a7d9d449e969` is now `FINALIZED` with `txExecutionResultName=FINISHED_WITH_RETURN`. Its finalized execution trace/equivalence output is `INCONCLUSIVE` with `competitor_price_minor=0`; the final receipt reports `result_name=IDLE`. The appeal ended in round 3 with 11 committed votes and 10 revealed votes: `AGREE, AGREE, AGREE, TIMEOUT, DETERMINISTIC_VIOLATION, AGREE, AGREE, TIMEOUT, TIMEOUT, NOT_VOTED, TIMEOUT`, with 3 rotations left. Independent canonical reproduction matches the execution-trace `result_digest` `a2f60bf8d177718dc7b687684730bbe9b79d37a9c28d5411ccafd3fd7da115a9` and `assessment_digest` `2bc74abe88a9d4b8f8e3d9d7b14fc6f25ec44381ac1658c423699f66579ff15b`.

Read-only state reconciliation is also recorded: `get_assessment("mc_br_assess_20260820")` returns `assessment does not exist`, `get_assessment_ids()` is empty, and `get_purchase("mc_br_purchase_20260820")` remains `claim_assessed=false`, `assessment_count=0`, and `authorization_id=""`. Therefore `INCONCLUSIVE` is the exact finalized execution observation, not a stored `ClaimAssessment`; no authorization exists. The complete evidence is recorded in `artifacts/bradbury-release.json`.

The existing frontend is deployed to Vercel production at `https://frontend-kolofahkelvin16-6437s-projects.vercel.app/` with the Bradbury contract configuration. Production route checks for `/`, `/verify`, and `/claim/find` returned HTTP 200.

## Security/trust model

The merchant authenticates policy and purchase state by signing the write. The buyer authenticates the claim by matching the registered buyer address. The contract performs URL admission: non-empty bounded HTTPS URL, no fragment, no userinfo, no port, no localhost, no literal IP host, syntactically valid ASCII hostname, and exact approved-host match.

The page is public untrusted data, not authenticated evidence. HTTPS and hostname admission reduce the retrieval surface but do not prove page ownership or truth. The evaluator is instructed to ignore prompt-like text inside page data. Infrastructure failures, malformed model output, unavailable evidence, validator disagreement, and runtime errors fail the transaction; they are not converted into a business verdict.

The authoritative result is exactly:

```json
{"verdict":"MATCH_ELIGIBLE|NOT_ELIGIBLE|INCONCLUSIVE","competitor_price_minor":0}
```

Only `MATCH_ELIGIBLE` may carry a positive price, and it must be strictly lower than the paid price. `NOT_ELIGIBLE` and `INCONCLUSIVE` use zero. Extra keys, missing keys, duplicate JSON keys, wrong types, booleans used as integers, negative values, and malformed JSON fail parsing.

## Limitations

- Public page content can change, disappear, block validators, or vary between validator requests.
- Consensus proves agreement about interpretation; it does not authenticate evidence.
- Exact numeric price consensus may fail for dynamic pages. MatchClaim intentionally has no money tolerance.
- V1 does not handle private evidence, uploads, images, screenshots, OCR, seller identity beyond committed policy interpretation, time windows, refunds, or payment settlement.
- A successful semantic assessment is historical. Reassessment is allowed only after `NOT_ELIGIBLE` or `INCONCLUSIVE`, with a new assessment ID. Authorization permanently closes that purchase.
- The exact Bradbury assessment hash is finalized, but the finalized read state does not expose the ClaimAssessment produced in the execution trace. The artifact distinguishes that trace-level `INCONCLUSIVE` observation from the absent getter state; no authorization is claimed. Vercel deployment and production checks are tracked separately from contract proof.

## Developer/API detail

Contract source: `contracts/matchclaim.py`. Pure rules and canonical serialization: `contracts/matchclaim_core.py`.

Frontend client: `frontend/lib/client.ts`. The client matrix is exported as `CONTRACT_METHOD_MATRIX` and binds every frontend action to the frozen method name, argument order, precondition, and expected postcondition. UI money entry is converted from a two-decimal string into integer minor units without floating-point arithmetic.

Frontend routes: `/`, `/merchant`, `/merchant/policies/new`, `/merchant/purchases/new`, `/policies/[id]`, `/purchases/[id]`, `/claim/find`, `/claim/[purchaseId]`, `/assessments/[id]`, `/verify`, and `/verify/[id]`.

Public writes:

- `create_policy(policy_id, merchant_name, policy_text, approved_competitor_hosts, eligible_new, eligible_refurbished)`
- `register_purchase(purchase_id, policy_id, buyer_address, product_title, manufacturer, model_number, sku, product_condition, paid_price_minor, currency)`
- `assess_price_match(purchase_id, assessment_id, competitor_url)`

Public views:

- `get_policy(policy_id)`
- `get_purchase(purchase_id)`
- `get_assessment(assessment_id)`
- `get_authorization(authorization_id)`
- `get_policy_ids()`
- `get_purchase_ids()`
- `get_assessment_ids()`
- `contract_info()`

Current local versions observed: Python 3.14.3, GenLayer CLI 0.39.1, `genlayer-test` 0.29.2, `genlayer-py` 0.16.3, and the contract’s current `py-genlayer` dependency header. The Bradbury configuration used for the release is RPC `https://rpc-bradbury.genlayer.com`, chain `4221`; deployment, policy, purchase, and the exact finalized assessment receipt are recorded in the proof artifact. The assessment execution returned normally, but no stored assessment state or authorization is visible through the finalized contract reads.
