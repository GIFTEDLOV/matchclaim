import { describe, expect, it } from "vitest";
import { PENDING_STORAGE_KEY, readPending, removePending, updatePendingStatus, writePending, type StorageLike } from "@/lib/pending";

function fakeStorage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

const record = { operation: "register_purchase" as const, txHash: "0xabc", expectedEntityId: "purchase-1", network: "testnetBradbury", chainId: 4221, contractAddress: "0x1111111111111111111111111111111111111111", status: "SUBMITTED" as const, updatedAt: "2026-08-20T00:00:00.000Z" };

describe("pending transaction persistence", () => {
  it("stores and recovers the exact same hash", () => {
    const storage = fakeStorage();
    writePending(record, storage);
    expect(storage.getItem(PENDING_STORAGE_KEY)).toContain("0xabc");
    expect(readPending(storage)).toEqual([record]);
    updatePendingStatus("0xabc", "CONFIRMING", storage);
    expect(readPending(storage)[0].status).toBe("CONFIRMING");
    removePending("0xabc", storage);
    expect(readPending(storage)).toEqual([]);
  });

  it("keeps one record per transaction and never creates a replacement hash", () => {
    const storage = fakeStorage();
    writePending(record, storage);
    writePending({ ...record, status: "TIMEOUT" }, storage);
    expect(readPending(storage)).toHaveLength(1);
    expect(readPending(storage)[0].txHash).toBe("0xabc");
  });
});
