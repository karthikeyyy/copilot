const DEFAULT_SERVER_URL = "http://localhost:3000";

async function getServerUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["serverUrl"], (res) => {
      resolve(res.serverUrl || DEFAULT_SERVER_URL);
    });
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SUGGEST") {
    handleApiCall("/suggest", {
      messages: msg.messages,
      app: msg.app,
      profile: msg.profile,
      learnedProfile: msg.learnedProfile,
      context: msg.context,
      variationAngle: msg.variationAngle || "balanced",
      draft: msg.draft || "",
      snapshot: msg.snapshot || null
    })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (msg.type === "REWRITE") {
    handleApiCall("/rewrite", {
      draft: msg.draft,
      messages: msg.messages,
      app: msg.app,
      profile: msg.profile,
      learnedProfile: msg.learnedProfile,
      context: msg.context
    })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "TRANSFORM") {
    handleApiCall("/transform", {
      text: msg.text,
      transformation: msg.transformation,
      profile: msg.profile,
      app: msg.app
    })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "AUTOCOMPLETE") {
    handleApiCall("/autocomplete", {
      draft: msg.draft,
      messages: msg.messages,
      app: msg.app,
      profile: msg.profile,
      context: msg.context
    })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "HEALTH_CHECK") {
    getServerUrl().then((baseUrl) => {
      fetch(`${baseUrl}/health`)
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
    });
    return true;
  }
});

async function handleApiCall(endpoint, body) {
  const baseUrl = (await getServerUrl()).replace(/\/+$/, "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  const startTime = Date.now();

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const roundtripMs = Date.now() - startTime;

    const contentType = res.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch (parseErr) {
        // Fallback to text below
      }
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Endpoint ${endpoint} returned 404. Please restart your server: in terminal, press Ctrl+C and run './start.sh'.`);
      }
      const rawText = data?.error || (await res.text().catch(() => "")).slice(0, 150);
      throw new Error(rawText || `Server responded with HTTP ${res.status}`);
    }

    if (!data) {
      const rawText = (await res.text().catch(() => "")).slice(0, 100);
      throw new Error(`Server returned non-JSON response: ${rawText || "Please restart './start.sh'."}`);
    }

    // Attach client-to-server roundtrip measurement
    data.timings = {
      roundtripMs,
      serverMs: data.timings?.serverMs || roundtripMs,
      aiMs: data.timings?.aiMs || 0
    };

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out (30s). The AI model took too long to reply.");
    }
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      throw new Error("Could not connect to ComUcate Server. Ensure './start.sh' is running locally.");
    }
    throw err;
  }
}
