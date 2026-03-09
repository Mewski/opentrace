import * as assert from 'assert';
import defaultConfig, { OpenTraceConfig } from '../defaultConfig';

suite('defaultConfig', () => {
    test('has all required top-level sections', () => {
        assert.ok(defaultConfig.display);
        assert.ok(defaultConfig.keyboard);
        assert.ok(defaultConfig.mouse);
        assert.ok(defaultConfig.sidebar);
        assert.ok(defaultConfig.theme);
        assert.ok(defaultConfig.window);
    });

    test('display.defaultTraceStyle has valid renderer and color', () => {
        const style = defaultConfig.display.defaultTraceStyle;
        assert.strictEqual(style.renderer, 'line');
        assert.ok(style.color.startsWith('#'));
        assert.strictEqual(typeof style.height, 'number');
        assert.ok(style.height > 0);
        assert.strictEqual(typeof style.strokeWidth, 'number');
        assert.ok(style.strokeWidth > 0);
        assert.strictEqual(typeof style.fill, 'number');
        assert.ok(style.fill >= 0 && style.fill <= 1, 'fill should be 0–1');
    });

    test('keyboard shortcuts are all non-empty strings', () => {
        const kb = defaultConfig.keyboard;
        const stringKeys = Object.keys(kb).filter((k) => typeof kb[k] === 'string');
        assert.ok(stringKeys.length > 0);
        for (const key of stringKeys) {
            assert.ok((kb[key] as string).length > 0, `keyboard.${key} should not be empty`);
        }
    });

    test('keyboard.zoomAmount is a positive number', () => {
        assert.strictEqual(typeof defaultConfig.keyboard.zoomAmount, 'number');
        assert.ok(defaultConfig.keyboard.zoomAmount > 0);
    });

    test('mouse has zoom config', () => {
        assert.strictEqual(typeof defaultConfig.mouse.smoothScrolling, 'boolean');
        assert.strictEqual(typeof defaultConfig.mouse.reverseScrolling, 'boolean');
        assert.strictEqual(typeof defaultConfig.mouse.zoomAmount, 'number');
        assert.ok(defaultConfig.mouse.zoomAmount > 0);
    });

    test('sidebar width is reasonable', () => {
        assert.ok(defaultConfig.sidebar.width >= 100, 'sidebar too narrow');
        assert.ok(defaultConfig.sidebar.width <= 1000, 'sidebar too wide');
    });

    test('palette has at least 8 valid hex colors', () => {
        const palette = defaultConfig.theme.palette;
        assert.ok(palette.length >= 8);
        for (const c of palette) {
            assert.ok(/^#[0-9a-fA-F]{6}$/.test(c), `Invalid hex color: ${c}`);
        }
    });

    test('window dimensions are positive', () => {
        assert.ok(defaultConfig.window.width > 0);
        assert.ok(defaultConfig.window.height > 0);
    });

    test('config is safely serializable (JSON round-trip)', () => {
        const clone = JSON.parse(JSON.stringify(defaultConfig)) as OpenTraceConfig;
        assert.deepStrictEqual(clone.display, defaultConfig.display);
        assert.deepStrictEqual(clone.keyboard, defaultConfig.keyboard);
        assert.deepStrictEqual(clone.mouse, defaultConfig.mouse);
        assert.deepStrictEqual(clone.sidebar, defaultConfig.sidebar);
        assert.deepStrictEqual(clone.theme, defaultConfig.theme);
        assert.deepStrictEqual(clone.window, defaultConfig.window);
    });

    test('config can be merged with partial overrides', () => {
        const override = { sidebar: { width: 400 } };
        const merged = { ...defaultConfig, ...override };
        assert.strictEqual(merged.sidebar.width, 400);
        assert.deepStrictEqual(merged.display, defaultConfig.display);
    });
});
