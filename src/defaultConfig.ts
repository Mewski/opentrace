export interface OpenTraceConfig {
    keyboardPreset: 'default' | 'verdi';
    display: {
        disableGpu: boolean;
        antialias: boolean;
        defaultTraceStyle: {
            renderer: string;
            color: string;
            fill: number;
            height: number;
            radix: string;
            littleEndian: boolean;
            strokeWidth: number;
        };
    };
    keyboard: {
        reload: string;
        createGroup: string;
        addSignal: string;
        deleteSignal: string;
        prevEdge: string;
        nextEdge: string;
        prevSignal: string;
        nextSignal: string;
        moveSignalUp: string;
        moveSignalDown: string;
        selectAll: string;
        undo: string;
        redo: string;
        toggleCursor: string;
        zoomStart: string;
        zoomEnd: string;
        zoomIn: string;
        zoomOut: string;
        zoomFit: string;
        zoomTarget: string;
        zoomAmount: number;
    };
    mouse: {
        smoothScrolling: boolean;
        reverseScrolling: boolean;
        zoomTarget: string;
        zoomAmount: number;
    };
    sidebar: {
        width: number;
    };
    theme: {
        palette: string[];
    };
}

export const VERDI_KEYBOARD_CONFIG: Partial<OpenTraceConfig['keyboard']> = {
    nextEdge: 'n',
    prevEdge: 'shift+n',
    zoomIn: 'z',
    zoomOut: 'shift+z',
    zoomFit: 'f',
    zoomStart: 'home',
    zoomEnd: 'end',
    selectAll: 'ctrl+a',
    deleteSignal: 'delete'
};

const defaultConfig: OpenTraceConfig = {
    keyboardPreset: 'default',
    display: {
        disableGpu: false,
        antialias: false,
        defaultTraceStyle: {
            renderer: 'line',
            color: '#00e676',
            fill: 0.2,
            height: 24,
            radix: 'hex',
            littleEndian: false,
            strokeWidth: 2
        }
    },
    keyboard: {
        reload: 'ctrl+r,f5',
        createGroup: 'ctrl+g',
        addSignal: 'shift+a,insert',
        deleteSignal: 'delete',
        prevEdge: 'left',
        nextEdge: 'right',
        prevSignal: 'up',
        nextSignal: 'down',
        moveSignalUp: 'ctrl+up',
        moveSignalDown: 'ctrl+down',
        selectAll: 'ctrl+a',
        undo: 'ctrl+z',
        redo: 'ctrl+shift+z',
        toggleCursor: 'tab',
        zoomStart: 'home',
        zoomEnd: 'end',
        zoomIn: 'pageUp',
        zoomOut: 'pageDown',
        zoomFit: 'f',
        zoomTarget: 'mouse',
        zoomAmount: 100
    },
    mouse: {
        smoothScrolling: true,
        reverseScrolling: false,
        zoomTarget: 'mouse',
        zoomAmount: 1
    },
    sidebar: {
        width: 280
    },
    theme: {
        palette: [
            '#ff1744',
            '#f50057',
            '#d500f9',
            '#651fff',
            '#3d5afe',
            '#2979ff',
            '#00b0ff',
            '#00e5ff',
            '#ff3d00',
            '#ff9100',
            '#ffc400',
            '#ffea00',
            '#c6ff00',
            '#76ff03',
            '#00e676',
            '#1de9b6'
        ]
    }
};

export default defaultConfig;
