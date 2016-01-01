/// <reference path="../../../../typings/node.d.ts" />

declare module "import-node-module" {
    import events = require("events");

    export class SomeClass extends events.EventEmitter {
    }
}
