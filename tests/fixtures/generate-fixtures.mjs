/**
 * Generate test fixture PDFs using raw PDF specification syntax.
 *
 * Each PDF is built from scratch following the PDF-1.4 spec so we don't
 * need any PDF-creation library.  The files only need to be valid enough
 * for pdfjs-dist's getDocument / getTextContent to return TextItem objects.
 *
 * Usage:  node tests/fixtures/generate-fixtures.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── helpers ──────────────────────────────────────────────────────────────────

/** Escape special chars inside a PDF literal string `( … )` */
function esc(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Assemble a complete PDF file from a list of indirect objects.
 *
 * @param {object}   opts
 * @param {Array<{num:number, dict:string, stream?:string}>} opts.objects
 *        Each object has a 1-based object number, a dictionary/value string,
 *        and an optional stream body.  If `stream` is provided the dict string
 *        MUST contain the token `__LENGTH__` which will be replaced with the
 *        byte length of the stream body.
 * @param {number}   opts.root          Object number of the Catalog.
 * @param {string}   [opts.extraTrailer] Additional trailer entries (raw PDF).
 * @returns {Buffer}
 */
function buildPDF({ objects, root, extraTrailer = '' }) {
  const header = '%PDF-1.4\n';

  // Serialise each object ────────────────────────────────────────────────────
  const parts = objects.map((obj) => {
    let s = `${obj.num} 0 obj\n`;
    if (obj.stream !== undefined) {
      const len = Buffer.byteLength(obj.stream, 'latin1');
      s += obj.dict.replace('__LENGTH__', String(len)) + '\n';
      s += `stream\n${obj.stream}\nendstream\n`;
    } else {
      s += `${obj.dict}\n`;
    }
    s += 'endobj\n\n';
    return { num: obj.num, text: s };
  });

  // Concatenate & record byte offsets ────────────────────────────────────────
  let body = header;
  const offsets = {};
  for (const p of parts) {
    offsets[p.num] = Buffer.byteLength(body, 'latin1');
    body += p.text;
  }

  // Cross-reference table ────────────────────────────────────────────────────
  const maxNum = Math.max(...parts.map((p) => p.num));
  const xrefPos = Buffer.byteLength(body, 'latin1');

  let xref = `xref\n0 ${maxNum + 1}\n`;
  // Free-object head entry (generation 65535)
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= maxNum; i++) {
    const off = offsets[i] ?? 0;
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  // Trailer ──────────────────────────────────────────────────────────────────
  xref += 'trailer\n';
  xref += `<< /Size ${maxNum + 1} /Root ${root} 0 R ${extraTrailer}>>\n`;
  xref += `startxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(body + xref, 'latin1');
}

// ── fixture builders ─────────────────────────────────────────────────────────

function simpleText() {
  const stream = [
    'BT',
    // Title – 24 pt bold
    '/F2 24 Tf',
    '72 720 Td',
    '(Document Title) Tj',
    // Subtitle – 18 pt bold
    '/F2 18 Tf',
    '0 -36 Td',
    '(A Subtitle for Testing) Tj',
    // Body paragraph – 12 pt regular
    '/F1 12 Tf',
    '0 -30 Td',
    `(${esc('This is a paragraph of regular text. It demonstrates basic content extraction from a PDF document.')}) Tj`,
    '0 -20 Td',
    `(${esc('The file has multiple lines to verify paragraph detection and text reassembly.')}) Tj`,
    // Bold + italic mix
    '0 -30 Td',
    '/F2 12 Tf',
    '(Bold text) Tj',
    '/F1 12 Tf',
    '( and ) Tj',
    '/F3 12 Tf',
    '(italic text) Tj',
    '/F1 12 Tf',
    '( mixed in a paragraph.) Tj',
    // Bullet list
    '0 -30 Td',
    `(${esc('  \u2022 First bullet point')}) Tj`,
    '0 -18 Td',
    `(${esc('  \u2022 Second bullet point')}) Tj`,
    '0 -18 Td',
    `(${esc('  \u2022 Third bullet point')}) Tj`,
    // Link text
    '0 -30 Td',
    `(${esc('Visit https://example.com for more information.')}) Tj`,
    'ET',
  ].join('\n');

  return buildPDF({
    root: 1,
    objects: [
      { num: 1, dict: '<< /Type /Catalog /Pages 2 0 R >>' },
      { num: 2, dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      {
        num: 3,
        dict: [
          '<< /Type /Page /Parent 2 0 R',
          '   /MediaBox [0 0 612 792]',
          '   /Contents 4 0 R',
          '   /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >>',
          '   /Annots [8 0 R]',
          '>>',
        ].join('\n'),
      },
      { num: 4, dict: '<< /Length __LENGTH__ >>', stream },
      // Fonts
      { num: 5, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
      { num: 6, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' },
      { num: 7, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>' },
      // Link annotation
      {
        num: 8,
        dict: '<< /Type /Annot /Subtype /Link /Rect [72 410 350 425] /Border [0 0 0] /A << /S /URI /URI (https://example.com) >> >>',
      },
    ],
  });
}

function multiPage() {
  const page1 = [
    'BT',
    '/F2 24 Tf  72 720 Td',
    `(${esc('Page 1: Introduction')}) Tj`,
    '/F1 12 Tf  0 -36 Td',
    `(${esc('This is the first page of a multi-page document.')}) Tj`,
    '0 -20 Td',
    `(${esc('It contains introductory content useful for testing page-by-page extraction.')}) Tj`,
    'ET',
  ].join('\n');

  const page2 = [
    'BT',
    '/F2 20 Tf  72 720 Td',
    `(${esc('Page 2: Main Content')}) Tj`,
    '/F1 12 Tf  0 -30 Td',
    `(${esc('The second page holds the main body of the document.')}) Tj`,
    '0 -20 Td',
    `(${esc('Additional details and explanations are provided here.')}) Tj`,
    '0 -20 Td',
    `(${esc('Multiple paragraphs help test cross-page content extraction.')}) Tj`,
    'ET',
  ].join('\n');

  const page3 = [
    'BT',
    '/F2 20 Tf  72 720 Td',
    `(${esc('Page 3: Conclusion')}) Tj`,
    '/F1 12 Tf  0 -30 Td',
    `(${esc('This is the final page of the document.')}) Tj`,
    '0 -20 Td',
    `(${esc('It wraps up the content presented on the previous pages.')}) Tj`,
    'ET',
  ].join('\n');

  return buildPDF({
    root: 1,
    objects: [
      { num: 1, dict: '<< /Type /Catalog /Pages 2 0 R >>' },
      { num: 2, dict: '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>' },
      // ── Page 1
      {
        num: 3,
        dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 9 0 R /F2 10 0 R >> >> >>',
      },
      { num: 4, dict: '<< /Length __LENGTH__ >>', stream: page1 },
      // ── Page 2
      {
        num: 5,
        dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R /F2 10 0 R >> >> >>',
      },
      { num: 6, dict: '<< /Length __LENGTH__ >>', stream: page2 },
      // ── Page 3
      {
        num: 7,
        dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R /F2 10 0 R >> >> >>',
      },
      { num: 8, dict: '<< /Length __LENGTH__ >>', stream: page3 },
      // ── Fonts (shared)
      { num: 9,  dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
      { num: 10, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' },
    ],
  });
}

function withTables() {
  // 3 columns × 4 rows (1 header + 3 data).
  // Columns at x = 80, 230, 380.  Row baseline starts at y = 695.
  const rowH = 22;
  const y0 = 695;
  const cols = [80, 230, 380];

  const rows = [
    { font: '/F2 12 Tf', cells: ['Name', 'Age', 'City'] },
    { font: '/F1 12 Tf', cells: ['Alice', '30', 'New York'] },
    { font: '/F1 12 Tf', cells: ['Bob', '25', 'San Francisco'] },
    { font: '/F1 12 Tf', cells: ['Charlie', '35', 'Chicago'] },
  ];

  // Build content stream
  const lines = [];

  // ── Table border lines (graphics) ──
  const top = y0 + 10;
  const bottom = y0 - rows.length * rowH + 10;
  const left = cols[0] - 8;
  const right = 500;

  lines.push('0.4 w');
  // Horizontal lines
  for (let r = 0; r <= rows.length; r++) {
    const y = top - r * rowH;
    lines.push(`${left} ${y} m ${right} ${y} l S`);
  }
  // Vertical lines
  for (const x of [left, ...cols.map((c) => c - 8), right]) {
    // deduplicate left edge
  }
  lines.push(`${left} ${top} m ${left} ${bottom} l S`);
  for (const x of cols.slice(1)) {
    lines.push(`${x - 8} ${top} m ${x - 8} ${bottom} l S`);
  }
  lines.push(`${right} ${top} m ${right} ${bottom} l S`);

  // ── Table text ──
  lines.push('BT');
  rows.forEach((row, ri) => {
    lines.push(row.font);
    row.cells.forEach((cell, ci) => {
      const y = y0 - ri * rowH;
      lines.push(`1 0 0 1 ${cols[ci]} ${y} Tm`);
      lines.push(`(${esc(cell)}) Tj`);
    });
  });
  lines.push('ET');

  const stream = lines.join('\n');

  return buildPDF({
    root: 1,
    objects: [
      { num: 1, dict: '<< /Type /Catalog /Pages 2 0 R >>' },
      { num: 2, dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      {
        num: 3,
        dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
      },
      { num: 4, dict: '<< /Length __LENGTH__ >>', stream },
      { num: 5, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
      { num: 6, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' },
    ],
  });
}

function withCodeBlocks() {
  const stream = [
    'BT',
    // Intro text
    '/F1 12 Tf',
    '72 720 Td',
    `(${esc('Here is some regular text before the code block:')}) Tj`,
    // Code block in Courier (monospace)
    '/F2 10 Tf',
    '0 -28 Td',
    `(${esc('function greet(name) {')}) Tj`,
    '0 -14 Td',
    `(${esc('  const message = "Hello, " + name;')}) Tj`,
    '0 -14 Td',
    `(${esc('  console.log(message);')}) Tj`,
    '0 -14 Td',
    `(${esc('}')}) Tj`,
    // Back to regular text
    '/F1 12 Tf',
    '0 -28 Td',
    `(${esc('And here is a second code example:')}) Tj`,
    // Second code block
    '/F2 10 Tf',
    '0 -28 Td',
    `(${esc('import os')}) Tj`,
    '0 -14 Td',
    `(${esc('import sys')}) Tj`,
    '0 -14 Td',
    `(${esc('')}) Tj`,
    '0 -14 Td',
    `(${esc('def main():')}) Tj`,
    '0 -14 Td',
    `(${esc('    print("Hello World")')}) Tj`,
    // Closing regular text
    '/F1 12 Tf',
    '0 -28 Td',
    `(${esc('Regular text resumes after the code blocks above.')}) Tj`,
    'ET',
  ].join('\n');

  return buildPDF({
    root: 1,
    objects: [
      { num: 1, dict: '<< /Type /Catalog /Pages 2 0 R >>' },
      { num: 2, dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      {
        num: 3,
        dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
      },
      { num: 4, dict: '<< /Length __LENGTH__ >>', stream },
      { num: 5, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
      { num: 6, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>' },
    ],
  });
}

function corrupt() {
  // Random garbage that is definitely not a valid PDF.
  const bytes = Buffer.alloc(512);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Overwrite the first few bytes so it doesn't accidentally start with %PDF
  bytes.write('NOT_A_PDF_FILE', 0, 'ascii');
  return bytes;
}

function encrypted() {
  // Minimal valid PDF structure with an /Encrypt dictionary in the trailer.
  // pdfjs-dist detects /Encrypt → tries password auth → throws PasswordException.
  //
  // The /O and /U values are arbitrary 32-byte hex strings; the empty-password
  // check will fail against them so pdfjs-dist will require a password.

  const O = 'A' .repeat(64); // 32 bytes as hex
  const U = 'B'.repeat(64);

  const contentStream = [
    'BT',
    '/F1 12 Tf',
    '72 700 Td',
    '(This content is encrypted.) Tj',
    'ET',
  ].join('\n');

  return buildPDF({
    root: 1,
    extraTrailer: `/Encrypt 7 0 R /ID [<${O}> <${U}>] `,
    objects: [
      { num: 1, dict: '<< /Type /Catalog /Pages 2 0 R >>' },
      { num: 2, dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      {
        num: 3,
        dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      },
      { num: 4, dict: '<< /Length __LENGTH__ >>', stream: contentStream },
      { num: 5, dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
      // Placeholder info dict
      { num: 6, dict: '<< /Producer (Test) >>' },
      // Standard encryption dictionary – V1/R2 (40-bit RC4)
      {
        num: 7,
        dict: [
          '<< /Type /Encrypt',
          '   /Filter /Standard',
          '   /V 1',
          '   /R 2',
          '   /Length 40',
          `   /O <${O}>`,
          `   /U <${U}>`,
          '   /P -4',
          '>>',
        ].join('\n'),
      },
    ],
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

const fixtures = [
  { name: 'simple-text.pdf',      data: simpleText()     },
  { name: 'multi-page.pdf',       data: multiPage()      },
  { name: 'with-tables.pdf',      data: withTables()      },
  { name: 'with-code-blocks.pdf', data: withCodeBlocks()  },
  { name: 'corrupt.pdf',          data: corrupt()         },
  { name: 'encrypted.pdf',        data: encrypted()       },
];

for (const { name, data } of fixtures) {
  const dest = join(__dirname, name);
  writeFileSync(dest, data);
  console.log(`✓  ${name}  (${data.length} bytes)`);
}

console.log(`\nAll ${fixtures.length} fixture PDFs written to ${__dirname}`);
