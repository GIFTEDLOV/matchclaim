"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReadClient, readPurchase } from "@/lib/client";
import { getConfig } from "@/lib/config";
import { isExpectedMissing } from "@/lib/validation";
import { Button, Card, InlineError, Label, PageHeader } from "@/components/ui";

export default function FindPurchasePage() {
  const router = useRouter();
  const [purchaseId, setPurchaseId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!getConfig().configured) { setError("MatchClaim contract is not configured"); return; }
    if (!purchaseId.trim()) { setError("Enter the registered purchase ID"); return; }
    setLoading(true);
    try {
      await readPurchase(createReadClient(), purchaseId.trim());
      router.push(`/claim/${encodeURIComponent(purchaseId.trim())}`);
    } catch (cause) {
      setError(isExpectedMissing(cause, "purchase") ? "No purchase exists for this ID." : cause instanceof Error ? cause.message : "The purchase could not be read");
    } finally { setLoading(false); }
  }
  return <><PageHeader eyebrow="Buyer claim" title="Find your registered purchase." description="Enter the immutable purchase ID provided by the retailer. The contract remains the source of truth." /><Card className="form-card" ><form className="lookup-form" onSubmit={submit}><div className="field" style={{ flex: 1 }}><Label htmlFor="find-purchase">Purchase ID</Label><input className="input" id="find-purchase" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)} placeholder="order-1048" /></div><Button type="submit" disabled={loading}>{loading ? "Reading…" : "Open purchase"}</Button></form><InlineError message={error} /></Card></>;
}
