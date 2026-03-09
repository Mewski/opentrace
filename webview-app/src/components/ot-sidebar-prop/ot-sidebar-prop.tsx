import { Component, h, Prop, Element, Event, EventEmitter } from '@stencil/core';
import { RendererType, SignalDisplay } from '../../utils/types';

/**
 * Inline property editor for a single signal.
 *
 * Displays a color picker, renderer-type toggle buttons
 * (digital / step / linear), and a format button.
 * Emits `waveformChanged` when any property is modified so the
 * parent can update the canvas.
 */
@Component({
  tag: 'ot-sidebar-prop',
  styleUrl: 'ot-sidebar-prop.css',
  shadow: true,
})
export class OtSidebarProp {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** Display options for the signal being edited. */
  @Prop({ mutable: true }) options: SignalDisplay = {} as SignalDisplay;

  /** Bit-width of the signal (controls which renderer buttons are shown). */
  @Prop() busSize: number = 0;

  // ---------------------------------------------------------------- Events

  /** Emitted whenever a display property is changed. */
  @Event({ bubbles: true, composed: true }) waveformChanged!: EventEmitter<SignalDisplay>;

  /** Requests a full signal-height recalculation. */
  @Event({ bubbles: true, composed: true }) resizeSignals!: EventEmitter<void>;

  // ------------------------------------------------------------- Lifecycle

  componentDidLoad() {
    this.resizeSignals.emit();
  }

  // -------------------------------------------------------- Internal logic

  private handleColor = (evt: CustomEvent<{ color: string; fill: number }>) => {
    this.options.color = evt.detail.color;
    this.options.fill = evt.detail.fill;
    this.dispatchUpdate();
  };

  private handleRendererClick = (evt: MouseEvent) => {
    const name = (evt.currentTarget as HTMLButtonElement).name;

    switch (name) {
      case 'square':
        this.options.renderer = this.busSize > 1 ? RendererType.Bus : RendererType.Line;
        break;
      case 'step':
        this.options.renderer = RendererType.AnalogStep;
        break;
      case 'linear':
        this.options.renderer = RendererType.AnalogLinear;
        break;
    }

    this.dispatchUpdate();
  };

  private dispatchUpdate(): void {
    this.waveformChanged.emit(this.options);
  }

  /** Hide the color-picker dropdown (called externally). */
  hidePicker(): void {
    const picker = this.el.shadowRoot?.getElementById('picker0') as any;
    picker?.hide();
  }

  // -------------------------------------------------------------- Render

  render() {
    const isLine = this.options.renderer === RendererType.Line;

    return [
      // Renderer icon definitions (inline SVG symbols)
      <svg style={{ display: 'none' }}>
        <symbol id="wave-square" viewBox="0 0 640 512">
          <path fill="currentColor" d="M476 480H324a36 36 0 0 1-36-36V96h-96v156a36 36 0 0 1-36 36H16a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h112V68a36 36 0 0 1 36-36h152a36 36 0 0 1 36 36v348h96V260a36 36 0 0 1 36-36h140a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16H512v156a36 36 0 0 1-36 36z" />
        </symbol>
        <symbol id="wave-step" viewBox="0 0 15.847 6.301">
          <path data-name="Path 5" d="M3.788,8.5H5.769V6.714h1.7V5.208H9.416V6.993h1.7V8.779h1.981v1.73h2.641V8.779h1.792V7.216h2.107" transform="translate(-3.788 -4.708)" fill="none" stroke="currentColor" stroke-width="1" />
        </symbol>
        <symbol id="wave-linear" viewBox="0 0 15.495 5.98">
          <path data-name="Path 2" d="M4.068,8.617c2.955-2.955,4.347-3.315,6.9-.867.1.1.447.456.813.867,3.005,3.365,4.181,3.3,7.055,0" transform="translate(-3.714 -5.636)" fill="none" stroke="currentColor" stroke-width="1.5" />
        </symbol>
      </svg>,

      <div class="prop-color">
        <color-picker
          id="picker0"
          onColorChange={this.handleColor}
          color={this.options.color}
          fill={typeof this.options.fill === 'number' ? this.options.fill : parseFloat(this.options.fill as string) || 0}
        />
      </div>,

      isLine ? (
        <div class="prop-type">
          <div class="btn-group">
            {/* Line signals don't expose renderer switching */}
          </div>
        </div>
      ) : (
        [
          <div class="prop-type">
            <div class="btn-group">
              <button
                name="square"
                class={`btn ${[RendererType.Bus, RendererType.Line].includes(this.options.renderer as RendererType) ? 'selected' : ''}`}
                onClick={this.handleRendererClick}
              >
                <svg><use xlinkHref="#icon_renderer_digital" /></svg>
              </button>
              <button
                name="step"
                class={`btn ${this.options.renderer === RendererType.AnalogStep ? 'selected' : ''}`}
                onClick={this.handleRendererClick}
              >
                <svg><use xlinkHref="#icon_renderer_step" /></svg>
              </button>
              <button
                name="linear"
                class={`btn ${this.options.renderer === RendererType.AnalogLinear ? 'selected' : ''}`}
                onClick={this.handleRendererClick}
              >
                <svg><use xlinkHref="#icon_renderer_linear" /></svg>
              </button>
            </div>
          </div>,
          <div class="prop-format">
            <button name="format" class="btn">
              <span>f(x)</span>
            </button>
          </div>,
        ]
      ),
    ];
  }
}
