import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Branding', () => {
    const rootDir = path.resolve(__dirname, '../../');

    test('package.json should reference opentrace, not wavetrace', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        assert.strictEqual(pkg.name, 'opentrace');
        assert.strictEqual(pkg.displayName, 'OpenTrace');
        assert.ok(!JSON.stringify(pkg).toLowerCase().includes('wavetrace'));
    });

    test('extension source should not contain wavetrace references', () => {
        const srcDir = path.join(rootDir, 'src');
        const files = fs
            .readdirSync(srcDir)
            .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

        for (const file of files) {
            const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
            assert.ok(
                !content.toLowerCase().includes('wavetrace'),
                `${file} should not contain wavetrace references`
            );
        }
    });

    test('schema file should not reference wavetrace', () => {
        const schemaPath = path.join(rootDir, 'schemas', 'opentrace.schema.json');
        if (fs.existsSync(schemaPath)) {
            const content = fs.readFileSync(schemaPath, 'utf8');
            assert.ok(!content.toLowerCase().includes('wavetrace'));
        }
    });
});
