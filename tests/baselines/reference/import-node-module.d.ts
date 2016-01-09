/// <reference path="../../../../typings/node.d.ts" />

declare module "import-node-module" {
    import * as events from "events";

    export class SomeClass extends events.EventEmitter {
    }
}
