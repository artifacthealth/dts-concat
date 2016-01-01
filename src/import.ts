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

    constructor(identifier: string, path: string, exported: boolean) {

        this.identifier = identifier;
        this.path = path;
        this.exported = exported;
        this.relative = /^([\./].*|.:.*)$/.test(path);
    }

    static parse(text: string): Import {
        var match = text.match(/^[ \t]*(export )?import (\w+) = require\((['"])(.+?)(\3\).*)$/);
        if(match) {
            return new Import(match[2], match[4], !!match[1]);
        }
    }
}
