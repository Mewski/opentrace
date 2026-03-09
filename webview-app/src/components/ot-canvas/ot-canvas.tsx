import {
  Component,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Watch,
  Method,
} from '@stencil/core';
import * as PIXI from 'pixi.js';
import { ZoomTarget } from '../../utils/types';
import type { Signal, AppConfig, Viewport as ViewportData } from '../../utils/types';
import { createWaveformRenderer, WaveformSprite } from './waveform-renderer';

// ---------------------------------------------------------------------------
// Viewport – manages pan / zoom state (replaces minified `du`)
// ---------------------------------------------------------------------------

class ViewportState {
  x = 0;
  y = 0;
  width = 1;
  height = 1;
  xscale = 1;
  yscale = 1;
  length = 1;
  timescale = 0;

  set(v: ViewportData): void {
    this.x = v.x;
    this.y = v.y;
    this.xscale = v.xscale;
    this.width = v.width;
    this.height = v.height;
    this.length = v.length;
    this.timescale = v.timescale;
  }

  get(): ViewportData {
    return {
      x: this.x,
      y: this.y,
      xscale: this.xscale,
      yscale: this.yscale,
      width: this.width,
      height: this.height,
      length: this.length,
      timescale: this.timescale,
    };
  }

  goto(ps: number): void {
    const screenRange = this.toPs(0) - this.toPs(this.width);
    let target = ps;
    if (ps < 0) {
      target = this.length - ps + 1;
    }
    this.x = target + screenRange / 2;
  }

  fit(): void {
    this.x = 0;
    this.xscale = this.width / this.length;
  }

  pan(delta: number): void {
    this.x -= (delta / 2) * (1 / this.xscale);
  }

  zoom(delta: number, atPointer: boolean = true, pointerX?: number): void {
    const ref = atPointer ? pointerX! : this.width;
    const psBefore = this.toPs(ref) - this.toPs(0);

    this.xscale *= Math.exp(-delta / 500);
    if (this.xscale > 99) this.xscale = 99;
    if (this.xscale < 0) this.xscale = 1e-10;

    const psAfter = this.toPs(ref) - this.toPs(0);
    this.x -= atPointer ? psAfter - psBefore : (psAfter - psBefore) / 2;
  }

  /** Convert screen-x to picosecond time. */
  toPs(screenX: number): number {
    return (screenX - this.x) * (1 / this.xscale);
  }

  /** Convert picosecond time to screen-x. */
  fromPs(ps: number): number {
    return (ps + this.x) * this.xscale;
  }

  /** Convert a screen pixel coordinate to a time value. */
  screenToPs(px: number): number {
    return Math.round(px * (1 / this.xscale) + this.x);
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }
}

// ---------------------------------------------------------------------------
// Cursor graphics object (replaces minified `lu`)
// ---------------------------------------------------------------------------

class CursorGraphics extends PIXI.Container {
  private gfx: PIXI.Graphics;
  offsetPs = 0;
  private _color: number;
  private _alpha: number;

  constructor(color?: number, alpha?: number) {
    super();
    this.gfx = new PIXI.Graphics();
    this._color = color ?? 0xffffff;
    this._alpha = alpha ?? 1;
    this.addChild(this.gfx);
  }

  draw(viewport: ViewportState): void {
    const cursorWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--cursor-width').trim(),
    );
    this.gfx.clear();

    const xPos = Math.floor(this.offsetPs * viewport.xscale) - 1;
    this.gfx.lineStyle(cursorWidth, this._color, this._alpha, 0, false);
    this.gfx.moveTo(xPos, 0.5);
    this.gfx.lineTo(xPos, (this.parent as PIXI.Container).height);
    this.gfx.lineTo(xPos, 0.5);
  }

  move(ps: number): void {
    this.offsetPs = ps;
  }

  setColor(color: number, alpha?: number): void {
    this._color = color;
    if (alpha !== undefined) this._alpha = alpha;
  }
}

// ---------------------------------------------------------------------------
// Grid / time-axis (replaces minified `cu`)
// ---------------------------------------------------------------------------

interface GridStyle {
  axisBackgroundColor: number;
  axisColor: number;
  axisHeight: number;
  gridColor: number;
  gridDashLength: number;
  gridSpaceLength: number;
  hiddenOpacity: number;
  highlightColor: number;
  textColor: number;
  textSize: number;
  tickColor: number;
}

class GridContainer extends PIXI.Container {
  style: GridStyle = {
    axisBackgroundColor: 0x000000,
    axisColor: 0xffffff,
    axisHeight: 38,
    gridColor: 0x32323d,
    gridDashLength: 2,
    gridSpaceLength: 4,
    hiddenOpacity: 0.45,
    highlightColor: 0x000000,
    textColor: 0xffffff,
    textSize: 20,
    tickColor: 0xffffff,
  };

  bounds = new PIXI.Rectangle(0, 0, 1000, 1000);
  private gfx: PIXI.Graphics;
  private marker: PIXI.Texture | null = null;

  constructor() {
    super();
    this.name = 'grid';
    this.gfx = new PIXI.Graphics();
    this.gfx.name = 'xaxis';
    this.drawXaxis();
    this.addChild(this.gfx);
  }

  /** Helper: read a CSS custom property as a PIXI colour int. */
  private static cssColor(prop: string): number {
    const val = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    // Attempt to parse hex / rgb – fallback to 0.
    if (val.startsWith('#')) {
      return parseInt(val.replace('#', ''), 16);
    }
    return 0;
  }

  private static cssInt(prop: string): number {
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue(prop).trim());
  }

  /** Convert time value to a human-readable string. */
  static timeToString(value: number, timescaleOffset: number = 0): string {
    const units = ['fs', 'ps', 'ns', 'us', 'ms', 's'];
    const sign = value < 0 ? '-' : '';
    value = Math.abs(value);
    if (value === 0) return '0';

    let exp = Math.floor(Math.log(value) / Math.log(1e3));
    if (exp + timescaleOffset > 5) {
      return `${sign}${value} ${units[5]}`;
    }
    return `${sign}${parseFloat((value / Math.pow(1e3, exp)).toFixed(3))} ${units[exp + timescaleOffset]}`;
  }

  draw(viewport: ViewportState, activeSignal?: Signal | null): void {
    this.drawXaxis();
    if (activeSignal) {
      this.drawSignalHighlight(activeSignal);
    }

    // Compute grid spacing based on zoom level.
    let step = Math.round(Math.log10((1 / viewport.xscale) * 100) + 1e-9);
    const stepSize = Math.pow(10, step);
    const screenStep = stepSize * viewport.xscale;

    let offset = (-viewport.x * viewport.xscale) % screenStep;
    let timeVal = Math.round((viewport.x * viewport.xscale + offset) / viewport.xscale);

    const tickChildren = this.children.slice(1);
    for (const child of tickChildren) {
      (child as any).length = this.bounds.height;
      (child as any).setLabel?.(GridContainer.timeToString(timeVal, viewport.timescale));
      child.x = Math.floor(offset) + 0.5;
      child.y = this.style.axisHeight;
      child.alpha = timeVal < 0 || timeVal > viewport.length ? this.style.hiddenOpacity : 1;
      offset += screenStep;
      timeVal += stepSize;
    }
  }

  private drawSignalHighlight(signal: Signal): void {
    const sy = signal.display.y;
    this.gfx.lineStyle(0, this.style.highlightColor);
    this.gfx.beginFill(this.style.highlightColor, 0.2);
    this.gfx.drawRect(0, sy, this.bounds.width, signal.display.height);
    this.gfx.endFill();
  }

  drawXaxis(): void {
    this.gfx.clear();
    this.gfx.beginFill(this.style.axisBackgroundColor, 1);
    this.gfx.drawRect(0, -1.5, this.bounds.width, this.style.axisHeight + 1.5);
    this.gfx.endFill();
    this.gfx.lineStyle(1, this.style.axisColor, 1);
    this.gfx.drawPolygon([
      0,
      this.style.axisHeight + 0.5,
      this.bounds.width,
      this.style.axisHeight + 0.5,
    ]);
  }

  resize(renderer: PIXI.Renderer | PIXI.AbstractRenderer): void {
    this.marker = this.createMarkerTexture(renderer);

    const numTicks = Math.floor((renderer as any).width / 32) + 1;
    if (this.children.length > 1) {
      this.removeChildren(1, this.children.length - 1);
    }
    for (let i = 0; i < numTicks; i++) {
      const tick = new PIXI.Sprite(this.marker!);
      this.addChild(tick);
    }

    this.bounds = new PIXI.Rectangle(0, 0, (renderer as any).width, (renderer as any).height);
    this.drawXaxis();
  }

  reloadStyle(renderer: PIXI.Renderer | PIXI.AbstractRenderer): void {
    this.style = {
      axisBackgroundColor: GridContainer.cssColor('--axis-background'),
      axisColor: GridContainer.cssColor('--axis-line'),
      axisHeight: GridContainer.cssInt('--axis-height'),
      gridColor: GridContainer.cssColor('--grid-line'),
      gridDashLength: GridContainer.cssInt('--grid-dash'),
      gridSpaceLength: GridContainer.cssInt('--grid-space'),
      highlightColor: GridContainer.cssColor('--signal-highlight'),
      hiddenOpacity: 0.45,
      textColor: GridContainer.cssColor('--axis-foreground'),
      textSize: 20,
      tickColor: GridContainer.cssColor('--grid-tick'),
    };
    this.resize(renderer);
  }

  private createMarkerTexture(renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture {
    const gfx = new PIXI.Graphics();
    gfx.lineStyle(1, this.style.tickColor, 1);
    gfx.moveTo(0, -3);
    gfx.lineTo(0, 3);
    gfx.lineStyle(1, this.style.gridColor, 1);
    const span = this.style.gridSpaceLength + this.style.gridDashLength;
    const totalHeight = (renderer as any).height ?? this.bounds.height;
    for (let y = 0; y < totalHeight + span; y += span) {
      gfx.moveTo(0, y);
      gfx.lineTo(0, y + this.style.gridDashLength);
    }
    return (renderer as any).generateTexture(gfx, PIXI.SCALE_MODES.NEAREST, (renderer as any).resolution);
  }
}

// ---------------------------------------------------------------------------
// Global references expected to exist at runtime
// ---------------------------------------------------------------------------

/** The parsed waveform database (replaces minified `Ql`). */
declare const waveformDb: {
  time: number;
  timescale_unit: number;
  get_trace_index(vid: string, time: number): [number, number];
  get_trace_length(vid: string): number;
  get_trace_time(vid: string, index: number): number;
  get_trace_label(vid: string, index: number): string;
} | null;

/** Application-wide configuration (replaces minified `ql`). */
declare const appConfig: AppConfig;

/** Keyboard-shortcut binding helper (replaces minified `$l`). */
declare function bindKey(combo: string, handler: () => void): void;
declare function unbindKey(combo: string): void;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  tag: 'ot-canvas',
  styleUrl: 'ot-canvas.css',
  shadow: false,  // Original uses createRenderRoot() { return this; }
})
export class OtCanvas {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props
  /** Application configuration (keyboard, mouse, display settings). */
  @Prop() config?: AppConfig;

  /** Whether the backing waveform file has changed on disk. */
  @Prop() fileChanged: boolean = false;

  /** Map of signal id -> signal metadata, keyed by numeric id. */
  @Prop() signals!: Map<number, Signal> | null;

  // ------------------------------------------------------------------ State
  @State() private ready: boolean = false;
  @State() private activeSignal: Signal | null = null;

  // ----------------------------------------------------------------- Events
  /** Emitted when the cursor moves, carrying the value at the cursor for each signal. */
  @Event({ eventName: 'setCursor', bubbles: true, composed: true })
  setCursorEvent!: EventEmitter<Record<string, string>>;

  /** Emitted when the user requests the settings panel. */
  @Event({ bubbles: true, composed: true }) settings!: EventEmitter<void>;

  // --------------------------------------------------------------- Internals
  private _signalDict: Map<number, Signal> = new Map();
  viewport: ViewportState = new ViewportState();

  private app!: PIXI.Application;
  private grid!: GridContainer;
  private cursor!: CursorGraphics;
  private cursor2!: CursorGraphics;
  private activeCursor: 1 | 2 = 1;
  private waveforms!: PIXI.Container;
  private graph!: PIXI.Container;
  private mask!: PIXI.Graphics;

  // Box-select zoom state
  private boxSelectActive: boolean = false;
  private boxSelectStartX: number = 0;
  private boxSelectOverlay!: PIXI.Graphics;

  // ------------------------------------------------------------ Lifecycle

  connectedCallback() {
    window.addEventListener('resize', this.handleResize);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.handleResize);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', this.handleResize);

    this.el.onpointerdown = (e: PointerEvent) => {
      // Ctrl+click or middle-click starts box-select zoom
      if (e.ctrlKey || e.button === 1) {
        this.startBoxSelect(e.offsetX);
        e.preventDefault();
        return;
      }
      this.handleSetCursor(e.offsetX);
    };
    this.el.onpointermove = (e: PointerEvent) => {
      if (this.boxSelectActive) {
        this.updateBoxSelect(e.offsetX);
        return;
      }
      if (e.buttons & 1) this.handleSetCursor(e.offsetX);
    };
    this.el.onpointerup = (e: PointerEvent) => {
      if (this.boxSelectActive) {
        this.endBoxSelect(e.offsetX);
      }
    };

    this.el.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.shiftKey) {
          const delta = appConfig.mouse.reverseScrolling
            ? -(e.deltaY + e.deltaX)
            : e.deltaY + e.deltaX;
          this.viewport.pan(delta);
        } else {
          this.viewport.zoom(
            e.deltaY * appConfig.mouse.zoomAmount,
            appConfig.mouse.zoomTarget === ZoomTarget.Mouse,
            e.offsetX,
          );
        }
        this.draw();
      },
      { passive: true },
    );
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
  }

  componentDidLoad() {
    this.init();
    this.ready = true;
  }

  componentDidUpdate() {
    this.draw();
  }

  // --------------------------------------------------------------- Init

  private init(): void {
    PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;

    this.app = new PIXI.Application({
      resizeTo: this.el,
      antialias: appConfig.display.antialias,
      autoDensity: true,
      transparent: true,
      autoStart: false,
      forceCanvas: appConfig.display.disableGpu,
      resolution: window.devicePixelRatio || 1,
    } as any);

    this.app.ticker.stop();
    PIXI.Ticker.shared.stop();
    PIXI.Ticker.system.stop();

    // Prepend the PIXI canvas view as first child.
    this.el.prepend(this.app.view as HTMLCanvasElement);

    this.grid = new GridContainer();
    this.cursor = new CursorGraphics(0xffffff, 1);
    this.cursor2 = new CursorGraphics(0x40c4ff, 0.7);
    this.waveforms = new PIXI.Container();
    this.graph = new PIXI.Container();
    this.graph.addChild(this.waveforms);

    this.mask = new PIXI.Graphics();
    this.boxSelectOverlay = new PIXI.Graphics();
    this.boxSelectOverlay.visible = false;

    this.app.stage.addChild(this.mask);
    this.app.stage.addChild(this.grid as any);
    this.app.stage.addChild(this.graph);
    this.app.stage.addChild(this.cursor2 as any);
    this.app.stage.addChild(this.cursor as any);
    this.app.stage.addChild(this.boxSelectOverlay);

    this.graph.mask = this.mask;
    (this.cursor as any).y = this.grid.style.axisHeight;
    (this.cursor as any).height = this.app.screen.height;
    (this.cursor2 as any).y = this.grid.style.axisHeight;
    (this.cursor2 as any).height = this.app.screen.height;

    this.resize();
    this.bindKeyboardShortcuts();
  }

  // --------------------------------------------------------------- Render

  render() {
    return (
      <ot-canvas-nav
        id="ot-canvas-nav-0"
        fileChanged={this.fileChanged}
        onChange={(e: CustomEvent) => this.updateViewport(e)}
      />
    );
  }

  // ---------------------------------------------------------- Signal dict

  @Watch('signals')
  onSignalsChanged(newVal: Map<number, Signal> | null) {
    if (!newVal) return;
    for (const [id, signal] of newVal.entries()) {
      if (this._signalDict.has(id)) {
        this._signalDict.set(id, signal);
      } else {
        this._signalDict.set(id, signal);
        // Create a new waveform child for new signals.
        // In the original this used `new Al(signal)` – a waveform renderer.
        // Implementations would instantiate the correct PIXI display object here.
        const waveform = this.createWaveformSprite(signal);
        this.waveforms.addChild(waveform);
        (waveform as any).draw?.(this.viewport);
      }
    }
    this.draw(false);
  }

  /**
   * Create a PIXI display object for a single signal trace.
   * Uses the appropriate renderer based on signal type and display settings.
   */
  private createWaveformSprite(signal: Signal): WaveformSprite {
    return createWaveformRenderer(signal);
  }

  // -------------------------------------------------- Public API methods

  /** Rebind keyboard shortcuts after config change. */
  @Method()
  async input() {
    this.bindKeyboardShortcuts();
  }

  /** Remove one or more signals by id. Accepts Signal objects or numeric ids. */
  @Method()
  async delete(...items: (Signal | number)[]) {
    for (const item of items) {
      try {
        const id = typeof item === 'number' ? item : item.id;
        const child = this.waveforms.getChildByName(id.toString());
        if (child) {
          const idx = this.waveforms.getChildIndex(child);
          this.waveforms.removeChildAt(idx);
        }
        this._signalDict.delete(id);
      } catch (_) {
        // Ignore missing children.
      }
    }
    this.draw();
  }

  /** Set the currently-highlighted / active signal. */
  @Method()
  async setActiveSignal(id: number) {
    if (this._signalDict.has(id)) {
      this.activeSignal = this._signalDict.get(id)!;
    } else {
      this.activeSignal = null;
    }
    this.draw();
  }

  /** Clear the active-signal highlight. */
  @Method()
  async clearActive() {
    this.activeSignal = null;
    this.draw();
  }

  /** Navigate to the next edge of the active signal. */
  @Method()
  async nextEdge() {
    if (!this.activeSignal || !waveformDb) return;

    const cursorObj = this.activeCursor === 1 ? this.cursor : this.cursor2;
    let [, idx] = waveformDb.get_trace_index(this.activeSignal.vid, cursorObj.offsetPs);
    if (idx < 0) return;
    idx += 1;
    if (idx >= waveformDb.get_trace_length(this.activeSignal.vid)) return;

    const time = waveformDb.get_trace_time(this.activeSignal.vid, idx);
    this.moveCursor(time);

    const leftPs = this.viewport.screenToPs(0);
    const rightPs = this.viewport.screenToPs(this.viewport.width);
    const half = (rightPs - leftPs) / 2;

    if (time >= rightPs) {
      this.viewport.x = time - half;
    }
    this.draw();
  }

  /** Navigate to the previous edge of the active signal. */
  @Method()
  async prevEdge() {
    if (!this.activeSignal || !waveformDb) return;

    const cursorObj = this.activeCursor === 1 ? this.cursor : this.cursor2;
    let [, idx] = waveformDb.get_trace_index(this.activeSignal.vid, cursorObj.offsetPs);
    if (idx <= 0) return;
    idx -= 1;

    const time = waveformDb.get_trace_time(this.activeSignal.vid, idx);
    this.moveCursor(time);

    const leftPs = this.viewport.screenToPs(0);
    const half = (this.viewport.screenToPs(this.viewport.width) - leftPs) / 2;

    if (time <= leftPs) {
      this.viewport.x = time - half;
    }
    this.draw();
  }

  /** Re-evaluate cursor values without moving it. */
  @Method()
  async updateCursor() {
    this.handleSetCursor();
  }

  /** Toggle between primary and secondary cursor. */
  @Method()
  async toggleActiveCursor() {
    this.activeCursor = this.activeCursor === 1 ? 2 : 1;
    // Update cursor colors to show which is active
    if (this.activeCursor === 1) {
      this.cursor.setColor(0xffffff, 1);
      this.cursor2.setColor(0x40c4ff, 0.7);
    } else {
      this.cursor.setColor(0xffffff, 0.7);
      this.cursor2.setColor(0x40c4ff, 1);
    }
    this.draw();
  }

  /** Get the time delta between the two cursors. */
  @Method()
  async getCursorDelta(): Promise<number> {
    return Math.abs(this.cursor.offsetPs - this.cursor2.offsetPs);
  }

  /** Get position of both cursors. */
  @Method()
  async getCursorPositions(): Promise<{ primary: number; secondary: number }> {
    return { primary: this.cursor.offsetPs, secondary: this.cursor2.offsetPs };
  }

  // -------------------------------------------------------- Drawing

  private draw(redrawWaveforms: boolean = false): void {
    if (!this.graph) return;

    if (waveformDb) {
      this.viewport.length = waveformDb.time;
      this.viewport.timescale = waveformDb.timescale_unit;
    }

    this.graph.x = Math.ceil(-this.viewport.x * this.viewport.xscale);
    (this.cursor as any).x = this.graph.x;
    (this.cursor2 as any).x = this.graph.x;

    for (const child of this.waveforms.children) {
      (child as any).draw?.(this.viewport, !redrawWaveforms);
    }

    this.grid.draw(this.viewport, this.activeSignal);
    this.cursor.draw(this.viewport);
    this.cursor2.draw(this.viewport);
    this.app.renderer.render(this.app.stage);

    // Push viewport state to the nav bar.
    const nav = this.el.querySelector('#ot-canvas-nav-0') as any;
    if (nav) {
      nav.setViewport?.(this.viewport.get());
    }
  }

  // ------------------------------------------------- Viewport updates

  private updateViewport = (evt: CustomEvent<{ cmd: string; value?: number }>) => {
    const { cmd, value } = evt.detail;
    switch (cmd) {
      case 'zoom_in':
        this.viewport.zoom(appConfig.keyboard.zoomAmount, false, (this.cursor as any).x);
        break;
      case 'zoom_out':
        this.viewport.zoom(-appConfig.keyboard.zoomAmount, false, (this.cursor as any).x);
        break;
      case 'zoom_fit':
        this.viewport.fit();
        break;
      case 'goto':
        this.viewport.goto(value!);
        break;
    }
    this.draw();
  };

  // ---------------------------------------------------- Cursor logic

  /** Move the active cursor to a specific time and emit value changes. */
  private moveCursor(time: number): void {
    const activeCursorObj = this.activeCursor === 1 ? this.cursor : this.cursor2;
    activeCursorObj.move(time);

    // Update the nav bar marker.
    const nav = this.el.querySelector('#ot-canvas-nav-0') as any;
    if (this.activeCursor === 1) {
      nav?.setPrimaryMarker?.((time / this.viewport.length) * 100);
    } else {
      nav?.setSecondaryMarker?.((time / this.viewport.length) * 100);
    }

    // Collect the value at the primary cursor for each waveform.
    const primaryTime = this.cursor.offsetPs;
    const values: Record<string, string> = {};
    if (waveformDb) {
      for (const child of this.waveforms.children) {
        const wf = child as any;
        const vid = wf.config?.vid ?? wf.name;
        const [traceIdx] = waveformDb.get_trace_index(vid, primaryTime);
        values[child.name] = waveformDb.get_trace_label(vid, traceIdx);
      }
    }

    this.setCursorEvent.emit(values);
    this.draw(false);
  }

  /**
   * Snap the active cursor to the nearest signal edge at the given screen x,
   * or re-evaluate at the current position when called with no argument.
   */
  private handleSetCursor(screenX?: number): void {
    const cursorObj = this.activeCursor === 1 ? this.cursor : this.cursor2;
    let ps = cursorObj.offsetPs;
    if (screenX !== undefined) {
      ps = this.viewport.screenToPs(screenX);
    }

    let minDist = Infinity;
    let snapTime = 0;

    if (waveformDb) {
      for (const child of this.waveforms.children) {
        const wf = child as any;
        const vid = wf.config?.vid ?? wf.name;
        const result = waveformDb.get_trace_index(vid, ps);
        const idx = result[1];
        if (result) {
          const t = waveformDb.get_trace_time(vid, idx);
          const d = Math.abs(ps - t);
          if (d < minDist) {
            snapTime = t;
            minDist = d;
          }
        }
      }
    }

    if (minDist < Infinity) {
      this.moveCursor(snapTime);
    }
  }

  // --------------------------------------------------- Box-select zoom

  private startBoxSelect(screenX: number): void {
    this.boxSelectActive = true;
    this.boxSelectStartX = screenX;
    this.boxSelectOverlay.visible = true;
    this.boxSelectOverlay.clear();
  }

  private updateBoxSelect(screenX: number): void {
    if (!this.boxSelectActive) return;
    const x1 = Math.min(this.boxSelectStartX, screenX);
    const x2 = Math.max(this.boxSelectStartX, screenX);
    const h = this.app.screen.height;

    this.boxSelectOverlay.clear();
    this.boxSelectOverlay.beginFill(0x448aff, 0.15);
    this.boxSelectOverlay.lineStyle(1, 0x448aff, 0.6);
    this.boxSelectOverlay.drawRect(x1, this.grid.style.axisHeight, x2 - x1, h - this.grid.style.axisHeight);
    this.boxSelectOverlay.endFill();
    this.app.renderer.render(this.app.stage);
  }

  private endBoxSelect(screenX: number): void {
    this.boxSelectActive = false;
    this.boxSelectOverlay.visible = false;
    this.boxSelectOverlay.clear();

    const x1 = Math.min(this.boxSelectStartX, screenX);
    const x2 = Math.max(this.boxSelectStartX, screenX);

    // Minimum drag distance to trigger zoom
    if (x2 - x1 < 10) {
      this.draw();
      return;
    }

    // Convert screen coordinates to time
    const t1 = this.viewport.screenToPs(x1);
    const t2 = this.viewport.screenToPs(x2);
    const timeRange = t2 - t1;

    if (timeRange > 0) {
      this.viewport.xscale = this.viewport.width / timeRange;
      this.viewport.x = t1;
    }

    this.draw();
  }

  // ----------------------------------------------------- Resize

  private handleResize = () => {
    this.resize();
  };

  private resize(): void {
    if (!this.ready) return;

    const rect = this.el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    (this.app.view as HTMLCanvasElement).style.width = '100%';
    (this.app.view as HTMLCanvasElement).style.height = '100%';
    this.app.renderer.resize(w, h);
    (this.app as any).resize?.();

    // Recreate the graph mask.
    this.mask.clear();
    this.mask.lineStyle(0);
    this.mask.beginFill(0xff00ff, 1);
    this.mask.drawRect(0, this.grid.style.axisHeight + 0.5, w, h - this.grid.style.axisHeight + 0.5);
    this.mask.endFill();

    this.viewport.resize(w, h);
    this.grid.reloadStyle(this.app.renderer);
    this.cursor.draw(this.viewport);
    this.cursor2.draw(this.viewport);
    (this.cursor as any).height = h;
    (this.cursor2 as any).height = h;
    this.graph.y = 0.5 - rect.y;

    // Remove waveform labels during resize (they get recreated on draw).
    for (const child of this.waveforms.children) {
      (child as any).removeLabels?.();
    }

    this.draw();
  }

  // ----------------------------------------------- Keyboard shortcuts

  private bindKeyboardShortcuts(): void {
    const cfg = appConfig.keyboard;

    unbindKey(cfg.zoomFit);
    unbindKey(cfg.zoomStart);
    unbindKey(cfg.zoomIn);
    unbindKey(cfg.zoomOut);
    unbindKey(cfg.zoomEnd);
    unbindKey(cfg.nextEdge);
    unbindKey(cfg.prevEdge);
    unbindKey(cfg.toggleCursor);

    bindKey(cfg.toggleCursor, () => {
      this.toggleActiveCursor();
    });

    bindKey(cfg.zoomFit, () => {
      this.viewport.fit();
      this.draw();
    });

    bindKey(cfg.zoomStart, () => {
      this.viewport.goto(0);
      this.draw();
    });

    bindKey(cfg.zoomIn, () => {
      this.viewport.zoom(
        -cfg.zoomAmount,
        cfg.zoomTarget !== ZoomTarget.Center,
        (this.cursor as any).x,
      );
      this.draw();
    });

    bindKey(cfg.zoomOut, () => {
      this.viewport.zoom(
        cfg.zoomAmount,
        cfg.zoomTarget !== ZoomTarget.Center,
        (this.cursor as any).x,
      );
      this.draw();
    });

    bindKey(cfg.zoomEnd, () => {
      this.viewport.goto(-1);
      this.draw();
    });

    bindKey(cfg.nextEdge, () => {
      this.nextEdge();
    });

    bindKey(cfg.prevEdge, () => {
      this.prevEdge();
    });
  }
}
