/**
 * Shared type definitions for the OpenTrace webview application.
 */

// ---------------------------------------------------------------------------
// Signal types  (was the minified enum `wl`)
// ---------------------------------------------------------------------------

export enum SignalType {
  wire = 0,
  reg = 1,
  group = 2,
  module = 3,
  integer = 4,
  real = 5,
  short = 6,
  logic = 7,
  event = 8,
  bit = 9,
  parameter = 10,
  realtime = 11,
  divider = 12,
}

// ---------------------------------------------------------------------------
// Renderer types  (was the minified enum `Tl`)
// ---------------------------------------------------------------------------

export enum RendererType {
  Line = 'line',
  Bus = 'bus',
  AnalogStep = 'step',
  AnalogLinear = 'linear',
  Event = 'event',
}

// ---------------------------------------------------------------------------
// Radix / number-format types  (was the minified enum `El`)
// ---------------------------------------------------------------------------

export enum Radix {
  Bin = 'bin',
  Oct = 'oct',
  Hex = 'hex',
  UnsignedDec = 'unsigned',
  SignedDec = 'signed',
  ASCII = 'ascii',
  UTF8 = 'utf8',
  Float = 'float',
}

// ---------------------------------------------------------------------------
// Signal value states  (was the minified enum `Sl`)
// ---------------------------------------------------------------------------

export enum SignalValue {
  Zero = 0,
  One = 1,
  FallingEdge = 14,
  RisingEdge = 15,
  Invalid = 16,
  HighZ = 17,
}

// ---------------------------------------------------------------------------
// Signal level  (was the minified enum `Il`)
// ---------------------------------------------------------------------------

export enum SignalLevel {
  HIGH = 0,
  LOW = 1,
}

// ---------------------------------------------------------------------------
// Signal display configuration
// ---------------------------------------------------------------------------

export interface SignalDisplay {
  height: number;
  alias: string;
  color: string;
  fill: string | number;
  renderer: string;
  radix: string;
  strokeWidth: number;
  y?: number;
  littleEndian?: boolean;
}

// ---------------------------------------------------------------------------
// Signal descriptor - central data model shared across sidebar components
// ---------------------------------------------------------------------------

export interface Signal {
  id: number;
  vid?: string;
  name: string;
  scope: string;
  type: SignalType;
  size: number;
  display: SignalDisplay;
  children: Signal[];
}

// ---------------------------------------------------------------------------
// Keyboard shortcut map
// ---------------------------------------------------------------------------

export interface KeyboardConfig {
  reload: string;
  createGroup: string;
  addSignal: string;
  deleteSignal: string;
  prevEdge: string;
  nextEdge: string;
  prevSignal: string;
  nextSignal: string;
  moveSignalUp: string;
  moveSignalDown: string;
  selectAll: string;
  undo: string;
  redo: string;
  toggleCursor: string;
  zoomStart: string;
  zoomEnd: string;
  zoomIn: string;
  zoomOut: string;
  zoomFit: string;
  zoomTarget: string;
  zoomAmount: number;
  [key: string]: string | number;
}

// ---------------------------------------------------------------------------
// Mouse settings
// ---------------------------------------------------------------------------

export interface MouseConfig {
  smoothScrolling: boolean;
  reverseScrolling: boolean;
  zoomTarget: string;
  zoomAmount: number;
}

// ---------------------------------------------------------------------------
// Sidebar settings
// ---------------------------------------------------------------------------

export interface SidebarConfig {
  width: number;
}

// ---------------------------------------------------------------------------
// Theme / palette
// ---------------------------------------------------------------------------

export interface ThemeConfig {
  palette: string[];
}

// ---------------------------------------------------------------------------
// Top-level application config  (was the minified global `ql`)
// ---------------------------------------------------------------------------

export interface AppConfig {
  display: {
    disableGpu: boolean;
    antialias: boolean;
    defaultTraceStyle: SignalDisplay;
  };
  keyboard: KeyboardConfig;
  mouse: MouseConfig;
  sidebar: SidebarConfig;
  theme: ThemeConfig;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Zoom target enum  (was the minified enum `hu`)
// ---------------------------------------------------------------------------

export enum ZoomTarget {
  Mouse = 'mouse',
  Cursor = 'cursor',
  Center = 'center',
}

// ---------------------------------------------------------------------------
// Viewport data passed between canvas and nav
// ---------------------------------------------------------------------------

export interface Viewport {
  x: number;
  y: number;
  xscale: number;
  yscale?: number;
  width: number;
  height: number;
  length: number;
  timescale: number;
}
