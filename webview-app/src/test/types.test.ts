import * as assert from 'assert';
import {
    SignalType,
    RendererType,
    Radix,
    SignalValue,
    ZoomTarget
} from '../utils/types';
import type { Signal, SignalDisplay, Viewport } from '../utils/types';

suite('SignalType enum', () => {
    test('has all expected signal types', () => {
        assert.strictEqual(SignalType.wire, 0);
        assert.strictEqual(SignalType.reg, 1);
        assert.strictEqual(SignalType.group, 2);
        assert.strictEqual(SignalType.module, 3);
        assert.strictEqual(SignalType.integer, 4);
        assert.strictEqual(SignalType.real, 5);
        assert.strictEqual(SignalType.logic, 7);
        assert.strictEqual(SignalType.event, 8);
        assert.strictEqual(SignalType.bit, 9);
        assert.strictEqual(SignalType.parameter, 10);
        assert.strictEqual(SignalType.divider, 12);
    });

    test('numeric values are unique', () => {
        const values = Object.values(SignalType).filter((v) => typeof v === 'number');
        const unique = new Set(values);
        assert.strictEqual(values.length, unique.size, 'SignalType values must be unique');
    });
});

suite('RendererType enum', () => {
    test('has all expected renderer types', () => {
        assert.strictEqual(RendererType.Line, 'line');
        assert.strictEqual(RendererType.Bus, 'bus');
        assert.strictEqual(RendererType.AnalogStep, 'step');
        assert.strictEqual(RendererType.AnalogLinear, 'linear');
        assert.strictEqual(RendererType.Event, 'event');
    });
});

suite('Radix enum', () => {
    test('has all expected radix formats', () => {
        assert.strictEqual(Radix.Bin, 'bin');
        assert.strictEqual(Radix.Oct, 'oct');
        assert.strictEqual(Radix.Hex, 'hex');
        assert.strictEqual(Radix.UnsignedDec, 'unsigned');
        assert.strictEqual(Radix.SignedDec, 'signed');
        assert.strictEqual(Radix.ASCII, 'ascii');
        assert.strictEqual(Radix.UTF8, 'utf8');
        assert.strictEqual(Radix.Float, 'float');
    });

    test('string values are unique', () => {
        const values = Object.values(Radix);
        const unique = new Set(values);
        assert.strictEqual(values.length, unique.size, 'Radix values must be unique');
    });
});

suite('SignalValue enum', () => {
    test('logic values are correct', () => {
        assert.strictEqual(SignalValue.Zero, 0);
        assert.strictEqual(SignalValue.One, 1);
        assert.strictEqual(SignalValue.Invalid, 16);
        assert.strictEqual(SignalValue.HighZ, 17);
    });

    test('edge values are distinct from logic levels', () => {
        assert.ok(SignalValue.FallingEdge > SignalValue.One);
        assert.ok(SignalValue.RisingEdge > SignalValue.One);
        assert.notStrictEqual(SignalValue.FallingEdge, SignalValue.RisingEdge);
    });
});

suite('ZoomTarget enum', () => {
    test('has mouse, cursor, and center targets', () => {
        assert.strictEqual(ZoomTarget.Mouse, 'mouse');
        assert.strictEqual(ZoomTarget.Cursor, 'cursor');
        assert.strictEqual(ZoomTarget.Center, 'center');
    });
});

suite('Signal interface contracts', () => {
    const display: SignalDisplay = {
        height: 24,
        alias: '',
        color: '#00e676',
        fill: 0.2,
        renderer: RendererType.Line,
        radix: Radix.Hex,
        strokeWidth: 2
    };

    test('can create a wire signal', () => {
        const sig: Signal = {
            id: 1,
            vid: 'v0',
            name: 'clk',
            scope: 'top',
            type: SignalType.wire,
            size: 1,
            display,
            children: []
        };
        assert.strictEqual(sig.type, SignalType.wire);
        assert.strictEqual(sig.size, 1);
        assert.strictEqual(sig.children.length, 0);
    });

    test('can create a bus signal', () => {
        const sig: Signal = {
            id: 2,
            vid: 'v1',
            name: 'data',
            scope: 'top.cpu',
            type: SignalType.reg,
            size: 8,
            display: { ...display, renderer: RendererType.Bus },
            children: []
        };
        assert.strictEqual(sig.size, 8);
        assert.strictEqual(sig.display.renderer, 'bus');
    });

    test('can create a signal group with children', () => {
        const child: Signal = {
            id: 10,
            name: 'bit0',
            scope: 'top',
            type: SignalType.wire,
            size: 1,
            display,
            children: []
        };
        const group: Signal = {
            id: 100,
            name: 'mygroup',
            scope: '',
            type: SignalType.group,
            size: 0,
            display,
            children: [child]
        };
        assert.strictEqual(group.type, SignalType.group);
        assert.strictEqual(group.children.length, 1);
        assert.strictEqual(group.children[0].name, 'bit0');
    });

    test('real signals should use Float radix', () => {
        const sig: Signal = {
            id: 3,
            vid: 'v2',
            name: 'voltage',
            scope: 'top.analog',
            type: SignalType.real,
            size: 1,
            display: { ...display, radix: Radix.Float },
            children: []
        };
        assert.strictEqual(sig.display.radix, 'float');
    });
});

suite('Viewport interface', () => {
    test('viewport has required fields', () => {
        const vp: Viewport = {
            x: 0,
            y: 0,
            xscale: 1.0,
            width: 800,
            height: 600,
            length: 10000,
            timescale: 1
        };
        assert.strictEqual(vp.x, 0);
        assert.strictEqual(vp.width, 800);
        assert.strictEqual(vp.length, 10000);
    });

    test('viewport yscale is optional', () => {
        const vp: Viewport = {
            x: 0,
            y: 0,
            xscale: 2.0,
            width: 1024,
            height: 768,
            length: 50000,
            timescale: 1
        };
        assert.strictEqual(vp.yscale, undefined);
    });
});
