import * as path from "path";

export class Import {

    /**
     * The import identifier.
     */
    identifier: string;

    /**
     * The path of the imported file or the name of an external reference.
     */
    path: string;

    /**
     * Indicates if the import uses a relative name.
     */
    relative: boolean;

    /**
     * Indicates if the import is exported.
     */
    exported: boolean;

    /**
     *
     */
    module: boolean;

    constructor(identifier: string, path: string, exported: boolean) {

        this.path = path;
        this.exported = exported;
        this.relative = /^([\./].*|.:.*)$/.test(path);

        var match = identifier.match(/^\* as ([^ ]+)$/);
        if(match) {
            // This is a "* as ..." import of a module
            this.identifier = match[1];
            this.module = true;
        }
        else {
            // multiple imports are not supported
            match = identifier.match(/^\{\s*(.*)\s*\}$/);
            if(match) {
                this.identifier = match[1];
            }
        }
    }

    static parse(text: string): Import {
        var match = text.match(/^[ \t]*(export|import) ((?:\*(?: as (?:[^ ]+))?)|(?:\{.+\})) from ['"]([^ ,]+)['"];?\s*$/);
        if(match) {
            return new Import(this._trim(match[2]), match[3], match[1] == "export");
        }
    }

    private static _trim(text: string): string {
        if(!text) return text;
        return text.trim();
    }
}

