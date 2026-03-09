import { Component, h, Prop, State, Event, EventEmitter, Element, Watch, Method } from '@stencil/core';

/**
 * Viewport descriptor shared between canvas and canvas-nav.
 */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  length: number;
  xscale: number;
  yscale: number;
  timescale: number;
}

/**
 * Navigation bar displayed above the waveform canvas.
 *
 * Provides zoom controls (in / out / fit), a reload button,
 * a settings button, and a minimap slider showing the current
 * viewport position within the full waveform.
 */
@Component({
  tag: 'ot-canvas-nav',
  styleUrl: 'ot-canvas-nav.css',
  shadow: true,
})
export class OtCanvasNav {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props
  /** Whether the backing file has changed on disk (highlights the reload button). */
  @Prop() fileChanged: boolean = false;

  // ------------------------------------------------------------------ State
  @State() private _viewport: Viewport = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    length: 1,
    xscale: 1,
    yscale: 1,
    timescale: 0,
  };

  // ----------------------------------------------------------------- Events
  /** Emitted when the user requests a viewport change (zoom, goto). */
  @Event() change!: EventEmitter<{ cmd: string; value?: number }>;

  /** Emitted when the user clicks the reload button. */
  @Event({ eventName: 'file-reload', bubbles: true, composed: true })
  fileReload!: EventEmitter<{}>;

  /** Emitted when the user clicks the settings button. */
  @Event({ bubbles: true, composed: true })
  settings!: EventEmitter<{}>;

  // ------------------------------------------------------------ Lifecycle

  constructor() {
    // Prevent pointer / click events from propagating to canvas below.
    const stop = (e: Event) => e.stopPropagation();
    // These are attached in connectedCallback via the host element.
    this._stopHandlers = { click: stop, mousedown: stop, pointerdown: stop, touchstart: stop };
  }

  private _stopHandlers: Record<string, (e: Event) => void>;

  connectedCallback() {
    for (const [evt, handler] of Object.entries(this._stopHandlers)) {
      this.el.addEventListener(evt, handler);
    }
    window.addEventListener('resize', this.handleWindowResize);
  }

  disconnectedCallback() {
    for (const [evt, handler] of Object.entries(this._stopHandlers)) {
      this.el.removeEventListener(evt, handler);
    }
    window.removeEventListener('resize', this.handleWindowResize);
  }

  private handleWindowResize = () => {
    this.updatePreview();
  };

  // ------------------------------------------------------- Public methods

  /** Update the viewport data and refresh the minimap preview. */
  @Method()
  async setViewport(vp: Viewport) {
    this._viewport = vp;
    this.updatePreview();
  }

  /** Position the primary cursor marker at the given percentage (0-100). */
  @Method()
  async setPrimaryMarker(pct: number) {
    const marker = this.el.shadowRoot?.getElementById('nav-primary-marker');
    if (marker) {
      marker.style.left = `${pct}%`;
    }
  }

  /** Position the secondary cursor marker at the given percentage (0-100). */
  @Method()
  async setSecondaryMarker(pct: number) {
    const marker = this.el.shadowRoot?.getElementById('nav-secondary-marker');
    if (marker) {
      marker.style.left = `${pct}%`;
      marker.style.display = 'block';
    }
  }

  // -------------------------------------------------------- Internal logic

  @Watch('_viewport')
  onViewportChanged() {
    this.updatePreview();
  }

  private updatePreview(): void {
    const navBar = this.el.shadowRoot?.getElementById('nav-bar');
    if (!navBar) return;

    const vpx = this._viewport.x / this._viewport.length;

    let start = Math.max(this._viewport.x, 0);
    const hostRect = this.el.getClientRects()[0];
    const end = Math.min(
      Math.round((hostRect?.width ?? 0) * (1 / this._viewport.xscale) + this._viewport.x),
      this._viewport.length,
    );
    start = Math.min(start, end);
    const fraction = Math.min((end - start) / this._viewport.length, 1);

    const slider = this.el.shadowRoot?.getElementById('nav-slider');
    if (slider) {
      slider.style.width = `${99.9 * fraction}%`;
      slider.style.marginLeft = `${Math.max(Math.min(99.9 * vpx, 100), 0)}%`;
    }
  }

  // -------------------------------------------------------- Event handlers

  private handleReload = () => {
    this.fileReload.emit({});
  };

  private handleSettings = () => {
    this.settings.emit({});
  };

  private handleZoomIn = () => {
    this.change.emit({ cmd: 'zoom_in' });
  };

  private handleZoomFit = () => {
    this.change.emit({ cmd: 'zoom_fit' });
  };

  private handleZoomOut = () => {
    this.change.emit({ cmd: 'zoom_out' });
  };

  private handlePointerMove = (evt: PointerEvent) => {
    const navBar = this.el.shadowRoot?.getElementById('nav-bar');
    if (evt.target !== navBar) return;

    evt.stopPropagation();
    evt.preventDefault();

    if (evt.buttons & 1) {
      const rect = navBar!.getClientRects()[0];
      const pct = Math.max(Math.min(evt.offsetX / rect.width, 1), 0);
      this.change.emit({ cmd: 'goto', value: pct * this._viewport.length });
    }
  };

  // -------------------------------------------------------------- Render

  render() {
    return (
      <div id="container" class="darkglass">
        {/* SVG icon definitions */}
        <svg style={{ display: 'none' }}>
          <defs />
          <symbol id="refresh" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
            />
          </symbol>
          <symbol id="settings-icon" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
            />
          </symbol>
          <symbol id="zoom_in" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
            />
            <path fill="currentColor" d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" />
          </symbol>
          <symbol id="zoom_out" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"
            />
          </symbol>
          <symbol id="zoom_out_map" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M15,3l2.3,2.3l-2.89,2.87l1.42,1.42L18.7,6.7L21,9V3H15z M3,9l2.3-2.3l2.87,2.89l1.42-1.42L6.7,5.3L9,3H3V9z M9,21 l-2.3-2.3l2.89-2.87l-1.42-1.42L5.3,17.3L3,15v6H9z M21,15l-2.3,2.3l-2.87-2.89l-1.42,1.42l2.89,2.87L15,21h6V15z"
            />
          </symbol>
        </svg>

        <div id="reload-group" class={this.fileChanged ? 'highlight' : ''}>
          <button id="reload" onClick={this.handleReload}>
            <svg><use xlinkHref="#refresh" /></svg>
          </button>
        </div>

        <div id="nav-bar" onPointerMove={this.handlePointerMove} onPointerDown={this.handlePointerMove}>
          <div id="nav-primary-marker"></div>
          <div id="nav-secondary-marker" style={{ display: 'none' }}></div>
          <div id="nav-slider"></div>
        </div>

        <button id="settings" onClick={this.handleSettings}>
          <svg><use xlinkHref="#settings-icon" /></svg>
        </button>

        <div id="zoom-group" class="btn-group">
          <button id="zoom-in" onClick={this.handleZoomIn}>
            <svg><use xlinkHref="#zoom_out" /></svg>
          </button>
          <button id="zoom-fit" onClick={this.handleZoomFit}>
            <svg><use xlinkHref="#zoom_out_map" /></svg>
          </button>
          <button id="zoom-out" onClick={this.handleZoomOut}>
            <svg><use xlinkHref="#zoom_in" /></svg>
          </button>
        </div>
      </div>
    );
  }
}
