import { HttpError } from "./http.js";

function extractOutputText(data) {
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export async function createModelResponse({ instructions, input, clientRequestId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) throw new HttpError(503, "OpenAI 서버 환경변수가 설정되지 않았습니다.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(clientRequestId ? { "X-Client-Request-Id": clientRequestId } : {}),
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      store: false,
      max_output_tokens: 600,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(502, "OpenAI 응답 생성이 실패했습니다.", {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      message: data?.error?.message ?? null,
    });
  }

  const text = extractOutputText(data);
  if (!text) throw new HttpError(502, "OpenAI가 빈 응답을 반환했습니다.");
  return {
    text,
    responseId: data.id ?? null,
    requestId: response.headers.get("x-request-id"),
    model,
    usage: data.usage ?? null,
  };
}

