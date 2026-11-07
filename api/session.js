import { errorResponse, json, readJson, requireString, requireTaskCode } from "../lib/http.js";
import { supabaseRequest } from "../lib/supabase.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const clientSessionId = requireString(body.clientSessionId, "clientSessionId", { max: 120 });
    const participantId = requireString(body.participantId, "participantId", { max: 80 });
    const taskCode = requireTaskCode(body.taskCode);
    const conditionCode = requireString(body.conditionCode, "conditionCode", { max: 120 });
    const rows = await supabaseRequest("sessions?on_conflict=client_session_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        client_session_id: clientSessionId,
        participant_id: participantId,
        task_code: taskCode,
        condition_code: conditionCode,
        status: "active",
        study_version: process.env.STUDY_VERSION ?? "unversioned",
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      },
    });
    return json({ sessionId: rows?.[0]?.id, clientSessionId, taskCode }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

