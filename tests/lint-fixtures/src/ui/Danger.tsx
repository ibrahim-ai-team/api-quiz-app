// NEGATIVE FIXTURE: must fail lint with react/no-danger.
export function Danger({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
