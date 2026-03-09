use crate::radix::*;
use crate::types::*;
use crate::Radix;

pub(crate) fn has_xz(s: &str) -> bool {
    s.contains('x') || s.contains('z') || s.contains('X') || s.contains('Z')
}

pub(crate) fn is_all_same_xz(s: &str) -> Option<char> {
    let lower: String = s.to_lowercase();
    if lower.chars().all(|c| c == 'x') {
        Some('x')
    } else if lower.chars().all(|c| c == 'z') {
        Some('z')
    } else {
        None
    }
}

pub(crate) fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out
}

pub(crate) fn format_label(sig: &Signal, idx: usize, radix: u32) -> String {
    let entry = &sig.trace[idx];
    let val = &entry.value;

    // Single-bit signal
    if sig.size == 1 && sig.kind != "real" {
        return match val.as_str() {
            "0" => "0".to_string(),
            "1" => "1".to_string(),
            "x" | "X" => "x".to_string(),
            "z" | "Z" => "z".to_string(),
            _ => val.clone(),
        };
    }

    // Real signal
    if sig.kind == "real" {
        if radix == Radix::Float as u32 {
            return val.clone();
        }
        // Convert to integer for other radixes
        if let Ok(f) = val.parse::<f64>() {
            let int_val = f as i64;
            return match radix {
                r if r == Radix::Bin as u32 => format!("{:b}", int_val),
                r if r == Radix::Oct as u32 => format!("{:o}", int_val),
                r if r == Radix::Hex as u32 => format!("{:x}", int_val),
                r if r == Radix::Signed as u32 => format!("{}", int_val),
                r if r == Radix::Unsigned as u32 => format!("{}", int_val as u64),
                _ => format!("{}", int_val),
            };
        }
        return val.clone();
    }

    // Multi-bit signal (binary string)
    let bin = val.as_str();

    // Check for x/z in non-binary radixes
    if has_xz(bin) {
        if radix == Radix::Bin as u32 {
            return bin.to_string();
        }
        if let Some(c) = is_all_same_xz(bin) {
            return c.to_string();
        }
        return bin.to_string();
    }

    match radix {
        r if r == Radix::Bin as u32 => bin.to_string(),
        r if r == Radix::Oct as u32 => binary_to_octal(bin),
        r if r == Radix::Hex as u32 => binary_to_hex(bin),
        r if r == Radix::Unsigned as u32 => binary_to_decimal(bin),
        r if r == Radix::Float as u32 => binary_to_decimal(bin),
        r if r == Radix::Signed as u32 => binary_to_signed_decimal(bin, sig.size),
        r if r == Radix::ASCII as u32 => binary_to_ascii(bin),
        r if r == Radix::UTF8 as u32 => binary_to_ascii(bin),
        _ => bin.to_string(),
    }
}
