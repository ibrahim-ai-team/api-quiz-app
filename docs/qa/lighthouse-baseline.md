# Lighthouse CI baseline: ApiQuiz (SC-5, NFR-1-2)

- **Delegation:** T-18-D01 (performance-engineer), task T-18, issue #38. Date: 2026-10-22.
- **Status:** local runs only. **CI not yet observed.** The CI job `Lighthouse (mobile, median of 3)` is added in `.github/workflows/ci.yml`; no GitHub Actions run of it exists yet.
- **Audit decision (resolved):** `@lhci/cli` is not a devDependency. The sponsor chose option B (section 5): the tool runs only in the Lighthouse job through `npx --yes @lhci/cli@0.15.1`, so the `npm audit` gate stays strict.

## 1. Thresholds (declared before measuring)

Source: `docs/planning/04-tech-lead-review.md` adjustments 2 and 5, T-18 row; `docs/qa/test-strategy.md` sections 5 and 6.

| Assertion (median of 3 runs) | Threshold | Level |
| --- | --- | --- |
| `categories:performance` | min 0.90 | error |
| `categories:accessibility` | min 0.95 | error |

Best Practices, SEO, LCP, TBT, CLS and JS transfer size are recorded below but not asserted.

## 2. Setup and commands

| Item | Value |
| --- | --- |
| Commit | `c337385` (branch `perf/T-18-lighthouse-ci`, from `main`) plus the uncommitted T-18 changes |
| Tool | `@lhci/cli` 0.15.1 (Lighthouse 12.6.1) |
| Browser | Chromium 141.0.7390.37 (Playwright build at `/opt/pw-browsers/chromium`), headless |
| Node / Vite | Node 22.22.0, Vite 8.3.4 |
| Machine | Linux container, 4 vCPU Intel Xeon, 15 GB RAM. Lighthouse `benchmarkIndex` 2708 to 3177 |
| Target | `vite preview` at `http://localhost:4173/api-quiz-app/` (started by LHCI through `startServerCommand`) |
| Preset | Lighthouse default mobile: `formFactor: mobile`, simulated throttling (RTT 150 ms, 1.6 Mbps, CPU 4x slowdown) |
| Chrome flags | `--no-sandbox --disable-dev-shm-usage` |
| Runs | 3 per session, median asserted (`aggregationMethod: median`) |
| Upload | `filesystem` to `.lighthouseci/` (gitignored); no third-party upload |

Commands:

```sh
npm ci
npm run build
CHROME_PATH=/opt/pw-browsers/chromium npm run lighthouse   # = lhci autorun
```

In CI, `CHROME_PATH` is not set: `ubuntu-latest` ships Google Chrome, and chrome-launcher finds it.

Only the landing URL is collected. The `#/topic/http-fundamentals` deep link loads the same document and the same requests and renders the same Landing view with one topic preselected, so it would not add a separate measurement.

## 3. Results

Both sessions ran on 2026-10-22 against the same build. Session 1 used `chromeFlags` with an explicit `--headless=new`. Session 2 used the final committed config, without that flag, because Lighthouse already adds headless mode.

### Session 1

| Run | Performance | Accessibility | Best Practices | SEO | LCP (ms) | TBT (ms) | CLS | JS transfer (bytes) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.93 | 1.00 | 1.00 | 1.00 | 1590 | 5 | 0.161 | 78,410 |
| 2 | 1.00 | 1.00 | 1.00 | 1.00 | 1524 | 0 | 0 | 78,410 |
| 3 | 1.00 | 1.00 | 1.00 | 1.00 | 1513 | 0 | 0 | 78,410 |
| **Median** | **1.00** | **1.00** | **1.00** | **1.00** | **1524** | **0** | **0** | **78,410** |

### Session 2 (final config)

| Run | Performance | Accessibility | Best Practices | SEO | LCP (ms) | TBT (ms) | CLS | JS transfer (bytes) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.93 | 1.00 | 1.00 | 1.00 | 1535 | 0 | 0.161 | 78,410 |
| 2 | 1.00 | 1.00 | 1.00 | 1.00 | 1517 | 0 | 0 | 78,410 |
| 3 | 0.93 | 1.00 | 1.00 | 1.00 | 1515 | 0 | 0.161 | 78,410 |
| **Median** | **0.93** | **1.00** | **1.00** | **1.00** | **1517** | **0** | **0.161** | **78,410** |

Results: both assertions **PASS** in both sessions (`assertion-results.json` is empty, and `lhci autorun` exits 0). The JS transfer of 78,410 bytes is one script (`index-*.js`, 251.66 kB raw, 78.80 kB gzip from Vite). Total page weight is 89,594 bytes. FCP is about 1.36 to 1.38 s.

Negative check: re-asserting the session 2 results with `minScore: 0.95` for performance (scratch config) fails with `found: 0.93, all values: 0.93, 1, 0.93` and exit 1. This confirms the median gate rejects a result below the threshold.

## 4. Threshold at risk: Performance (intermittent CLS)

Performance scored 0.93 in 3 of 6 runs, and the session 2 median was 0.93, only 0.03 above the gate. Every 0.93 run has exactly one layout shift of 0.161. The 1.00 runs have none. LCP and TBT are stable, so CLS is the only cause.

- **Shifted element:** `main#main > p` ("Every question is written for ApiQuiz and checked against a primary source...", the About-the-questions text).
- **Likely cause (from code reading; confirmed by the shifted element):** in `src/ui/views/Landing/Landing.tsx`, the topic area renders `<BankStatus>` while `bank.status !== "ready"`. It is replaced by the taller topic `<fieldset>` when the bank JSON arrives, which pushes the About section down. When the bank fetch resolves before first paint, there is no shift. When it resolves after first paint, there is a shift. That race makes the result bimodal.
- **Risk in CI:** CI runner timing differs from this machine. If the late-bank path happens in 2 of 3 runs, the median is 0.93. Any extra regression of about 0.03 (for example LCP growth) would then fail the gate.

Proposed fixes for the app owner (frontend-developer; not made here, since T-18 allows no app changes):

1. Reserve the topic area's space while loading, for example a `min-height` on the loading container or a skeleton with the same height as the topic list. This removes the shift whatever the timing, and is the preferred fix.
2. Or start the bank download earlier with `<link rel="preload" as="fetch" crossorigin href="...bank-*.json">`, injected at build time (CSP `connect-src 'self'` allows it). This narrows the race but does not remove it.
3. Minor: Lighthouse reports the single CSS file as render-blocking (estimated 150 ms) and about 40 KiB of unused JS. Neither is needed to pass. Revisit only if LCP grows.

Acceptance check for the fix: CLS 0 in all 3 runs in two consecutive `npm run lighthouse` sessions, and the median Performance at least 0.98 locally.

## 5. Dependency audit blocker

`npm audit --audit-level=high` passes on `main` (0 vulnerabilities; checked by auditing the HEAD lockfile). With `@lhci/cli@0.15.1` it reports **17 vulnerabilities (2 low, 4 moderate, 11 high)**. All of them are transitive and dev-only:

| Package (version in tree) | Severity | Path | Fix available |
| --- | --- | --- | --- |
| `extract-zip` 2.0.1 | high (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3) | lighthouse > puppeteer-core > @puppeteer/browsers | **none** (advisory range `*`; 2.0.1 is latest) |
| `basic-ftp` 5.3.1 | high (GHSA-c475-qrg2-pj4r) | proxy-agent > pac-proxy-agent > get-uri | 6.2.3 exists, outside get-uri's range |
| `tmp` 0.0.33 / 0.1.0 | high (GHSA-52f5-9888-hmc6, GHSA-ph9p-34f9-6g65) | inquirer > external-editor; @lhci/cli | 0.2.7 |
| `uuid`, `sprintf-js`, `js-yaml` (via argparse) | moderate | @lhci/cli, @lhci/utils | partly |

`@lhci/cli` 0.15.1 is the latest release (published 2025-06-25), so no newer version fixes this. Because `extract-zip` has no patched release, even `overrides` cannot make the high-level audit pass. A decision is needed (see the T-18-D01 report). Options:

- A. Accept the dev-only risk explicitly and change how the audit runs (for example `--omit=dev`). This weakens an existing gate and needs a security and sponsor decision.
- B. Keep `@lhci/cli` out of the lockfile and run it only in the Lighthouse job with `npx --yes @lhci/cli@0.15.1 autorun`. This keeps the audit job green but bypasses the audit and dependency review for that tool. It would also need the AC that requires a devDependency to change.
- C. Use `overrides` for the fixable packages and still need A or B for `extract-zip`.

**Decision (2026-10-22, sponsor): option B.** `package.json` has only the `lighthouse` script (`npx --yes @lhci/cli@0.15.1 autorun`), and the lockfile is unchanged. Accepted risk: an unaudited, version-pinned tool runs in the Lighthouse CI job with `contents: read` and no secrets. AC 1 of #38 (devDependency) is amended accordingly. Hardening after SEC-R11: install scripts are disabled for the Lighthouse step, `--before=2026-10-08` freezes transitive resolution (bump it together with the LHCI version), and the job uses no npm cache. Residual risk accepted: a malicious runtime dependency could still run inside this read-only job with no secrets.

## 6. Limitations

- Local container, not a GitHub runner. The scores use simulated throttling, but CPU speed (`benchmarkIndex`) and timing races still affect them. **CI numbers will differ**, and the CI artifact `lighthouse-report` is the reference once it exists.
- Chromium 141 (Playwright build) here; CI uses the runner's Google Chrome (version not observed).
- Six runs in total cannot tell how often the CLS race happens in CI.
- NFR-1 "submit to visible feedback at most 100 ms" (test strategy section 5, flag F-9) was not measured in this delegation.
