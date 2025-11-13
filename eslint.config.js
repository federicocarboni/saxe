import {defineConfig, globalIgnores} from "eslint/config";

import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import _import from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";

import {FlatCompat} from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: compat.extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:import/recommended",
    ),

    languageOptions: {
      parser: tsParser,
    },

    plugins: {
      "@typescript-eslint": typescriptEslint,
      "import": _import,
      jsdoc,
    },

    rules: {
      "no-prototype-builtins": "off",
      "no-proto": "error",

      "no-constant-condition": ["error", {
        checkLoops: false,
      }],

      "eqeqeq": ["error", "always", {
        null: "ignore",
      }],

      "curly": ["error", "multi-line"],
      "no-throw-literal": "error",
      "no-with": "error",
      "import/no-cycle": "error",
      "import/no-self-import": "error",
      "import/no-default-export": "error",

      "import/extensions": ["error", {
        ts: "always",
      }],

      "@typescript-eslint/no-empty-object-type": ["error", {
        allowInterfaces: "with-single-extends",
      }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        args: "all",
        argsIgnorePattern: "^_",
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    files: ["test/**/*ts"],
    rules: {
      // chai expressions are not unused
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  globalIgnores([
    "eslint.config.js",
    "lib",
    "coverage",
    "docs",
    "fuzz/target.js",
  ]),
]);
