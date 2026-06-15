import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // ---- ignores ----
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".server-dist/**",
      // Electron built output
      "dist-electron/**",
      // Vite config uses .mts; handled by base rules
    ],
  },

  // ---- base: all TypeScript files (non-type-aware recommended rules) ----
  ...tseslint.configs.recommended,

  // ---- global rules: all files ----
  {
    rules: {
      // code quality
      "no-console": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "prefer-const": "error",

      // unused code (TypeScript-aware; _ prefix = intentional)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // mirror Biome complexity/useLiteralKeys
      "dot-notation": "error",

      // TypeScript quality (non-type-aware)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],

      // turn off base rules that conflict with TS versions
      "no-unused-vars": "off",
    },
  },

  // ---- type-aware: extension + shared workflow code (root tsconfig) ----
  {
    files: [
      "src/**/*.ts",
      "workflow/**/*.ts",
      "workflow/**/*.tsx",
    ],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    },
  },

  // ---- type-aware: webview React app (Web tsconfig) ----
  {
    files: ["workflow/Web/**/*.ts", "workflow/Web/**/*.tsx"],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        project: "./workflow/Web/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      // mirror Biome correctness/useExhaustiveDependencies
      "react-hooks/exhaustive-deps": "warn",
      // mirror Biome correctness/useHookAtTopLevel
      "react-hooks/rules-of-hooks": "error",
    },
  },

  // ---- relax: Vite/Electron config files ----
  {
    files: [
      "workflow/Web/vite.config.mts",
      "scripts/**/*.mjs",
      "web/vite.config.mts",
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  // ---- relax: extension entry point (vscode API needs any in places) ----
  {
    files: ["src/extension.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // ---- relax: test files ----
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "no-console": "off",
    },
  },
);
