// NEGATIVE FIXTURE (T-31, SEC-R01 L-3): string-to-code sinks must fail lint.
export function codeSinks(s: string): void {
  eval(s);
  new Function(s);
  setTimeout("x()");
}
