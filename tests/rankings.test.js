import test from "node:test";
import assert from "node:assert/strict";
import { DESERT_ITEMS, countPositionDifferences, createContrastingRanking, isCompleteRanking } from "../lib/rankings.js";

test("AI 순위는 10개 물품을 중복 없이 포함하고 최소 5개 위치가 다르다", () => {
  const ranking = createContrastingRanking(DESERT_ITEMS, { seed: "session-1" });
  assert.equal(isCompleteRanking(ranking), true);
  assert.ok(countPositionDifferences(DESERT_ITEMS, ranking) >= 5);
});

test("같은 세션과 참가자 순위에는 같은 AI 순위를 생성한다", () => {
  const first = createContrastingRanking(DESERT_ITEMS, { seed: "session-2" });
  const second = createContrastingRanking(DESERT_ITEMS, { seed: "session-2" });
  assert.deepEqual(first, second);
});

test("누락·중복된 참가자 순위를 거부한다", () => {
  assert.throws(() => createContrastingRanking([...DESERT_ITEMS.slice(0, 9), DESERT_ITEMS[0]]));
});
