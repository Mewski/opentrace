/**
 * Shared constants for the OpenTrace webview application.
 */

import { AppConfig, Radix, RendererType } from './types';

// ---------------------------------------------------------------------------
// Application metadata
// ---------------------------------------------------------------------------

export const APP_NAME = 'OpenTrace';
export const APP_DESCRIPTION = 'Interactive VCD Waveform Viewer';
export const APP_VERSION = '1.1.2';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: AppConfig = {
  display: {
    disableGpu: false,
    antialias: false,
    defaultTraceStyle: {
      renderer: RendererType.Line,
      color: '#00e676',
      fill: 0.2,
      height: 24,
      radix: Radix.Hex,
      littleEndian: false,
      strokeWidth: 2,
      alias: '',
    },
  },
  keyboard: {
    reload: 'ctrl+r,f5',
    createGroup: 'ctrl+g',
    addSignal: 'shift+a,insert',
    deleteSignal: 'delete',
    prevEdge: 'left',
    nextEdge: 'right',
    prevSignal: 'up',
    nextSignal: 'down',
    moveSignalUp: 'ctrl+up',
    moveSignalDown: 'ctrl+down',
    selectAll: 'ctrl+a',
    undo: 'ctrl+z',
    redo: 'ctrl+shift+z',
    toggleCursor: 'tab',
    zoomStart: 'home',
    zoomEnd: 'end',
    zoomIn: 'pageUp',
    zoomOut: 'pageDown',
    zoomFit: 'f',
    zoomTarget: 'mouse',
    zoomAmount: 100,
  },
  mouse: {
    smoothScrolling: true,
    reverseScrolling: false,
    zoomTarget: 'mouse',
    zoomAmount: 1,
  },
  sidebar: {
    width: 280,
  },
  theme: {
    palette: [
      '#ff1744',
      '#f50057',
      '#d500f9',
      '#651fff',
      '#3d5afe',
      '#2979ff',
      '#00b0ff',
      '#00e5ff',
      '#ff3d00',
      '#ff9100',
      '#ffc400',
      '#ffea00',
      '#c6ff00',
      '#76ff03',
      '#00e676',
      '#1de9b6',
    ],
  },
};

// ---------------------------------------------------------------------------
// Verdi-style EDA keybinding overrides
// ---------------------------------------------------------------------------

export const VERDI_KEYBOARD_CONFIG: Partial<AppConfig['keyboard']> = {
  nextEdge: 'n',
  prevEdge: 'shift+n',
  zoomIn: 'z',
  zoomOut: 'shift+z',
  zoomFit: 'f',
  zoomStart: 'home',
  zoomEnd: 'end',
  selectAll: 'ctrl+a',
  deleteSignal: 'delete',
};

// ---------------------------------------------------------------------------
// Settings tab identifiers
// ---------------------------------------------------------------------------

export type SettingsTab = 'shortcuts' | 'advanced' | 'about';
