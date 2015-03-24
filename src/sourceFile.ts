/// <reference path="../typings/node.d.ts" />

import fs = require("fs");
import path = require("path");

import Import = require("./import");
import ImportSet = require("./importSet");
import ResultCallback = require("./resultCallback");

class SourceFile {

    /**
     * The name of the file.
     */
    filename: string;

    /**
     * List of declaration file references.
     */
    references: Set<string> = new Set();

    /**
     * List of imports.
     */
    imports: Import[] = [];

    /**
     * The text of the source file.
     */
    lines: string[] = [];

    /**
     * The name of the exported identifier.
     */
    exportName: string;

    /**
     * Indicates if this source file is exported by the main source file.
     */
    exported: boolean;

    /**
     * Indicates if the source file contains an ambient external module declaration.
     */
    get containsAmbientExternalModule() {
        return this._ambientExternalModules.length > 0;
    }

    /**
     * A list of ambient external modules declared in this file.
     */
    private _ambientExternalModules: string[] = [];

    constructor(filename: string, code: string) {

        if(!filename) {
            throw new Error("Missing required argument 'filename'.");
        }
        if(!code) {
            throw new Error("Missing required argument 'code'.");
        }

        this.filename = filename;

        code.split(/\r?\n/g).forEach((line) => this._processLine(line));
    }

    static read(filename: string, callback: ResultCallback<SourceFile>): void {

        fs.exists(filename, (exists) => {
            if(!exists) {
                return callback(new Error("File '" + filename + "' does not exist."));
            }

            fs.readFile(filename, "utf8", (err, result) => {
                if(err) return callback(err);
                callback(null, new SourceFile(filename, result));
            });
        });
    }

    containsAmbientDeclarationForImportedModule(imports: ImportSet): boolean {

        for(var i = 0; i < this._ambientExternalModules.length; i++) {
            if(imports.has(this._ambientExternalModules[i])) {
                return true;
            }
        }

        return false;
    }

    private _processLine(line: string): void {

        if(this._parseReference(line)) {
            return;
        }

        if(this._parseImport(line)) {
            return;
        }

        if(this._parseAmbientExternalModuleDeclaration(line)) {
            return;
        }

        if(this._isPrivateMember(line)) {
            return;
        }

        if(this._isBlankLine(line)) {
            return;
        }

        if(this._parseExportAssignment(line)) {
            return;
        }

        this.lines.push(this._stripModifiers(line));
    }

    private _parseImport(line: string): boolean {

        var importStatement: Import;
        if(importStatement = Import.parse(line)) {
            if(importStatement.relative) {
                // get the absolute path of the import statement
                importStatement.path = path.resolve(path.dirname(this.filename), importStatement.path + '.d.ts');
            }
            this.imports.push(importStatement);
            return true;
        }

        return false;
    }

    private _parseReference(line: string): boolean {

        var match = line.match(/^[ \t]*\/\/\/[ \t]*<reference[ \t]+path=(["'])(.*?)\1?[ \t]*\/>.*$/);
        if (match) {
            this.references.add(path.resolve(path.dirname(this.filename), match[2]));
            return true;
        }
        return false;
    }

    private _isPrivateMember(line: string): boolean {
        return /^[ \t]*(?:static )?private (?:static )?/.test(line);
    }

    private _isBlankLine(line: string): boolean {
        return /^\s*$/.test(line);
    }

    private _stripModifiers(line: string): string {

        // strip the public keyword
        var match = line.match(/^([ \t]*)(static |)(public )(static |)(.*)/);
        if(match) {
            line = match[1] + match[2] + match[4] + match[5];
        }

        // strip the declare keyword
        return line.replace(/^[ \t]*(export )?declare /g, '$1');
    }

    private _parseAmbientExternalModuleDeclaration(line: string): boolean {
        var match = line.match(/^([ \t]*declare module )(['"])(.+?)(\2[ \t]*{?.*)$/);
        if(match) {
            this._ambientExternalModules.push(match[3]);
            return true;
        }
        return false;
    }

    private _parseExportAssignment(line: string): boolean {

        var match = line.match(/^[ \t]*export = (\w+);?.*$/);
        if (match) {
            this.exportName = match[1];
            return true;
        }
        return false;
    }
}

export = SourceFile;