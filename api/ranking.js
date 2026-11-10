import { errorResponse, HttpError, json, readJson, requireString } from "../lib/http.js";
import { countPositionDifferences, createContrastingRanking, isCompleteRanking } from "../lib/rankings.js";
import { findSession, supabaseRequest } from "../lib/supabase.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const sessionId = requireString(body.sessionId, "sessionId", { max: 80 });
    const session = await findSession(sessionId);
    if (session.task_code !== "TASK_1_DESERT") throw new HttpError(409, "사막 생존 과제 세션이 아닙니다.");
    if (!isCompleteRanking(body.participantRanking)) throw new HttpError(400, "참가자 순위 형식이 올바르지 않습니다.");

    const savedRows = await supabaseRequest(`task1_rankings?session_id=eq.${encodeURIComponent(sessionId)}&select=initial_ranking,ai_ranking,ai_ranking_generation_version&limit=1`);
    const saved = savedRows?.[0];
    if (saved?.initial_ranking && JSON.stringify(saved.initial_ranking) !== JSON.stringify(body.participantRanking)) {
      throw new HttpError(409, "이미 제출한 초기 순위와 일치하지 않습니다.");
    }
    if (isCompleteRanking(saved?.ai_ranking)) {
      return json({
        ranking: saved.ai_ranking,
        positionDifferences: countPositionDifferences(body.participantRanking, saved.ai_ranking),
        generationVersion: saved.ai_ranking_generation_version || "seeded-v1",
        reused: true,
      });
    }

    const ranking = createContrastingRanking(body.participantRanking, { seed: sessionId, minDifferences: 5 });
    const now = new Date().toISOString();
    await supabaseRequest("task1_rankings?on_conflict=session_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        session_id: sessionId,
        initial_ranking: body.participantRanking,
        ai_ranking: ranking,
        ai_ranking_generation_version: "seeded-v1",
        current_ranking: body.participantRanking,
        updated_at: now,
      },
    });
    return json({
      ranking,
      positionDifferences: countPositionDifferences(body.participantRanking, ranking),
      generationVersion: "seeded-v1",
      reused: false,
    }, 201);
  } catch (error) {
    console.error("AI initial ranking generation failed", error);
    return errorResponse(error);
  }
}
