import { errorResponse, HttpError, json, readJson, requireString } from "../lib/http.js";
import { countPositionDifferences, createContrastingRanking, isCompleteRanking } from "../lib/rankings.js";
import { findSession } from "../lib/supabase.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const sessionId = requireString(body.sessionId, "sessionId", { max: 80 });
    const session = await findSession(sessionId);
    if (session.task_code !== "TASK_1_DESERT") throw new HttpError(409, "사막 생존 과제 세션이 아닙니다.");
    if (!isCompleteRanking(body.participantRanking)) throw new HttpError(400, "참가자 순위 형식이 올바르지 않습니다.");

    const ranking = createContrastingRanking(body.participantRanking, { seed: sessionId, minDifferences: 5 });
    return json({
      ranking,
      positionDifferences: countPositionDifferences(body.participantRanking, ranking),
      generationVersion: "seeded-v1",
    }, 201);
  } catch (error) {
    console.error("AI initial ranking generation failed", error);
    return errorResponse(error);
  }
}
