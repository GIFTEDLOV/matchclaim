"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createReadClient, readPolicy, readPurchase } from "@/lib/client";
import { getConfig } from "@/lib/config";
import type { MerchantPolicy, Purchase } from "@/lib/types";
import { ClaimForm } from "@/components/forms";
import { Card, DataRow, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { formatMinorUnits } from "@/lib/money";

export default function ClaimPage() {
  const params = useParams<{ purchaseId: string }>();
  const id = decodeURIComponent(params.purchaseId);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!getConfig().configured) return; async function load() { try { const client = createReadClient(); const nextPurchase = await readPurchase(client, id); setPurchase(nextPurchase); setPolicy(await readPolicy(client, nextPurchase.policy_id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Purchase could not be read"); } } void load(); }, [id]);
  return <><PageHeader eyebrow="Buyer claim" title="Submit a price-match claim." description="The registered buyer submits one public competitor URL. The contract decides whether the evidence is an eligible match." />{!getConfig().configured ? <EmptyState title="Contract not configured" description="A live public contract address is required before claims can be submitted." /> : error ? <EmptyState title="Claim unavailable" description={error} /> : !purchase || !policy ? <LoadingBlock /> : <div className="detail-layout"><div className="detail-stack"><Card><div className="card-heading"><div><p className="eyebrow">Immutable baseline</p><h2>{purchase.product_title}</h2><p>{purchase.manufacturer} · {purchase.model_number} · {purchase.product_condition}</p></div><span className="status-pill status-pill-neutral">{formatMinorUnits(purchase.paid_price_minor, purchase.currency)}</span></div><dl className="data-list"><DataRow label="Purchase ID" value={purchase.purchase_id} mono /><DataRow label="Buyer wallet" value={purchase.buyer_address} mono /><DataRow label="Currency" value={purchase.currency} /><DataRow label="Merchant policy" value={policy.merchant_name} /><DataRow label="Approved hosts" value={policy.approved_competitor_hosts.join(" · ")} /></dl></Card><ClaimForm purchase={purchase} policy={policy} /></div><Card className="side-note"><p className="eyebrow">Evidence boundary</p><h2>One public listing.</h2><p>Use a product page on one of the exact approved hosts. No uploads, screenshots, or private evidence are accepted in V1.</p><p className="field-help">The frontend validates basic admissibility for usability. The contract validates it again.</p></Card></div>}</>;
}
