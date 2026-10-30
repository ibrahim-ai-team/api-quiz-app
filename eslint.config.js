import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Source roots. `tests/lint-fixtures/src` mirrors `src` so that negative lint
 * fixtures are linted with exactly the same rules as real source code
 * (see `npm run lint:fixtures`). The fixtures are ignored by `npm run lint`.
 */
const SRC = "{src,tests/lint-fixtures/src}";

/**
 * Imports banned in all application source (T-05-R01 M3, standard 3). Zod and
 * the `scripts/` build tools are build-time only; `src/content/types.ts` holds
 * plain-TS types and a runtime guard instead. Flat config replaces (not
 * merges) rule options, so the domain block below repeats these.
 */
const SRC_RESTRICTED_PATHS = [
  {
    name: "zod",
    message:
      "Zod is build/CI-time only; use the plain-TS guards in src/content/types.ts.",
  },
];
const SRC_RESTRICTED_PATTERNS = [
  {
    group: ["zod/*"],
    message:
      "Zod is build/CI-time only; use the plain-TS guards in src/content/types.ts.",
  },
  {
    group: ["**/scripts", "**/scripts/**"],
    message:
      "src/ must not import build tooling from scripts/ (use src/content/types.ts).",
  },
];

/**
 * Web Storage is reserved for src/storage (ADR-0001: the only localStorage
 * user; T-40). Globals and the common `window.`/`globalThis.`/`self.` member
 * forms are both banned; src/storage re-declares these lists minus
 * localStorage, because flat config replaces rule options.
 */
const STORAGE_GLOBALS = ["localStorage", "sessionStorage"];
const storageMessage = (name) =>
  `Only src/storage may use Web Storage; use the ProgressStore from src/storage instead of ${name}.`;
const restrictedStorageGlobals = (names) =>
  names.map((name) => ({ name, message: storageMessage(name) }));
const restrictedStorageProperties = (names) =>
  ["window", "globalThis", "self"].flatMap((object) =>
    names.map((property) => ({
      object,
      property,
      message: storageMessage(property),
    })),
  );
const MATH_RANDOM_RESTRICTION = {
  object: "Math",
  property: "random",
  message: "Use the injected seeded Rng from src/domain/rng.ts (standard 7).",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "src/content/generated/**",
      "playwright-report/**",
      "test-results/**",
      // Negative fixtures: expected to FAIL lint; checked by `npm run lint:fixtures`.
      "tests/lint-fixtures/src/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: [
          "./tsconfig.app.json",
          "./tsconfig.node.json",
          "./tsconfig.test.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },

  // Plain JS/MJS tooling files are not part of a TS project.
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },

  // React, hooks and accessibility rules for UI code.
  {
    files: ["**/*.{ts,tsx}"],
    ...react.configs.flat.recommended,
    ...react.configs.flat["jsx-runtime"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      // V-1 / T1: no raw HTML injection from data.
      "react/no-danger": "error",
      "react/no-danger-with-children": "error",
      // SEC-R01 L-3: no `javascript:` URLs in links.
      "react/jsx-no-script-url": "error",
    },
  },

  // Application source rules (standards 5, 7, 10).
  {
    files: [`${SRC}/**/*.{ts,tsx}`],
    rules: {
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "off",
      "@typescript-eslint/no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-globals": [
        "error",
        ...restrictedStorageGlobals(STORAGE_GLOBALS),
      ],
      "no-restricted-properties": [
        "error",
        MATH_RANDOM_RESTRICTION,
        ...restrictedStorageProperties(STORAGE_GLOBALS),
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML|srcdoc)$/]",
          message: "Do not assign innerHTML/outerHTML/srcdoc (standard 5).",
        },
        // SEC-R01 L-2: computed forms such as el["innerHTML"] = html.
        {
          selector:
            "AssignmentExpression > MemberExpression.left[computed=true][property.value=/^(innerHTML|outerHTML|srcdoc)$/]",
          message: "Do not assign innerHTML/outerHTML/srcdoc (standard 5).",
        },
        {
          selector:
            "CallExpression[callee.property.name='setAttribute'][arguments.0.value=/^srcdoc$/i]",
          message:
            'Do not set the srcdoc attribute via setAttribute("srcdoc") (standard 5).',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment)$/]",
          message:
            "Do not parse HTML strings (insertAdjacentHTML/createContextualFragment, standard 5).",
        },
        // SEC-R01 L-2: Element/ShadowRoot.setHTMLUnsafe, Document.parseHTMLUnsafe
        // (static) and DOMParser.parseFromString.
        {
          selector:
            "CallExpression[callee.property.name=/^(setHTMLUnsafe|parseHTMLUnsafe|parseFromString)$/]",
          message:
            "Do not parse HTML strings (setHTMLUnsafe/parseHTMLUnsafe/parseFromString, standard 5).",
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
          message: "Do not use document.write/writeln (standard 5).",
        },
        {
          selector: "JSXAttribute[name.name=/^srcdoc$/i]",
          message: "Do not render raw HTML via srcDoc (standard 5).",
        },
      ],
      "no-restricted-imports": [
        "error",
        { paths: SRC_RESTRICTED_PATHS, patterns: SRC_RESTRICTED_PATTERNS },
      ],
    },
  },
  {
    files: [`${SRC}/domain/rng.ts`],
    rules: { "no-restricted-properties": "off" },
  },
  // src/storage is the only localStorage user (ADR-0001, T-40). It keeps the
  // sessionStorage and Math.random bans.
  {
    files: [`${SRC}/storage/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-globals": [
        "error",
        ...restrictedStorageGlobals(["sessionStorage"]),
      ],
      "no-restricted-properties": [
        "error",
        MATH_RANDOM_RESTRICTION,
        ...restrictedStorageProperties(["sessionStorage"]),
      ],
    },
  },

  // Module boundaries (standard 2): domain is pure TypeScript.
  {
    files: [`${SRC}/domain/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-globals": [
        "error",
        ...[
          "window",
          "document",
          "localStorage",
          "sessionStorage",
          "navigator",
          "fetch",
        ].map((name) => ({
          name,
          message: `src/domain is pure TypeScript: do not use ${name} (standard 1).`,
        })),
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...SRC_RESTRICTED_PATHS,
            {
              name: "react",
              message: "src/domain must not depend on React.",
            },
            {
              name: "react-dom",
              message: "src/domain must not depend on React DOM.",
            },
          ],
          patterns: [
            ...SRC_RESTRICTED_PATTERNS,
            {
              group: ["react/*", "react-dom/*"],
              message: "src/domain must not depend on React.",
            },
            {
              group: ["**/ui", "**/ui/**", "**/storage", "**/storage/**"],
              message: "src/domain must not import from src/ui or src/storage.",
            },
          ],
        },
      ],
    },
  },
);
