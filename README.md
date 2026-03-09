# OpenTrace

OpenTrace is a free, open-source interactive waveform viewer for FPGA/RTL developers. It is a fast and lightweight alternative to the large vendor tools currently available, optimized for small to medium sized designs.

## Features

- **Multi-format support** - open VCD, FST, and GHW waveform files directly inside VS Code
- **Waveform rendering** - digital, bus, analog (step + linear), and event render modes with GPU-accelerated PIXI.js canvas
- **Multiple display formats** - Binary, Octal, Hex, Signed, Unsigned, ASCII, UTF-8, Float
- **Dual cursors** - primary and secondary cursors with Tab to toggle; delta measurement between them
- **Edge navigation** - jump to next/previous signal edge from the active cursor
- **Box-select zoom** - Ctrl+click drag or middle-click drag to zoom into a time region
- **Bit slicing** - view specific bit ranges of multi-bit signals
- **Signal grouping** - Ctrl+G to group selected signals; drag-and-drop reordering
- **Undo/redo** - Ctrl+Z / Ctrl+Shift+Z for signal list changes
- **Signal hierarchy** - native VS Code TreeView in the activity bar for browsing module hierarchy
- **Streaming file loading** - large files (>4MB) load in chunks with a progress indicator
- **Customizable signal colors** - per-signal colors with an overrideable palette in config
- **VS Code theme integration** - waveform colors adapt to your active theme
- **Terminal link integration** - click file paths in the terminal to open waveforms
- **Verdi-style keybindings** - optional keyboard preset for Verdi users
- **Configurable keyboard shortcuts** - remap all hotkeys via `config.opentrace.json`
- **All features free and unlimited** - no license required

## Configuration

Open your `config.opentrace.json` file by clicking on the gear icon in the navigation bar and clicking the `Open Settings (JSON)` button.

- **display**
    - `display.defaultTraceStyle` - defaults for new traces being added to the window
        - `color` - RGB hex color code (e.g. `#00e676`)
        - `fill` - waveform fill value; `0` disables fills and may improve performance
        - `radix` - options: `bin`, `oct`, `hex`, `unsigned`, `signed`, `ascii`, `utf8`, `float`
        - `renderer` - options: `line`, `bus`, `step`, `linear`
        - `strokeWidth` - line width in pixels (0.5px multiples accepted)
    - `display.disableGpu` - set `true` to disable GPU acceleration
- **keyboard**
    - `keyboard.addSignal` - hotkey to open the signal search menu
    - `keyboard.reload` - hotkey to reload the waveform
    - `keyboard.zoomAmount` - multiplier for keyboard/button zoom
    - `keyboard.zoomStart` - jump to the beginning
    - `keyboard.zoomEnd` - jump to the end
    - `keyboard.zoomFit` - fit view to waveform length
    - `keyboard.zoomIn` - zoom in
    - `keyboard.zoomOut` - zoom out
    - `keyboard.zoomTarget` - zoom anchor: `mouse`, `center`, or `cursor`
    - `keyboard.toggleCursor` - toggle between primary and secondary cursor (default: `tab`)
    - `keyboard.undo` - undo last action
    - `keyboard.redo` - redo last action
    - `keyboard.createGroup` - group selected signals (default: `ctrl+g`)
- **mouse**
    - `mouse.reverseScrolling` - `true` reverses zoom/pan scroll direction
    - `mouse.zoomAmount` - zoom multiplier for mouse scroll
    - `mouse.zoomTarget` - see `keyboard.zoomTarget`
- **theme**
    - `palette` - array of RGB hex colors for quick signal color assignment

## Development

### Prerequisites

This project uses a [Nix flake](https://nixos.wiki/wiki/Flakes) for reproducible development. If you have Nix installed:

```bash
nix develop
```

This provides Node.js, Rust (with `wasm32-unknown-unknown` target), wasm-pack, wasm-bindgen-cli, binaryen, and lld.

Without Nix, install manually: Node.js, Rust with `wasm32-unknown-unknown` target, and [wasm-pack](https://rustwasm.github.io/wasm-pack/).

### Building

```bash
# Install dependencies
npm install
cd webview-app && npm install && cd ..

# Build WASM core (Rust -> WebAssembly -> bundled JS)
npm run build:core

# Build webview (Stencil web components)
npm run build:webview

# Build extension (webpack)
npm run compile
```

Press F5 in VS Code to launch the Extension Development Host.

### Testing

```bash
npm test
```

### Project Structure

```
src/                    Extension host code (TypeScript)
webview-app/            Webview UI (Stencil web components)
media/crate/            WASM core (Rust -> wasm-pack)
media/                  Built webview assets + renderer bridge
schemas/                JSON schema for config.opentrace.json
scripts/                Build utilities
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
