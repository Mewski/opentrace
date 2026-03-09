use crate::types::*;
use crate::Radix;

pub(crate) fn parse_vcd(input: &str, vcd: &mut crate::VCD) -> bool {
    vcd.message_str.clear();

    if input.trim().is_empty() {
        vcd.message_str = "Empty input".to_string();
        return false;
    }

    // Reset state for fresh parse
    vcd.time = 0;
    vcd.signals.clear();
    vcd.scope_nodes.clear();
    vcd.next_uid = 0;

    let mut current_time: u32 = 0;
    let mut scope_stack: Vec<i32> = Vec::new();
    let mut in_dumpvars = false;
    let mut found_enddefinitions = false;

    // Tokenize: split on whitespace
    let mut chars = input.chars().peekable();
    let mut tokens: Vec<String> = Vec::new();

    let mut current_token = String::new();
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() {
            if !current_token.is_empty() {
                tokens.push(current_token.clone());
                current_token.clear();
            }
            chars.next();
        } else {
            current_token.push(c);
            chars.next();
        }
    }
    if !current_token.is_empty() {
        tokens.push(current_token);
    }

    let mut i = 0;
    while i < tokens.len() {
        let token = &tokens[i];

        if token.starts_with('#') && found_enddefinitions {
            // Timestamp
            if let Ok(t) = token[1..].parse::<u32>() {
                current_time = t;
                if t > vcd.time {
                    vcd.time = t;
                }
            }
            i += 1;
            continue;
        }

        match token.as_str() {
            "$date" => {
                i += 1;
                let mut content = Vec::new();
                while i < tokens.len() && tokens[i] != "$end" {
                    content.push(tokens[i].clone());
                    i += 1;
                }
                vcd.date_str = content.join(" ");
                if i < tokens.len() {
                    i += 1;
                }
            }
            "$version" => {
                i += 1;
                let mut content = Vec::new();
                while i < tokens.len() && tokens[i] != "$end" {
                    content.push(tokens[i].clone());
                    i += 1;
                }
                vcd.version_str = content.join(" ");
                if i < tokens.len() {
                    i += 1;
                }
            }
            "$timescale" => {
                i += 1;
                let mut content = Vec::new();
                while i < tokens.len() && tokens[i] != "$end" {
                    content.push(tokens[i].clone());
                    i += 1;
                }
                let ts_str = content.join("");
                let (mult, unit) = parse_timescale_str(&ts_str);
                vcd.timescale_mult_val = mult;
                vcd.timescale_unit_val = unit;
                if i < tokens.len() {
                    i += 1;
                }
            }
            "$comment" => {
                i += 1;
                while i < tokens.len() && tokens[i] != "$end" {
                    i += 1;
                }
                if i < tokens.len() {
                    i += 1;
                }
            }
            "$scope" => {
                // $scope <type> <name> $end
                i += 1;
                let _scope_type = if i < tokens.len() {
                    let t = tokens[i].clone();
                    i += 1;
                    t
                } else {
                    String::new()
                };
                let scope_name = if i < tokens.len() {
                    let t = tokens[i].clone();
                    i += 1;
                    t
                } else {
                    String::new()
                };
                // Skip to $end
                while i < tokens.len() && tokens[i] != "$end" {
                    i += 1;
                }
                if i < tokens.len() {
                    i += 1;
                }

                let uid = vcd.next_uid;
                vcd.next_uid += 1;

                let parent_uid = scope_stack.last().copied().unwrap_or(-1);

                // Build scope path
                let scope_path = if parent_uid == -1 {
                    scope_name.clone()
                } else {
                    // Find parent scope path
                    let parent_path = vcd
                        .scope_nodes
                        .iter()
                        .find(|n| n.uid == parent_uid)
                        .map(|n| n.scope_path.clone())
                        .unwrap_or_default();
                    if parent_path.is_empty() {
                        scope_name.clone()
                    } else {
                        format!("{}.{}", parent_path, scope_name)
                    }
                };

                // Add as child of parent
                if parent_uid >= 0 {
                    if let Some(parent) = vcd.scope_nodes.iter_mut().find(|n| n.uid == parent_uid) {
                        parent.children_uids.push(uid);
                    }
                }

                vcd.scope_nodes.push(ScopeNode {
                    uid,
                    name: scope_name,
                    scope_path,
                    parent_uid,
                    children_uids: Vec::new(),
                    is_signal: false,
                    tid: String::new(),
                    kind: String::new(),
                    size: 0,
                });

                scope_stack.push(uid);
            }
            "$upscope" => {
                scope_stack.pop();
                i += 1;
                // Skip to $end
                while i < tokens.len() && tokens[i] != "$end" {
                    i += 1;
                }
                if i < tokens.len() {
                    i += 1;
                }
            }
            "$var" => {
                // $var <type> <size> <tid> <name> [<range>] $end
                i += 1;
                let var_type = if i < tokens.len() {
                    let t = tokens[i].clone();
                    i += 1;
                    t
                } else {
                    String::new()
                };
                let var_size: u32 = if i < tokens.len() {
                    let s = tokens[i].parse().unwrap_or(1);
                    i += 1;
                    s
                } else {
                    1
                };
                let var_tid = if i < tokens.len() {
                    let t = tokens[i].clone();
                    i += 1;
                    t
                } else {
                    String::new()
                };

                // Collect remaining tokens until $end as the name (may include range like [7:0])
                let mut name_parts = Vec::new();
                while i < tokens.len() && tokens[i] != "$end" {
                    name_parts.push(tokens[i].clone());
                    i += 1;
                }
                if i < tokens.len() {
                    i += 1; // skip $end
                }

                let var_name = name_parts.join(" ");

                let parent_uid = scope_stack.last().copied().unwrap_or(-1);
                let uid = vcd.next_uid;
                vcd.next_uid += 1;

                // Build scope path from parent
                let scope_path = if parent_uid >= 0 {
                    vcd.scope_nodes
                        .iter()
                        .find(|n| n.uid == parent_uid)
                        .map(|n| n.scope_path.clone())
                        .unwrap_or_default()
                } else {
                    String::new()
                };

                // Add as child of parent scope
                if parent_uid >= 0 {
                    if let Some(parent) = vcd.scope_nodes.iter_mut().find(|n| n.uid == parent_uid) {
                        parent.children_uids.push(uid);
                    }
                }

                vcd.scope_nodes.push(ScopeNode {
                    uid,
                    name: var_name.clone(),
                    scope_path: scope_path.clone(),
                    parent_uid,
                    children_uids: Vec::new(),
                    is_signal: true,
                    tid: var_tid.clone(),
                    kind: var_type.clone(),
                    size: var_size,
                });

                // Only add signal if not already present (handles aliased signals)
                if !vcd.signals.contains_key(&var_tid) {
                    vcd.signals.insert(
                        var_tid.clone(),
                        Signal {
                            kind: var_type,
                            size: var_size,
                            trace: Vec::new(),
                            radix: Radix::Hex as u32,
                        },
                    );
                }
            }
            "$enddefinitions" => {
                found_enddefinitions = true;
                i += 1;
                while i < tokens.len() && tokens[i] != "$end" {
                    i += 1;
                }
                if i < tokens.len() {
                    i += 1;
                }
            }
            "$dumpvars" => {
                in_dumpvars = true;
                i += 1;
            }
            "$end" => {
                if in_dumpvars {
                    in_dumpvars = false;
                }
                i += 1;
            }
            _ if !found_enddefinitions => {
                // Skip unknown tokens in header
                i += 1;
            }
            _ if token.starts_with('#') => {
                // Timestamp
                if let Ok(t) = token[1..].parse::<u32>() {
                    current_time = t;
                    if t > vcd.time {
                        vcd.time = t;
                    }
                }
                i += 1;
            }
            _ if token.starts_with('b') || token.starts_with('B') => {
                // Binary value change: b<bits> <tid>
                let bits = token[1..].to_string();
                i += 1;
                if i < tokens.len() {
                    let tid = tokens[i].clone();
                    i += 1;
                    if let Some(sig) = vcd.signals.get_mut(&tid) {
                        sig.trace.push(TraceEntry {
                            time: current_time,
                            value: bits,
                        });
                    }
                }
            }
            _ if token.starts_with('r') || token.starts_with('R') => {
                // Real value change: r<value> <tid>
                let real_val = token[1..].to_string();
                i += 1;
                if i < tokens.len() {
                    let tid = tokens[i].clone();
                    i += 1;
                    if let Some(sig) = vcd.signals.get_mut(&tid) {
                        sig.trace.push(TraceEntry {
                            time: current_time,
                            value: real_val,
                        });
                    }
                }
            }
            _ if token.len() >= 2
                && (token.starts_with('0')
                    || token.starts_with('1')
                    || token.starts_with('x')
                    || token.starts_with('X')
                    || token.starts_with('z')
                    || token.starts_with('Z')) =>
            {
                // Single-bit value change: <value><tid>
                let val = token[..1].to_lowercase();
                let tid = token[1..].to_string();
                if let Some(sig) = vcd.signals.get_mut(&tid) {
                    sig.trace.push(TraceEntry {
                        time: current_time,
                        value: val,
                    });
                }
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    if vcd.signals.is_empty() {
        vcd.message_str = "No signals found".to_string();
        return false;
    }

    true
}
