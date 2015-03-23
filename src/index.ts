/// <reference path="../typings/async.d.ts" />
/// <reference path="../typings/node.d.ts" />

import path = require("path");
import async = require("async");
import fs = require("fs");

import Options = require("./options");
import SourceFile = require("./sourceFile");
import SourceFileMap = require("./sourceFileMap");
import Import = require("./import");
import ImportSet = require("./importSet");
import Callback = require("./callback");

/**
 * Combines TypeScript .d.ts files into a single .d.ts file for distributing CommonJS modules.
 * @param options Options for the operation.
 * @param callback Called when the operation completes.
 */
function concat(options: Options, callback: Callback): void {

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
        });

        // make sure imports follow rules
        var errors = validateImports();
        if(errors.length > 0) {
            return callback(new Error("There was a problem validating import statements:\n" + errors.join("\n")));
        }

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
               output += indent(1) + "import " + importStatement.identifier + " = require(\"" + importStatement.path + "\");\n";
           }
        });

        sourceFiles.forEach(sourceFile => {

            if(sourceFile.lines.length == 0) return;

            output += "\n";
            var depth = 1;

            // Check if module uses export assignment
            if(sourceFile.exportName) {
                if(sourceFile.exported) {
                    // The module is exported by the main module. Create a regular expression that matches on where the
                    // identifier is declared in the module so that we can add the 'export' modifier.
                    var matchDeclaration = createExportNameMatchRegExp(sourceFile.exportName);
                }
            }
            else {
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
                if(matchDeclaration && matchDeclaration.test(line)) {
                    line = "export " + line;
                    matchDeclaration = undefined;
                }

                output += indent(depth) + line + "\n";
            });

            // we are wrapping a module that does not use export assignment
            if(depth == 2) {
                output += indent(1) + "}\n";
            }
        });

        // if the main file uses an export assignment, add it back in
        var exportName = mainSourceFile.exportName;
        if(exportName) {
            output += "\n" + indent(1) + "export = " + exportName + ";\n";
        }

        output += "}\n";

        fs.writeFile(outFileName, output, 'utf8', callback);
    });

    function readSourceFile(filename: string, callback: Callback): void {

        if(sourceFiles.has(filename)) {
            return callback();
        }

        SourceFile.read(filename, (err, sourceFile) => {
            if(err) return callback(err);

            if(sourceFile.containsAmbientExternalModule) {
                return callback();
            }

            sourceFiles.add(sourceFile);

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

            async.each(filesToRead, readSourceFile, callback);
        });
    }

    function validateImports(): string[] {

        var imports: { [path: string]: string } = {};
        var errors: string[] = [];

        sourceFiles.forEach(sourceFile => {

            sourceFile.imports.forEach(importStatement => {

                // check to make sure that imports of modules that use export assignment use the same identifier name as the exported symbol.
                if(importStatement.relative) {
                    var importedSourceFile = sourceFiles.get(importStatement.path);
                    if(importedSourceFile.exportName && importedSourceFile.exportName != importStatement.identifier) {

                        errors.push(path.relative(baseDir, sourceFile.filename) + ": Import uses identifier '" + importStatement.identifier + "' which is different than exported name '" + importedSourceFile.exportName + "' of imported file '" + path.relative(baseDir, importStatement.path) + "'.");
                    }
                }

                // check to make sure that all imports of the same module use the same identifier
                var identifier = imports[importStatement.identifier];
                if(identifier === undefined) {
                    imports[importStatement.path] = importStatement.identifier;
                }
                else {
                    if(identifier != importStatement.identifier) {

                        errors.push(path.relative(baseDir, sourceFile.filename) + ": Import of '" + path.relative(baseDir, importStatement.path) + "' uses identifier '" + importStatement.identifier + "' which is different than previously used identifier '" + identifier + "'.");
                    }
                }
            });
        });

        return errors;
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

export = concat;