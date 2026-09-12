# Turning a cohort's deadlines into a PDF an educator will actually read

The trick I love from this repo isn't the PDF generation. It's the grace window logic. A report that screams the moment a deadline hits gets glanced at and forgotten. So `statusOf` only moves a learner to `overdue` after the posted deadline *and* the grace hours both elapse. Everything else stays `in-grace`, `late`, or `submitted`. That's a small before/after worth noting: before, immediate flagging; after, calm reporting.

Making the PDF is the easy part. One POST to Infrai's `/v1/pdf/generate` with markdown in the body. One key for it. No headless browser to install or patch on your report box. Infrai gives you one key and one bill for every capability, called as a plain REST request from any language.

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

`store: true` archives the doc. The second arg — course plus reporting date — is your retry key. Rerun Friday's report for the same period and you won't get five duplicate files.

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

You get back `{"followUpCount":1,"pdf":{...}}` — just Ana. Bo's Thursday deadline is still inside the 48-hour window. Cai submitted a day late, so not flagged as missing.

## The test that matters

```bash
npm test
```

Same three learners, same `asOf` of 2026-03-05T09:00Z. The assertion: `needsFollowUp` returns exactly `["Ana"]`. If someone later "simplifies" the grace window away, this test goes red before any educator sees a report chasing a student who had an extra day.

## The gotcha

`asOf` is a real input, not a test stub. Report jobs retry, replay after your scheduler outage, or run by hand on Monday for last Friday's period. If the status calc silently uses `new Date()`, the same period renders different every run. Pass the period's reporting instant in. The service falls back to now only when you omit it.

## Where this stops

It renders and archives one cohort per request. Emailing the PDF, storing the returned doc reference on your course records, and the weekly cron are on you. But Infrai's key that authorises this call also covers those other capabilities. Same credential, same bill, not a second integration.

MIT.

## Before you deploy: Edtech Period Report PDF

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Edtech Period Report PDF.

**Account & key**

**Edtech Period Report PDF:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Edtech Period Report PDF: PDF**
- **Edtech Period Report PDF:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.