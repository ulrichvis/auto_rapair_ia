import {
  MAX_PDF_SIZE_BYTES,
  PdfUploadError,
  uploadPdfDocument,
} from "@/lib/server/documents/upload-pdf";

export const runtime = "nodejs";

const MAX_MULTIPART_SIZE_BYTES = MAX_PDF_SIZE_BYTES + 128 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");

  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    return Response.json(
      { error: "Upload the PDF as multipart form data." },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_MULTIPART_SIZE_BYTES
  ) {
    return Response.json(
      { error: "The PDF must be 4 MiB or smaller." },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new PdfUploadError("Select one PDF to upload.", 400);
    }

    const result = await uploadPdfDocument(file);

    return Response.json(result, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    if (error instanceof PdfUploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("PDF upload failed", error);

    return Response.json(
      { error: "The PDF could not be uploaded. Please try again." },
      { status: 500 },
    );
  }
}
