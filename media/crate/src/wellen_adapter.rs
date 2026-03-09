use std::io::Cursor;
use wellen::simple::read_from_reader;
use wellen::{
    Hierarchy, ScopeOrVar, ScopeOrVarRef, SignalEncoding, SignalValue,
    TimescaleUnit,
};

use crate::types::*;
use crate::Radix;

/// Parse raw bytes (VCD, FST, or GHW) using the wellen library.
/// Returns true on success, false on error (with message_str set).
pub(crate) fn parse_with_wellen(input: &[u8], vcd: &mut crate::VCD) -> bool {
    vcd.message_str.clear();

    if input.is_empty() {
        vcd.message_str = "Empty input".to_string();
        return false;
    }

    // Reset state
    vcd.time = 0;
    vcd.signals.clear();
    vcd.scope_nodes.clear();
    vcd.next_uid = 0;

    let cursor = Cursor::new(input.to_vec());

    let mut waveform = match read_from_reader(cursor) {
        Ok(w) => w,
        Err(e) => {
            vcd.message_str = format!("Parse error: {}", e);
            return false;
        }
    };

    // Phase 1: Extract metadata and collect signal refs (immutable borrow of hierarchy)
    let (all_signal_refs, date, version, timescale_mult, timescale_unit) = {
        let hierarchy = waveform.hierarchy();

        let (mult, unit) = if let Some(ts) = hierarchy.timescale() {
            (ts.factor, timescale_unit_to_u32(&ts.unit))
        } else {
            (1, TS_NS)
        };

        let refs: Vec<wellen::SignalRef> = hierarchy
            .iter_vars()
            .map(|v| v.signal_ref())
            .collect();

        (refs, hierarchy.date().to_string(), hierarchy.version().to_string(), mult, unit)
    };

    vcd.date_str = date;
    vcd.version_str = version;
    vcd.timescale_mult_val = timescale_mult;
    vcd.timescale_unit_val = timescale_unit;

    // Phase 2: Load all signals (mutable borrow)
    waveform.load_signals(&all_signal_refs);

    // Phase 3: Walk hierarchy and build scope nodes + signals (immutable borrow again)
    let hierarchy = waveform.hierarchy();
    let time_table = waveform.time_table();

    // Collect top-level items first to avoid borrow issues
    let top_items: Vec<ScopeOrVarRef> = hierarchy.items().collect();
    for item in top_items {
        walk_hierarchy(
            item,
            -1,
            "",
            hierarchy,
            &waveform,
            time_table,
            vcd,
        );
    }

    // Set max time
    if let Some(&last_time) = time_table.last() {
        vcd.time = last_time as u32;
    }

    if vcd.signals.is_empty() {
        vcd.message_str = "No signals found".to_string();
        return false;
    }

    true
}

fn walk_hierarchy(
    item: ScopeOrVarRef,
    parent_uid: i32,
    parent_scope_path: &str,
    hierarchy: &Hierarchy,
    waveform: &wellen::simple::Waveform,
    time_table: &[u64],
    vcd: &mut crate::VCD,
) {
    match item.deref(hierarchy) {
        ScopeOrVar::Scope(scope) => {
            let uid = vcd.next_uid;
            vcd.next_uid += 1;

            let scope_name = scope.name(hierarchy).to_string();
            let scope_path = if parent_scope_path.is_empty() {
                scope_name.clone()
            } else {
                format!("{}.{}", parent_scope_path, scope_name)
            };
            let scope_type = format!("{:?}", scope.scope_type()).to_lowercase();

            if parent_uid >= 0 {
                if let Some(parent) = vcd.scope_nodes.iter_mut().find(|n| n.uid == parent_uid) {
                    parent.children_uids.push(uid);
                }
            }

            vcd.scope_nodes.push(ScopeNode {
                uid,
                name: scope_name,
                scope_path: scope_path.clone(),
                parent_uid,
                children_uids: Vec::new(),
                is_signal: false,
                tid: String::new(),
                kind: scope_type,
                size: 0,
            });

            if let ScopeOrVarRef::Scope(scope_ref) = item {
                let children: Vec<ScopeOrVarRef> = hierarchy[scope_ref].items(hierarchy).collect();
                for child in children {
                    walk_hierarchy(child, uid, &scope_path, hierarchy, waveform, time_table, vcd);
                }
            }
        }
        ScopeOrVar::Var(var) => {
            let uid = vcd.next_uid;
            vcd.next_uid += 1;

            let var_name = var.name(hierarchy).to_string();
            let signal_ref = var.signal_ref();
            let tid = format!("w{}", signal_ref.index());
            let var_type = format!("{:?}", var.var_type()).to_lowercase();
            let var_size = match var.signal_encoding() {
                SignalEncoding::BitVector(n) => n.get(),
                SignalEncoding::Real => 64,
                SignalEncoding::String => 0,
                SignalEncoding::Event => 0,
            };

            if parent_uid >= 0 {
                if let Some(parent) = vcd.scope_nodes.iter_mut().find(|n| n.uid == parent_uid) {
                    parent.children_uids.push(uid);
                }
            }

            vcd.scope_nodes.push(ScopeNode {
                uid,
                name: var_name,
                scope_path: parent_scope_path.to_string(),
                parent_uid,
                children_uids: Vec::new(),
                is_signal: true,
                tid: tid.clone(),
                kind: var_type.clone(),
                size: var_size,
            });

            if !vcd.signals.contains_key(&tid) {
                let mut trace = Vec::new();

                if let Some(signal) = waveform.get_signal(signal_ref) {
                    for (time_idx, value) in signal.iter_changes() {
                        let time = time_table[time_idx as usize] as u32;
                        let value_str = signal_value_to_string(&value);
                        trace.push(TraceEntry { time, value: value_str });
                    }
                }

                let default_radix = if var_type == "real" {
                    Radix::Float as u32
                } else {
                    Radix::Hex as u32
                };

                vcd.signals.insert(tid, Signal {
                    kind: var_type,
                    size: var_size,
                    trace,
                    radix: default_radix,
                });
            }
        }
    }
}

fn signal_value_to_string(value: &SignalValue) -> String {
    match value {
        SignalValue::Real(r) => format!("{}", r),
        SignalValue::String(s) => s.to_string(),
        SignalValue::Event => "1".to_string(),
        SignalValue::Binary(_, _) | SignalValue::FourValue(_, _) | SignalValue::NineValue(_, _) => {
            value.to_bit_string().unwrap_or_else(|| "0".to_string())
        }
    }
}

fn timescale_unit_to_u32(unit: &TimescaleUnit) -> u32 {
    match unit {
        TimescaleUnit::Seconds => TS_S,
        TimescaleUnit::MilliSeconds => TS_MS,
        TimescaleUnit::MicroSeconds => TS_US,
        TimescaleUnit::NanoSeconds => TS_NS,
        TimescaleUnit::PicoSeconds => TS_PS,
        TimescaleUnit::FemtoSeconds => TS_FS,
        _ => TS_NS,
    }
}
