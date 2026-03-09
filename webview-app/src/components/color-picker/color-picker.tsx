import { Component, h, Prop, State, Element, Event, EventEmitter, Method } from '@stencil/core';
import { DEFAULT_CONFIG } from '../../utils/constants';

/**
 * Color selection widget.
 *
 * Displays a small color swatch that, when clicked, opens a dropdown
 * with a palette of preset colors and a fill-opacity slider.
 * Emits a `change` event whenever a color or fill value is modified.
 */
@Component({
  tag: 'color-picker',
  styleUrl: 'color-picker.css',
  shadow: true,
})
export class ColorPicker {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** The currently selected CSS color string. */
  @Prop({ mutable: true }) color: string = 'red';

  /** Fill opacity (0 = transparent, 1 = fully opaque). */
  @Prop({ mutable: true }) fill: number = 0.5;

  /** Array of CSS color strings to show in the swatch palette. */
  @Prop() palette: string[] = DEFAULT_CONFIG.theme.palette;

  // ---------------------------------------------------------------- Events

  /** Emitted when the user selects a new color or changes the fill. */
  @Event({ eventName: 'colorChange' }) colorChange!: EventEmitter<{ color: string; fill: number }>;

  // ------------------------------------------------------------- Lifecycle

  connectedCallback() {
    this.el.addEventListener('click', (e: MouseEvent) => e.stopPropagation(), { passive: true } as any);
    this.el.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation(), { passive: true } as any);
    this.el.addEventListener('pointerdown', (e: PointerEvent) => e.stopPropagation(), { passive: true } as any);
    this.el.addEventListener('touchstart', (e: TouchEvent) => e.stopPropagation(), { passive: true } as any);

    window.addEventListener('click', () => this.hide(), { passive: true } as any);

    this.el.onmouseout = () => this.hidePreview();
  }

  // -------------------------------------------------------- Internal logic

  /**
   * Parse a CSS color string into an [r, g, b] uint8 array.
   * Supports hex (#rgb, #rrggbb) and named CSS colors via a temp canvas.
   */
  private parseColorToRgb(color: string): [number, number, number] {
    // Try hex parsing first
    let hex = color;
    if (hex.startsWith('#')) {
      hex = hex.slice(1);
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length === 6) {
        return [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16),
        ];
      }
    }

    // Fallback: use a temporary canvas to resolve named/rgb colors
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2]];
  }

  /** Compute the fill color (dimmed version of the stroke color). */
  private get fillColor(): string {
    const [r, g, b] = this.parseColorToRgb(this.color);
    const alpha = this.fill === 0 ? 0 : 1;
    return `rgb(${r * this.fill}, ${g * this.fill}, ${b * this.fill}, ${alpha})`;
  }

  private togglePicker = () => {
    const dialog = this.el.shadowRoot!.getElementById('picker-dialog')!;
    const icon = this.el.shadowRoot!.getElementById('picker-icon')!;

    dialog.style.display = dialog.style.display === 'flex' ? 'none' : 'flex';

    const rect = icon.getBoundingClientRect();
    dialog.style.top = rect.bottom + 'px';
    dialog.style.left = rect.left + 'px';
  };

  @Method()
  async hide(): Promise<void> {
    const dialog = this.el.shadowRoot?.getElementById('picker-dialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  private handleFillChange = () => {
    const slider = this.el.shadowRoot!.getElementById('fill') as HTMLInputElement;
    this.fill = parseInt(slider.value) / 100;
    this.colorChange.emit({ color: this.color, fill: this.fill });
  };

  private selectColor = (evt: MouseEvent) => {
    const target = evt.currentTarget as HTMLElement;
    this.color = target.style.backgroundColor;
    this.colorChange.emit({ color: this.color, fill: this.fill });
  };

  private finalizeColor = (evt: MouseEvent) => {
    const target = evt.currentTarget as HTMLElement;
    this.color = target.style.backgroundColor;
    this.togglePicker();
    this.colorChange.emit({ color: this.color, fill: this.fill });
  };

  private showPreview = (evt: MouseEvent) => {
    const preview = this.el.shadowRoot!.getElementById('preview')!;
    const dialog = this.el.shadowRoot!.getElementById('picker-dialog')!;
    const swatch = evt.currentTarget as HTMLElement;
    const swatchRect = swatch.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();

    preview.style.display = 'inline-block';
    preview.style.left = (swatchRect.x - dialogRect.x - 1) + 'px';
    preview.style.top = (swatchRect.y - dialogRect.y - 1) + 'px';
    preview.style.width = (swatchRect.width + 2) + 'px';
    preview.style.height = (swatchRect.height + 2) + 'px';
    preview.style.backgroundColor = swatch.style.backgroundColor;
  };

  private hidePreview = () => {
    const preview = this.el.shadowRoot?.getElementById('preview');
    if (preview) {
      preview.style.display = 'none';
    }
  };

  // -------------------------------------------------------------- Render

  render() {
    return [
      <div
        id="picker-icon"
        onClick={this.togglePicker}
        style={{
          borderColor: this.color,
          backgroundColor: this.fillColor,
        }}
      />,
      <div id="picker-dialog">
        <input
          id="fill"
          class="slider"
          type="range"
          min="0"
          max="100"
          value={Math.floor(100 * this.fill).toString()}
          onChange={this.handleFillChange}
        />
        {this.palette.map(c => (
          <div
            class="swatch"
            onMouseOver={this.showPreview}
            style={{ background: c }}
          >
            &nbsp;
          </div>
        ))}
        <div
          id="preview"
          onClick={this.selectColor}
          onDblClick={this.finalizeColor}
        />
      </div>,
    ];
  }
}
