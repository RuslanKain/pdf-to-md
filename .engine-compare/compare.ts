import * as fs from 'fs';
import * as path from 'path';
import { convertPdfToMarkdown } from '../src/services/conversion-pipeline';

async function main() {
  const pdfPath = path.resolve('tests/fixtures/with-tables.pdf');
  const outputDir = path.resolve('.engine-compare/outputs');

  const common = {
    filePath: pdfPath,
    preserveLayout: false,
    detectTables: true,
    mergeLines: true,
    extractImages: 'inline' as const,
    imageFormat: 'png' as const,
    imageMinSize: 64,
    pythonPath: '',
    outputDir,
  };

  for (const engine of ['mupdf', 'pdfjs', 'pythonSidecar'] as const) {
    try {
      const result = await convertPdfToMarkdown({ ...common, engine });
      const out = path.join(outputDir, `with-tables.${engine}.md`);
      fs.writeFileSync(out, result.markdown, 'utf8');
      console.log(`OK ${engine} chars=${result.markdown.length}`);
    } catch (err: any) {
      const out = path.join(outputDir, `with-tables.${engine}.error.txt`);
      fs.writeFileSync(out, err?.stack || String(err), 'utf8');
      console.log(`FAIL ${engine}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
