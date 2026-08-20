import { describe, expect, it } from "vitest";
import { parseHostnames, validateHttpsCompetitorUrl } from "@/lib/validation";

describe("frontend admissibility UX", () => {
  it("canonicalizes and validates exact hostnames", () => {
    expect(parseHostnames(" Retailer.Example.\nshop.example ")).toEqual({ hosts: ["retailer.example", "shop.example"] });
    expect(parseHostnames("localhost").error).toBeTruthy();
    expect(parseHostnames("127.0.0.1").error).toBeTruthy();
    expect(parseHostnames("retailer.example\nretailer.example").error).toContain("unique");
  });

  it("matches HTTPS URLs against exact approved hosts", () => {
    const hosts = ["retailer.example"];
    expect(validateHttpsCompetitorUrl("https://retailer.example/item", hosts)).toBeNull();
    expect(validateHttpsCompetitorUrl("http://retailer.example/item", hosts)).toContain("HTTPS");
    expect(validateHttpsCompetitorUrl("https://shop.retailer.example/item", hosts)).toContain("not approved");
    expect(validateHttpsCompetitorUrl("https://retailer.example/item#price", hosts)).toContain("fragments");
    expect(validateHttpsCompetitorUrl("https://user:pass@retailer.example/item", hosts)).toContain("userinfo");
  });
});
