"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createReadClient, readAssessment, readPolicy, readPurchase, writeAssessPriceMatch, writeCreatePolicy, writeRegisterPurchase } from "@/lib/client";
import { getConfig } from "@/lib/config";
import { formatMinorUnits, parseMinorUnits } from "@/lib/money";
import { presentVerdict } from "@/lib/verdict";
import { isExpectedMissing, isAddress, parseHostnames, validateCondition, validateHttpsCompetitorUrl, validateId } from "@/lib/validation";
import { Button, Card, InlineError, Label } from "./ui";
import { TransactionCard, useContractTransaction } from "./transaction";
import { useWallet } from "./wallet";
import type { ClaimAssessment, MerchantPolicy, Purchase } from "@/lib/types";

const initialPolicy = { id: "", merchantName: "", policyText: "", hosts: "", eligibleNew: true, eligibleRefurbished: false };
const initialPurchase = { id: "", policyId: "", buyerAddress: "", title: "", manufacturer: "", model: "", sku: "", condition: "NEW", price: "", currency: "USD" };

export function PolicyForm() {
  const router = useRouter();
  const wallet = useWallet();
  const tx = useContractTransaction();
  const [form, setForm] = useState(initialPolicy);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const config = getConfig();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const idError = validateId(form.id, "Policy ID");
    const parsedHosts = parseHostnames(form.hosts);
    if (idError || parsedHosts.error || !form.merchantName.trim() || !form.policyText.trim() || (!form.eligibleNew && !form.eligibleRefurbished)) {
      setError(idError ?? parsedHosts.error ?? "Complete the policy details and allow at least one condition.");
      return;
    }
    if (!config.configured) { setError("MatchClaim contract is not configured"); return; }
    try {
      const client = createReadClient(config);
      try {
        await readPolicy(client, form.id);
        setError("That policy ID already exists. Choose a new immutable ID.");
        return;
      } catch (cause) {
        if (!isExpectedMissing(cause, "policy")) throw cause;
      }
      const hash = await tx.run({
        operation: "create_policy",
        expectedEntityId: form.id,
        write: (writeClient) => writeCreatePolicy(writeClient, [form.id, form.merchantName.trim(), form.policyText.trim(), parsedHosts.hosts, form.eligibleNew, form.eligibleRefurbished]),
        verifyPostcondition: async (readClient) => {
          try { await readPolicy(readClient, form.id); return true; } catch { return false; }
        },
      });
      if (hash) setSubmittedId(form.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy precondition could not be checked");
    }
  }

  return (
    <div>
      <Card className="form-card">
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <div className="field field-wide"><Label htmlFor="policy-id" hint="Immutable">Policy ID</Label><input className="input" id="policy-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="acme-price-match-v1" disabled={Boolean(tx.progress && tx.progress.state !== "FAILED")} /><p className="field-help">Use a short, reviewable identifier. Policy records cannot be edited after creation.</p></div>
            <div className="field field-wide"><Label htmlFor="merchant-name">Merchant display name</Label><input className="input" id="merchant-name" value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} placeholder="Acme Retail" /></div>
            <div className="field field-wide"><Label htmlFor="policy-text">Price-match policy text</Label><textarea className="textarea" id="policy-text" value={form.policyText} onChange={(e) => setForm({ ...form, policyText: e.target.value })} placeholder="Match the same product and condition when a publicly purchasable competitor price is lower in the same currency." /><p className="field-help">The contract-owned semantic evaluator applies this immutable text.</p></div>
            <div className="field field-wide"><Label htmlFor="approved-hosts" hint="One per line">Approved competitor hostnames</Label><textarea className="textarea" id="approved-hosts" value={form.hosts} onChange={(e) => setForm({ ...form, hosts: e.target.value })} placeholder="competitor.example\nshop.example" /><p className="field-help">Lowercase DNS hostnames only. Exact hosts are allowed; subdomains are not silently included.</p></div>
            <div className="field field-wide"><span className="field-label">Eligible product conditions</span><div className="choice-row"><label className="choice"><input type="checkbox" checked={form.eligibleNew} onChange={(e) => setForm({ ...form, eligibleNew: e.target.checked })} /> NEW</label><label className="choice"><input type="checkbox" checked={form.eligibleRefurbished} onChange={(e) => setForm({ ...form, eligibleRefurbished: e.target.checked })} /> REFURBISHED</label></div></div>
          </div>
          <InlineError message={error} />
          {submittedId ? <p className="form-success">Policy submitted and verified in contract state. <button className="button button-quiet" type="button" onClick={() => router.push(`/policies/${encodeURIComponent(submittedId)}`)}>Open policy →</button></p> : null}
          <div className="form-submit"><Button type="submit" disabled={Boolean(tx.progress && tx.progress.state !== "FAILED")}>{tx.progress && tx.progress.state !== "FAILED" ? "Submitting…" : "Create immutable policy"}</Button></div>
        </form>
      </Card>
      {tx.progress ? <TransactionCard progress={tx.progress} onDismiss={tx.progress.state === "COMPLETE" ? tx.clear : undefined} /> : null}
      {wallet.address ? <p className="field-help" style={{ marginTop: 14 }}>Merchant sender: <span className="mono">{wallet.address}</span></p> : null}
    </div>
  );
}

export function PurchaseForm() {
  const wallet = useWallet();
  const tx = useContractTransaction();
  const [form, setForm] = useState(initialPurchase);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const config = getConfig();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const idError = validateId(form.id, "Purchase ID");
    const buyerError = isAddress(form.buyerAddress) ? null : "Enter a valid 20-byte buyer wallet address";
    const conditionError = validateCondition(form.condition) ? null : "Choose NEW or REFURBISHED";
    let priceMinor = 0n;
    try { priceMinor = parseMinorUnits(form.price); } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid price"); return; }
    if (idError || buyerError || conditionError || !form.policyId.trim() || !form.title.trim() || !form.manufacturer.trim() || !form.model.trim() || !form.sku.trim() || !/^[A-Z]{3}$/.test(form.currency)) {
      setError(idError ?? buyerError ?? conditionError ?? "Complete every purchase field using the expected format.");
      return;
    }
    if (!config.configured) { setError("MatchClaim contract is not configured"); return; }
    try {
      const client = createReadClient(config);
      const policy = await readPolicy(client, form.policyId.trim());
      if (wallet.address && policy.merchant_address.toLowerCase() !== wallet.address.toLowerCase()) {
        setError("The connected wallet is not the merchant that controls this policy.");
        return;
      }
      try { await readPurchase(client, form.id); setError("That purchase ID already exists. Choose a new immutable ID."); return; } catch (cause) {
        if (!isExpectedMissing(cause, "purchase")) throw cause;
      }
      const hash = await tx.run({
        operation: "register_purchase",
        expectedEntityId: form.id,
        write: (writeClient) => writeRegisterPurchase(writeClient, [form.id, form.policyId.trim(), form.buyerAddress.trim(), form.title.trim(), form.manufacturer.trim(), form.model.trim(), form.sku.trim(), form.condition, priceMinor, form.currency]),
        verifyPostcondition: async (readClient) => { try { await readPurchase(readClient, form.id); return true; } catch { return false; } },
      });
      if (hash) setSubmittedId(form.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purchase precondition could not be checked");
    }
  }

  return (
    <div>
      <Card className="form-card">
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <div className="field"><Label htmlFor="purchase-id" hint="Immutable">Purchase ID</Label><input className="input" id="purchase-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="order-1048" /></div>
            <div className="field"><Label htmlFor="purchase-policy">Policy ID</Label><input className="input" id="purchase-policy" value={form.policyId} onChange={(e) => setForm({ ...form, policyId: e.target.value })} placeholder="acme-price-match-v1" /></div>
            <div className="field field-wide"><Label htmlFor="buyer-address">Buyer wallet address</Label><input className="input mono" id="buyer-address" value={form.buyerAddress} onChange={(e) => setForm({ ...form, buyerAddress: e.target.value })} placeholder="0x…" /><p className="field-help">Transported as the exact string expected by the contract, which validates it as an Address.</p></div>
            <div className="field field-wide"><Label htmlFor="product-title">Product title</Label><input className="input" id="product-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Acme Phone 12 Pro" /></div>
            <div className="field"><Label htmlFor="manufacturer">Manufacturer</Label><input className="input" id="manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Acme" /></div>
            <div className="field"><Label htmlFor="model-number">Model number</Label><input className="input" id="model-number" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="M-12P" /></div>
            <div className="field"><Label htmlFor="sku">SKU</Label><input className="input" id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU-12P-BLK" /></div>
            <div className="field"><Label htmlFor="condition">Condition</Label><select className="select" id="condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option value="NEW">NEW</option><option value="REFURBISHED">REFURBISHED</option></select></div>
            <div className="field"><Label htmlFor="paid-price">Paid price</Label><input className="input" id="paid-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="799.99" /><p className="field-help">UI accepts 2 decimals; the contract receives integer minor units.</p></div>
            <div className="field"><Label htmlFor="currency">Currency</Label><input className="input" id="currency" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} placeholder="USD" /></div>
          </div>
          <InlineError message={error} />
          {submittedId ? <p className="form-success">Purchase submitted and verified in contract state. <a className="button button-quiet" href={`/purchases/${encodeURIComponent(submittedId)}`}>Open purchase →</a></p> : null}
          <div className="form-submit"><Button type="submit" disabled={Boolean(tx.progress && tx.progress.state !== "FAILED")}>{tx.progress && tx.progress.state !== "FAILED" ? "Registering…" : "Register immutable purchase"}</Button></div>
        </form>
      </Card>
      {tx.progress ? <TransactionCard progress={tx.progress} /> : null}
      {wallet.address ? <p className="field-help" style={{ marginTop: 14 }}>Merchant sender: <span className="mono">{wallet.address}</span></p> : null}
    </div>
  );
}

export function ClaimForm({ purchase, policy }: { purchase: Purchase; policy: MerchantPolicy }) {
  const router = useRouter();
  const wallet = useWallet();
  const tx = useContractTransaction();
  const [url, setUrl] = useState("");
  const [assessmentId, setAssessmentId] = useState(() => suggestedAssessmentId());
  const [error, setError] = useState("");
  const config = getConfig();
  const hosts = useMemo(() => policy.approved_competitor_hosts, [policy.approved_competitor_hosts]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const urlError = validateHttpsCompetitorUrl(url, hosts);
    const idError = validateId(assessmentId, "Assessment ID");
    if (urlError || idError) { setError(urlError ?? idError ?? "Check the claim details"); return; }
    if (!wallet.address || wallet.address.toLowerCase() !== purchase.buyer_address.toLowerCase()) {
      setError("Connect the registered buyer wallet before submitting this claim.");
      return;
    }
    if (purchase.authorization_id) { setError("This purchase already has a permanent authorization."); return; }
    if (!config.configured) { setError("MatchClaim contract is not configured"); return; }
    try {
      const client = createReadClient(config);
      try { await readAssessment(client, assessmentId); setError("That assessment ID is already used. Choose another ID."); return; } catch (cause) {
        if (!isExpectedMissing(cause, "assessment")) throw cause;
      }
      const hash = await tx.run({
        operation: "assess_price_match",
        expectedEntityId: assessmentId,
        write: (writeClient) => writeAssessPriceMatch(writeClient, [purchase.purchase_id, assessmentId, url]),
        verifyPostcondition: async (readClient) => { try { await readAssessment(readClient, assessmentId); return true; } catch { return false; } },
      });
      if (hash) router.push(`/assessments/${encodeURIComponent(assessmentId)}?tx=${encodeURIComponent(hash)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim precondition could not be checked");
    }
  }

  return (
    <Card className="form-card">
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field field-wide"><Label htmlFor="competitor-url">Competitor product URL</Label><input className="input" id="competitor-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://${hosts[0]}/product`} /><p className="field-help">The contract independently retrieves and evaluates this public HTTPS page. Exact approved hostname only.</p></div>
          <div className="field field-wide"><Label htmlFor="assessment-id" hint="Review before submitting">Assessment ID</Label><input className="input" id="assessment-id" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} /><p className="field-help">This identifier creates a new immutable assessment record. It is not a timestamp or verdict.</p></div>
        </div>
        <InlineError message={error} />
        <div className="form-submit"><Button type="submit" disabled={Boolean(tx.progress && tx.progress.state !== "FAILED")}>{tx.progress && tx.progress.state !== "FAILED" ? "Assessing with validators…" : "Submit price-match claim"}</Button></div>
      </form>
      {tx.progress ? <TransactionCard progress={tx.progress} /> : null}
    </Card>
  );
}

function suggestedAssessmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `assessment_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
  return "assessment_review";
}

export function ClaimResultSummary({ assessment }: { assessment: ClaimAssessment }) {
  const presentation = presentVerdict(assessment.verdict);
  return <div className={`verdict-card ${presentation.tone === "caution" ? "caution" : presentation.tone === "neutral" ? "neutral" : ""}`}><p className="eyebrow">Contract assessment</p><h2>{presentation.label}</h2><p>{presentation.description}</p><p className="field-help">{formatMinorUnits(assessment.competitor_price_minor, assessment.currency)} observed competitor price</p></div>;
}

export function AuthorizationLookup({ authorization }: { authorization: { authorization_id: string; authorized_credit_minor: bigint; currency: string } }) {
  return <div className="authorization-banner"><p className="eyebrow">Permanent contract result</p><h2>Verified price-match credit</h2><p>{formatMinorUnits(authorization.authorized_credit_minor, authorization.currency)} authorized under {authorization.authorization_id}.</p></div>;
}
