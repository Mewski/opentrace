import { Component, h, Prop, State, Element, Event, EventEmitter, Method } from '@stencil/core';
import { Signal, SignalType } from '../../utils/types';

/**
 * Main sidebar container for the signal list.
 *
 * Manages:
 *  - Rendering the ordered list of signals via `ot-sidebar-item`.
 *  - Multi-select with Ctrl click, adjacent navigation with arrows.
 *  - Drag-and-drop reordering of signals.
 *  - A footer with "Add Signals" and delete buttons.
 *  - Delegates to `ot-properties` for bulk property editing.
 */
@Component({
  tag: 'ot-sidebar',
  styleUrl: 'ot-sidebar.css',
  shadow: true,
})
export class OtSidebar {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** Whether the waveform definition file has been fully parsed. */
  @Prop() defined: boolean = false;

  /** Whether there was an error loading the file. */
  @Prop() error: boolean = false;

  // ----------------------------------------------------------------- State

  /** Internal signal list (set via the `signals` prop setter). */
  @State() _signals: Signal[] = [];

  /** Currently-selected signals (for property editing). */
  @State() selectedSignals: Signal[] = [];

  /** Index of the item currently being dragged (null when idle). */
  @State() draggedIndex: number | null = null;

  /** Index the dragged item is hovering over. */
  @State() hoverIndex: number | null = null;

  /** Whether the Ctrl key is held. */
  private ctrl: boolean = false;

  // ---------------------------------------------------------------- Events

  /** Emitted when the user clicks "Add Signals". */
  @Event() add!: EventEmitter<void>;

  /** Emitted when the user clicks the delete button. */
  @Event({ eventName: 'delete' }) deleteSignal!: EventEmitter<void>;

  /** Emitted when signals are reordered, properties change, etc. */
  @Event() waveformChanged!: EventEmitter<void>;

  /** Emitted when the sidebar layout changes and the canvas needs a redraw. */
  @Event() redraw!: EventEmitter<{ resize?: boolean }>;

  /** Emitted to tell the canvas which signal to highlight. */
  @Event({ bubbles: true, composed: true }) setActiveSignal!: EventEmitter<number>;

  // ---------------------------------------------------------------- Prop setter

  @Prop() signals: Signal[] = [];

  /** Mirror the external `signals` prop into internal state. */
  // Using a watcher pattern for the array.
  componentWillLoad() {
    this._signals = this.signals;
  }

  componentWillUpdate() {
    if (this.signals !== this._signals) {
      this._signals = this.signals;
    }
  }

  // ------------------------------------------------------------- Lifecycle

  componentDidLoad() {
    const treeroot = this.el.shadowRoot?.getElementById('treeroot');
    if (treeroot) {
      treeroot.onscroll = () => this.resize();
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  // -------------------------------------------------------- Keyboard events

  private handleKeyDown = (evt: KeyboardEvent) => {
    if (evt.key === 'Control') {
      this.ctrl = true;
    }
  };

  private handleKeyUp = (evt: KeyboardEvent) => {
    if (evt.key === 'Control') {
      this.ctrl = false;
    } else if (evt.key === 'Escape') {
      this.clearSelection();
    }
  };

  // --------------------------------------------------------- Drag & drop

  private get dragging(): boolean {
    return this.draggedIndex !== null;
  }

  /** Finalise the drag by moving the item to the hover position. */
  private insert(): void {
    if (this.draggedIndex === null || this.hoverIndex === null) return;
    const item = this._signals[this.draggedIndex];
    if (!item) return;
    this._signals.splice(this.draggedIndex, 1);
    this._signals.splice(this.hoverIndex, 0, item);
    this.draggedIndex = null;
    this.hoverIndex = null;
  }

  /**
   * Mouse-down handler on a sidebar item.
   *
   * If the click lands past 24px (i.e. not the drag-handle icon area)
   * it acts as a select/deselect toggle.  Otherwise it initiates a
   * drag operation.
   */
  private startItemDrag = (evt: MouseEvent) => {
    const target = evt.currentTarget as HTMLElement;
    const treeroot = this.el.shadowRoot?.getElementById('treeroot');
    if (!treeroot) return;
    const children = Array.from(treeroot.children) as HTMLElement[];

    // ---------- Selection mode (click past the icon area)
    if (evt.pageX > 24) {
      if (target.classList.contains('wg-container')) return;

      if (!this.ctrl) {
        this.clearSelection();
      }

      if (target.classList.contains('selected')) {
        target.classList.remove('selected');
        const sig = (target as any)._signal ?? this.signalFromElement(target);
        if (sig) {
          const idx = this.selectedSignals.findIndex(s => s.id === sig.id);
          if (idx >= 0) this.selectedSignals.splice(idx, 1);
        }
      } else {
        target.classList.add('selected');
        const sig = (target as any)._signal ?? this.signalFromElement(target);
        if (sig) {
          this.selectedSignals.push(sig);
          this.setActiveSignal.emit(sig.id);
        }
      }

      this.refreshProperties();
      return;
    }

    // ---------- Drag mode (grab handle)
    document.documentElement.style.cursor = 'grabbing';
    this.draggedIndex = children.indexOf(target);

    const axisHeight = parseInt(
      getComputedStyle(this.el).getPropertyValue('--axis-height') || '38',
    );

    const items = this.el.shadowRoot!.querySelectorAll('ot-sidebar-item');
    const topOffset = this.el.getBoundingClientRect().top + window.scrollY + axisHeight;
    const startY = evt.pageY;
    target.style.zIndex = '200';

    // Build midpoint array for hover detection
    const midpoints: number[] = [];
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      midpoints.push(rect.top + rect.height / 2 - axisHeight);
    });

    const onMove = (e: MouseEvent) => {
      const y = e.pageY - topOffset;
      const delta = e.pageY - startY;
      target.style.transform = `translateY(${delta}px)`;

      // Determine hover index
      this.hoverIndex = midpoints.length;
      for (let i = 0; i < midpoints.length - 1; i++) {
        if (y > midpoints[i] && y < midpoints[i + 1]) {
          this.hoverIndex = i;
          break;
        }
      }
      this.waveformChanged.emit();
    };

    onMove(evt);

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.documentElement.style.cursor = '';

      const finalize = () => {
        this.insert();
        target.style.zIndex = '100';
        target.style.transform = '';
        target.style.transition = '';
        target.removeEventListener('transitionend', finalize);
        setTimeout(() => this.resize(), 101);
      };
      target.addEventListener('transitionend', finalize);

      const sig = (target as any)._signal ?? this.signalFromElement(target);
      const height = sig?.display?.height ?? 24;
      const offset = ((this.hoverIndex ?? 0) - (this.draggedIndex ?? 0)) * height;
      target.style.transition = 'transform 0.1s ease-out';
      target.style.transform = `translate3d(0, ${offset}px, 0)`;
    };

    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousemove', onMove);
  };

  // ------------------------------------------------------- Selection helpers

  /** Clear all selection state. */
  @Method()
  async clearSelection() {
    const treeroot = this.el.shadowRoot?.getElementById('treeroot');
    if (!treeroot) return;
    const children = Array.from(treeroot.children) as HTMLElement[];
    this.selectedSignals.splice(0, this.selectedSignals.length);
    for (const child of children) {
      child.classList.remove('selected');
    }
    this.setActiveSignal.emit(-1);
  }

  /** Select all signals. */
  @Method()
  async selectAll() {
    const items = this.el.shadowRoot?.querySelectorAll('ot-sidebar-item');
    if (!items) return;
    let lastId: number | null = null;
    items.forEach(item => {
      item.classList.add('selected');
      const sig = (item as any)._signal ?? (item as any).signal;
      if (sig) {
        this.selectedSignals.push(sig);
        lastId = sig.id;
      }
    });
    if (lastId !== null) {
      this.setActiveSignal.emit(lastId);
    }
    this.refreshProperties();
  }

  /** Select the next or previous adjacent signal. */
  @Method()
  async selectAdjacent(forward: boolean = true) {
    const selected = this.el.shadowRoot?.querySelectorAll('ot-sidebar-item.selected');
    if (!selected?.length) return;
    const anchor = selected.item(forward ? selected.length - 1 : 0);
    const sibling = forward ? anchor.nextElementSibling : anchor.previousElementSibling;
    if (!sibling) return;

    await this.clearSelection();
    sibling.classList.add('selected');
    const sig = (sibling as any)._signal ?? (sibling as any).signal;
    if (sig) {
      this.selectedSignals.push(sig);
      this.setActiveSignal.emit(sig.id);
    }
  }

  /** Move selected signals up or down in the list. */
  @Method()
  async moveSelectedSignals(direction: number = 0) {
    const selected = this.el.shadowRoot?.querySelectorAll('ot-sidebar-item.selected');
    if (!selected) return;
    for (let i = 0; i < selected.length; i++) {
      const sig = (selected.item(i) as any)._signal ?? (selected.item(i) as any).signal;
      if (!sig) continue;
      const idx = this._signals.findIndex(s => s.id === sig.id);
      if (idx + direction >= 0) {
        this.draggedIndex = idx;
        this.hoverIndex = idx + direction;
        this.insert();
      }
    }
    this.waveformChanged.emit();
    setTimeout(() => this.resize(), 50);
  }

  /** Return selected signal IDs and clear the selection classes. */
  @Method()
  async getSelected(): Promise<number[]> {
    const items = this.el.shadowRoot?.querySelectorAll('ot-sidebar-item');
    if (!items) return [];
    const ids: number[] = [];
    const selectedItems: HTMLElement[] = [];
    items.forEach(item => {
      if (item.classList.contains('selected')) {
        selectedItems.push(item as HTMLElement);
        ids.push(parseInt(item.id.replace('wi-', '').replace('wg-', '')));
      }
    });
    selectedItems.forEach(item => item.classList.remove('selected'));
    return ids;
  }

  // ------------------------------------------------------ Helper methods

  /** Look up a Signal from its corresponding DOM element id. */
  private signalFromElement(el: HTMLElement): Signal | undefined {
    const id = parseInt(el.id.replace('wi-', '').replace('wg-', ''));
    return this.findSignalById(this._signals, id);
  }

  /** Recursively find a signal by id. */
  private findSignalById(signals: Signal[], id: number): Signal | undefined {
    for (const sig of signals) {
      if (sig.id === id) return sig;
      const found = this.findSignalById(sig.children, id);
      if (found) return found;
    }
    return undefined;
  }

  /** Find signals whose IDs match the given array (recursive). */
  private findSignals(signals: Signal[], ids: number[]): Signal[] {
    const result: Signal[] = [];
    for (const sig of signals) {
      if (ids.includes(sig.id)) result.push(sig);
      result.push(...this.findSignals(sig.children, ids));
    }
    return result;
  }

  /** Refresh the ot-properties panel after selection changes. */
  private refreshProperties(): void {
    const props = this.el.shadowRoot?.getElementById('ot-properties-0') as any;
    props?.requestUpdate?.('signals');
  }

  /** Recalculate signal positions after layout changes. */
  @Method()
  async resize(): Promise<boolean> {
    const items = this.el.shadowRoot?.querySelectorAll('ot-sidebar-item');
    if (items) {
      items.forEach(item => (item as any).resizeSignal?.());
    }
    this.waveformChanged.emit();
    return true;
  }

  /** Update cursor values for all visible signals. */
  @Method()
  async updateCursor(values: Record<string, string>) {
    const items = this.el.shadowRoot?.querySelectorAll('ot-sidebar-item');
    if (!items) return;
    items.forEach(item => {
      const sig = (item as any)._signal ?? (item as any).signal;
      if (sig) {
        (item as any).value = values[sig.id] ?? '';
      }
    });
  }

  // ------------------------------------------------------- Transition handler

  private updateItem = (evt: TransitionEvent) => {
    if (evt.propertyName === 'transform') {
      const target = evt.composedPath()[0] as any;
      target?.resizeSignal?.();
      this.waveformChanged.emit();
    }
  };

  // ------------------------------------------------------------- Render helpers

  private handleAddSignal = () => {
    this.add.emit();
  };

  private handleDeleteSignal = () => {
    this.deleteSignal.emit();
  };

  private renderItem(signal: Signal, index: number) {
    const classes: Record<string, boolean> = {
      item: true,
      nudgeDown: this.dragging && index < this.draggedIndex! && index >= this.hoverIndex!,
      nudgeUp: this.dragging && index > this.draggedIndex! && index <= this.hoverIndex!,
      dragged: this.draggedIndex === index,
      'wd-container': signal.type === SignalType.divider,
      'wg-container': signal.type === SignalType.group,
      'wi-container': signal.type !== SignalType.group && signal.type !== SignalType.divider,
    };

    const style = signal.type !== SignalType.group ? { height: `${signal.display.height}px` } : {};
    const id = signal.type === SignalType.group ? `wg-${signal.id}` : `wi-${signal.id}`;

    return (
      <ot-sidebar-item
        signal={signal}
        id={id}
        class={classes}
        style={style}
        onMouseDown={this.startItemDrag}
        onTransitionEnd={this.updateItem}
        onResizeSignals={() => this.resize()}
      />
    );
  }

  // -------------------------------------------------------------- Render

  render() {
    return [
      // Signal icon SVG symbol definitions
      <svg style={{ display: 'none' }}>
        <defs />
        <symbol id="icon_signal_bus" viewBox="0 0 26 26">
          <polyline points="1 5 4.6 5 8.7 21 18.9 21 23 5 25 5" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
          <polyline points="0 21 5 21 9 5 19 5 23 21 25 21" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_signal_bus_reg" viewBox="0 0 26 26">
          <polyline points="3 5 5 5 9 21 19 21 23 5 25 5" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
          <circle cx="2" cy="5" r="2" fill="#f7931e" />
          <polyline points="0 21 5 21 9 5 19 5 23 21 25 21" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_signal_clk" viewBox="0 0 26 26">
          <polyline points="25 5 21 5 21 21 17 21 17 5 13 5 13 21 9 21 9 5 5 5 5 21 1 21" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_signal_reg" viewBox="0 0 26 26">
          <polyline points="25 21 21 21 21 5 14 5 14 21 6 21 6 5 3 5" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
          <circle cx="2" cy="5" r="2" fill="#f7931e" />
        </symbol>
        <symbol id="icon_signal_wire" viewBox="0 0 26 26">
          <polyline points="25 21 21 21 21 5 13 5 13 21 5 21 5 5 1 5" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_signal_real" viewBox="0 0 16 16">
          <circle stroke="currentColor" fill="transparent" cx="8" cy="8" r="6.5" stroke-width="1.5" />
          <text x="8" y="9" text-anchor="middle" alignment-baseline="middle" fill="currentColor" font-size="12px" font-family="monospace">R</text>
        </symbol>
        <symbol id="icon_signal_integer" viewBox="0 0 16 16">
          <rect stroke="currentColor" fill="transparent" x="1" y="1" width="14" height="14" stroke-width="1.5" />
          <text x="8" y="9" text-anchor="middle" alignment-baseline="middle" fill="currentColor" font-size="12px" font-family="monospace">i</text>
        </symbol>
        <symbol id="icon_event" viewBox="0 0 24 24">
          <polyline points="8 4 8 20 18 12 8 4" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_parameter" viewBox="0 0 24 24">
          <polyline points="8 2 2 2 2 22 8 22" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="1.5" />
          <polyline points="16 2 22 2 22 22 16 22" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="1.5" />
          <text x="12" y="12" text-anchor="middle" alignment-baseline="middle" fill="currentColor" font-size="15px" font-family="monospace">p</text>
        </symbol>
      </svg>,

      // Feather icon SVG definitions
      <svg style={{ display: 'none' }}>
        <defs />
        <symbol id="fa-plus-circle" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <line x1="12" y1="8" x2="12" y2="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <line x1="8" y1="12" x2="16" y2="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </symbol>
        <symbol id="fa-trash-2" viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <line x1="10" y1="11" x2="10" y2="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <line x1="14" y1="11" x2="14" y2="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </symbol>
      </svg>,

      // Renderer icon SVG definitions
      <svg style={{ display: 'none' }}>
        <defs />
        <symbol id="icon_renderer_digital" viewBox="0 0 32 18">
          <polyline points="3 4 7 4 11 14 21 14 25 4 29 4" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
          <polyline points="3 14 7 14 11 4 21 4 25 14 29 14" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="bevel" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_renderer_linear" viewBox="0 0 32 18">
          <path d="M4,9c1.5-3,3-6,6-6s4.5,3,6,6,3,6,6,6,4.5-3,6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="2.5" />
        </symbol>
        <symbol id="icon_renderer_step" viewBox="0 0 32 18">
          <polyline points="2 10 5 10 5 7 8 7 8 3 13 3 13 7 16 7 16 10 19 10 19 14 24 14 24 10 27 10 27 7 30 7" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="2" />
        </symbol>
      </svg>,

      // Properties panel
      <ot-properties id="ot-properties-0" signals={this.selectedSignals} />,

      // Scrollable signal list
      <nav id="nav0">
        <div id="treeroot" class={{ 'wi-container': true, dragging: this.dragging }}>
          {this._signals.map((signal, index) => this.renderItem(signal, index))}
        </div>
      </nav>,

      // Footer with action buttons
      <footer>
        <button
          onClick={this.handleAddSignal}
          class="btn btn-wide btn-primary"
          style={{ marginLeft: '2px' }}
          disabled={!this.defined}
        >
          {this.defined
            ? [<svg><use xlinkHref="#fa-plus-circle" /></svg>, 'Add Signals']
            : this.error
              ? 'Error - See Output Log'
              : 'Loading...'}
        </button>
        <button
          onClick={this.handleDeleteSignal}
          class="btn"
          style={{ marginRight: '4px', marginLeft: '2px' }}
        >
          <svg><use xlinkHref="#fa-trash-2" /></svg>
        </button>
      </footer>,
    ];
  }
}
