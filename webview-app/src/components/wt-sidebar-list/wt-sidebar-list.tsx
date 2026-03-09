import { Component, h, Prop, State, Element } from '@stencil/core';
import { Signal } from '../../utils/types';

/**
 * Scrollable, drag-reorderable signal list container.
 *
 * This is a lightweight generic drag-and-drop list used for
 * prototyping reorder behaviour.  The main sidebar (`wt-sidebar`)
 * has its own built-in drag logic that supersedes this component for
 * the primary signal list, but `wt-sidebar-list` is retained as a
 * reusable primitive.
 */
@Component({
  tag: 'wt-sidebar-list',
  styleUrl: 'wt-sidebar-list.css',
  shadow: true,
})
export class WtSidebarList {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** Signal items to display. The setter copies the reference and triggers a re-render. */
  @Prop() signals: Signal[] = [];

  // ----------------------------------------------------------------- State

  @State() items: Signal[] = [];
  @State() draggedIndex: number | null = null;
  @State() hoverIndex: number | null = null;

  // ------------------------------------------------------------- Lifecycle

  componentWillLoad() {
    this.items = this.signals;
  }

  // -------------------------------------------------------- Internal logic

  private get dragging(): boolean {
    return this.draggedIndex !== null;
  }

  /** Finalise the drag by moving the dragged item to the hover position. */
  private insert(): void {
    if (this.draggedIndex === null || this.hoverIndex === null) return;
    const item = this.items[this.draggedIndex];
    this.items.splice(this.draggedIndex, 1);
    this.items.splice(this.hoverIndex, 0, item);
    this.draggedIndex = null;
    this.hoverIndex = null;
  }

  /**
   * Initiate a drag on mousedown / touchstart.
   */
  private startItemDrag = (evt: MouseEvent | TouchEvent) => {
    let moveEvent: string;
    let endEvent: string;
    let getY: (e: any) => number;

    if (evt instanceof TouchEvent) {
      moveEvent = 'touchmove';
      endEvent = 'touchend';
      getY = (e: TouchEvent) => e.touches[0].pageY;
      evt.preventDefault();
    } else {
      moveEvent = 'mousemove';
      endEvent = 'mouseup';
      getY = (e: MouseEvent) => e.pageY;
    }

    const target = evt.target as HTMLElement;
    const container = this.el.shadowRoot!.firstElementChild!;
    this.draggedIndex = Array.from(container.children).indexOf(target);

    const topOffset = this.el.getBoundingClientRect().top + window.scrollY;
    const startY = getY(evt);
    target.style.zIndex = '2';

    const onMove = (e: Event) => {
      const y = getY(e);
      const relativeY = y - topOffset;
      const deltaY = y - startY;
      target.style.transform = `translateY(${deltaY}px)`;
      this.hoverIndex = Math.max(Math.floor(relativeY / 48), 0);
    };

    onMove(evt as any);

    const onEnd = () => {
      document.removeEventListener(moveEvent, onMove);
      this.el.removeEventListener(endEvent, onEnd);

      const finalize = () => {
        this.insert();
        target.style.zIndex = '1';
        target.style.transform = '';
        target.style.transition = '';
        target.removeEventListener('transitionend', finalize);
      };
      target.addEventListener('transitionend', finalize);

      const offset = 48 * ((this.hoverIndex ?? 0) - (this.draggedIndex ?? 0));
      target.style.transition = 'transform 0.1s ease-out';
      target.style.transform = `translate3d(0, ${offset}px, 0)`;
    };

    this.el.addEventListener(endEvent, onEnd);
    document.addEventListener(moveEvent, onMove);
  };

  // -------------------------------------------------------------- Render

  render() {
    return (
      <div class={{ dragging: this.dragging }}>
        {this.items.map((item, index) => {
          const classes: Record<string, boolean> = {
            item: true,
            nudgeDown: this.dragging && index < this.draggedIndex! && index >= this.hoverIndex!,
            nudgeUp: this.dragging && index > this.draggedIndex! && index <= this.hoverIndex!,
            dragged: this.draggedIndex === index,
          };
          return (
            <div
              class={classes}
              onMouseDown={this.startItemDrag}
              onTouchStart={this.startItemDrag}
            >
              {item.id}
            </div>
          );
        })}
      </div>
    );
  }
}
