import assert from "node:assert/strict";
import test from "node:test";

import english from "./messages/en.json";
import italian from "./messages/it.json";

function messageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    messageKeys(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

test("English and Italian message catalogs contain the same keys", () => {
  assert.deepEqual(messageKeys(italian).sort(), messageKeys(english).sort());
});

test("English and Italian upload messages advertise the 15 MiB limit", () => {
  assert.match(english.Upload.help, /15 MiB/);
  assert.match(english.Upload.tooLarge, /15 MiB/);
  assert.match(italian.Upload.help, /15 MiB/);
  assert.match(italian.Upload.tooLarge, /15 MiB/);
});

test("English and Italian catalogs include the knowledge browser UI", () => {
  assert.equal(english.Navigation.cases, "Knowledge");
  assert.equal(italian.Navigation.cases, "Conoscenza");
  assert.ok(english.CaseBrowser.filters.dtc);
  assert.ok(italian.CaseBrowser.filters.dtc);
  assert.ok(english.CaseDetail.fields.relatedApplicability);
  assert.ok(italian.CaseDetail.fields.relatedApplicability);
  assert.equal(english.CaseDetail.edit, "Edit knowledge");
  assert.equal(italian.CaseDetail.edit, "Modifica conoscenza");
  assert.equal(english.CaseEdit.back, "Back to technical case");
  assert.equal(italian.CaseEdit.back, "Torna al caso tecnico");
  assert.equal(english.CaseEdit.save, "Save changes and mark reviewed");
  assert.equal(
    italian.CaseEdit.save,
    "Salva modifiche e contrassegna come verificato",
  );
  assert.equal(english.Navigation.retrieval, "Retrieval");
  assert.equal(italian.Navigation.retrieval, "Recupero");
  assert.equal(
    english.Retrieval.matchReasons.exact_dtc,
    "Exact normalized DTC",
  );
  assert.equal(
    italian.Retrieval.matchReasons.exact_dtc,
    "DTC normalizzato esatto",
  );
});

test("English and Italian catalogs include the ingestion dashboard UI", () => {
  assert.equal(english.Documents.status.UPLOADED, "Uploaded");
  assert.equal(english.Documents.status.QUEUED, "Queued");
  assert.equal(english.Documents.status.IMPORTING, "Importing");
  assert.equal(italian.Documents.status.UPLOADED, "Caricato");
  assert.equal(italian.Documents.status.QUEUED, "In coda");
  assert.equal(italian.Documents.status.IMPORTING, "Importazione in corso");
  assert.equal(english.Documents.openSourcePdf, "Open source PDF");
  assert.equal(italian.Documents.openSourcePdf, "Apri PDF sorgente");
  assert.ok(english.Documents.fields.totalTokens);
  assert.ok(italian.Documents.fields.totalTokens);
  assert.equal(english.Upload.uploadFiles, "Upload files");
  assert.equal(italian.Upload.uploadFiles, "Carica file");
  assert.ok(english.Queue.processing);
  assert.ok(italian.Queue.processing);
});
