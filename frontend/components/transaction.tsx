"use client";

import { useState } from "react";
import { createReadClient, createWriteClient } from "@/lib/client";
import { getConfig } from "@/lib/config";
import { broadcastOnceAndReconcile, type TransactionFailureCode, type TransactionProgress } from "@/lib/transaction";
import type { WriteOperation } from "@/lib/types";
import { Button, Card } from "./ui";
import { useWallet } from "./wallet";

const stateLabels: Record<TransactionProgress["state"], string> = {
  PREPARING: "Preparing",
  WAITING_FOR_WALLET: "Waiting for wallet",
  SUBMITTED: "Submitted",
  CONFIRMING: "Confirming with validators",
  FINALIZED: "Finalized",
  VERIFYING: "Verifying result",
  COMPLETE: "Complete",
  FAILED: "Could not complete",
};

const failureLabels: Record<TransactionFailureCode, string> = {
  WALLET_REJECTED: "Wallet rejected",
  WRONG_NETWORK: "Wrong network",
  RPC_UNAVAILABLE: "RPC unavailable",
  TIMEOUT: "TIMEOUT",
  DISAGREE: "DISAGREE",
  UNDETERMINED: "UNDETERMINED",
  EXECUTION_FAILED: "Execution failed",
  CONTRACT_PRECONDITION: "Contract precondition failed",
  MALFORMED_RESULT: "Malformed or error result",
  MISSING_EXPECTED_STATE: "Expected state not found",
};

export function failureMessage(code: TransactionFailureCode): string {
  if (code === "DISAGREE" || code === "UNDETERMINED") return "The network did not produce a business verdict. No claim denial was inferred.";
  if (code === "EXECUTION_FAILED") return "The transaction finalized, but contract execution failed and state was not treated as successful.";
  if (code === "MISSING_EXPECTED_STATE") return "Execution succeeded, but the expected stored entity was not found. The UI did not mark the write complete.";
  if (code === "TIMEOUT") return "The same transaction hash is saved for recovery. Do not submit the write again.";
  return "The requested operation did not complete.";
}

export function TransactionCard({ progress, onDismiss }: { progress: TransactionProgress; onDismiss?: () => void }) {
  const isFailed = progress.state === "FAILED";
  return (
    <Card className={isFailed ? "transaction-card transaction-failed" : "transaction-card"}>
      <div className="transaction-heading"><div><p className="eyebrow">Transaction lifecycle</p><h2>{stateLabels[progress.state]}</h2></div><span className={isFailed ? "status-pill status-pill-danger" : "status-pill"}>{isFailed && progress.failureCode ? failureLabels[progress.failureCode] : stateLabels[progress.state]}</span></div>
      <div className="transaction-steps" aria-label="Transaction progress">
        {(["PREPARING", "WAITING_FOR_WALLET", "SUBMITTED", "CONFIRMING", "FINALIZED", "VERIFYING", "COMPLETE"] as const).map((state) => <span key={state} className={progress.state === state ? "transaction-step current" : progress.state === "FAILED" || state === "PREPARING" ? "transaction-step" : "transaction-step done"}>{stateLabels[state]}</span>)}
      </div>
      {progress.txHash ? <p className="tx-line">Hash <span className="mono">{progress.txHash}</span></p> : null}
      {isFailed && progress.failureCode ? <p className="form-error">{failureMessage(progress.failureCode)} {progress.message ?? ""}</p> : null}
      {onDismiss ? <Button variant="quiet" onClick={onDismiss}>Close</Button> : null}
    </Card>
  );
}

export function useContractTransaction() {
  const wallet = useWallet();
  const [progress, setProgress] = useState<TransactionProgress | null>(null);
  const [error, setError] = useState("");

  async function run(options: {
    operation: WriteOperation;
    expectedEntityId: string;
    write: (client: ReturnType<typeof createWriteClient>) => Promise<string>;
    verifyPostcondition: (client: ReturnType<typeof createReadClient>) => Promise<boolean>;
  }): Promise<string | null> {
    setError("");
    setProgress({ state: "PREPARING" });
    const config = getConfig();
    try {
      const session = wallet.address && wallet.provider
        ? { address: wallet.address, provider: wallet.provider }
        : await wallet.connect();
      const writeClient = createWriteClient(session.address, session.provider, config);
      const readClient = createReadClient(config);
      return await broadcastOnceAndReconcile({
        operation: options.operation,
        expectedEntityId: options.expectedEntityId,
        config,
        client: readClient,
        write: () => options.write(writeClient),
        verifyPostcondition: () => options.verifyPostcondition(readClient),
        onProgress: setProgress,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Transaction failed";
      setError(message);
      if (!progress || progress.state !== "FAILED") setProgress({ state: "FAILED", message });
      return null;
    }
  }

  return { progress, error, run, clear: () => { setProgress(null); setError(""); } };
}
