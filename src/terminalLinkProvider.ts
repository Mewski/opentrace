import * as vscode from 'vscode';

/**
 * A terminal link that carries a hierarchical signal path (e.g. `top.cpu.alu.result`).
 */
interface SignalTerminalLink extends vscode.TerminalLink {
    signalPath: string;
}

/**
 * Regex matching dot-separated identifiers composed of word characters
 * (alphanumeric + underscore). Requires at least two segments separated by dots,
 * so bare identifiers like `clk` are not matched.
 */
const SIGNAL_PATH_REGEX = /\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)+)\b/g;

/**
 * Terminal link provider that detects hierarchical signal paths in the VS Code
 * terminal and makes them clickable.
 */
export class SignalTerminalLinkProvider implements vscode.TerminalLinkProvider<SignalTerminalLink> {
    provideTerminalLinks(
        context: vscode.TerminalLinkContext,
        _token: vscode.CancellationToken,
    ): SignalTerminalLink[] {
        const links: SignalTerminalLink[] = [];
        let match: RegExpExecArray | null;

        SIGNAL_PATH_REGEX.lastIndex = 0;
        while ((match = SIGNAL_PATH_REGEX.exec(context.line)) !== null) {
            links.push({
                startIndex: match.index,
                length: match[0].length,
                tooltip: `Signal: ${match[0]}`,
                signalPath: match[0],
            });
        }

        return links;
    }

    handleTerminalLink(link: SignalTerminalLink): void {
        vscode.window.showInformationMessage(`Signal path: ${link.signalPath}`);
    }
}
