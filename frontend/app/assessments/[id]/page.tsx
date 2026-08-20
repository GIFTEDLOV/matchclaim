"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createReadClient, readAssessment, readAuthorization, readPurchase } from "@/lib/client";
import { getConfig } from "@/lib/config";
import { formatMinorUnits } from "@/lib/money";
import { presentVerdict } from "@/lib/verdict";
import type { ClaimAssessment, PriceMatchAuthorization, Purchase } from "@/lib/types";
import { AuthorizationLookup } from "@/components/forms";
import { Button, Card, DataRow, EmptyState, LoadingBlock, PageHeader, TechnicalDetails } from "@/components/ui";

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [assessment, setAssessment] = useState<ClaimAssessment | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [authorization, setAuthorization] = useState<PriceMatchAuthorization | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!getConfig().configured) return; async function load() { try { const client = createReadClient(); const next = await readAssessment(client, id); setAssessment(next); const nextPurchase = await readPurchase(client, next.purchase_id); setPurchase(nextPurchase); if (nextPurchase.authorization_id) setAuthorization(await readAuthorization(client, nextPurchase.authorization_id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Assessment could not be read"); } } void load(); }, [id]);
  if (!getConfig().configured) return <><PageHeader eyebrow="Assessment" title="Contract assessment" /><EmptyState title="Contract not configured" description="Connect a real deployed contract before reading assessment state." /></>;
  if (error) return <><PageHeader eyebrow="Assessment" title={id} /><EmptyState title="Assessment unavailable" description={error} /></>;
  if (!assessment || !purchase) return <><PageHeader eyebrow="Assessment" title={id} /><LoadingBlock /></>;
  const presentation = presentVerdict(assessment.verdict);
  return <><PageHeader eyebrow="Assessment detail" title={assessment.assessment_id} description="A stored semantic result from the MatchClaim contract." action={<Button href={`/purchases/${encodeURIComponent(assessment.purchase_id)}`}>Open purchase</Button>} />{authorization ? <AuthorizationLookup authorization={authorization} /> : null}<div className="detail-layout" style={{ marginTop: 18 }}><div className="detail-stack"><Card className={`verdict-card ${presentation.tone === "caution" ? "caution" : presentation.tone === "neutral" ? "neutral" : ""}`}><p className="eyebrow">Contract verdict</p><h2>{presentation.label}</h2><p>{presentation.description}</p><dl className="data-list"><DataRow label="Original price" value={formatMinorUnits(purchase.paid_price_minor, purchase.currency)} /><DataRow label="Competitor price" value={assessment.verdict === "MATCH_ELIGIBLE" ? formatMinorUnits(assessment.competitor_price_minor, assessment.currency) : "No eligible price"} /><DataRow label="Authorized credit" value={assessment.verdict === "MATCH_ELIGIBLE" ? formatMinorUnits(assessment.authorized_credit_minor, assessment.currency) : "No authorization"} /></dl></Card><Card><div className="card-heading"><div><h2>Evidence submitted</h2><p>Fetched and interpreted independently by validators.</p></div></div><dl className="data-list"><DataRow label="Competitor URL" value={<a href={assessment.competitor_url} target="_blank" rel="noreferrer" className="list-item-link">Open public page ↗</a>} /><DataRow label="Purchase" value={<Link href={`/purchases/${encodeURIComponent(purchase.purchase_id)}`} className="list-item-link">{purchase.product_title}</Link>} /></dl></Card></div><Card className="side-note"><p className="eyebrow">Result handling</p><h2>{assessment.verdict === "INCONCLUSIVE" ? "Not a denial." : assessment.verdict === "NOT_ELIGIBLE" ? "No authorization issued." : "Authorization issued."}</h2><p>{assessment.verdict === "INCONCLUSIVE" ? "Infrastructure and semantic uncertainty are kept separate. This result means the evidence relationship could not be determined reliably." : assessment.verdict === "NOT_ELIGIBLE" ? "The contract stored the assessment, but did not create a permanent credit authorization." : "Only MATCH_ELIGIBLE creates the permanent authorization shown above."}</p><TechnicalDetails><dl className="data-list"><DataRow label="Result digest" value={assessment.result_digest} mono /><DataRow label="Assessment digest" value={assessment.assessment_digest} mono /><DataRow label="Assessment view" value="get_assessment(assessment_id)" mono /></dl></TechnicalDetails></Card></div></>;
}
