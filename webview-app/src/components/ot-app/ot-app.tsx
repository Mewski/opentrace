import {
  Component,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Method,
} from '@stencil/core';
import { Signal, SignalType, Radix, AppConfig } from '../../utils/types';
import { DEFAULT_CONFIG } from '../../utils/constants';

// ---------------------------------------------------------------------------
// External globals expected at runtime
// ---------------------------------------------------------------------------

/** VCD parser instance (Rust/WASM, loaded dynamically from core.js). */
let vcd: any;

/** Application config – mutable global shared with child components. */
let appConfig: AppConfig = { ...DEFAULT_CONFIG } as AppConfig;

/**
 * Mousetrap-compatible keyboard binding function.
 * Assumed to be available globally at runtime.
 */
declare function hotkeys(keys: string, callback: () => void): void;
declare namespace hotkeys {
  function unbind(keys: string): void;
}

// ---------------------------------------------------------------------------
// ot-app  –  Root application container
// ---------------------------------------------------------------------------

@Component({
  tag: 'ot-app',
  styleUrl: 'ot-app.css',
  shadow: true,
})
export class OtApp {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ State

  /** Map of signal id -> Signal for fast look-ups. */
  private _signalLookup: Map<number, Signal> = new Map();

  /** Whether a VCD file has been parsed and nodes are available. */
  @State() defined: boolean = false;

  /** Whether the last parse produced an error. */
  @State() error: boolean = false;

  /** Width (px) of the sidebar panel. */
  @State() sidebarWidth: number = 0;

  /** Ordered list of top-level signals / groups currently in the view. */
  @State() _signals: Signal[] = [];

  /** Throttle flag for resize events. */
  private throttle: boolean = false;

  // ----------------------------------------------------------------- Events

  @Event({ eventName: 'vcd-ready', bubbles: true, composed: true })
  vcdReady!: EventEmitter<void>;

  @Event({ eventName: 'vcd-done', bubbles: true, composed: true })
  vcdDone!: EventEmitter<void>;

  @Event({ eventName: 'log', bubbles: true, composed: true })
  log!: EventEmitter<string>;

  @Event({ eventName: 'file-reload', bubbles: true, composed: true })
  fileReload!: EventEmitter<{}>;

  @Event({ eventName: 'config-save', bubbles: true, composed: true })
  configSave!: EventEmitter<string>;

  @Event({ eventName: 'config-reset', bubbles: true, composed: true })
  configReset!: EventEmitter<{}>;

  @Event({ eventName: 'config-reload', bubbles: true, composed: true })
  configReload!: EventEmitter<{}>;

  @Event({ eventName: 'settings-json', bubbles: true, composed: true })
  settingsJson!: EventEmitter<{}>;

  @Event({ eventName: 'open-website', bubbles: true, composed: true })
  openWebsite!: EventEmitter<{}>;

  // ----------------------------------------------------------- Lifecycle

  async componentDidLoad() {
    this.loadConfig(DEFAULT_CONFIG as AppConfig);
    this.sidebarWidth = appConfig.sidebar.width;
    this.resize();
    this.throttle = true;

    window.addEventListener('resize', () => this.resize(), false);

    const handle = this.el.shadowRoot!.getElementById('resize-handle')!;
    handle.addEventListener('mousedown', (e: MouseEvent) => this.sidebarResizeStart(e), false);

    // Dynamically import the WASM-based VCD parser
    const coreModule = await import('../../core.js' as any);
    const init = await (coreModule as any).default();
    vcd = new init.VCD();
    this.vcdReady.emit();
    this.resize();
  }

  // --------------------------------------------------------- Public API

  /**
   * Parse a VCD file buffer. Populates signal tree and logs info.
   */
  @Method()
  async parse(data: any): Promise<void> {
    if (vcd.parse(data)) {
      this.defined = true;
      const nodes: Signal[] = JSON.parse(vcd.nodes());
      this.search().load(nodes);

      this.log.emit(
        JSON.stringify({
          detail: `[INFO] Date: ${vcd.date}\n[INFO] Version: ${vcd.version}\n[INFO] Found ${nodes.length} signals\n`,
          focus: false,
        }),
      );
    } else {
      this.log.emit(
        JSON.stringify({
          detail: vcd.message,
          focus: true,
        }),
      );
      this.error = true;
    }

    this.canvas().fileChanged = false;
    this.canvas().draw();
    this.vcdDone.emit();
  }

  /**
   * Parse a binary waveform file (FST, GHW, or binary VCD) using the wellen backend.
   */
  @Method()
  async parseBytes(data: Uint8Array): Promise<void> {
    if (vcd.parse_bytes(data)) {
      this.defined = true;
      const nodes: Signal[] = JSON.parse(vcd.nodes());
      this.search().load(nodes);

      this.log.emit(
        JSON.stringify({
          detail: `[INFO] Date: ${vcd.date}\n[INFO] Version: ${vcd.version}\n[INFO] Found ${nodes.length} signals\n`,
          focus: false,
        }),
      );
    } else {
      this.log.emit(
        JSON.stringify({
          detail: vcd.message,
          focus: true,
        }),
      );
      this.error = true;
    }

    this.canvas().fileChanged = false;
    this.canvas().draw();
    this.vcdDone.emit();
  }

  /**
   * Import signals from a JSON string (e.g. saved workspace).
   */
  @Method()
  async import(json: string): Promise<void> {
    const signals: Signal[] = JSON.parse(json);
    const ids = this.addSignals(signals);
    await this.search().updateComplete;
    this.search().markDisabled(ids);
  }

  /**
   * Export current signal list as formatted JSON.
   */
  @Method()
  async export(): Promise<string> {
    return JSON.stringify(this._signals, null, 2);
  }

  /**
   * Clear the current VCD data and all signals.
   */
  @Method()
  async clear(): Promise<void> {
    if (vcd) {
      vcd.clear();
      this.defined = false;
      this.deleteAll();
      console.log('cleared');
    }
  }

  /**
   * Load / apply a new configuration object.
   */
  @Method()
  async loadConfig(config: AppConfig): Promise<void> {
    appConfig = config;

    hotkeys.unbind(appConfig.keyboard.addSignal);
    hotkeys(appConfig.keyboard.addSignal, () => {
      if (document.activeElement === document.body) {
        this.search().show();
      }
    });

    hotkeys.unbind(appConfig.keyboard.deleteSignal);
    hotkeys(appConfig.keyboard.deleteSignal, () => {
      this.deleteSelectedSignals();
    });

    hotkeys.unbind(appConfig.keyboard.selectAll);
    hotkeys(appConfig.keyboard.selectAll, () => {
      this.sidebar().selectAll();
    });

    hotkeys.unbind(appConfig.keyboard.nextSignal);
    hotkeys(appConfig.keyboard.nextSignal, () => {
      this.sidebar().selectAdjacent(true);
    });

    hotkeys.unbind(appConfig.keyboard.prevSignal);
    hotkeys(appConfig.keyboard.prevSignal, () => {
      this.sidebar().selectAdjacent(false);
    });

    hotkeys.unbind(appConfig.keyboard.moveSignalUp);
    hotkeys(appConfig.keyboard.moveSignalUp, () => {
      this.sidebar().moveSelectedSignals(-1);
    });

    hotkeys.unbind(appConfig.keyboard.moveSignalDown);
    hotkeys(appConfig.keyboard.moveSignalDown, () => {
      this.sidebar().moveSelectedSignals(1);
    });

    hotkeys.unbind(appConfig.keyboard.reload);
    hotkeys(appConfig.keyboard.reload, () => {
      this.fileReload.emit({});
    });

    this.settings().requestUpdate('config');
    this.canvas().input();
  }

  /**
   * Notify the canvas that the underlying file has been modified externally.
   */
  @Method()
  async fileChanged(): Promise<void> {
    this.canvas().fileChanged = true;
    this.canvas().requestUpdate();
  }

  /**
   * Force a canvas redraw / resize.
   */
  @Method()
  async redraw(): Promise<void> {
    this.canvas().resize();
  }

  /**
   * Set machine info (WASM module metadata).
   * All licensing logic has been removed – just stores the machine data.
   */
  @Method()
  async setMachine(machine: any): Promise<void> {
    vcd.machine = machine;
  }

  // -------------------------------------------------------- Render

  render() {
    return (
      <div class="app-container">
        <aside id="aside-0">
          <ot-sidebar
            id="ot-sidebar-0"
            signals={this._signals}
            defined={this.defined}
            error={this.error}
            onAdd={() => this.addSignalClicked()}
            onDelete={() => this.deleteSelectedSignals()}
            onRedraw={(e: CustomEvent) => this.handleSidebarRedraw(e.detail)}
            onSetActiveSignal={(e: CustomEvent) => this.canvas().setActiveSignal(e.detail)}
            onWaveformChanged={(e: CustomEvent) => this.waveformChanged(e)}
          />
        </aside>
        <div id="resize-handle" class="resize-handle--x" />
        <main id="main-0">
          <ot-canvas
            id="ot-canvas-0"
            signals={this._signalLookup}
            onSetCursor={(e: CustomEvent) => this.sidebar().updateCursor(e.detail)}
            onSettings={() => this.showSettings()}
          />
        </main>
        <ot-search
          id="ot-search-0"
          offsetX={this.sidebarWidth}
          onAdd={(e: CustomEvent) => this.addSignals(e.detail)}
        />
        <ot-settings id="ot-settings-0" config={appConfig} />
      </div>
    );
  }

  // ------------------------------------------------------ Internal helpers

  private addSignalClicked(): void {
    if (this.search().style.opacity === '1') {
      this.search().add();
    } else {
      this.search().show();
    }
  }

  private resize(throttled: boolean = false): void {
    const aside = this.el.shadowRoot!.getElementById('aside-0')! as HTMLElement;
    const main = this.el.shadowRoot!.getElementById('main-0')! as HTMLElement;

    aside.style.width = this.sidebarWidth + 'px';
    main.style.width = (window.innerWidth - this.sidebarWidth) + 'px';

    if (throttled) {
      if (!this.throttle) return;
      this.throttle = false;
      this.canvas().resize();
      setTimeout(() => (this.throttle = true), 150);
    } else {
      this.canvas().resize();
    }
  }

  private sidebarResize = (e: MouseEvent): void => {
    this.sidebarWidth = Math.max(e.offsetX, 180);
    this.resize(true);
  };

  private sidebarResizeStart(_e: MouseEvent): void {
    this.el.addEventListener('mousemove', this.sidebarResize as any, false);
    this.el.addEventListener('mouseup', this.sidebarResizeEnd as any, false);
  }

  private sidebarResizeEnd = (_e: MouseEvent): void => {
    this.canvas().resize();
    this.el.removeEventListener('mousemove', this.sidebarResize as any, false);
    this.el.removeEventListener('mouseup', this.sidebarResizeEnd as any, false);
  };

  private showSettings(): void {
    this.settings().show();
  }

  private deleteSelectedSignals(): void {
    const selected = this.sidebar().getSelected();
    this.deleteById(selected);
  }

  private handleSidebarRedraw(detail: any): void {
    if (!this.canvas()) return;
    this.canvas().draw();
    this.sidebar().requestUpdate();
    if (detail && detail.resize) {
      this.sidebar().updateComplete.then(() => {
        this.sidebar().resize();
      });
    }
  }

  /**
   * Remove signals by id – unwatch from VCD, restore in search, redraw.
   */
  private deleteById(ids: number[]): void {
    function removeFromTree(tree: Signal[], targetId: number): boolean {
      for (let i = 0; i < tree.length; ++i) {
        const node = tree[i];
        if (node.id === targetId) {
          tree.splice(i, 1);
          return true;
        }
        if (node.children.length > 0 && removeFromTree(node.children, targetId)) {
          if (node.children.length === 0) {
            delete (node as any).children;
            tree.splice(i, 1);
          }
          return true;
        }
      }
      return false;
    }

    this.search().restore(ids);

    for (const id of ids) {
      removeFromTree(this._signals, id);
      const sig = this._signalLookup.get(id);
      if (sig && sig.type !== SignalType.group) {
        this._signalLookup.delete(id);
        vcd.unwatch(sig.id, sig.vid);
      }
    }

    this.canvas().delete(...ids);
    this.canvas().clearActive();
    this.sidebar().requestUpdate().then(() => {
      this.sidebar().resize();
    });
    this.search().updateSignalCount();
  }

  private deleteAll(): void {
    const allIds: number[] = [];
    for (const [id] of this._signalLookup) {
      allIds.push(id);
    }
    this.deleteById(allIds);
    this.sidebar().requestUpdate().then(() => {
      this.sidebar().resize();
    });
    this.search().updateSignalCount();
  }

  /**
   * Add signals to the view, watch them in the VCD parser, and apply radix.
   * Returns the list of newly added signal ids.
   */
  private addSignals(signals: Signal[]): number[] {
    const addedIds: number[] = [];

    function walkAndWatch(lookup: Map<number, Signal>, sig: Signal): void {
      if (sig.type !== SignalType.group) {
        lookup.set(sig.id, sig);
        vcd.watch(sig.id, sig.vid);
        addedIds.push(sig.id);
        if ('radix' in sig.display) {
          const radixStr = sig.display.radix;
          const idx = Object.values(Radix).indexOf(radixStr as Radix);
          if (idx !== -1) {
            vcd.set_radix(sig.vid, idx);
          }
        }
      } else {
        sig.children.forEach((child) => walkAndWatch(lookup, child));
      }
    }

    for (const sig of signals) {
      this._signals.push(sig);
      if (sig.type !== SignalType.group) {
        this._signalLookup.set(sig.id, this._signals[this._signals.length - 1]);
        vcd.watch(sig.id, sig.vid);
        addedIds.push(sig.id);
        if ('radix' in sig.display) {
          const radixStr = sig.display.radix;
          const idx = Object.values(Radix).indexOf(radixStr as Radix);
          if (idx !== -1) {
            vcd.set_radix(sig.vid, idx);
          }
        }
      } else {
        walkAndWatch(this._signalLookup, this._signals[this._signals.length - 1]);
      }
    }

    this.search().updateSignalCount();
    this._signals = [...this._signals]; // trigger re-render
    return addedIds;
  }

  private waveformChanged(event: any): void {
    const path = event.composedPath();
    const idStr = path[1]?.id?.replace('wi-', '') ?? '';
    const id = parseInt(idStr, 10);
    if (this._signalLookup.has(id)) {
      const sig = this._signalLookup.get(id)!;
      const detail = event.detail;
      if (sig.display.radix !== detail.radix) {
        this.canvas().updateCursor();
      }
      sig.display = detail;
    }
    this._signals = [...this._signals]; // trigger re-render
  }

  // ----------------------------------------------------- Child accessors

  private sidebar(): any {
    return this.el.shadowRoot!.getElementById('ot-sidebar-0');
  }

  private search(): any {
    return this.el.shadowRoot!.getElementById('ot-search-0');
  }

  private canvas(): any {
    return this.el.shadowRoot!.getElementById('ot-canvas-0');
  }

  private settings(): any {
    return this.el.shadowRoot!.getElementById('ot-settings-0');
  }
}
