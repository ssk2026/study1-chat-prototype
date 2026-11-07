import { json } from "../lib/http.js";

export function GET() {
  return json({
    ok: true,
    configured: {
      openai: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
      supabase: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
    },
    studyVersion: process.env.STUDY_VERSION ?? null,
    node: process.version,
  });
}

