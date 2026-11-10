import { errorResponse, HttpError, json, readJson, requireString, requireTaskCode } from "../lib/http.js";
import { createModelResponse } from "../lib/openai.js";
import { buildInstructions, sanitizeHistory } from "../lib/prompts.js";
import { isCompleteRanking } from "../lib/rankings.js";
import { findMessage, findSession, saveMessage, supabaseRequest } from "../lib/supabase.js";

async function enforceMessageLimit(sessionId) {
  const rows = await supabaseRequest(`messages?session_id=eq.${encodeURIComponent(sessionId)}&role=eq.user&select=id,created_at&order=created_at.desc&limit=61`);
  if ((rows?.length ?? 0) >= 60) throw new HttpError(429, "이 세션에서 보낼 수 있는 메시지 수를 초과했습니다.");
  const minuteAgo = Date.now() - 60_000;
  const recent = (rows ?? []).filter((row) => Date.parse(row.created_at) >= minuteAgo).length;
  if (recent >= 10) throw new HttpError(429, "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.");
}

export async function POST(request) {
  const started = Date.now();
  try {
    const body = await readJson(request);
    const sessionId = requireString(body.sessionId, "sessionId", { max: 80 });
    const clientMessageId = requireString(body.clientMessageId, "clientMessageId", { max: 120 });
    const taskCode = requireTaskCode(body.taskCode);
    const message = requireString(body.message, "message", { max: 4000 });
    const session = await findSession(sessionId);
    if (session.task_code !== taskCode) throw new HttpError(409, "세션의 과제 코드가 일치하지 않습니다.");
    if (session.status !== "active") throw new HttpError(409, "이미 종료된 연구 세션입니다.");

    const cached = await findMessage(sessionId, `${clientMessageId}:assistant`);
    if (cached) return json({
      text: cached.content,
      responseId: cached.openai_response_id,
      requestId: cached.openai_request_id,
      model: cached.model,
      latencyMs: cached.latency_ms,
      cached: true,
    });
    await enforceMessageLimit(sessionId);

    const history = sanitizeHistory(body.history);
    const turnIndex = Number.isInteger(body.turnIndex) ? body.turnIndex : history.filter((x) => x.role === "user").length + 1;
    let context = body.context && typeof body.context === "object" ? body.context : {};
    if (taskCode === "TASK_1_DESERT") {
      const rankings = await supabaseRequest(`task1_rankings?session_id=eq.${encodeURIComponent(sessionId)}&select=initial_ranking,initial_rationales,ai_ranking,current_ranking,discussion_turns&limit=1`);
      const saved = rankings?.[0];
      if (!isCompleteRanking(saved?.initial_ranking) || !isCompleteRanking(saved?.ai_ranking)) throw new HttpError(409, "저장된 초기 순위를 찾을 수 없습니다.");
      if (context.currentDraftRanking != null && !isCompleteRanking(context.currentDraftRanking)) throw new HttpError(400, "현재 최종 순위 형식이 올바르지 않습니다.");
      context = {
        ...context,
        participantRanking: saved.initial_ranking,
        participantReasons: saved.initial_rationales ?? {},
        aiRanking: saved.ai_ranking,
        currentDraftRanking: context.currentDraftRanking ?? saved.current_ranking ?? saved.initial_ranking,
      };
    }

    await saveMessage({
      session_id: sessionId,
      client_message_id: clientMessageId,
      task_code: taskCode,
      role: "user",
      content: message,
      turn_index: turnIndex,
      metadata: {},
    });

    const now = new Date().toISOString();
    await supabaseRequest(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { last_seen_at: now },
    });
    if (taskCode === "TASK_1_DESERT" && isCompleteRanking(context.currentDraftRanking)) {
      await supabaseRequest("task1_rankings?on_conflict=session_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { session_id: sessionId, current_ranking: context.currentDraftRanking, discussion_turns: turnIndex, updated_at: now },
      });
    }

    let generated;
    try {
      generated = await createModelResponse({
        instructions: buildInstructions(taskCode, context),
        input: [...history, { role: "user", content: message }],
        clientRequestId: clientMessageId,
      });
    } catch (generationError) {
      await supabaseRequest("events", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          session_id: sessionId,
          event_type: "ai_generation_failed",
          payload: { turnIndex, status: generationError.status ?? 500 },
          client_occurred_at: new Date().toISOString(),
        },
      }).catch(() => {});
      throw generationError;
    }
    const latencyMs = Date.now() - started;

    await saveMessage({
      session_id: sessionId,
      client_message_id: `${clientMessageId}:assistant`,
      task_code: taskCode,
      role: "assistant",
      content: generated.text,
      turn_index: turnIndex,
      model: generated.model,
      openai_response_id: generated.responseId,
      openai_request_id: generated.requestId,
      latency_ms: latencyMs,
      usage: generated.usage ?? {},
      metadata: { store: false },
    });

    return json({
      text: generated.text,
      responseId: generated.responseId,
      requestId: generated.requestId,
      model: generated.model,
      latencyMs,
      cached: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

