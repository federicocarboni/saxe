// eslint.config.js is not working at the moment

/* eslint-env node */
"use strict";

/** @type {import("eslint").ESLint.ConfigData} */
const config = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "eslint-plugin-import",
    "eslint-plugin-jsdoc",
  ],
  root: true,
  rules: {
    // Prototype builtins are always used on hard coded objects inaccessible to
    // outside the library, so all accesses are valid.
    "no-prototype-builtins": "off",
    "no-proto": "error",
    "no-constant-condition": ["error", {checkLoops: false}],
    "eqeqeq": ["error", "always", {null: "ignore"}],
    "curly": ["error", "multi-line"],
    "no-throw-literal": "error",
    "no-with": "error",

    "import/no-cycle": "error",
    "import/no-self-import": "error",
    "import/no-default-export": "error",
    "import/extensions": ["error", {
      ts: "always",
    }],
  },
  ignorePatterns: ["lib", "coverage"],
  overrides: [{
    files: "**/*.ts",
    rules: {
    },
  }],
};

module.exports = config;
