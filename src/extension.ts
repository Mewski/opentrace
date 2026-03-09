import * as vscode from 'vscode';
import { VCDManager } from './vcdManager';

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
}

export function deactivate(): void {}
