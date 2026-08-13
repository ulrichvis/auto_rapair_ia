import {
  MAX_PDF_SIZE_BYTES,
  PdfUploadError,
  uploadPdfDocument,
} from "@/lib/server/documents/upload-pdf";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";

const MAX_MULTIPART_SIZE_BYTES = MAX_PDF_SIZE_BYTES + 128 * 1024;

export async function POST(request: Request) {
  const uploadT = await getTranslations("Upload");
  const apiT = await getTranslations("ApiErrors");
  const contentType = request.headers.get("content-type");

  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    return Response.json({ error: apiT("multipartRequired") }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_MULTIPART_SIZE_BYTES
  ) {
    return Response.json({ error: uploadT("tooLarge") }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new PdfUploadError(uploadT("selectOne"), 400);
    }

    const result = await uploadPdfDocument(file);

    return Response.json(result, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    if (error instanceof PdfUploadError) {
      const translatedMessage = {
        "Select a PDF file.": uploadT("selectPdf"),
        "The PDF must be 4 MiB or smaller.": uploadT("tooLarge"),
        "The PDF filename is invalid or too long.": uploadT("invalidFilename"),
        "The selected PDF is empty.": uploadT("empty"),
        "The selected file is not a valid PDF.": uploadT("invalidPdf"),
      }[error.message];

      return Response.json(
        { error: translatedMessage ?? error.message },
        { status: error.status },
      );
    }

    console.error("PDF upload failed", error);

    return Response.json({ error: uploadT("failedRetry") }, { status: 500 });
  }
}
