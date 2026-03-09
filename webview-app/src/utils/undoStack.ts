export type UndoAction = {
  type: string;
  undo: () => void;
  redo: () => void;
};

export class UndoStack {
  private stack: UndoAction[] = [];
  private index: number = -1;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  push(action: UndoAction): void {
    // Truncate future entries after current index
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(action);
    if (this.stack.length > this.maxSize) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  undo(): boolean {
    if (this.index < 0) return false;
    this.stack[this.index].undo();
    this.index--;
    return true;
  }

  redo(): boolean {
    if (this.index >= this.stack.length - 1) return false;
    this.index++;
    this.stack[this.index].redo();
    return true;
  }

  clear(): void {
    this.stack = [];
    this.index = -1;
  }

  get canUndo(): boolean {
    return this.index >= 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }
}
