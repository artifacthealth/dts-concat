import {Import} from "./import";

export class ImportSet {

    private _map: { [path: string]: Import } = {};
    private _list: Import[] = [];

    has(value: Import | string): boolean {

        if(typeof(value) === "string") {
            return this._map[<string>value] !== undefined
        }

        return this._map[(<Import>value).path] !== undefined;
    }

    get(path: string): Import {
        return this._map[path];
    }

    add(value: Import): void {
        if(this.has(value)) return;

        this._map[value.path] = value;
        this._list.push(value);
    }

    forEach(callback: (value: Import) => void): void {
        this._list.forEach(callback);
    }
}
