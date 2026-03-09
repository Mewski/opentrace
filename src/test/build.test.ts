import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../');

suite('Build artifacts', () => {
    test('extension bundle exists', () => {
        assert.ok(fs.existsSync(path.join(root, 'dist/extension.js')));
    });

    test('Stencil ESM entry exists', () => {
        assert.ok(fs.existsSync(path.join(root, 'media/build/opentrace/opentrace.esm.js')));
    });

    test('Stencil CSS exists', () => {
        assert.ok(fs.existsSync(path.join(root, 'media/build/opentrace/opentrace.css')));
    });

    test('WASM core.js exists', () => {
        assert.ok(fs.existsSync(path.join(root, 'media/core.js')));
    });

    test('renderer.js exists', () => {
        assert.ok(fs.existsSync(path.join(root, 'media/renderer.js')));
    });

    test('vscode.css exists', () => {
        assert.ok(fs.existsSync(path.join(root, 'media/vscode.css')));
    });
});

suite('Package manifest', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

    test('main entry points to dist/extension.js', () => {
        assert.strictEqual(pkg.main, './dist/extension.js');
    });

    test('engine requires VSCode >= 1.46.0', () => {
        assert.ok(pkg.engines.vscode);
        assert.ok(pkg.engines.vscode.includes('1.46'));
    });

    test('activates on custom editor', () => {
        assert.ok(pkg.activationEvents.includes('onCustomEditor:opentrace.vcd'));
    });

    test('registers VCD file association', () => {
        const editor = pkg.contributes.customEditors[0];
        assert.strictEqual(editor.viewType, 'opentrace.vcd');
        assert.ok(editor.selector.some((s: any) => s.filenamePattern === '*.vcd'));
    });

    test('registers FST file association', () => {
        const editor = pkg.contributes.customEditors[0];
        assert.ok(editor.selector.some((s: any) => s.filenamePattern === '*.fst'));
    });

    test('registers GHW file association', () => {
        const editor = pkg.contributes.customEditors[0];
        assert.ok(editor.selector.some((s: any) => s.filenamePattern === '*.ghw'));
    });

    test('has build scripts', () => {
        assert.ok(pkg.scripts['vscode:prepublish']);
        assert.ok(pkg.scripts.compile);
        assert.ok(pkg.scripts['build:webview']);
    });

    test('has lint and format scripts', () => {
        assert.ok(pkg.scripts.lint);
        assert.ok(pkg.scripts.format);
    });

    test('has test script', () => {
        assert.ok(pkg.scripts.test);
    });

    test('has no runtime dependencies', () => {
        assert.ok(!pkg.dependencies, 'Should have no runtime dependencies');
    });

    test('JSON schema validation targets config.opentrace.json', () => {
        const validation = pkg.contributes.jsonValidation[0];
        assert.strictEqual(validation.fileMatch, 'config.opentrace.json');
    });
});

suite('Schema file', () => {
    const schemaPath = path.join(root, 'schemas/opentrace.schema.json');

    test('schema file exists', () => {
        assert.ok(fs.existsSync(schemaPath));
    });

    test('schema is valid JSON', () => {
        const content = fs.readFileSync(schemaPath, 'utf8');
        assert.doesNotThrow(() => JSON.parse(content));
    });

    test('schema defines config sections via definitions', () => {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        const defs = schema.definitions || {};
        assert.ok('Config' in defs);
        assert.ok('DisplayConfig' in defs);
        assert.ok('KeyboardConfig' in defs);
        assert.ok('MouseConfig' in defs);
        assert.ok('SidebarConfig' in defs);
        assert.ok('ThemeConfig' in defs);
        assert.ok('WindowConfig' in defs);
    });
});
