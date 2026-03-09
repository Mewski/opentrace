/// A single value-change entry for a signal.
#[derive(Clone, Debug)]
pub(crate) struct TraceEntry {
    pub(crate) time: u32,
    pub(crate) value: String,
}

/// Command values matching SignalValue enum on the JS side.
pub(crate) const CMD_ZERO: i32 = 0;
pub(crate) const CMD_ONE: i32 = 1;
pub(crate) const CMD_FALLING: i32 = 14;
pub(crate) const CMD_RISING: i32 = 15;
pub(crate) const CMD_INVALID: i32 = 16;
pub(crate) const CMD_HIGHZ: i32 = 17;

/// A parsed signal definition.
#[derive(Clone, Debug)]
pub(crate) struct Signal {
    pub(crate) kind: String,
    pub(crate) size: u32,
    pub(crate) trace: Vec<TraceEntry>,
    pub(crate) radix: u32,
}

/// A scope node in the hierarchy.
#[derive(Clone, Debug)]
pub(crate) struct ScopeNode {
    pub(crate) uid: i32,
    pub(crate) name: String,
    pub(crate) scope_path: String,
    pub(crate) parent_uid: i32,
    pub(crate) children_uids: Vec<i32>,
    pub(crate) is_signal: bool,
    pub(crate) tid: String,
    pub(crate) kind: String,
    pub(crate) size: u32,
}

// Timescale constants
pub(crate) const TS_S: u32 = 0;
pub(crate) const TS_MS: u32 = 1;
pub(crate) const TS_US: u32 = 2;
pub(crate) const TS_NS: u32 = 3;
pub(crate) const TS_PS: u32 = 4;
pub(crate) const TS_FS: u32 = 5;

pub(crate) fn parse_timescale_str(s: &str) -> (u32, u32) {
    let s = s.trim();
    // Split into numeric prefix and unit suffix
    let mut split_pos = 0;
    for (i, c) in s.char_indices() {
        if c.is_ascii_digit() {
            split_pos = i + c.len_utf8();
        } else {
            break;
        }
    }
    let mult_str = &s[..split_pos];
    let unit_str = s[split_pos..].trim();

    let mult: u32 = mult_str.parse().unwrap_or(1);
    let unit = match unit_str {
        "s" => TS_S,
        "ms" => TS_MS,
        "us" => TS_US,
        "ns" => TS_NS,
        "ps" => TS_PS,
        "fs" => TS_FS,
        _ => TS_NS,
    };
    (mult, unit)
}
