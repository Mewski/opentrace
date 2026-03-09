import * as assert from 'assert';
import defaultConfig, { OpenTraceConfig } from '../defaultConfig';

suite('Default Config', () => {
    test('should export a valid config object', () => {
        assert.ok(defaultConfig);
        assert.strictEqual(typeof defaultConfig, 'object');
    });

    test('should have all required top-level sections', () => {
        assert.ok(defaultConfig.display);
        assert.ok(defaultConfig.keyboard);
        assert.ok(defaultConfig.mouse);
        assert.ok(defaultConfig.sidebar);
        assert.ok(defaultConfig.theme);
        assert.ok(defaultConfig.window);
    });

    test('should have valid display defaults', () => {
        assert.strictEqual(defaultConfig.display.disableGpu, false);
        assert.strictEqual(defaultConfig.display.antialias, false);
        assert.strictEqual(typeof defaultConfig.display.defaultTraceStyle.color, 'string');
        assert.strictEqual(typeof defaultConfig.display.defaultTraceStyle.height, 'number');
        assert.ok(defaultConfig.display.defaultTraceStyle.height > 0);
    });

    test('should have valid keyboard shortcuts', () => {
        const kb = defaultConfig.keyboard;
        assert.strictEqual(typeof kb.reload, 'string');
        assert.strictEqual(typeof kb.addSignal, 'string');
        assert.strictEqual(typeof kb.deleteSignal, 'string');
        assert.strictEqual(typeof kb.zoomIn, 'string');
        assert.strictEqual(typeof kb.zoomOut, 'string');
        assert.strictEqual(typeof kb.zoomFit, 'string');
        assert.strictEqual(typeof kb.zoomAmount, 'number');
    });

    test('should have valid mouse settings', () => {
        assert.strictEqual(typeof defaultConfig.mouse.smoothScrolling, 'boolean');
        assert.strictEqual(typeof defaultConfig.mouse.reverseScrolling, 'boolean');
        assert.strictEqual(typeof defaultConfig.mouse.zoomTarget, 'string');
        assert.strictEqual(typeof defaultConfig.mouse.zoomAmount, 'number');
    });

    test('should have sidebar width > 0', () => {
        assert.ok(defaultConfig.sidebar.width > 0);
    });

    test('should have a non-empty color palette', () => {
        assert.ok(Array.isArray(defaultConfig.theme.palette));
        assert.ok(defaultConfig.theme.palette.length > 0);
        defaultConfig.theme.palette.forEach((color) => {
            assert.ok(color.startsWith('#'), `Color ${color} should start with #`);
        });
    });

    test('should have valid window dimensions', () => {
        assert.ok(defaultConfig.window.width > 0);
        assert.ok(defaultConfig.window.height > 0);
    });

    test('should not contain any license-related fields', () => {
        const configStr = JSON.stringify(defaultConfig);
        assert.ok(!configStr.includes('license'), 'Config should not contain license field');
        assert.ok(!configStr.includes('activation'), 'Config should not contain activation field');
    });

    test('should be deeply clonable without errors', () => {
        const clone = JSON.parse(JSON.stringify(defaultConfig)) as OpenTraceConfig;
        assert.deepStrictEqual(clone, defaultConfig);
    });
});
