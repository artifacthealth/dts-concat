/// <reference path="../typings/external.d.ts" />

import * as int from './lib/only-internal';
import * as exp from './lib/exported-sub';
import * as mod1 from 'external1';

import {Foo} from './Foo';
export {Foo};

/*
 Licence foo module v1.2.3 - MIT
 */
export function run(foo?: Foo): Foo {
    var foo = foo || new Foo();
    int.bazz(int.bar(foo));
    return foo;
}

// flep this
export function flep(): exp.ExternalContainer {
    return new exp.ExternalContainer();
}

// bar that
export function bar(): mod1.SomeType {
    return new mod1.SomeType();
}

