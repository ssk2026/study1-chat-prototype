export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "요청 본문이 올바른 JSON이 아닙니다.");
  }
}

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message, details: error.details ?? null }, error.status);
  }
  console.error(error);
  return json({ error: "서버에서 요청을 처리하지 못했습니다." }, 500);
}

export function requireString(value, name, { min = 1, max = 4000 } = {}) {
  if (typeof value !== "string") throw new HttpError(400, `${name}은 문자열이어야 합니다.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new HttpError(400, `${name} 길이는 ${min}~${max}자여야 합니다.`);
  }
  return normalized;
}

export function requireTaskCode(value) {
  if (!new Set(["TASK_1_DESERT", "TASK_2_CONFLICT"]).has(value)) {
    throw new HttpError(400, "지원하지 않는 과제 코드입니다.");
  }
  return value;
}

