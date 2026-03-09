# OpenTrace

OpenTrace is a free, open-source interactive waveform viewer for FPGA/RTL developers. It is a fast and lightweight alternative to the large vendor tools currently available, optimized for small to medium sized designs.

## Features

* Open VCD (value change dump) files directly inside VSCode
* Signal, Bus, Linear, and Stepped render modes
* Multiple display formats (Binary, Octal, Hex, ASCII, etc.)
* Customizable signal colors (with an overrideable palette in config)
* GPU accelerated rendering
* VSCode theme integration
* All features free and unlimited - no license required

## Configuration

Open your `config.opentrace.json` file by clicking on the gear icon in the navigation bar and clicking the `Open Settings (JSON)` button.

* **display**
    * `display.defaultTraceStyle` - Defaults for new traces being added to the window
        * `color` - RGB hex color code (ex. `#00e676`)
        * `fill` - Waveform fill value. Setting to `0` disables fills completely and may improve performance.
        * `radix` - Options: `bin, oct, hex, unsigned, signed, ascii, utf8, float`
        * `renderer` - Options: `line, bus, step, linear`
        * `strokeWidth` - Width of trace lines in pixels. 0.5px multiples are acceptable and may be useful in some scenarios when dealing with anti-aliasing.
    * `display.disableGpu` - Setting `true` disables GPU acceleration
* **keyboard**
    * `keyboard.addSignal` - Hotkey to bring up the signal search menu
    * `keyboard.reload` - Hotkey to reload the waveform after changes have been made
    * `keyboard.zoomAmount` - Multiplier for zooming while using the keyboard shortcuts or buttons on the navigation bar
    * `keyboard.zoomStart` - Hotkey to jump to the beginning of the waveform
    * `keyboard.zoomEnd` - Hotkey to jump to the end of the waveform
    * `keyboard.zoomFit` - Hotkey to fit view zoom to length of the waveform
    * `keyboard.zoomIn` - Hotkey to zoom in (enlarge) waveform. Related: `keyboard.zoomAmount`
    * `keyboard.zoomOut` - Hotkey to zoom out (shrink) waveform. Related: `keyboard.zoomAmount`
    * `keyboard.zoomTarget` - Where to zoom to when clicking the buttons or keyboard shortcuts
        * Set `mouse` - Zoom to the location of the mouse cursor
        * Set `center` - Zoom to the center of viewable region
        * Set `cursor` - Zoom to the location of selected cursor
* **mouse**
    * `mouse.reverseScrolling` - `true` reverses the direction of zooming and panning
    * `mouse.zoomAmount` - Zoom multiplier while scrolling with a mouse
    * `mouse.zoomTarget` - See `keyboard.zoomTarget`
* **theme**
    * `palette` - An array of RGB colors that can be used to quickly assign to traces.

## Development

```bash
npm install
npm run compile
```

Press F5 in VSCode to launch the Extension Development Host.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
