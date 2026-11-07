import { errorResponse, json, readJson, requireString } from "../lib/http.js";
import { findSession, supabaseRequest } from "../lib/supabase.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const sessionId = requireString(body.sessionId, "sessionId", { max: 80 });
    const eventType = requireString(body.eventType, "eventType", { max: 120 });
    await findSession(sessionId);
    const rows = await supabaseRequest("events", {
      method: "POST",
      prefer: "return=representation",
      body: {
        session_id: sessionId,
        event_type: eventType,
        payload: body.payload && typeof body.payload === "object" ? body.payload : {},
        client_occurred_at: body.occurredAt ?? null,
      },
    });
    return json({ eventId: rows?.[0]?.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

