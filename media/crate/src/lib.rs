use std::collections::HashMap;
use wasm_bindgen::prelude::*;

mod format;
mod parser;
mod radix;
mod tree;
mod types;

use types::*;

// ---------------------------------------------------------------------------
// Radix enum
// ---------------------------------------------------------------------------

#[wasm_bindgen]
#[repr(u32)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Radix {
    Bin = 0,
    Oct = 1,
    Hex = 2,
    Signed = 3,
    Unsigned = 4,
    ASCII = 5,
    UTF8 = 6,
    Float = 7,
}

// ---------------------------------------------------------------------------
// License (stub)
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct License;

#[wasm_bindgen]
impl License {
    #[wasm_bindgen(constructor)]
    pub fn new() -> License {
        License
    }
}

// ---------------------------------------------------------------------------
// Machine (stub)
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct Machine {
    pub activated: bool,
}

#[wasm_bindgen]
impl Machine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Machine {
        Machine { activated: false }
    }
}

// ---------------------------------------------------------------------------
// VCDNode
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct VCDNode {
    pub uid: i32,
    pub parent: i32,
    pub size: u32,
    #[wasm_bindgen(skip)]
    pub tid_str: String,
    #[wasm_bindgen(skip)]
    pub name_str: String,
    #[wasm_bindgen(skip)]
    pub scope_str: String,
    #[wasm_bindgen(skip)]
    pub kind_str: String,
}

#[wasm_bindgen]
impl VCDNode {
    #[wasm_bindgen(getter)]
    pub fn tid(&self) -> String {
        self.tid_str.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name_str.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn scope(&self) -> String {
        self.scope_str.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind_str.clone()
    }
}

// ---------------------------------------------------------------------------
// VCD struct
// ---------------------------------------------------------------------------

#[wasm_bindgen]
#[allow(private_interfaces)]
pub struct VCD {
    pub time: u32,
    #[wasm_bindgen(skip)]
    pub name_str: String,
    #[wasm_bindgen(skip)]
    pub date_str: String,
    #[wasm_bindgen(skip)]
    pub version_str: String,
    #[wasm_bindgen(skip)]
    pub machine_str: String,
    #[wasm_bindgen(skip)]
    pub message_str: String,
    #[wasm_bindgen(skip)]
    pub timescale_unit_val: u32,
    #[wasm_bindgen(skip)]
    pub timescale_mult_val: u32,
    #[wasm_bindgen(skip)]
    pub signals: HashMap<String, Signal>,
    #[wasm_bindgen(skip)]
    pub scope_nodes: Vec<ScopeNode>,
    #[wasm_bindgen(skip)]
    pub next_uid: i32,
}

#[wasm_bindgen]
impl VCD {
    #[wasm_bindgen(constructor)]
    pub fn new() -> VCD {
        VCD {
            time: 0,
            name_str: String::new(),
            date_str: String::new(),
            version_str: String::new(),
            machine_str: String::new(),
            message_str: String::new(),
            timescale_unit_val: TS_NS,
            timescale_mult_val: 1,
            signals: HashMap::new(),
            scope_nodes: Vec::new(),
            next_uid: 0,
        }
    }

    // -----------------------------------------------------------------------
    // Properties
    // -----------------------------------------------------------------------

    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name_str.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_name(&mut self, val: &str) {
        self.name_str = val.to_string();
    }

    #[wasm_bindgen(getter)]
    pub fn date(&self) -> String {
        self.date_str.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_date(&mut self, val: &str) {
        self.date_str = val.to_string();
    }

    #[wasm_bindgen(getter)]
    pub fn version(&self) -> String {
        self.version_str.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_version(&mut self, val: &str) {
        self.version_str = val.to_string();
    }

    #[wasm_bindgen(getter)]
    pub fn machine(&self) -> String {
        self.machine_str.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_machine(&mut self, val: &str) -> bool {
        self.machine_str = val.to_string();
        true
    }

    #[wasm_bindgen(getter)]
    pub fn message(&self) -> String {
        self.message_str.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn timescale_unit(&self) -> u32 {
        self.timescale_unit_val
    }

    #[wasm_bindgen(getter)]
    pub fn timescale_mult(&self) -> u32 {
        self.timescale_mult_val
    }

    #[wasm_bindgen(setter)]
    pub fn set_timescale(&mut self, val: &str) -> bool {
        let (mult, unit) = parse_timescale_str(val);
        self.timescale_mult_val = mult;
        self.timescale_unit_val = unit;
        true
    }

    // -----------------------------------------------------------------------
    // Methods
    // -----------------------------------------------------------------------

    pub fn verify(&self, input: &str) -> String {
        let mut test = VCD::new();
        if test.parse(input) {
            String::new()
        } else {
            test.message_str
        }
    }

    pub fn nodes(&self) -> String {
        tree::build_nodes_json(&self.scope_nodes)
    }

    pub fn get_trace_cmd(&self, tid: &str, index: u32) -> i32 {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return CMD_ZERO,
        };
        let idx = index as usize;
        if idx >= sig.trace.len() {
            return CMD_ZERO;
        }
        let entry = &sig.trace[idx];

        if sig.size == 1 {
            // Single bit: compute edge-aware command
            let cur = &entry.value;
            let cur_val = match cur.as_str() {
                "0" => CMD_ZERO,
                "1" => CMD_ONE,
                "x" | "X" => CMD_INVALID,
                "z" | "Z" => CMD_HIGHZ,
                _ => CMD_ZERO,
            };

            if idx == 0 {
                return cur_val;
            }

            let prev = &sig.trace[idx - 1].value;
            match (prev.as_str(), cur.as_str()) {
                ("0", "1") => CMD_RISING,
                ("1", "0") => CMD_FALLING,
                (_, "x") | (_, "X") => CMD_INVALID,
                (_, "z") | (_, "Z") => CMD_HIGHZ,
                _ => cur_val,
            }
        } else {
            // Multi-bit: use a simple scheme
            let val = &entry.value;
            if format::has_xz(val) {
                let xz = format::is_all_same_xz(val);
                if xz == Some('z') {
                    CMD_HIGHZ
                } else if xz == Some('x') {
                    CMD_INVALID
                } else {
                    CMD_INVALID
                }
            } else {
                // Check if it changed from previous
                if idx > 0 {
                    let prev_val = &sig.trace[idx - 1].value;
                    if prev_val != val {
                        CMD_RISING
                    } else {
                        CMD_ZERO
                    }
                } else {
                    CMD_ZERO
                }
            }
        }
    }

    pub fn get_trace_time(&self, tid: &str, index: u32) -> u32 {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return 0,
        };
        let idx = index as usize;
        if idx >= sig.trace.len() {
            return 0;
        }
        sig.trace[idx].time
    }

    pub fn get_trace_length(&self, tid: &str) -> u32 {
        match self.signals.get(tid) {
            Some(s) => s.trace.len() as u32,
            None => 0,
        }
    }

    pub fn watch(&mut self, _slot: u32, _tid: &str) {
        // no-op
    }

    pub fn unwatch(&mut self, _slot: u32, _tid: &str) {
        // no-op
    }

    pub fn get_trace_mem(&self, tid: &str) -> Vec<u8> {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return Vec::new(),
        };
        let mut out = Vec::new();
        for entry in &sig.trace {
            out.extend_from_slice(&entry.time.to_le_bytes());
            out.extend_from_slice(entry.value.as_bytes());
            out.push(0);
        }
        out
    }

    pub fn get_trace_data(&self, tid: &str, radix: u32) -> Vec<u8> {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return Vec::new(),
        };
        let mut out = Vec::new();
        for (i, entry) in sig.trace.iter().enumerate() {
            out.extend_from_slice(&entry.time.to_le_bytes());
            let label = format::format_label(sig, i, radix);
            out.extend_from_slice(label.as_bytes());
            out.push(0);
        }
        out
    }

    pub fn get_trace_label(&self, tid: &str, index: u32) -> String {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return String::new(),
        };
        let idx = index as usize;
        if idx >= sig.trace.len() {
            return String::new();
        }
        format::format_label(sig, idx, sig.radix)
    }

    pub fn set_radix(&mut self, tid: &str, radix: u32) {
        if let Some(sig) = self.signals.get_mut(tid) {
            sig.radix = radix;
        }
    }

    pub fn get_trace_index(&self, tid: &str, time: u32) -> Vec<u32> {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return vec![0, 0],
        };
        if sig.trace.is_empty() {
            return vec![0, 0];
        }

        let len = sig.trace.len();

        if time <= sig.trace[0].time {
            return vec![0, 0];
        }
        if time >= sig.trace[len - 1].time {
            let last = (len - 1) as u32;
            return vec![last, last];
        }

        // Binary search for largest index where trace[index].time <= time
        let mut lo: usize = 0;
        let mut hi: usize = len - 1;
        while lo < hi {
            let mid = lo + (hi - lo + 1) / 2;
            if sig.trace[mid].time <= time {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        let found = lo as u32;

        // Nearest: compare lo and lo+1
        let nearest = if lo + 1 < len {
            let d_lo = time.saturating_sub(sig.trace[lo].time);
            let d_hi = sig.trace[lo + 1].time.saturating_sub(time);
            if d_hi < d_lo {
                (lo + 1) as u32
            } else {
                lo as u32
            }
        } else {
            lo as u32
        };

        vec![found, nearest]
    }

    pub fn get_trace_range(&self, tid: &str, start: u32, end: u32) -> Vec<u32> {
        let sig = match self.signals.get(tid) {
            Some(s) => s,
            None => return vec![0, 0],
        };
        if sig.trace.is_empty() {
            return vec![0, 0];
        }

        let len = sig.trace.len();

        // Start index: first index where time >= start
        let start_idx = match sig.trace.binary_search_by(|e| e.time.cmp(&start)) {
            Ok(i) => {
                let mut j = i;
                while j > 0 && sig.trace[j - 1].time == start {
                    j -= 1;
                }
                j
            }
            Err(i) => i.min(len.saturating_sub(1)),
        };

        // End index: last index where time <= end
        let end_idx = match sig.trace.binary_search_by(|e| e.time.cmp(&end)) {
            Ok(i) => {
                let mut j = i;
                while j + 1 < len && sig.trace[j + 1].time == end {
                    j += 1;
                }
                j
            }
            Err(i) => {
                if i == 0 {
                    0
                } else {
                    i - 1
                }
            }
        };

        vec![start_idx as u32, end_idx as u32]
    }

    pub fn trim(&mut self) {
        // no-op
    }

    pub fn get_signal_count(&self) -> u32 {
        self.signals.len() as u32
    }

    pub fn parse(&mut self, input: &str) -> bool {
        parser::parse_vcd(input, self)
    }

    pub fn reset(&mut self) {
        self.time = 0;
        self.name_str.clear();
        self.date_str.clear();
        self.version_str.clear();
        self.machine_str.clear();
        self.message_str.clear();
        self.timescale_unit_val = TS_NS;
        self.timescale_mult_val = 1;
        self.signals.clear();
        self.scope_nodes.clear();
        self.next_uid = 0;
    }

    pub fn clear(&mut self) {
        self.reset();
    }
}
