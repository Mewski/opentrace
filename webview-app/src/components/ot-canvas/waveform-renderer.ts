import * as PIXI from 'pixi.js';
import { SignalValue, RendererType } from '../../utils/types';
import type { Signal } from '../../utils/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cssColor(prop: string): number {
  const val = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  if (val.startsWith('#')) {
    const hex = val.replace('#', '');
    // Handle 8-char hex (with alpha) — take first 6 chars
    return parseInt(hex.substring(0, 6), 16);
  }
  return 0xffffff;
}

function parseColor(hex: string): number {
  if (hex.startsWith('#')) {
    return parseInt(hex.replace('#', '').substring(0, 6), 16);
  }
  return 0x00e676;
}

// ---------------------------------------------------------------------------
// WaveformDb interface (matches the declared global)
// ---------------------------------------------------------------------------

interface WaveformDb {
  time: number;
  timescale_unit: number;
  get_trace_index(vid: string, time: number): number[];
  get_trace_length(vid: string): number;
  get_trace_time(vid: string, index: number): number;
  get_trace_label(vid: string, index: number): string;
  get_trace_cmd(vid: string, index: number): number;
  get_trace_range(vid: string, start: number, end: number): number[];
}

declare const waveformDb: WaveformDb | null;

// ---------------------------------------------------------------------------
// ViewportLike (avoid circular import)
// ---------------------------------------------------------------------------

interface ViewportLike {
  x: number;
  xscale: number;
  width: number;
  length: number;
}

// ---------------------------------------------------------------------------
// WaveformSprite base class
// ---------------------------------------------------------------------------

export class WaveformSprite extends PIXI.Container {
  config: {
    vid: string;
    size: number;
    renderer: string;
    color: string;
    strokeWidth: number;
    height: number;
    fill: string | number;
  };

  protected gfx: PIXI.Graphics;
  protected labels: PIXI.Container;
  protected lastViewportKey: string = '';

  constructor(signal: Signal) {
    super();
    this.name = signal.vid ?? signal.id.toString();
    this.config = {
      vid: signal.vid ?? signal.id.toString(),
      size: signal.size,
      renderer: signal.display.renderer,
      color: signal.display.color,
      strokeWidth: signal.display.strokeWidth || 2,
      height: signal.display.height || 24,
      fill: signal.display.fill,
    };

    this.gfx = new PIXI.Graphics();
    this.labels = new PIXI.Container();
    this.labels.name = 'labels';
    this.addChild(this.gfx);
    this.addChild(this.labels);
  }

  /** Remove all text labels (called during resize). */
  removeLabels(): void {
    this.labels.removeChildren();
  }

  /** Main draw entry point. Override in subclasses. */
  draw(viewport: ViewportLike, cacheHit: boolean = false): void {
    // no-op in base
  }

  /** Compute a key representing the current viewport state for caching. */
  protected viewportKey(viewport: ViewportLike): string {
    return `${viewport.x.toFixed(2)}_${viewport.xscale.toFixed(6)}_${viewport.width.toFixed(0)}`;
  }

  /** Get the visible time range for the current viewport. */
  protected getVisibleRange(viewport: ViewportLike): [number, number] {
    const startTime = Math.max(0, Math.floor(viewport.x));
    const endTime = Math.min(
      viewport.length,
      Math.ceil(viewport.x + viewport.width / viewport.xscale),
    );
    return [startTime, endTime];
  }
}

// ---------------------------------------------------------------------------
// DigitalWaveformRenderer — single-bit step waveforms
// ---------------------------------------------------------------------------

export class DigitalWaveformRenderer extends WaveformSprite {
  draw(viewport: ViewportLike, cacheHit: boolean = false): void {
    if (!waveformDb) return;

    const key = this.viewportKey(viewport);
    if (cacheHit && key === this.lastViewportKey) return;
    this.lastViewportKey = key;

    this.gfx.clear();
    this.removeLabels();

    const vid = this.config.vid;
    const traceLen = waveformDb.get_trace_length(vid);
    if (traceLen === 0) return;

    const [startTime, endTime] = this.getVisibleRange(viewport);
    const range = waveformDb.get_trace_range(vid, startTime, endTime);
    // Extend range by 1 on each side for edge continuity
    const iStart = Math.max(0, range[0] - 1);
    const iEnd = Math.min(traceLen - 1, range[1] + 1);

    const scale = viewport.xscale;
    const h = this.config.height;
    const sw = this.config.strokeWidth;
    const yHigh = 3;
    const yLow = h - 3;
    const yMid = h / 2;

    const colorHigh = cssColor('--waveform-high');
    const colorLow = cssColor('--waveform-low');
    const colorX = cssColor('--waveform-x');
    const colorZ = cssColor('--waveform-z');
    const colorRising = cssColor('--waveform-rising');
    const colorFalling = cssColor('--waveform-falling');
    const signalColor = parseColor(this.config.color);

    for (let i = iStart; i <= iEnd; i++) {
      const time = waveformDb.get_trace_time(vid, i);
      const cmd = waveformDb.get_trace_cmd(vid, i);
      const x = Math.round(time * scale);

      // Determine next transition time
      const nextTime = i < traceLen - 1
        ? waveformDb.get_trace_time(vid, i + 1)
        : viewport.length;
      const xNext = Math.round(nextTime * scale);

      let lineColor: number;
      let yLevel: number;

      switch (cmd) {
        case SignalValue.One:
          lineColor = signalColor;
          yLevel = yHigh;
          break;
        case SignalValue.Zero:
          lineColor = signalColor;
          yLevel = yLow;
          break;
        case SignalValue.RisingEdge:
          // Draw vertical rising edge
          this.gfx.lineStyle(sw, colorRising, 1);
          this.gfx.moveTo(x, yLow);
          this.gfx.lineTo(x, yHigh);
          lineColor = signalColor;
          yLevel = yHigh;
          break;
        case SignalValue.FallingEdge:
          // Draw vertical falling edge
          this.gfx.lineStyle(sw, colorFalling, 1);
          this.gfx.moveTo(x, yHigh);
          this.gfx.lineTo(x, yLow);
          lineColor = signalColor;
          yLevel = yLow;
          break;
        case SignalValue.Invalid:
          lineColor = colorX;
          yLevel = yMid;
          // Draw X hatching
          this.gfx.lineStyle(0);
          this.gfx.beginFill(colorX, 0.15);
          this.gfx.drawRect(x, yHigh, xNext - x, yLow - yHigh);
          this.gfx.endFill();
          break;
        case SignalValue.HighZ:
          lineColor = colorZ;
          yLevel = yMid;
          break;
        default:
          lineColor = signalColor;
          yLevel = yLow;
          break;
      }

      // Draw horizontal line to next transition
      this.gfx.lineStyle(sw, lineColor, 1);
      this.gfx.moveTo(x, yLevel);
      this.gfx.lineTo(xNext, yLevel);
    }
  }
}

// ---------------------------------------------------------------------------
// BusWaveformRenderer — multi-bit bus waveforms with hex-shaped transitions
// ---------------------------------------------------------------------------

export class BusWaveformRenderer extends WaveformSprite {
  draw(viewport: ViewportLike, cacheHit: boolean = false): void {
    if (!waveformDb) return;

    const key = this.viewportKey(viewport);
    if (cacheHit && key === this.lastViewportKey) return;
    this.lastViewportKey = key;

    this.gfx.clear();
    this.removeLabels();

    const vid = this.config.vid;
    const traceLen = waveformDb.get_trace_length(vid);
    if (traceLen === 0) return;

    const [startTime, endTime] = this.getVisibleRange(viewport);
    const range = waveformDb.get_trace_range(vid, startTime, endTime);
    const iStart = Math.max(0, range[0] - 1);
    const iEnd = Math.min(traceLen - 1, range[1] + 1);

    const scale = viewport.xscale;
    const h = this.config.height;
    const sw = this.config.strokeWidth;
    const yTop = 3;
    const yBot = h - 3;
    const yMid = h / 2;
    const slant = Math.min(4, (yBot - yTop) / 2); // hex slant width in pixels

    const busStroke = parseColor(this.config.color);
    const colorX = cssColor('--waveform-x');
    const colorZ = cssColor('--waveform-z');
    const textColor = cssColor('--waveform-text');
    const busFillAlpha = typeof this.config.fill === 'number' ? this.config.fill : 0.1;

    for (let i = iStart; i <= iEnd; i++) {
      const time = waveformDb.get_trace_time(vid, i);
      const cmd = waveformDb.get_trace_cmd(vid, i);
      const x = Math.round(time * scale);

      const nextTime = i < traceLen - 1
        ? waveformDb.get_trace_time(vid, i + 1)
        : viewport.length;
      const xNext = Math.round(nextTime * scale);
      const segWidth = xNext - x;

      let fillColor: number;
      let strokeColor: number;

      if (cmd === SignalValue.Invalid) {
        fillColor = colorX;
        strokeColor = colorX;
      } else if (cmd === SignalValue.HighZ) {
        fillColor = colorZ;
        strokeColor = colorZ;
      } else {
        fillColor = busStroke;
        strokeColor = busStroke;
      }

      // Draw hex-shaped bus segment
      // Fill
      this.gfx.lineStyle(0);
      this.gfx.beginFill(fillColor, busFillAlpha);
      this.gfx.moveTo(x + slant, yTop);
      this.gfx.lineTo(xNext, yTop);
      this.gfx.lineTo(xNext + slant, yMid);
      this.gfx.lineTo(xNext, yBot);
      this.gfx.lineTo(x + slant, yBot);
      this.gfx.lineTo(x, yMid);
      this.gfx.closePath();
      this.gfx.endFill();

      // Stroke — top and bottom lines
      this.gfx.lineStyle(sw, strokeColor, 1);
      this.gfx.moveTo(x + slant, yTop);
      this.gfx.lineTo(xNext, yTop);
      this.gfx.moveTo(x + slant, yBot);
      this.gfx.lineTo(xNext, yBot);

      // Transition slants (left side)
      if (i > 0 || x > 0) {
        this.gfx.moveTo(x, yMid);
        this.gfx.lineTo(x + slant, yTop);
        this.gfx.moveTo(x, yMid);
        this.gfx.lineTo(x + slant, yBot);
      }

      // Draw label if segment is wide enough
      if (segWidth > 20 && cmd !== SignalValue.HighZ) {
        const label = waveformDb.get_trace_label(vid, i);
        if (label) {
          const text = new PIXI.Text(label, {
            fontFamily: 'monospace',
            fontSize: Math.min(11, h - 8),
            fill: textColor,
            align: 'left',
          });
          text.x = x + slant + 3;
          text.y = yMid - text.height / 2;
          // Clip label to segment width
          const maxWidth = segWidth - slant - 6;
          if (text.width > maxWidth && maxWidth > 0) {
            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff);
            mask.drawRect(text.x, text.y, maxWidth, text.height);
            mask.endFill();
            text.mask = mask;
            this.labels.addChild(mask);
          }
          this.labels.addChild(text);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AnalogWaveformRenderer — real/analog signals (step or linear)
// ---------------------------------------------------------------------------

export class AnalogWaveformRenderer extends WaveformSprite {
  private mode: 'step' | 'linear';

  constructor(signal: Signal) {
    super(signal);
    this.mode = signal.display.renderer === RendererType.AnalogLinear ? 'linear' : 'step';
  }

  draw(viewport: ViewportLike, cacheHit: boolean = false): void {
    if (!waveformDb) return;

    const key = this.viewportKey(viewport);
    if (cacheHit && key === this.lastViewportKey) return;
    this.lastViewportKey = key;

    this.gfx.clear();
    this.removeLabels();

    const vid = this.config.vid;
    const traceLen = waveformDb.get_trace_length(vid);
    if (traceLen === 0) return;

    const [startTime, endTime] = this.getVisibleRange(viewport);
    const range = waveformDb.get_trace_range(vid, startTime, endTime);
    const iStart = Math.max(0, range[0] - 1);
    const iEnd = Math.min(traceLen - 1, range[1] + 1);

    const scale = viewport.xscale;
    const h = this.config.height;
    const sw = this.config.strokeWidth;
    const yTop = 3;
    const yBot = h - 3;
    const yRange = yBot - yTop;

    const analogColor = cssColor('--waveform-analog');
    const signalColor = parseColor(this.config.color);
    const lineColor = signalColor || analogColor;

    // First pass: find min/max for auto-scaling
    let vMin = Infinity;
    let vMax = -Infinity;
    for (let i = iStart; i <= iEnd; i++) {
      const label = waveformDb.get_trace_label(vid, i);
      const val = parseFloat(label);
      if (!isNaN(val)) {
        if (val < vMin) vMin = val;
        if (val > vMax) vMax = val;
      }
    }

    if (vMin === Infinity) return;
    if (vMin === vMax) {
      vMin -= 1;
      vMax += 1;
    }

    const valToY = (v: number): number => {
      return yBot - ((v - vMin) / (vMax - vMin)) * yRange;
    };

    // Draw the analog trace
    this.gfx.lineStyle(sw, lineColor, 1);

    let started = false;
    let lastX = 0;
    let lastY = yBot;

    for (let i = iStart; i <= iEnd; i++) {
      const time = waveformDb.get_trace_time(vid, i);
      const label = waveformDb.get_trace_label(vid, i);
      const val = parseFloat(label);
      const x = Math.round(time * scale);

      if (isNaN(val)) continue;

      const y = valToY(val);

      if (!started) {
        this.gfx.moveTo(x, y);
        started = true;
      } else {
        if (this.mode === 'step') {
          // Step: horizontal then vertical
          this.gfx.lineTo(x, lastY);
          this.gfx.lineTo(x, y);
        } else {
          // Linear: direct line
          this.gfx.lineTo(x, y);
        }
      }

      lastX = x;
      lastY = y;
    }

    // Extend to end of visible range
    if (started) {
      const xEnd = Math.round(endTime * scale);
      if (this.mode === 'step') {
        this.gfx.lineTo(xEnd, lastY);
      }
    }

    // Fill under the curve
    if (started) {
      const fillAlpha = typeof this.config.fill === 'number' ? this.config.fill : 0.1;
      if (fillAlpha > 0) {
        this.gfx.lineStyle(0);
        this.gfx.beginFill(lineColor, fillAlpha);

        let fillStarted = false;
        for (let i = iStart; i <= iEnd; i++) {
          const time = waveformDb.get_trace_time(vid, i);
          const label = waveformDb.get_trace_label(vid, i);
          const val = parseFloat(label);
          const x = Math.round(time * scale);
          if (isNaN(val)) continue;
          const y = valToY(val);

          if (!fillStarted) {
            this.gfx.moveTo(x, yBot);
            this.gfx.lineTo(x, y);
            fillStarted = true;
          } else {
            if (this.mode === 'step') {
              this.gfx.lineTo(x, lastY);
              this.gfx.lineTo(x, y);
            } else {
              this.gfx.lineTo(x, y);
            }
          }
          lastY = y;
          lastX = x;
        }
        if (fillStarted) {
          const xEnd = Math.round(endTime * scale);
          if (this.mode === 'step') {
            this.gfx.lineTo(xEnd, lastY);
          }
          this.gfx.lineTo(lastX, yBot);
          this.gfx.closePath();
          this.gfx.endFill();
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// EventWaveformRenderer — event signals (vertical tick marks)
// ---------------------------------------------------------------------------

export class EventWaveformRenderer extends WaveformSprite {
  draw(viewport: ViewportLike, cacheHit: boolean = false): void {
    if (!waveformDb) return;

    const key = this.viewportKey(viewport);
    if (cacheHit && key === this.lastViewportKey) return;
    this.lastViewportKey = key;

    this.gfx.clear();

    const vid = this.config.vid;
    const traceLen = waveformDb.get_trace_length(vid);
    if (traceLen === 0) return;

    const [startTime, endTime] = this.getVisibleRange(viewport);
    const range = waveformDb.get_trace_range(vid, startTime, endTime);
    const iStart = Math.max(0, range[0]);
    const iEnd = Math.min(traceLen - 1, range[1]);

    const scale = viewport.xscale;
    const h = this.config.height;
    const sw = this.config.strokeWidth;
    const signalColor = parseColor(this.config.color);

    this.gfx.lineStyle(sw, signalColor, 1);

    for (let i = iStart; i <= iEnd; i++) {
      const time = waveformDb.get_trace_time(vid, i);
      const x = Math.round(time * scale);
      // Draw vertical tick
      this.gfx.moveTo(x, 2);
      this.gfx.lineTo(x, h - 2);
      // Draw small triangle at top
      this.gfx.moveTo(x - 3, 2);
      this.gfx.lineTo(x, 6);
      this.gfx.lineTo(x + 3, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

export function createWaveformRenderer(signal: Signal): WaveformSprite {
  const renderer = signal.display.renderer;

  if (renderer === RendererType.Event) {
    return new EventWaveformRenderer(signal);
  }

  if (renderer === RendererType.AnalogStep || renderer === RendererType.AnalogLinear) {
    return new AnalogWaveformRenderer(signal);
  }

  // For bus (multi-bit) signals
  if (signal.size > 1 && renderer !== RendererType.Line) {
    return new BusWaveformRenderer(signal);
  }

  // Default: if size > 1 use bus, if size == 1 use digital
  if (signal.size > 1) {
    return new BusWaveformRenderer(signal);
  }

  return new DigitalWaveformRenderer(signal);
}
