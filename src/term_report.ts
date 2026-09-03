/**
 * The teaching decision this module encodes: a learner is only chased when the
 * deadline has passed AND the configured grace window (schools give one, always)
 * has also elapsed without a submission, because a report that flags every
 * unsubmitted assignment on the due date at midnight trains educators to ignore it.
 */

export type Submission = {
  learner: string;
  moduleTitle: string;
  dueAt: string;
  submittedAt: string | null;
};

export type Cohort = {
  courseTitle: string;
  educator: string;
  graceHours: number;
  submissions: Submission[];
};

export type LearnerStatus = "submitted" | "late" | "in-grace" | "overdue";

export function statusOf(s: Submission, graceHours: number, asOf: Date): LearnerStatus {
  const due = Date.parse(s.dueAt);
  if (s.submittedAt) return Date.parse(s.submittedAt) > due ? "late" : "submitted";
  const graceEnd = due + graceHours * 3600_000;
  if (asOf.getTime() <= due) return "in-grace";
  return asOf.getTime() <= graceEnd ? "in-grace" : "overdue";
}

/** Rows an educator has to act on this week. */
export function needsFollowUp(cohort: Cohort, asOf: Date): Submission[] {
  return cohort.submissions.filter((s) => statusOf(s, cohort.graceHours, asOf) === "overdue");
}

export function reportMarkdown(cohort: Cohort, asOf: Date): string {
  const rows = cohort.submissions.map((s) => {
    const st = statusOf(s, cohort.graceHours, asOf);
    return `| ${s.learner} | ${s.moduleTitle} | ${s.dueAt.slice(0, 10)} | ${st} |`;
  });
  const chase = needsFollowUp(cohort, asOf);
  return [
    `# ${cohort.courseTitle} — delivery report`,
    ``,
    `Educator: ${cohort.educator}`,
    `Reporting date: ${asOf.toISOString().slice(0, 10)}`,
    `Grace window: ${cohort.graceHours} hours after the posted deadline`,
    ``,
    `## Follow-up list (${chase.length})`,
    ``,
    chase.length
      ? chase.map((s) => `- ${s.learner} — ${s.moduleTitle}`).join("\n")
      : `Nobody is past the grace window this period.`,
    ``,
    `## Every deadline in the period`,
    ``,
    `| Learner | Module | Due | Status |`,
    `| --- | --- | --- | --- |`,
    ...rows,
    ``,
  ].join("\n");
}
