import * as vscode from 'vscode';
import { VCDManager } from './vcdManager';
import { SignalTerminalLinkProvider } from './terminalLinkProvider';
import { SignalTreeProvider } from './signalTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const manager = new VCDManager(context.extensionUri, context.globalStoragePath);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(VCDManager.viewType, manager, {
            supportsMultipleEditorsPerDocument: false,
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    context.subscriptions.push(
        vscode.window.registerTerminalLinkProvider(new SignalTerminalLinkProvider())
    );

    const signalTreeProvider = new SignalTreeProvider(manager);

    context.subscriptions.push(
        vscode.window.createTreeView('opentrace.signalTree', {
            treeDataProvider: signalTreeProvider,
            showCollapseAll: true,
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('opentrace.signalTree.refresh', () => {
            signalTreeProvider.refresh();
        })
    );
}

export function deactivate(): void {}
