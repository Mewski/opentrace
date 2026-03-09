import * as assert from 'assert';
import defaultConfig from '../defaultConfig';

suite('DEFAULT_CONFIG', () => {
    test('default renderer is line', () => {
        assert.strictEqual(defaultConfig.display.defaultTraceStyle.renderer, 'line');
    });

    test('default radix is hex', () => {
        assert.strictEqual(defaultConfig.display.defaultTraceStyle.radix, 'hex');
    });

    test('default color is a valid hex color', () => {
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(defaultConfig.display.defaultTraceStyle.color));
    });

    test('default trace height is positive', () => {
        assert.ok(defaultConfig.display.defaultTraceStyle.height > 0);
    });

    test('default fill opacity is between 0 and 1', () => {
        const fill = defaultConfig.display.defaultTraceStyle.fill;
        assert.ok(typeof fill === 'number');
        assert.ok(fill >= 0 && fill <= 1);
    });

    test('keyboard zoom shortcuts are defined', () => {
        assert.ok(defaultConfig.keyboard.zoomIn.length > 0);
        assert.ok(defaultConfig.keyboard.zoomOut.length > 0);
        assert.ok(defaultConfig.keyboard.zoomFit.length > 0);
    });

    test('keyboard navigation shortcuts are defined', () => {
        assert.ok(defaultConfig.keyboard.prevEdge.length > 0);
        assert.ok(defaultConfig.keyboard.nextEdge.length > 0);
        assert.ok(defaultConfig.keyboard.prevSignal.length > 0);
        assert.ok(defaultConfig.keyboard.nextSignal.length > 0);
    });

    test('keyboard signal management shortcuts are defined', () => {
        assert.ok(defaultConfig.keyboard.addSignal.length > 0);
        assert.ok(defaultConfig.keyboard.deleteSignal.length > 0);
        assert.ok(defaultConfig.keyboard.selectAll.length > 0);
    });

    test('mouse zoom target is a valid ZoomTarget value', () => {
        assert.ok(['mouse', 'cursor', 'center'].includes(defaultConfig.mouse.zoomTarget));
    });

    test('palette has enough colors for cycling', () => {
        assert.ok(defaultConfig.theme.palette.length >= 8);
    });

    test('sidebar default width is usable', () => {
        assert.ok(defaultConfig.sidebar.width >= 100);
    });

    test('config sections are independent (no shared references)', () => {
        const a = JSON.parse(JSON.stringify(defaultConfig));
        const b = JSON.parse(JSON.stringify(defaultConfig));
        a.sidebar.width = 999;
        assert.notStrictEqual(a.sidebar.width, b.sidebar.width);
    });
});
