#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building WASM..."
wasm-pack build --target web --out-dir pkg --release

node "$SCRIPT_DIR/../../scripts/bundle-wasm.js"
