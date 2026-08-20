"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getConfig } from "@/lib/config";
import { Button, Card, InlineError, Label } from "@/components/ui";

export default function VerifyPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!getConfig().configured) { setError("MatchClaim contract is not configured"); return; } if (!id.trim()) { setError("Enter an authorization ID"); return; } router.push(`/verify/${encodeURIComponent(id.trim())}`); }
  return <><div className="verify-hero"><p className="eyebrow">Public verifier</p><h1>Check a price-match authorization.</h1><p>Read the permanent authorization directly from the MatchClaim contract. No operator, screenshot, or off-chain result is needed.</p><Card><form className="lookup-form" onSubmit={submit}><div className="field" style={{ flex: 1, textAlign: "left" }}><Label htmlFor="authorization-id">Authorization ID</Label><input className="input mono" id="authorization-id" value={id} onChange={(e) => setId(e.target.value)} placeholder="auth_…" /></div><Button type="submit">Verify record</Button></form><InlineError message={error} /></Card><div className="verify-trust"><div><strong>Permanent</strong><span>Stored on-chain after finality.</span></div><div><strong>Readable</strong><span>Purchase and assessment context can be resolved.</span></div><div><strong>Fail closed</strong><span>Missing IDs are not interpreted.</span></div></div></div></>;
}
