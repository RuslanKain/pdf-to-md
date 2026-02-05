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
