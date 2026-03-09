import { Config } from '@stencil/core';

export const config: Config = {
    namespace: 'opentrace',
    outputTargets: [
        {
            type: 'dist',
            dir: '../media/dist'
        },
        {
            type: 'www',
            serviceWorker: null,
            dir: 'www'
        }
    ],
    globalStyle: 'src/global/app.css',
    buildEs5: false
};
