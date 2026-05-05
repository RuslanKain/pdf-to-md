/**
 * Command handler for pdfToMarkdown.convert.
 * This is the VS Code integration layer — the only file in commands/ that imports vscode.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { convertPdfToMarkdown } from '../services/conversion-pipeline';
import { ConversionConfiguration } from '../models/types';
import { PdfExtractionError, ErrorCode } from '../models/errors';

/**
 * Read user configuration from VS Code settings (pdfToMarkdown.*).
 */
function readConfiguration(): ConversionConfiguration {
  const config = vscode.workspace.getConfiguration('pdfToMarkdown');
  return {
    preserveLayout: config.get<boolean>('preserveLayout', false),
    detectTables: config.get<boolean>('detectTables', true),
    mergeLines: config.get<boolean>('mergeLines', true),
    outputFolder: config.get<string>('outputFolder', ''),
    engine: config.get<'mupdf' | 'pdfjs' | 'pythonSidecar'>('engine', 'mupdf'),
    extractImages: config.get<'inline' | 'folder-only' | 'none'>('extractImages', 'inline'),
    imageFormat: config.get<'png' | 'jpg'>('imageFormat', 'png'),
    imageMinSize: config.get<number>('imageMinSize', 32),
    pythonPath: config.get<string>('pythonPath', ''),
  };
}

/**
 * Resolve the output directory for the Markdown file.
 * If outputFolder is configured, use it (resolve relative to workspace root).
 * Otherwise, use the same directory as the source PDF.
 */
async function resolveOutputDir(
  sourcePdfPath: string,
  outputFolder: string
): Promise<string> {
  if (!outputFolder) {
    return path.dirname(sourcePdfPath);
  }

  // Resolve absolute or workspace-relative paths
  let resolvedDir: string;
  if (path.isAbsolute(outputFolder)) {
    resolvedDir = outputFolder;
  } else {
    // Resolve relative to workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      resolvedDir = path.join(workspaceFolders[0].uri.fsPath, outputFolder);
    } else {
      // Fallback: relative to source PDF directory
      resolvedDir = path.join(path.dirname(sourcePdfPath), outputFolder);
    }
  }

  // Create directory if it doesn't exist
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(resolvedDir));
  } catch {
    // Directory may already exist — that's fine
  }

  return resolvedDir;
}

/**
 * Handle the pdfToMarkdown.convert command.
 *
 * @param uri - vscode.Uri from context menu, or undefined from Command Palette.
 */
export async function handleConvertCommand(uri?: vscode.Uri): Promise<void> {
  // If no URI provided (e.g., from Command Palette), show file picker
  let fileUri = uri;
  if (!fileUri) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'PDF Files': ['pdf'] },
      title: 'Select a PDF file to convert',
    });

    if (!selected || selected.length === 0) {
      return; // User cancelled
    }
    fileUri = selected[0];
  }

  // Validate file is a PDF
  const filePath = fileUri.fsPath;
  if (!filePath.toLowerCase().endsWith('.pdf')) {
    vscode.window.showErrorMessage('The selected file is not a PDF.');
    return;
  }

  try {
    // Read user configuration from VS Code settings
    const config = readConfiguration();

    // Determine output directory upfront so it can be passed to the pipeline
    const outputDir = await resolveOutputDir(filePath, config.outputFolder);
    const baseName = path.basename(filePath, '.pdf');
    const outputPath = path.join(outputDir, `${baseName}.md`);
    const outputUri = vscode.Uri.file(outputPath);

    // Run conversion with progress indicator
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Converting PDF to Markdown...',
        cancellable: false,
      },
      async (progress) => {
        return convertPdfToMarkdown({
          filePath,
          preserveLayout: config.preserveLayout,
          detectTables: config.detectTables,
          mergeLines: config.mergeLines,
          engine: config.engine,
          extractImages: config.extractImages,
          imageFormat: config.imageFormat,
          imageMinSize: config.imageMinSize,
          pythonPath: config.pythonPath,
          outputDir,
          onProgress: (current, total) => {
            const increment = (1 / total) * 100;
            progress.report({
              message: `Page ${current} of ${total}`,
              increment,
            });
          },
        });
      }
    );

    // Check if file already exists — prompt for overwrite (US5 - T035)
    let shouldWrite = true;
    try {
      await vscode.workspace.fs.stat(outputUri);
      // File exists — ask user
      const answer = await vscode.window.showWarningMessage(
        `${baseName}.md already exists. Overwrite?`,
        { modal: true },
        'Overwrite'
      );
      if (answer !== 'Overwrite') {
        shouldWrite = false;
        // Offer Save As dialog instead
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: outputUri,
          filters: { 'Markdown Files': ['md'] },
          title: 'Save Markdown As',
        });
        if (saveUri) {
          const encoder = new TextEncoder();
          await vscode.workspace.fs.writeFile(saveUri, encoder.encode(result.markdown));
          const document = await vscode.workspace.openTextDocument(saveUri);
          await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
          await vscode.commands.executeCommand('markdown.showPreviewToSide');
          vscode.window.showInformationMessage(
            `Converted ${path.basename(filePath)} to Markdown (${result.pageCount} pages).`
          );
        }
        return;
      }
    } catch {
      // File does not exist — proceed normally
    }

    if (shouldWrite) {
      // Write Markdown to disk
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(outputUri, encoder.encode(result.markdown));

      // Open the generated Markdown file in the editor
      const document = await vscode.workspace.openTextDocument(outputUri);
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

      // Open side-by-side Markdown preview (US2)
      await vscode.commands.executeCommand('markdown.showPreviewToSide');

      vscode.window.showInformationMessage(
        `Converted ${path.basename(filePath)} to Markdown (${result.pageCount} pages).`
      );
    }
  } catch (err: unknown) {
    // Enhanced error handling
    if (err instanceof PdfExtractionError) {
      switch (err.code) {
        case ErrorCode.CORRUPT_PDF:
          vscode.window.showErrorMessage(err.message);
          break;
        case ErrorCode.ENCRYPTED_PDF:
          vscode.window.showWarningMessage(err.message);
          break;
        case ErrorCode.EMPTY_CONTENT:
          vscode.window.showWarningMessage(err.message);
          break;
        case ErrorCode.IO_ERROR:
          vscode.window.showErrorMessage(err.message);
          break;
        case ErrorCode.MUPDF_INIT_FAILED:
          vscode.window.showErrorMessage(err.message);
          break;
        case ErrorCode.IMAGE_WRITE_FAILED:
          vscode.window.showWarningMessage(err.message);
          break;
        case ErrorCode.PYTHON_NOT_FOUND:
          vscode.window.showErrorMessage(err.message);
          break;
        case ErrorCode.PYTHON_SCRIPT_FAILED:
          vscode.window.showErrorMessage(err.message);
          break;
        default:
          vscode.window.showErrorMessage(`Failed to convert PDF: ${err.message}`);
      }
    } else {
      const error = err as Error;
      vscode.window.showErrorMessage(
        `Failed to convert PDF: ${error.message || 'An unexpected error occurred.'}`
      );
    }
  }
}
