// src/utils/font-utils.ts
var MONOSPACE_PATTERNS = [
  "courier",
  "consolas",
  "mono",
  "menlo",
  "code",
  "inconsolata",
  "firacode",
  "hackfont",
  "droid sans mono",
  "liberation mono",
  "lucida console",
  "andale mono",
  "ubuntu mono",
  "roboto mono",
  "jetbrains",
  "terminal",
  "fixedsys"
];
var BOLD_PATTERNS = [
  "bold",
  "heavy",
  "black",
  "semibold",
  "demibold",
  "extrabold",
  "ultrabold"
];
var ITALIC_PATTERNS = [
  "italic",
  "oblique",
  "inclined",
  "slanted"
];
function parseFontName(fontName, fontFamily) {
  const lowerName = fontName.toLowerCase();
  const isBold = BOLD_PATTERNS.some((pattern) => lowerName.includes(pattern));
  const isItalic = ITALIC_PATTERNS.some((pattern) => lowerName.includes(pattern));
  let isMonospace = MONOSPACE_PATTERNS.some((pattern) => lowerName.includes(pattern));
  if (!isMonospace && fontFamily) {
    isMonospace = fontFamily.toLowerCase() === "monospace";
  }
  return {
    name: fontName,
    isBold,
    isItalic,
    isMonospace
  };
}

// src/models/errors.ts
var ERROR_MESSAGES = {
  ["CORRUPT_PDF" /* CORRUPT_PDF */]: "The file could not be read. Please verify it is a valid PDF.",
  ["ENCRYPTED_PDF" /* ENCRYPTED_PDF */]: "This PDF is password-protected. Encrypted PDFs are not supported in this version.",
  ["EMPTY_CONTENT" /* EMPTY_CONTENT */]: "No text content was found in this PDF. It may contain only images.",
  ["IO_ERROR" /* IO_ERROR */]: "Could not read the PDF file or write the output. Check file permissions.",
  ["MUPDF_INIT_FAILED" /* MUPDF_INIT_FAILED */]: 'The MuPDF WASM engine failed to initialize. Try switching pdfToMarkdown.engine to "pdfjs".',
  ["IMAGE_WRITE_FAILED" /* IMAGE_WRITE_FAILED */]: "Failed to write one or more extracted images to disk. Check output folder permissions.",
  ["PYTHON_NOT_FOUND" /* PYTHON_NOT_FOUND */]: 'Python interpreter not found. Install Python and pymupdf4llm (pip install pymupdf4llm), or switch pdfToMarkdown.engine to "mupdf".',
  ["PYTHON_SCRIPT_FAILED" /* PYTHON_SCRIPT_FAILED */]: "The Python conversion script exited with an error. Check that pymupdf4llm is installed (pip install pymupdf4llm)."
};
var PdfExtractionError = class _PdfExtractionError extends Error {
  code;
  cause;
  constructor(code, cause) {
    const message = ERROR_MESSAGES[code];
    super(message);
    this.name = "PdfExtractionError";
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, _PdfExtractionError.prototype);
  }
  /** Get the human-readable message for a given error code. */
  static messageFor(code) {
    return ERROR_MESSAGES[code];
  }
};

// src/services/mupdf-extractor.ts
var mupdfModule = null;
async function getMupdf() {
  if (!mupdfModule) {
    try {
      mupdfModule = await import("mupdf");
    } catch (err) {
      throw new PdfExtractionError("MUPDF_INIT_FAILED" /* MUPDF_INIT_FAILED */, err);
    }
  }
  return mupdfModule;
}
function toBBox(rect) {
  return [rect[0], rect[1], rect[2], rect[3]];
}
function sortByTopThenLeft(blocks) {
  return [...blocks].sort((a, b) => {
    const dy = a.bbox[1] - b.bbox[1];
    if (Math.abs(dy) > 1)
      return dy;
    return a.bbox[0] - b.bbox[0];
  });
}
function isLikelyTwoColumnLayout(blocks, pageWidth) {
  const textBlocks = blocks.filter((b) => b.type === "text");
  if (textBlocks.length < 6)
    return false;
  const centerX = pageWidth / 2;
  const gutterHalfWidth = pageWidth * 0.05;
  const gutterLeft = centerX - gutterHalfWidth;
  const gutterRight = centerX + gutterHalfWidth;
  let leftCount = 0;
  let rightCount = 0;
  let crossingCount = 0;
  for (const block of textBlocks) {
    const [x0, , x1] = block.bbox;
    const width = x1 - x0;
    const mid = (x0 + x1) / 2;
    if (x0 < gutterLeft && x1 > gutterRight) {
      crossingCount++;
      continue;
    }
    if (mid < centerX)
      leftCount++;
    else
      rightCount++;
    if (width > pageWidth * 0.7) {
      crossingCount++;
    }
  }
  const textCount = textBlocks.length;
  const crossingRatio = crossingCount / Math.max(1, textCount);
  return leftCount >= 3 && rightCount >= 3 && crossingRatio <= 0.35;
}
function sortBlocksForReadingOrder(blocks, pageWidth) {
  if (!isLikelyTwoColumnLayout(blocks, pageWidth)) {
    return sortByTopThenLeft(blocks);
  }
  const centerX = pageWidth / 2;
  const gutterHalfWidth = pageWidth * 0.05;
  const gutterLeft = centerX - gutterHalfWidth;
  const gutterRight = centerX + gutterHalfWidth;
  const fullWidth = [];
  const leftColumn = [];
  const rightColumn = [];
  for (const block of blocks) {
    const [x0, , x1] = block.bbox;
    const mid = (x0 + x1) / 2;
    if (x0 < gutterLeft && x1 > gutterRight) {
      fullWidth.push(block);
      continue;
    }
    if (mid < centerX)
      leftColumn.push(block);
    else
      rightColumn.push(block);
  }
  const leftSorted = sortByTopThenLeft(leftColumn);
  const rightSorted = sortByTopThenLeft(rightColumn);
  const fullSorted = sortByTopThenLeft(fullWidth);
  const firstColumnY = Math.min(
    leftSorted[0]?.bbox[1] ?? Number.POSITIVE_INFINITY,
    rightSorted[0]?.bbox[1] ?? Number.POSITIVE_INFINITY
  );
  const topFull = [];
  const bottomFull = [];
  for (const block of fullSorted) {
    if (block.bbox[1] <= firstColumnY + 20)
      topFull.push(block);
    else
      bottomFull.push(block);
  }
  return [...topFull, ...leftSorted, ...rightSorted, ...bottomFull];
}
async function extractWithMupdf(pdfBytes, options) {
  const { imageFormat, imageMinSize, onProgress } = options;
  const mupdf = await getMupdf();
  let doc;
  try {
    doc = mupdf.Document.openDocument(pdfBytes.buffer, "file.pdf");
  } catch (err) {
    const error = err;
    const msg = error?.message || "";
    if (msg.toLowerCase().includes("password") || msg.includes("PasswordException")) {
      throw new PdfExtractionError("ENCRYPTED_PDF" /* ENCRYPTED_PDF */, error);
    }
    throw new PdfExtractionError("CORRUPT_PDF" /* CORRUPT_PDF */, error);
  }
  if (doc.needsPassword && doc.needsPassword()) {
    throw new PdfExtractionError("ENCRYPTED_PDF" /* ENCRYPTED_PDF */);
  }
  const totalPages = doc.countPages();
  const metadata = {
    pageCount: totalPages,
    title: doc.getMetaData("info:Title") || void 0,
    author: doc.getMetaData("info:Author") || void 0
  };
  const pages = [];
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = doc.loadPage(pageIdx);
    const bounds = page.getBounds();
    const pageWidth = bounds[2] - bounds[0];
    const pageHeight = bounds[3] - bounds[1];
    const blocks = extractPageBlocks(page, imageFormat, imageMinSize);
    pages.push({
      pageNumber: pageIdx + 1,
      width: pageWidth,
      height: pageHeight,
      blocks
    });
    onProgress?.(pageIdx + 1, totalPages);
    if (pageIdx < totalPages - 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  return { pages, metadata };
}
function extractPageBlocks(page, imageFormat, imageMinSize) {
  const blocks = [];
  let currentTextBBox = null;
  let currentLines = [];
  let currentLineBBox = null;
  let currentLineChars = [];
  const stxt = page.toStructuredText("preserve-images");
  stxt.walk({
    // Image block: extract pixmap bytes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onImageBlock(bboxArr, _transform, image) {
      try {
        const rawPixmap = image.toPixmap();
        const imgWidth = rawPixmap.getWidth();
        const imgHeight = rawPixmap.getHeight();
        if (Math.min(imgWidth, imgHeight) < imageMinSize) {
          rawPixmap.destroy?.();
          return;
        }
        let finalPixmap = rawPixmap;
        let bytes;
        if (imageFormat === "jpg") {
          const cs = rawPixmap.getColorSpace?.();
          if (cs && !cs.isRGB?.()) {
            try {
              finalPixmap = rawPixmap.convertToColorSpace(mupdfModule.ColorSpace.DeviceRGB);
              rawPixmap.destroy?.();
            } catch {
              finalPixmap = rawPixmap;
            }
          }
          bytes = new Uint8Array(finalPixmap.asJPEG(85));
        } else {
          bytes = new Uint8Array(finalPixmap.asPNG());
        }
        if (finalPixmap !== rawPixmap) {
          finalPixmap.destroy?.();
        }
        blocks.push({
          type: "image",
          bbox: toBBox(bboxArr),
          format: imageFormat === "jpg" ? "jpeg" : "png",
          bytes,
          width: imgWidth,
          height: imgHeight
        });
      } catch {
      }
    },
    beginTextBlock(bboxArr) {
      currentTextBBox = toBBox(bboxArr);
      currentLines = [];
    },
    beginLine(bboxArr) {
      currentLineBBox = toBBox(bboxArr);
      currentLineChars = [];
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChar(c, origin, font, size) {
      currentLineChars.push({ text: c, font, size, origin: [origin[0], origin[1]] });
    },
    endLine() {
      if (currentLineBBox && currentLineChars.length > 0) {
        const line = buildTextLine(currentLineBBox, currentLineChars);
        if (line.text.trim()) {
          currentLines.push(line);
        }
      }
      currentLineBBox = null;
      currentLineChars = [];
    },
    endTextBlock() {
      if (currentTextBBox && currentLines.length > 0) {
        blocks.push(buildTextBlock(currentTextBBox, currentLines));
      }
      currentTextBBox = null;
      currentLines = [];
    }
  });
  return sortBlocksForReadingOrder(blocks, page.getBounds()[2] - page.getBounds()[0]);
}
function buildTextLine(bbox, chars) {
  const text = chars.map((c) => c.text).join("");
  let boldCount = 0;
  let italicCount = 0;
  let monoCount = 0;
  let totalSize = 0;
  let totalChars = 0;
  for (const ch of chars) {
    const len = ch.text.length || 1;
    totalChars += len;
    totalSize += ch.size * len;
    const fontName = ch.font?.getName?.() ?? "";
    const isBold = ch.font?.isBold?.() ?? parseFontName(fontName).isBold;
    const isItalic = ch.font?.isItalic?.() ?? parseFontName(fontName).isItalic;
    const isMono = ch.font?.isMono?.() ?? parseFontName(fontName).isMonospace;
    if (isBold)
      boldCount += len;
    if (isItalic)
      italicCount += len;
    if (isMono)
      monoCount += len;
  }
  const avgSize = totalChars > 0 ? totalSize / totalChars : 12;
  return {
    bbox,
    text,
    fontSize: Math.round(avgSize * 100) / 100,
    isBold: boldCount > totalChars / 2,
    isItalic: italicCount > totalChars / 2,
    isMonospace: monoCount > totalChars / 2,
    spans: []
    // spans not needed for the current pipeline
  };
}
function buildTextBlock(bbox, lines) {
  let boldCount = 0;
  let italicCount = 0;
  let monoCount = 0;
  let totalSize = 0;
  let totalChars = 0;
  for (const line of lines) {
    const len = line.text.length || 1;
    totalChars += len;
    totalSize += line.fontSize * len;
    if (line.isBold)
      boldCount += len;
    if (line.isItalic)
      italicCount += len;
    if (line.isMonospace)
      monoCount += len;
  }
  const avgSize = totalChars > 0 ? totalSize / totalChars : 12;
  return {
    type: "text",
    bbox,
    lines,
    fontSize: Math.round(avgSize * 100) / 100,
    isBold: boldCount > totalChars / 2,
    isItalic: italicCount > totalChars / 2,
    isMonospace: monoCount > totalChars / 2
  };
}
export {
  extractWithMupdf,
  sortBlocksForReadingOrder
};
