"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createReadClient, readPolicy } from "@/lib/client";
import { getConfig } from "@/lib/config";
import type { MerchantPolicy } from "@/lib/types";
import { Button, Card, DataRow, EmptyState, LoadingBlock, PageHeader, TechnicalDetails } from "@/components/ui";

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!getConfig().configured) return; void readPolicy(createReadClient(), id).then(setPolicy).catch((cause) => setError(cause instanceof Error ? cause.message : "Policy could not be read")); }, [id]);
  return <><PageHeader eyebrow="Policy detail" title={policy?.merchant_name ?? id} description="An immutable merchant rulebook committed to the MatchClaim contract." action={<Button href="/merchant/purchases/new">Register purchase</Button>} />{!getConfig().configured ? <EmptyState title="Contract not configured" description="Connect a real deployed contract before reading policy state." /> : error ? <EmptyState title="Policy unavailable" description={error} /> : !policy ? <LoadingBlock /> : <div className="detail-layout"><div className="detail-stack"><Card><div className="detail-title"><div><p className="eyebrow">Immutable policy</p><h2>{policy.policy_id}</h2></div><span className="status-pill">{policy.active ? "Active" : "Inactive"}</span></div><dl className="data-list"><DataRow label="Merchant" value={policy.merchant_name} /><DataRow label="Approved hosts" value={<span>{policy.approved_competitor_hosts.join(" · ")}</span>} /><DataRow label="Eligible conditions" value={[policy.eligible_new ? "NEW" : "", policy.eligible_refurbished ? "REFURBISHED" : ""].filter(Boolean).join(" · ")} /><DataRow label="Policy text" value={policy.policy_text} /></dl><TechnicalDetails><dl className="data-list"><DataRow label="Merchant address" value={policy.merchant_address} mono /><DataRow label="Policy digest" value={policy.policy_digest} mono /><DataRow label="Contract view" value="get_policy(policy_id)" mono /></dl></TechnicalDetails></Card></div><Card className="side-note"><p className="eyebrow">Continue</p><h2>Register against this policy.</h2><p>Only the connected wallet matching the merchant address can register a purchase.</p><Link className="button button-primary" href={`/merchant/purchases/new?policy=${encodeURIComponent(policy.policy_id)}`}>Register purchase</Link></Card></div>}</>;
}
