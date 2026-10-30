// NEGATIVE FIXTURE (T-31, SEC-R01 L-3): dangerouslySetInnerHTML with children
// and javascript: URLs must fail lint.
export function DangerWithChildren({ html }: { html: string }) {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }}>child</div>
      <a href="javascript:void(0)">link</a>
    </>
  );
}
