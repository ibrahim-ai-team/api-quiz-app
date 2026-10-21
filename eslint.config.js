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
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use the injected seeded Rng from src/domain/rng.ts (standard 7).",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]",
          message: "Do not assign innerHTML/outerHTML (standard 5).",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment)$/]",
          message:
            "Do not parse HTML strings (insertAdjacentHTML/createContextualFragment, standard 5).",
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
    },
  },
  {
    files: [`${SRC}/domain/rng.ts`],
    rules: { "no-restricted-properties": "off" },
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
