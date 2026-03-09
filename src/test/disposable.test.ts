import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Disposable', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../disposable.ts'), 'utf8');

    test('exports Disposable class', () => {
        assert.ok(source.includes('export abstract class Disposable'));
    });

    test('exports disposeAll function', () => {
        assert.ok(source.includes('export function disposeAll'));
    });

    test('Disposable has dispose method', () => {
        assert.ok(source.includes('public dispose()'));
    });

    test('Disposable has _register method', () => {
        assert.ok(source.includes('protected _register'));
    });

    test('Disposable tracks disposal state', () => {
        assert.ok(source.includes('_isDisposed'));
    });
});
