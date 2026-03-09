import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TextDecoder } from 'util';
import { Disposable } from './disposable';
import defaultConfig, { OpenTraceConfig } from './defaultConfig';

function escapeAttribute(value: vscode.Uri | string): string {
    return value.toString().replace(/"/g, '&quot;');
}

export class VCDManager implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'opentrace.vcd';

    private readonly _vcds = new Set<VCDEditor>();
    private _activeVCD: VCDEditor | undefined;

    constructor(
        private readonly extensionRoot: vscode.Uri,
        private readonly globalStoragePath: string
    ) {}

    public async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewEditor: vscode.WebviewPanel
    ): Promise<void> {
        const editor = new VCDEditor(
            this.extensionRoot,
            this.globalStoragePath,
            document.uri,
            webviewEditor
        );
        this._vcds.add(editor);
        this.setActiveVCD(editor);
        webviewEditor.onDidDispose(() => {
            this._vcds.delete(editor);
        });
    }

    public get activeVCD(): VCDEditor | undefined {
        return this._activeVCD;
    }

    private setActiveVCD(editor: VCDEditor): void {
        this._activeVCD = editor;
    }
}

enum VCDState {
    Disposed = 0,
    Visible = 1,
    Active = 2
}

class VCDEditor extends Disposable {
    public readonly id: string = `${Date.now()}-${Math.random().toString()}`;

    private _vcdState: VCDState = VCDState.Visible;
    private _binarySize: number | undefined;
    private readonly _log: vscode.OutputChannel;

    private readonly configPath: vscode.Uri;
    private config: OpenTraceConfig | null = null;

    constructor(
        private readonly extensionRoot: vscode.Uri,
        private readonly globalStoragePath: string,
        private readonly resource: vscode.Uri,
        private readonly webviewEditor: vscode.WebviewPanel
    ) {
        super();

        this.configPath = vscode.Uri.file(
            path.join(this.globalStoragePath, 'config.opentrace.json')
        );

        const resourceDir = resource.with({
            path: resource.path.replace(/\/[^/]+?\.\w+$/, '/')
        });

        let statusMessage = vscode.window.setStatusBarMessage('Starting OpenTrace...');
        this._log = vscode.window.createOutputChannel('opentrace - ' + resource.fsPath.toString());
        this._log.appendLine('[INFO] Opened ' + resource.fsPath.toString());

        this.loadConfig();

        webviewEditor.webview.options = {
            enableScripts: true,
            localResourceRoots: [resourceDir, extensionRoot]
        };

        this._register(
            webviewEditor.webview.onDidReceiveMessage(async (message) => {
                switch (message.type) {
                    case 'ready': {
                        statusMessage.dispose();
                        statusMessage = vscode.window.setStatusBarMessage('Loading waveform...');
                        await this.webviewEditor.webview.postMessage({
                            type: 'config',
                            value: JSON.stringify(this.config)
                        });
                        await this.webviewEditor.webview.postMessage({
                            type: 'parse',
                            value: await this.read()
                        });
                        break;
                    }

                    case 'done': {
                        statusMessage.dispose();
                        statusMessage = vscode.window.setStatusBarMessage('Done', 2000);
                        break;
                    }

                    case 'reload': {
                        statusMessage.dispose();
                        statusMessage = vscode.window.setStatusBarMessage('Reloading waveform...');
                        this.webviewEditor.webview.postMessage({
                            type: 'reload',
                            value: await this.read()
                        });
                        break;
                    }

                    case 'log': {
                        this._log.appendLine('' + message.detail);
                        if (message.focus) {
                            this._log.show();
                        }
                        return;
                    }

                    case 'settings-json': {
                        vscode.commands.executeCommand(
                            'vscode.open',
                            this.configPath,
                            vscode.ViewColumn.Beside
                        );
                        return;
                    }

                    case 'config-save': {
                        try {
                            const updated = JSON.parse(message.detail);
                            Object.assign(this.config!, updated);
                        } catch (e) {
                            this._log.appendLine('[ERROR] Error updating config: ' + e);
                            this._log.show();
                        }
                        this.storeConfig();
                        this.webviewEditor.webview.postMessage({
                            type: 'config',
                            value: JSON.stringify(this.config)
                        });
                        this._log.appendLine('[INFO] Config saved');
                        return;
                    }

                    case 'config-reset': {
                        Object.assign(this.config!, defaultConfig);
                        this.storeConfig();
                        this.webviewEditor.webview.postMessage({
                            type: 'config',
                            value: JSON.stringify(this.config)
                        });
                        this._log.appendLine('[INFO] Config reset to defaults');
                        vscode.window.setStatusBarMessage(
                            'OpenTrace configuration has been reset to default'
                        );
                        // fallthrough to config-reload
                    }

                    case 'config-reload': {
                        this.loadConfig(() => {
                            this.webviewEditor.webview.postMessage({
                                type: 'config',
                                value: JSON.stringify(this.config)
                            });
                        });
                        return;
                    }
                }
            })
        );

        this._register(
            webviewEditor.onDidDispose(() => {
                this._log.appendLine('[INFO] Closed ' + resource.fsPath.toString());
                this._vcdState = VCDState.Disposed;
            })
        );

        const watcher = this._register(vscode.workspace.createFileSystemWatcher(resource.fsPath));

        this._register(
            watcher.onDidChange((changedUri) => {
                if (changedUri.toString() === this.resource.toString()) {
                    this._log.appendLine('[INFO] Change detected ');
                    this.webviewEditor.webview.postMessage({
                        type: 'file-changed',
                        value: ''
                    });
                }
            })
        );

        vscode.workspace.fs.stat(resource).then(({ size }) => {
            this._binarySize = size;
            this.update();
        });

        this.render();
        this.update();
    }

    private async render(): Promise<void> {
        this._log.appendLine('[INFO] Rendered ');
        if (this._vcdState === VCDState.Disposed) {
            return;
        }
        this.webviewEditor.webview.html = await this.getWebviewContents();
    }

    private update(): void {
        if (this._vcdState === VCDState.Disposed) {
            return;
        }
        if (this.webviewEditor.active) {
            this._vcdState = VCDState.Active;
        } else {
            this._vcdState = VCDState.Visible;
        }
    }

    private async read(): Promise<string> {
        this._log.appendLine('[INFO] Reading ' + this.resource.path);
        const data = await vscode.workspace.fs.readFile(this.resource);
        return new TextDecoder('utf-8').decode(data);
    }

    private async getWebviewContents(): Promise<string> {
        const nonce = Date.now().toString();
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${escapeAttribute(this.extensionResource('/media/vscode.css'))}" rel="stylesheet" />
                <title>opentrace</title>
            </head>
            <body>
                <ot-app id="app"></ot-app>
                <link href="${escapeAttribute(this.extensionResource('/media/build/opentrace/opentrace.css'))}" rel="stylesheet" />
                <script src="${escapeAttribute(this.extensionResource('/media/build/opentrace/opentrace.esm.js'))}" type="module" nonce="${nonce}"></script>
                <script src="${escapeAttribute(this.extensionResource('/media/renderer.js'))}" nonce="${nonce}"></script>
            </body>
            </html>`;
    }

    private extensionResource(filePath: string): vscode.Uri {
        return this.webviewEditor.webview.asWebviewUri(
            this.extensionRoot.with({
                path: this.extensionRoot.path + filePath
            })
        );
    }

    private loadConfig(callback: () => void = () => {}): void {
        if (fs.existsSync(this.configPath.fsPath)) {
            fs.readFile(this.configPath.fsPath, 'utf8', (_err, data) => {
                try {
                    this.config = JSON.parse(data);
                } catch (e) {
                    this._log.appendLine('[ERROR] Error updating config: ' + e);
                    this._log.show();
                }
                callback();
            });
        } else {
            this.config = defaultConfig;
            fs.mkdir(
                path.dirname(this.configPath.fsPath.toString()),
                { recursive: true },
                (err) => {
                    if (err) {
                        this._log.appendLine(
                            '[ERROR] Could not create config directory. Permissions issue? ' + err
                        );
                        this._log.show();
                    }
                }
            );
            this.storeConfig();
            this._log.appendLine(
                '[INFO] Created new config file at ' + this.configPath.fsPath.toString()
            );
        }
    }

    private storeConfig(): void {
        fs.writeFileSync(this.configPath.fsPath, JSON.stringify(this.config, null, 4), 'utf8');
    }
}
