(() => {
  const localHosts = new Set(["localhost", "127.0.0.1", ""]);
  const params = new URLSearchParams(location.search);
  const simulation = params.get("simulation") === "1" || localHosts.has(location.hostname);

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `서버 요청 실패 (${response.status})`);
    return data;
  }

  function htmlToText(html) {
    const node = document.createElement("div");
    node.innerHTML = html;
    return node.textContent?.trim() ?? "";
  }

  function historyFrom(messages) {
    return messages.slice(-16).flatMap((message) => {
      if (!new Set(["user", "assistant"]).has(message.role)) return [];
      const content = typeof message.content === "string"
        ? message.content
        : typeof message.contentHtml === "string" ? htmlToText(message.contentHtml) : "";
      return content ? [{ role: message.role, content }] : [];
    });
  }

  function localContrastingRanking(participantRanking, seed) {
    let hash = 2166136261;
    for (const char of `${seed}|${participantRanking.join("|")}`) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    let value = hash >>> 0;
    const random = () => {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = [...participantRanking];
      for (let index = candidate.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [candidate[index], candidate[target]] = [candidate[target], candidate[index]];
      }
      const differences = candidate.filter((item, index) => item !== participantRanking[index]).length;
      if (differences >= 5) return { ranking: candidate, positionDifferences: differences, generationVersion: "seeded-v1-local" };
    }
    const ranking = participantRanking.map((_, index) => participantRanking[(index + 1) % participantRanking.length]);
    return { ranking, positionDifferences: participantRanking.length, generationVersion: "seeded-v1-local" };
  }

  async function ensureSession(state, { taskCode, conditionCode }) {
    if (simulation) return null;
    if (state.serverSessionId) return state.serverSessionId;
    const data = await request("/api/session", {
      method: "POST",
      body: JSON.stringify({
        clientSessionId: state.sessionId,
        participantId: state.participantId,
        taskCode,
        conditionCode,
        metadata: {
          userAgent: navigator.userAgent,
          viewport: { width: innerWidth, height: innerHeight },
          clientStartedAt: state.startedAt,
        },
      }),
    });
    state.serverSessionId = data.sessionId;
    return data.sessionId;
  }

  async function publicConfig() {
    if (simulation) return { consentVersion: "consent-draft-v1", postSurveyUrl: "" };
    return request("/api/public-config");
  }

  async function validateParticipantCode(code) {
    if (simulation) return { valid: true, consentRequired: true, resumeAvailable: false, taskCompleted: false };
    return request("/api/participant", { method: "POST", body: JSON.stringify({ action: "validate", code }) });
  }

  async function startParticipant(state, { code, consentAccepted, consentVersion }) {
    if (simulation) {
      state.participantId = code || "TEST-CODE";
      return { sessionId: null, participantId: state.participantId, taskCompleted: false, resume: null, postSurveyUrl: "" };
    }
    const data = await request("/api/participant", { method: "POST", body: JSON.stringify({ action: "start", code, consentAccepted, consentVersion }) });
    state.serverSessionId = data.sessionId;
    state.participantId = data.participantId;
    return data;
  }

  async function chat(state, { taskCode, conditionCode, message, context, turnIndex }) {
    const sessionId = await ensureSession(state, { taskCode, conditionCode });
    const clientMessageId = crypto.randomUUID();
    return request("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        clientMessageId,
        taskCode,
        message,
        history: historyFrom(state.messages.slice(0, -1)),
        context,
        turnIndex,
      }),
    });
  }

  async function generateAiRanking(state, { taskCode, conditionCode, participantRanking }) {
    if (simulation) return localContrastingRanking(participantRanking, state.sessionId);
    const sessionId = await ensureSession(state, { taskCode, conditionCode });
    return request("/api/ranking", {
      method: "POST",
      body: JSON.stringify({ sessionId, participantRanking }),
    });
  }

  async function saveResult(state, { taskCode, conditionCode, result }) {
    if (simulation) return { saved: false, simulation: true };
    const sessionId = await ensureSession(state, { taskCode, conditionCode });
    return request("/api/result", {
      method: "POST",
      body: JSON.stringify({ sessionId, taskCode, ...result }),
    });
  }

  async function logEvent(state, { taskCode, conditionCode, eventType, payload = {} }) {
    if (simulation) return;
    const sessionId = await ensureSession(state, { taskCode, conditionCode });
    await request("/api/event", {
      method: "POST",
      body: JSON.stringify({ sessionId, eventType, payload, occurredAt: new Date().toISOString() }),
    });
  }

  window.ResearchAPI = {
    isSimulation: () => simulation,
    ensureSession,
    publicConfig,
    validateParticipantCode,
    startParticipant,
    historyFrom,
    chat,
    generateAiRanking,
    saveResult,
    logEvent,
  };
})();
