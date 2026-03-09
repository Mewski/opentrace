import { Component, h, Prop, State, Element, Event, EventEmitter } from '@stencil/core';
import { Signal, SignalType, RendererType, Radix } from '../../utils/types';

/**
 * Properties panel shown below the sidebar.
 *
 * Displays and edits shared display properties for the currently
 * selected signal(s): color, fill, renderer mode, endianness, radix,
 * and waveform height.
 */
@Component({
  tag: 'ot-properties',
  styleUrl: 'ot-properties.css',
  shadow: true,
})
export class OtProperties {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** The set of currently selected signals whose properties are shown/edited. */
  @Prop() signals: Signal[] = [];

  // ----------------------------------------------------------------- State

  /** True when at least one selected signal has size > 1 (multi-bit). */
  @State() hasBuses: boolean = false;

  /** True when endian swapping is available (size > 8 and divisible by 8). */
  @State() hasEndianSwapping: boolean = false;

  /** Common color across all selected signals (or default gray). */
  @State() commonColor: string = 'gray';

  /** Common fill across all selected signals (or default 0.3). */
  @State() commonFill: number = 0.3;

  /** Common endian setting (null if mixed). */
  @State() commonEndian: boolean | null = null;

  /** Common renderer type (null if mixed). */
  @State() commonRenderer: string | null = null;

  /** Common radix (null if mixed). */
  @State() commonRadix: string | null = null;

  /** Common signal type (null if mixed). */
  @State() commonType: SignalType | null = null;

  // ---------------------------------------------------------------- Events

  /** Emitted when a property changes, requesting the canvas to redraw. */
  @Event({ bubbles: true, composed: true }) redraw!: EventEmitter<{ resize: boolean }>;

  // -------------------------------------------------------- Internal logic

  private dispatchUpdate(resize: boolean = false): void {
    this.redraw.emit({ resize });
    this.updateCommonAttributes();
  }

  private setMode(renderer: RendererType): void {
    this.signals.forEach(sig => {
      if (sig.size > 1) {
        sig.display.renderer = renderer;
      }
    });
    this.dispatchUpdate();
  }

  private setEndian(littleEndian: boolean): void {
    this.signals.forEach(sig => {
      if (sig.size > 1) {
        sig.display.littleEndian = littleEndian;
      }
    });
    this.dispatchUpdate();
  }

  private incSize = (): void => {
    this.signals.forEach(sig => {
      sig.display.height += 10;
    });
    this.dispatchUpdate(true);
  };

  private decSize = (): void => {
    this.signals.forEach(sig => {
      sig.display.height = Math.max(sig.display.height - 10, 14);
    });
    this.dispatchUpdate(true);
  };

  private setColor = (): void => {
    const picker = this.el.shadowRoot!.getElementById('picker0') as any;
    this.signals.forEach(sig => {
      sig.display.color = picker.color;
      sig.display.fill = picker.fill;
    });
    this.dispatchUpdate();
  };

  private setRadix = (): void => {
    const select = this.el.shadowRoot!.getElementById('radix-select') as HTMLSelectElement;
    const value = select.value;
    this.signals.forEach(sig => {
      sig.display.radix = value;
    });
    this.dispatchUpdate();
  };

  private updateCommonAttributes(): void {
    this.hasBuses = false;
    this.commonColor = 'gray';
    this.commonFill = 0.3;
    this.commonEndian = null;
    this.commonRenderer = null;
    this.hasEndianSwapping = false;
    this.commonRadix = null;
    this.commonType = null;

    if (this.signals.length > 0) {
      this.commonColor = this.signals[0].display.color;
      this.commonFill = this.signals[0].display.fill as number;
      this.commonEndian = this.signals[0].display.littleEndian ?? null;
      this.commonRadix = this.signals[0].display.radix;

      if (this.signals[0].size > 8 && this.signals[0].size % 8 === 0) {
        this.hasEndianSwapping = true;
      }

      this.commonRenderer = this.signals[0].display.renderer;
      this.commonType = this.signals[0].type;

      this.signals.forEach(sig => {
        if (sig.size > 1) {
          this.hasBuses = true;
        }
      });
    }
  }

  // -------------------------------------------------------------- Render

  render() {
    this.updateCommonAttributes();

    const isReal = this.commonType === SignalType.real;

    return (
      <div class="container">
        {/* Color picker and height controls */}
        <div id="prop-color" class="item">
          <color-picker
            id="picker0"
            onColorChange={this.setColor}
            color={this.commonColor}
            fill={this.commonFill}
          />
          <div id="vsize-picker" class="vgroup">
            <div onClick={this.incSize}>+</div>
            <div onClick={this.decSize}>-</div>
          </div>
        </div>

        {/* Renderer mode toggle (digital / step / linear) */}
        <div id="prop-mode" class="item">
          <div class="hgroup">
            <div
              {...(this.commonRenderer === RendererType.Bus ? { selected: true } : {})}
              {...(!this.hasBuses ? { disabled: true } : {})}
              onClick={() => this.setMode(RendererType.Bus)}
            >
              <svg class="icon"><use xlinkHref="#icon_renderer_digital" /></svg>
            </div>
            <div
              {...(this.commonRenderer === RendererType.AnalogStep ? { selected: true } : {})}
              {...(!this.hasBuses ? { disabled: true } : {})}
              onClick={() => this.setMode(RendererType.AnalogStep)}
            >
              <svg class="icon"><use xlinkHref="#icon_renderer_step" /></svg>
            </div>
            <div
              {...(this.commonRenderer === RendererType.AnalogLinear ? { selected: true } : {})}
              {...(!this.hasBuses ? { disabled: true } : {})}
              onClick={() => this.setMode(RendererType.AnalogLinear)}
            >
              <svg class="icon"><use xlinkHref="#icon_renderer_linear" /></svg>
            </div>
          </div>
        </div>

        {/* Endianness toggle (currently hidden via CSS) */}
        <div id="prop-endian" class="item">
          <div class="hgroup">
            <div
              {...(!this.hasBuses || !this.hasEndianSwapping ? { disabled: true } : {})}
              {...(this.commonEndian === false ? { selected: true } : {})}
              onClick={() => this.setEndian(false)}
            >
              BE
            </div>
            <div
              {...(!this.hasBuses || !this.hasEndianSwapping ? { disabled: true } : {})}
              {...(this.commonEndian === true ? { selected: true } : {})}
              onClick={() => this.setEndian(true)}
            >
              LE
            </div>
          </div>
        </div>

        {/* Radix select */}
        <div id="prop-radix" class="item">
          <select
            id="radix-select"
            disabled={!this.hasBuses}
            onChange={this.setRadix}
          >
            <option selected={this.commonRadix === Radix.Bin} disabled={isReal} value="bin">BIN</option>
            <option selected={this.commonRadix === Radix.Oct} disabled={isReal} value="oct">OCT</option>
            <option selected={this.commonRadix === Radix.Hex} disabled={isReal} value="hex">HEX</option>
            <option selected={this.commonRadix === Radix.SignedDec} disabled={isReal} value="signed">Signed</option>
            <option selected={this.commonRadix === Radix.UnsignedDec} disabled={isReal} value="unsigned">Unsigned</option>
            <option selected={this.commonRadix === Radix.ASCII} disabled={isReal} value="ascii">ASCII</option>
            <option selected={this.commonRadix === Radix.UTF8} disabled={isReal} value="utf8">UTF-8</option>
            <option selected={this.commonRadix === Radix.Float} disabled={isReal} value="float">Float</option>
          </select>
        </div>
      </div>
    );
  }
}
