/**
 * Custom error classes for PDF extraction failures.
 * Maps to the ConversionError entity from data-model.md.
 */

/** Machine-readable error codes for conversion failures. */
export enum ErrorCode {
  /** pdfjs-dist throws on getDocument() — file is not a valid PDF */
  CORRUPT_PDF = 'CORRUPT_PDF',
  /** PDF requires a password to open */
  ENCRYPTED_PDF = 'ENCRYPTED_PDF',
  /** No text items extracted from any page */
  EMPTY_CONTENT = 'EMPTY_CONTENT',
  /** File read/write failure (not found, permissions, etc.) */
  IO_ERROR = 'IO_ERROR',
  /** MuPDF WASM module failed to initialize */
  MUPDF_INIT_FAILED = 'MUPDF_INIT_FAILED',
  /** Failed to write an extracted image to disk */
  IMAGE_WRITE_FAILED = 'IMAGE_WRITE_FAILED',
  /** Python interpreter not found or not accessible */
  PYTHON_NOT_FOUND = 'PYTHON_NOT_FOUND',
  /** Python sidecar script exited with non-zero status */
  PYTHON_SCRIPT_FAILED = 'PYTHON_SCRIPT_FAILED',
}

/** Human-readable error messages keyed by ErrorCode. */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.CORRUPT_PDF]:
    'The file could not be read. Please verify it is a valid PDF.',
  [ErrorCode.ENCRYPTED_PDF]:
    'This PDF is password-protected. Encrypted PDFs are not supported in this version.',
  [ErrorCode.EMPTY_CONTENT]:
    'No text content was found in this PDF. It may contain only images.',
  [ErrorCode.IO_ERROR]:
    'Could not read the PDF file or write the output. Check file permissions.',
  [ErrorCode.MUPDF_INIT_FAILED]:
    'The MuPDF WASM engine failed to initialize. Try switching pdfToMarkdown.engine to "pdfjs".',
  [ErrorCode.IMAGE_WRITE_FAILED]:
    'Failed to write one or more extracted images to disk. Check output folder permissions.',
  [ErrorCode.PYTHON_NOT_FOUND]:
    'Python interpreter not found. Install Python and pymupdf4llm (pip install pymupdf4llm), or switch pdfToMarkdown.engine to "mupdf".',
  [ErrorCode.PYTHON_SCRIPT_FAILED]:
    'The Python conversion script exited with an error. Check that pymupdf4llm is installed (pip install pymupdf4llm).',
};

/**
 * Structured error for PDF extraction/conversion failures.
 * Carries a machine-readable ErrorCode and a human-readable message
 * suitable for display in VS Code notifications.
 */
export class PdfExtractionError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: Error;

  constructor(code: ErrorCode, cause?: Error) {
    const message = ERROR_MESSAGES[code];
    super(message);
    this.name = 'PdfExtractionError';
    this.code = code;
    this.cause = cause;
    // Restore prototype chain (needed for instanceof checks with TypeScript)
    Object.setPrototypeOf(this, PdfExtractionError.prototype);
  }

  /** Get the human-readable message for a given error code. */
  static messageFor(code: ErrorCode): string {
    return ERROR_MESSAGES[code];
  }
}
