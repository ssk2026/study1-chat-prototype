export const DESERT_ITEMS = Object.freeze([
  "손전등", "나침반", "소형 거울", "낙하산", "권총",
  "두꺼운 외투", "접이식 칼", "응급처치함", "비옷", "선글라스",
]);

export function isCompleteRanking(ranking, items = DESERT_ITEMS) {
  if (!Array.isArray(ranking) || ranking.length !== items.length) return false;
  const allowed = new Set(items);
  return new Set(ranking).size === items.length && ranking.every((item) => allowed.has(item));
}

export function countPositionDifferences(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return 0;
  return first.reduce((count, item, index) => count + Number(second[index] !== item), 0);
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createContrastingRanking(participantRanking, { seed = "study1", minDifferences = 5 } = {}) {
  if (!isCompleteRanking(participantRanking)) throw new TypeError("참가자 순위에는 10개 물품이 중복 없이 한 번씩 포함되어야 합니다.");
  if (!Number.isInteger(minDifferences) || minDifferences < 0 || minDifferences > participantRanking.length) {
    throw new TypeError("minDifferences가 올바르지 않습니다.");
  }

  const random = seededRandom(hashSeed(`${seed}|${participantRanking.join("|")}`));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = shuffle(participantRanking, random);
    if (countPositionDifferences(participantRanking, candidate) >= minDifferences) return candidate;
  }

  const shift = 1 + (hashSeed(seed) % (participantRanking.length - 1));
  return participantRanking.map((_, index) => participantRanking[(index + shift) % participantRanking.length]);
}
