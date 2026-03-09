use crate::format::json_escape;
use crate::types::*;
use std::collections::HashMap;

pub(crate) fn node_to_json(
    uid: i32,
    nodes: &[ScopeNode],
    uid_to_idx: &HashMap<i32, usize>,
) -> String {
    let idx = match uid_to_idx.get(&uid) {
        Some(&i) => i,
        None => return "{}".to_string(),
    };
    let node = &nodes[idx];
    let mut s = String::from("{");
    s.push_str(&format!("\"uid\":{}", node.uid));
    s.push_str(&format!(",\"name\":\"{}\"", json_escape(&node.name)));
    s.push_str(&format!(",\"scope\":\"{}\"", json_escape(&node.scope_path)));
    s.push_str(&format!(",\"parent\":{}", node.parent_uid));

    if node.is_signal {
        s.push_str(&format!(",\"tid\":\"{}\"", json_escape(&node.tid)));
        s.push_str(&format!(",\"kind\":\"{}\"", json_escape(&node.kind)));
        s.push_str(&format!(",\"size\":{}", node.size));
    }

    // Children
    s.push_str(",\"children\":[");
    let children_json: Vec<String> = node
        .children_uids
        .iter()
        .map(|&cuid| node_to_json(cuid, nodes, uid_to_idx))
        .collect();
    s.push_str(&children_json.join(","));
    s.push(']');

    s.push('}');
    s
}

pub(crate) fn build_nodes_json(scope_nodes: &[ScopeNode]) -> String {
    if scope_nodes.is_empty() {
        return "[]".to_string();
    }

    // Build a lookup: uid -> index in scope_nodes
    let mut uid_to_idx: HashMap<i32, usize> = HashMap::new();
    for (i, node) in scope_nodes.iter().enumerate() {
        uid_to_idx.insert(node.uid, i);
    }

    // Find root nodes (parent_uid == -1)
    let root_uids: Vec<i32> = scope_nodes
        .iter()
        .filter(|n| n.parent_uid == -1)
        .map(|n| n.uid)
        .collect();

    let mut result = String::from("[");
    let items: Vec<String> = root_uids
        .iter()
        .map(|&uid| node_to_json(uid, scope_nodes, &uid_to_idx))
        .collect();
    result.push_str(&items.join(","));
    result.push(']');
    result
}
