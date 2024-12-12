import { createFilter } from "@rollup/pluginutils";
import path from "path";

export default (options = {}) => {
    if (!options.transform) options.transform = (code) => code;

    const styles = {};
    const alwaysOutput = options.alwaysOutput ?? false;
    const filter = createFilter(options.include ?? ["**/*.css"], options.exclude ?? []);

    /* function to sort the css imports in order - credit to rollup-plugin-postcss */
    const getRecursiveImportOrder = (id, getModuleInfo, seen = new Set()) => {
        if (seen.has(id)) return [];

        seen.add(id);

        const result = [id];
        const moduleInfo = getModuleInfo(id);

        if (moduleInfo) {
            getModuleInfo(id).importedIds.forEach((importFile) => {
                result.push(...getRecursiveImportOrder(importFile, getModuleInfo, seen));
            });
        }

        return result;
    };

    /* minify css */
    const minifyCSS = (content) => {
        const calc_functions = [];
        const calc_regex = /\bcalc\(([^)]+)\)/g;
        const comments = /("(?:[^"\\]+|\\.)*"|'(?:[^'\\]+|\\.)*')|\/\*[\s\S]*?\*\//g;
        const syntax = /("(?:[^"\\]+|\\.)*"|'(?:[^'\\]+|\\.)*')|\s*([{};,>~])\s*|\s*([*$~^|]?=)\s*|\s+([+-])(?=.*\{)|([[(:])\s+|\s+([\])])|\s+(:)(?![^}]*\{)|^\s+|\s+$|(\s)\s+(?![^(]*\))/g;

        return content
            .replace(calc_regex, (_, group) => {
                calc_functions.push(group);
                return "__CALC__";
            })
            .replace(comments, "$1")
            .replace(syntax, "$1$2$3$4$5$6$7$8")
            .replace(/__CALC__/g, () => `calc(${calc_functions.shift()})`)
            .replace(/\n+/g, " ");
    };

    return {
        name: "import-css",

        /* convert the css file to a module and save the code for a file output */
        transform(code, id) {
            if (!filter(id)) return;

            const transformedCode = (options.minify) ? minifyCSS(options.transform(code)) : options.transform(code);

            /* cache the result */
            if (!styles[id] || styles[id] != transformedCode) {
                styles[id] = transformedCode;
            }

            /* if modules are enabled or an import uses native css module syntax, export it as a CSSStyleSheet */
            const moduleInfo = this.getModuleInfo(id);
            const attributes = moduleInfo.assertions != undefined ? moduleInfo.assertions : moduleInfo.attributes;
            if (options.modules || attributes?.type == "css") {
                return {
                    code: `const sheet = new CSSStyleSheet();sheet.replaceSync(${JSON.stringify(transformedCode)});export default sheet;`,
                    map: { mappings: "" }
                };
            }

            /* if inject is enabled, we want to simply inject the stylesheet into the document head */
            if (options.inject) {
                return {
                    code: `document.head.appendChild(document.createElement("style")).textContent=${JSON.stringify(transformedCode)};`,
                    map: { mappings: "" }
                };
            }

            return {
                code: `export default ${JSON.stringify(transformedCode)};`,
                map: { mappings: "" }
            };
        },

        /* output a css file with all css that was imported without being assigned a variable */
        generateBundle(opts, bundle) {

            /* collect all the imported modules for each entry file */
            const modules = Object.keys(bundle).reduce((modules, file) => Object.assign(modules, bundle[file].modules), {});
            const entryChunk = Object.values(bundle).find((chunk) => chunk.facadeModuleId).facadeModuleId;

            /* remove css that was imported as a string, if there are no remaining stylesheets, we can return early */
            const stylesheets = Object.keys(styles).filter((id) => !modules[id]);
            if (!stylesheets.length) return;

            /* get the import order of the stylesheets and sort the array in place */
            const moduleIds = getRecursiveImportOrder(entryChunk, this.getModuleInfo);
            stylesheets.sort((a, b) => moduleIds.indexOf(a) - moduleIds.indexOf(b));

            /* if perserveModules is true, output the css files without bundling */
            if (opts.preserveModules && !options.output) {
                for (let id of stylesheets) {
                    const relativeToEntry = path.dirname(path.relative(entryChunk, id));
                    const outputPath = opts.dir ? opts.dir : path.dirname(opts.file);
                    const fileName = path.join(path.join(outputPath, relativeToEntry), path.basename(id));

                    if (styles[id].trim().length <= 0 && !alwaysOutput) continue;

                    this.emitFile({ type: "asset", fileName: fileName, source: styles[id] });
                }

                return;
            }

            /* merge all css files into a single stylesheet */
            const css = stylesheets.map((id) => styles[id]).join("\n");

            if (css.trim().length <= 0 && !alwaysOutput) return;

            /* return the asset name by going through a set of possible options */
            const getAssetName = () => {
                const fileName = options.output ?? (opts.file ?? "bundle.js");
                return `${path.basename(fileName, path.extname(fileName))}.css`;
            };

            /* return the asset fileName by going through a set of possible options */
            const getAssetFileName = () => {
                if (options.output) return options.output;
                if (opts.assetFileNames) return undefined;

                return getAssetName();
            };

            this.emitFile({
                type: "asset",
                name: getAssetName(),
                fileName: getAssetFileName(),
                source: css
            });
        }
    };
};
