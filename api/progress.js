import { errorResponse, HttpError, json, readJson, requireString } from "../lib/http.js";
import { isCompleteRanking } from "../lib/rankings.js";
import { findSession, supabaseRequest } from "../lib/supabase.js";

const STAGES = new Set(["intro", "tutorial", "initial_ranking", "collaboration"]);

function limitedReasons(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 10).map(([item, reason]) => [String(item).slice(0, 80), String(reason ?? "").slice(0, 300)]));
}

export async function POST(request) {
  try {
    const body = await readJson(request);
    const sessionId = requireString(body.sessionId, "sessionId", { max: 80 });
    const stage = requireString(body.stage, "stage", { max: 40 });
    if (!STAGES.has(stage)) throw new HttpError(400, "저장할 수 없는 진행 단계입니다.");

    const session = await findSession(sessionId);
    if (session.task_code !== "TASK_1_DESERT") throw new HttpError(409, "사막 생존 과제 세션이 아닙니다.");
    if (session.status !== "active") throw new HttpError(409, "이미 종료된 연구 세션입니다.");

    const ranking = body.ranking == null ? null : body.ranking;
    if (ranking && !isCompleteRanking(ranking)) throw new HttpError(400, "순위 형식이 올바르지 않습니다.");

    const now = new Date().toISOString();
    const stageStartedAt = typeof body.stageStartedAt === "string" && !Number.isNaN(Date.parse(body.stageStartedAt))
      ? new Date(body.stageStartedAt).toISOString()
      : now;

    await supabaseRequest(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { current_stage: stage, stage_started_at: stageStartedAt, last_seen_at: now },
    });

    if (ranking) {
      const rankingBody = stage === "initial_ranking"
        ? { session_id: sessionId, initial_draft_ranking: ranking, initial_draft_rationales: limitedReasons(body.reasons), updated_at: now }
        : { session_id: sessionId, current_ranking: ranking, updated_at: now };
      await supabaseRequest("task1_rankings?on_conflict=session_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: rankingBody,
      });
    }

    return json({ saved: true, stage, savedAt: now });
  } catch (error) {
    return errorResponse(error);
  }
}
