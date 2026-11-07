import { errorResponse, HttpError, json, readJson, requireString, requireTaskCode } from "../lib/http.js";
import { createModelResponse } from "../lib/openai.js";
import { buildInstructions, sanitizeHistory } from "../lib/prompts.js";
import { findSession, saveMessage } from "../lib/supabase.js";

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

    const history = sanitizeHistory(body.history);
    const turnIndex = Number.isInteger(body.turnIndex) ? body.turnIndex : history.filter((x) => x.role === "user").length + 1;
    await saveMessage({
      session_id: sessionId,
      client_message_id: clientMessageId,
      task_code: taskCode,
      role: "user",
      content: message,
      turn_index: turnIndex,
      metadata: {},
    });

    const generated = await createModelResponse({
      instructions: buildInstructions(taskCode, body.context),
      input: [...history, { role: "user", content: message }],
      clientRequestId: clientMessageId,
    });
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
    });
  } catch (error) {
    return errorResponse(error);
  }
}

