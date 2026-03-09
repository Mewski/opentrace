import { Component, h, Prop, State, Element, Event, EventEmitter, Method } from '@stencil/core';
import { Signal, SignalType, RendererType, Radix } from '../../utils/types';
import { DEFAULT_CONFIG } from '../../utils/constants';
import { SIGNAL_ICONS, getSignalIconKey } from '../../utils/icons';

/**
 * Descriptor for a signal entry in the VCD dictionary.
 * Populated from the parsed VCD file and used to build the search tree.
 */
interface VcdSignalEntry {
  uid: number;
  tid: string;
  name: string;
  scope: string;
  kind: string;
  size: number;
  parent: number;
}

/**
 * Modal dialog for browsing and adding VCD signals to the waveform display.
 *
 * Shows a hierarchical module tree on the left and a filterable signal list
 * on the right.  Supports multi-select (ctrl/shift), keyboard navigation,
 * and type-based filtering (wire, reg, logic, etc.).
 */
@Component({
  tag: 'ot-search',
  styleUrl: 'ot-search.css',
  shadow: true,
})
export class OtSearch {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** Horizontal offset for positioning. */
  @Prop() offsetX: number = 0;

  // ----------------------------------------------------------------- State

  /** Index of the currently focused signal in the visible (non-filtered) list. */
  @State() navIndex: number = -1;

  /** Current module scope filter (dot-separated path). */
  @State() moduleScope: string = '';

  /** Signal type filters currently active. */
  @State() filterTypes: string[] = [];

  /** All signal types present in the loaded VCD. */
  @State() allTypes: string[] = [];

  /** The flat signal dictionary loaded from the VCD parser. */
  @State() signalDict: VcdSignalEntry[] = [];

  // ---------------------------------------------------------------- Events

  /** Emitted when the user adds selected signals. Detail is the array of Signal objects. */
  @Event({ bubbles: true, composed: true }) add!: EventEmitter<Signal[]>;

  // -------------------------------------------------------- Private fields

  private keys = { ctrl: false, shift: false };

  // ------------------------------------------------------------- Lifecycle

  componentDidLoad() {
    this.el.addEventListener('click', (e: MouseEvent) => e.stopPropagation());

    window.addEventListener('click', () => {
      if (
        this.el.style.pointerEvents === 'all' &&
        window.getComputedStyle(this.el, null).getPropertyValue('opacity') === '1'
      ) {
        this.hide();
      }
    });

    this.el.onkeydown = (evt: KeyboardEvent) => {
      switch (evt.keyCode) {
        case 13: {
          // Enter - add selected signals
          let asGroup = false;
          if (this.keys.ctrl) {
            this.el.shadowRoot!
              .querySelectorAll('#signals li.selected:not(.filtered):not(.disabled)')
              .forEach(el => el.classList.add('selected'));
          }
          this.addSignals(asGroup);
          return;
        }
        case 16:
          this.keys.shift = true;
          return;
        case 17:
          this.keys.ctrl = true;
          return;
        case 27: {
          // Escape - clear selection or hide
          if (this.getSelectedSignals().length === 0 && this.searchBox().value === '') {
            this.hide();
          } else {
            this.searchBox().value = '';
            this.clear('selected');
            this.filter();
            this.searchBox().focus();
          }
          return;
        }
        case 33:
          evt.preventDefault();
          this.navigate('up', 10);
          return;
        case 34:
          evt.preventDefault();
          this.navigate('down', 10);
          return;
        case 38:
          evt.preventDefault();
          this.navigate('up');
          return;
        case 40:
          evt.preventDefault();
          this.navigate('down');
          return;
        case 65:
          if (this.keys.ctrl && this.el.shadowRoot!.activeElement !== this.searchBox()) {
            this.selectSignal(evt as any, true);
          }
          return;
      }
    };

    this.el.onkeyup = (evt: KeyboardEvent) => {
      switch (evt.keyCode) {
        case 16:
          this.keys.shift = false;
          return;
        case 17:
          this.keys.ctrl = false;
          return;
      }
    };
  }

  // -------------------------------------------------------- Public methods

  /** Load a signal dictionary from the parsed VCD file. */
  @Method()
  async load(dict: any[]): Promise<void> {
    this.signalDict = dict;
    this.allTypes = [];
    for (const entry of this.signalDict) {
      if (this.allTypes.indexOf(entry.kind) === -1 && entry.kind !== 'module') {
        this.allTypes.push(entry.kind);
        this.filterTypes.push(entry.kind);
      }
    }
  }

  /** Show the search dialog. */
  @Method()
  async show(): Promise<void> {
    this.el.style.opacity = '1';
    this.el.style.pointerEvents = 'all';
    this.searchBox().value = '';
    this.filter();
    setTimeout(() => {
      this.searchBox().focus();
    }, 105);
  }

  /** Hide the search dialog. */
  @Method()
  async hide(): Promise<void> {
    this.el.style.opacity = '0';
    this.el.style.pointerEvents = 'none';
  }

  /** Toggle the search dialog visibility. */
  @Method()
  async toggle(): Promise<void> {
    if (this.el.style.opacity === '1') {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Mark signals as disabled (already added to workspace). */
  markDisabled(ids: number[]): void {
    this.el.shadowRoot!.querySelectorAll('#signals li').forEach((li: Element) => {
      const uid = +(li as HTMLElement).id.replace('sig-', '');
      if (ids.includes(uid)) {
        li.classList.add('disabled');
      }
    });
  }

  /** Restore previously disabled signals. */
  restore(ids: number[]): void {
    this.el.shadowRoot!.querySelectorAll('#signals li.disabled').forEach((li: Element) => {
      const uid = +(li as HTMLElement).id.replace('sig-', '');
      if (ids.includes(uid)) {
        li.classList.remove('disabled');
      }
    });
  }

  /** Update the visible signal count label. */
  updateSignalCount(): void {
    this.signalDict = [...this.signalDict];
  }

  // -------------------------------------------------------- Internal logic

  private searchBox(): HTMLInputElement {
    return this.el.shadowRoot!.getElementById('search') as HTMLInputElement;
  }

  private getSelectedSignals(): Element[] {
    if (!this.el.shadowRoot) return [];
    return Array.prototype.slice.call(
      this.el.shadowRoot.querySelectorAll('#signals li.selected'),
    );
  }

  private getVisibleSignalCount(): string {
    const signals = this.el.shadowRoot?.getElementById('signals');
    if (!signals) return '';
    const visible = signals.querySelectorAll('li:not(.filtered):not(.disabled)');
    return `(${visible.length})`;
  }

  private selectSignal = (evt: MouseEvent, selectAll: boolean = false): void => {
    if (!this.keys.ctrl) {
      this.el.shadowRoot!.querySelectorAll('#signals li').forEach(li => {
        li.classList.remove('selected');
      });
    }

    const target = evt.currentTarget as HTMLElement;
    target.classList.add('selected');

    let newIndex = this.findNavIndexById(target.id);

    const visibleItems = this.el.shadowRoot!.querySelectorAll(
      '#signals li:not(.filtered):not(.disabled)',
    );

    if (visibleItems) {
      if (this.keys.shift) {
        const start = Math.min(this.navIndex, newIndex);
        const end = Math.max(this.navIndex, newIndex);
        for (let i = start; i <= end; i++) {
          visibleItems[i].classList.add('selected');
        }
      }

      if (selectAll) {
        visibleItems.forEach(li => li.classList.add('selected'));
      }

      this.navIndex = newIndex;
    }
  };

  private quickAdd = (): void => {
    this.addSignals();
  };

  private findNavIndexById(id: string): number {
    const items = this.el.shadowRoot!.querySelectorAll(
      '#signals li:not(.filtered):not(.disabled)',
    );
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) return i;
    }
    return -1;
  }

  private addSignals(asGroup: boolean = false): void {
    const signals: Signal[] = [];
    const groupSignal: Signal = {
      id: -1,
      vid: '',
      name: 'group',
      scope: '',
      size: 0,
      type: SignalType.group,
      children: [],
      display: JSON.parse(JSON.stringify(DEFAULT_CONFIG.display.defaultTraceStyle)),
    };

    this.el.shadowRoot!.querySelectorAll('#signals li.selected').forEach((li: Element) => {
      const entry = this.signalDict[parseInt(li.id.replace('sig-', ''))];
      const sig: Signal = {
        id: entry.uid,
        vid: entry.tid,
        name: entry.name,
        scope: entry.scope,
        size: entry.size,
        type: (SignalType as any)[entry.kind],
        children: [],
        display: JSON.parse(JSON.stringify(DEFAULT_CONFIG.display.defaultTraceStyle)),
      };

      if (sig.type === SignalType.real) {
        sig.display.radix = Radix.Float;
      }
      sig.display.y = 0;
      sig.display.renderer = sig.size > 1 ? RendererType.Bus : RendererType.Line;

      if (asGroup) {
        groupSignal.children.push(sig);
      } else {
        signals.push(sig);
      }

      li.classList.remove('selected', 'filtered');
      li.classList.add('disabled');
      this.navigate('');
    });

    if (asGroup) {
      groupSignal.name = this.getPrefix(groupSignal.children);
      if (groupSignal.name.length <= 1) {
        groupSignal.name = 'group';
      }
      signals.push(groupSignal);
    }

    this.add.emit(signals);
  }

  private getPrefix(signals: Signal[]): string {
    const names = signals.map(s => s.name);
    let prefix = names[0];
    let length = prefix.length;

    for (let i = 1; i < names.length && length > 0; i++) {
      const name = names[i];
      let j = 0;
      const max = Math.min(name.length, length);
      while (++j < max && name.charAt(j) === prefix.charAt(j));
      length = j;
    }

    let result = prefix.substring(0, length);
    if (result.endsWith('_t')) {
      result = result.substr(0, result.length - 2);
    }
    if (result.endsWith('_')) {
      result = result.substr(0, result.length - 1);
    }
    return result;
  }

  private navigate(direction: string, step: number = 1): void {
    const items = this.el.shadowRoot!.querySelectorAll(
      '#signals li:not(.filtered):not(.disabled)',
    );

    this.navIndex =
      direction === 'up'
        ? this.navIndex - step
        : direction === 'down'
          ? this.navIndex + step
          : this.navIndex;

    if (this.navIndex < 0) {
      this.navIndex = -1;
      this.searchBox().focus();
    }
    if (this.navIndex > items.length - 1) {
      this.navIndex = items.length - 1;
    }

    if (!this.keys.shift) {
      this.clear('selected');
    }

    const item = items[this.navIndex] as HTMLElement;
    if (item) {
      item.focus();
      item.classList.add('selected');
    }
  }

  private clear(...classes: string[]): void {
    this.el.shadowRoot!.querySelectorAll('#signals li').forEach(li => {
      li.classList.remove(...classes);
    });
  }

  private filter = (): void => {
    this.clear('selected', 'filtered');
    this.navIndex = -1;

    const query = this.moduleScope + this.searchBox().value.toLowerCase();

    const allItems = this.el.shadowRoot!.querySelectorAll('#signals li');

    // Filter by type
    Array.from(allItems)
      .filter(li => this.filterTypes.indexOf(li.getAttribute('data-type')!) === -1)
      .forEach(li => li.classList.add('filtered'));

    // Filter by search text
    if (query !== '') {
      this.el.shadowRoot!
        .querySelectorAll(`#signals li:not([data-name*="${query}"])`)
        .forEach(li => li.classList.add('filtered'));
    }

    // Highlight active module
    if (this.moduleScope !== '') {
      const moduleLis = this.el.shadowRoot!.querySelectorAll('#modules li');
      moduleLis.forEach(li => li.classList.remove('selected'));

      const selected = this.el.shadowRoot!.querySelectorAll(
        `#modules li[data-scope="${this.moduleScope}"]`,
      );
      if (selected.length > 0) {
        selected[0].classList.add('selected');
      }
    }
  };

  private toggleFilter = (evt: MouseEvent): void => {
    const target = evt.composedPath()[0] as HTMLElement;
    const typeName = target.id.replace('type-filter-', '');
    const idx = this.filterTypes.indexOf(typeName);

    if (idx > -1) {
      this.filterTypes.splice(idx, 1);
    } else {
      this.filterTypes.push(typeName);
    }

    if (target.classList.contains('selected')) {
      target.classList.remove('selected');
    } else {
      target.classList.add('selected');
    }

    this.filter();
  };

  // ----------------------------------------------------------- Templates

  private renderSignal(entry: VcdSignalEntry) {
    if (entry.kind === 'module') return null;

    const typeLower = entry.kind.toString().toLowerCase();
    let iconPrefix = '';
    if (entry.name.includes('clk')) {
      iconPrefix = 'clk-';
    } else if (entry.size > 1) {
      iconPrefix = 'bus-';
    }

    const iconKey = iconPrefix + typeLower;
    const icon = SIGNAL_ICONS[iconKey];

    const scopeParts = entry.scope
      .split('.')
      .slice(1)
      .map((part, idx) => (
        <span class={`scope scope-${idx + 1}`}>{part}</span>
      ));

    return (
      <li
        id={`sig-${entry.uid}`}
        tabindex={-1}
        data-name={`${entry.scope}.${entry.name.toLowerCase()}`}
        data-module={entry.parent.toString()}
        data-type={entry.kind}
        onClick={this.selectSignal}
        onDblClick={this.quickAdd}
      >
        {icon}
        <div class="signal-name">
          {scopeParts}
          {entry.name}
        </div>
        {entry.size > 1 ? <div class="signal-size">{entry.size - 1}:0</div> : null}
      </li>
    );
  }

  private renderModule(entry: VcdSignalEntry, depth: number) {
    const children = this.signalDict.filter(
      e => e.kind === 'module' && e.parent === entry.uid,
    );

    return (
      <li
        id={`m-${entry.uid}`}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          this.moduleScope = entry.scope + '.';
          this.filter();
        }}
        data-scope={entry.scope + '.'}
      >
        <div
          class="module-label"
          style={{ paddingLeft: `${16 * depth + 4}px`, paddingRight: '4px' }}
        >
          <svg class={`icon module scope-${depth}`}>
            <use xlinkHref="#icon_browser_module" />
          </svg>
          <span>{entry.name}</span>
        </div>
        <ul class="module-children">
          {children.map(child => this.renderModule(child, depth + 1))}
        </ul>
      </li>
    );
  }

  private renderTypeFilter(typeName: string) {
    const isSelected = this.filterTypes.indexOf(typeName) !== -1;
    const isAvailable = this.allTypes.indexOf(typeName) !== -1;
    const icon = SIGNAL_ICONS[typeName];

    return (
      <div
        id={`type-filter-${typeName}`}
        class={isSelected ? 'selected' : ''}
        {...(!isAvailable ? { disabled: true } : {})}
        onClick={this.toggleFilter}
      >
        {icon}
        {typeName.charAt(0).toUpperCase() + typeName.slice(1)}
      </div>
    );
  }

  // -------------------------------------------------------------- Render

  render() {
    const topLevelModules = this.signalDict.filter(
      e => e.kind === 'module' && e.parent === -1,
    );

    return [
      <div id="row-top" class="row">
        <input
          id="search"
          type="text"
          autocomplete="off"
          spellcheck={false}
          placeholder="Search..."
          onInput={this.filter}
        />
      </div>,

      <div id="row-middle" class="row">
        <div class="col">
          <span class="label">Modules</span>
          <ul id="modules" class="panel">
            {topLevelModules.map(m => this.renderModule(m, 0))}
          </ul>
        </div>
        <div class="col">
          <span class="label">Signals {this.getVisibleSignalCount()}</span>
          <ul id="signals" class="panel">
            {this.signalDict.map(entry => this.renderSignal(entry))}
          </ul>
        </div>
      </div>,

      <div id="row-filter" class="row">
        {this.renderTypeFilter('wire')}
        {this.renderTypeFilter('reg')}
        {this.renderTypeFilter('logic')}
        {this.renderTypeFilter('bit')}
        {this.renderTypeFilter('integer')}
        {this.renderTypeFilter('real')}
        {this.renderTypeFilter('parameter')}
        {this.renderTypeFilter('event')}
      </div>,
    ];
  }
}
