/**
 * Describes a concat operation.
 */
interface Options {

    /**
     * The name of the module specified in package.json. Used to generate ambient external module declaration.
     */
    name: string;

    /**
     * The path to the .d.ts file generated by TypeScript for the main module.
     */
    main: string;

    /**
     * The output directory.
     */
    outDir?: string;

    /**
     * Full path to the output file. If 'out' is specified then 'outDir' is ignored.
     */
    out?: string;

    /**
     * Character sequence to use for indent. Default is four spaces.
     */
    indent?: string;
}

export = Options;