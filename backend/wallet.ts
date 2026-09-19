import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_ORIGINS = ["https://gukoren-crypto.github.io", "http://127.0.0.1:5173"];

const MAX_BYTES = 32 * 1024 * 1024; // 32 MiB

const HEX64 = /^[0-9a-f]{64}$/;
const HEX24 = /^[0-9a-f]{24}$/;
const HEXANY = /^[0-9a-f]*$/;

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    vary: "Origin",
    "cache-control": "no-store",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-max-age"] = "86400";
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Payload = { format: number; iv: string; data: string };
type RpcResult = { status: string; revision?: number; payload?: Payload };


function validPayload(p: unknown): p is Payload {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    o["format"] === 1 &&
    typeof o["iv"] === "string" &&
    HEX24.test(o["iv"]) &&
    typeof o["data"] === "string" &&
    HEXANY.test(o["data"]) &&
    o["data"].length % 2 === 0 &&
    o["data"].length > 0
  );
}

export const Route = createFileRoute("/api/public/wallet")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
          return new Response(null, { status: 403 });
        }
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      },

      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin !== null && !ALLOWED_ORIGINS.includes(origin)) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }

        const declared = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declared) && declared > MAX_BYTES) {
          return json({ error: "payload_too_large" }, 413, origin);
        }

        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > MAX_BYTES) {
          return json({ error: "payload_too_large" }, 413, origin);
        }

        let body: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("bad");
          }
          body = parsed as Record<string, unknown>;
        } catch {
          return json({ error: "invalid_json" }, 400, origin);
        }

        const action = body["action"];
        const id = body["id"];
        const token = body["token"];

        if (action !== "create" && action !== "read" && action !== "write") {
          return json({ error: "invalid_action" }, 400, origin);
        }
        if (typeof id !== "string" || !HEX64.test(id)) {
          return json({ error: "invalid_id" }, 400, origin);
        }
        if (typeof token !== "string" || !HEX64.test(token)) {
          return json({ error: "invalid_token" }, 400, origin);
        }

        const payload = body["payload"];
        if (action === "create" || action === "write") {
          if (!validPayload(payload)) {
            return json({ error: "invalid_payload" }, 400, origin);
          }
        }

        // Optimistic concurrency is mandatory for writes: no NULL/missing bypass.
        let expectedRevision = 0;
        if (action === "write") {
          const er = body["expectedRevision"];
          if (typeof er !== "number" || !Number.isInteger(er) || er < 1) {
            return json({ error: "invalid_expected_revision" }, 400, origin);
          }
          expectedRevision = er;
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Rate limiting per IP (hashed, never stored raw).
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        const ipHash = await sha256Hex(ip);
        const limit = action === "create" ? 5 : 60;
        const windowSeconds = action === "create" ? 3600 : 60;
        const { data: allowed, error: rateError } = await supabaseAdmin.rpc("wallet_rate_check", {
          p_ip_hash: ipHash,
          p_action: action === "create" ? "create" : "use",
          p_limit: limit,
          p_window_seconds: windowSeconds,
        });
        if (rateError) {
          return json({ error: "server_error" }, 500, origin);
        }
        if (allowed === false) {
          return json({ error: "rate_limited" }, 429, origin);
        }

        const tokenHash = await sha256Hex(token);
        let result: RpcResult | null = null;
        let error: { message: string } | null = null;

        if (action === "create") {
          const p = payload as Payload;
          const res = await supabaseAdmin.rpc("wallet_create", {
            p_id: id,
            p_token_hash: tokenHash,
            p_format: p.format,
            p_iv: p.iv,
            p_data: p.data,
          });
          result = res.data as unknown as RpcResult | null;
          error = res.error;
        } else if (action === "read") {
          const res = await supabaseAdmin.rpc("wallet_read", {
            p_id: id,
            p_token_hash: tokenHash,
          });
          result = res.data as unknown as RpcResult | null;
          error = res.error;
        } else {
          const p = payload as Payload;
          const res = await supabaseAdmin.rpc("wallet_write", {
            p_id: id,
            p_token_hash: tokenHash,
            p_format: p.format,
            p_iv: p.iv,
            p_data: p.data,
            p_expected_revision: expectedRevision,
          });
          result = res.data as unknown as RpcResult | null;
          error = res.error;
        }


        if (error || !result) {
          console.error("wallet rpc failure", error?.message);
          return json({ error: "server_error" }, 500, origin);
        }

        if (result.status === "invalid") {
          return json({ error: "invalid_expected_revision" }, 400, origin);
        }
        if (result.status === "denied") {

          return json({ error: "forbidden" }, 403, origin);
        }
        if (result.status === "conflict") {
          return json({ conflict: true }, 409, origin);
        }

        return json({ revision: result.revision, payload: result.payload }, 200, origin);
      },
    },
  },
});

