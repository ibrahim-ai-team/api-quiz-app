import { useEffect } from "react";
import { strings } from "../strings";

export function App() {
  useEffect(() => {
    document.title = strings.documentTitle;
  }, []);

  return (
    <main>
      <h1>{strings.appName}</h1>
      <p>{strings.appDescription}</p>
    </main>
  );
}
