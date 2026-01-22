import esbuild from "rollup-plugin-esbuild";
import { builtinModules } from "module";
import fs from "fs";

const { dependencies } = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url)));

export default {
    input: "src/index.js",
    output: [
        { file: "dist/index.js", format: "esm" },
        { file: "dist/index.cjs", format: "cjs", exports: "default" },
    ],
    plugins: [esbuild({ target: "node16" })],
    external: builtinModules.concat(Object.keys(dependencies))
};