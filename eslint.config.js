import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import vitestPlugin from "@vitest/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactTestingLibraryPlugin from "eslint-plugin-testing-library";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";

// noinspection JSUnusedGlobalSymbols
export default [
  jsxA11yPlugin.flatConfigs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsEslintPlugin,
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      vitest: vitestPlugin,
      "testing-library": reactTestingLibraryPlugin,
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      globals: { ...globals.browser },
      parser: tsParser,
      parserOptions: { project: "tsconfig.json" },
      sourceType: "module",
    },
    settings: {
      react: { version: "detect" },
      "import/extensions": [".ts", ".tsx"],
      "import/resolver": { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      // eslint rules
      "arrow-body-style": ["error", "as-needed"],
      "arrow-parens": ["off", "as-needed"],
      curly: "warn",
      eqeqeq: ["warn", "smart"],
      "no-cond-assign": "warn",
      "no-console": ["warn", { allow: ["error"] }],
      "no-debugger": "warn",
      "no-else-return": "error",
      "no-empty-pattern": "error",
      "no-restricted-exports": [
        "error",
        {
          restrictDefaultExports: {
            defaultFrom: true,
            direct: true,
            named: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "FunctionDeclaration",
          message: "Use const with an arrow function instead of function declarations.",
        },
        {
          selector: "ImportDeclaration[source.value=react] ImportDefaultSpecifier[local.name=React]",
          message: "React should not be imported as automatic JSX imports are enabled.",
        },
        {
          selector: 'ImportDeclaration:not([importKind="type"])[source.value=vitest]',
          message: "Utilities from Vitest are available as globals and should not be imported.",
        },
        {
          selector: 'ImportDeclaration:not([importKind="type"])[source.value=@mui/material]',
          message: "Importing from @mui/material loads all components. Use narrower imports such as @mui/material/Button.",
        },
      ],
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": ["warn", { allowNamedFunctions: true }],
      "prefer-const": "warn",
      "prefer-template": "warn",
      quotes: ["error", "double", { avoidEscape: true }],
      "require-await": "off",
      "spaced-comment": ["error", "always", { markers: ["/"] }],
      "template-curly-spacing": ["error", "never"],
      // @typescript-eslint rules
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/consistent-type-assertions": ["warn", { assertionStyle: "as" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/require-await": "error",
      // import rules
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import/export": "warn",
      "import/no-duplicates": ["warn", { "prefer-inline": false }],
      "import/order": [
        "warn",
        {
          groups: ["type", "builtin", "external", "parent", "sibling", "index"],
          named: true,
          alphabetize: { order: "asc", orderImportKind: "asc" },
        },
      ],
      // react rules
      "react/jsx-curly-brace-presence": ["error", "never"],
      "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
      "react/forbid-elements": [
        "error",
        {
          forbid: [
            { element: "hr", message: "Use MUI <Divider> from @mui/material/Divider instead." },
            { element: "span", message: "Use <Box component=\"span\"> from @mui/material/Box instead." },
            { element: "div", message: "Use <Box> or <Stack> from @mui/material instead." },
            { element: "p", message: "Use <Typography> from @mui/material/Typography instead." },
            { element: "button", message: "Use MUI <Button> or <IconButton> from @mui/material instead." },
            { element: "img", message: "Use <Box component=\"img\"> from @mui/material/Box instead." },
            { element: "h1", message: "Use <Typography variant=\"h1\"> from @mui/material/Typography instead." },
            { element: "h2", message: "Use <Typography variant=\"h2\"> from @mui/material/Typography instead." },
            { element: "h3", message: "Use <Typography variant=\"h3\"> from @mui/material/Typography instead." },
            { element: "h4", message: "Use <Typography variant=\"h4\"> from @mui/material/Typography instead." },
            { element: "h5", message: "Use <Typography variant=\"h5\"> from @mui/material/Typography instead." },
            { element: "h6", message: "Use <Typography variant=\"h6\"> from @mui/material/Typography instead." },
          ],
        },
      ],
      "react/self-closing-comp": "error",
      // react-hooks rules
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      // vitest rules
      "vitest/consistent-test-it": ["error", { fn: "it" }],
      "vitest/no-commented-out-tests": "error",
      "vitest/no-identical-title": "error",
      "vitest/no-import-node-test": "error",
      "vitest/padding-around-all": "error",
      "vitest/prefer-hooks-in-order": "error",
      "vitest/prefer-hooks-on-top": "error",
      "vitest/valid-describe-callback": "error",
      "vitest/valid-expect": "error",
      "vitest/valid-title": "error",
      // react testing library rules
      "testing-library/no-debugging-utils": "error",
      "testing-library/no-dom-import": "error",
      "testing-library/no-manual-cleanup": "error",
      "testing-library/prefer-find-by": "error",
      "testing-library/prefer-presence-queries": "error",
      // jsx-a11y overrides
      "jsx-a11y/no-autofocus": "off",
    },
  },
  {
    files: ["**/*.tests.{ts,tsx}", "src/__tests__/setup.ts"],
    rules: { "no-console": "off" },
  },
  {
    // This stub must use export default to match the html2canvas package API
    // so Vite's alias can substitute it transparently for jsPDF's dynamic import.
    files: ["src/utils/html2canvas-stub.ts"],
    rules: { "no-restricted-exports": "off" },
  },
];
