import { ExecutionResult, type ReadClient, TransactionStatus } from "./client";
import { getConfig, type MatchClaimConfig } from "./config";
import {
  removePending,
  updatePendingStatus,
  writePending,
  type PendingTransaction,
} from "./pending";
import type { WriteOperation } from "./types";

export type HumanTransactionState =
  | "PREPARING"
  | "WAITING_FOR_WALLET"
  | "SUBMITTED"
  | "CONFIRMING"
  | "FINALIZED"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED";

export type TransactionFailureCode =
  | "WALLET_REJECTED"
  | "WRONG_NETWORK"
  | "RPC_UNAVAILABLE"
  | "TIMEOUT"
  | "DISAGREE"
  | "UNDETERMINED"
  | "EXECUTION_FAILED"
  | "CONTRACT_PRECONDITION"
  | "MALFORMED_RESULT"
  | "MISSING_EXPECTED_STATE";

export interface TransactionProgress {
  state: HumanTransactionState;
  txHash?: string;
  statusName?: string;
  failureCode?: TransactionFailureCode;
  message?: string;
}

export class TransactionFailure extends Error {
  constructor(public readonly code: TransactionFailureCode, message: string) {
    super(message);
    this.name = "TransactionFailure";
  }
}

const terminalFailureStatuses = new Set([
  TransactionStatus.UNDETERMINED,
  TransactionStatus.CANCELED,
  TransactionStatus.VALIDATORS_TIMEOUT,
  TransactionStatus.LEADER_TIMEOUT,
]);

function classifyError(error: unknown): TransactionFailure {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("4001")) {
    return new TransactionFailure("WALLET_REJECTED", "The wallet cancelled the request.");
  }
  if (lower.includes("chain") && (lower.includes("wallet") || lower.includes("network"))) {
    return new TransactionFailure("WRONG_NETWORK", message);
  }
  if (lower.includes("does not exist") || lower.includes("already exists") || lower.includes("only the") || lower.includes("must ")) {
    return new TransactionFailure("CONTRACT_PRECONDITION", message);
  }
  if (lower.includes("model_failure") || lower.includes("malformed")) {
    return new TransactionFailure("MALFORMED_RESULT", message);
  }
  if (lower.includes("fetch") || lower.includes("rpc") || lower.includes("network")) {
    return new TransactionFailure("RPC_UNAVAILABLE", message);
  }
  return new TransactionFailure("UNDETERMINED", "The submission response was ambiguous. Do not rebroadcast automatically.");
}

function statusToProgress(statusName: string | undefined): TransactionProgress["state"] {
  if (statusName === TransactionStatus.FINALIZED) return "FINALIZED";
  if (statusName === TransactionStatus.ACCEPTED || statusName === TransactionStatus.REVEALING || statusName === TransactionStatus.COMMITTING || statusName === TransactionStatus.PROPOSING) return "CONFIRMING";
  return "SUBMITTED";
}

function executionSucceeded(receipt: { txExecutionResultName?: string }): boolean {
  return receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;
}

export interface ReconcileOptions {
  client: ReadClient;
  record: PendingTransaction;
  verifyPostcondition: () => Promise<boolean>;
  onProgress?: (progress: TransactionProgress) => void;
  intervalMs?: number;
  maxPolls?: number;
}

export async function reconcileTransaction(options: ReconcileOptions): Promise<void> {
  const { client, record, verifyPostcondition, onProgress } = options;
  const intervalMs = options.intervalMs ?? 2_000;
  const maxPolls = options.maxPolls ?? 90;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    let tx;
    try {
      tx = await client.getTransaction({ hash: record.txHash as never });
    } catch {
      if (poll === maxPolls - 1) {
        updatePendingStatus(record.txHash, "TIMEOUT");
        throw new TransactionFailure("RPC_UNAVAILABLE", "The transaction could not be reconciled with the network.");
      }
      await delay(intervalMs);
      continue;
    }
    const statusName = tx.statusName ?? String(tx.status ?? "");
    onProgress?.({ state: statusToProgress(statusName), txHash: record.txHash, statusName });
    if (terminalFailureStatuses.has(statusName as never)) {
      const code = statusName === TransactionStatus.UNDETERMINED ? "DISAGREE" : "UNDETERMINED";
      updatePendingStatus(record.txHash, code === "DISAGREE" ? "FAILED" : "UNDETERMINED");
      throw new TransactionFailure(code, statusName === TransactionStatus.UNDETERMINED
        ? "Validators did not reach a business result. No verdict was recorded."
        : `The transaction ended in ${statusName}.`);
    }
    if (statusName === TransactionStatus.FINALIZED) {
      onProgress?.({ state: "VERIFYING", txHash: record.txHash, statusName });
      let receipt;
      try {
        receipt = await client.waitForTransactionReceipt({
          hash: record.txHash as never,
          status: TransactionStatus.FINALIZED,
          interval: intervalMs,
          retries: 2,
        });
      } catch (error) {
        updatePendingStatus(record.txHash, "FAILED");
        throw classifyError(error);
      }
      if (!executionSucceeded(receipt)) {
        updatePendingStatus(record.txHash, "FAILED");
        throw new TransactionFailure("EXECUTION_FAILED", "The transaction finalized, but contract execution failed.");
      }
      if (!(await verifyPostcondition())) {
        updatePendingStatus(record.txHash, "FAILED");
        throw new TransactionFailure("MISSING_EXPECTED_STATE", "Execution succeeded, but the expected contract state was not found.");
      }
      removePending(record.txHash);
      onProgress?.({ state: "COMPLETE", txHash: record.txHash, statusName });
      return;
    }
    updatePendingStatus(record.txHash, "CONFIRMING");
    onProgress?.({ state: statusToProgress(statusName), txHash: record.txHash, statusName });
    await delay(intervalMs);
  }
  updatePendingStatus(record.txHash, "TIMEOUT");
  throw new TransactionFailure("TIMEOUT", "The transaction is still pending. It remains saved for recovery; do not rebroadcast.");
}

export interface WriteOptions {
  operation: WriteOperation;
  expectedEntityId: string;
  config?: MatchClaimConfig;
  write: () => Promise<string>;
  verifyPostcondition: () => Promise<boolean>;
  client: ReadClient;
  onProgress?: (progress: TransactionProgress) => void;
}

export async function broadcastOnceAndReconcile(options: WriteOptions): Promise<string> {
  const config = options.config ?? getConfig();
  if (!config.configured || !config.contractAddress || !config.chainId) {
    throw new TransactionFailure("RPC_UNAVAILABLE", "MatchClaim contract is not configured.");
  }
  options.onProgress?.({ state: "WAITING_FOR_WALLET" });
  let hash: string;
  try {
    hash = await options.write();
  } catch (error) {
    const classified = classifyError(error);
    options.onProgress?.({ state: "FAILED", failureCode: classified.code, message: classified.message });
    throw classified;
  }
  if (!/^0x[0-9a-fA-F]+$/.test(hash)) {
    const failure = new TransactionFailure("UNDETERMINED", "The wallet returned no usable transaction hash. Do not rebroadcast.");
    options.onProgress?.({ state: "FAILED", failureCode: failure.code, message: failure.message });
    throw failure;
  }
  const record: PendingTransaction = {
    operation: options.operation,
    txHash: hash,
    expectedEntityId: options.expectedEntityId,
    network: config.network,
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    status: "SUBMITTED",
    updatedAt: new Date().toISOString(),
  };
  writePending(record);
  options.onProgress?.({ state: "SUBMITTED", txHash: hash });
  await reconcileTransaction({
    client: options.client,
    record,
    verifyPostcondition: options.verifyPostcondition,
    onProgress: options.onProgress,
  });
  return hash;
}

export async function verifyPendingRecord(record: PendingTransaction, client: ReadClient): Promise<boolean> {
  try {
    if (record.operation === "create_policy") {
      await client.readContract({ address: record.contractAddress as `0x${string}`, functionName: "get_policy", args: [record.expectedEntityId] });
    } else if (record.operation === "register_purchase") {
      await client.readContract({ address: record.contractAddress as `0x${string}`, functionName: "get_purchase", args: [record.expectedEntityId] });
    } else {
      await client.readContract({ address: record.contractAddress as `0x${string}`, functionName: "get_assessment", args: [record.expectedEntityId] });
    }
    return true;
  } catch {
    return false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
