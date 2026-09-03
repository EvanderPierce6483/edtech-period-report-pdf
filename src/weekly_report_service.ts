/**
 * Runnable entry point. POST a cohort, get back an archived PDF of the period
 * report. `npm start` boots it; the README has the curl
 * that posts a sample cohort at it.
 */
import { createServer } from "node:http";
import { z } from "zod";
import { infrai, InfraiError } from "./infrai_pdf.ts";
import { needsFollowUp, reportMarkdown, type Cohort } from "./term_report.ts";

const SubmissionSchema = z.object({
  learner: z.string().min(1),
  moduleTitle: z.string().min(1),
  dueAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
});

const CohortSchema = z.object({
  courseTitle: z.string().min(1),
  educator: z.string().min(1),
  graceHours: z.number().int().min(0).max(336),
  asOf: z.string().datetime().optional(),
  submissions: z.array(SubmissionSchema).min(1),
});

export async function renderPeriodReport(raw: unknown) {
  const parsed = CohortSchema.parse(raw);
  const asOf = new Date(parsed.asOf ?? new Date().toISOString());
  const cohort: Cohort = parsed;

  // The report identity — course plus reporting date — is also the retry key, so
  // a repeated request for the same period returns the same archived document.
  const idempotencyKey = `report:${parsed.courseTitle}:${asOf.toISOString().slice(0, 10)}`;

  const pdf = await infrai.pdf.generate(
    {
      markdown: reportMarkdown(cohort, asOf),
      page_size: "A4",
      orientation: "portrait",
      store: true,
    },
    idempotencyKey,
  );

  return { followUpCount: needsFollowUp(cohort, asOf).length, pdf };
}

if (process.argv[1] && process.argv[1].endsWith("weekly_report_service.ts")) {
  const port = Number(process.env.PORT ?? 8080);
  createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/reports") {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", async () => {
      const reply = (status: number, body: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      try {
        reply(200, await renderPeriodReport(JSON.parse(Buffer.concat(chunks).toString())));
      } catch (err) {
        if (err instanceof z.ZodError) return reply(400, { error: "invalid cohort", issues: err.issues });
        // A rejection carried in the envelope is the caller's problem, not a 500.
        if (err instanceof InfraiError) return reply(err.status < 500 ? 400 : 502, { error: err.code, message: err.message });
        reply(500, { error: "unexpected" });
      }
    });
  }).listen(port, () => console.log(`report service on :${port}`));
}
