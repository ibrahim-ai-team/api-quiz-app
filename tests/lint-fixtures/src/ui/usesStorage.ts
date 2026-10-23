// Negative lint fixture (T-40): only src/storage may use Web Storage.
// Expected: no-restricted-globals x2, no-restricted-properties x2.
export function readStorage(): unknown[] {
  return [
    localStorage.getItem("apiquiz:v1:best"),
    sessionStorage.getItem("x"),
    window.localStorage.getItem("apiquiz:v1:best"),
    globalThis.sessionStorage.getItem("x"),
  ];
}
