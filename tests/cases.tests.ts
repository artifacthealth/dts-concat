/// <reference path="../typings/node.d.ts"/>
/// <reference path="../typings/mocha.d.ts"/>
/// <reference path="../typings/chai.d.ts"/>

import fs = require("fs");
import path = require("path");
import chai = require("chai");
import concat = require("../src/index");
import Options = require("../src/options");

import expect = chai.expect;

var testCasesDir = "build/tests/cases/";
var referenceBaselineDir = "tests/baselines/reference/";
var localBaselineDir = "tests/baselines/local/";

function setupCases(): void {

    processDir(testCasesDir, "json", setupCase);
}

function processDir(path: string, ext: string, cb: (filename: string) => void): void {

    var files = fs.readdirSync(path);
    var filter = new RegExp("\." + ext + "$");

    for (var i = 0, l = files.length; i < l; i++) {

        var filename = files[i];
        if(filter.test(filename)) {
            cb(files[i]);
        }
    }
}

function setupCase(filename: string): void {

    var baseName = path.basename(filename, ".json");
    var options: Options = loadOptions(testCasesDir + filename);

    var name = 'Case ' + filename,
        description = (<any>options).description;

    if(description) {
        name += ": " + description;
    }

    describe(name, () => {

        var errorsFilename = baseName + ".errors.txt";
        var declarationFilename = baseName + ".d.ts";

        before((done) => {

            deleteFile(localBaselineDir + errorsFilename);
            deleteFile(localBaselineDir + declarationFilename);

            options.outDir = localBaselineDir;
            options.main = testCasesDir + "/" + options.main;

            concat(options, (err) => {
                if(err) {
                    fs.writeFileSync(localBaselineDir + errorsFilename , err.toString(), "utf8");
                }

                done();
            });
        });

        it('should have correct errors in ' + errorsFilename, () => {

            compareToBaseline(errorsFilename);
        });

        it('should have correct declarations in ' + declarationFilename, () => {

            compareToBaseline(declarationFilename);
        });

        after(() => {
            errorsFilename = undefined;
            declarationFilename = undefined;
        });
    });
}

function loadOptions(filename: string): Options {

    return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function deleteFile(filePath: string): void {

    if(fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function compareToBaseline(filename: string): void {

    var localFilename = localBaselineDir + filename;
    var referenceFilename = referenceBaselineDir + filename;

    var localExists = fs.existsSync(localFilename);
    var referenceExists = fs.existsSync(referenceFilename);

    if(localExists && !referenceExists) {
        throw new Error("Unexpected file " + filename);
    }

    if(referenceExists && !localExists) {
        throw new Error("Missing file " + filename);
    }

    expect(readFile(localBaselineDir + filename), "Baseline changed for " + filename)
        .to.deep.equal(readFile(referenceBaselineDir + filename));
}

function readFile(filePath: string): any {

    var isJsonFile = path.extname(filePath) == ".json";

    if(!fs.existsSync(filePath)) {
        return isJsonFile ? {} : "";
    }

    var text = fs.readFileSync(filePath, "utf8");
    return isJsonFile ? JSON.parse(text) : text;
}

setupCases();