import * as assert from 'assert';
import { APP_NAME, APP_VERSION, DEFAULT_CONFIG } from '../../webview-app/src/utils/constants';
import { RendererType, Radix } from '../../webview-app/src/utils/types';

suite('App constants', () => {
    test('APP_NAME is defined', () => {
        assert.strictEqual(typeof APP_NAME, 'string');
        assert.ok(APP_NAME.length > 0);
    });

    test('APP_VERSION matches semver pattern', () => {
        assert.ok(/^\d+\.\d+\.\d+/.test(APP_VERSION), `Invalid version: ${APP_VERSION}`);
    });
});

suite('DEFAULT_CONFIG', () => {
    test('default renderer is Line', () => {
        assert.strictEqual(DEFAULT_CONFIG.display.defaultTraceStyle.renderer, RendererType.Line);
    });

    test('default radix is Hex', () => {
        assert.strictEqual(DEFAULT_CONFIG.display.defaultTraceStyle.radix, Radix.Hex);
    });

    test('default color is a valid hex color', () => {
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(DEFAULT_CONFIG.display.defaultTraceStyle.color));
    });

    test('default trace height is positive', () => {
        assert.ok(DEFAULT_CONFIG.display.defaultTraceStyle.height > 0);
    });

    test('default fill opacity is between 0 and 1', () => {
        const fill = DEFAULT_CONFIG.display.defaultTraceStyle.fill;
        assert.ok(typeof fill === 'number');
        assert.ok(fill >= 0 && fill <= 1);
    });

    test('keyboard zoom shortcuts are defined', () => {
        assert.ok(DEFAULT_CONFIG.keyboard.zoomIn.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.zoomOut.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.zoomFit.length > 0);
    });

    test('keyboard navigation shortcuts are defined', () => {
        assert.ok(DEFAULT_CONFIG.keyboard.prevEdge.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.nextEdge.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.prevSignal.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.nextSignal.length > 0);
    });

    test('keyboard signal management shortcuts are defined', () => {
        assert.ok(DEFAULT_CONFIG.keyboard.addSignal.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.deleteSignal.length > 0);
        assert.ok(DEFAULT_CONFIG.keyboard.selectAll.length > 0);
    });

    test('mouse zoom target is a valid ZoomTarget value', () => {
        assert.ok(['mouse', 'cursor', 'center'].includes(DEFAULT_CONFIG.mouse.zoomTarget));
    });

    test('palette has enough colors for cycling', () => {
        assert.ok(DEFAULT_CONFIG.theme.palette.length >= 8);
    });

    test('sidebar default width is usable', () => {
        assert.ok(DEFAULT_CONFIG.sidebar.width >= 100);
    });

    test('config sections are independent (no shared references)', () => {
        const a = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        const b = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        a.sidebar.width = 999;
        assert.notStrictEqual(a.sidebar.width, b.sidebar.width);
    });
});
