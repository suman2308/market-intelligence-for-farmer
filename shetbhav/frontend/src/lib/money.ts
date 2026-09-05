/** Quintal-priced totals — a lot/demand/offer's price is always ₹ per
 * quintal (100kg), while quantity is stored in kg. */
export function totalAmount(pricePerQuintal: number | null | undefined, quantityKg: number | null | undefined): number {
  return ((pricePerQuintal || 0) * (quantityKg || 0)) / 100;
}

export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
