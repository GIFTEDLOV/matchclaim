import { describe, expect, it } from "vitest";
import { presentVerdict } from "@/lib/verdict";

describe("business verdict presentation", () => {
  it("does not map inconclusive to denial", () => {
    const result = presentVerdict("INCONCLUSIVE");
    expect(result.label).toContain("could not be determined");
    expect(result.label).not.toContain("not eligible");
    expect(result.showsAuthorization).toBe(false);
  });

  it("only presents an authorization for eligible results", () => {
    expect(presentVerdict("MATCH_ELIGIBLE").showsAuthorization).toBe(true);
    expect(presentVerdict("NOT_ELIGIBLE").showsAuthorization).toBe(false);
  });
});
