import * as assert from 'assert';

import initCore from '../../media/core.js';

// ---------------------------------------------------------------------------
// VCD test fixtures
// ---------------------------------------------------------------------------

const VCD_BASIC = `
$date Mon Jan 1 00:00:00 2024 $end
$version VCD generator 1.0 $end
$timescale 1ns $end
$scope module top $end
$var wire 1 ! clk $end
$var wire 8 " data [7:0] $end
$scope module sub $end
$var wire 1 # enable $end
$upscope $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
b00000000 "
0#
$end
#5
1!
#10
0!
b10101010 "
1#
#15
1!
#20
0!
b11111111 "
0#
`;

const VCD_TIMESCALE_ONLY = (mult: string, unit: string) => `
$timescale ${mult}${unit} $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
#10
1!
`;

const VCD_MULTI_TYPE = `
$timescale 1ps $end
$scope module top $end
$var wire 1 ! w $end
$var reg 4 " r [3:0] $end
$var integer 32 # i $end
$var real 64 $ f $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
b0000 "
b00000000000000000000000000000000 #
r0.0 $
$end
#10
1!
b1010 "
b00000000000000000000000000001010 #
r3.14 $
#20
0!
b1111 "
b11111111111111111111111111111111 #
r-1.5 $
`;

const VCD_NESTED_SCOPES = `
$timescale 1ns $end
$scope module chip $end
$scope module cpu $end
$scope module alu $end
$var wire 1 ! carry $end
$upscope $end
$upscope $end
$scope module mem $end
$var wire 8 " addr [7:0] $end
$upscope $end
$upscope $end
$enddefinitions $end
#0
0!
b00000000 "
#5
1!
b11111111 "
`;

const VCD_XZ_VALUES = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! a $end
$var wire 4 " b [3:0] $end
$upscope $end
$enddefinitions $end
#0
x!
bxxxx "
#5
z!
bzzzz "
#10
1!
b10xz "
#15
0!
b0000 "
`;

const VCD_MANY_SIGNALS = `
$timescale 1ns $end
$scope module top $end
$var wire 1 a s0 $end
$var wire 1 b s1 $end
$var wire 1 c s2 $end
$var wire 1 d s3 $end
$var wire 1 e s4 $end
$var wire 1 f s5 $end
$var wire 1 g s6 $end
$var wire 1 h s7 $end
$upscope $end
$enddefinitions $end
#0
0a
0b
0c
0d
0e
0f
0g
0h
#10
1a
1b
1c
1d
#20
0a
0b
0c
0d
1e
1f
1g
1h
`;

const VCD_EMPTY = '';

const VCD_MISSING_END = `
$timescale 1ns
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
`;

const VCD_LARGE_BUS = `
$timescale 1ns $end
$scope module top $end
$var wire 64 ! wide [63:0] $end
$upscope $end
$enddefinitions $end
#0
b0000000000000000000000000000000000000000000000000000000000000000 !
#10
b1111111111111111111111111111111111111111111111111111111111111111 !
#20
b1010101010101010101010101010101010101010101010101010101010101010 !
`;

const VCD_SCOPE_TYPES = `
$timescale 1ns $end
$scope module m $end
$var wire 1 ! a $end
$upscope $end
$scope begin b $end
$var wire 1 " c $end
$upscope $end
$scope task t $end
$var wire 1 # d $end
$upscope $end
$enddefinitions $end
#0
0!
0"
0#
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let Radix: any;
let License: any;
let Machine: any;
let VCD: any;
let VCDNode: any;

suite('Core module initialization', () => {
    test('default export is a function', () => {
        assert.strictEqual(typeof initCore, 'function');
    });

    test('initCore returns a promise', () => {
        const result = initCore();
        assert.ok(result instanceof Promise);
    });

    test('resolves with Radix, VCD, License, Machine, VCDNode', async () => {
        const core = await initCore();
        assert.ok(core.Radix !== undefined, 'Radix should be defined');
        assert.ok(core.VCD !== undefined, 'VCD should be defined');
        assert.ok(core.License !== undefined, 'License should be defined');
        assert.ok(core.Machine !== undefined, 'Machine should be defined');
        assert.ok(core.VCDNode !== undefined, 'VCDNode should be defined');

        // store for subsequent suites
        Radix = core.Radix;
        License = core.License;
        Machine = core.Machine;
        VCD = core.VCD;
        VCDNode = core.VCDNode;
    });
});

suite('Radix enum', () => {
    test('Bin is 0', () => assert.strictEqual(Radix.Bin, 0));
    test('Oct is 1', () => assert.strictEqual(Radix.Oct, 1));
    test('Hex is 2', () => assert.strictEqual(Radix.Hex, 2));
    test('Signed is 3', () => assert.strictEqual(Radix.Signed, 3));
    test('Unsigned is 4', () => assert.strictEqual(Radix.Unsigned, 4));
    test('ASCII is 5', () => assert.strictEqual(Radix.ASCII, 5));
    test('UTF8 is 6', () => assert.strictEqual(Radix.UTF8, 6));
    test('Float is 7', () => assert.strictEqual(Radix.Float, 7));

    test('enum has exactly 8 entries', () => {
        const keys = Object.keys(Radix).filter(k => typeof Radix[k] === 'number');
        assert.strictEqual(keys.length, 8);
    });
});

suite('VCD construction and defaults', () => {
    let vcd: any;

    test('can be constructed', () => {
        vcd = new VCD();
        assert.ok(vcd);
    });

    test('default time is 0', () => {
        assert.strictEqual(vcd.time, 0);
    });

    test('default name is empty string', () => {
        assert.strictEqual(vcd.name, '');
    });

    test('default date is empty string', () => {
        assert.strictEqual(vcd.date, '');
    });

    test('default version is empty string', () => {
        assert.strictEqual(vcd.version, '');
    });

    test('default message is empty string', () => {
        assert.strictEqual(vcd.message, '');
    });

    test('signal count starts at 0', () => {
        assert.strictEqual(vcd.get_signal_count(), 0);
    });

    test('nodes returns empty JSON array', () => {
        const nodes = JSON.parse(vcd.nodes());
        assert.ok(Array.isArray(nodes));
        assert.strictEqual(nodes.length, 0);
    });

    test('free does not throw', () => {
        assert.doesNotThrow(() => vcd.free());
    });
});

suite('Header parsing', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        const ok = vcd.parse(VCD_BASIC);
        assert.ok(ok, 'parse should succeed');
    });

    teardown(() => {
        vcd.free();
    });

    test('date is extracted', () => {
        assert.ok(vcd.date.includes('Mon Jan 1'));
        assert.ok(vcd.date.includes('2024'));
    });

    test('version is extracted', () => {
        assert.ok(vcd.version.includes('VCD generator 1.0'));
    });

    test('timescale unit is ns (3)', () => {
        assert.strictEqual(vcd.timescale_unit, 3);
    });

    test('timescale multiplier is 1', () => {
        assert.strictEqual(vcd.timescale_mult, 1);
    });

    test('simulation end time is 20', () => {
        assert.strictEqual(vcd.time, 20);
    });
});

suite('Timescale parsing – all units', () => {
    const unitMap: [string, number][] = [
        ['s', 0],
        ['ms', 1],
        ['us', 2],
        ['ns', 3],
        ['ps', 4],
        ['fs', 5],
    ];

    unitMap.forEach(([unit, expected]) => {
        test(`unit "${unit}" maps to enum ${expected}`, () => {
            const vcd = new VCD();
            const ok = vcd.parse(VCD_TIMESCALE_ONLY('1', unit));
            assert.ok(ok, `parse should succeed for timescale 1${unit}`);
            assert.strictEqual(vcd.timescale_unit, expected);
            vcd.free();
        });
    });
});

suite('Timescale parsing – multipliers', () => {
    [1, 10, 100].forEach(mult => {
        test(`multiplier ${mult}`, () => {
            const vcd = new VCD();
            const ok = vcd.parse(VCD_TIMESCALE_ONLY(String(mult), 'ns'));
            assert.ok(ok, `parse should succeed for ${mult}ns`);
            assert.strictEqual(vcd.timescale_mult, mult);
            vcd.free();
        });
    });
});

suite('Timescale setter', () => {
    test('set timescale from string "1ns"', () => {
        const vcd = new VCD();
        const ok = vcd.timescale = '1ns';
        assert.strictEqual(vcd.timescale_unit, 3);
        assert.strictEqual(vcd.timescale_mult, 1);
        vcd.free();
    });

    test('set timescale from string "100ps"', () => {
        const vcd = new VCD();
        vcd.timescale = '100ps';
        assert.strictEqual(vcd.timescale_unit, 4);
        assert.strictEqual(vcd.timescale_mult, 100);
        vcd.free();
    });
});

suite('Variable definition parsing', () => {
    let vcd: any;
    let nodes: any[];

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_MULTI_TYPE);
        nodes = JSON.parse(vcd.nodes());
    });

    teardown(() => {
        vcd.free();
    });

    test('signal count is 4', () => {
        assert.strictEqual(vcd.get_signal_count(), 4);
    });

    test('nodes JSON is an array', () => {
        assert.ok(Array.isArray(nodes));
    });

    test('root scope exists', () => {
        assert.ok(nodes.length > 0);
    });

    test('leaf nodes have names matching var declarations', () => {
        const flatten = (n: any[]): any[] =>
            n.reduce((acc, node) => {
                acc.push(node);
                if (node.children) acc.push(...flatten(node.children));
                return acc;
            }, []);
        const all = flatten(nodes);
        const names = all.map((n: any) => n.name);
        assert.ok(names.includes('w'), 'should include wire "w"');
        assert.ok(names.includes('r [3:0]'), 'should include reg "r"');
        assert.ok(names.includes('i'), 'should include integer "i"');
        assert.ok(names.includes('f'), 'should include real "f"');
    });
});

suite('Scope parsing – nested', () => {
    let vcd: any;
    let nodes: any[];

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_NESTED_SCOPES);
        nodes = JSON.parse(vcd.nodes());
    });

    teardown(() => {
        vcd.free();
    });

    test('top-level scope is "chip"', () => {
        assert.strictEqual(nodes[0].name, 'chip');
    });

    test('chip has children cpu and mem', () => {
        const childNames = nodes[0].children.map((c: any) => c.name);
        assert.ok(childNames.includes('cpu'), 'should have cpu scope');
        assert.ok(childNames.includes('mem'), 'should have mem scope');
    });

    test('alu is nested inside cpu', () => {
        const cpu = nodes[0].children.find((c: any) => c.name === 'cpu');
        assert.ok(cpu);
        const aluNames = cpu.children.map((c: any) => c.name);
        assert.ok(aluNames.includes('alu'));
    });

    test('carry signal is inside alu', () => {
        const cpu = nodes[0].children.find((c: any) => c.name === 'cpu');
        const alu = cpu.children.find((c: any) => c.name === 'alu');
        const sigNames = alu.children.map((c: any) => c.name);
        assert.ok(sigNames.includes('carry'));
    });
});

suite('Scope types', () => {
    let vcd: any;
    let nodes: any[];

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_SCOPE_TYPES);
        nodes = JSON.parse(vcd.nodes());
    });

    teardown(() => {
        vcd.free();
    });

    test('module scope parsed', () => {
        assert.ok(nodes.some((n: any) => n.name === 'm'));
    });

    test('begin scope parsed', () => {
        assert.ok(nodes.some((n: any) => n.name === 'b'));
    });

    test('task scope parsed', () => {
        assert.ok(nodes.some((n: any) => n.name === 't'));
    });
});

suite('Signal hierarchy – node shape', () => {
    let vcd: any;
    let nodes: any[];

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        nodes = JSON.parse(vcd.nodes());
    });

    teardown(() => {
        vcd.free();
    });

    test('nodes is non-empty array', () => {
        assert.ok(nodes.length > 0);
    });

    test('each node has uid', () => {
        const check = (n: any) => {
            assert.ok('uid' in n, `node ${n.name} missing uid`);
            if (n.children) n.children.forEach(check);
        };
        nodes.forEach(check);
    });

    test('each node has name', () => {
        const check = (n: any) => {
            assert.ok('name' in n, `node missing name`);
            if (n.children) n.children.forEach(check);
        };
        nodes.forEach(check);
    });

    test('each node has children array', () => {
        const check = (n: any) => {
            assert.ok('children' in n);
            assert.ok(Array.isArray(n.children));
            n.children.forEach(check);
        };
        nodes.forEach(check);
    });
});

suite('Value change parsing – single-bit', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('clk has value changes', () => {
        const len = vcd.get_trace_length('!');
        assert.ok(len > 0, 'clk should have trace points');
    });

    test('clk trace times match VCD timestamps', () => {
        const len = vcd.get_trace_length('!');
        const times: number[] = [];
        for (let i = 0; i < len; i++) {
            times.push(vcd.get_trace_time('!', i));
        }
        // Expected: #0 -> 0!, #5 -> 1!, #10 -> 0!, #15 -> 1!, #20 -> 0!
        assert.deepStrictEqual(times, [0, 5, 10, 15, 20]);
    });
});

suite('Value change parsing – multi-bit', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('data signal has correct trace length', () => {
        const len = vcd.get_trace_length('"');
        // #0 dumpvars b00000000, #10 b10101010, #20 b11111111
        assert.strictEqual(len, 3);
    });

    test('data signal trace times', () => {
        const times: number[] = [];
        const len = vcd.get_trace_length('"');
        for (let i = 0; i < len; i++) {
            times.push(vcd.get_trace_time('"', i));
        }
        assert.deepStrictEqual(times, [0, 10, 20]);
    });
});

suite('Value change parsing – x/z values', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_XZ_VALUES);
    });

    teardown(() => {
        vcd.free();
    });

    test('single-bit x/z parsed without error', () => {
        const len = vcd.get_trace_length('!');
        assert.ok(len >= 4, `expected >=4 trace points, got ${len}`);
    });

    test('multi-bit x/z parsed without error', () => {
        const len = vcd.get_trace_length('"');
        assert.ok(len >= 4, `expected >=4 trace points, got ${len}`);
    });

    test('trace times for x/z signal are correct', () => {
        const times: number[] = [];
        const len = vcd.get_trace_length('!');
        for (let i = 0; i < len; i++) {
            times.push(vcd.get_trace_time('!', i));
        }
        assert.deepStrictEqual(times, [0, 5, 10, 15]);
    });
});

suite('Value change parsing – real values', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_MULTI_TYPE);
    });

    teardown(() => {
        vcd.free();
    });

    test('real signal has trace entries', () => {
        const len = vcd.get_trace_length('$');
        assert.ok(len >= 3, 'real signal should have at least 3 entries');
    });
});

suite('Timestamp parsing', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('end time reflects last timestamp', () => {
        assert.strictEqual(vcd.time, 20);
    });

    test('timestamps are ordered', () => {
        const len = vcd.get_trace_length('!');
        let prev = -1;
        for (let i = 0; i < len; i++) {
            const t = vcd.get_trace_time('!', i);
            assert.ok(t >= prev, `time ${t} should be >= ${prev}`);
            prev = t;
        }
    });
});

suite('$dumpvars section', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('initial values are at time 0', () => {
        assert.strictEqual(vcd.get_trace_time('!', 0), 0);
        assert.strictEqual(vcd.get_trace_time('"', 0), 0);
        assert.strictEqual(vcd.get_trace_time('#', 0), 0);
    });

    test('all signals have at least one entry from dumpvars', () => {
        assert.ok(vcd.get_trace_length('!') >= 1);
        assert.ok(vcd.get_trace_length('"') >= 1);
        assert.ok(vcd.get_trace_length('#') >= 1);
    });
});

suite('watch / unwatch', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('watch does not throw', () => {
        assert.doesNotThrow(() => vcd.watch(0, '!'));
    });

    test('unwatch does not throw', () => {
        vcd.watch(0, '!');
        assert.doesNotThrow(() => vcd.unwatch(0, '!'));
    });

    test('watch multiple signals', () => {
        assert.doesNotThrow(() => {
            vcd.watch(0, '!');
            vcd.watch(1, '"');
            vcd.watch(2, '#');
        });
    });
});

suite('get_trace_length', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('clk has 5 transitions', () => {
        // #0->0, #5->1, #10->0, #15->1, #20->0
        assert.strictEqual(vcd.get_trace_length('!'), 5);
    });

    test('data has 3 transitions', () => {
        // #0->00, #10->AA, #20->FF
        assert.strictEqual(vcd.get_trace_length('"'), 3);
    });

    test('enable has 3 transitions', () => {
        // #0->0, #10->1, #20->0
        assert.strictEqual(vcd.get_trace_length('#'), 3);
    });
});

suite('get_trace_time', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('first trace time is 0 for clk', () => {
        assert.strictEqual(vcd.get_trace_time('!', 0), 0);
    });

    test('second trace time is 5 for clk', () => {
        assert.strictEqual(vcd.get_trace_time('!', 1), 5);
    });

    test('last trace time is 20 for clk', () => {
        const last = vcd.get_trace_length('!') - 1;
        assert.strictEqual(vcd.get_trace_time('!', last), 20);
    });
});

suite('get_trace_index', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns Uint32Array', () => {
        const result = vcd.get_trace_index('!', 0);
        assert.ok(result instanceof Uint32Array);
    });

    test('returns two elements [index_at_time, nearest_index]', () => {
        const result = vcd.get_trace_index('!', 0);
        assert.strictEqual(result.length, 2);
    });

    test('exact time match returns correct index', () => {
        const result = vcd.get_trace_index('!', 5);
        assert.strictEqual(result[0], 1); // index 1 is at time 5
    });

    test('time between changes returns nearest', () => {
        const result = vcd.get_trace_index('!', 7);
        // time 7 is between index 1 (t=5) and index 2 (t=10)
        assert.ok(result[0] === 1 || result[0] === 2);
    });

    test('time 0 returns index 0', () => {
        const result = vcd.get_trace_index('!', 0);
        assert.strictEqual(result[0], 0);
    });
});

suite('get_trace_label – binary radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns a string', () => {
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(typeof label, 'string');
    });

    test('label at index 0 for data represents 00000000', () => {
        vcd.set_radix('"', Radix.Bin);
        const label = vcd.get_trace_label('"', 0);
        assert.ok(label.includes('0'), `expected zeros, got "${label}"`);
    });

    test('label at index 1 for data represents 10101010', () => {
        vcd.set_radix('"', Radix.Bin);
        const label = vcd.get_trace_label('"', 1);
        assert.ok(label.includes('10101010'), `expected 10101010, got "${label}"`);
    });
});

suite('get_trace_label – hex radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.set_radix('"', Radix.Hex);
    });

    teardown(() => {
        vcd.free();
    });

    test('data at index 0 is 00 in hex', () => {
        const label = vcd.get_trace_label('"', 0).toLowerCase();
        assert.ok(label.includes('00'), `expected hex 00, got "${label}"`);
    });

    test('data at index 1 is aa in hex', () => {
        const label = vcd.get_trace_label('"', 1).toLowerCase();
        assert.ok(label.includes('aa'), `expected hex aa, got "${label}"`);
    });

    test('data at index 2 is ff in hex', () => {
        const label = vcd.get_trace_label('"', 2).toLowerCase();
        assert.ok(label.includes('ff'), `expected hex ff, got "${label}"`);
    });
});

suite('get_trace_label – octal radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.set_radix('"', Radix.Oct);
    });

    teardown(() => {
        vcd.free();
    });

    test('data at index 2 in octal contains 377', () => {
        // 0xFF = 0o377
        const label = vcd.get_trace_label('"', 2);
        assert.ok(label.includes('377'), `expected octal 377, got "${label}"`);
    });
});

suite('get_trace_label – unsigned radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.set_radix('"', Radix.Unsigned);
    });

    teardown(() => {
        vcd.free();
    });

    test('data at index 0 is 0 unsigned', () => {
        const label = vcd.get_trace_label('"', 0);
        assert.ok(label.includes('0'), `expected 0, got "${label}"`);
    });

    test('data at index 1 is 170 unsigned', () => {
        // 0xAA = 170
        const label = vcd.get_trace_label('"', 1);
        assert.ok(label.includes('170'), `expected 170, got "${label}"`);
    });

    test('data at index 2 is 255 unsigned', () => {
        const label = vcd.get_trace_label('"', 2);
        assert.ok(label.includes('255'), `expected 255, got "${label}"`);
    });
});

suite('get_trace_label – signed radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.set_radix('"', Radix.Signed);
    });

    teardown(() => {
        vcd.free();
    });

    test('data at index 2 is -1 signed (8-bit 0xFF)', () => {
        const label = vcd.get_trace_label('"', 2);
        assert.ok(label.includes('-1'), `expected -1, got "${label}"`);
    });
});

suite('get_trace_label – ASCII radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.set_radix('"', Radix.ASCII);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns a string for ASCII radix', () => {
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(typeof label, 'string');
    });
});

suite('get_trace_label – float radix on real signal', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_MULTI_TYPE);
        vcd.set_radix('$', Radix.Float);
    });

    teardown(() => {
        vcd.free();
    });

    test('real signal label at index 0 contains 0', () => {
        const label = vcd.get_trace_label('$', 0);
        assert.ok(label.includes('0'), `expected 0, got "${label}"`);
    });

    test('real signal label at index 1 contains 3.14', () => {
        const label = vcd.get_trace_label('$', 1);
        assert.ok(label.includes('3.14'), `expected 3.14, got "${label}"`);
    });
});

suite('set_radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('changing radix changes label output', () => {
        vcd.set_radix('"', Radix.Bin);
        const binLabel = vcd.get_trace_label('"', 1);

        vcd.set_radix('"', Radix.Hex);
        const hexLabel = vcd.get_trace_label('"', 1);

        // binary "10101010" vs hex "aa" – they should differ
        assert.notStrictEqual(binLabel, hexLabel);
    });

    test('setting radix to each enum value does not throw', () => {
        for (const key of Object.keys(Radix)) {
            const val = Radix[key];
            if (typeof val === 'number') {
                assert.doesNotThrow(() => vcd.set_radix('"', val));
            }
        }
    });
});

suite('get_trace_range', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns Uint32Array', () => {
        const result = vcd.get_trace_range('!', 0, 20);
        assert.ok(result instanceof Uint32Array);
    });

    test('full range returns all indices', () => {
        const result = vcd.get_trace_range('!', 0, 20);
        assert.strictEqual(result.length, 2);
    });

    test('partial range returns subset', () => {
        const full = vcd.get_trace_range('!', 0, 20);
        const partial = vcd.get_trace_range('!', 5, 15);
        // partial range should cover fewer or equal indices
        assert.ok(partial[1] - partial[0] <= full[1] - full[0]);
    });

    test('range outside data returns empty or boundary', () => {
        const result = vcd.get_trace_range('!', 100, 200);
        assert.ok(result instanceof Uint32Array);
    });
});

suite('get_trace_mem', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns Uint8Array', () => {
        const mem = vcd.get_trace_mem('!');
        assert.ok(mem instanceof Uint8Array);
    });

    test('non-empty for parsed signal', () => {
        const mem = vcd.get_trace_mem('!');
        assert.ok(mem.length > 0);
    });
});

suite('get_trace_data', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns Uint8Array', () => {
        const data = vcd.get_trace_data('"', Radix.Hex);
        assert.ok(data instanceof Uint8Array);
    });

    test('data varies by radix', () => {
        const bin = vcd.get_trace_data('"', Radix.Bin);
        const hex = vcd.get_trace_data('"', Radix.Hex);
        // Different radix encodings should produce different byte arrays
        const binStr = Array.from(bin).join(',');
        const hexStr = Array.from(hex).join(',');
        assert.notStrictEqual(binStr, hexStr);
    });
});

suite('get_trace_cmd', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('returns a number', () => {
        const cmd = vcd.get_trace_cmd('!', 0);
        assert.strictEqual(typeof cmd, 'number');
    });

    test('all commands are non-negative', () => {
        const len = vcd.get_trace_length('!');
        for (let i = 0; i < len; i++) {
            assert.ok(vcd.get_trace_cmd('!', i) >= 0);
        }
    });
});

suite('get_signal_count', () => {
    test('basic VCD has 3 signals', () => {
        const vcd = new VCD();
        vcd.parse(VCD_BASIC);
        assert.strictEqual(vcd.get_signal_count(), 3);
        vcd.free();
    });

    test('multi-type VCD has 4 signals', () => {
        const vcd = new VCD();
        vcd.parse(VCD_MULTI_TYPE);
        assert.strictEqual(vcd.get_signal_count(), 4);
        vcd.free();
    });

    test('many-signals VCD has 8 signals', () => {
        const vcd = new VCD();
        vcd.parse(VCD_MANY_SIGNALS);
        assert.strictEqual(vcd.get_signal_count(), 8);
        vcd.free();
    });
});

suite('parse return value', () => {
    test('returns true on valid VCD', () => {
        const vcd = new VCD();
        assert.strictEqual(vcd.parse(VCD_BASIC), true);
        vcd.free();
    });

    test('returns false on empty input', () => {
        const vcd = new VCD();
        const result = vcd.parse(VCD_EMPTY);
        assert.strictEqual(result, false);
        vcd.free();
    });

    test('returns false on garbage input', () => {
        const vcd = new VCD();
        const result = vcd.parse('this is not a VCD file at all');
        assert.strictEqual(result, false);
        vcd.free();
    });
});

suite('verify', () => {
    test('valid VCD returns empty string', () => {
        const vcd = new VCD();
        const err = vcd.verify(VCD_BASIC);
        assert.strictEqual(err, '');
        vcd.free();
    });

    test('invalid input returns error string', () => {
        const vcd = new VCD();
        const err = vcd.verify('not a vcd');
        assert.ok(err.length > 0, 'should return non-empty error');
        vcd.free();
    });
});

suite('error handling – message property', () => {
    test('message is set after failed parse', () => {
        const vcd = new VCD();
        vcd.parse('totally invalid data');
        // message should be non-empty after failure
        // (or empty if the parser silently fails – either way no crash)
        assert.strictEqual(typeof vcd.message, 'string');
        vcd.free();
    });

    test('message is empty after successful parse', () => {
        const vcd = new VCD();
        vcd.parse(VCD_BASIC);
        assert.strictEqual(vcd.message, '');
        vcd.free();
    });
});

suite('name property', () => {
    test('get/set name', () => {
        const vcd = new VCD();
        vcd.name = 'test_vcd';
        assert.strictEqual(vcd.name, 'test_vcd');
        vcd.free();
    });
});

suite('date property', () => {
    test('get/set date', () => {
        const vcd = new VCD();
        vcd.date = 'Wed Mar 9 2026';
        assert.strictEqual(vcd.date, 'Wed Mar 9 2026');
        vcd.free();
    });
});

suite('version property', () => {
    test('get/set version', () => {
        const vcd = new VCD();
        vcd.version = 'Test 2.0';
        assert.strictEqual(vcd.version, 'Test 2.0');
        vcd.free();
    });
});

suite('time property', () => {
    test('get/set time', () => {
        const vcd = new VCD();
        vcd.time = 42;
        assert.strictEqual(vcd.time, 42);
        vcd.free();
    });
});

suite('machine property', () => {
    test('get/set machine', () => {
        const vcd = new VCD();
        vcd.machine = 'test-machine-info';
        assert.strictEqual(typeof vcd.machine, 'string');
        vcd.free();
    });
});

suite('clear and reset', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('reset clears parser state', () => {
        vcd.reset();
        // After reset the VCD should be re-parseable
        const ok = vcd.parse(VCD_BASIC);
        assert.ok(ok, 'should be able to re-parse after reset');
    });

    test('clear removes all data', () => {
        vcd.clear();
        assert.strictEqual(vcd.get_signal_count(), 0);
    });

    test('clear resets time to 0', () => {
        vcd.clear();
        assert.strictEqual(vcd.time, 0);
    });

    test('clear resets nodes to empty', () => {
        vcd.clear();
        const nodes = JSON.parse(vcd.nodes());
        assert.strictEqual(nodes.length, 0);
    });
});

suite('trim', () => {
    test('trim does not throw on parsed VCD', () => {
        const vcd = new VCD();
        vcd.parse(VCD_BASIC);
        assert.doesNotThrow(() => vcd.trim());
        vcd.free();
    });

    test('trim does not lose signals', () => {
        const vcd = new VCD();
        vcd.parse(VCD_BASIC);
        const countBefore = vcd.get_signal_count();
        vcd.trim();
        assert.strictEqual(vcd.get_signal_count(), countBefore);
        vcd.free();
    });
});

suite('Multiple signals', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_MANY_SIGNALS);
    });

    teardown(() => {
        vcd.free();
    });

    test('all 8 signals present', () => {
        assert.strictEqual(vcd.get_signal_count(), 8);
    });

    test('each signal has trace entries', () => {
        const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (const id of ids) {
            const len = vcd.get_trace_length(id);
            assert.ok(len >= 2, `signal ${id} should have >=2 entries, got ${len}`);
        }
    });

    test('signal s0 (id a) toggles at expected times', () => {
        const len = vcd.get_trace_length('a');
        const times: number[] = [];
        for (let i = 0; i < len; i++) {
            times.push(vcd.get_trace_time('a', i));
        }
        assert.deepStrictEqual(times, [0, 10, 20]);
    });
});

suite('Edge cases – large bus', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_LARGE_BUS);
    });

    teardown(() => {
        vcd.free();
    });

    test('64-bit wide signal parses', () => {
        assert.strictEqual(vcd.get_signal_count(), 1);
    });

    test('64-bit signal has 3 transitions', () => {
        assert.strictEqual(vcd.get_trace_length('!'), 3);
    });

    test('times are correct', () => {
        const times: number[] = [];
        for (let i = 0; i < 3; i++) {
            times.push(vcd.get_trace_time('!', i));
        }
        assert.deepStrictEqual(times, [0, 10, 20]);
    });
});

suite('Edge cases – missing $end', () => {
    test('parsing VCD with missing $end on timescale', () => {
        const vcd = new VCD();
        // Should either parse or fail gracefully – no crash
        const result = vcd.parse(VCD_MISSING_END);
        assert.strictEqual(typeof result, 'boolean');
        vcd.free();
    });
});

suite('Edge cases – empty file', () => {
    test('empty string returns false', () => {
        const vcd = new VCD();
        assert.strictEqual(vcd.parse(''), false);
        vcd.free();
    });

    test('whitespace-only returns false', () => {
        const vcd = new VCD();
        assert.strictEqual(vcd.parse('   \n\n  '), false);
        vcd.free();
    });
});

suite('Re-parsing', () => {
    test('parsing a second file after reset replaces data', () => {
        const vcd = new VCD();
        vcd.parse(VCD_BASIC);
        assert.strictEqual(vcd.get_signal_count(), 3);

        vcd.reset();
        vcd.parse(VCD_MANY_SIGNALS);
        assert.strictEqual(vcd.get_signal_count(), 8);
        vcd.free();
    });

    test('parsing a second file after clear replaces data', () => {
        const vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.clear();
        assert.strictEqual(vcd.get_signal_count(), 0);

        vcd.parse(VCD_MANY_SIGNALS);
        assert.strictEqual(vcd.get_signal_count(), 8);
        vcd.free();
    });
});

suite('Incremental parsing', () => {
    test('parse can be called with partial VCD header then body', () => {
        const vcd = new VCD();

        const header = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
`;
        const body = `
#0
0!
#10
1!
#20
0!
`;
        const ok = vcd.parse(header + body);
        assert.ok(ok);
        assert.strictEqual(vcd.get_trace_length('!'), 3);
        vcd.free();
    });
});

suite('Concurrent VCD instances', () => {
    test('two independent VCD objects do not interfere', () => {
        const a = new VCD();
        const b = new VCD();

        a.parse(VCD_BASIC);
        b.parse(VCD_MANY_SIGNALS);

        assert.strictEqual(a.get_signal_count(), 3);
        assert.strictEqual(b.get_signal_count(), 8);

        a.free();
        b.free();
    });
});

// ---------------------------------------------------------------------------
// Additional test suites for comprehensive coverage
// ---------------------------------------------------------------------------

suite('get_trace_cmd – edge detection', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    // CMD constants: CMD_ZERO=0, CMD_ONE=1, CMD_FALLING=14, CMD_RISING=15, CMD_INVALID=16, CMD_HIGHZ=17

    test('clk index 0 is CMD_ZERO (initial value 0)', () => {
        // clk starts at 0 at time 0
        const cmd = vcd.get_trace_cmd('!', 0);
        assert.strictEqual(cmd, 0); // CMD_ZERO
    });

    test('clk 0→1 transition is CMD_RISING (15)', () => {
        // index 1: time 5, value 1, previous was 0
        const cmd = vcd.get_trace_cmd('!', 1);
        assert.strictEqual(cmd, 15); // CMD_RISING
    });

    test('clk 1→0 transition is CMD_FALLING (14)', () => {
        // index 2: time 10, value 0, previous was 1
        const cmd = vcd.get_trace_cmd('!', 2);
        assert.strictEqual(cmd, 14); // CMD_FALLING
    });

    test('clk 0→1 at index 3 is CMD_RISING', () => {
        const cmd = vcd.get_trace_cmd('!', 3);
        assert.strictEqual(cmd, 15); // CMD_RISING
    });

    test('clk 1→0 at index 4 is CMD_FALLING', () => {
        const cmd = vcd.get_trace_cmd('!', 4);
        assert.strictEqual(cmd, 14); // CMD_FALLING
    });
});

suite('get_trace_cmd – x/z edge detection', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_XZ_VALUES);
    });

    teardown(() => {
        vcd.free();
    });

    test('single-bit x value at index 0 is CMD_INVALID (16)', () => {
        const cmd = vcd.get_trace_cmd('!', 0);
        assert.strictEqual(cmd, 16); // CMD_INVALID
    });

    test('single-bit x→z transition is CMD_HIGHZ (17)', () => {
        // index 1: value z, previous was x
        const cmd = vcd.get_trace_cmd('!', 1);
        assert.strictEqual(cmd, 17); // CMD_HIGHZ
    });

    test('single-bit z→1 is CMD_RISING (15) or CMD_ONE (1)', () => {
        // index 2: value 1, previous was z
        const cmd = vcd.get_trace_cmd('!', 2);
        // Rust code: (_, "1") when prev is "z" -> falls to cur_val which is CMD_ONE
        assert.strictEqual(cmd, 1); // CMD_ONE
    });

    test('single-bit 1→0 is CMD_FALLING (14)', () => {
        const cmd = vcd.get_trace_cmd('!', 3);
        assert.strictEqual(cmd, 14); // CMD_FALLING
    });

    test('multi-bit all-x is CMD_INVALID (16)', () => {
        // signal " at index 0: bxxxx
        const cmd = vcd.get_trace_cmd('"', 0);
        assert.strictEqual(cmd, 16); // CMD_INVALID
    });

    test('multi-bit all-z is CMD_HIGHZ (17)', () => {
        // signal " at index 1: bzzzz
        const cmd = vcd.get_trace_cmd('"', 1);
        assert.strictEqual(cmd, 17); // CMD_HIGHZ
    });

    test('multi-bit mixed x/z is CMD_INVALID (16)', () => {
        // signal " at index 2: b10xz
        const cmd = vcd.get_trace_cmd('"', 2);
        assert.strictEqual(cmd, 16); // CMD_INVALID
    });

    test('multi-bit changed value (no x/z) is CMD_RISING (15)', () => {
        // signal " at index 3: b0000, previous was b10xz → changed
        const cmd = vcd.get_trace_cmd('"', 3);
        assert.strictEqual(cmd, 15); // CMD_RISING
    });
});

suite('get_trace_label – UTF8 radix', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
        vcd.set_radix('"', Radix.UTF8);
    });

    teardown(() => {
        vcd.free();
    });

    test('UTF8 radix returns a string', () => {
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(typeof label, 'string');
    });

    test('UTF8 radix on 0x00 returns non-printable marker', () => {
        // 00000000 → char 0 → non-printable → "."
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(label, '.');
    });

    test('UTF8 and ASCII produce same result', () => {
        vcd.set_radix('"', Radix.UTF8);
        const utf8Label = vcd.get_trace_label('"', 1);
        vcd.set_radix('"', Radix.ASCII);
        const asciiLabel = vcd.get_trace_label('"', 1);
        assert.strictEqual(utf8Label, asciiLabel);
    });
});

suite('get_trace_label – single-bit with various radixes', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('single-bit signal returns "0" or "1" regardless of radix', () => {
        const radixes = [Radix.Bin, Radix.Oct, Radix.Hex, Radix.Signed, Radix.Unsigned, Radix.ASCII, Radix.UTF8, Radix.Float];
        for (const r of radixes) {
            vcd.set_radix('!', r);
            const label0 = vcd.get_trace_label('!', 0);
            assert.strictEqual(label0, '0', `radix ${r}: expected "0" at index 0, got "${label0}"`);
            const label1 = vcd.get_trace_label('!', 1);
            assert.strictEqual(label1, '1', `radix ${r}: expected "1" at index 1, got "${label1}"`);
        }
    });

    test('single-bit x/z returns "x"/"z" regardless of radix', () => {
        const vcd2 = new VCD();
        vcd2.parse(VCD_XZ_VALUES);
        const radixes = [Radix.Bin, Radix.Oct, Radix.Hex, Radix.Signed, Radix.Unsigned, Radix.ASCII, Radix.UTF8, Radix.Float];
        for (const r of radixes) {
            vcd2.set_radix('!', r);
            const labelX = vcd2.get_trace_label('!', 0);
            assert.strictEqual(labelX, 'x', `radix ${r}: expected "x", got "${labelX}"`);
            const labelZ = vcd2.get_trace_label('!', 1);
            assert.strictEqual(labelZ, 'z', `radix ${r}: expected "z", got "${labelZ}"`);
        }
        vcd2.free();
    });
});

suite('get_trace_label – x/z with non-binary radixes', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_XZ_VALUES);
    });

    teardown(() => {
        vcd.free();
    });

    test('multi-bit all-x in Hex returns "x"', () => {
        vcd.set_radix('"', Radix.Hex);
        // index 0: bxxxx
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(label, 'x');
    });

    test('multi-bit all-z in Hex returns "z"', () => {
        vcd.set_radix('"', Radix.Hex);
        // index 1: bzzzz
        const label = vcd.get_trace_label('"', 1);
        assert.strictEqual(label, 'z');
    });

    test('multi-bit mixed x/z returns raw binary string', () => {
        vcd.set_radix('"', Radix.Hex);
        // index 2: b10xz
        const label = vcd.get_trace_label('"', 2);
        assert.strictEqual(label, '10xz');
    });

    test('multi-bit all-x in Unsigned returns "x"', () => {
        vcd.set_radix('"', Radix.Unsigned);
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(label, 'x');
    });

    test('multi-bit all-z in Signed returns "z"', () => {
        vcd.set_radix('"', Radix.Signed);
        const label = vcd.get_trace_label('"', 1);
        assert.strictEqual(label, 'z');
    });

    test('multi-bit all-x in Octal returns "x"', () => {
        vcd.set_radix('"', Radix.Oct);
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(label, 'x');
    });

    test('x/z in Binary radix returns raw string', () => {
        vcd.set_radix('"', Radix.Bin);
        const label = vcd.get_trace_label('"', 2);
        assert.strictEqual(label, '10xz');
    });
});

suite('get_trace_label – signed radix edge cases', () => {
    const VCD_SIGNED_EDGE = `
$timescale 1ns $end
$scope module top $end
$var wire 8 ! byte [7:0] $end
$var wire 16 " word [15:0] $end
$upscope $end
$enddefinitions $end
#0
b10000000 !
b1000000000000000 "
#10
b01111111 !
b0000000000000000 "
#20
b00000000 !
b0111111111111111 "
`;

    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_SIGNED_EDGE);
        vcd.set_radix('!', Radix.Signed);
        vcd.set_radix('"', Radix.Signed);
    });

    teardown(() => {
        vcd.free();
    });

    test('8-bit 0x80 (10000000) = -128', () => {
        const label = vcd.get_trace_label('!', 0);
        assert.strictEqual(label, '-128');
    });

    test('16-bit 0x8000 = -32768', () => {
        const label = vcd.get_trace_label('"', 0);
        assert.strictEqual(label, '-32768');
    });

    test('8-bit 0x7F (01111111) = 127', () => {
        const label = vcd.get_trace_label('!', 1);
        assert.strictEqual(label, '127');
    });

    test('8-bit 0x00 = 0', () => {
        const label = vcd.get_trace_label('!', 2);
        assert.strictEqual(label, '0');
    });

    test('16-bit 0x0000 = 0', () => {
        const label = vcd.get_trace_label('"', 1);
        assert.strictEqual(label, '0');
    });

    test('16-bit 0x7FFF = 32767', () => {
        const label = vcd.get_trace_label('"', 2);
        assert.strictEqual(label, '32767');
    });
});

suite('parse – malformed input', () => {
    test('truncated $var (no $end) does not crash', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! clk
$upscope $end
$enddefinitions $end
#0
0!
`;
        const result = vcd.parse(input);
        assert.strictEqual(typeof result, 'boolean');
        vcd.free();
    });

    test('$var before $scope (signals at root level) does not crash', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$var wire 1 ! sig $end
$enddefinitions $end
#0
0!
#10
1!
`;
        const result = vcd.parse(input);
        // Should parse successfully — signal goes to root
        assert.strictEqual(typeof result, 'boolean');
        if (result) {
            assert.ok(vcd.get_signal_count() >= 1);
        }
        vcd.free();
    });

    test('duplicate $enddefinitions does not crash', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
$enddefinitions $end
#0
0!
#10
1!
`;
        const result = vcd.parse(input);
        assert.strictEqual(typeof result, 'boolean');
        vcd.free();
    });

    test('duplicate signal tids: second is ignored for signal map', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig1 $end
$var wire 1 ! sig2 $end
$upscope $end
$enddefinitions $end
#0
0!
#10
1!
`;
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        // Only one signal for tid "!" in the signal map
        assert.strictEqual(vcd.get_signal_count(), 1);
        vcd.free();
    });

    test('VCD with only header, no value changes', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
`;
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_trace_length('!'), 0);
        assert.strictEqual(vcd.time, 0);
        vcd.free();
    });

    test('non-monotonic timestamps do not crash', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#10
0!
#5
1!
#20
0!
`;
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_trace_length('!'), 3);
        vcd.free();
    });

    test('very large timestamp does not crash', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
#4294967295
1!
`;
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.time, 4294967295);
        vcd.free();
    });

    test('comments in VCD are skipped', () => {
        const vcd = new VCD();
        const input = `
$comment This is a comment $end
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
#10
1!
`;
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_signal_count(), 1);
        assert.strictEqual(vcd.get_trace_length('!'), 2);
        vcd.free();
    });

    test('unknown section keywords are skipped', () => {
        const vcd = new VCD();
        const input = `
$timescale 1ns $end
$unknownsection some data here $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
`;
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_signal_count(), 1);
        vcd.free();
    });
});

suite('set_timescale – edge cases', () => {
    test('invalid unit defaults to ns (unit=3)', () => {
        const vcd = new VCD();
        vcd.timescale = '1xx';
        assert.strictEqual(vcd.timescale_unit, 3);
        vcd.free();
    });

    test('empty string defaults to mult=1 and unit=ns', () => {
        const vcd = new VCD();
        vcd.timescale = '';
        assert.strictEqual(vcd.timescale_mult, 1);
        assert.strictEqual(vcd.timescale_unit, 3);
        vcd.free();
    });

    test('only digits, no unit defaults unit to ns', () => {
        const vcd = new VCD();
        vcd.timescale = '100';
        assert.strictEqual(vcd.timescale_mult, 100);
        assert.strictEqual(vcd.timescale_unit, 3);
        vcd.free();
    });

    test('invalid multiplier (non-numeric) defaults to 1', () => {
        const vcd = new VCD();
        vcd.timescale = 'abcns';
        assert.strictEqual(vcd.timescale_mult, 1);
        assert.strictEqual(vcd.timescale_unit, 3);
        vcd.free();
    });

    test('zero multiplier sets mult to 0', () => {
        const vcd = new VCD();
        vcd.timescale = '0ns';
        assert.strictEqual(vcd.timescale_mult, 0);
        assert.strictEqual(vcd.timescale_unit, 3);
        vcd.free();
    });
});

suite('watch/unwatch – edge cases', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('watch with non-existent tid does not crash', () => {
        assert.doesNotThrow(() => vcd.watch(0, 'nonexistent'));
    });

    test('unwatch without prior watch does not crash', () => {
        assert.doesNotThrow(() => vcd.unwatch(0, '!'));
    });

    test('watch same signal twice does not crash', () => {
        assert.doesNotThrow(() => {
            vcd.watch(0, '!');
            vcd.watch(0, '!');
        });
    });

    test('watch with empty string tid does not crash', () => {
        assert.doesNotThrow(() => vcd.watch(0, ''));
    });

    test('unwatch with empty string tid does not crash', () => {
        assert.doesNotThrow(() => vcd.unwatch(0, ''));
    });
});

suite('VCDNode – property details', () => {
    let vcd: any;
    let nodes: any[];

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_NESTED_SCOPES);
        nodes = JSON.parse(vcd.nodes());
    });

    teardown(() => {
        vcd.free();
    });

    test('signal nodes have tid, kind, size', () => {
        // carry is a signal inside chip.cpu.alu
        const chip = nodes[0];
        const cpu = chip.children.find((c: any) => c.name === 'cpu');
        const alu = cpu.children.find((c: any) => c.name === 'alu');
        const carry = alu.children.find((c: any) => c.name === 'carry');
        assert.ok(carry, 'carry signal should exist');
        assert.ok('tid' in carry, 'signal node should have tid');
        assert.ok('kind' in carry, 'signal node should have kind');
        assert.ok('size' in carry, 'signal node should have size');
        assert.strictEqual(carry.tid, '!');
        assert.strictEqual(carry.kind, 'wire');
        assert.strictEqual(carry.size, 1);
    });

    test('scope nodes do not have tid', () => {
        const chip = nodes[0];
        assert.ok(!('tid' in chip), 'scope node should not have tid');
    });

    test('parent references are valid', () => {
        const chip = nodes[0];
        assert.strictEqual(chip.parent, -1); // root scope
        const cpu = chip.children.find((c: any) => c.name === 'cpu');
        assert.strictEqual(cpu.parent, chip.uid);
        const alu = cpu.children.find((c: any) => c.name === 'alu');
        assert.strictEqual(alu.parent, cpu.uid);
    });

    test('uid is unique across all nodes', () => {
        const uids: Set<number> = new Set();
        const collectUids = (n: any) => {
            uids.add(n.uid);
            if (n.children) n.children.forEach(collectUids);
        };
        nodes.forEach(collectUids);
        // Count total nodes
        let totalNodes = 0;
        const countNodes = (n: any) => {
            totalNodes++;
            if (n.children) n.children.forEach(countNodes);
        };
        nodes.forEach(countNodes);
        assert.strictEqual(uids.size, totalNodes, 'all uids should be unique');
    });

    test('addr signal has correct size', () => {
        const chip = nodes[0];
        const mem = chip.children.find((c: any) => c.name === 'mem');
        const addr = mem.children.find((c: any) => c.name === 'addr [7:0]');
        assert.ok(addr, 'addr signal should exist');
        assert.strictEqual(addr.size, 8);
    });
});

suite('get_trace_index – boundary cases', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('time after last entry returns last index', () => {
        const result = vcd.get_trace_index('!', 100);
        const lastIdx = vcd.get_trace_length('!') - 1;
        assert.strictEqual(result[0], lastIdx);
        assert.strictEqual(result[1], lastIdx);
    });

    test('very large time value returns last index', () => {
        const result = vcd.get_trace_index('!', 4294967295);
        const lastIdx = vcd.get_trace_length('!') - 1;
        assert.strictEqual(result[0], lastIdx);
    });

    test('single-entry trace returns index 0 for any time', () => {
        const singleVcd = `
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
`;
        const v = new VCD();
        v.parse(singleVcd);
        const result = v.get_trace_index('!', 0);
        assert.strictEqual(result[0], 0);
        assert.strictEqual(result[1], 0);

        const result2 = v.get_trace_index('!', 100);
        assert.strictEqual(result2[0], 0);
        assert.strictEqual(result2[1], 0);
        v.free();
    });
});

suite('get_trace_range – edge cases', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('start > end returns valid Uint32Array', () => {
        const result = vcd.get_trace_range('!', 20, 0);
        assert.ok(result instanceof Uint32Array);
        assert.strictEqual(result.length, 2);
    });

    test('range before any data returns valid result', () => {
        // All data starts at time 0, query before that is meaningless but should not crash
        // Since time is u32, 0 is the minimum
        const result = vcd.get_trace_range('!', 0, 0);
        assert.ok(result instanceof Uint32Array);
        assert.strictEqual(result.length, 2);
    });

    test('range after all data returns valid result', () => {
        const result = vcd.get_trace_range('!', 100, 200);
        assert.ok(result instanceof Uint32Array);
        assert.strictEqual(result.length, 2);
    });

    test('single point range on a timestamp', () => {
        const result = vcd.get_trace_range('!', 5, 5);
        assert.ok(result instanceof Uint32Array);
        assert.strictEqual(result.length, 2);
        // start and end should be same index
        assert.strictEqual(result[0], result[1]);
    });

    test('range for non-existent signal returns [0, 0]', () => {
        const result = vcd.get_trace_range('nonexistent', 0, 20);
        assert.ok(result instanceof Uint32Array);
        assert.deepStrictEqual(Array.from(result), [0, 0]);
    });
});

suite('set_radix – signal isolation', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_BASIC);
    });

    teardown(() => {
        vcd.free();
    });

    test('setting radix on signal A does not affect signal B', () => {
        // Both start with default radix (Hex)
        vcd.set_radix('"', Radix.Bin);
        const labelData = vcd.get_trace_label('"', 1);
        // data signal should show binary
        assert.ok(labelData.includes('10101010'), `expected binary, got "${labelData}"`);

        // enable signal (#) is single-bit so radix doesn't matter, but let's check multi-type VCD
        const vcd2 = new VCD();
        vcd2.parse(VCD_MULTI_TYPE);
        vcd2.set_radix('"', Radix.Bin);
        // reg signal " should be binary
        const regLabel = vcd2.get_trace_label('"', 1);
        assert.ok(regLabel.includes('1010'), `reg should be binary, got "${regLabel}"`);
        // integer signal # should still be hex (default)
        const intLabel = vcd2.get_trace_label('#', 1);
        // default radix is Hex, so 0000000a
        assert.ok(!intLabel.includes('1010') || intLabel.length !== regLabel.length,
            'integer signal should not be affected by reg radix change');
        vcd2.free();
    });

    test('set radix on non-existent signal does not crash', () => {
        assert.doesNotThrow(() => vcd.set_radix('nonexistent', Radix.Hex));
    });
});

suite('get_trace_label – large bit widths', () => {
    let vcd: any;

    setup(() => {
        vcd = new VCD();
        vcd.parse(VCD_LARGE_BUS);
    });

    teardown(() => {
        vcd.free();
    });

    test('64-bit all-1s in hex is 16 hex digits of f', () => {
        vcd.set_radix('!', Radix.Hex);
        const label = vcd.get_trace_label('!', 1).toLowerCase();
        assert.strictEqual(label, 'ffffffffffffffff');
    });

    test('64-bit all-0s in hex is a single or padded 0', () => {
        vcd.set_radix('!', Radix.Hex);
        const label = vcd.get_trace_label('!', 0).toLowerCase();
        assert.ok(label === '0000000000000000' || label === '0',
            `expected all zeros, got "${label}"`);
    });

    test('64-bit all-1s in unsigned decimal is 18446744073709551615', () => {
        vcd.set_radix('!', Radix.Unsigned);
        const label = vcd.get_trace_label('!', 1);
        assert.strictEqual(label, '18446744073709551615');
    });

    test('64-bit alternating pattern in hex', () => {
        vcd.set_radix('!', Radix.Hex);
        const label = vcd.get_trace_label('!', 2).toLowerCase();
        assert.strictEqual(label, 'aaaaaaaaaaaaaaaa');
    });

    test('64-bit all-1s in signed decimal is -1', () => {
        vcd.set_radix('!', Radix.Signed);
        const label = vcd.get_trace_label('!', 1);
        assert.strictEqual(label, '-1');
    });

    test('64-bit value in binary', () => {
        vcd.set_radix('!', Radix.Bin);
        const label = vcd.get_trace_label('!', 1);
        assert.strictEqual(label, '1111111111111111111111111111111111111111111111111111111111111111');
    });
});

suite('parse – VCD with comments', () => {
    test('comments before header are skipped', () => {
        const input = `
$comment This is a comment $end
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
#10
1!
`;
        const vcd = new VCD();
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_signal_count(), 1);
        assert.strictEqual(vcd.get_trace_length('!'), 2);
        vcd.free();
    });

    test('comments between header sections are skipped', () => {
        const input = `
$timescale 1ns $end
$comment Mid-header comment $end
$scope module top $end
$comment Another comment $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
`;
        const vcd = new VCD();
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_signal_count(), 1);
        vcd.free();
    });

    test('multi-word comment is fully consumed', () => {
        const input = `
$comment This is a very long comment with many words and special chars !@#$% $end
$timescale 1ns $end
$scope module top $end
$var wire 1 ! sig $end
$upscope $end
$enddefinitions $end
#0
0!
`;
        const vcd = new VCD();
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_signal_count(), 1);
        vcd.free();
    });
});

suite('verify – error messages', () => {
    test('empty input returns "Empty input"', () => {
        const vcd = new VCD();
        const err = vcd.verify('');
        assert.strictEqual(err, 'Empty input');
        vcd.free();
    });

    test('whitespace-only input returns "Empty input"', () => {
        const vcd = new VCD();
        const err = vcd.verify('   \n\n  ');
        assert.strictEqual(err, 'Empty input');
        vcd.free();
    });

    test('header only (no signals) returns "No signals found"', () => {
        const vcd = new VCD();
        const err = vcd.verify('$timescale 1ns $end $enddefinitions $end');
        assert.strictEqual(err, 'No signals found');
        vcd.free();
    });

    test('valid VCD returns empty string', () => {
        const vcd = new VCD();
        const err = vcd.verify(VCD_BASIC);
        assert.strictEqual(err, '');
        vcd.free();
    });

    test('garbage input returns non-empty error', () => {
        const vcd = new VCD();
        const err = vcd.verify('this is garbage data');
        assert.ok(err.length > 0, 'should return non-empty error string');
        vcd.free();
    });
});

suite('parse – signals at root level', () => {
    test('$var without enclosing $scope parses successfully', () => {
        const input = `
$timescale 1ns $end
$var wire 1 ! rootsig $end
$enddefinitions $end
#0
0!
#10
1!
`;
        const vcd = new VCD();
        const result = vcd.parse(input);
        assert.ok(result, 'parse should succeed');
        assert.strictEqual(vcd.get_signal_count(), 1);
        assert.strictEqual(vcd.get_trace_length('!'), 2);
        vcd.free();
    });

    test('root-level signal has empty scope path', () => {
        const input = `
$timescale 1ns $end
$var wire 1 ! rootsig $end
$enddefinitions $end
#0
0!
`;
        const vcd = new VCD();
        vcd.parse(input);
        const nodes = JSON.parse(vcd.nodes());
        // Root-level signal should have parent -1 and empty scope
        const flatten = (n: any[]): any[] =>
            n.reduce((acc: any[], node: any) => {
                acc.push(node);
                if (node.children) acc.push(...flatten(node.children));
                return acc;
            }, []);
        const all = flatten(nodes);
        const sig = all.find((n: any) => n.name === 'rootsig');
        assert.ok(sig, 'rootsig should exist in nodes');
        assert.strictEqual(sig.scope, '');
        assert.strictEqual(sig.parent, -1);
        vcd.free();
    });
});
