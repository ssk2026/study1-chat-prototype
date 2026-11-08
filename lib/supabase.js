import { HttpError } from "./http.js";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, "Supabase 서버 환경변수가 설정되지 않았습니다.");
  return { url, key };
}

export async function supabaseRequest(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = config();
  const legacyJwtKey = key.startsWith("eyJ");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      ...(legacyJwtKey ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(502, "Supabase 요청이 실패했습니다.", {
      status: response.status,
      response: text.slice(0, 800),
    });
  }
  return text ? JSON.parse(text) : null;
}

export async function findSession(sessionId) {
  const rows = await supabaseRequest(`sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,task_code,status&limit=1`);
  if (!rows?.length) throw new HttpError(404, "연구 세션을 찾을 수 없습니다.");
  return rows[0];
}

export async function saveMessage(message) {
  const rows = await supabaseRequest("messages?on_conflict=session_id,client_message_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: message,
  });
  return rows?.[0] ?? null;
}

