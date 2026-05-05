/**
 * Python sidecar engine.
 * Shells out to scripts/convert_pdfs_to_md.py via the user's Python interpreter.
 * The script must be bundled at <extensionRoot>/scripts/convert_pdfs_to_md.py.
 * Pure TypeScript — no vscode imports.
 *
 * Note: this engine produces Markdown directly from Python; the block-model
 * pipeline (image extraction, caption detection, etc.) is NOT applied.
 * The `extractImages` settings have no effect when using pythonSidecar.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PdfExtractionError, ErrorCode } from '../models/errors';

/**
 * Run the Python sidecar script against a PDF file and return the Markdown content.
 *
 * @param pdfPath - Absolute path to the source PDF.
 * @param pythonPath - Path to the Python interpreter. Empty string = use 'python' from PATH.
 * @param scriptPath - Absolute path to convert_pdfs_to_md.py.
 * @returns The Markdown string produced by the script.
 * @throws PdfExtractionError for Python not found, script errors, or I/O problems.
 */
export function convertWithPython(
  pdfPath: string,
  pythonPath: string,
  scriptPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const interpreter = pythonPath || 'python';

    // Verify the script exists
    if (!fs.existsSync(scriptPath)) {
      reject(
        new PdfExtractionError(
          ErrorCode.PYTHON_SCRIPT_FAILED,
          new Error(`Python script not found at: ${scriptPath}`)
        )
      );
      return;
    }

    let stderrOutput = '';

    const child = spawn(interpreter, [scriptPath, pdfPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new PdfExtractionError(ErrorCode.PYTHON_NOT_FOUND, err));
      } else {
        reject(new PdfExtractionError(ErrorCode.PYTHON_SCRIPT_FAILED, err));
      }
    });

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        const detail = stderrOutput.trim() || `exit code ${code}`;
        reject(
          new PdfExtractionError(
            ErrorCode.PYTHON_SCRIPT_FAILED,
            new Error(detail)
          )
        );
        return;
      }

      // The script writes <pdfStem>.md beside the PDF
      const mdPath = path.join(
        path.dirname(pdfPath),
        `${path.basename(pdfPath, '.pdf')}.md`
      );

      try {
        const markdown = fs.readFileSync(mdPath, 'utf-8');
        resolve(markdown);
      } catch (err) {
        reject(new PdfExtractionError(ErrorCode.IO_ERROR, err as Error));
      }
    });
  });
}
