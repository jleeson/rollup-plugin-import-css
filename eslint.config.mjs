import globals from "globals";
import js from "@eslint/js";

export default {
    files: ["src/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
        ...js.configs.recommended.rules,
        "indent": ["error", 4, { "SwitchCase": 1 }],
        "linebreak-style": ["error", "unix"],
        "quotes": ["error", "double", { "allowTemplateLiterals": true }],
        "semi": ["error", "always"]
    }
};