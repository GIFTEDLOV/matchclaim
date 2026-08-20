import { describe, expect, it } from "vitest";
import { createReadClient } from "@/lib/client";
import { getConfig } from "@/lib/config";

describe("configuration", () => {
  it("fails closed without a public contract address", () => {
    const previous = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    delete process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    expect(getConfig().configured).toBe(false);
    expect(() => createReadClient()).toThrow("not configured");
    if (previous) process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = previous;
  });
});
