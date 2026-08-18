import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTechnicalCaseWhere,
  technicalCaseDetailQuery,
  technicalCaseListQuery,
} from "./case-browser";

test("builds a relational DTC filter", () => {
  const where = buildTechnicalCaseWhere({ dtc: " p0299 " });
  assert.deepEqual(where, {
    AND: [
      {
        faultCodes: {
          some: {
            normalizedCode: { equals: "P0299", mode: "insensitive" },
          },
        },
      },
    ],
  });
});

test("builds brand and engine filters against applicability", () => {
  const where = buildTechnicalCaseWhere({
    brand: "Volkswagen",
    engineCode: "CBAB",
    engineFamily: "EA189",
  });
  assert.ok(Array.isArray(where.AND));
  assert.equal(where.AND.length, 3);
  assert.deepEqual(where.AND[0], {
    applicability: {
      some: { brand: { contains: "Volkswagen", mode: "insensitive" } },
    },
  });
});

test("accepts known validation statuses and ignores unknown values", () => {
  assert.deepEqual(buildTechnicalCaseWhere({ status: "VALIDATED" }), {
    AND: [{ validationStatus: "VALIDATED" }],
  });
  assert.deepEqual(buildTechnicalCaseWhere({ status: "UNKNOWN" }), {});
});

test("list query reads structured relations without drafts", () => {
  const query = technicalCaseListQuery({ brand: "Ford" });
  assert.ok(query.select.faultCodes);
  assert.ok(query.select.applicability);
  assert.equal("ingestionRuns" in query.select, false);
  assert.equal("rawOutput" in query.select, false);
});

test("detail query loads complete relations and orders procedure steps", () => {
  const query = technicalCaseDetailQuery("case-1");
  assert.equal(query.where.id, "case-1");
  assert.deepEqual(query.include.procedures.orderBy, { position: "asc" });
  assert.deepEqual(query.include.procedures.include.steps.orderBy, {
    position: "asc",
  });
  assert.ok(query.include.measurementSpecs.include.sourceDocument);
  assert.ok(query.include.causes.include.component);
});

test("filter values preserve source-language text", () => {
  const where = buildTechnicalCaseWhere({ q: "Potenza motore ridotta" });
  assert.deepEqual(where, {
    AND: [
      {
        title: {
          contains: "Potenza motore ridotta",
          mode: "insensitive",
        },
      },
    ],
  });
});
