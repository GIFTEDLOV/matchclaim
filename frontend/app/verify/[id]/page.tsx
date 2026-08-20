"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createReadClient, readAssessment, readAuthorization, readPurchase } from "@/lib/client";
import { getConfig } from "@/lib/config";
import { formatMinorUnits } from "@/lib/money";
import { isExpectedMissing } from "@/lib/validation";
import type { ClaimAssessment, PriceMatchAuthorization, Purchase } from "@/lib/types";
import { Button, Card, DataRow, EmptyState, LoadingBlock, PageHeader, TechnicalDetails } from "@/components/ui";

export default function AuthorizationVerificationPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [authorization, setAuthorization] = useState<PriceMatchAuthorization | null>(null);
  const [assessment, setAssessment] = useState<ClaimAssessment | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => { if (!getConfig().configured) return; async function load() { const client = createReadClient(); let next: PriceMatchAuthorization; try { next = await readAuthorization(client, id); } catch (cause) { if (isExpectedMissing(cause, "authorization")) setMissing(true); else setError(cause instanceof Error ? cause.message : "Authorization could not be read"); return; } try { setAuthorization(next); const nextPurchase = await readPurchase(client, next.purchase_id); setPurchase(nextPurchase); setAssessment(await readAssessment(client, next.assessment_id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Authorization context could not be read"); } } void load(); }, [id]);
  if (!getConfig().configured) return <><PageHeader eyebrow="Verification" title="Verify authorization" /><EmptyState title="Contract not configured" description="A live public contract address is required before verification." /></>;
  if (missing) return <><PageHeader eyebrow="Verification" title={id} /><EmptyState title="No authorization exists for this ID." description="The verifier does not infer why a record is missing." action={<Button href="/verify">Try another ID</Button>} /></>;
  if (error) return <><PageHeader eyebrow="Verification" title={id} /><EmptyState title="Authorization could not be read" description={error} action={<Button href="/verify">Try again</Button>} /></>;
  if (!authorization || !purchase || !assessment) return <><PageHeader eyebrow="Verification" title={id} /><LoadingBlock /></>;
  return <><PageHeader eyebrow="Authorization verification" title="Verified PriceMatchAuthorization" description="The permanent credit record was read directly from the configured MatchClaim contract." action={<Button href="/verify">Verify another</Button>} /><div className="detail-layout"><div className="detail-stack"><div className="authorization-banner"><p className="eyebrow">Permanent contract result</p><h2>Price match credit authorized</h2><p>{formatMinorUnits(authorization.authorized_credit_minor, authorization.currency)} for {purchase.product_title}.</p></div><Card><dl className="data-list"><DataRow label="Authorization ID" value={authorization.authorization_id} mono /><DataRow label="Purchase" value={<Link className="list-item-link" href={`/purchases/${encodeURIComponent(authorization.purchase_id)}`}>{purchase.product_title}</Link>} /><DataRow label="Assessment" value={<Link className="list-item-link" href={`/assessments/${encodeURIComponent(authorization.assessment_id)}`}>{authorization.assessment_id}</Link>} /><DataRow label="Original price" value={formatMinorUnits(authorization.original_price_minor, authorization.currency)} /><DataRow label="Competitor price" value={formatMinorUnits(authorization.competitor_price_minor, authorization.currency)} /><DataRow label="Authorized credit" value={formatMinorUnits(authorization.authorized_credit_minor, authorization.currency)} /><DataRow label="Currency" value={authorization.currency} /></dl><TechnicalDetails><dl className="data-list"><DataRow label="Authorization digest" value={authorization.authorization_digest} mono /><DataRow label="Assessment/result digest" value={`${authorization.result_digest} · ${assessment.assessment_digest}`} mono /><DataRow label="Contract address" value={getConfig().contractAddress} mono /><DataRow label="Network" value={`${getConfig().chainName} · chain ${getConfig().chainId}`} /></dl></TechnicalDetails></Card></div><Card className="side-note"><p className="eyebrow">Readable context</p><h2>{purchase.manufacturer} {purchase.model_number}</h2><p>{purchase.product_condition} · {purchase.sku}</p><p className="field-help">The authorization is linked to assessment {assessment.assessment_id} and purchase {purchase.purchase_id}.</p></Card></div></>;
}
