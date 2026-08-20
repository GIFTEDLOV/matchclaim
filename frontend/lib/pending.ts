import type { WriteOperation } from "./types";

export const PENDING_STORAGE_KEY = "matchclaim:pending:v1";

export type PendingStatus = "SUBMITTED" | "CONFIRMING" | "TIMEOUT" | "UNDETERMINED" | "FAILED";

export interface PendingTransaction {
  operation: WriteOperation;
  txHash: string;
  expectedEntityId: string;
  network: string;
  chainId: number;
  contractAddress: string;
  status: PendingStatus;
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readPending(storage: StorageLike | null = browserStorage()): PendingTransaction[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PENDING_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingTransaction);
  } catch {
    return [];
  }
}

export function writePending(record: PendingTransaction, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  const records = readPending(storage).filter((item) => item.txHash !== record.txHash);
  storage.setItem(PENDING_STORAGE_KEY, JSON.stringify([...records, record]));
}

export function removePending(txHash: string, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  const records = readPending(storage).filter((item) => item.txHash !== txHash);
  if (records.length) storage.setItem(PENDING_STORAGE_KEY, JSON.stringify(records));
  else storage.removeItem(PENDING_STORAGE_KEY);
}

export function updatePendingStatus(
  txHash: string,
  status: PendingStatus,
  storage: StorageLike | null = browserStorage(),
): void {
  const record = readPending(storage).find((item) => item.txHash === txHash);
  if (!record || !storage) return;
  writePending({ ...record, status, updatedAt: new Date().toISOString() }, storage);
}

function isPendingTransaction(value: unknown): value is PendingTransaction {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PendingTransaction>;
  return typeof item.operation === "string" && typeof item.txHash === "string" && item.txHash.length > 0
    && typeof item.expectedEntityId === "string" && typeof item.network === "string"
    && typeof item.chainId === "number" && typeof item.contractAddress === "string"
    && typeof item.status === "string" && typeof item.updatedAt === "string";
}
