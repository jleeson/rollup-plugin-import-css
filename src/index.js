/* imports */
import { createFilter } from "@rollup/pluginutils";
import fs from "fs";
import path from "path";

export default (options = {}) => {

    if(!options.transform) options.transform = code => code;

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

            styles[id] = options.transform(code);

            return {
                code: `export default ${JSON.stringify(options.transform(code))};`,
                map: { mappings: "" }
            };
        },

        /* output a css file with all css that was imported without being assigned a variable */
        generateBundle(options, bundle) {
            for (let file in bundle) {

                let modules = Array.isArray(bundle[file].modules) ? bundle[file].modules : Object.getOwnPropertyNames(bundle[file].modules);
                let css = Object.entries(styles)
                    .sort((a, b) => modules.indexOf(a[0]) - modules.indexOf(b[0]))
                    .map(entry => {
                        /* remove files that were assigned a variable */
                        const cssFile = bundle[file].modules[entry[0]];
                        if(cssFile.renderedLength <= 0 && cssFile.removedExports.includes("default")) {
                            return entry[1];
                        }
                    })
                    .join("\n");
                
                /* write the css content to a file */
                fs.writeFileSync(options.output || path.join(path.dirname(options.file), path.basename(file, path.extname(options.file)) + ".css"), css);
            }
        }
    };
};