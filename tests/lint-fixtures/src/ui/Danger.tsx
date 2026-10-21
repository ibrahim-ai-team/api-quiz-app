// NEGATIVE FIXTURE: must fail lint with react/no-danger and, for srcDoc,
// no-restricted-syntax.
export function Danger({ html }: { html: string }) {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <iframe title="raw" srcDoc={html} />
    </>
  );
}
