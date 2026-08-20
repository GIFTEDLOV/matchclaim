"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createReadClient } from "@/lib/client";
import { getConfig } from "@/lib/config";
import { readPending, type PendingTransaction } from "@/lib/pending";
import { reconcileTransaction, verifyPendingRecord } from "@/lib/transaction";
import { Button, ConfigNotice } from "./ui";
import { shortAddress, useWallet } from "./wallet";

function PendingRecovery() {
  const [records, setRecords] = useState<PendingTransaction[]>(() => readPending());
  useEffect(() => {
    const config = getConfig();
    const current = readPending();
    if (!config.configured || !current.length) return;
    const client = createReadClient(config);
    let cancelled = false;
    void Promise.all(current.filter((record) => record.status !== "FAILED" && record.status !== "CANCELED").map(async (record) => {
      try {
        await reconcileTransaction({
          client,
          record,
          verifyPostcondition: () => verifyPendingRecord(record, client),
        });
      } catch {
        // The record remains persisted with a terminal or timeout status.
      }
    })).then(() => {
      if (!cancelled) setRecords(readPending());
    });
    return () => { cancelled = true; };
  }, []);

  const visible = records.filter((record) => record.status !== "FAILED" && record.status !== "CANCELED");
  if (!visible.length) return null;
  return (
    <div className="pending-banner" role="status">
      <span className="status-dot status-dot-live" aria-hidden="true" />
      <span><strong>Transaction recovery in progress.</strong> MatchClaim is reconciling the same saved hash; it will not rebroadcast.</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const config = getConfig();
  const wallet = useWallet();
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="MatchClaim home"><span className="wordmark-mark">M</span>MatchClaim</Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/merchant">Merchant</Link>
          <Link href="/verify">Verify</Link>
          <Link href="/">How it works</Link>
        </nav>
        <div className="header-actions">
          {wallet.address ? (
            <button className="wallet-chip" type="button" onClick={wallet.disconnect} title="Disconnect this view">
              <span className="status-dot status-dot-live" aria-hidden="true" />{shortAddress(wallet.address)}
            </button>
          ) : (
            <Button variant="secondary" onClick={() => void wallet.connect()} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
        </div>
      </header>
      {!config.configured ? <ConfigNotice /> : null}
      {wallet.error ? <div className="wallet-error" role="alert">{wallet.error}</div> : null}
      <PendingRecovery />
      <main>{children}</main>
      <footer className="site-footer"><span>MatchClaim</span><span>Retail price matching with accountable consensus.</span><span>{config.configured ? config.chainName : "Configuration required"}</span></footer>
    </div>
  );
}
