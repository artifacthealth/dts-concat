/// <reference path="../../typings/external.d.ts" />

import {Foo} from '../Foo';
import * as mod2 from 'external2';

export class ExternalContainer {
    public something: mod2.AnotherType;
}

export function bar(foo: Foo): string {
    return foo.foo + '-bar';
}

export function bazz(value: string, option?: boolean): string {
    return value + '-bazz';
}
