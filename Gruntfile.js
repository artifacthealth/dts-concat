var path = require("path");
var fs = require("fs");

module.exports = function(grunt) {

    grunt.option('stack', true);

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-typescript");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-mocha-test");
    grunt.loadNpmTasks('grunt-ts-clean');

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),

        clean: {
            build: {
                src: [
                    "build/"
                ]
            },
            lib: {
                src: [
                    "lib/**/*.js",
                ]
            }
        },

        typescript: {
            build: {
                options: {
                    references: [
                        "core",
                        "webworker"
                    ],
                    target: "es5",
                    module: "commonjs",
                    sourceMap: true,
                    declaration: true,
                    noImplicitAny: true
                },
                src: ['src/**/*.ts'],
                dest: 'build/'
            },
            tests: {
                options: {
                    references: [
                        "core",
                        "webworker"
                    ],
                    target: "es5",
                    module: "commonjs",
                    sourceMap: true,
                    noImplicitAny: true
                },
                src: [
                    'tests/**/*.ts'
                ],
                dest: 'build/'
            }
        },

        copy: {
            build: {
                files: [
                    {
                        expand: true,
                        src: [
                            'package.json'
                        ],
                        dest: 'build/'
                    },
                    {
                        expand: true,
                        src: [
                            "src/**/*.d.ts"
                        ],
                        dest: "build/"
                    },
                    {
                        expand: true,
                        src: [
                            "typings/**/*.d.ts"
                        ],
                        dest: "build"
                    }
                ]
            },
            lib: {
                files: [
                    {
                        expand: true,
                        cwd: 'build/src/',
                        src: [
                            '**/*.js'
                        ],
                        dest: 'lib/'
                    }
                ]
            }
        },

        mochaTest: {
            tests: {
                options: {
                    reporter: 'spec'
                },
                src: ['build/tests/**/*.tests.js']
            }
        },

        ts_clean: {
            lib: {
                options: {
                    verbose: false
                },
                src: ['lib/**/*'],
                dot: false
            }
        },

        shell: {
            lib: {
                options: {
                    execOptions: {
                        cwd: 'build/src/'
                    }
                },
                command: 'node tsreflect-compiler.js lib.d.ts'
            }
        }
    });

    grunt.registerTask("dts_concat", function() {

        var done = this.async();
        var bundler = require("./build/src/index");
        bundler({ name: "dts-concat", main: "./build/src/index.d.ts", outDir: "lib/" }, done);
    });


    grunt.registerMultiTask("bundle", "A task that bundles DTS files", function() {

        var importExp = /^[ \t]*(export )?import (\w+) = require\((['"])(.+?)(\3\);.*)$/;
        var referenceTagExp = /^[ \t]*\/\/\/[ \t]*<reference[ \t]+path=(["'])(.*?)\1?[ \t]*\/>.*$/;
        var fileExp = /^([\./].*|.:.*)$/;
        var exportAssignmentExp = /^[ \t]*export = (\w+);.*$/
        var privateExp = /^[ \t]*(?:static )?private (?:static )?/;

        var indentText = this.data.options.indent;

        var baseDir = path.resolve(path.dirname(this.data.options.main));
        var mainFile = path.resolve(this.data.options.main);
        var outFile = path.resolve(baseDir, this.data.options.name + ".d.ts");

        function parseFile(file) {

            var res = {
                file: file,
                refs: [],
                lines: [],
                externalImports: [],
                relativeImports: []
            }

            var refsMap = {},
                externalImportsMap = {},
                relativeImportsMap = {};

            var code = fs.readFileSync(file, "utf8");
            code.split(/\r?\n/g).forEach(function (line) {

                // reference tag
                if (/^\/\/\//.test(line)) {
                    var ref = extractReference(line);
                    if (ref) {
                        var refPath = path.resolve(path.dirname(file), ref);
                        if(!refsMap[refPath]) {
                            refsMap[refPath] = true;
                            res.refs.push(refPath);
                        }
                        return;
                    }
                }

                // imports
                if ((match = line.match(importExp))) {
                    var impPath = path.resolve(path.dirname(file), match[4]);

                    // filename (i.e. starts with a dot, slash or windows drive letter)
                    if (fileExp.test(match[4])) {
                        var full = path.resolve(path.dirname(file), impPath + '.d.ts');

                        if(!relativeImportsMap[full]) {
                            relativeImportsMap[full] = true;
                            res.relativeImports.push({ name: match[2], path: full, exported: !!match[1] });
                        }
                    }
                    // node_modules reference
                    else {
                        if(!externalImportsMap[match[4]]) {
                            externalImportsMap[match[4]] = true;
                            res.externalImports.push({ name: match[2], path: match[4], epxorted: !!match[1] });
                        }
                    }
                    return;
                }

                // private member
                if (privateExp.test(line)) {
                    return;
                }

                // blankline
                if (/^\s*$/.test(line)) {
                    return;
                }

                // export assignment
                if ((match = line.match(exportAssignmentExp))) {

                    res.exportName = match[1];
                    return;
                }

                // remove the 'declare' keyword (but leave 'export' intact)
                res.lines.push(line.replace(/^(export )?declare /g, '$1'));
            });

            return res;
        }

        // parse files
        var processed = {},
            parsedFile;

        var externalImports = [],
            externalImportsMap = {},
            relativeImportsMap = {},
            refs = [],
            refsMap = {},
            fileMap = {};

        var queue = [mainFile];
        while (queue.length > 0) {
            var target = queue.shift();
            if (processed[target]) {
                continue;
            }
            processed[target] = true;

            // parse the file
            parsedFile = parseFile(target);
            fileMap[parsedFile.file] = parsedFile;

            // add relative imports to the queue
            for(var i = 0; i < parsedFile.relativeImports.length; i++) {
                if(!fileMap[parsedFile.relativeImports[i].path]) {
                    queue.push(parsedFile.relativeImports[i].path);
                }
            }

            // save external imports
            for(var i = 0; i < parsedFile.imports.length; i++) {
                var externalImport = parsedFile.imports[i];

                if(externalImportsMap[externalImport.path]) {
                    // Make sure that all external references use the same identifier
                    if(externalImport.name != externalImportsMap[externalImport.path].name) {
                        throw new Error("Subsequent external import of '" + externalImport.path + "' uses a different identifier.");
                    }
                }
                else {
                    externalImportsMap[externalImport.path] = externalImport;
                    externalImports.push(externalImport);
                }
            }

            // TODO: Need to make sure that relative import uses the same name as the export assignment

            // check relative imports
            for(var i = 0; i < parsedFile.relativeImports.length; i++) {
                var relativeImport = parsedFile.relativeImports[i];

                if(relativeImportsMap[relativeImport.path]) {
                    // Make sure that all relative imports use the same identifier
                    if(relativeImport.name != relativeImportsMap[relativeImport.path].name) {
                        throw new Error("Subsequent relative import of '" + relativeImport.path + "' uses a different identifier.");
                    }
                }
                else {
                    relativeImportsMap[relativeImport.path] = relativeImport;
                }
            }

            // save external references
            for(var i = 0; i < parsedFile.refs.length; i++) {
                var ref = parsedFile.refs[i];

                if(!refsMap[ref]) {
                    refsMap[ref] = true;
                    refs.push(ref);
                }
            }
        }

        // write output
        var content = "";

        // write references
        for(var i = 0; i < refs.length; i++) {
            content += "/// <reference path=\"" + path.relative(baseDir, refs[i]) + "\" />\n";
        }

        // create wrapper module
        content += "\ndeclare module \"" + this.data.options.name + "\" {\n\n";

        // write external imports
        for(var i = 0; i < externalImports.length; i++) {
            content += indent(1) + "import " + externalImports[i].name + " = require(\"" + externalImports[i].path + "\");\n";
        }

        var exportMap = {};

        var mainParsedFile = fileMap[mainFile];
        for(var i = 0; i < mainParsedFile.relativeImports.length; i++) {
            var relativeImport = mainParsedFile.relativeImports[i];
            if(relativeImport.exported) {
                exportMap[relativeImport.path] = relativeImport;
            }
        }

        // output all files
        for(var name in fileMap) {
            parsedFile = fileMap[name];

            if(parsedFile.lines.length == 0) continue;

            content += "\n";
            var depth = 1;

            // If this file is exported by the top-level file
            var exportedModule = exportMap[name];

            if(parsedFile.exportName) {
                // If we have an exported module that uses export assignment
                if(exportedModule) {
                    var matchNameExp = createExportNameMatchRegExp(parsedFile.exportName);
                }
            }
            else {
                // We have a module that does not use export assignment
                var line = "module " + relativeImportsMap[parsedFile.file].name + " {\n";
                // If we have an exported module
                if(exportedModule) {
                    line = "export " + line;
                }
                content += indent(1) + line;
                depth = 2;
            }

            var lines = parsedFile.lines;
            for (var j = 0; j < lines.length; j++) {

                var line = lines[j];
                if(matchNameExp && matchNameExp.test(line)) {
                    line = "export " + line;
                    matchNameExp = undefined;
                }

                content += indent(depth) + line + "\n";
            }

            // we are wrapping a module that does not use export assignment
            if(depth == 2) {
                content += indent(1) + "}\n";
            }
        }

        content += "}\n";

        fs.writeFileSync(outFile, content, 'utf8');


        function extractReference(tag) {
            var match = tag.match(referenceTagExp);
            if (match) {
                return match[2];
            }
            return null;
        }

        function indent(num) {
            return new Array(num+1).join(indentText);
        }

        function createExportNameMatchRegExp(name) {
            return new RegExp("^\\w+ " + escape(name) + " .*$");
        }

        function escape(str) {

            // From http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
            return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        }
    });


    // Default task(s).
    grunt.registerTask("default", [ "build", "lib", "tests" ]);
    grunt.registerTask("build", [ "clean:build", "typescript:build", "copy:build" ]);
    grunt.registerTask("lib", [ "clean:lib", "copy:lib", "ts_clean:lib", "dts_concat" ]);
    grunt.registerTask("tests", [ "typescript:tests", "mochaTest:tests" ]);

};