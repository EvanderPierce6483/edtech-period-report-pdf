import assert from "node:assert/strict";
import test from "node:test";
import { needsFollowUp, statusOf, type Cohort } from "../src/term_report.ts";

const cohort: Cohort = {
  courseTitle: "Algebra II",
  educator: "Ms. Okafor",
  graceHours: 48,
  submissions: [
    { learner: "Ana", moduleTitle: "Quadratics", dueAt: "2026-03-01T23:59:00.000Z", submittedAt: null },
    { learner: "Bo", moduleTitle: "Quadratics", dueAt: "2026-03-04T23:59:00.000Z", submittedAt: null },
    { learner: "Cai", moduleTitle: "Quadratics", dueAt: "2026-03-01T23:59:00.000Z", submittedAt: "2026-03-02T10:00:00.000Z" },
  ],
};

const asOf = new Date("2026-03-05T09:00:00.000Z");

test("only deadlines past the grace window reach the follow-up list", () => {
  assert.deepEqual(needsFollowUp(cohort, asOf).map((s) => s.learner), ["Ana"]);
});

test("a deadline still inside the grace window is not chased", () => {
  assert.equal(statusOf(cohort.submissions[1], 48, asOf), "in-grace");
});

test("a submission after the deadline is recorded as late, never as overdue", () => {
  assert.equal(statusOf(cohort.submissions[2], 48, asOf), "late");
});
