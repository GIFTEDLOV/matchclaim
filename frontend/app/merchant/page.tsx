"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createReadClient, readPolicy, readPolicyIds, readPurchase, readPurchaseIds } from "@/lib/client";
import { getConfig } from "@/lib/config";
import type { MerchantPolicy, Purchase } from "@/lib/types";
import { Button, Card, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { useWallet } from "@/components/wallet";
import { formatMinorUnits } from "@/lib/money";

const config = getConfig();

export default function MerchantDashboardPage() {
  const wallet = useWallet();
  const [policies, setPolicies] = useState<MerchantPolicy[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!config.configured) { setLoading(false); return; }
      setLoading(true); setError("");
      try {
        const client = createReadClient(config);
        const policyIds = await readPolicyIds(client);
        const loadedPolicies = (await Promise.all(policyIds.map((id) => readPolicy(client, id)))).filter((policy) => !wallet.address || policy.merchant_address.toLowerCase() === wallet.address.toLowerCase());
        const relevantPolicyIds = new Set(loadedPolicies.map((policy) => policy.policy_id));
        const purchaseIds = await readPurchaseIds(client);
        const loadedPurchases = (await Promise.all(purchaseIds.map((id) => readPurchase(client, id)))).filter((purchase) => relevantPolicyIds.has(purchase.policy_id));
        if (!cancelled) { setPolicies(loadedPolicies); setPurchases(loadedPurchases); }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "The contract could not be read");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [wallet.address]);

  return <>
    <PageHeader eyebrow="Merchant workspace" title="Run price-match operations." description="Commit rules, register purchase baselines, and inspect contract-owned outcomes." action={<Button href="/merchant/policies/new">Create policy</Button>} />
    {error ? <div className="wallet-error" role="alert">{error}</div> : null}
    {loading ? <LoadingBlock /> : !config.configured ? <EmptyState title="Connect the contract to begin" description="This workspace fails closed until a public GenLayer RPC and deployed MatchClaim address are configured." /> : !wallet.address ? <EmptyState title="Connect a merchant wallet" description="Policy and purchase records are filtered against the connected merchant address when available." action={<Button variant="secondary" onClick={() => void wallet.connect()}>Connect wallet</Button>} /> : <>
      <div className="stats-grid"><div className="stat"><span className="stat-label">Policies controlled</span><div className="stat-value">{policies.length}</div></div><div className="stat"><span className="stat-label">Registered purchases</span><div className="stat-value">{purchases.length}</div></div><div className="stat"><span className="stat-label">Claims assessed</span><div className="stat-value">{purchases.filter((purchase) => purchase.claim_assessed).length}</div></div></div>
      <div className="dashboard-grid">
        <Card><div className="card-heading"><div><h2>Policies</h2><p>Immutable rules controlled by this wallet.</p></div><Link className="list-item-link" href="/merchant/policies/new">New policy</Link></div>{policies.length ? <div className="list">{policies.map((policy) => <div className="list-item" key={policy.policy_id}><div><strong>{policy.merchant_name}</strong><span>{policy.policy_id} · {policy.approved_competitor_hosts.length} approved host{policy.approved_competitor_hosts.length === 1 ? "" : "s"}</span></div><Link className="list-item-link" href={`/policies/${encodeURIComponent(policy.policy_id)}`}>View →</Link></div>)}</div> : <EmptyState title="No policies yet" description="Create the first immutable rulebook for this merchant." action={<Button href="/merchant/policies/new">Create policy</Button>} />}</Card>
        <Card><div className="card-heading"><div><h2>Purchases</h2><p>Registered baselines and claim status.</p></div><Link className="list-item-link" href="/merchant/purchases/new">Register</Link></div>{purchases.length ? <div className="list">{purchases.map((purchase) => <div className="list-item" key={purchase.purchase_id}><div><strong>{purchase.product_title}</strong><span>{purchase.purchase_id} · {formatMinorUnits(purchase.paid_price_minor, purchase.currency)}</span></div><Link className="list-item-link" href={`/purchases/${encodeURIComponent(purchase.purchase_id)}`}>{purchase.authorization_id ? "Authorized →" : purchase.claim_assessed ? "Assessed →" : "Open →"}</Link></div>)}</div> : <EmptyState title="No purchases yet" description="Register a purchase against one of your immutable policies." action={<Button href="/merchant/purchases/new">Register purchase</Button>} />}</Card>
      </div>
    </>}
  </>;
}
