// @ts-nocheck

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    const app = document.getElementById('app');

    // Detect theme changes
    var observer = new MutationObserver(function (event) {
        //@ts-ignore
        app.redraw();
    });
    
    observer.observe(document.body, {
      attributes: true, 
      attributeFilter: ['class'],
      childList: false, 
      characterData: false
    });

    app.addEventListener('log', (event) => {
        const data = JSON.parse(event.detail);
        vscode.postMessage({ type: 'log', detail: data.detail, focus: data.focus });
    });

    app.addEventListener('vcd-done', () => {
        vscode.postMessage({ type: 'done' });
    });

    app.addEventListener('vcd-ready', () => {
        vscode.postMessage({ type: 'ready' });
    });

    app.addEventListener('file-reload', () => {
        vscode.postMessage({ type: 'reload' });
    });

    app.addEventListener('open-website', () => {
        vscode.postMessage({ type: 'open-website' });
    });

    app.addEventListener('settings-json', () => {
        vscode.postMessage({ type: 'settings-json' });
    });

    app.addEventListener('config-reload', () => {
        vscode.postMessage({ type: 'config-reload' });
    });

    app.addEventListener('config-reset', () => {
        vscode.postMessage({ type: 'config-reset' });
    });

    app.addEventListener('config-save', (event) => {
        vscode.postMessage({ type: 'config-save', detail: event.detail });
    });

    app.addEventListener('state-changed', () => {
        // @ts-ignore
        app.export().then((result) => {
            vscode.postMessage({ type: 'save-state', detail: result });
        });
    });


	// Accumulator for chunked file loading
	let _chunkBuffer = [];

	// Handle messages from the extension
	window.addEventListener('message', async e => {
		switch (e.data.type) {
            case 'console':
                console.log(e.data.value);
                break;

            case 'file-changed':
                // @ts-ignore
                app.fileChanged();
                break;

            case 'config':
                // @ts-ignore
                app.loadConfig(JSON.parse(e.data.value));
                break;

            case 'parse':
                // @ts-ignore
                if (e.data.value instanceof Uint8Array || e.data.value instanceof ArrayBuffer) {
                    const bytes = e.data.value instanceof ArrayBuffer
                        ? new Uint8Array(e.data.value)
                        : e.data.value;
                    app.parseBytes(bytes);
                } else {
                    app.parse(e.data.value);
                }
                break;

            case 'parse-chunk':
                _chunkBuffer.push(e.data.value);
                break;

            case 'parse-end': {
                const fullData = _chunkBuffer.join('');
                _chunkBuffer = [];
                if (e.data.reload) {
                    // @ts-ignore
                    const saved = app.export();
                    // @ts-ignore
                    app.clear();
                    // @ts-ignore
                    app.parse(fullData);
                    // @ts-ignore
                    app.import(saved);
                } else {
                    // @ts-ignore
                    app.parse(fullData);
                }
                break;
            }

            case 'clear':
                // @ts-ignore
                app.clear();
                break;

            case 'export': {
                // @ts-ignore
                const temp = app.export();
                vscode.postMessage({ type: 'export', value: temp});
                break;
            }

            case 'import': {
                // @ts-ignore
                app.import(e.data.value);
                break;
            }

            case 'reload': {
                // @ts-ignore
                const temp = app.export();

                // @ts-ignore
                app.clear();

                // @ts-ignore
                if (e.data.value instanceof Uint8Array || e.data.value instanceof ArrayBuffer) {
                    const bytes = e.data.value instanceof ArrayBuffer
                        ? new Uint8Array(e.data.value)
                        : e.data.value;
                    app.parseBytes(bytes);
                } else {
                    app.parse(e.data.value);
                }

                // @ts-ignore
                app.import(temp);

                break;
            }

            case 'get-state': {
                // @ts-ignore
                app.export().then((result) => {
                    vscode.postMessage({ type: 'save-state', detail: result });
                });
                break;
            }

            case 'restore-state': {
                // @ts-ignore
                app.import(e.data.value);
                break;
            }

            case 'get-hierarchy': {
                // @ts-ignore
                app.getNodes().then((result) => {
                    vscode.postMessage({ type: 'hierarchy', detail: result });
                });
                break;
            }

		}
	});

}());