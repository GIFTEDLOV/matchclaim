import { describe, expect, it } from "vitest";
import { formatMinorUnits, parseMinorUnits } from "@/lib/money";

describe("minor-unit money conversion", () => {
  it("parses decimal strings exactly", () => {
    expect(parseMinorUnits("799.99")).toBe(79999);
    expect(parseMinorUnits("8")).toBe(800);
    expect(parseMinorUnits("0.05")).toBe(5);
  });

  it("rejects floating-point-shaped precision and non-positive values", () => {
    expect(() => parseMinorUnits("799.999")).toThrow();
    expect(() => parseMinorUnits("0")).toThrow();
    expect(() => parseMinorUnits("-1")).toThrow();
  });

  it("does not use floating-point parsing or arithmetic for conversion", async () => {
    const source = await import("@/lib/money").then(() => parseMinorUnits.toString());
    expect(source).not.toContain("parseFloat");
    expect(source).not.toContain("minor /");
    expect(formatMinorUnits(79999, "USD")).toBe("USD 799.99");
  });
});
