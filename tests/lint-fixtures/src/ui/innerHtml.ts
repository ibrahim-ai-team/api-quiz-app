// NEGATIVE FIXTURE: raw HTML sinks must fail lint with no-restricted-syntax.
export function sinks(el: HTMLElement, html: string): void {
  el.innerHTML = html;
  el.outerHTML = html;
  el.insertAdjacentHTML("beforeend", html);
  document.createRange().createContextualFragment(html);
  document.write(html);
  document.writeln(html);
}
