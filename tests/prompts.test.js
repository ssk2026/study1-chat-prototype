import test from "node:test";
import assert from "node:assert/strict";
import { buildInstructions } from "../lib/prompts.js";

const participantRanking = ["손전등", "나침반", "소형 거울", "낙하산", "권총", "두꺼운 외투", "접이식 칼", "응급처치함", "우비", "선글라스"];
const aiRanking = ["소형 거울", "낙하산", "나침반", "두꺼운 외투", "손전등", "응급처치함", "접이식 칼", "우비", "선글라스", "권총"];

test("TASK 1 시스템 프롬프트에 검증된 순위와 연구 지침을 주입한다", () => {
  const prompt = buildInstructions("TASK_1_DESERT", {
    participantRanking,
    participantReasons: { 손전등: "익숙한 생존 도구" },
    aiRanking,
    currentDraftRanking: participantRanking,
  });

  assert.match(prompt, /친근한 한국어 존댓말/);
  assert.match(prompt, /반말로 대화해 달라고 명시적으로 요청하면/);
  assert.match(prompt, /발화량의 약 0\.5~1\.5배/);
  assert.match(prompt, /물품을 하나씩 살펴보자고 제안/);
  assert.match(prompt, /초기 순위 1위로 정한 물품/);
  assert.match(prompt, /이후 모든 대화를 AI가 주도.*필요는 없습니다/);
  assert.match(prompt, /참가자가 먼저 언급한 물품과 질문을 중심/);
  assert.match(prompt, /외부 검색/);
  assert.match(prompt, /실제 사전 조사가 존재하지 않는다는 사실/);
  assert.match(prompt, /참가자의 초기 순위: 1위 손전등/);
  assert.match(prompt, /AI의 초기 순위: 1위 소형 거울/);
  assert.match(prompt, /손전등: 익숙한 생존 도구/);
});
