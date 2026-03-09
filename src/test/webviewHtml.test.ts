import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Webview HTML template', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../vcdManager.ts'), 'utf8');

    test('loads the Stencil ESM entry point', () => {
        assert.ok(source.includes('opentrace.esm.js'));
    });

    test('loads the Stencil CSS', () => {
        assert.ok(source.includes('opentrace.css'));
    });

    test('loads the renderer bridge script', () => {
        assert.ok(source.includes('renderer.js'));
    });

    test('uses ot-app custom element', () => {
        assert.ok(source.includes('<ot-app'));
    });

    test('sets a nonce on scripts for CSP', () => {
        const nonceCount = (source.match(/nonce="/g) || []).length;
        assert.ok(nonceCount >= 2, 'Should set nonce on at least 2 script tags');
    });

    test('loads vscode.css for theme integration', () => {
        assert.ok(source.includes('vscode.css'));
    });
});

suite('Renderer bridge', () => {
    const renderer = fs.readFileSync(path.resolve(__dirname, '../../media/renderer.js'), 'utf8');

    test('acquires the VSCode API', () => {
        assert.ok(renderer.includes('acquireVsCodeApi'));
    });

    test('handles parse messages', () => {
        assert.ok(renderer.includes("case 'parse'"));
    });

    test('handles clear messages', () => {
        assert.ok(renderer.includes("case 'clear'"));
    });

    test('handles config messages', () => {
        assert.ok(renderer.includes("case 'config'"));
    });

    test('handles export messages', () => {
        assert.ok(renderer.includes("case 'export'"));
    });

    test('handles import messages', () => {
        assert.ok(renderer.includes("case 'import'"));
    });

    test('handles reload messages', () => {
        assert.ok(renderer.includes("case 'reload'"));
    });

    test('handles file-changed messages', () => {
        assert.ok(renderer.includes("case 'file-changed'"));
    });

    test('listens for vcd-ready event', () => {
        assert.ok(renderer.includes('vcd-ready'));
    });

    test('listens for vcd-done event', () => {
        assert.ok(renderer.includes('vcd-done'));
    });

    test('listens for log events', () => {
        assert.ok(renderer.includes("'log'"));
    });

    test('listens for config-save events', () => {
        assert.ok(renderer.includes('config-save'));
    });

    test('listens for config-reset events', () => {
        assert.ok(renderer.includes('config-reset'));
    });

    test('observes theme changes via MutationObserver', () => {
        assert.ok(renderer.includes('MutationObserver'));
    });
});
