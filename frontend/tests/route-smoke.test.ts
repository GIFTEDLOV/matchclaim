import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = [
  "app/page.tsx",
  "app/merchant/page.tsx",
  "app/merchant/policies/new/page.tsx",
  "app/merchant/purchases/new/page.tsx",
  "app/policies/[id]/page.tsx",
  "app/purchases/[id]/page.tsx",
  "app/claim/find/page.tsx",
  "app/claim/[purchaseId]/page.tsx",
  "app/assessments/[id]/page.tsx",
  "app/verify/page.tsx",
  "app/verify/[id]/page.tsx",
];

describe("route smoke", () => {
  it("has every required route and real navigation targets", () => {
    for (const route of routes) expect(existsSync(resolve(process.cwd(), route))).toBe(true);
    const landing = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    expect(landing).toContain("/merchant");
    expect(landing).toContain("/claim/find");
    expect(landing).toContain("/verify");
  });
});
