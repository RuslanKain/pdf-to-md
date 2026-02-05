/**
 * VS Code extension entry point.
 * Registers the pdfToMarkdown.convert command and manages lifecycle.
 */

import * as vscode from 'vscode';
import { handleConvertCommand } from './commands/convert-command';

/**
 * Called when the extension is activated.
 * Activation is triggered lazily via onCommand:pdfToMarkdown.convert.
 */
export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'pdfToMarkdown.convert',
    (uri?: vscode.Uri) => handleConvertCommand(uri)
  );

  context.subscriptions.push(disposable);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  // No cleanup needed
}
