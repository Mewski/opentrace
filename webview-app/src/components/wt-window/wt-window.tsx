import {
  Component,
  h,
  Prop,
  State,
  Element,
  Method,
} from '@stencil/core';

// ---------------------------------------------------------------------------
// wt-window  –  Modal / dialog window with title bar and close support
// ---------------------------------------------------------------------------

@Component({
  tag: 'wt-window',
  styleUrl: 'wt-window.css',
  shadow: true,
})
export class WtWindow {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** Title displayed in the gradient title bar. Empty string hides the bar. */
  @Prop({ attribute: 'title' }) windowTitle: string = '';

  /** When true, applies a backdrop blur effect behind the window. */
  @Prop({ mutable: true, reflect: true }) backgroundBlur: boolean = false;

  /** Controls visibility of the modal overlay. */
  @Prop({ mutable: true, reflect: true }) visible: boolean = false;

  // ----------------------------------------------------------- Watchers

  /**
   * Manually sync visibility to inline styles because shadow DOM
   * transition effects require direct style manipulation.
   */
  componentWillRender() {
    if (this.visible) {
      this.el.style.opacity = '1';
      this.el.style.pointerEvents = 'all';
    } else {
      this.el.style.opacity = '0';
      this.el.style.pointerEvents = 'none';
    }

    if (this.backgroundBlur) {
      this.el.classList.add('blur');
      this.el.style.setProperty('background', 'var(--window-blur-background)');
      this.el.style.setProperty('backdrop-filter', 'blur(10px)');
      this.el.style.setProperty('-webkit-backdrop-filter', 'blur(10px)');
    } else {
      this.el.classList.remove('blur');
      this.el.style.removeProperty('background');
      this.el.style.removeProperty('backdrop-filter');
      this.el.style.removeProperty('-webkit-backdrop-filter');
    }
  }

  // -------------------------------------------------------- Public API

  /** Show the window. */
  @Method()
  async show(): Promise<void> {
    this.visible = true;
  }

  /** Hide the window and deselect any machine-list entries. */
  @Method()
  async hide(): Promise<void> {
    this.visible = false;
    // Clear any selected machine entries (legacy from settings panels)
    this.el.shadowRoot!.querySelectorAll('#machine-list li .machine').forEach((el) => {
      el.classList.remove('selected');
    });
  }

  // -------------------------------------------------------- Render

  render() {
    return (
      <div class="window">
        {this.windowTitle !== '' ? (
          <div class="row title">{this.windowTitle}</div>
        ) : null}

        <slot name="content" />

        <div id="actions">
          <slot name="actions" />
        </div>
      </div>
    );
  }
}
