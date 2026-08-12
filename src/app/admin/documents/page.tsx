import type { Metadata } from "next";

import { PdfUploadForm } from "./pdf-upload-form";

export const metadata: Metadata = {
  title: "Documents | AutoRepair Knowledge",
};

export default function AdminDocumentsPage() {
  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Upload a technical PDF
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          Add one source document to the private technical knowledge library.
          Extraction is not started in this version.
        </p>

        <PdfUploadForm />
      </section>
    </main>
  );
}
