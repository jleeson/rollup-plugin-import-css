/* imports */
import { terser } from "rollup-plugin-terser";
import { dependencies } from "./package.json";
import { builtinModules } from "module";

/* build config */
export default {
    input: "src/index.js",
    output: [
        { file: "dist/plugin.esm.js", format: "esm" },
        { file: "dist/plugin.cjs.js", format: "cjs", exports: "default" },
    ],
    plugins: [
        terser({
            output: {
                preamble: "/* Copyright (c) 2020 Outwalk Studios */"
            }
        })
    ],
    external: builtinModules.concat(Object.keys(dependencies))
}