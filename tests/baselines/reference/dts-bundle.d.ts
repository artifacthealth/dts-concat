/// <reference path="../../../../../tests/cases/dts-bundle/typings/external.d.ts" />

declare module "dts-bundle" {
    import * as mod1 from "external1";
    import * as mod2 from "external2";

    export function run(foo?: Foo): Foo;
    export function flep(): exp.ExternalContainer;
    export function bar(): mod1.SomeType;

    module exp {
        export class ExternalContainer {
            something: mod2.AnotherType;
        }
        export function bar(foo: Foo): string;
        export function bazz(value: string, option?: boolean): string;
    }

    export class Foo {
        foo: string;
        constructor(secret?: string);
        /**
         * Bars the foo.
         */
        barFoo(): void;
        /**
         * Foos the bar.
         */
    }
}
