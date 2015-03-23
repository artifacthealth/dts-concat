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
                    declaration: true,
                    noImplicitAny: true
                },
                src: [
                    'tests/*.ts',
                    'tests/cases/**/*.ts'
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
            tests: {
                files: [
                    {
                        expand: true,
                        src: [
                            "tests/cases/*.json",
                            "tests/cases/**/*.d.ts"
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

    // Default task(s).
    grunt.registerTask("default", [ "build", "lib", "tests" ]);
    grunt.registerTask("build", [ "clean:build", "typescript:build", "copy:build" ]);
    grunt.registerTask("lib", [ "clean:lib", "copy:lib", "ts_clean:lib", "dts_concat" ]);
    grunt.registerTask("tests", [ "typescript:tests", "copy:tests", "mochaTest:tests" ]);

};