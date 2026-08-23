import { assertImageSize, ValidationError } from './validate';
import { parseImportSnippet } from './manifests';

export type OcrCandidate = {
  packages: string[];
  rawText: string;
  confidence: 'low';
  method: 'tesseract.js-in-browser';
};

/**
 * In-browser OCR via tesseract.js. The image is never uploaded to a server.
 * Output is a lightweight candidate inventory only: no versions, no lock graph,
 * no installed size, no shipped bundle cost.
 */
export async function ocrImportScreenshot(file: File): Promise<OcrCandidate> {
  assertImageSize(file.size);
  if (!file.type.startsWith('image/')) {
    throw new ValidationError('Screenshot must be an image file.');
  }
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6/tesseract-core.wasm.js',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
  });
  try {
    const result = await worker.recognize(file);
    const rawText = result.data.text ?? '';
    let packages: string[] = [];
    try {
      packages = parseImportSnippet(rawText);
    } catch {
      const loose = rawText.match(/@?[a-z0-9][-a-z0-9]*\/?[a-z0-9][-a-z0-9]*/gi) ?? [];
      packages = [...new Set(loose.filter((n) => n.includes('-') || n.startsWith('@')))].slice(0, 30);
    }
    if (packages.length === 0) {
      throw new ValidationError('OCR did not find import-like package names. Paste the import block as text instead.');
    }
    return {
      packages,
      rawText,
      confidence: 'low',
      method: 'tesseract.js-in-browser',
    };
  } finally {
    await worker.terminate();
  }
}
