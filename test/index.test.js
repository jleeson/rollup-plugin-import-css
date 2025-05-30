import css from "../dist/plugin.js";
import { rollup } from "rollup";
import { builtinModules } from "module";
import assert from "assert";
import path from "path";
import fs from "fs";

const { dependencies } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url)));

(async () => {
    const bundle = await rollup({
        input: "test/src/index.js",
        plugins: [css({ minify: true, output: "index.css" })],
        external: builtinModules.concat(Object.keys(dependencies))
    });

    await bundle.write({
        file: "test/dist/index.js",
        format: "esm",
        preserveModulesRoot: "test/src"
    });

    const source = fs.readFileSync(path.resolve("test/dist/index.js"), "utf8");
    const style = fs.readFileSync(path.resolve("test/dist/index.css"), "utf8");

    assert.strictEqual(source.includes(`import "./index.css"`), false, "the css import should be removed.");
    assert.strictEqual(style.includes(`.element{box-shadow:0px 16px 32px -10px rgba(17,24,38,0.1);}`), true, "negative values should be minified correctly.");
    assert.strictEqual(style.includes(`.test{top:calc(var(--variable-name));top: calc(var(--variable-name) + 10px);top: calc((10px + var(--variable-name)) * 2);}`), true, "nested parentheses should be minfied correctly.");
    assert.strictEqual(style.includes(`:is(.a-very-long-class-name,.b-very-long-class-name,.c-very-long-class-name) textarea{margin:0;}`), true, "new lines should be minified correctly.");
    assert.strictEqual(style.includes(`html[style*="--color-scheme: dark"]{color:blue;}`), true, "spaces should be preserved in css selectors.");

    fs.rmSync(path.resolve("test/dist/index.js"));
    fs.rmSync(path.resolve("test/dist/index.css"));
    fs.rmdirSync(path.resolve("test/dist"));
})();