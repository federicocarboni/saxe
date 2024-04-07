// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-proto": "error",
      // Prototype builtins can be used correctly.
      "no-prototype-builtins": "off",
      "no-constant-condition": ["error", {checkLoops: false}],
      "eqeqeq": [
        "error",
        "always",
        {
          null: "ignore",
        },
      ],
    },
  },
);
