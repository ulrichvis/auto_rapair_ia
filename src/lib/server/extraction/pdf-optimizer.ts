import "server-only";

import { randomUUID } from "node:crypto";

import { PdfiumNative } from "@embedpdf/engines/pdfium";
import { init } from "@embedpdf/pdfium";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const TARGET_DPI = 180;
const PDF_POINTS_PER_INCH = 72;
const JPEG_QUALITY = 85;

function toArrayBuffer(bytes: Buffer) {
  const copy = Uint8Array.from(bytes);
  return copy.buffer;
}

export async function optimizePdfForExtraction(original: Buffer) {
  const pdfiumModule = await init({});
  const engine = new PdfiumNative(pdfiumModule, { fontFallback: null });

  try {
    const sourceDocument = await engine
      .openDocumentBuffer({
        id: `processing-${randomUUID()}`,
        content: toArrayBuffer(original),
      })
      .toPromise();

    try {
      const output = await PDFDocument.create();

      for (const sourcePage of sourceDocument.pages) {
        const rendered = await engine
          .renderPageRaw(sourceDocument, sourcePage, {
            scaleFactor: TARGET_DPI / PDF_POINTS_PER_INCH,
            withAnnotations: true,
            withForms: true,
          })
          .toPromise();
        const jpeg = await sharp(Buffer.from(rendered.data), {
          raw: {
            width: rendered.width,
            height: rendered.height,
            channels: 4,
          },
        })
          .flatten({ background: "white" })
          .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: "4:4:4" })
          .toBuffer();
        const image = await output.embedJpg(jpeg);
        const quarterTurn =
          sourcePage.rotation === 1 || sourcePage.rotation === 3;
        const width = quarterTurn
          ? sourcePage.size.height
          : sourcePage.size.width;
        const height = quarterTurn
          ? sourcePage.size.width
          : sourcePage.size.height;
        const page = output.addPage([width, height]);

        page.drawImage(image, { x: 0, y: 0, width, height });
      }

      return Buffer.from(
        await output.save({ addDefaultPage: false, useObjectStreams: true }),
      );
    } finally {
      await engine
        .closeDocument(sourceDocument)
        .toPromise()
        .catch(() => {});
    }
  } finally {
    await engine
      .destroy()
      .toPromise()
      .catch(() => {});
  }
}
