import { errorResponse, HttpError, json, readJson, requireString, requireTaskCode } from "../lib/http.js";
import { findSession, supabaseRequest } from "../lib/supabase.js";
import { isCompleteRanking } from "../lib/rankings.js";

function validRanking(value) {
  return isCompleteRanking(value);
}

function limitedObject(value, maxKeys = 20) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, maxKeys).map(([key, item]) => [key.slice(0, 120), String(item ?? "").slice(0, 2000)]));
}

export async function POST(request) {
  try {
    const body = await readJson(request);
    const sessionId = requireString(body.sessionId, "sessionId", { max: 80 });
    const taskCode = requireTaskCode(body.taskCode);
    const session = await findSession(sessionId);
    if (session.task_code !== taskCode) throw new HttpError(409, "세션의 과제 코드가 일치하지 않습니다.");

    if (taskCode === "TASK_1_DESERT") {
      for (const key of ["initialRanking", "aiRanking", "consensusRanking", "finalRanking"]) {
        if (body[key] != null && !validRanking(body[key])) throw new HttpError(400, `${key} 형식이 올바르지 않습니다.`);
      }
      await supabaseRequest("task1_rankings?on_conflict=session_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          session_id: sessionId,
          initial_ranking: body.initialRanking ?? null,
          initial_rationales: limitedObject(body.initialRationales),
          ai_ranking: body.aiRanking ?? null,
          consensus_ranking: body.consensusRanking ?? null,
          item_decisions: Array.isArray(body.itemDecisions) ? body.itemDecisions.slice(0, 30) : [],
          final_ranking: body.finalRanking ?? null,
          ranking_moves: Array.isArray(body.rankingMoves) ? body.rankingMoves : [],
        },
      });
    } else {
      const choices = new Set(["man", "woman", "equal"]);
      if (body.initialChoice && !choices.has(body.initialChoice)) throw new HttpError(400, "초기 선택값이 올바르지 않습니다.");
      if (body.finalChoice && !choices.has(body.finalChoice)) throw new HttpError(400, "최종 선택값이 올바르지 않습니다.");
      await supabaseRequest("task2_opinions?on_conflict=session_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          session_id: sessionId,
          initial_choice: body.initialChoice ?? null,
          initial_reason: body.initialReason?.slice(0, 8000) ?? null,
          ai_position: body.aiPosition ?? null,
          final_choice: body.finalChoice ?? null,
          final_reason: body.finalReason?.slice(0, 8000) ?? null,
          changed: body.initialChoice && body.finalChoice ? body.initialChoice !== body.finalChoice : null,
        },
      });
    }

    if (body.complete) {
      await supabaseRequest(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "complete", completed_at: new Date().toISOString() },
      });
    }
    return json({ saved: true, complete: Boolean(body.complete) });
  } catch (error) {
    return errorResponse(error);
  }
}

