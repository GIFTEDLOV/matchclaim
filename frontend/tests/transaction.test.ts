import { describe, expect, it, vi } from "vitest";
import { CONTRACT_METHOD_MATRIX, readPurchase, writeAssessPriceMatch, writeCreatePolicy, writeRegisterPurchase } from "@/lib/client";
import { ExecutionResult } from "@/lib/client";
import { reconcileTransaction, TransactionFailure } from "@/lib/transaction";
import type { PendingTransaction } from "@/lib/pending";

const record: PendingTransaction = { operation: "assess_price_match", txHash: "0xabc", expectedEntityId: "assessment-1", network: "localnet", chainId: 61127, contractAddress: "0x1111111111111111111111111111111111111111", status: "SUBMITTED", updatedAt: "2026-08-20T00:00:00.000Z" };

describe("transaction safety", () => {
  it("documents exact argument mapping for all writes", () => {
    expect(CONTRACT_METHOD_MATRIX.create_policy.args).toEqual(["policy_id:string", "merchant_name:string", "policy_text:string", "approved_competitor_hosts:string[]", "eligible_new:bool", "eligible_refurbished:bool"]);
    expect(CONTRACT_METHOD_MATRIX.register_purchase.args[2]).toBe("buyer_address:string");
    expect(CONTRACT_METHOD_MATRIX.assess_price_match.args).toEqual(["purchase_id:string", "assessment_id:string", "competitor_url:string"]);
  });

  it("sends the frozen contract method names and argument order", async () => {
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";
    const calls: unknown[] = [];
    const fake = { writeContract: async (args: unknown) => { calls.push(args); return "0xabc"; } };
    await writeCreatePolicy(fake as never, ["p", "Merchant", "Rules", ["shop.example"], true, false]);
    await writeRegisterPurchase(fake as never, ["purchase", "p", "0x2222222222222222222222222222222222222222", "Phone", "Maker", "M1", "SKU", "NEW", 100n, "USD"]);
    await writeAssessPriceMatch(fake as never, ["purchase", "assessment", "https://shop.example/item"]);
    expect((calls[0] as { functionName: string; args: unknown[] }).functionName).toBe("create_policy");
    expect((calls[1] as { functionName: string; args: unknown[] }).args[2]).toBe("0x2222222222222222222222222222222222222222");
    expect((calls[2] as { functionName: string; args: unknown[] }).functionName).toBe("assess_price_match");
  });

  it("does not treat finalized failed execution as success", async () => {
    const verify = vi.fn(async () => true);
    const client = { getTransaction: async () => ({ statusName: "FINALIZED" }), waitForTransactionReceipt: async () => ({ txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR }) };
    await expect(reconcileTransaction({ client: client as never, record, verifyPostcondition: verify, intervalMs: 0, maxPolls: 1 })).rejects.toMatchObject({ code: "EXECUTION_FAILED" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not treat missing expected state as success", async () => {
    const client = { getTransaction: async () => ({ statusName: "FINALIZED" }), waitForTransactionReceipt: async () => ({ txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN }) };
    await expect(reconcileTransaction({ client: client as never, record, verifyPostcondition: async () => false, intervalMs: 0, maxPolls: 1 })).rejects.toMatchObject({ code: "MISSING_EXPECTED_STATE" });
  });

  it("keeps infrastructure failure separate from business verdict", () => {
    expect(new TransactionFailure("UNDETERMINED", "x").code).toBe("UNDETERMINED");
  });

  it.each([
    ["UNDETERMINED", "UNDETERMINED"],
    ["VALIDATORS_TIMEOUT", "TIMEOUT"],
    ["LEADER_TIMEOUT", "TIMEOUT"],
    ["CANCELED", "CANCELED"],
  ] as const)("maps %s using its actual SDK status", async (statusName, expectedCode) => {
    const client = { getTransaction: async () => ({ statusName }) };
    await expect(reconcileTransaction({ client: client as never, record, verifyPostcondition: async () => true, intervalMs: 0, maxPolls: 1 }))
      .rejects.toMatchObject({ code: expectedCode });
  });

  it.each(["DISAGREE", "MAJORITY_DISAGREE", "NO_MAJORITY"] as const)("maps explicit SDK result %s to DISAGREE", async (resultName) => {
    const client = { getTransaction: async () => ({ statusName: "FINALIZED", resultName }) };
    await expect(reconcileTransaction({ client: client as never, record, verifyPostcondition: async () => true, intervalMs: 0, maxPolls: 1 }))
      .rejects.toMatchObject({ code: "DISAGREE" });
  });

  it("normalizes the SDK's number/string-safe read boundary to bigint money", async () => {
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";
    const fake = { readContract: async () => ({ paid_price_minor: "9007199254740992", purchase_id: "p" }) };
    const purchase = await readPurchase(fake as never, "p");
    expect(purchase.paid_price_minor).toBe(9007199254740992n);
  });
});
