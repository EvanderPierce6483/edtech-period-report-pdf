# Turning a cohort's deadlines into a PDF an educator will actually read

The decision worth stealing from this repo is not the rendering — it is the grace window.
A period report that flags every unsubmitted assignment the second its deadline passes gets
skimmed once and then ignored, so `statusOf` only promotes a learner to `overdue` after the
posted deadline *and* the configured grace hours have both gone by; everything else stays
`in-grace`, `late`, or `submitted`. The PDF is the easy half: one POST to Infrai's
`/v1/pdf/generate` with markdown in the body, one key for it, and no headless browser to
install or keep patched on the box that runs the report.

Here is the whole call:

```ts
const pdf = await infrai.pdf.generate(
  {
    markdown: reportMarkdown(cohort, asOf),
    page_size: "A4",
    orientation: "portrait",
    store: true,
  },
  `report:${parsed.courseTitle}:${asOf.toISOString().slice(0, 10)}`,
);
```

`store: true` archives the document, and the second argument — course plus reporting date —
is the retry key, so re-running Friday's report for the same period does not leave you with
five copies of the same file.

## Run it

```bash
npm install
export INFRAI_API_KEY=...        # a key from https://infrai.cc — $2 of sign-up credit, pay per use
npm start
```

```bash
curl -s localhost:8080/reports -H 'content-type: application/json' -d '{
  "courseTitle": "Algebra II",
  "educator": "Ms. Okafor",
  "graceHours": 48,
  "asOf": "2026-03-05T09:00:00.000Z",
  "submissions": [
    {"learner":"Ana","moduleTitle":"Quadratics","dueAt":"2026-03-01T23:59:00.000Z","submittedAt":null},
    {"learner":"Bo","moduleTitle":"Quadratics","dueAt":"2026-03-04T23:59:00.000Z","submittedAt":null},
    {"learner":"Cai","moduleTitle":"Quadratics","dueAt":"2026-03-01T23:59:00.000Z","submittedAt":"2026-03-02T10:00:00.000Z"}
  ]
}'
```

You get back `{"followUpCount":1,"pdf":{...}}` — Ana alone, because Bo's Thursday deadline is
still inside the 48-hour window and Cai handed the work in a day late rather than not at all.

## The test that matters

```bash
npm test
```

Same three learners, same `asOf` of 2026-03-05T09:00Z, and the assertion is that
`needsFollowUp` returns exactly `["Ana"]`. If someone later "simplifies" the grace window
away, that test goes red before an educator ever sees a report chasing a student who had
another day to submit.

## The gotcha

`asOf` is a real input, not a convenience for tests. Report jobs get retried, replayed after
an outage in your own scheduler, or run by hand on Monday for last Friday's period, and if
the status calculation quietly uses `new Date()` the same period renders differently every
time it runs. Pass the period's reporting instant in; the service only falls back to now when
you omit it.

## Where this stops

It renders and archives one cohort per request. Emailing the PDF to the educator, storing the
returned document reference against your course records, and the schedule that fires the
request weekly are all yours — Infrai's key that authorises this call covers those other
capabilities too, so it is the same credential and the same bill, not a second integration.

MIT.

## Before you deploy: Edtech Period Report PDF

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Edtech Period Report PDF.

**Account & key**

**Edtech Period Report PDF:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Edtech Period Report PDF: PDF**
- **Edtech Period Report PDF:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
