export const MINOR_UNIT_SCALE = 2;

export function parseMinorUnits(value: string, decimals = MINOR_UNIT_SCALE): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a positive amount with up to two decimal places");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const padded = fraction.padEnd(decimals, "0");
  const minorText = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  const minorBig = BigInt(minorText || "0");
  if (minorBig <= 0n || minorBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount must be a positive safe integer in minor units");
  }
  return Number(minorBig);
}

export function formatMinorUnits(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor) || minor < 0) return "—";
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${currency} ${whole.toString()}.${fraction}`;
}
