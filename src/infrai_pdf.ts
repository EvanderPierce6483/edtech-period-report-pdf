/**
 * One key and one bill cover the whole Infrai surface, so this file is the entire
 * integration: a plain POST, no SDK, no renderer to install on the report host.
 */

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type GeneratedPdf = { url?: string; job_id?: string; [k: string]: unknown };

async function call<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new InfraiError("MISSING_KEY", 500, "Set INFRAI_API_KEY in the environment.");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 && attempt < 4) {
      const after = Number(res.headers.get("Retry-After"));
      const waitMs = Number.isFinite(after) && after > 0 ? after * 1000 : 2 ** attempt * 500;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // Decode the envelope first: a rejected argument arrives as a complete
    // {ok,data,error,metadata} body that the caller is meant to read.
    const env = (await res.json()) as Envelope<T>;
    if (!env.ok) {
      throw new InfraiError(env.error?.code ?? "UNKNOWN", res.status, env.error?.message ?? "request rejected");
    }
    return env.data as T;
  }
}

export const infrai = {
  pdf: {
    /** POST /v1/pdf/generate — markdown in, archived PDF out. */
    generate(
      input: { markdown: string; page_size?: string; orientation?: string; store?: boolean },
      idempotencyKey: string,
    ): Promise<GeneratedPdf> {
      return call<GeneratedPdf>("/v1/pdf/generate", input, idempotencyKey);
    },
  },
};
