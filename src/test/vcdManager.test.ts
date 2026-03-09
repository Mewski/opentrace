import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('VCDManager Module', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../vcdManager.ts'), 'utf8');

    test('VCDManager class is exported', () => {
        assert.ok(source.includes('export class VCDManager'));
    });

    test('VCDManager has correct viewType', () => {
        assert.ok(source.includes("'opentrace.vcd'"));
    });

    test('viewType does not contain wavetrace', () => {
        assert.ok(!source.toLowerCase().includes('wavetrace'));
    });

    test('config file uses opentrace naming', () => {
        assert.ok(source.includes('config.opentrace.json'));
    });

    test('webview loads Stencil build output', () => {
        assert.ok(source.includes('opentrace.esm.js'));
        assert.ok(source.includes('opentrace.css'));
    });

    test('no licensing code present', () => {
        assert.ok(!source.includes('license-activate'));
        assert.ok(!source.includes('license-deactivate'));
        assert.ok(!source.includes('node-machine-id'));
    });
});
