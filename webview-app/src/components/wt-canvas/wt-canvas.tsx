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

  constructor() {
    super();
    this.gfx = new PIXI.Graphics();
    this.addChild(this.gfx);
  }

  draw(viewport: ViewportState): void {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--cursor').trim();
    const cursorWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--cursor-width').trim(),
    );
    this.gfx.clear();

    const xPos = Math.floor(this.offsetPs * viewport.xscale) - 1;
    // Draw a vertical line at the cursor position.
    this.gfx.lineStyle(cursorWidth, 0xffffff, 1, 0, false);
    this.gfx.moveTo(xPos, 0.5);
    this.gfx.lineTo(xPos, (this.parent as PIXI.Container).height);
    this.gfx.lineTo(xPos, 0.5);
  }

  move(ps: number): void {
    this.offsetPs = ps;
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
  tag: 'wt-canvas',
  styleUrl: 'wt-canvas.css',
  shadow: false,  // Original uses createRenderRoot() { return this; }
})
export class WtCanvas {
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
  private waveforms!: PIXI.Container;
  private graph!: PIXI.Container;
  private mask!: PIXI.Graphics;

  // ------------------------------------------------------------ Lifecycle

  connectedCallback() {
    window.addEventListener('resize', this.handleResize);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.handleResize);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', this.handleResize);

    this.el.onpointerdown = (e: PointerEvent) => this.handleSetCursor(e.offsetX);
    this.el.onpointermove = (e: PointerEvent) => {
      if (e.buttons) this.handleSetCursor(e.offsetX);
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
    this.cursor = new CursorGraphics();
    this.waveforms = new PIXI.Container();
    this.graph = new PIXI.Container();
    this.graph.addChild(this.waveforms);

    this.mask = new PIXI.Graphics();

    this.app.stage.addChild(this.mask);
    this.app.stage.addChild(this.grid as any);
    this.app.stage.addChild(this.graph);
    this.app.stage.addChild(this.cursor as any);

    this.graph.mask = this.mask;
    (this.cursor as any).y = this.grid.style.axisHeight;
    (this.cursor as any).height = this.app.screen.height;

    this.resize();
    this.bindKeyboardShortcuts();
  }

  // --------------------------------------------------------------- Render

  render() {
    return (
      <wt-canvas-nav
        id="wt-canvas-nav-0"
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
   * Override / extend this to plug in custom waveform renderers.
   */
  private createWaveformSprite(signal: Signal): PIXI.Container {
    const container = new PIXI.Container();
    container.name = signal.vid;
    return container;
  }

  // -------------------------------------------------- Public API methods

  /** Remove one or more signals by id. */
  @Method()
  async delete(...signals: Signal[]) {
    for (const sig of signals) {
      try {
        const child = this.waveforms.getChildByName(sig.id.toString());
        if (child) {
          const idx = this.waveforms.getChildIndex(child);
          this.waveforms.removeChildAt(idx);
        }
        this._signalDict.delete(sig.id);
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

    let [, idx] = waveformDb.get_trace_index(this.activeSignal.vid, this.cursor.offsetPs);
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

    let [, idx] = waveformDb.get_trace_index(this.activeSignal.vid, this.cursor.offsetPs);
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

  // -------------------------------------------------------- Drawing

  private draw(redrawWaveforms: boolean = false): void {
    if (!this.graph) return;

    if (waveformDb) {
      this.viewport.length = waveformDb.time;
      this.viewport.timescale = waveformDb.timescale_unit;
    }

    this.graph.x = Math.ceil(-this.viewport.x * this.viewport.xscale);
    (this.cursor as any).x = this.graph.x;

    for (const child of this.waveforms.children) {
      (child as any).draw?.(this.viewport, !redrawWaveforms);
    }

    this.grid.draw(this.viewport, this.activeSignal);
    this.cursor.draw(this.viewport);
    this.app.renderer.render(this.app.stage);

    // Push viewport state to the nav bar.
    const nav = this.el.querySelector('#wt-canvas-nav-0') as any;
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

  /** Move the cursor to a specific time and emit value changes. */
  private moveCursor(time: number): void {
    this.cursor.move(time);

    // Update the nav bar marker.
    const nav = this.el.querySelector('#wt-canvas-nav-0') as any;
    nav?.setPrimaryMarker?.((time / this.viewport.length) * 100);

    // Collect the value at the cursor for each waveform.
    const values: Record<string, string> = {};
    if (waveformDb) {
      for (const child of this.waveforms.children) {
        const wf = child as any;
        const vid = wf.config?.vid ?? wf.name;
        const [traceIdx] = waveformDb.get_trace_index(vid, time);
        values[child.name] = waveformDb.get_trace_label(vid, traceIdx);
      }
    }

    this.setCursorEvent.emit(values);
    this.draw(false);
  }

  /**
   * Snap the cursor to the nearest signal edge at the given screen x,
   * or re-evaluate at the current position when called with no argument.
   */
  private handleSetCursor(screenX?: number): void {
    let ps = this.cursor.offsetPs;
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
    (this.cursor as any).height = h;
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
