import { Component, h, Prop, State, Element, Event, EventEmitter, Method } from '@stencil/core';
import { Signal, SignalType } from '../../utils/types';
import { SIGNAL_ICONS, getSignalIconKey } from '../../utils/icons';

/**
 * Renders a single signal row inside the sidebar.
 *
 * For **group** signals it shows a group header with an editable alias
 * and recursively renders children as nested `ot-sidebar-item` elements.
 * For **divider** signals it renders a blank header.
 * For all other types it renders the icon, optional bus-size badge,
 * signal name (with scope), and the current value display.
 */
@Component({
  tag: 'ot-sidebar-item',
  styleUrl: 'ot-sidebar-item.css',
  shadow: false,
})
export class OtSidebarItem {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** The signal data object to render. */
  @Prop() signal!: Signal;

  /** Current cursor value for this signal (displayed in the radix column). */
  @Prop() value: string = '';

  // ----------------------------------------------------------------- State

  /** When true the group alias is being inline-edited. */
  @State() editAlias: boolean = false;

  /** Resolved icon JSX for the signal type. */
  @State() icon: any;

  // ---------------------------------------------------------------- Events

  /** Bubbles up to request a full signal-height recalculation. */
  @Event({ bubbles: true, composed: true }) resizeSignals!: EventEmitter<void>;

  // ------------------------------------------------------------- Lifecycle

  connectedCallback() {
    this.resolveIcon();
    this.el.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    this.el.removeEventListener('keydown', this.handleKeyDown);
  }

  componentDidLoad() {
    this.resizeSignal();
    this.resizeSignals.emit();
  }

  componentDidUpdate() {
    this.resizeSignal();
  }

  // -------------------------------------------------------- Internal logic

  private handleKeyDown = (evt: KeyboardEvent) => {
    if (evt.key === 'Escape' || evt.key === 'Enter') {
      if (this.editAlias) {
        this.editAlias = false;
      }
    }
  };

  private resolveIcon() {
    if (!this.signal) return;
    const typeName = SignalType[this.signal.type] as string;
    const key = getSignalIconKey(this.signal.name, typeName, this.signal.size);
    this.icon = SIGNAL_ICONS[key];
  }

  /** Measure the rendered element and write display.y / display.height back. */
  @Method()
  async resizeSignal() {
    if (!this.el.children.length) return;
    const rect = this.el.children[0].getBoundingClientRect();
    if (this.signal?.display) {
      this.signal.display.y = rect.y;
      this.signal.display.height = rect.height;
    }
  }

  private handleEditAlias = () => {
    this.editAlias = true;
    if (!this.signal.display.alias) {
      this.signal.display.alias = this.signal.name;
    }
  };

  private handleAliasInput = (evt: InputEvent) => {
    const input = evt.composedPath()[0] as HTMLInputElement;
    this.signal.display.alias = input.value;
  };

  // -------------------------------------------------------------- Render

  render() {
    const sig = this.signal;
    if (!sig) return null;

    // ----- Group type
    if (sig.type === SignalType.group) {
      return (
        <div>
          <div class="wg-header" onDblClick={this.handleEditAlias}>
            {this.editAlias ? (
              <input
                id="input-alias"
                type="text"
                value={sig.display.alias}
                onClick={(e: any) => (e.target as HTMLInputElement).setSelectionRange(0, (e.target as HTMLInputElement).value.length)}
                onInput={this.handleAliasInput}
                autoFocus
              />
            ) : (
              sig.display.alias || sig.name
            )}
          </div>
          <div class="wg-body">
            {sig.children.map(child => (
              <ot-sidebar-item
                signal={child}
                id={`wi-${child.id}`}
                class="item wi-container"
                style={{ height: `${child.display.height}px` }}
              />
            ))}
          </div>
        </div>
      );
    }

    // ----- Divider type
    if (sig.type === SignalType.divider) {
      return <div class="wg-header">&nbsp;</div>;
    }

    // ----- Standard signal
    return (
      <div class="wi-item">
        <div class="wi-icon" style={{ color: sig.display.color }}>
          {this.icon}
        </div>
        {sig.size > 1 ? (
          <div class="wi-size">
            <div class="signal-size">{sig.size - 1}:0</div>
          </div>
        ) : null}
        <div class="wi-label">
          <span class="wi-name">
            <span class="wi-scope">{sig.scope}.</span>
            {sig.name}
          </span>
        </div>
        <div class="wi-radix" style={{ color: sig.display.color }}>
          <div>{this.value}</div>
        </div>
      </div>
    );
  }
}
