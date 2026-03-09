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

    app.addEventListener('license', (event) => {
        const data = JSON.parse(event.detail);
        switch(data.action) {
            case 'activate': {
                vscode.postMessage({ type: 'license-activate', license: data.license, key: data.key });
                break;
            }
            case 'set-key': {
                vscode.postMessage({ type: 'license-set-key', key: data.key });
                break;
            }
            case 'deactivate': {
                vscode.postMessage({ type: 'license-deactivate' }); 
                break;
            }
        }     
    });

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
                app.parse(e.data.value);
                break;
            
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
                app.parse(e.data.value);
                
                // @ts-ignore
                app.import(temp);

                break;
            }
            
            case 'set-machine':
                // @ts-ignore
                const data = JSON.parse(e.data.value);
                app.setMachine(data.machine, data.license);
                break;
		}
	});

}());