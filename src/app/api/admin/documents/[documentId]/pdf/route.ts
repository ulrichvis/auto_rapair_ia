import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/server/prisma";
import { downloadPrivatePdf } from "@/lib/server/supabase-storage";

export const runtime = "nodejs";

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/documents/[documentId]/pdf">,
) {
  const apiT = await getTranslations("ApiErrors");
  const extractionT = await getTranslations("Extraction");
  const { documentId } = await context.params;

  if (!documentId || documentId.length > 64) {
    return Response.json({ error: apiT("invalidDocumentId") }, { status: 400 });
  }

  const document = await prisma.sourceDocument.findUnique({
    where: { id: documentId },
    select: { originalFilename: true, storagePath: true },
  });

  if (!document) {
    return Response.json(
      { error: extractionT("documentNotFound") },
      { status: 404 },
    );
  }

  try {
    const pdf = await downloadPrivatePdf(document.storagePath);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": contentDisposition(document.originalFilename),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Private PDF retrieval failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json({ error: apiT("pdfOpenFailed") }, { status: 502 });
  }
}
