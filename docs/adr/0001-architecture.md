# ADR-0001: single-repo architecture

Status: Accepted by @IbrhimGhorafi via plan approval

ADR-0001: a static client-only single-page app (TypeScript, React, Vite) with the question bank validated at build time and shipped as a hashed same-origin JSON asset, browser-only storage and hash routing, deployed to GitHub Pages from main. Rejected a full-stack SSR app with API and database (breaks the no-backend MVP boundary, adds cost and operations, fails offline-after-load) and a static multi-page site (fails offline without a service worker). Accounts or a backend can be added later behind the ProgressStore and content-loader interfaces.
