import * as vscode from 'vscode';
import { VCDManager } from './vcdManager';

/**
 * A node in the signal hierarchy as returned by the WASM `vcd.nodes()` method.
 */
export interface SignalNode {
    uid: number;
    name: string;
    scope: string;
    parent: number;
    children?: number[];
    /** Signal type identifier – present only on leaf signals. */
    tid?: number;
    /** Signal kind (e.g. "wire", "reg", "real", "integer"). */
    kind?: string;
    /** Bit width of the signal. */
    size?: number;
}

/**
 * TreeItem wrapper around a SignalNode.
 */
class SignalTreeItem extends vscode.TreeItem {
    constructor(public readonly node: SignalNode) {
        const isScope = !node.tid && node.tid !== 0;
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;

        super(
            node.name,
            hasChildren || isScope
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );

        if (isScope) {
            this.iconPath = new vscode.ThemeIcon('symbol-module');
            this.contextValue = 'scope';
        } else {
            this.iconPath = SignalTreeItem.iconForKind(node.kind);
            this.contextValue = 'signal';
            this.description = SignalTreeItem.descriptionForSignal(node);
        }

        this.tooltip = node.scope;
    }

    private static iconForKind(kind?: string): vscode.ThemeIcon {
        switch (kind) {
            case 'reg':
                return new vscode.ThemeIcon('symbol-field');
            case 'real':
                return new vscode.ThemeIcon('symbol-number');
            case 'integer':
                return new vscode.ThemeIcon('symbol-numeric');
            case 'parameter':
                return new vscode.ThemeIcon('symbol-constant');
            case 'event':
                return new vscode.ThemeIcon('symbol-event');
            default:
                return new vscode.ThemeIcon('symbol-variable');
        }
    }

    private static descriptionForSignal(node: SignalNode): string {
        const parts: string[] = [];
        if (node.kind) {
            parts.push(node.kind);
        }
        if (node.size !== undefined && node.size > 1) {
            parts.push(`[${node.size - 1}:0]`);
        } else if (node.size === 1) {
            parts.push('[0]');
        }
        return parts.join(' ');
    }
}

/**
 * VS Code TreeDataProvider that displays the signal hierarchy of the active
 * VCD/FST/GHW file.
 */
export class SignalTreeProvider implements vscode.TreeDataProvider<SignalNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SignalNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private nodes: SignalNode[] = [];
    private nodesByUid = new Map<number, SignalNode>();

    constructor(private readonly manager: VCDManager) {
        manager.onDidChangeHierarchy((nodes) => {
            this.setNodes(nodes);
        });
    }

    /**
     * Replace the hierarchy data and refresh the tree.
     */
    public setNodes(nodes: SignalNode[]): void {
        this.nodes = nodes;
        this.nodesByUid.clear();
        for (const node of nodes) {
            this.nodesByUid.set(node.uid, node);
        }
        this._onDidChangeTreeData.fire();
    }

    /**
     * Refresh the tree from the current active editor's hierarchy.
     */
    public refresh(): void {
        const hierarchy = this.manager.activeHierarchy;
        if (hierarchy) {
            this.setNodes(hierarchy);
        } else {
            this.nodes = [];
            this.nodesByUid.clear();
            this._onDidChangeTreeData.fire();
        }
    }

    getTreeItem(element: SignalNode): vscode.TreeItem {
        return new SignalTreeItem(element);
    }

    getChildren(element?: SignalNode): SignalNode[] {
        if (!element) {
            // Return root nodes (parent === -1)
            return this.nodes.filter((n) => n.parent === -1);
        }
        if (!element.children || element.children.length === 0) {
            return [];
        }
        return element.children
            .map((uid) => this.nodesByUid.get(uid))
            .filter((n): n is SignalNode => n !== undefined);
    }

    getParent(element: SignalNode): SignalNode | undefined {
        if (element.parent === -1) {
            return undefined;
        }
        return this.nodesByUid.get(element.parent);
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
