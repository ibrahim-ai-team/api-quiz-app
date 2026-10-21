import { useEffect, useState } from "react";
import type { LoadBankResult } from "../../content/loader";
import { strings } from "../strings";

export interface AppProps {
  /** Started at module top level in main.tsx; resolves, never rejects. */
  bankPromise: Promise<LoadBankResult>;
}

type BankStatus = "loading" | "ready" | "error";

export function App({ bankPromise }: AppProps) {
  const [bank, setBank] = useState<{
    status: BankStatus;
    contentVersion?: string;
  }>({ status: "loading" });

  useEffect(() => {
    document.title = strings.documentTitle;
  }, []);

  useEffect(() => {
    let active = true;
    void bankPromise.then((result) => {
      if (!active) return;
      setBank(
        result.ok
          ? { status: "ready", contentVersion: result.bank.contentVersion }
          : { status: "error" },
      );
    });
    return () => {
      active = false;
    };
  }, [bankPromise]);

  // Data attributes are a non-visual readiness signal for E2E only; the
  // loading, error and Retry views are built in T-08.
  return (
    <main
      data-bank-status={bank.status}
      data-content-version={bank.contentVersion}
    >
      <h1>{strings.appName}</h1>
      <p>{strings.appDescription}</p>
    </main>
  );
}
