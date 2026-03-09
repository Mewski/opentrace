# Change Log

## 1.0.0 - Initial Release

- Interactive waveform viewer for FPGA/RTL developers
- Multi-format support: VCD, FST, and GHW files
- Waveform rendering: digital, bus, analog (step + linear), and event modes
- GPU-accelerated canvas with PIXI.js and viewport-culled rendering
- Multiple radix formats: Binary, Octal, Hex, Signed, Unsigned, ASCII, UTF-8, Float
- Dual cursors with delta measurement and per-cursor edge navigation
- Box-select zoom (Ctrl+click drag or middle-click drag)
- Bit slicing for multi-bit signals
- Signal grouping (Ctrl+G) and drag-and-drop reordering
- Undo/redo for signal list changes
- Native VS Code TreeView for signal hierarchy browsing
- Streaming/chunked file loading for large files (>4MB) with progress
- Configurable keyboard shortcuts with optional Verdi preset
- Per-signal customizable colors with palette support
- VS Code theme integration
- Terminal link integration
- Per-file settings persistence via `config.opentrace.json`
- JSON schema validation for configuration files
- All features free and unlimited - no license required
