import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Extension Module', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../extension.ts'), 'utf8');

    test('exports activate and deactivate functions', () => {
        assert.ok(source.includes('export function activate'));
        assert.ok(source.includes('export function deactivate'));
    });

    test('registers the correct custom editor provider', () => {
        assert.ok(source.includes('VCDManager.viewType'));
        assert.ok(source.includes('registerCustomEditorProvider'));
    });
});
