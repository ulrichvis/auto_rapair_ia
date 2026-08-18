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
      throw new PdfUploadError("FILE_REQUIRED", 400);
    }

    const result = await uploadPdfDocument(file);

    return Response.json(result, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    if (error instanceof PdfUploadError) {
      const translatedMessage = {
        FILE_REQUIRED: uploadT("selectOne"),
        NOT_PDF: uploadT("selectPdf"),
        TOO_LARGE: uploadT("tooLarge"),
        INVALID_FILENAME: uploadT("invalidFilename"),
        EMPTY: uploadT("empty"),
        INVALID_PDF: uploadT("invalidPdf"),
      }[error.code];

      return Response.json(
        { error: translatedMessage },
        { status: error.status },
      );
    }

    console.error("PDF upload failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json({ error: uploadT("failedRetry") }, { status: 500 });
  }
}
