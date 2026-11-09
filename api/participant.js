import { createHash } from "node:crypto";
import { errorResponse, HttpError, json, readJson } from "../lib/http.js";
import { supabaseRequest } from "../lib/supabase.js";

const TASK_CODE = "TASK_1_DESERT";
const CONDITION_CODE = "B_AI_COLLABORATIVE_PREDICTION";

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function assertCode(code) {
  if (!/^\d{8}$/.test(code)) throw new HttpError(400, "참가자 코드는 숫자 8자리로 입력해 주세요.");
}

async function findCode(code) {
  const rows = await supabaseRequest(`participant_codes?code=eq.${encodeURIComponent(code)}&select=code,status,task_code,condition_code,session_id,consented_at,started_at&limit=1`);
  if (!rows?.length || rows[0].status === "withdrawn") throw new HttpError(404, "유효하지 않은 참가자 코드입니다.");
  if (rows[0].task_code !== TASK_CODE || rows[0].condition_code !== CONDITION_CODE) throw new HttpError(404, "유효하지 않은 참가자 코드입니다.");
  return rows[0];
}

async function loadResume(sessionId) {
  if (!sessionId) return null;
  const [rankings, messages] = await Promise.all([
    supabaseRequest(`task1_rankings?session_id=eq.${encodeURIComponent(sessionId)}&select=initial_ranking,initial_rationales,ai_ranking,consensus_ranking,item_decisions,final_ranking&limit=1`),
    supabaseRequest(`messages?session_id=eq.${encodeURIComponent(sessionId)}&select=role,content,turn_index,created_at&order=created_at.asc&limit=200`),
  ]);
  return { ranking: rankings?.[0] ?? null, messages: messages ?? [] };
}

export async function POST(request) {
  try {
    const body = await readJson(request);
    const code = normalizeCode(body.code);
    assertCode(code);
    const issued = await findCode(code);
    const taskCompleted = issued.status === "task_completed";

    if (body.action === "validate") {
      return json({ valid: true, consentRequired: !issued.consented_at, resumeAvailable: Boolean(issued.session_id), taskCompleted });
    }
    if (body.action !== "start") throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    if (!issued.consented_at && body.consentAccepted !== true) throw new HttpError(400, "연구 참여 동의가 필요합니다.");

    const now = new Date().toISOString();
    const consentVersion = String(body.consentVersion || process.env.CONSENT_VERSION || "consent-draft-v1").slice(0, 80);
    let sessionId = issued.session_id;
    if (!sessionId && !taskCompleted) {
      const clientSessionId = `S1-CODE-${createHash("sha256").update(code).digest("hex").slice(0, 24)}`;
      const sessions = await supabaseRequest("sessions?on_conflict=client_session_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: {
          client_session_id: clientSessionId,
          participant_id: code,
          study_version: process.env.STUDY_VERSION || "pilot-001",
          task_code: TASK_CODE,
          condition_code: CONDITION_CODE,
          status: "active",
          started_at: issued.started_at || now,
          metadata: { recruitment: "issued_code", consentVersion },
        },
      });
      sessionId = sessions?.[0]?.id;
      if (!sessionId) throw new HttpError(502, "연구 세션을 만들지 못했습니다.");
    }

    if (!taskCompleted) {
      await supabaseRequest(`participant_codes?code=eq.${encodeURIComponent(code)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: {
          status: "started",
          session_id: sessionId,
          consented_at: issued.consented_at || now,
          consent_version: issued.consented_at ? undefined : consentVersion,
          started_at: now,
          last_seen_at: now,
        },
      });
    }

    return json({
      sessionId,
      participantId: code,
      taskCompleted,
      resume: await loadResume(sessionId),
      postSurveyUrl: process.env.POST_SURVEY_URL || "",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
