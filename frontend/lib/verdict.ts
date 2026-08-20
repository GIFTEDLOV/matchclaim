import type { Verdict } from "./types";

export interface VerdictPresentation {
  label: string;
  description: string;
  tone: "positive" | "neutral" | "caution";
  showsAuthorization: boolean;
}

export function presentVerdict(verdict: Verdict): VerdictPresentation {
  if (verdict === "MATCH_ELIGIBLE") {
    return {
      label: "Price match approved",
      description: "The contract authorized a permanent price-match credit.",
      tone: "positive",
      showsAuthorization: true,
    };
  }
  if (verdict === "NOT_ELIGIBLE") {
    return {
      label: "Price match not eligible",
      description: "The contract found an affirmative policy disqualifier.",
      tone: "neutral",
      showsAuthorization: false,
    };
  }
  return {
    label: "Eligibility could not be determined",
    description: "Available competitor evidence was not reliable enough to decide the match.",
    tone: "caution",
    showsAuthorization: false,
  };
}
