/// Divide a big number (represented as a vector of u32 limbs, little-endian)
/// by a divisor, returning (quotient, remainder).
pub(crate) fn bigint_divmod(limbs: &[u32], divisor: u32) -> (Vec<u32>, u32) {
    let divisor = divisor as u64;
    let mut quotient = vec![0u32; limbs.len()];
    let mut remainder: u64 = 0;
    for i in (0..limbs.len()).rev() {
        let cur = remainder * (1u64 << 32) + limbs[i] as u64;
        quotient[i] = (cur / divisor) as u32;
        remainder = cur % divisor;
    }
    // Trim leading zeros
    while quotient.len() > 1 && *quotient.last().unwrap() == 0 {
        quotient.pop();
    }
    (quotient, remainder as u32)
}

pub(crate) fn bigint_is_zero(limbs: &[u32]) -> bool {
    limbs.iter().all(|&x| x == 0)
}

/// Convert a binary string (MSB first) to a decimal string.
pub(crate) fn binary_to_decimal(bin: &str) -> String {
    if bin.is_empty() {
        return "0".to_string();
    }
    // Build limbs from binary string (little-endian u32 chunks)
    let bits: Vec<u8> = bin.bytes().map(|b| if b == b'1' { 1 } else { 0 }).collect();
    let n = bits.len();
    let num_limbs = (n + 31) / 32;
    let mut limbs = vec![0u32; num_limbs];
    for (i, &bit) in bits.iter().rev().enumerate() {
        if bit == 1 {
            limbs[i / 32] |= 1 << (i % 32);
        }
    }

    if bigint_is_zero(&limbs) {
        return "0".to_string();
    }

    let mut digits = Vec::new();
    while !bigint_is_zero(&limbs) {
        let (q, r) = bigint_divmod(&limbs, 10);
        digits.push((b'0' + r as u8) as char);
        limbs = q;
    }
    digits.reverse();
    digits.into_iter().collect()
}

/// Convert a binary string to signed decimal using two's complement.
pub(crate) fn binary_to_signed_decimal(bin: &str, size: u32) -> String {
    if bin.is_empty() {
        return "0".to_string();
    }
    // Pad or truncate to size bits
    let padded = if bin.len() < size as usize {
        let pad_char = bin.chars().next().unwrap_or('0');
        let padding: String = std::iter::repeat(pad_char)
            .take(size as usize - bin.len())
            .collect();
        format!("{}{}", padding, bin)
    } else {
        bin[bin.len().saturating_sub(size as usize)..].to_string()
    };

    let msb = padded.chars().next().unwrap_or('0');
    if msb == '1' {
        // Negative: invert bits and add 1
        let inverted: String = padded
            .chars()
            .map(|c| if c == '0' { '1' } else { '0' })
            .collect();
        let dec = binary_to_decimal(&inverted);
        // Add 1 to the inverted decimal
        let val = add_one_to_decimal(&dec);
        format!("-{}", val)
    } else {
        binary_to_decimal(&padded)
    }
}

pub(crate) fn add_one_to_decimal(s: &str) -> String {
    let mut digits: Vec<u8> = s.bytes().map(|b| b - b'0').collect();
    let mut carry = 1u8;
    for d in digits.iter_mut().rev() {
        let sum = *d + carry;
        *d = sum % 10;
        carry = sum / 10;
    }
    if carry > 0 {
        digits.insert(0, carry);
    }
    digits.into_iter().map(|d| (b'0' + d) as char).collect()
}

pub(crate) fn binary_to_octal(bin: &str) -> String {
    if bin.is_empty() {
        return "0".to_string();
    }
    // Pad to multiple of 3
    let pad_len = (3 - (bin.len() % 3)) % 3;
    let padded = format!("{}{}", "0".repeat(pad_len), bin);
    let mut result = String::new();
    for chunk in padded.as_bytes().chunks(3) {
        let val = ((chunk[0] - b'0') as u32) * 4
            + ((chunk[1] - b'0') as u32) * 2
            + ((chunk[2] - b'0') as u32);
        result.push(char::from_digit(val, 10).unwrap());
    }
    // Strip leading zeros but keep at least one digit
    let trimmed = result.trim_start_matches('0');
    if trimmed.is_empty() {
        "0".to_string()
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn binary_to_hex(bin: &str) -> String {
    if bin.is_empty() {
        return "0".to_string();
    }
    // Pad to multiple of 4
    let pad_len = (4 - (bin.len() % 4)) % 4;
    let padded = format!("{}{}", "0".repeat(pad_len), bin);
    let mut result = String::new();
    for chunk in padded.as_bytes().chunks(4) {
        let val = ((chunk[0] - b'0') as u32) * 8
            + ((chunk[1] - b'0') as u32) * 4
            + ((chunk[2] - b'0') as u32) * 2
            + ((chunk[3] - b'0') as u32);
        result.push(char::from_digit(val, 16).unwrap());
    }
    result
}

pub(crate) fn binary_to_ascii(bin: &str) -> String {
    if bin.is_empty() {
        return String::new();
    }
    // Pad to multiple of 8
    let pad_len = (8 - (bin.len() % 8)) % 8;
    let padded = format!("{}{}", "0".repeat(pad_len), bin);
    let mut result = String::new();
    for chunk in padded.as_bytes().chunks(8) {
        let mut val = 0u8;
        for &b in chunk {
            val = (val << 1) | (b - b'0');
        }
        if val >= 0x20 && val < 0x7f {
            result.push(val as char);
        } else {
            result.push('.');
        }
    }
    result
}
