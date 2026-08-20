export const MINOR_UNIT_SCALE = 2;
export const MAX_PRICE_MINOR = 10n ** 18n;

export function parseMinorUnits(value: string, decimals = MINOR_UNIT_SCALE): bigint {
  const normalized = value.trim();
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(normalized)) {
    throw new Error("Enter a positive amount with up to two decimal places");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const padded = fraction.padEnd(decimals, "0");
  const minorText = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  const minorBig = BigInt(minorText || "0");
  if (minorBig <= 0n || minorBig > MAX_PRICE_MINOR) {
    throw new Error("Amount must be positive and within the contract price bound");
  }
  return minorBig;
}

export function formatMinorUnits(minor: bigint, currency: string): string {
  if (minor < 0n) return "—";
  const value = minor;
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${currency} ${whole.toString()}.${fraction}`;
}
