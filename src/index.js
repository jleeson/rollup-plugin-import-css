/* imports */
import { createFilter } from "@rollup/pluginutils";
import fs from "fs";
import path from "path";

export default (options = {}) => {

    if (!options.transform) options.transform = code => code;
    
    const alwaysOutput = options.alwaysOutput || false;

    const styles = [];
    const include = ["**/*.css"].concat(options.include || []);
    const filter = createFilter(include, options.exclude || []);

    return {
        name: "import-css",

        /* load the css file */
        load(id) {
            if (!filter(id)) return;
            return fs.readFileSync(id, "utf8");
        },

        /* convert the css file to a module and save the code for a file output */
        transform(code, id) {
            if (!filter(id)) return;

            const transformedCode = (options.minify) ? minifyCSS(options.transform(code)) : options.transform(code);

            styles[id] = transformedCode;

            return {
                code: `export default ${JSON.stringify(transformedCode)};`,
                map: { mappings: "" }
            };
        },

        /* output a css file with all css that was imported without being assigned a variable */
        generateBundle(opts, bundle) {
            for (let file in bundle) {

                let modules = Array.isArray(bundle[file].modules) ? bundle[file].modules : Object.getOwnPropertyNames(bundle[file].modules);
                let css = Object.entries(styles)
                    .sort((a, b) => modules.indexOf(a[0]) - modules.indexOf(b[0]))
                    .map(entry => {
                        /* remove files that were assigned a variable */
                        if(!bundle[file].modules[entry[0]]) return entry[1];
                    })
                    .join("\n");

                if(css.trim().length <= 0 && !alwaysOutput) return;
                
                /* create the directories in the output option if they do not already exist */
                const output = options.output || `${path.basename(file, path.extname(file))}.css`;

                /* write the css content to a file */
                this.emitFile({ type: "asset", fileName: output, source: css });
            }
        }
    };
};

/* minify css */
function minifyCSS(content) {
    content = content.replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, "");
    content = content.replace(/ {2,}/g, " ");
    content = content.replace(/ ([{:}]) /g, "$1");
    content = content.replace( /([{:}]) /g, "$1");
    content = content.replace(/([;,]) /g, "$1");
    content = content.replace(/ !/g, "!");
    return content;
}
