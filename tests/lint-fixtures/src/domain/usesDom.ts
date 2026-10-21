// NEGATIVE FIXTURE: linted as src/domain code; browser globals must fail
// no-restricted-globals.
export async function impure(): Promise<unknown> {
  const title = document.title;
  const width = window.innerWidth;
  const saved = localStorage.getItem("k");
  const session = sessionStorage.getItem("k");
  const lang = navigator.language;
  const response = await fetch("/x");
  return { title, width, saved, session, lang, response };
}
