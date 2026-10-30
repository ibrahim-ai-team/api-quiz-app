// NEGATIVE FIXTURE (T-31, SEC-R01 L-2): computed and newer raw HTML sinks must
// fail lint with no-restricted-syntax.
export function moreSinks(
  el: HTMLElement,
  frame: HTMLIFrameElement,
  html: string,
): void {
  el["innerHTML"] = html;
  el["outerHTML"] = html;
  frame["srcdoc"] = html;
  frame.srcdoc = html;
  frame.setAttribute("srcdoc", html);
  frame.setAttribute("SrcDoc", html);
  el.setHTMLUnsafe(html);
  Document.parseHTMLUnsafe(html);
  new DOMParser().parseFromString(html, "text/html");
}
