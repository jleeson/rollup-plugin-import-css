import { createFilter } from "@rollup/pluginutils";
import path from "path";
import fs from "fs";

export default (options = {}) => {
    if (!options.transform) options.transform = (code) => code;

    const styles = {};
    const imports = {};
    const alwaysOutput = options.alwaysOutput ?? false;
    const preserveImports = options.preserveImports ?? true;
    const copyRelativeAssets = options.copyRelativeAssets ?? false;
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
    const minifyCSS = (css) => {
        /* Step 1: Remove comments but preserve quoted strings */
        return css.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')|\/\*[^]*?\*\//g, (_, quoted) => quoted || "")
            /* Step 2: Remove spaces around ; and } — keep the closing brace */
            .replace(/\s*;\s*(})/g, ";$1")
            /* Step 3: Remove spaces around meta characters and operators */
            .replace(/\s*([*$~^|]?=|[{};,>~]|!important)\s*/g, "$1")
            /* Step 4: Remove spaces around + and - in selectors before { */
            .replace(/\s*([+-])\s*(?=[^}]*\{)/g, "$1")
            /* Step 5: Remove space after [, ( */
            .replace(/([[(])\s+/g, "$1")
            /* Step 6: Remove space before ], ) */
            .replace(/\s+([\])])/g, "$1")
            /* Step 7: Remove space around colon, only outside selectors */
            .replace(/({[^}]*?)\s*:\s*/g, "$1:")
            /* Step 8: Trim leading and trailing whitespace */
            .replace(/^\s+|\s+$/g, "")
            /* Step 9: Collapse multiple spaces into one */
            .replace(/(\s)\s+/g, "$1")
            /* Step 10: Replace newlines characters with a space. */
            .replace(/\n+/g, " ");
    };

    return {
        name: "import-css",

        resolveId(source, importer) {
            if (source.endsWith(".css") && (source.startsWith(".") || source.startsWith("/"))) {
                (imports[importer] = imports[importer] ?? []).push(source);
                return { id: path.resolve(path.dirname(importer), source) };
            }

            return null;
        },

        /* convert the css file to a module and save the code for a file output */
        async transform(code, id) {
            if (!filter(id)) return;

            const transformedCode = (options.minify) ? minifyCSS(await options.transform(code)) : await options.transform(code);

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
                    map: null
                };
            }

            /* if inject is enabled, we want to simply inject the stylesheet into the document head */
            if (options.inject) {
                return {
                    code: `if(typeof document!=="undefined")document.head.appendChild(document.createElement("style")).textContent=${JSON.stringify(transformedCode)};`,
                    map: null
                };
            }

            return {
                code: `export default ${JSON.stringify(transformedCode)};`,
                map: null
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
                    const relativePath = path.join(path.join(outputPath, relativeToEntry), path.basename(id));
                    const fileName = relativePath.includes("node_modules") ? relativePath.split("/").at(-1) : relativePath;

                    if (styles[id].trim().length <= 0 && !alwaysOutput) continue;

                    this.emitFile({ type: "asset", fileName: fileName, source: styles[id] });
                }

                /* reinject the css import into the bundle based on the imports we have tracked */
                if (preserveImports) {
                    for (let chunk of Object.values(bundle)) {
                        if (chunk.type != "chunk" || !imports[chunk.facadeModuleId]) continue;

                        for (let file of imports[chunk.facadeModuleId].reverse()) {
                            const importPath = file.includes("node_modules") ? `./${file.split("/").at(-1)}` : file;
                            if (chunk.code.includes(importPath)) continue;

                            chunk.code = `import "${importPath}";\n${chunk.code}`;
                        }
                    }
                }

                return;
            }

            /* create a copy of the styles object that we can modify to avoid caching problems in watch mode */
            const stylesToEmit = Object.assign({}, styles);

            /* copy relative assets to the output directory and update the referenced path */
            if (copyRelativeAssets) {
                for (let id of stylesheets) {
                    const assets = [...stylesToEmit[id].matchAll(/url\(\s*(['"]?)(\.\/.*?)\1\s*\)/g)].map((match) => match[2]);

                    for (let asset of assets) {
                        const reference = this.emitFile({
                            type: "asset",
                            name: path.basename(asset),
                            source: fs.readFileSync(path.resolve(path.dirname(id), asset))
                        });

                        stylesToEmit[id] = styles[id].replace(asset, `./${this.getFileName(reference)}`);
                    }
                }
            }

            /* merge all css files into a single stylesheet */
            const css = stylesheets.map((id) => stylesToEmit[id]).join(options.minify ? "" : "\n");

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
