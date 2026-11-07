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
    historyFrom,
    chat,
    saveResult,
    logEvent,
  };
})();
