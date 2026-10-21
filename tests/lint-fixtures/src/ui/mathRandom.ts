// NEGATIVE FIXTURE: Math.random outside src/domain/rng.ts must fail lint.
export function roll(): number {
  return Math.random();
}
