/// <reference path="../typings/async.d.ts" />
/// <reference path="../typings/node.d.ts" />
import * as path from "path";
import * as async from "async";
import * as fs from "fs";

import {Options} from "./options";
import {SourceFile} from "./sourceFile";
import {SourceFileMap} from "./sourceFileMap";
import {Import} from "./import";
import {ImportSet} from "./importSet";
import {Callback} from "./callback";


/**
 * Combines TypeScript .d.ts files into a single .d.ts file for distributing CommonJS modules.
 * @param options Options for the operation.
 * @param callback Called when the operation completes.
 */
export function concat(options: Options, callback: Callback): void {

    if(!options) {
        throw new Error("Missing required argument 'options'.");
    }

    if(!options.name) {
        throw new Error("Missing required option 'name'.");
    }

    if(!options.main) {
        throw new Error("Missing required option 'main'.");
    }

    var baseDir = path.resolve(path.dirname(options.main));
    var mainFileName = path.resolve(options.main);
    var outFileName = options.out ? path.resolve(options.out) : path.resolve(options.outDir || baseDir, options.name + ".d.ts");
    var indentText = options.indent || "    ";

    var sourceFiles = new SourceFileMap();
    var references = new Set();
    var imports = new ImportSet();

    var output = "";

    readSourceFile(mainFileName, (err) => {
        if(err) return callback(err);

        var mainSourceFile = sourceFiles.get(mainFileName);

        // flag all source file exported by the main source file
        mainSourceFile.imports.forEach(importStatement => {
            if(importStatement.exported) {
                // Check to make sure we have a source file for this import
                if(!sourceFiles.has(importStatement.path)) {
                    return callback(new Error(path.relative(baseDir, mainSourceFile.filename) + ": Cannot find module '" + importStatement.path + "'." ));
                }
                // Mark source file as exported
                sourceFiles.get(importStatement.path).exported = true;
            }
            if(importStatement.module && importStatement.relative) {
                // Check to make sure we have a source file for this import
                if(!sourceFiles.has(importStatement.path)) {
                    return callback(new Error(path.relative(baseDir, mainSourceFile.filename) + ": Cannot find module '" + importStatement.path + "'." ));
                }
                // Mark source file as being a module
                sourceFiles.get(importStatement.path).module = true;
            }
        });

        // add references to source files that contain ambient declarations for an imported modules
        references.forEach((reference: string) => {
            if(containsAmbientDeclarationForImportedModule(reference)) {
               output += "/// <reference path=\"" + path.relative(baseDir, reference) + "\" />\n";
           }
        });

        if(output.length > 0) {
            output += "\n";
        }

        // create wrapper module
        output += "declare module \"" + options.name + "\" {\n";

        // add imported modules
        imports.forEach((importStatement) => {
           if(!importStatement.relative) {
               if(importStatement.module) {
                   output += indent(1) + "import * as " + importStatement.identifier + " from \"" + importStatement.path + "\";\n";
               }
               else {
                   output += indent(1) + "import { " + importStatement.identifier + " } from \"" + importStatement.path + "\";\n";
               }
           }
        });

        sourceFiles.forEach(sourceFile => {

            if(sourceFile.lines.length == 0 || sourceFile.containsAmbientExternalModule) return;

            output += "\n";
            var depth = 1;

            // Check if import * as... syntax is used
            if(sourceFile.module) {
                // We have a module that does not use export assignment. Find where the module is imported and use the
                // import identifier to wrap the module in a module declaration.
                var importStatement = imports.get(sourceFile.filename);
                if(importStatement) {
                    var line = "module " + importStatement.identifier + " {\n";
                    if (sourceFile.exported) {
                        // The module is exported by the main module
                        line = "export " + line;
                    }
                    output += indent(1) + line;
                    depth = 2;
                }
            }

            sourceFile.lines.forEach(line => {
                output += indent(depth) + line + "\n";
            });

            // we are wrapping a module that does not use export assignment
            if(depth == 2) {
                output += indent(1) + "}\n";
            }
        });

        output += "}\n";

        fs.writeFile(outFileName, output, 'utf8', callback);
    });

    function readSourceFile(filename: string, callback: Callback): void {

        if(sourceFiles.has(filename)) {
            return callback();
        }

        SourceFile.read(filename, (err, sourceFile) => {
            if(err) return callback(err);

            sourceFiles.add(sourceFile);

            if(sourceFile.containsAmbientExternalModule) {
                return callback();
            }

            // build a list of files that this file imports or references
            var filesToRead: string[] = [];

            sourceFile.references.forEach((reference) => {
                // build unique list of all references
                references.add(reference);
                // add reference to list of files to read
                filesToRead.push(reference)
            });

            sourceFile.imports.forEach((importStatement) => {
                // build unique list of all imports
                imports.add(importStatement);
                // add relative import to list of files to read
                if(importStatement.relative) {
                    filesToRead.push(importStatement.path);
                }
            });

            async.eachSeries(filesToRead, readSourceFile, callback);
        });
    }

    function containsAmbientDeclarationForImportedModule(filename: string): boolean {

        var referencedSourceFile = sourceFiles.get(filename);
        return referencedSourceFile && referencedSourceFile.containsAmbientDeclarationForImportedModule(imports);
    }

    function indent(num: number): string {
        return new Array(num+1).join(indentText);
    }
}

function createExportNameMatchRegExp(name: string): RegExp {
    return new RegExp("^\\w+ " + escape(name) + " .*$");
}

function escape(str: string): string {

    // From http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
