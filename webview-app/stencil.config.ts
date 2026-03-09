import { Config } from '@stencil/core';

export const config: Config = {
    namespace: 'opentrace',
    outputTargets: [
        {
            type: 'dist',
            dir: '../media/build'
        }
    ],
    globalStyle: 'src/global/app.css',
    buildEs5: false,
    rollupPlugins: {
        before: [
            {
                name: 'externalize-core',
                resolveId(source: string) {
                    if (source.includes('core.js')) {
                        return { id: '../../core.js', external: true };
                    }
                    return null;
                }
            }
        ]
    }
};
