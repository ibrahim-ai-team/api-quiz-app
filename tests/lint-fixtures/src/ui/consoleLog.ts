// NEGATIVE FIXTURE: console.log in src/ must fail lint.
export function noisy(value: string): void {
  console.log(value);
}
