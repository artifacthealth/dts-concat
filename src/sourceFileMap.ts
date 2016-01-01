import {SourceFile} from "./sourceFile";

export class SourceFileMap {

    private _map: { [path: string]: SourceFile } = {};
    private _list: SourceFile[] = [];

    has(filename: string): boolean {
        return this._map[filename] !== undefined;
    }

    get(filename: string): SourceFile {
        return this._map[filename];
    }

    add(sourceFile: SourceFile): void {
        if(this.has(sourceFile.filename)) return;

        this._map[sourceFile.filename] = sourceFile;
        this._list.push(sourceFile);
    }

    forEach(callback: (value: SourceFile) => void): void {
        this._list.forEach(callback);
    }
}
