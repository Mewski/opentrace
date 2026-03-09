import { Component, h, Prop, Event, EventEmitter, Element } from '@stencil/core';
import { Radix, SignalDisplay } from '../../utils/types';

/**
 * Dropdown menu for selecting the display radix of a signal value.
 *
 * Lists all `Radix` members (bin, oct, hex, unsigned, signed, ascii,
 * utf8, float) and highlights the currently-selected one.
 * Emits `waveformChanged` on selection and `select` to let the
 * parent know a choice was made (so it can close the dropdown).
 */
@Component({
  tag: 'ot-sidebar-radix',
  styleUrl: 'ot-sidebar-radix.css',
  shadow: true,
})
export class OtSidebarRadix {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** Display options (contains `.radix` and `.color`). */
  @Prop({ mutable: true }) options: SignalDisplay = {} as SignalDisplay;

  // ---------------------------------------------------------------- Events

  /** Emitted when the radix changes. */
  @Event({ bubbles: true, composed: true }) waveformChanged!: EventEmitter<SignalDisplay>;

  /** Emitted after a radix is selected (used by parent to close the menu). */
  @Event({ eventName: 'radixSelect' }) radixSelect!: EventEmitter<void>;

  /** Requests a full signal-height recalculation. */
  @Event({ bubbles: true, composed: true }) resizeSignals!: EventEmitter<void>;

  // ------------------------------------------------------------- Lifecycle

  componentDidLoad() {
    this.resizeSignals.emit();
  }

  // -------------------------------------------------------- Internal logic

  private handleClick = (evt: MouseEvent) => {
    const target = evt.target as HTMLElement;
    const key = target.id;
    this.options.radix = (Radix as any)[key] ?? key;
    this.dispatchUpdate();
    this.radixSelect.emit();
  };

  private dispatchUpdate(): void {
    this.waveformChanged.emit(this.options);
  }

  // -------------------------------------------------------------- Render

  render() {
    // Build the list of radix names from the enum (skip numeric reverse-map keys).
    const radixNames: string[] = Object.keys(Radix).filter(k => isNaN(Number(k)));

    return (
      <ul>
        {radixNames.map(name => {
          const isSelected = this.options.radix === (Radix as any)[name];
          return (
            <li
              id={name}
              class={isSelected ? 'selected' : ''}
              onClick={this.handleClick}
              style={{ color: isSelected ? this.options.color : 'inherit' }}
            >
              {name}
            </li>
          );
        })}
      </ul>
    );
  }
}
