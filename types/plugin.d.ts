import { Plugin, ResolveIdHook, TransformHook } from "rollup";

declare interface Options {
    include?: string | string[];
    exclude?: string | string[];
    output?: string;
    transform?: Function;
    minify?: boolean;
    modules?: boolean;
    inject?: boolean;
    alwaysOutput?: boolean;
    preserveImports?: boolean;
}

export default function (options?: Options) : Plugin & {
    resolveId: ResolveIdHook;
    transform: TransformHook;
}