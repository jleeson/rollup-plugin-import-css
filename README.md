# rollup-plugin-import-css
A Rollup plugin to import CSS into JavaScript

![Actions](https://github.com/jleeson/rollup-plugin-import-css/workflows/build/badge.svg)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jleeson/rollup-plugin-import-css/blob/master/LICENSE)
[![Follow Us](https://img.shields.io/badge/follow-on%20twitter-4AA1EC.svg)](https://twitter.com/jleesons)


---

## Usage

```js
import css from "rollup-plugin-import-css";

export default {
    input: "index.js",
    output: { file: "dist/index.js", format: "esm" },
    plugins: [ css() ]
};
```

This plugins supports three forms of importing css.
```js
import "./styles.css"; /* extract the styles to a external css bundle */
import styles from "./styles.css"; /* import the styles as a string */
import styles from "./styles.css" assert { type: "css" }; /* import the styles as a CSSStyleSheet */
```

NOTICE: using import assertions requires Rollup v3+

If your build uses `preserveModules`, this plugin will process and output your css files while maintaining their original file structure.

This plugin respects the import order of your css files.

---

## Options

### include

Type: `array` or `string`
Default: `[]`

A single file, or array of files to include when minifying.

### exclude

Type: `array` or `string`
Default: `[]`

A single file, or array of files to exclude when minifying.

### output

Type: `string`
Default: `null`

An output file name for the css bundle. By default `output.assetFileNames` is used.

### transform

Type: `Function`
Default: `null`

The transform function is used for processing the CSS, it receives a string containing the code to process as an argument. The function should return a string.

### minify

Type: `boolean`
Default: `false`

Minifies the css being imported.

### modules

Type: `boolean`
Default: `false`

All css files being imported with a variable will use native CSS Modules.

### inject

Type: `boolean`
Default: `false`

All css files being imported will be injected into the document head at runtime.

### alwaysOutput

Type: `boolean`
Default: `false`

Always output a css bundle even if the css output is empty.

---

## Why

With modern web frameworks, its useful to be able to import the css for components in a variety of ways. Other solutions for Rollup either lack features or are large and bloated with extra features that some users may not need such as SASS or LESS support. This plugin is small and by default only supports standard css with the option to process it further. Unlike most other css plugins this plugin maintains the order of your imports in order to avoid overwritting css unexpectedly and respects Rollup's preserveModules option. 

---

## Reporting Issues

If you are having trouble getting something to work with this plugin or run into any problems, you can create a new [Issue](https://github.com/jleeson/rollup-plugin-import-css/issues).

If this plugin does not fit your needs or is missing a feature you would like to see, let us know! We would greatly appreciate your feedback on it.

---

## License

rollup-plugin-import-css is licensed under the terms of the [**MIT**](https://github.com/jleeson/rollup-plugin-import-css/blob/master/LICENSE) license.
