// ==============================================================================
// ComUcate — Content Script (v3.0 Adaptive Voice + Context Engine)
// Platform-aware communication assistant for WhatsApp Web & Instagram DMs.
// ==============================================================================

(() => {
  if (window.__COMUCATE_LOADED__) return;

  // Avoid duplicate UI in small nested utility/telemetry frames
  if (window.self !== window.top) {
    if (window.innerWidth > 0 && (window.innerWidth < 500 || window.innerHeight < 350)) {
      return;
    }
  }
  window.__COMUCATE_LOADED__ = true;

  function detectApp() {
    const host = location.hostname.toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("whatsapp.com")) return "whatsapp";
    if (host.includes("telegram.org")) return "telegram";
    if (host.includes("discord.com")) return "discord";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("mail.google.com")) return "gmail";
    if (
      host.includes("teams.microsoft.com") ||
      host.includes("teams.live.com") ||
      host.includes("teams.cloud.microsoft") ||
      host.includes("teams.office.com") ||
      host.includes("teams.")
    ) {
      return "teams";
    }
    return "universal";
  }
  const APP = detectApp();
  const IS_INSTAGRAM = APP === "instagram";
  const IS_WHATSAPP = APP === "whatsapp";
  const IS_TELEGRAM = APP === "telegram";
  const IS_DISCORD = APP === "discord";
  const IS_LINKEDIN = APP === "linkedin";
  const IS_GMAIL = APP === "gmail";
  const IS_TEAMS = APP === "teams";

  const MAX_MESSAGES = 10;
  const MAX_TEXT_LENGTH = 400;

  let isEnabled = true;
  let isPanelOpen = false;
  let isGenerating = false;
  let currentMode = "suggest"; // "suggest" | "rewrite"

  // Base Profile (Layer 1 - Explicit Preferences)
  let userProfile = {
    personalityPreset: "Confident + Funny",
    language: "Hinglish",
    replyLength: "medium",
    humor: "high",
    emojiUsage: "occasional",
    flirting: true,
    commonPhrases: ["bhai", "haan", "acha", "lol", "😭", "sahi hai"]
  };

  // Auto-Adaptability Engine (Per-Platform Contextual Defaults & Overrides)
  let autoAdaptEnabled = true;
  let platformProfiles = {};

  // Contact Relationship Role Memory (Per conversation: "auto" | "boss" | "colleague" | "friend" | "close")
  let currentContactRole = "auto";

  function getRoleStorageKey(convId) {
    const safeId = String(convId || "chat").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);
    return `contactRole_${APP}_${safeId}`;
  }

  function loadContactRole(convId, callback) {
    if (!convId) {
      currentContactRole = "auto";
      if (callback) callback("auto");
      return;
    }
    const key = getRoleStorageKey(convId);
    chrome.storage.local.get([key], (res) => {
      currentContactRole = (res && res[key]) || "auto";
      if (callback) callback(currentContactRole);
    });
  }

  function setContactRole(convId, role) {
    currentContactRole = role;
    const key = getRoleStorageKey(convId);
    if (role === "auto") {
      chrome.storage.local.remove([key]);
    } else {
      chrome.storage.local.set({ [key]: role });
    }
  }

  let currentContactLanguage = null;

  function getLangStorageKey(convId) {
    const safeId = String(convId || "chat").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);
    return `contactLang_${APP}_${safeId}`;
  }

  function loadContactLanguage(convId, callback) {
    if (!convId) {
      currentContactLanguage = null;
      if (callback) callback(null);
      return;
    }
    const key = getLangStorageKey(convId);
    chrome.storage.local.get([key], (res) => {
      currentContactLanguage = (res && res[key]) || null;
      if (callback) callback(currentContactLanguage);
    });
  }

  function setContactLanguage(convId, lang) {
    currentContactLanguage = lang;
    if (convId) {
      const key = getLangStorageKey(convId);
      if (!lang) {
        chrome.storage.local.remove([key]);
      } else {
        chrome.storage.local.set({ [key]: lang });
      }
    }
  }

  const PLATFORM_DEFAULTS = {
    teams: {
      personalityPreset: "Professional + Polite",
      language: "English (US)",
      replyLength: "short",
      humor: "low",
      emojiUsage: "none",
      flirting: false,
      commonPhrases: ["sounds good", "let's sync up", "on it", "thanks", "will look into this", "appreciate it"],
      platformBadge: "💼 Teams • Professional"
    },
    linkedin: {
      personalityPreset: "Professional + Polite",
      language: "English (US)",
      replyLength: "medium",
      humor: "none",
      emojiUsage: "none",
      flirting: false,
      commonPhrases: ["appreciate it", "thanks for reaching out", "great to connect", "let's discuss", "looking forward"],
      platformBadge: "👔 LinkedIn • Professional"
    },
    gmail: {
      personalityPreset: "Professional + Friendly",
      language: "English (US)",
      replyLength: "medium",
      humor: "low",
      emojiUsage: "none",
      flirting: false,
      commonPhrases: ["thanks", "best regards", "please let me know", "sounds like a plan"],
      platformBadge: "📧 Gmail • Professional"
    },
    instagram: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "short",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true,
      commonPhrases: ["haha", "lol", "bhai", "acha", "😭", "sahi hai", "yaar", "kya scene"],
      platformBadge: "📸 Insta • Casual + Playful"
    },
    whatsapp: {
      personalityPreset: "Friendly + Casual",
      language: "Hinglish",
      replyLength: "short",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: false,
      commonPhrases: ["haan", "bhai", "sahi hai", "chal", "done", "theek hai", "mast"],
      platformBadge: "💬 WhatsApp • Friendly"
    },
    discord: {
      personalityPreset: "Direct + Fast",
      language: "English (Casual)",
      replyLength: "short",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: false,
      commonPhrases: ["gg", "cool", "bet", "on it", "fr", "makes sense"],
      platformBadge: "🎮 Discord • Fast & Chill"
    },
    telegram: {
      personalityPreset: "Direct + Fast",
      language: "English (Casual)",
      replyLength: "short",
      humor: "low",
      emojiUsage: "occasional",
      flirting: false,
      commonPhrases: ["sure", "got it", "done", "cool", "on it"],
      platformBadge: "✈️ Telegram • Snappy"
    },
    universal: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "short",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true,
      commonPhrases: ["bhai", "haan", "acha", "lol", "😭", "sahi hai"],
      platformBadge: "✨ ComUcate"
    }
  };

  function getEffectiveProfile(app, role = currentContactRole) {
    const roleKey = (role || "").toLowerCase();
    const appKey = (app || "").toLowerCase();
    const defaults = PLATFORM_DEFAULTS[appKey] || PLATFORM_DEFAULTS.universal;
    const overrides = (platformProfiles && platformProfiles[appKey]) || {};

    // Explicit user language choice MUST always win!
    const effectiveLanguage = currentContactLanguage || userProfile.language || (overrides && overrides.language) || defaults.language || "Hinglish";

    // Relationship Role hierarchy STRICTLY overrides platform defaults
    if (roleKey === "boss" || roleKey === "client" || roleKey === "formal") {
      return {
        ...defaults,
        ...overrides,
        ...userProfile,
        personalityPreset: "Professional + Respectful",
        language: effectiveLanguage,
        replyLength: "short",
        humor: "none",
        emojiUsage: "none",
        flirting: false,
        commonPhrases: ["sure", "will check", "noted", "on it", "thank you", "let me know", "sounds good", "yes sir"],
        platformBadge: "👔 Boss • Formal & Respectful"
      };
    }

    if (roleKey === "colleague") {
      return {
        ...defaults,
        ...overrides,
        ...userProfile,
        personalityPreset: "Professional + Collaborative",
        language: effectiveLanguage,
        replyLength: "short",
        humor: "low",
        emojiUsage: "none",
        flirting: false,
        commonPhrases: ["sounds good", "on it", "let's sync", "thanks", "will take a look"],
        platformBadge: "💼 Colleague • Collaborative"
      };
    }

    if (!autoAdaptEnabled) {
      return {
        ...userProfile,
        language: effectiveLanguage
      };
    }

    return {
      ...defaults,
      ...overrides,
      ...userProfile,
      language: effectiveLanguage
    };
  }

  function getFilteredLearnedProfile(lp, role = currentContactRole, lang = (currentContactLanguage || userProfile.language)) {
    if (!lp || lp.enabled === false) return lp;
    const roleKey = (role || "").toLowerCase();
    const isBoss = roleKey === "boss" || roleKey === "client" || roleKey === "formal";
    const isEnglishOnly = (lang || "").toLowerCase().includes("english");

    if (!isBoss && !isEnglishOnly) {
      return lp;
    }

    const slangTokens = new Set([
      "bhai", "yaar", "tu", "bro", "chod", "bc", "mc", "tere", "tujhe",
      "kya scene", "mast", "lmao", "lol", "😭", "😂", "chal", "arre",
      "haan", "acha", "theek", "sahi", "sahi hai", "nahi", "karo", "raha",
      "batao", "kaha", "kab", "kyu", "apna", "meri", "mera"
    ]);

    const filteredPhrases = (lp.topPhrases || []).filter((p) => !slangTokens.has(p.toLowerCase()));
    const filteredStarters = (lp.sentenceStarters || []).filter((s) => !slangTokens.has(s.toLowerCase()));
    const filteredNGrams = (lp.topNGrams || []).filter((ng) => !Array.from(slangTokens).some((tok) => ng.toLowerCase().includes(tok)));
    const filteredSamples = (lp.recentSampleMessages || []).filter((msg) => {
      const lower = msg.toLowerCase();
      return !Array.from(slangTokens).some((tok) => new RegExp(`\\b${tok}\\b`, "i").test(lower));
    });

    return {
      ...lp,
      topPhrases: filteredPhrases,
      sentenceStarters: filteredStarters,
      topNGrams: filteredNGrams,
      recentSampleMessages: filteredSamples,
      emojiFrequency: isBoss ? "none" : (lp.emojiFrequency || "occasional")
    };
  }

  // Adaptive Voice Profile (Layer 2 - Learned Style)
  let learnedProfile = {
    enabled: true,
    messageCount: 0,
    avgMessageLength: 0,
    lowercaseRatio: 0,
    minimalPunctuationRatio: 0,
    emojiFrequency: "none",
    topEmojis: [],
    topPhrases: [],
    sentenceStarters: [],
    topNGrams: [],
    recentSampleMessages: [],
    codeSwitchingFrequency: 0,
    lastUpdated: null
  };

  let processedHashes = new Set();
  let cachedSuggestions = null;
  let cachedSnapshot = null;
  let currentActiveSnapshot = null;
  let currentContextVersion = null;
  let currentLatestIncomingId = null;
  let cachedRewrites = null;
  let lastRewrittenDraft = "";

  // Phase 4: Intent, Working Memory, and Smart Regenerate State
  const REGEN_ANGLES = ["balanced", "punchy", "witty", "curious"];
  let currentAngleIndex = 0;
  let lastRoundtripMs = 0;

  // Active conversation & race-condition tracking
  let currentConversationId = null;
  let currentRequestId = 0;
  let chatChangeDebounceTimer = null;
  let learningDebounceTimer = null;

  // =========================================================
  // SHADOW DOM INITIALIZATION & BULLETPROOF MOUNTING
  // =========================================================

  const host = document.createElement("div");
  host.id = "comucate-extension-root";
  host.style.position = "fixed";
  host.style.setProperty("--copilot-bottom", "80px");
  host.style.setProperty("--copilot-right", "24px");
  host.style.setProperty("--copilot-top", "auto");
  host.style.setProperty("--copilot-left", "auto");
  host.style.width = "50px";
  host.style.height = "50px";
  host.style.zIndex = "2147483647";
  host.style.border = "none";
  host.style.margin = "0";
  host.style.padding = "0";
  host.style.overflow = "visible";
  host.style.pointerEvents = "auto";
  host.style.display = "block";

  const shadow = host.attachShadow({ mode: "open" });

  // Inline CSS fallback for instant styling immune to CSP or network delays
  const inlineStyle = document.createElement("style");
  inlineStyle.textContent = `
    :host {
      all: initial;
      display: block !important;
      position: fixed !important;
      bottom: var(--copilot-bottom, 80px) !important;
      right: var(--copilot-right, 24px) !important;
      top: var(--copilot-top, auto) !important;
      left: var(--copilot-left, auto) !important;
      width: 50px !important;
      height: 50px !important;
      z-index: 2147483647 !important;
      overflow: visible !important;
      pointer-events: auto !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color-scheme: light dark;
    }
    #copilot-container { position: relative !important; width: 50px !important; height: 50px !important; user-select: none !important; pointer-events: auto !important; }
    #copilot-btn { width: 50px !important; height: 50px !important; border-radius: 50% !important; border: 1px solid rgba(255, 255, 255, 0.25) !important; background: linear-gradient(135deg, #6c47ff, #8e6aff) !important; color: #ffffff !important; font-size: 22px !important; cursor: grab !important; touch-action: none !important; user-select: none !important; display: flex !important; align-items: center !important; justify-content: center !important; box-shadow: 0 4px 18px rgba(108, 71, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2) !important; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease !important; outline: none !important; padding: 0 !important; margin: 0 !important; pointer-events: auto !important; }
    #copilot-btn:hover { transform: scale(1.08) !important; box-shadow: 0 6px 22px rgba(108, 71, 255, 0.6) !important; }
    #copilot-btn:active { transform: scale(0.95) !important; }
    #copilot-btn.dragging { cursor: grabbing !important; transform: scale(1.12) !important; box-shadow: 0 8px 30px rgba(108, 71, 255, 0.75), 0 4px 12px rgba(0, 0, 0, 0.35) !important; transition: none !important; }
    #copilot-panel { position: absolute !important; bottom: var(--panel-bottom, 64px) !important; top: var(--panel-top, auto) !important; right: var(--panel-right, 0) !important; left: var(--panel-left, auto) !important; width: 350px !important; max-height: 520px !important; background: #ffffff !important; color: #1e293b !important; border-radius: 16px !important; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08) !important; border: 1px solid rgba(0, 0, 0, 0.08) !important; padding: 14px !important; display: none !important; flex-direction: column !important; gap: 10px !important; box-sizing: border-box !important; overflow-y: auto !important; pointer-events: auto !important; }
    #copilot-panel.open { display: flex !important; }
    .dark-theme #copilot-panel { background: #1e1e24 !important; color: #f1f5f9 !important; border-color: rgba(255, 255, 255, 0.12) !important; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important; }
  `;
  shadow.appendChild(inlineStyle);

  const cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = chrome.runtime.getURL("content.css");
  shadow.appendChild(cssLink);

  const container = document.createElement("div");
  container.id = "copilot-container";
  shadow.appendChild(container);

  const btn = document.createElement("button");
  btn.id = "copilot-btn";
  btn.type = "button";
  btn.innerHTML = "✨";
  btn.title = "ComUcate (Drag anywhere)";
  container.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "copilot-panel";
  container.appendChild(panel);

  // =========================================================
  // MOVABLE / DRAGGABLE FLOATING ACTION BUTTON
  // =========================================================

  const POS_STORAGE_KEY = `buttonPos_${APP}`;
  let currentButtonPos = null; // { x, y }

  function updatePanelAnchor(x, y) {
    const isBottom = y > window.innerHeight / 2;
    const isRight = x > 360;

    if (isBottom) {
      panel.style.setProperty("--panel-bottom", "64px");
      panel.style.setProperty("--panel-top", "auto");
      host.style.setProperty("--panel-bottom", "64px");
      host.style.setProperty("--panel-top", "auto");
    } else {
      panel.style.setProperty("--panel-top", "64px");
      panel.style.setProperty("--panel-bottom", "auto");
      host.style.setProperty("--panel-top", "64px");
      host.style.setProperty("--panel-bottom", "auto");
    }

    if (isRight) {
      panel.style.setProperty("--panel-right", "0px");
      panel.style.setProperty("--panel-left", "auto");
      host.style.setProperty("--panel-right", "0px");
      host.style.setProperty("--panel-left", "auto");
    } else {
      panel.style.setProperty("--panel-left", "0px");
      panel.style.setProperty("--panel-right", "auto");
      host.style.setProperty("--panel-left", "0px");
      host.style.setProperty("--panel-right", "auto");
    }
  }

  function applyButtonPosition(x, y, save = false) {
    const minX = 8;
    const maxX = Math.max(8, window.innerWidth - 58);
    const minY = 8;
    const maxY = Math.max(8, window.innerHeight - 58);

    const clampedX = Math.round(Math.min(Math.max(x, minX), maxX));
    const clampedY = Math.round(Math.min(Math.max(y, minY), maxY));

    currentButtonPos = { x: clampedX, y: clampedY };

    host.style.setProperty("--copilot-left", `${clampedX}px`);
    host.style.setProperty("--copilot-top", `${clampedY}px`);
    host.style.setProperty("--copilot-right", "auto");
    host.style.setProperty("--copilot-bottom", "auto");

    host.style.left = `${clampedX}px`;
    host.style.top = `${clampedY}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";

    if (clampedX <= 28) {
      btn.classList.add("docked-left");
      btn.classList.remove("docked-right");
    } else if (clampedX >= window.innerWidth - 78) {
      btn.classList.add("docked-right");
      btn.classList.remove("docked-left");
    } else {
      btn.classList.remove("docked-left");
      btn.classList.remove("docked-right");
    }

    updatePanelAnchor(clampedX, clampedY);

    if (save) {
      chrome.storage.local.set({ [POS_STORAGE_KEY]: { x: clampedX, y: clampedY } });
    }
  }

  function resetWidgetPosition() {
    const defaultX = Math.max(10, window.innerWidth - 74);
    const defaultY = Math.max(10, window.innerHeight - 130);
    applyButtonPosition(defaultX, defaultY, true);
    chrome.storage.local.remove([POS_STORAGE_KEY]);
  }

  chrome.storage.local.get([POS_STORAGE_KEY], (res) => {
    if (res && res[POS_STORAGE_KEY] && typeof res[POS_STORAGE_KEY].x === "number") {
      applyButtonPosition(res[POS_STORAGE_KEY].x, res[POS_STORAGE_KEY].y, false);
    } else {
      const defaultX = Math.max(10, window.innerWidth - 74);
      const defaultY = Math.max(10, window.innerHeight - 130);
      applyButtonPosition(defaultX, defaultY, false);
    }
  });

  window.addEventListener("resize", () => {
    if (currentButtonPos) {
      applyButtonPosition(currentButtonPos.x, currentButtonPos.y, false);
    }
  });

  let isPointerDown = false;
  let hasMoved = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startBtnX = 0;
  let startBtnY = 0;
  let justDraggedTime = 0;

  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    isPointerDown = true;
    hasMoved = false;
    startPointerX = e.clientX;
    startPointerY = e.clientY;

    const rect = host.getBoundingClientRect();
    startBtnX = rect.left;
    startBtnY = rect.top;

    try {
      btn.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  btn.addEventListener("pointermove", (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;

    if (!hasMoved) {
      if (Math.hypot(dx, dy) > 5) {
        hasMoved = true;
        btn.classList.add("dragging");
      }
    }

    if (hasMoved) {
      applyButtonPosition(startBtnX + dx, startBtnY + dy, false);
    }
  });

  function finishDrag(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    try {
      btn.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (hasMoved) {
      btn.classList.remove("dragging");
      justDraggedTime = Date.now();
      if (currentButtonPos) {
        // AssistiveTouch Magnetic Edge Snapping
        const snapToLeft = currentButtonPos.x < (window.innerWidth / 2);
        const snappedX = snapToLeft ? 16 : Math.max(16, window.innerWidth - 66);
        const snappedY = currentButtonPos.y;

        host.style.transition = "left 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.15), top 0.2s ease";
        applyButtonPosition(snappedX, snappedY, true);
        setTimeout(() => {
          host.style.transition = "none";
        }, 300);
      }
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  btn.addEventListener("pointerup", finishDrag);
  btn.addEventListener("pointercancel", finishDrag);

  // Auto-Dimming Inactivity Engine
  let idleTimer = null;
  function resetIdleTimer() {
    btn.classList.remove("idle-dim");
    clearTimeout(idleTimer);
    if (!isPanelOpen) {
      idleTimer = setTimeout(() => {
        if (!isPanelOpen) {
          btn.classList.add("idle-dim");
        }
      }, 7000);
    }
  }

  window.addEventListener("mousemove", resetIdleTimer, { passive: true });
  window.addEventListener("keydown", resetIdleTimer, { passive: true });
  btn.addEventListener("pointerenter", () => {
    btn.classList.remove("idle-dim");
  });
  resetIdleTimer();

  function ensureHostMounted() {
    const targetParent = document.documentElement || document.body;
    if (!targetParent) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensureHostMounted, { once: true });
      }
      return;
    }
    if (!targetParent.contains(host)) {
      targetParent.appendChild(host);
    }
  }
  ensureHostMounted();
  setInterval(ensureHostMounted, 1000);

  // Sync settings, base preferences, and learned profile
  chrome.storage.sync.get(["enabled", "profile", "autoAdaptEnabled", "platformProfiles"], (res) => {
    isEnabled = res.enabled !== false;
    autoAdaptEnabled = res.autoAdaptEnabled !== false;
    if (res.profile) {
      userProfile = { ...userProfile, ...res.profile };
    }
    if (res.platformProfiles) {
      platformProfiles = res.platformProfiles;
    }
    updateWidgetVisibility();
  });

  chrome.storage.local.get(["learnedProfile", "processedMessageHashes"], (res) => {
    if (res.learnedProfile) {
      learnedProfile = { ...learnedProfile, ...res.learnedProfile };
    }
    if (Array.isArray(res.processedMessageHashes)) {
      processedHashes = new Set(res.processedMessageHashes);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if (changes.enabled !== undefined) {
        isEnabled = changes.enabled.newValue;
        updateWidgetVisibility();
      }
      if (changes.profile !== undefined) {
        userProfile = { ...userProfile, ...changes.profile.newValue };
        cachedSuggestions = null;
        cachedRewrites = null;
      }
      if (changes.autoAdaptEnabled !== undefined) {
        autoAdaptEnabled = changes.autoAdaptEnabled.newValue !== false;
        cachedSuggestions = null;
        cachedRewrites = null;
      }
      if (changes.platformProfiles !== undefined) {
        platformProfiles = changes.platformProfiles.newValue || {};
        cachedSuggestions = null;
        cachedRewrites = null;
      }
    }
    if (area === "local") {
      if (changes.learnedProfile !== undefined) {
        learnedProfile = { ...learnedProfile, ...changes.learnedProfile.newValue };
      }
    }
  });

  function updateWidgetVisibility() {
    if (!isEnabled) {
      host.style.display = "none";
      return;
    }

    if (IS_INSTAGRAM) {
      const inDirect = location.pathname.startsWith("/direct");
      host.style.display = inDirect ? "block" : "none";
    } else {
      host.style.display = "block";
    }

    updateTheme();
  }

  function updateTheme() {
    const docEl = document.documentElement;
    const bodyEl = document.body;

    const isDark =
      (bodyEl && bodyEl.classList && bodyEl.classList.contains("dark")) ||
      (docEl && (
        (docEl.classList && docEl.classList.contains("dark")) ||
        (typeof docEl.getAttribute === "function" && (
          docEl.getAttribute("data-dark") === "true" ||
          docEl.getAttribute("data-theme") === "dark" ||
          docEl.getAttribute("theme") === "dark"
        ))
      )) ||
      (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      container.classList.add("dark-theme");
    } else {
      container.classList.remove("dark-theme");
    }
  }

  // =========================================================
  // ADAPTIVE VOICE LEARNER (NON-INVASIVE STYLE EXTRACTION)
  // Learns ONLY from user-authored messages ('from: me')
  // =========================================================

  function createMessageHash(text) {
    const clean = text.trim();
    return `${clean.length}_${clean.slice(0, 15)}_${clean.slice(-15)}`;
  }

  const INFORMAL_TOKENS = new Set([
    "bhai", "yaar", "acha", "sahi", "haan", "h", "hai", "nhi", "yrr", "kya",
    "toh", "mera", "meri", "kr", "kro", "dekh", "mil", "skte", "ab", "fir",
    "verna", "lol", "bro", "okie", "thik", "idk", "tbh", "gonna", "wanna",
    "pls", "thx", "btw", "ikr", "lmao", "haha", "uff", "arrey", "chalo"
  ]);

  const COMMON_OPENERS = new Set([
    "haan", "bhai", "actually", "hey", "bro", "so", "well", "wait", "sure",
    "ok", "okie", "dekh", "arrey", "sahi", "yaar", "chal", "kya", "done",
    "mast", "cool", "sounds", "nice", "yeah", "yes", "nah", "idk", "tbh",
    "listen", "btw", "check", "let", "yo", "pls", "please"
  ]);

  const KEY_NGRAM_WORDS = new Set([
    "sahi", "hai", "bhai", "yaar", "chal", "theek", "thik", "dekh", "batata",
    "bata", "kya", "scene", "milte", "call", "pe", "baat", "karte", "done",
    "sounds", "good", "let", "me", "know", "on", "it", "makes", "sense",
    "no", "worries", "free", "ho", "up", "to", "sync", "plan"
  ]);

  function learnFromUserMessages(messages) {
    if (learnedProfile.enabled === false) return;
    if (!Array.isArray(messages) || messages.length === 0) return;

    // Filter ONLY messages written by ME
    const userMsgs = messages.filter((m) => m.from === "me" && m.text && m.text.length > 2);
    if (userMsgs.length === 0) return;

    let updatedAny = false;
    const currentEmojiCounts = {};
    (learnedProfile.topEmojis || []).forEach((em, idx) => {
      currentEmojiCounts[em] = (5 - idx) * 3;
    });

    const currentPhraseCounts = {};
    (learnedProfile.topPhrases || []).forEach((ph, idx) => {
      currentPhraseCounts[ph] = (8 - idx) * 3;
    });

    const currentStarterCounts = {};
    (learnedProfile.sentenceStarters || []).forEach((st, idx) => {
      currentStarterCounts[st] = (6 - idx) * 3;
    });

    const currentNGramCounts = {};
    (learnedProfile.topNGrams || []).forEach((ng, idx) => {
      currentNGramCounts[ng] = (8 - idx) * 3;
    });

    const currentSamples = Array.isArray(learnedProfile.recentSampleMessages)
      ? [...learnedProfile.recentSampleMessages]
      : [];

    for (const msg of userMsgs) {
      const text = msg.text.trim();
      const hash = createMessageHash(text);

      if (processedHashes.has(hash)) {
        continue;
      }

      processedHashes.add(hash);
      updatedAny = true;

      const len = text.length;
      const isLowercase = text.length > 0 && text[0] === text[0].toLowerCase() && /[a-z]/i.test(text[0]);
      const isMinimalPunct = !/[.!?]$/.test(text);

      // Weighted rolling average (alpha drops as count grows, avoiding overfitting)
      const alpha = 1 / Math.min((learnedProfile.messageCount || 0) + 1, 25);

      if ((learnedProfile.messageCount || 0) === 0) {
        learnedProfile.avgMessageLength = len;
        learnedProfile.lowercaseRatio = isLowercase ? 1 : 0;
        learnedProfile.minimalPunctuationRatio = isMinimalPunct ? 1 : 0;
      } else {
        learnedProfile.avgMessageLength = (1 - alpha) * learnedProfile.avgMessageLength + alpha * len;
        learnedProfile.lowercaseRatio = (1 - alpha) * (learnedProfile.lowercaseRatio || 0) + alpha * (isLowercase ? 1 : 0);
        learnedProfile.minimalPunctuationRatio = (1 - alpha) * (learnedProfile.minimalPunctuationRatio || 0) + alpha * (isMinimalPunct ? 1 : 0);
      }

      // Track emojis
      const emojis = text.match(/\p{Extended_Pictographic}/ug) || [];
      emojis.forEach((em) => {
        currentEmojiCounts[em] = (currentEmojiCounts[em] || 0) + 1;
      });

      // Track vocabulary & slang tokens
      const words = text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
      let informalCount = 0;
      words.forEach((w) => {
        if (INFORMAL_TOKENS.has(w)) {
          informalCount++;
          currentPhraseCounts[w] = (currentPhraseCounts[w] || 0) + 1;
        }
      });

      // Track sentence openers / starters
      const rawWords = text.split(/\s+/).filter(Boolean);
      if (rawWords.length > 0) {
        const firstWord = rawWords[0].toLowerCase().replace(/[^\w]/g, "");
        if (firstWord && COMMON_OPENERS.has(firstWord)) {
          currentStarterCounts[firstWord] = (currentStarterCounts[firstWord] || 0) + 1;
        } else if (rawWords.length > 1) {
          const firstTwo = `${firstWord} ${rawWords[1].toLowerCase().replace(/[^\w]/g, "")}`.trim();
          if (["ok so", "let me", "wait a", "kya scene", "chal theek", "haan bhai"].includes(firstTwo)) {
            currentStarterCounts[firstTwo] = (currentStarterCounts[firstTwo] || 0) + 1;
          }
        }
      }

      // Track 2-word n-grams (bigrams)
      const cleanWords = text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
      for (let i = 0; i < cleanWords.length - 1; i++) {
        const w1 = cleanWords[i];
        const w2 = cleanWords[i + 1];
        if (KEY_NGRAM_WORDS.has(w1) || KEY_NGRAM_WORDS.has(w2) || INFORMAL_TOKENS.has(w1) || INFORMAL_TOKENS.has(w2)) {
          if (w1.length > 1 && w2.length > 1) {
            const bigram = `${w1} ${w2}`;
            currentNGramCounts[bigram] = (currentNGramCounts[bigram] || 0) + 1;
          }
        }
      }

      // Collect safe few-shot sample messages (FIFO ring buffer of max 6)
      const isSensitive = /https?:\/\/\S+/i.test(text) ||
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text) ||
        /\b\d{6,}\b/.test(text);

      if (!isSensitive && len >= 8 && len <= 120) {
        if (!currentSamples.includes(text)) {
          currentSamples.push(text);
          if (currentSamples.length > 6) {
            currentSamples.shift();
          }
        }
      }

      const codeSwitchScore = words.length > 0 ? informalCount / words.length : 0;
      learnedProfile.codeSwitchingFrequency = (1 - alpha) * (learnedProfile.codeSwitchingFrequency || 0) + alpha * codeSwitchScore;

      learnedProfile.messageCount = (learnedProfile.messageCount || 0) + 1;
    }

    if (updatedAny) {
      // Sort and derive top 5 emojis
      learnedProfile.topEmojis = Object.entries(currentEmojiCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([em]) => em);

      // Sort and derive top 8 phrases
      learnedProfile.topPhrases = Object.entries(currentPhraseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([ph]) => ph);

      // Sort and derive top 6 sentence starters
      learnedProfile.sentenceStarters = Object.entries(currentStarterCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([st]) => st);

      // Sort and derive top 8 multi-word n-grams
      learnedProfile.topNGrams = Object.entries(currentNGramCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([ng]) => ng);

      learnedProfile.recentSampleMessages = currentSamples;

      learnedProfile.lastUpdated = Date.now();

      // Prune hash set to keep storage compact (max 100 entries)
      const hashArray = Array.from(processedHashes).slice(-100);
      processedHashes = new Set(hashArray);

      chrome.storage.local.set({
        learnedProfile,
        processedMessageHashes: hashArray
      });

      console.log(`[ComUcate Adaptive] Updated style profile from user writing (count: ${learnedProfile.messageCount}, starters: ${learnedProfile.sentenceStarters.length}, ngrams: ${learnedProfile.topNGrams.length}, samples: ${learnedProfile.recentSampleMessages.length})`);
    }
  }

  function queueAdaptiveLearning(messages) {
    if (learningDebounceTimer) {
      clearTimeout(learningDebounceTimer);
    }
    learningDebounceTimer = setTimeout(() => {
      learnFromUserMessages(messages);
    }, 1200);
  }

  // =========================================================
  // CONTEXT INFERENCE ENGINE (Layer 3 - Communication Context)
  // =========================================================

  function inferConversationContext(messages, app) {
    const result = {
      app: app || "chat",
      convoTone: "casual",
      lastMessageLength: "short",
      isEnding: false
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return result;
    }

    const lastThemMsg = [...messages].reverse().find((m) => m.from === "them");
    const lastText = (lastThemMsg?.text || "").toLowerCase();

    // Length mirroring
    if (lastText.length < 25) {
      result.lastMessageLength = "short";
    } else if (lastText.length < 80) {
      result.lastMessageLength = "medium";
    } else {
      result.lastMessageLength = "long";
    }

    // Tone signals
    const seriousKeywords = [
      "hospital", "doctor", "report", "passed away", "funeral", "emergency",
      "accident", "sick", "fever", "serious", "rip", "broken", "crying",
      "breakup", "trouble", "money", "debt", "police", "legal"
    ];
    const playfulKeywords = [
      "lol", "lmao", "haha", "rofl", "joke", "funny", "😂", "🤣", "xd",
      "kya yaar", "drama", "mazak", "sahi me", "pagal"
    ];

    if (seriousKeywords.some((kw) => lastText.includes(kw))) {
      result.convoTone = "serious";
    } else if (playfulKeywords.some((kw) => lastText.includes(kw))) {
      result.convoTone = "playful";
    } else {
      result.convoTone = "casual";
    }

    // Closing signals
    const endingKeywords = [
      "bye", "gn", "goodnight", "cya", "see ya", "talk later", "chalo",
      "take care", "tc", "catch you later"
    ];
    if (endingKeywords.some((kw) => lastText.includes(kw))) {
      result.isEnding = true;
    }

    return result;
  }

  // =========================================================
  // SENSITIVE SHIELD & PRIVACY SANITIZER (Phase 4)
  // =========================================================

  function isSensitiveField(el) {
    if (!el) return false;
    try {
      if (el.tagName === "INPUT" && el.type === "password") return true;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "password") return true;

      const testStr = `${el.id || ""} ${el.name || ""} ${el.getAttribute("autocomplete") || ""} ${el.getAttribute("aria-label") || ""} ${el.className || ""}`.toLowerCase();
      const sensitiveKeywords = [
        "password", "passwd", "pwd", "secret", "token", "auth",
        "pincode", "security-code", "cvv", "cvc", "creditcard", "cardnumber", "cc-number", "otp"
      ];
      for (const kw of sensitiveKeywords) {
        if (testStr.includes(kw)) return true;
      }
    } catch (_) {}
    return false;
  }

  function redactSensitiveTokens(text) {
    if (!text || typeof text !== "string") return text;
    let sanitized = text;

    // 1. Passwords / Secrets / Credentials
    sanitized = sanitized.replace(/\b(?:password|passwd|pwd|passcode|secret)[\s:=]+([^\s,;]{3,})\b/gi, (match) => {
      return match.replace(/([^\s:=,;]{3,})$/, "[REDACTED_PASSWORD]");
    });

    // 2. OTP / 2FA Verification codes (e.g. "otp is 123456", "code: 4892", "passcode: 938210")
    sanitized = sanitized.replace(/\b(?:otp|code|pin|passcode|verification\s*code)(?:\s+is|\s*[:#=-])?\s*([0-9]{4,8})\b/gi, (match) => {
      return match.replace(/[0-9]{4,8}/, "[REDACTED_OTP]");
    });

    // 3. Indian & International Phone Numbers (10-14 digits, optional + prefix, dashes, spaces)
    sanitized = sanitized.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
    sanitized = sanitized.replace(/\b(?:\+91[\-\s]?)?[6-9]\d{9}\b/g, "[REDACTED_PHONE]");

    // 4. Email addresses
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]");

    // 5. UPI Handles (e.g. name@okaxis, 9876543210@paytm, user@upi, shop@okhdfcbank)
    sanitized = sanitized.replace(/\b[a-zA-Z0-9.\-_]{2,}@(okaxis|okhdfcbank|okicici|oksbi|paytm|upi|ybl|axl|ibl|barodampay|postbank)\b/gi, "[REDACTED_UPI]");

    // 6. Crypto Wallet Addresses (Ethereum 0x..., Bitcoin bc1... or 1... or 3...)
    sanitized = sanitized.replace(/\b0x[a-fA-F0-9]{40}\b/g, "[REDACTED_WALLET]");
    sanitized = sanitized.replace(/\b(?:bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,39}\b/g, "[REDACTED_WALLET]");

    // 7. Credit Card numbers (13-19 digits, optionally spaced or hyphens)
    sanitized = sanitized.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[REDACTED_CARD]");

    // 8. Social Security / National ID (e.g. 123-45-6789)
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");

    // 9. API keys / bearer tokens
    sanitized = sanitized.replace(/\b(bearer\s+)[a-zA-Z0-9_\-\.]{20,}\b/gi, "$1[REDACTED_TOKEN]");
    sanitized = sanitized.replace(/\b((?:api[_-]?key|token|secret)[\s:=]+)[a-zA-Z0-9_\-]{16,}\b/gi, "$1[REDACTED_KEY]");

    return sanitized;
  }

  // =========================================================
  // PLATFORM ADAPTERS ARCHITECTURE
  // =========================================================

  function cleanText(text) {
    if (!text) return "";
    return redactSensitiveTokens(
      text
        .replace(/\u200B/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, MAX_TEXT_LENGTH)
    );
  }

  function deduplicate(messages) {
    const result = [];
    for (const msg of messages) {
      const prev = result[result.length - 1];
      if (prev && prev.from === msg.from && prev.text === msg.text) {
        continue;
      }
      result.push(msg);
    }
    return result;
  }

  // --- Message Identity & Snapshot Helpers (v4.2 Communication Handler) ---
  function simpleHash(str) {
    if (!str || typeof str !== "string") return "0";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function normalizeExtractedMessage(m, index = 0) {
    const isFromMe = m.from === "me" || m.author === "me" || Boolean(m.isMine);
    const author = isFromMe ? "me" : "them";
    const text = redactSensitiveTokens(m.text || "").trim();
    const isSystemMessage = Boolean(m.isSystemMessage);
    const order = typeof m.order === "number" ? m.order : index;
    const timestamp = typeof m.timestamp === "number" ? m.timestamp : Date.now();
    const id = m.id || `${author}_${order}_${simpleHash(text.slice(0, 30))}`;
    return {
      id,
      author,
      from: author, // backward compatibility
      text,
      timestamp,
      isFromMe,
      isSystemMessage,
      isAudio: Boolean(m.isAudio),
      order
    };
  }

  function createContextSnapshot(messages = [], conversationId = "") {
    const validMsgs = (messages || []).filter((m) => !m.isSystemMessage && m.text && m.text.trim().length > 0);
    const latestIncoming = [...validMsgs].reverse().find((m) => m.from === "them" || m.author === "them") || null;
    const latestUser = [...validMsgs].reverse().find((m) => m.from === "me" || m.author === "me") || null;
    const lastMsg = validMsgs[validMsgs.length - 1] || null;

    const latestIncomingId = latestIncoming ? `${latestIncoming.from}:${simpleHash(latestIncoming.text)}` : "none";
    const latestMessageId = lastMsg ? `${lastMsg.from}:${simpleHash(lastMsg.text)}` : "none";

    // Version signature built from conversation ID + last 4 messages
    const tailSig = validMsgs.slice(-4).map((m) => `${m.from}:${m.text}`).join("|");
    const contextVersion = simpleHash(`${conversationId || "chat"}_${tailSig}`);

    return {
      conversationId: conversationId || "unknown",
      latestMessageId,
      latestIncomingId,
      latestIncomingText: latestIncoming?.text || "",
      latestUserText: latestUser?.text || "",
      contextVersion,
      messageCount: validMsgs.length,
      createdAt: Date.now()
    };
  }

  // --- Instagram Adapter Methods (v4.2 Robust Extractor) ---
  function findInstagramChatArea() {
    const composer = findInstagramComposer();
    const main = document.querySelector("main") || document.querySelector("[role='main']");

    if (composer) {
      let curr = composer.parentElement;
      while (curr && curr !== document.body && curr !== main) {
        // Look for the scroll container inside this ancestor branch
        const scrollCandidate = curr.querySelector("div[style*='overflow-y'], div[role='grid'], div[tabindex='0']");
        if (scrollCandidate && !scrollCandidate.contains(composer) && scrollCandidate.getBoundingClientRect().height > 120) {
          return { container: curr, scrollArea: scrollCandidate };
        }
        curr = curr.parentElement;
      }
    }

    if (main) {
      const scrollCandidates = Array.from(main.querySelectorAll("div[style*='overflow-y'], div[role='grid'], div[tabindex='0']"));
      for (const sc of scrollCandidates) {
        if (composer && sc.contains(composer)) continue;
        const rect = sc.getBoundingClientRect();
        if (rect.height > 150 && rect.width > 200) {
          return { container: main, scrollArea: sc };
        }
      }
    }

    return { container: main || document.body, scrollArea: main || document.body };
  }

  function isQuotedOrReplyPreview(el, scrollArea) {
    if (!el) return false;
    let curr = el;
    while (curr && curr !== scrollArea && curr !== document.body) {
      const ariaLabel = (curr.getAttribute("aria-label") || "").toLowerCase();
      if (ariaLabel.includes("replied to") || ariaLabel.includes("reply to")) {
        return true;
      }
      const text = (curr.innerText || "").trim();
      if (/^.+?\s+replied to\s+(you|themselves|[a-zA-Z0-9_.]+)$/i.test(text)) {
        return true;
      }
      if (curr.classList && (curr.className.includes("reply") || curr.className.includes("quoted"))) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  function isReactionElement(el) {
    if (!el) return false;
    if (el.closest("button[aria-label*='reaction' i], div[aria-label*='reaction' i], [role='button'][aria-label*='reaction' i]")) {
      return true;
    }
    const text = (el.innerText || "").trim();
    if (/^[\p{Extended_Pictographic}]\s*\d*$/u.test(text)) {
      return true;
    }
    return false;
  }

  function isSystemOrTimestamp(text) {
    if (!text || typeof text !== "string") return false;
    const clean = text.trim();
    if (/^(?:\d{1,2}:\d{2}\s*(?:am|pm)?|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i.test(clean)) {
      return true;
    }
    if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?$/i.test(clean)) {
      return true;
    }
    const systemWords = new Set([
      "search", "message...", "send message", "seen", "active now",
      "typing...", "follow", "following", "requested", "replay", "forward",
      "sent", "delivered", "liked a message", "started a video chat",
      "video chat ended", "started an audio call", "audio call ended",
      "call ended", "missed audio call", "missed video chat"
    ]);
    if (systemWords.has(clean.toLowerCase())) {
      return true;
    }
    return false;
  }

  function getInstagramMessages() {
    const { scrollArea } = findInstagramChatArea();
    if (!scrollArea) return [];

    const composer = findInstagramComposer();
    const chatRect = scrollArea.getBoundingClientRect();
    const chatMidX = chatRect.left + chatRect.width / 2;

    // Target copyable text containers inside the scroll area
    let candidateElements = Array.from(scrollArea.querySelectorAll("div[dir='auto'], span[dir='auto'], p[dir='auto'], div[dir='ltr'], span[dir='ltr']"));
    if (candidateElements.length === 0) {
      candidateElements = Array.from(scrollArea.querySelectorAll("div[role='row'] span, div[role='row'] div"));
    }

    // Filter out quotes, reactions, system notices, and composer
    const filteredElements = [];
    for (const el of candidateElements) {
      if (composer && composer.contains(el)) continue;
      if (isReactionElement(el)) continue;
      if (isQuotedOrReplyPreview(el, scrollArea)) continue;

      const rawText = cleanText(el.innerText);
      if (!rawText || rawText.length > MAX_TEXT_LENGTH) continue;
      if (isSystemOrTimestamp(rawText)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Discard duplicate parent-child elements with identical text
      const isDuplicate = filteredElements.some((prev) => prev.contains(el) && cleanText(prev.innerText) === rawText);
      if (isDuplicate) continue;

      // If this element contains an existing one with identical text, replace it
      const prevIdx = filteredElements.findIndex((prev) => el.contains(prev) && cleanText(prev.innerText) === rawText);
      if (prevIdx >= 0) {
        filteredElements[prevIdx] = el;
      } else {
        filteredElements.push(el);
      }
    }

    const rawMessages = [];
    for (let i = 0; i < filteredElements.length; i++) {
      const el = filteredElements[i];
      const text = cleanText(el.innerText);
      const isAudio = Boolean(el.querySelector("audio, [aria-label*='audio' i], [aria-label*='voice' i], svg[aria-label*='Play' i]"));
      const rect = el.getBoundingClientRect();

      const bubbleCenter = rect.left + rect.width / 2;
      let isMine = bubbleCenter > chatMidX;

      // Check flex justification of parent row for authoritative confirmation
      let rowEl = el.parentElement;
      for (let depth = 0; depth < 5 && rowEl && rowEl !== scrollArea; depth++) {
        const cs = window.getComputedStyle(rowEl);
        if (cs.justifyContent === "flex-end" || cs.alignSelf === "flex-end") {
          isMine = true;
          break;
        }
        if (cs.justifyContent === "flex-start" || cs.alignSelf === "flex-start") {
          isMine = false;
          break;
        }
        rowEl = rowEl.parentElement;
      }

      const author = isMine ? "me" : "them";
      rawMessages.push({
        id: `${author}_${i}_${simpleHash(text.slice(0, 30))}`,
        author,
        from: author,
        text: isAudio && !text ? "[Voice Note / Audio Message]" : text,
        isFromMe: isMine,
        isSystemMessage: false,
        isAudio,
        top: rect.top,
        order: i
      });
    }

    // Sort by DOM order & top position
    rawMessages.sort((a, b) => (a.top === b.top ? a.order - b.order : a.top - b.top));
    return deduplicate(rawMessages).slice(-MAX_MESSAGES);
  }

  function findInstagramComposer() {
    const selectors = [
      "div[contenteditable='true'][data-lexical-editor='true']",
      "main div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][aria-label*='Message']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function sendInstagramAction(action, text) {
    return new Promise((resolve) => {
      const eventId = "comucate_" + Math.random().toString(36).slice(2, 9);

      function handler(e) {
        if (e.detail?.id === eventId) {
          window.removeEventListener("comucate_lexical_response", handler);
          resolve(e.detail);
        }
      }

      window.addEventListener("comucate_lexical_response", handler);

      window.dispatchEvent(
        new CustomEvent("comucate_lexical_action", {
          detail: { id: eventId, action, text }
        })
      );

      setTimeout(() => {
        window.removeEventListener("comucate_lexical_response", handler);
        resolve({ success: false, timeout: true });
      }, 350);
    });
  }

  function fallbackInstagramEdit(composer, text) {
    composer.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection.removeAllRanges();
    selection.addRange(range);

    if (!text) {
      document.execCommand("delete", false, null);
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "deleteContentBackward"
      }));
    } else {
      const execSuccess = document.execCommand("insertText", false, text);
      if (!execSuccess) {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        composer.dispatchEvent(new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        }));
      }
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text
      }));
    }
  }

  function getInstagramConversationId() {
    if (!IS_INSTAGRAM) return null;

    const urlMatch = location.pathname.match(/\/direct\/t\/([^/?#]+)/);
    const threadId = urlMatch ? urlMatch[1] : null;

    let headerName = "";
    const headerSelectors = [
      "main header span[dir='auto']",
      "main header h1",
      "main header a[role='link']",
      "main [role='main'] header",
      "header span[dir='auto']",
      "header [role='link']"
    ];

    for (const sel of headerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.innerText || "").split("\n")[0].trim();
        if (text && text.length < 50 && !["messages", "direct", "inbox"].includes(text.toLowerCase())) {
          headerName = text;
          break;
        }
      }
    }

    if (threadId && headerName) {
      return `thread_${threadId}_${headerName}`;
    }
    if (threadId) {
      return `thread_${threadId}`;
    }
    if (headerName) {
      return `header_${headerName}`;
    }

    return location.pathname;
  }

  // --- WhatsApp Adapter Methods ---
  function getWhatsAppMessages() {
    let containers = Array.from(
      document.querySelectorAll(
        "[data-testid='msg-container'], div.message-in, div.message-out, div[data-id], div[role='row']"
      )
    );
    const messages = [];

    for (const c of containers) {
      const textEl =
        c.querySelector("span.selectable-text") ||
        c.querySelector("div.copyable-text") ||
        c.querySelector("[dir='ltr']") ||
        c.querySelector("[dir='auto']");

      const audioEl = c.querySelector("audio, [data-testid='audio-play'], [data-icon='audio-play'], [data-testid='msg-audio'], span[data-icon='audio-play']");
      let text = textEl ? cleanText(textEl.innerText) : "";
      if (!text && audioEl) {
        text = "[Voice Note / Audio Message]";
      }

      if (!text) continue;

      const isMine =
        Boolean(c.closest(".message-out")) ||
        c.classList.contains("message-out") ||
        Boolean(c.querySelector("[data-icon^='msg-']")) ||
        Boolean(c.querySelector("[data-icon='tail-out']")) ||
        c.getBoundingClientRect().left > window.innerWidth * 0.45;

      messages.push({
        from: isMine ? "me" : "them",
        text,
        isAudio: Boolean(audioEl)
      });
    }

    // Direct fallback: if no containers matched, scrape copyable text directly inside chat view
    if (messages.length === 0) {
      const mainChat = document.querySelector("#main") || document.body;
      const directTextEls = Array.from(mainChat.querySelectorAll("span.selectable-text, div.copyable-text"));
      for (const el of directTextEls) {
        const text = cleanText(el.innerText);
        if (!text) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const isMine = rect.left > window.innerWidth * 0.45;
        messages.push({
          from: isMine ? "me" : "them",
          text
        });
      }
    }

    return deduplicate(messages).slice(-MAX_MESSAGES);
  }

  function findWhatsAppComposer() {
    const selectors = [
      "footer div[contenteditable='true'][role='textbox']",
      "footer div[contenteditable='true']",
      "div[contenteditable='true'][data-tab='10']",
      "div[contenteditable='true'][data-tab='6']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  // Standard insertion helpers for modern contenteditable & rich text inputs
  function insertContentEditableHelper(composer, text) {
    if (!composer) return false;
    composer.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection.removeAllRanges();
    selection.addRange(range);

    let success = false;
    try {
      success = document.execCommand("insertText", false, text);
    } catch (_) {}

    if (!success) {
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        composer.dispatchEvent(new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        }));
        success = true;
      } catch (_) {}
    }

    composer.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));

    return success;
  }

  function clearContentEditableHelper(composer) {
    if (!composer) return false;
    composer.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection.removeAllRanges();
    selection.addRange(range);

    try {
      document.execCommand("delete", false, null);
    } catch (_) {}

    composer.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward"
    }));

    return true;
  }

  // --- Telegram Web Adapter Methods ---
  function findTelegramComposer() {
    const selectors = [
      "div.input-message-input[contenteditable='true']",
      "div.editable-message-text[contenteditable='true']",
      "#editable-message-text",
      "div.input-scroller [contenteditable='true']",
      "div.chat-input [contenteditable='true']",
      "div[contenteditable='true'][role='textbox']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function getTelegramMessages() {
    const rawMessages = [];
    const seen = new Set();

    const messageElements = Array.from(
      document.querySelectorAll(".bubble, .Message, .message-list-item, div[data-message-id]")
    );

    for (const el of messageElements) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const textEl =
        el.querySelector(".message") ||
        el.querySelector(".text-content") ||
        el.querySelector(".bubble-content .copyable-area") ||
        el.querySelector(".translatable-message") ||
        el.querySelector(".message-text") ||
        el;

      const raw = cleanText(textEl.innerText || textEl.textContent || "");
      if (!raw || raw.length > MAX_TEXT_LENGTH) continue;

      const clean = raw.replace(/\d{1,2}:\d{2}(\s?[APap][Mm])?/g, "").trim();
      if (!clean || clean.length < 2) continue;

      const isMine =
        el.classList.contains("is-out") ||
        el.classList.contains("own") ||
        el.dataset.isOut === "true" ||
        Boolean(el.closest(".is-out, .own"));

      const key = `${isMine ? "me" : "them"}|${clean}|${Math.round(rect.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rawMessages.push({
        from: isMine ? "me" : "them",
        text: clean,
        top: rect.top
      });
    }

    rawMessages.sort((a, b) => a.top - b.top);
    return deduplicate(rawMessages.map(({ from, text }) => ({ from, text }))).slice(-MAX_MESSAGES);
  }

  function getTelegramConversationId() {
    const hash = location.hash || "";
    const path = location.pathname || "";
    let title = "";

    const titleSelectors = [
      ".top .peer-title",
      ".chat-info .person-name",
      ".ChatInfo .title",
      ".user-title",
      ".sidebar-header-title",
      ".chat-title"
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        title = (el.innerText || "").trim();
        if (title) break;
      }
    }
    return `tg_${path}_${hash}_${title}`;
  }

  // --- Discord Web Adapter Methods ---
  function findDiscordComposer() {
    const selectors = [
      "div[role='textbox'][data-slate-editor='true']",
      "div[role='textbox'][aria-label*='Message']",
      "div[role='textbox'][contenteditable='true']",
      "div[class*='slateTextArea_']",
      "div[class*='channelTextArea_'] [contenteditable='true']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function getDiscordMyUsername() {
    const userPanelSelectors = [
      "div[class*='avatarWrapper_'] [class*='title_']",
      "section[aria-label*='User area'] [class*='title_']",
      "div[class*='panelSubtextContainer_'] [class*='title_']",
      "div[class*='nameTag_'] [class*='username_']"
    ];
    for (const sel of userPanelSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.innerText || "").trim().toLowerCase();
        if (text) return text;
      }
    }
    return "";
  }

  function getDiscordMessages() {
    const rawMessages = [];
    const seen = new Set();
    const myName = getDiscordMyUsername();

    const messageNodes = Array.from(
      document.querySelectorAll("li[id^='chat-messages-'], div[class*='messageListItem_'], div[class*='message_']")
    );

    for (const el of messageNodes) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const contentEl =
        el.querySelector("div[id^='message-content-']") ||
        el.querySelector("div[class*='messageContent_']");
      if (!contentEl) continue;

      const text = cleanText(contentEl.innerText);
      if (!text || text.length > MAX_TEXT_LENGTH) continue;

      let isMine = false;
      if (myName) {
        const authorEl =
          el.querySelector("span[class*='username_']") ||
          el.querySelector("h3[class*='header_'] span");
        const author = (authorEl?.innerText || "").trim().toLowerCase();
        if (author && (author.includes(myName) || myName.includes(author))) {
          isMine = true;
        }
      }

      if (!isMine) {
        if (el.querySelector("button[aria-label='Edit Message']") || el.querySelector("[class*='isSending_']")) {
          isMine = true;
        }
      }

      const key = `${isMine ? "me" : "them"}|${text}|${Math.round(rect.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rawMessages.push({
        from: isMine ? "me" : "them",
        text,
        top: rect.top
      });
    }

    rawMessages.sort((a, b) => a.top - b.top);
    return deduplicate(rawMessages.map(({ from, text }) => ({ from, text }))).slice(-MAX_MESSAGES);
  }

  function getDiscordConversationId() {
    const path = location.pathname;
    let channelTitle = "";
    const titleEl = document.querySelector("h1[class*='title_'], h2[class*='title_'], [aria-label*='Channel header']");
    if (titleEl) {
      channelTitle = (titleEl.innerText || "").trim();
    }
    return `discord_${path}_${channelTitle}`;
  }

  // --- LinkedIn Adapter Methods ---
  function findLinkedInComposer() {
    const selectors = [
      "div.msg-form__contenteditable[contenteditable='true']",
      "div[role='textbox'][aria-label*='Write a message']",
      "div[role='textbox'][data-artdeco-is-focused]",
      "div.msg-form__msg-content-container [contenteditable='true']",
      ".msg-form__contenteditable p"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function getLinkedInMessages() {
    const rawMessages = [];
    const seen = new Set();

    const listItems = Array.from(
      document.querySelectorAll(".msg-s-event-listitem, .msg-s-message-group")
    );

    for (const el of listItems) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const bodyEl =
        el.querySelector(".msg-s-event-listitem__body") ||
        el.querySelector("p.msg-s-event-listitem__body") ||
        el.querySelector(".msg-s-message-group__meta-heading + div");
      if (!bodyEl) continue;

      const text = cleanText(bodyEl.innerText);
      if (!text || text.length > MAX_TEXT_LENGTH) continue;

      const isMine =
        el.classList.contains("msg-s-message-group--selectable-outgoing") ||
        el.classList.contains("msg-s-event-listitem--outgoing") ||
        Boolean(el.closest(".msg-s-message-group--selectable-outgoing")) ||
        Boolean(el.querySelector(".msg-s-message-group__meta-heading--outgoing"));

      const key = `${isMine ? "me" : "them"}|${text}|${Math.round(rect.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rawMessages.push({
        from: isMine ? "me" : "them",
        text,
        top: rect.top
      });
    }

    rawMessages.sort((a, b) => a.top - b.top);
    return deduplicate(rawMessages.map(({ from, text }) => ({ from, text }))).slice(-MAX_MESSAGES);
  }

  function getLinkedInConversationId() {
    const path = location.pathname;
    let partner = "";
    const partnerEl = document.querySelector("h2.msg-entity-lockup__title, .msg-title-bar__title, .msg-thread__link--active");
    if (partnerEl) {
      partner = (partnerEl.innerText || "").trim().split("\n")[0];
    }
    return `linkedin_${path}_${partner}`;
  }

  // --- Gmail Adapter Methods ---
  function findGmailComposer() {
    const selectors = [
      "div[role='textbox'][aria-label*='Message Body'][contenteditable='true']",
      "div.Am.Al.editable[contenteditable='true']",
      "div[aria-label*='Body'][contenteditable='true']",
      "div[contenteditable='true'].editable",
      "div[role='textbox'][contenteditable='true']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function getGmailMessages() {
    const rawMessages = [];
    const seen = new Set();

    const messageBodies = Array.from(document.querySelectorAll("div.ii.gt div.a3s.aiL, div.ii.gt"));

    for (const el of messageBodies) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const clone = el.cloneNode(true);
      clone.querySelectorAll(".gmail_quote, .gmail_extra, blockquote").forEach((q) => q.remove());

      const text = cleanText(clone.innerText || clone.textContent || "");
      if (!text || text.length > MAX_TEXT_LENGTH) continue;

      const parentThreadItem = el.closest("div[role='listitem']") || el.closest(".adn");
      let isMine = false;
      if (parentThreadItem) {
        const senderEl = parentThreadItem.querySelector("span.gD");
        const senderText = (senderEl?.innerText || senderEl?.getAttribute("name") || "").toLowerCase();
        if (senderText.includes("me") || senderText === "me") {
          isMine = true;
        }
      }

      const key = `${isMine ? "me" : "them"}|${text}|${Math.round(rect.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rawMessages.push({
        from: isMine ? "me" : "them",
        text,
        top: rect.top
      });
    }

    rawMessages.sort((a, b) => a.top - b.top);
    return deduplicate(rawMessages.map(({ from, text }) => ({ from, text }))).slice(-MAX_MESSAGES);
  }

  function getGmailConversationId() {
    const hash = location.hash || "";
    let subject = "";
    const subjectEl = document.querySelector("h2.hP, .hP");
    if (subjectEl) {
      subject = (subjectEl.innerText || "").trim();
    }
    return `gmail_${hash}_${subject}`;
  }

  // --- Microsoft Teams Adapter Methods ---
  function findTeamsComposer() {
    const selectors = [
      "div[data-tid='ckeditor'][contenteditable='true']",
      "div.ck-content[contenteditable='true']",
      "div[data-tid='newMessage_message_input'][contenteditable='true']",
      "div[data-tid='chat-input-editor'] [contenteditable='true']",
      "div[data-tid='chat-input-control'] [contenteditable='true']",
      "div[role='textbox'][aria-label*='Type a message']",
      "div[role='textbox'][aria-label*='Type a new message']",
      "div[role='textbox'][contenteditable='true']",
      "div[contenteditable='true'][data-tab='1']",
      "div.fui-Input [contenteditable='true']",
      "div.ck-editor__editable[contenteditable='true']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    const mainChat = document.querySelector("[data-tid='chat-pane'], [data-tid='message-pane'], main");
    if (mainChat) {
      const el = mainChat.querySelector("[contenteditable='true']");
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function getTeamsMessages() {
    const rawMessages = [];
    const seen = new Set();

    const items = Array.from(
      document.querySelectorAll(
        "div[data-tid='chat-pane-message'], div[data-tid='chat-message'], div[data-tid='message-pane-list-item'], div[data-mid], div.ui-chat__item, div[role='listitem']"
      )
    );

    for (const el of items) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const bodyEl =
        el.querySelector("div[data-tid='message-body']") ||
        el.querySelector("div[data-tid='chat-pane-message-body']") ||
        el.querySelector(".fui-ChatBubble") ||
        el.querySelector(".ui-chat__message__content") ||
        el.querySelector("div[dir='auto']");
      if (!bodyEl) continue;

      const text = cleanText(bodyEl.innerText);
      if (!text || text.length > MAX_TEXT_LENGTH) continue;

      const isMine =
        el.getAttribute("data-is-outgoing") === "true" ||
        el.classList.contains("ui-chat__item--mine") ||
        el.classList.contains("fui-ChatBubble--mine") ||
        Boolean(el.querySelector("[data-tid='chat-pane-message-actions-edit']")) ||
        rect.left > window.innerWidth * 0.45;

      const key = `${isMine ? "me" : "them"}|${text}|${Math.round(rect.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rawMessages.push({
        from: isMine ? "me" : "them",
        text,
        top: rect.top
      });
    }

    rawMessages.sort((a, b) => a.top - b.top);
    return deduplicate(rawMessages.map(({ from, text }) => ({ from, text }))).slice(-MAX_MESSAGES);
  }

  function getTeamsConversationId() {
    const fullUrl = location.pathname + location.hash;
    const match = fullUrl.match(/conversations\/([^?&]+)/);
    if (match) {
      return `teams_${match[1]}`;
    }
    const titleEl = document.querySelector("[data-tid='chat-header-title'], [data-tid='message-pane-header-title'], header h1, header h2");
    const title = titleEl ? (titleEl.innerText || "").trim() : "";
    if (title) {
      return `teams_${fullUrl}_${title}`;
    }
    return `teams_${fullUrl}`;
  }

  // --- Universal Fallback Adapter Methods ---
  function findUniversalComposer() {
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && active.type === "text"))) {
      if (!isSensitiveField(active)) return active;
    }
    const focused = document.querySelector("[contenteditable='true']:focus, textarea:focus");
    if (focused && !isSensitiveField(focused)) return focused;

    const visibleEditable = Array.from(document.querySelectorAll("[contenteditable='true'], textarea")).find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 50 && rect.height > 20 && !host.contains(el) && !isSensitiveField(el);
    });
    return visibleEditable || null;
  }

  function getUniversalComposerText() {
    const el = findUniversalComposer();
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return (el.value || "").trim();
    }
    return (el.innerText || "").replace(/\u200B/g, "").trim();
  }

  function insertUniversalText(text) {
    const el = findUniversalComposer();
    if (!el) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.focus();
      if (typeof el.setRangeText === "function") {
        el.setRangeText(text, 0, el.value.length, "end");
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return insertContentEditableHelper(el, text);
  }

  function clearUniversalComposer() {
    const el = findUniversalComposer();
    if (!el) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.focus();
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return clearContentEditableHelper(el);
  }

  // Full Multi-Platform Adapter Registry
  const PlatformAdapters = {
    instagram: {
      name: "instagram",
      getConversation: getInstagramMessages,
      getComposer: findInstagramComposer,
      getComposerText: () => {
        const el = findInstagramComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findInstagramComposer();
        if (!composer) return false;

        const bridgeRes = await sendInstagramAction("SET_TEXT", text);
        if (bridgeRes.success) return true;

        fallbackInstagramEdit(composer, text);
        await new Promise((r) => setTimeout(r, 50));
        const current = (composer.innerText || "").replace(/\u200B/g, "").trim();
        return current.length > 0;
      },
      clearComposer: async () => {
        const composer = findInstagramComposer();
        if (!composer) return false;

        const bridgeRes = await sendInstagramAction("CLEAR", "");
        if (bridgeRes.success) return true;

        fallbackInstagramEdit(composer, "");
        await new Promise((r) => setTimeout(r, 60));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: getInstagramConversationId
    },
    whatsapp: {
      name: "whatsapp",
      getConversation: getWhatsAppMessages,
      getComposer: findWhatsAppComposer,
      getComposerText: () => {
        const el = findWhatsAppComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findWhatsAppComposer();
        if (!composer) return false;

        composer.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection.removeAllRanges();
        selection.addRange(range);

        const success = document.execCommand("insertText", false, text);
        composer.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text
        }));

        await new Promise((r) => setTimeout(r, 30));
        const current = (composer.innerText || "").replace(/\u200B/g, "").trim();
        return success || current.length > 0;
      },
      clearComposer: async () => {
        const composer = findWhatsAppComposer();
        if (!composer) return false;

        composer.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand("delete", false, null);
        composer.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "deleteContentBackward"
        }));

        await new Promise((r) => setTimeout(r, 40));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: () => {
        const headerEl = document.querySelector("#main header span[dir='auto'], header span[dir='auto']");
        return `wa_${headerEl ? headerEl.innerText.trim() : "chat"}`;
      }
    },
    telegram: {
      name: "telegram",
      getConversation: getTelegramMessages,
      getComposer: findTelegramComposer,
      getComposerText: () => {
        const el = findTelegramComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findTelegramComposer();
        if (!composer) return false;
        insertContentEditableHelper(composer, text);
        await new Promise((r) => setTimeout(r, 40));
        return true;
      },
      clearComposer: async () => {
        const composer = findTelegramComposer();
        if (!composer) return false;
        clearContentEditableHelper(composer);
        await new Promise((r) => setTimeout(r, 40));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: getTelegramConversationId
    },
    discord: {
      name: "discord",
      getConversation: getDiscordMessages,
      getComposer: findDiscordComposer,
      getComposerText: () => {
        const el = findDiscordComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findDiscordComposer();
        if (!composer) return false;
        insertContentEditableHelper(composer, text);
        await new Promise((r) => setTimeout(r, 40));
        return true;
      },
      clearComposer: async () => {
        const composer = findDiscordComposer();
        if (!composer) return false;
        clearContentEditableHelper(composer);
        await new Promise((r) => setTimeout(r, 40));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: getDiscordConversationId
    },
    linkedin: {
      name: "linkedin",
      getConversation: getLinkedInMessages,
      getComposer: findLinkedInComposer,
      getComposerText: () => {
        const el = findLinkedInComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findLinkedInComposer();
        if (!composer) return false;
        insertContentEditableHelper(composer, text);
        await new Promise((r) => setTimeout(r, 40));
        return true;
      },
      clearComposer: async () => {
        const composer = findLinkedInComposer();
        if (!composer) return false;
        clearContentEditableHelper(composer);
        await new Promise((r) => setTimeout(r, 40));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: getLinkedInConversationId
    },
    gmail: {
      name: "gmail",
      getConversation: getGmailMessages,
      getComposer: findGmailComposer,
      getComposerText: () => {
        const el = findGmailComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findGmailComposer();
        if (!composer) return false;
        insertContentEditableHelper(composer, text);
        await new Promise((r) => setTimeout(r, 40));
        return true;
      },
      clearComposer: async () => {
        const composer = findGmailComposer();
        if (!composer) return false;
        clearContentEditableHelper(composer);
        await new Promise((r) => setTimeout(r, 40));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: getGmailConversationId
    },
    teams: {
      name: "teams",
      getConversation: getTeamsMessages,
      getComposer: findTeamsComposer,
      getComposerText: () => {
        const el = findTeamsComposer();
        return el ? (el.innerText || "").replace(/\u200B/g, "").trim() : "";
      },
      insertText: async (text) => {
        const composer = findTeamsComposer();
        if (!composer) return false;
        insertContentEditableHelper(composer, text);
        await new Promise((r) => setTimeout(r, 40));
        return true;
      },
      clearComposer: async () => {
        const composer = findTeamsComposer();
        if (!composer) return false;
        clearContentEditableHelper(composer);
        await new Promise((r) => setTimeout(r, 40));
        return (composer.innerText || "").replace(/\u200B/g, "").trim() === "";
      },
      getActiveConversationId: getTeamsConversationId
    },
    universal: {
      name: "universal",
      getConversation: () => [],
      getComposer: findUniversalComposer,
      getComposerText: getUniversalComposerText,
      insertText: async (text) => {
        return insertUniversalText(text);
      },
      clearComposer: async () => {
        return clearUniversalComposer();
      },
      getActiveConversationId: () => `${location.href}_${document.title}`
    }
  };

  function getActiveAdapter() {
    return PlatformAdapters[APP] || PlatformAdapters.universal;
  }

  function getLastMessages() {
    try {
      const adapter = getActiveAdapter();
      const rawMsgs = (adapter && typeof adapter.getConversation === "function" ? adapter.getConversation() : []) || [];
      const msgs = rawMsgs
        .map((m, idx) => normalizeExtractedMessage(m, idx))
        .filter((m) => !m.isSystemMessage && m.text && m.text.trim().length > 0);
      queueAdaptiveLearning(msgs);
      return msgs;
    } catch (err) {
      console.warn("[ComUcate] Error extracting conversation messages:", err);
      return [];
    }
  }

  const getConversationMessages = getLastMessages;

  function getComposerText() {
    try {
      const adapter = getActiveAdapter();
      const composerEl = adapter && typeof adapter.getComposer === "function" ? adapter.getComposer() : null;
      if (isSensitiveField(composerEl)) {
        console.warn("[ComUcate Shield] Active input is a sensitive field (password/PIN/token). Blocking draft read.");
        return "";
      }
      const raw = (adapter && typeof adapter.getComposerText === "function" ? adapter.getComposerText() : "") || "";
      return redactSensitiveTokens(raw);
    } catch (err) {
      console.warn("[ComUcate] Error reading composer draft:", err);
      return "";
    }
  }

  async function insertIntoComposer(text) {
    try {
      const adapter = getActiveAdapter();
      const composer = adapter && typeof adapter.getComposer === "function" ? adapter.getComposer() : null;
      if (isSensitiveField(composer)) {
        console.warn("[ComUcate Shield] Blocked insertion into sensitive field.");
        return false;
      }
      return adapter && typeof adapter.insertText === "function" ? await adapter.insertText(text) : false;
    } catch (err) {
      console.error("[ComUcate] Error inserting text into composer:", err);
      return false;
    }
  }

  async function clearComposer() {
    try {
      const adapter = getActiveAdapter();
      return adapter && typeof adapter.clearComposer === "function" ? await adapter.clearComposer() : false;
    } catch (err) {
      console.error("[ComUcate] Error clearing composer:", err);
      return false;
    }
  }

  // =========================================================
  // UNIVERSAL CONVERSATION SWITCHING & STATE SYNCHRONIZATION
  // =========================================================

  function getActiveConversationId() {
    const adapter = getActiveAdapter();
    if (adapter && typeof adapter.getActiveConversationId === "function") {
      try {
        const id = adapter.getActiveConversationId();
        if (id && id.trim().length > 0) return id.trim();
      } catch (_) {}
    }
    return `${location.pathname}${location.hash}`;
  }

  function handlePossibleChatChange() {
    if (IS_INSTAGRAM && !location.pathname.startsWith("/direct")) {
      updateWidgetVisibility();
      return;
    }

    updateWidgetVisibility();

    const newId = getActiveConversationId();
    const liveMessages = getLastMessages();
    const liveSnapshot = createContextSnapshot(liveMessages, newId);

    // 1. Thread switch check
    if (newId && newId !== currentConversationId) {
      console.log(`[ComUcate] conversation changed on ${APP}:`, newId);
      console.log("[ComUcate] resetting conversation state & invalidating previous suggestions");

      currentConversationId = newId;
      currentActiveSnapshot = liveSnapshot;
      currentContextVersion = liveSnapshot.contextVersion;
      currentLatestIncomingId = liveSnapshot.latestIncomingId;
      currentRequestId++;
      cachedSuggestions = null;
      cachedSnapshot = null;
      cachedRewrites = null;
      loadContactRole(newId);
      loadContactLanguage(newId);

      if (isPanelOpen) {
        renderReadingConversation();

        if (chatChangeDebounceTimer) {
          clearTimeout(chatChangeDebounceTimer);
        }

        const assignedRequestId = currentRequestId;
        chatChangeDebounceTimer = setTimeout(() => {
          if (assignedRequestId !== currentRequestId) return;
          console.log("[ComUcate] loading new conversation");
          if (isPanelOpen) {
            fetchAndShowSuggestions(true);
          }
        }, 350);
      }
      return;
    }

    // 2. Same thread, but new incoming message arrived check
    if (
      currentContextVersion &&
      liveSnapshot.contextVersion &&
      liveSnapshot.contextVersion !== currentContextVersion &&
      liveSnapshot.latestIncomingId !== currentLatestIncomingId
    ) {
      console.log("[ComUcate] New incoming message detected in active chat! Invalidation triggered:", {
        prevIncoming: currentLatestIncomingId,
        newIncoming: liveSnapshot.latestIncomingId
      });
      currentActiveSnapshot = liveSnapshot;
      currentContextVersion = liveSnapshot.contextVersion;
      currentLatestIncomingId = liveSnapshot.latestIncomingId;
      currentRequestId++;
      cachedSuggestions = null;
      cachedSnapshot = null;

      if (isPanelOpen) {
        if (chatChangeDebounceTimer) {
          clearTimeout(chatChangeDebounceTimer);
        }
        chatChangeDebounceTimer = setTimeout(() => {
          if (isPanelOpen) {
            fetchAndShowSuggestions(true);
          }
        }, 200);
      }
    }
  }

  currentConversationId = getActiveConversationId();
  loadContactRole(currentConversationId);
  loadContactLanguage(currentConversationId);
  window.addEventListener("comucate_navigation", handlePossibleChatChange);
  window.addEventListener("popstate", handlePossibleChatChange);
  window.addEventListener("hashchange", handlePossibleChatChange);
  setInterval(handlePossibleChatChange, 500);

  // =========================================================
  // UI RENDERING (ComUcate v3.0 Adaptive Specification)
  // =========================================================

  function renderHeader() {
    const header = document.createElement("div");
    header.className = "panel-header";

    const titleBox = document.createElement("div");
    titleBox.className = "header-title-box";

    const title = document.createElement("div");
    title.className = "panel-title";
    title.innerHTML = "<span>✨</span> ComUcate";

    titleBox.appendChild(title);

    // Subtle role pill only when specifically set (e.g. Boss, Friend)
    if (currentContactRole && currentContactRole !== "auto") {
      const tag = document.createElement("div");
      tag.className = "personality-tag";
      tag.textContent = currentContactRole === "boss" ? "👔 Boss" : currentContactRole === "colleague" ? "💼 Peer" : currentContactRole === "friend" ? "🤝 Friend" : "❤️ Close";
      titleBox.appendChild(tag);
    }

    const actionsBox = document.createElement("div");
    actionsBox.className = "header-actions-box";

    // Compact Inline Language Switcher [HG | EN | HI]
    const langGroup = document.createElement("div");
    langGroup.className = "lang-mini-group";
    const languages = [
      { id: "Hinglish", label: "HG" },
      { id: "English", label: "EN" },
      { id: "Hindi", label: "HI" }
    ];
    const currentLang = currentContactLanguage || userProfile.language || "Hinglish";

    languages.forEach((l) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const isActive = currentLang.toLowerCase().includes(l.id.toLowerCase());
      chip.className = `lang-chip ${isActive ? "active" : ""}`;
      chip.textContent = l.label;
      chip.title = `Language: ${l.id}`;
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        userProfile.language = l.id;
        setContactLanguage(currentConversationId, l.id);
        langGroup.querySelectorAll(".lang-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        try {
          chrome.storage.sync.set({ profile: userProfile });
        } catch (_) {}
        cachedSuggestions = null;
        if (currentMode === "suggest") {
          fetchAndShowSuggestions(true);
        } else {
          const draft = getComposerText();
          if (draft) fetchAndShowRewrites(draft);
        }
      };
      langGroup.appendChild(chip);
    });

    const hudBtn = document.createElement("button");
    hudBtn.className = "hud-btn";
    hudBtn.type = "button";
    hudBtn.title = "Settings & Diagnostics (Alt+D / Option+D)";
    hudBtn.innerHTML = "⚙️";
    hudBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDiagnosticsModal();
    };

    const close = document.createElement("button");
    close.className = "close-btn";
    close.type = "button";
    close.innerHTML = "&times;";
    close.title = "Close panel";
    close.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    };

    actionsBox.appendChild(langGroup);
    actionsBox.appendChild(hudBtn);
    actionsBox.appendChild(close);

    header.appendChild(titleBox);
    header.appendChild(actionsBox);
    return header;
  }

  function renderModeSwitcher() {
    const switcher = document.createElement("div");
    switcher.className = "mode-switcher";

    const suggestPill = document.createElement("button");
    suggestPill.className = `mode-pill ${currentMode === "suggest" ? "active" : ""}`;
    suggestPill.type = "button";
    suggestPill.textContent = "Replies";
    suggestPill.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentMode = "suggest";
      if (!cachedSuggestions) {
        fetchAndShowSuggestions();
      } else {
        renderSuggestions(cachedSuggestions);
      }
    };

    const rewritePill = document.createElement("button");
    rewritePill.className = `mode-pill ${currentMode === "rewrite" ? "active" : ""}`;
    rewritePill.type = "button";
    rewritePill.textContent = "Rewrite";
    rewritePill.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentMode = "rewrite";
      const draft = getComposerText();
      if (!draft) {
        renderDraftEmptyPrompt();
      } else if (cachedRewrites && lastRewrittenDraft === draft) {
        renderRewrites(cachedRewrites, draft);
      } else {
        fetchAndShowRewrites(draft);
      }
    };

    switcher.appendChild(suggestPill);
    switcher.appendChild(rewritePill);
    return switcher;
  }

  function renderContextToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "quick-controls-strip";

    const rolesGroup = document.createElement("div");
    rolesGroup.className = "roles-mini-group";

    const roles = [
      { id: "boss", label: "👔 Boss" },
      { id: "colleague", label: "💼 Peer" },
      { id: "friend", label: "🤝 Friend" },
      { id: "close", label: "❤️ Close" }
    ];

    roles.forEach((r) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const isActive = currentContactRole === r.id;
      chip.className = `role-chip ${isActive ? "active" : ""}`;
      chip.textContent = r.label;
      chip.title = `Switch role: ${r.label} (Click to toggle)`;
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextRole = currentContactRole === r.id ? "auto" : r.id;
        setContactRole(currentConversationId, nextRole);
        cachedSuggestions = null;
        if (currentMode === "suggest") {
          fetchAndShowSuggestions(true);
        } else {
          const draft = getComposerText();
          if (draft) fetchAndShowRewrites(draft);
        }
      };
      rolesGroup.appendChild(chip);
    });

    const divider = document.createElement("div");
    divider.className = "strip-divider";

    const langGroup = document.createElement("div");
    langGroup.className = "lang-mini-group";

    const languages = [
      { id: "Hinglish", label: "Hinglish" },
      { id: "English", label: "EN" },
      { id: "Hindi", label: "HI" }
    ];

    const currentLang = currentContactLanguage || userProfile.language || "Hinglish";

    languages.forEach((l) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const isActive = currentLang.toLowerCase().includes(l.id.toLowerCase());
      chip.className = `lang-chip ${isActive ? "active" : ""}`;
      chip.textContent = l.label;
      chip.title = `Language: ${l.id}`;
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        userProfile.language = l.id;
        setContactLanguage(currentConversationId, l.id);

        // Immediate visual feedback on the button
        langGroup.querySelectorAll(".lang-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");

        try {
          chrome.storage.sync.set({ profile: userProfile });
        } catch (_) {}
        cachedSuggestions = null;
        if (currentMode === "suggest") {
          fetchAndShowSuggestions(true);
        } else {
          const draft = getComposerText();
          if (draft) fetchAndShowRewrites(draft);
        }
      };
      langGroup.appendChild(chip);
    });

    toolbar.appendChild(rolesGroup);
    toolbar.appendChild(divider);
    toolbar.appendChild(langGroup);

    return toolbar;
  }

  function renderLoading(loadingText = "ComUcate is thinking...") {
    panel.innerHTML = "";
    panel.appendChild(renderHeader());
    panel.appendChild(renderModeSwitcher());

    const skeletonWrap = document.createElement("div");
    skeletonWrap.className = "skeleton-wrapper";

    const heroSkeleton = document.createElement("div");
    heroSkeleton.className = "skeleton-hero-card";
    heroSkeleton.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="skeleton-pill"></span>
        <span style="font-size: 11px; color: #6366f1; opacity: 0.8; font-weight: 500;">✨ thinking...</span>
      </div>
      <div class="skeleton-line full" style="margin-top: 6px;"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-footer">
        <span class="skeleton-btn"></span>
      </div>
    `;

    const altSkeleton = document.createElement("div");
    altSkeleton.className = "skeleton-alt-card";
    altSkeleton.innerHTML = `
      <div class="skeleton-pill sm"></div>
      <div class="skeleton-line sm" style="margin-top: 4px;"></div>
    `;

    skeletonWrap.appendChild(heroSkeleton);
    skeletonWrap.appendChild(altSkeleton);
    panel.appendChild(skeletonWrap);
  }

  function renderReadingConversation() {
    panel.innerHTML = "";
    panel.appendChild(renderHeader());

    const box = document.createElement("div");
    box.className = "status-box";

    const spinner = document.createElement("div");
    spinner.className = "spinner";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.color = "#6c47ff";
    title.textContent = "New conversation";

    const subtitle = document.createElement("div");
    subtitle.textContent = "Reading messages...";

    box.appendChild(spinner);
    box.appendChild(title);
    box.appendChild(subtitle);
    panel.appendChild(box);
  }

  function renderDraftEmptyPrompt() {
    panel.innerHTML = "";
    panel.appendChild(renderHeader());
    panel.appendChild(renderModeSwitcher());

    const box = document.createElement("div");
    box.className = "status-box";

    const icon = document.createElement("div");
    icon.style.fontSize = "26px";
    icon.textContent = "✍️";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = "No Draft Found in Chat Box";

    const sub = document.createElement("div");
    sub.textContent = "Type a rough message in the composer below, then click Rewrite to transform it!";

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(sub);
    panel.appendChild(box);
  }

  function renderError(errorMessage, retryCallback) {
    panel.innerHTML = "";
    panel.appendChild(renderHeader());
    panel.appendChild(renderModeSwitcher());

    const box = document.createElement("div");
    box.className = "status-box";

    const icon = document.createElement("div");
    icon.style.fontSize = "22px";
    icon.textContent = "⚠️";

    const msg = document.createElement("div");
    msg.textContent = errorMessage;

    const retryBtn = document.createElement("button");
    retryBtn.className = "footer-btn";
    retryBtn.type = "button";
    retryBtn.textContent = "Try Again";
    retryBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (retryCallback) retryCallback();
    };

    box.appendChild(icon);
    box.appendChild(msg);
    box.appendChild(retryBtn);
    panel.appendChild(box);
  }

  // =========================================================
  // QA DIAGNOSTICS HUD, TRANSFORM CHIPS & OFFLINE ENGINE
  // =========================================================

  function toggleDiagnosticsModal() {
    const existingHud = panel.querySelector(".hud-overlay");
    if (existingHud) {
      existingHud.remove();
      return;
    }

    const hud = document.createElement("div");
    hud.className = "hud-overlay";

    const header = document.createElement("div");
    header.className = "hud-header";
    header.innerHTML = "<span>🛠️ ComUcate Diagnostics HUD</span>";
    const closeHudBtn = document.createElement("button");
    closeHudBtn.className = "close-btn";
    closeHudBtn.type = "button";
    closeHudBtn.innerHTML = "&times;";
    closeHudBtn.title = "Close HUD";
    closeHudBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hud.remove();
    };
    header.appendChild(closeHudBtn);
    hud.appendChild(header);

    const adapter = getActiveAdapter();
    const composer = adapter && typeof adapter.getComposer === "function" ? adapter.getComposer() : null;
    const msgs = getLastMessages();
    const convId = getActiveConversationId();
    const liveSnap = createContextSnapshot(msgs, convId);
    const currentAngle = REGEN_ANGLES[currentAngleIndex] || "balanced";
    const detectedIntent = cachedSuggestions?.intent || "None";
    const latency = cachedSuggestions?.timings?.roundtripMs ? `${cachedSuggestions.timings.roundtripMs}ms` : (lastRoundtripMs ? `${lastRoundtripMs}ms` : "N/A");
    const aiLatency = cachedSuggestions?.timings?.aiMs ? `${cachedSuggestions.timings.aiMs}ms` : "N/A";
    const activeProf = getEffectiveProfile(APP);

    const rows = [
      { label: "Target Platform", val: APP },
      { label: "Active App Profile", val: activeProf.personalityPreset || "Default", good: true },
      { label: "Auto-Adapt Tone", val: autoAdaptEnabled ? "ON (Auto-Tuned)" : "OFF (Global)", good: autoAdaptEnabled },
      { label: "Active Adapter", val: adapter.name, good: true },
      { label: "Composer Found", val: composer ? "YES (Active)" : "NO", good: Boolean(composer) },
      { label: "Composer Tag", val: composer ? composer.tagName.toLowerCase() : "None" },
      { label: "Sensitive Shield", val: isSensitiveField(composer) ? "TRIGGERED (Blocked)" : "Clear (Safe)", good: !isSensitiveField(composer) },
      { label: "Active Convo ID", val: convId.slice(0, 24) + (convId.length > 24 ? "..." : "") },
      { label: "Snapshot Version", val: `#${liveSnap.contextVersion}`, good: true },
      { label: "Latest Incoming ID", val: liveSnap.latestIncomingId.slice(0, 24) },
      { label: "Messages Scanned", val: `${msgs.length} messages`, good: msgs.length > 0 },
      { label: "Detected Intent", val: detectedIntent },
      { label: "Regen Angle", val: currentAngle },
      { label: "Roundtrip Latency", val: latency },
      { label: "Gemini AI Latency", val: aiLatency },
      { label: "Learned Style Msgs", val: `${learnedProfile?.messageCount || 0}` }
    ];

    rows.forEach((r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "hud-row";
      const labelEl = document.createElement("span");
      labelEl.className = "hud-label";
      labelEl.textContent = r.label;
      const valEl = document.createElement("span");
      valEl.className = `hud-val ${r.good ? "good" : ""}`;
      valEl.textContent = r.val;
      rowEl.appendChild(labelEl);
      rowEl.appendChild(valEl);
      hud.appendChild(rowEl);
    });

    // Developer Extracted Messages Inspection (Manual reveal only - zero content logged in console)
    const inspectBox = document.createElement("div");
    inspectBox.style.marginTop = "8px";
    inspectBox.style.display = "flex";
    inspectBox.style.flexDirection = "column";
    inspectBox.style.gap = "4px";

    const inspectBtn = document.createElement("button");
    inspectBtn.className = "footer-btn";
    inspectBtn.style.padding = "5px 8px";
    inspectBtn.style.fontSize = "11px";
    inspectBtn.textContent = "👁️ Inspect Extracted Messages (Dev Debug)";

    const inspectList = document.createElement("div");
    inspectList.style.display = "none";
    inspectList.style.maxHeight = "130px";
    inspectList.style.overflowY = "auto";
    inspectList.style.fontSize = "11px";
    inspectList.style.background = "rgba(0,0,0,0.06)";
    inspectList.style.borderRadius = "6px";
    inspectList.style.padding = "6px";
    inspectList.style.border = "1px solid rgba(0,0,0,0.08)";

    inspectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = inspectList.style.display === "block";
      inspectList.style.display = isVisible ? "none" : "block";
      inspectBtn.textContent = isVisible ? "👁️ Inspect Extracted Messages (Dev Debug)" : "🙈 Hide Extracted Messages";
      if (!isVisible) {
        inspectList.innerHTML = "";
        const latest5 = msgs.slice(-5);
        if (latest5.length === 0) {
          inspectList.textContent = "No messages extracted.";
        } else {
          latest5.forEach((m, idx) => {
            const item = document.createElement("div");
            item.style.marginBottom = "4px";
            item.style.paddingBottom = "2px";
            item.style.borderBottom = "1px dashed rgba(0,0,0,0.12)";
            item.innerHTML = `<span style="font-weight:600;color:${m.author === 'me' ? '#6366f1' : '#10b981'};">#${idx + 1} [${m.author.toUpperCase()}]:</span> ${m.text.replace(/</g, "&lt;")} <span style="opacity:0.5;font-size:9px;">(${m.id})</span>`;
            inspectList.appendChild(item);
          });
        }
      }
    };
    inspectBox.appendChild(inspectBtn);
    inspectBox.appendChild(inspectList);
    hud.appendChild(inspectBox);

    const testBox = document.createElement("div");
    testBox.style.marginTop = "8px";
    testBox.style.display = "flex";
    testBox.style.flexDirection = "column";
    testBox.style.gap = "6px";

    const testInsertBtn = document.createElement("button");
    testInsertBtn.className = "footer-btn primary-footer-btn";
    testInsertBtn.style.padding = "6px 10px";
    testInsertBtn.textContent = "🧪 Test Composer Insertion";
    testInsertBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      testInsertBtn.textContent = "Inserting...";
      const testText = `[ComUcate Test OK: ${new Date().toLocaleTimeString()}]`;
      const res = await insertIntoComposer(testText);
      if (res) {
        testInsertBtn.textContent = "✓ Insertion Succeeded!";
        setTimeout(() => (testInsertBtn.textContent = "🧪 Test Composer Insertion"), 1500);
      } else {
        testInsertBtn.textContent = "❌ Failed (Composer not found/writable)";
        setTimeout(() => (testInsertBtn.textContent = "🧪 Test Composer Insertion"), 2000);
      }
    };

    const checkHealthBtn = document.createElement("button");
    checkHealthBtn.className = "footer-btn";
    checkHealthBtn.style.padding = "6px 10px";
    checkHealthBtn.textContent = "📡 Ping Local Server (/health)";
    checkHealthBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      checkHealthBtn.textContent = "Pinging...";
      chrome.runtime.sendMessage({ type: "HEALTH_CHECK" }, (resp) => {
        if (resp && resp.ok && resp.data?.status === "ok") {
          checkHealthBtn.textContent = `✓ Server Online (v${resp.data.version || "4.1"})`;
        } else {
          checkHealthBtn.textContent = "❌ Server Offline / Unreachable";
        }
        setTimeout(() => (checkHealthBtn.textContent = "📡 Ping Local Server (/health)"), 2500);
      });
    };

    const resetPosBtn = document.createElement("button");
    resetPosBtn.className = "footer-btn";
    resetPosBtn.style.padding = "6px 10px";
    resetPosBtn.textContent = "📍 Reset Floating Icon Position";
    resetPosBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetWidgetPosition();
      resetPosBtn.textContent = "✓ Position Reset!";
      setTimeout(() => (resetPosBtn.textContent = "📍 Reset Floating Icon Position"), 1500);
    };

    testBox.appendChild(testInsertBtn);
    testBox.appendChild(checkHealthBtn);
    testBox.appendChild(resetPosBtn);
    hud.appendChild(testBox);

    panel.appendChild(hud);
  }

  function attachTransformChips(card, textDiv, statusBadge, getLatestText, onUpdateText) {
    const transformBar = document.createElement("div");
    transformBar.className = "card-transform-bar";

    const chips = [
      { label: "⚡ Shorter", action: "shorter" },
      { label: "💬 Longer", action: "longer" },
      { label: "😂 Funny", action: "funny" },
      { label: "😎 Confident", action: "confident" },
      { label: "💼 Pro", action: "professional" },
      { label: "🗣️ Like Me", action: "sound_like_me" }
    ];

    chips.forEach((chip) => {
      const chipBtn = document.createElement("button");
      chipBtn.className = "transform-chip";
      chipBtn.type = "button";
      chipBtn.textContent = chip.label;

      chipBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentText = getLatestText();
        const origLabel = chipBtn.textContent;
        chipBtn.textContent = "⏳...";
        chipBtn.disabled = true;

        statusBadge.className = "card-status-badge";
        statusBadge.textContent = "Transforming...";

        try {
          const resp = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: "TRANSFORM",
                text: currentText,
                transformation: chip.action,
                profile: getEffectiveProfile(APP),
                app: APP
              },
              (res) => resolve(res)
            );
          });

          if (resp && resp.ok && resp.data?.text) {
            const transformed = resp.data.text;
            onUpdateText(transformed);
            textDiv.textContent = transformed;
            statusBadge.className = "card-status-badge";
            statusBadge.textContent = "✓ Transformed";
            setTimeout(() => (statusBadge.textContent = ""), 1500);
          } else {
            statusBadge.className = "card-status-badge error";
            statusBadge.textContent = resp?.error || "Transform failed";
            setTimeout(() => (statusBadge.textContent = ""), 2000);
          }
        } catch (err) {
          statusBadge.className = "card-status-badge error";
          statusBadge.textContent = "Error";
          setTimeout(() => (statusBadge.textContent = ""), 1500);
        } finally {
          chipBtn.textContent = origLabel;
          chipBtn.disabled = false;
        }
      };

      transformBar.appendChild(chipBtn);
    });

    card.appendChild(transformBar);
  }

  function generateOfflineReplies(messages, profile, app = APP) {
    const lastThem = [...messages].reverse().find((m) => m.from === "them");
    const lastText = (lastThem?.text || "").toLowerCase().trim();
    const isWorkplace = app === "teams" || app === "linkedin" || app === "gmail";
    const isHinglish = !isWorkplace && (profile?.language || "Hinglish").toLowerCase().includes("hinglish");

    let intent = "Conversation continuation";
    if (lastText.includes("?") || lastText.endsWith("?")) {
      intent = "Question";
    } else if (
      lastText.includes("meet") ||
      lastText.includes("call") ||
      lastText.includes("aao") ||
      lastText.includes("plans") ||
      lastText.includes("dinner") ||
      lastText.includes("lunch") ||
      lastText.includes("sync")
    ) {
      intent = "Invitation";
    } else if (
      lastText.includes("haha") ||
      lastText.includes("lol") ||
      lastText.includes("lmao") ||
      lastText.includes("😂") ||
      lastText.includes("🤣")
    ) {
      intent = "Joke/banter";
    } else if (
      lastText.includes("thanks") ||
      lastText.includes("thank you") ||
      lastText.includes("shukriya")
    ) {
      intent = "Agreement";
    } else if (
      lastText.includes("bye") ||
      lastText.includes("goodnight") ||
      lastText.includes("cya") ||
      lastText.includes("gn")
    ) {
      intent = "Conversation ending";
    }

    if (isWorkplace) {
      if (intent === "Question") {
        return {
          intent: "Question",
          convoState: { topic: "Inquiry", openQuestion: true },
          agree: "Sure, let me check on that and update you shortly.",
          decline: "A bit tied up with an urgent item right now, can I circle back shortly?",
          clarify: "On it. Do you need this by a specific deadline today?",
          natural: "Sure, let me check on that and update you shortly.",
          playful: "Checking on this right away, will update you soon.",
          keep_going: "On it. Do you need this by a specific time today?"
        };
      }
      if (intent === "Invitation") {
        return {
          intent: "Invitation",
          convoState: { topic: "Meeting / Sync", openQuestion: false },
          agree: "Sounds good, I will be there.",
          decline: "I have a scheduling conflict then, could we do later or tomorrow?",
          clarify: "Works for me. Should we prepare anything specific in advance?",
          natural: "Sounds good, I will be there.",
          playful: "Works for me, let's sync up then!",
          keep_going: "Accepted. Should we prepare anything in advance?"
        };
      }
      if (intent === "Joke/banter") {
        return {
          intent: "Joke/banter",
          convoState: { topic: "Workplace Chat", openQuestion: false },
          agree: "Haha, completely agree with that!",
          decline: "Haha good one, though let's keep an eye on the deadline as well.",
          clarify: "Haha indeed! How is the rest of the progress tracking?",
          natural: "Haha, thanks for the update!",
          playful: "Appreciate the humor on this! 😄",
          keep_going: "Haha indeed! How is the rest of the progress tracking?"
        };
      }
      if (intent === "Agreement") {
        return {
          intent: "Agreement",
          convoState: { topic: "Alignment", openQuestion: false },
          agree: "Understood, thanks for confirming. Moving ahead.",
          decline: "Understood, though let's reconsider if we need any adjustments.",
          clarify: "Agreed. What should our immediate next priority be?",
          natural: "Understood, thanks for confirming.",
          playful: "Sounds like a solid plan, let's proceed.",
          keep_going: "Agreed. What should our next priority be?"
        };
      }
      if (intent === "Conversation ending") {
        return {
          intent: "Conversation ending",
          convoState: { topic: "Wrapping up", openQuestion: false },
          agree: "Thanks, have a great day ahead!",
          decline: "Thanks! I'll catch you tomorrow morning.",
          clarify: "Appreciate the update, let's connect again soon.",
          natural: "Thanks, have a great day ahead!",
          playful: "Thank you! Talk soon.",
          keep_going: "Appreciate the update, let's connect again soon."
        };
      }
      return {
        intent: intent,
        convoState: { topic: "Workplace Collaboration", openQuestion: false },
        agree: "Understood, thanks for keeping me in the loop.",
        decline: "Understood, though I might suggest a slightly different timeline.",
        clarify: "Makes total sense. What is our next milestone?",
        natural: "Understood, thanks for keeping me in the loop.",
        playful: "Sounds good, happy to collaborate on this.",
        keep_going: "Makes total sense. What is our next milestone?"
      };
    }

    if (intent === "Question") {
      const agree = isHinglish ? "Haan bhai, let me check and tell you in a bit." : "Yeah, let me check and get back to you shortly.";
      const decline = isHinglish ? "Arre abhi thoda busy hu, shaam tak batata hu chalega?" : "A bit caught up right now, can I get back to you in a bit?";
      const clarify = isHinglish ? "Haan sure! By the way what time were you thinking?" : "Yeah for sure! What time are you thinking though?";
      return {
        intent: "Question",
        convoState: { topic: "Inquiry", openQuestion: true },
        agree,
        decline,
        clarify,
        natural: agree,
        playful: decline,
        keep_going: clarify
      };
    }

    if (intent === "Invitation") {
      const agree = isHinglish ? "Sounds like a solid plan, count me in!" : "Sounds great, I'm in!";
      const decline = isHinglish ? "Arre aaj thoda mushkil hai, kal pakka milte hain?" : "Can't make it today, how about tomorrow?";
      const clarify = isHinglish ? "Haan mast plan hai! Kahan milna hai aur kitne baje?" : "Sounds great! Where are we meeting and what time?";
      return {
        intent: "Invitation",
        convoState: { topic: "Plans & Meetups", openQuestion: false },
        agree,
        decline,
        clarify,
        natural: agree,
        playful: decline,
        keep_going: clarify
      };
    }

    if (intent === "Joke/banter") {
      const agree = isHinglish ? "Haha bilkul sahi bola bhai!" : "Haha totally agree with that!";
      const decline = isHinglish ? "Sach me yaar, cant stop laughing 😭" : "Haha honestly too good 😭";
      const clarify = isHinglish ? "Haha sahi me, aur kya chal raha hai aajkal?" : "Haha so true! What else is new with you?";
      return {
        intent: "Joke/banter",
        convoState: { topic: "Banter", openQuestion: false },
        agree,
        decline,
        clarify,
        natural: agree,
        playful: decline,
        keep_going: clarify
      };
    }

    if (intent === "Conversation ending") {
      const agree = isHinglish ? "Chalo theek hai, take care!" : "All right, take care!";
      const decline = isHinglish ? "Haan bhai chal, catch you tomorrow! 👋" : "Haha see ya! Catch you soon 👋";
      const clarify = isHinglish ? "Okay cool, will message you tomorrow!" : "Sounds good, I'll message you tomorrow!";
      return {
        intent: "Conversation ending",
        convoState: { topic: "Wrapping up", openQuestion: false },
        agree,
        decline,
        clarify,
        natural: agree,
        playful: decline,
        keep_going: clarify,
        primary: { text: agree, label: "Best reply", strategy: "natural_closure" },
        alternatives: [
          { text: decline, label: "More playful", strategy: "casual_close" },
          { text: clarify, label: "More casual", strategy: "friendly_close" }
        ]
      };
    }

    if (/\b(romance|thriller|fiction|movie|series|binge|genre|shows)\b/i.test(lastText)) {
      const agree = isHinglish ? "Sahi taste hai! Koi achi series recommend karo?" : "Great taste! Any good series you would recommend?";
      const decline = isHinglish ? "Acha thriller? Darr nahi lagta akele dekhne me? 😭" : "Thriller fan? Don't you get scared watching those alone haha";
      const clarify = isHinglish ? "Romance aur thriller ka combination waise kafi chaotic aur interesting hai haha" : "Romance and thriller is definitely a chaotic combination haha";
      return {
        intent: "Information sharing",
        convoState: { topic: "Entertainment & Movies", openQuestion: false },
        agree,
        decline,
        clarify,
        natural: agree,
        playful: decline,
        keep_going: clarify,
        primary: { text: agree, label: "Best reply", strategy: "respond_to_preference" },
        alternatives: [
          { text: decline, label: "More playful", strategy: "playful_teasing" },
          { text: clarify, label: "More bold", strategy: "witty_observation" }
        ]
      };
    }

    const agree = isHinglish ? "Haan sahi baat hai, completely agree." : "Got it, totally makes sense.";
    const decline = isHinglish ? "Hmm thoda alag view hai mera, but makes sense." : "Fair point, though had a slightly different thought.";
    const clarify = isHinglish ? "Makes sense! Next step kya plan hai?" : "Makes total sense! What's the next step on this?";
    return {
      intent: intent,
      convoState: { topic: "General Chat", openQuestion: false },
      agree,
      decline,
      clarify,
      natural: agree,
      playful: decline,
      keep_going: clarify,
      primary: { text: agree, label: "Best reply", strategy: "natural_continuation" },
      alternatives: [
        { text: decline, label: "Alternative view", strategy: "alternative_angle" },
        { text: clarify, label: "Keep going", strategy: "curious_question" }
      ]
    };
  }

  function renderOfflineFallback(messages, errorMsg) {
    const offlineData = generateOfflineReplies(messages, getEffectiveProfile(APP), APP);
    cachedSuggestions = offlineData;
    renderSuggestions(offlineData, true, errorMsg);
  }

  // Render Contextual Suggestions (✨ Communication Handler v4.2)
  function renderSuggestions(data, isOffline = false, offlineReason = "") {
    panel.innerHTML = "";
    panel.appendChild(renderHeader());
    panel.appendChild(renderModeSwitcher());

    if (isOffline) {
      const notice = document.createElement("div");
      notice.className = "offline-notice";
      notice.innerHTML = `<span>⚠️ <b>Offline Mode</b> — Local fallback replies.</span>`;
      const retryBtn = document.createElement("button");
      retryBtn.className = "transform-chip";
      retryBtn.style.marginLeft = "auto";
      retryBtn.textContent = "↻ Reconnect";
      retryBtn.onclick = (e) => {
        e.stopPropagation();
        fetchAndShowSuggestions();
      };
      notice.appendChild(retryBtn);
      panel.appendChild(notice);
    }

    // Voice Note Detection Banner
    const recentConvo = getLastMessages();
    const lastThemMsg = [...recentConvo].reverse().find((m) => m.from === "them");
    const isVoiceNote = Boolean(
      lastThemMsg && (lastThemMsg.isAudio || (lastThemMsg.text && lastThemMsg.text.includes("[Voice Note")))
    );

    if (isVoiceNote) {
      const voiceBanner = document.createElement("div");
      voiceBanner.className = "voice-note-banner";
      voiceBanner.innerHTML = `
        <div class="voice-note-info">
          <span>🎙️</span>
          <span>Voice Note Received</span>
        </div>
      `;

      const quickReplyBtn = document.createElement("button");
      quickReplyBtn.type = "button";
      quickReplyBtn.className = "voice-note-btn";
      quickReplyBtn.innerHTML = "<span>⚡</span> Quick Audio Reply";
      quickReplyBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isHinglish = (userProfile.language || "Hinglish").toLowerCase().includes("hinglish");
        const ack = isHinglish
          ? "Abhi sun nahi sakta, in a meeting. Kya hua sab theek?"
          : "Can't listen right now, in a meeting. What's up, everything okay?";
        insertIntoComposer(ack);
      };

      voiceBanner.appendChild(quickReplyBtn);
      panel.appendChild(voiceBanner);
    }

    // Extract Primary Reply & Alternatives
    const primaryText = data?.primary?.text || data?.suggestions?.[0]?.text || data?.agree || data?.natural || "";
    const primaryLabel = data?.primary?.label || data?.suggestions?.[0]?.label || "Best reply";

    let alternatives = [];
    if (Array.isArray(data?.alternatives) && data.alternatives.length > 0) {
      alternatives = data.alternatives;
    } else if (Array.isArray(data?.suggestions) && data.suggestions.length > 1) {
      alternatives = data.suggestions.slice(1).map((s, idx) => ({
        text: s.text,
        label: s.label || (idx === 0 ? "More playful" : "More bold")
      }));
    } else {
      if (data?.decline || data?.playful) {
        alternatives.push({ text: data.decline || data.playful, label: "More playful" });
      }
      if (data?.clarify || data?.keep_going) {
        alternatives.push({ text: data.clarify || data.keep_going, label: "More bold" });
      }
    }

    const wrap = document.createElement("div");
    wrap.className = "comucate-v42-wrap";

    // 1. HERO PRIMARY REPLY CARD (The single response ComUcate recommends)
    if (primaryText) {
      const heroCard = document.createElement("div");
      heroCard.className = "hero-reply-card";

      const heroHeader = document.createElement("div");
      heroHeader.className = "hero-card-header";

      const heroPill = document.createElement("span");
      heroPill.className = "hero-pill";
      heroPill.innerHTML = `<span>✨</span> ${primaryLabel}`;

      const shortcutChip = document.createElement("span");
      shortcutChip.className = "hero-shortcut";
      shortcutChip.textContent = "↵ / 1";
      shortcutChip.title = "Press '1' or click to insert";

      heroHeader.appendChild(heroPill);
      heroHeader.appendChild(shortcutChip);

      const heroText = document.createElement("div");
      heroText.className = "hero-text";
      heroText.textContent = primaryText;

      const heroFooter = document.createElement("div");
      heroFooter.className = "hero-card-footer";

      const insertBtn = document.createElement("button");
      insertBtn.type = "button";
      insertBtn.className = "hero-insert-btn";
      insertBtn.innerHTML = "<span>⚡</span> Insert";
      insertBtn.title = "Insert into message composer";

      const doInsert = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        insertBtn.classList.add("inserted");
        insertBtn.innerHTML = "✓ Inserted";
        const success = await insertIntoComposer(primaryText);
        setTimeout(() => {
          insertBtn.classList.remove("inserted");
          insertBtn.innerHTML = "<span>⚡</span> Insert";
        }, 1400);
      };

      insertBtn.onclick = doInsert;
      heroCard.onclick = doInsert;

      heroFooter.appendChild(insertBtn);

      heroCard.appendChild(heroHeader);
      heroCard.appendChild(heroText);
      heroCard.appendChild(heroFooter);
      wrap.appendChild(heroCard);
    }

    // 2. ALTERNATIVES SECTION (Only when genuinely valuable)
    const validAlts = alternatives.filter((a) => a.text && a.text.trim().length > 0 && a.text !== primaryText);
    if (validAlts.length > 0) {
      const altsContainer = document.createElement("div");
      altsContainer.className = "alternatives-container";

      const divider = document.createElement("div");
      divider.className = "comucate-divider";
      divider.innerHTML = "<span>More angles</span>";
      altsContainer.appendChild(divider);

      validAlts.forEach((alt, idx) => {
        const altCard = document.createElement("div");
        altCard.className = "alt-reply-card";

        const altHeader = document.createElement("div");
        altHeader.className = "alt-header";

        const altLabel = document.createElement("span");
        altLabel.className = "alt-label";
        altLabel.textContent = alt.label || (idx === 0 ? "More playful" : "More bold");

        const altShortcut = document.createElement("span");
        altShortcut.className = "hero-shortcut";
        altShortcut.textContent = `${idx + 2}`;

        altHeader.appendChild(altLabel);
        altHeader.appendChild(altShortcut);

        const altText = document.createElement("div");
        altText.className = "alt-text";
        altText.textContent = alt.text;

        altCard.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          altLabel.textContent = "✓ Inserted";
          await insertIntoComposer(alt.text);
          setTimeout(() => {
            altLabel.textContent = alt.label || (idx === 0 ? "More playful" : "More bold");
          }, 1400);
        };

        altCard.appendChild(altHeader);
        altCard.appendChild(altText);
        altsContainer.appendChild(altCard);
      });

      wrap.appendChild(altsContainer);
    }

    // 3. CONTEXTUAL ACTION FOOTER
    const actionFooter = document.createElement("div");
    actionFooter.className = "comucate-action-footer";

    const regenBtn = document.createElement("button");
    regenBtn.className = "comucate-action-btn primary-action";
    regenBtn.type = "button";
    regenBtn.innerHTML = "↻ Regenerate";
    regenBtn.title = "Generate fresh responses";
    regenBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentAngleIndex = (currentAngleIndex + 1) % REGEN_ANGLES.length;
      fetchAndShowSuggestions(false, REGEN_ANGLES[currentAngleIndex]);
    };

    const likeMeBtn = document.createElement("button");
    likeMeBtn.className = "comucate-action-btn";
    likeMeBtn.type = "button";
    likeMeBtn.innerHTML = "✨ Like Me";
    likeMeBtn.title = "Rewrite primary reply in your exact learned style";
    likeMeBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      likeMeBtn.textContent = "⏳...";
      chrome.runtime.sendMessage(
        {
          type: "TRANSFORM",
          text: primaryText,
          transformation: "sound_like_me",
          profile: getEffectiveProfile(APP, currentContactRole),
          app: APP
        },
        (resp) => {
          likeMeBtn.innerHTML = "✨ Like Me";
          if (resp && resp.ok && resp.data?.transformed) {
            data.primary = { text: resp.data.transformed, label: "✨ Made like me" };
            renderSuggestions(data);
          }
        }
      );
    };

    actionFooter.appendChild(regenBtn);
    actionFooter.appendChild(likeMeBtn);

    // Dynamic Context Action Chip (e.g. Flirty, Playful, Pro)
    const energy = data?.conversationEnergy || "neutral";
    const contextChip = document.createElement("button");
    contextChip.className = "comucate-action-btn";
    contextChip.type = "button";

    if (energy === "flirty" || (userProfile.flirting && currentContactRole !== "boss")) {
      contextChip.innerHTML = "❤️ More Flirty";
      contextChip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        contextChip.textContent = "⏳...";
        chrome.runtime.sendMessage(
          {
            type: "TRANSFORM",
            text: primaryText,
            transformation: "flirty",
            profile: getEffectiveProfile(APP, currentContactRole),
            app: APP
          },
          (resp) => {
            contextChip.innerHTML = "❤️ More Flirty";
            if (resp && resp.ok && resp.data?.transformed) {
              data.primary = { text: resp.data.transformed, label: "❤️ Flirty variation" };
              renderSuggestions(data);
            }
          }
        );
      };
      actionFooter.appendChild(contextChip);
    } else if (currentContactRole === "boss" || APP === "teams" || APP === "linkedin") {
      contextChip.innerHTML = "💼 Professional";
      contextChip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        contextChip.textContent = "⏳...";
        chrome.runtime.sendMessage(
          {
            type: "TRANSFORM",
            text: primaryText,
            transformation: "professional",
            profile: getEffectiveProfile(APP, currentContactRole),
            app: APP
          },
          (resp) => {
            contextChip.innerHTML = "💼 Professional";
            if (resp && resp.ok && resp.data?.transformed) {
              data.primary = { text: resp.data.transformed, label: "💼 Professional" };
              renderSuggestions(data);
            }
          }
        );
      };
      actionFooter.appendChild(contextChip);
    } else {
      contextChip.innerHTML = "⚡ Shorter";
      contextChip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        contextChip.textContent = "⏳...";
        chrome.runtime.sendMessage(
          {
            type: "TRANSFORM",
            text: primaryText,
            transformation: "shorter",
            profile: getEffectiveProfile(APP, currentContactRole),
            app: APP
          },
          (resp) => {
            contextChip.innerHTML = "⚡ Shorter";
            if (resp && resp.ok && resp.data?.transformed) {
              data.primary = { text: resp.data.transformed, label: "⚡ Punchy" };
              renderSuggestions(data);
            }
          }
        );
      };
      actionFooter.appendChild(contextChip);
    }

    wrap.appendChild(actionFooter);
    panel.appendChild(wrap);
  }

  // Render Rewritten Variations (✍️ Rewrite Draft with "✨ Make it sound like me")
  function renderRewrites(data, originalDraft) {
    panel.innerHTML = "";
    panel.appendChild(renderHeader());
    panel.appendChild(renderModeSwitcher());
    panel.appendChild(renderContextToolbar());

    const draftPreview = document.createElement("div");
    draftPreview.className = "draft-preview";

    const draftHeader = document.createElement("div");
    draftHeader.className = "draft-preview-header";

    const draftLabel = document.createElement("div");
    draftLabel.className = "draft-preview-label";
    draftLabel.textContent = "Current Draft:";

    const translateBtn = document.createElement("button");
    translateBtn.type = "button";
    translateBtn.className = "translate-btn";
    translateBtn.innerHTML = "<span>🌐</span> Translate to English";
    translateBtn.title = "Translate draft to fluent English and replace composer";
    translateBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const englishText = data?.english || data?.translate_to_english;
      if (englishText) {
        const ok = await insertIntoComposer(englishText);
        if (ok) {
          translateBtn.innerHTML = "<span>✓</span> Translated!";
          setTimeout(() => {
            translateBtn.innerHTML = "<span>🌐</span> Translate to English";
          }, 1500);
        }
      } else {
        translateBtn.innerHTML = "<span>⏳</span> Translating...";
        chrome.runtime.sendMessage(
          {
            type: "TRANSFORM",
            text: originalDraft,
            transformation: "translate_to_english",
            profile: getEffectiveProfile(APP, currentContactRole),
            app: APP
          },
          async (res) => {
            if (res && res.ok && res.data?.result) {
              await insertIntoComposer(res.data.result);
              translateBtn.innerHTML = "<span>✓</span> Translated!";
              setTimeout(() => {
                translateBtn.innerHTML = "<span>🌐</span> Translate to English";
              }, 1500);
            } else {
              translateBtn.innerHTML = "<span>⚠️</span> Failed";
              setTimeout(() => {
                translateBtn.innerHTML = "<span>🌐</span> Translate to English";
              }, 1500);
            }
          }
        );
      }
    };

    draftHeader.appendChild(draftLabel);
    draftHeader.appendChild(translateBtn);

    const draftText = document.createElement("div");
    draftText.className = "draft-preview-text";
    draftText.textContent = `"${originalDraft}"`;

    draftPreview.appendChild(draftHeader);
    draftPreview.appendChild(draftText);
    panel.appendChild(draftPreview);

    const list = document.createElement("div");
    list.className = "suggestions-list";

    // 9 Rewrite Modes (Sound like me, English, and Diplomatic first)
    const rewriteOptions = [
      { key: "sound_like_me", label: "✨ Make it sound like me", desc: "Your natural texting voice", text: data?.sound_like_me, special: true },
      { key: "english", label: "🌐 Translate to English", desc: "Fluent, natural English", text: data?.english || data?.translate_to_english },
      { key: "diplomatic", label: "🕊️ Diplomatic / Diffuse", desc: "Tactful de-escalation & boundaries", text: data?.diplomatic, diplomatic: true },
      { key: "confident", label: "😎 Make Confident", desc: "Direct & assertive", text: data?.confident },
      { key: "funny", label: "😂 Make Funny", desc: "Witty punchline", text: data?.funny },
      { key: "smarter", label: "🧠 Make Smarter", desc: "Articulate & clear", text: data?.smarter },
      { key: "flirty", label: "❤️ Make Flirty", desc: "Playful & teasing", text: data?.flirty },
      { key: "professional", label: "💼 Make Professional", desc: "Clean & respectful", text: data?.professional },
      { key: "grammar", label: "🔤 Fix Grammar", desc: "Spelling & flow", text: data?.grammar }
    ];

    for (const opt of rewriteOptions) {
      if (!opt.text) continue;

      const card = document.createElement("div");
      card.className = `suggestion-card ${opt.special ? "sound-like-me" : ""} ${opt.diplomatic ? "diplomatic-card" : ""}`;

      const cardHeader = document.createElement("div");
      cardHeader.className = "card-header";

      const titleGroup = document.createElement("div");
      titleGroup.className = "tone-title-group";

      const badge = document.createElement("span");
      badge.className = `tone-badge ${opt.diplomatic ? "badge-diplomatic" : ""}`;
      badge.textContent = opt.label;

      const desc = document.createElement("span");
      desc.className = "tone-desc";
      desc.textContent = opt.desc;

      titleGroup.appendChild(badge);
      titleGroup.appendChild(desc);

      const statusBadge = document.createElement("span");
      statusBadge.className = "card-status-badge";

      cardHeader.appendChild(titleGroup);
      cardHeader.appendChild(statusBadge);

      let currentCardText = opt.text;
      const textDiv = document.createElement("div");
      textDiv.className = "suggestion-text";
      textDiv.textContent = currentCardText;

      card.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const success = await insertIntoComposer(currentCardText);
        if (success) {
          statusBadge.className = "card-status-badge";
          statusBadge.textContent = "✓ Replaced";
          setTimeout(() => (statusBadge.textContent = ""), 1200);
        } else {
          statusBadge.className = "card-status-badge error";
          statusBadge.textContent = "Replace failed";
          setTimeout(() => (statusBadge.textContent = ""), 1500);
        }
      });

      card.appendChild(cardHeader);
      card.appendChild(textDiv);

      list.appendChild(card);
    }

    panel.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "panel-footer";

    const reRewriteBtn = document.createElement("button");
    reRewriteBtn.className = "footer-btn";
    reRewriteBtn.type = "button";
    reRewriteBtn.innerHTML = "↻ Re-transform";
    reRewriteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fetchAndShowRewrites(originalDraft);
    };

    const clearBtn = document.createElement("button");
    clearBtn.className = "footer-btn";
    clearBtn.type = "button";
    clearBtn.innerHTML = "Clear";
    clearBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isClean = await clearComposer();
      if (isClean) {
        clearBtn.className = "footer-btn success";
        clearBtn.textContent = "✓ Cleared";
        setTimeout(() => {
          clearBtn.className = "footer-btn";
          clearBtn.textContent = "Clear";
          renderDraftEmptyPrompt();
        }, 1200);
      }
    };

    footer.appendChild(reRewriteBtn);
    footer.appendChild(clearBtn);
    panel.appendChild(footer);
  }

  // =========================================================
  // NETWORK & CONTROL LOGIC (Phase 3 Adaptive Synthesis)
  // =========================================================

  async function fetchAndShowSuggestions(isAutoTrigger = false, forcedAngle = null) {
    if (isGenerating && !isAutoTrigger) return;
    isGenerating = true;

    const thisRequestId = ++currentRequestId;
    const targetConvId = currentConversationId;
    const activeAngle = forcedAngle || REGEN_ANGLES[currentAngleIndex] || "balanced";

    renderLoading("Analyzing context & synthesizing your voice...");
    console.log(`[ComUcate] Request started (angle: ${activeAngle})...`);

    const startTime = Date.now();
    const messages = getLastMessages();

    if (!messages || messages.length === 0) {
      isGenerating = false;
      renderEmptyConversationPrompt();
      return;
    }

    const snapshot = createContextSnapshot(messages, targetConvId);
    currentActiveSnapshot = snapshot;
    currentContextVersion = snapshot.contextVersion;
    currentLatestIncomingId = snapshot.latestIncomingId;

    const context = inferConversationContext(messages, APP);
    context.contactRole = currentContactRole;

    const currentDraft = (getComposerText() || "").trim();

    chrome.runtime.sendMessage(
      {
        type: "SUGGEST",
        messages,
        app: APP,
        profile: getEffectiveProfile(APP, currentContactRole),
        learnedProfile: getFilteredLearnedProfile(learnedProfile, currentContactRole),
        context,
        variationAngle: activeAngle,
        draft: currentDraft,
        snapshot: {
          conversationId: snapshot.conversationId,
          latestMessageId: snapshot.latestMessageId,
          latestIncomingId: snapshot.latestIncomingId,
          contextVersion: snapshot.contextVersion,
          requestId: thisRequestId
        }
      },
      (response) => {
        isGenerating = false;

        // 1. Request ID check
        if (thisRequestId !== currentRequestId) {
          console.log("[ComUcate Stale Protection] Discarded response: requestId mismatch", { thisRequestId, currentRequestId });
          return;
        }

        // 2. Active conversation check
        const liveConvId = getActiveConversationId();
        if (liveConvId !== targetConvId) {
          console.log("[ComUcate Stale Protection] Discarded response: conversation changed", { target: targetConvId, now: liveConvId });
          return;
        }

        // 3. New message arrival check during in-flight generation
        const liveMessages = getLastMessages();
        const liveSnapshot = createContextSnapshot(liveMessages, liveConvId);
        if (liveSnapshot.contextVersion !== snapshot.contextVersion || liveSnapshot.latestIncomingId !== snapshot.latestIncomingId) {
          console.log("[ComUcate Stale Protection] Discarded response: new message appeared during generation! Re-generating for latest context...", {
            oldIncoming: snapshot.latestIncomingId,
            newIncoming: liveSnapshot.latestIncomingId
          });
          cachedSuggestions = null;
          cachedSnapshot = null;
          if (isPanelOpen) {
            fetchAndShowSuggestions(true);
          }
          return;
        }

        const totalMs = Date.now() - startTime;
        lastRoundtripMs = totalMs;

        if (chrome.runtime.lastError) {
          console.error("[ComUcate] Runtime error:", chrome.runtime.lastError.message);
          renderOfflineFallback(messages, chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.ok) {
          console.error("[ComUcate] Server error:", response?.error);
          renderOfflineFallback(messages, response?.error || "Server unreachable");
          return;
        }

        const timings = response.data?.timings;
        if (timings?.serverMs) console.log(`[ComUcate] server request: ${timings.serverMs} ms`);
        if (timings?.aiMs) console.log(`[ComUcate] Gemini request: ${timings.aiMs} ms`);
        console.log(`[ComUcate] total: ${totalMs} ms`);

        cachedSuggestions = response.data;
        cachedSnapshot = snapshot;
        if (currentMode === "suggest") {
          renderSuggestions(response.data);
        }
      }
    );
  }

  async function fetchAndShowRewrites(draftText) {
    if (!draftText) {
      renderDraftEmptyPrompt();
      return;
    }

    if (isGenerating) return;
    isGenerating = true;

    renderLoading("Rewriting draft in your personal style...");
    console.log("[ComUcate] rewrite request started");

    const startTime = Date.now();
    const messages = getLastMessages();
    const context = inferConversationContext(messages, APP);
    context.contactRole = currentContactRole;

    chrome.runtime.sendMessage(
      {
        type: "REWRITE",
        draft: draftText,
        messages,
        app: APP,
        profile: getEffectiveProfile(APP, currentContactRole),
        learnedProfile: getFilteredLearnedProfile(learnedProfile, currentContactRole),
        context
      },
      (response) => {
        isGenerating = false;
        const totalMs = Date.now() - startTime;

        if (chrome.runtime.lastError) {
          console.error("[ComUcate] Runtime error:", chrome.runtime.lastError.message);
          renderError("Failed to communicate with ComUcate background worker.", () => fetchAndShowRewrites(draftText));
          return;
        }

        if (!response || !response.ok) {
          console.error("[ComUcate] Server error:", response?.error);
          renderError(response?.error || "Could not rewrite draft.", () => fetchAndShowRewrites(draftText));
          return;
        }

        const timings = response.data?.timings;
        if (timings?.serverMs) console.log(`[ComUcate] rewrite server request: ${timings.serverMs} ms`);
        if (timings?.aiMs) console.log(`[ComUcate] Gemini rewrite: ${timings.aiMs} ms`);
        console.log(`[ComUcate] rewrite total: ${totalMs} ms`);

        cachedRewrites = response.data;
        lastRewrittenDraft = draftText;
        currentMode = "rewrite";
        renderRewrites(response.data, draftText);
      }
    );
  }

  function renderEmptyConversationPrompt() {
    panel.innerHTML = "";
    panel.appendChild(renderHeader("New Conversation"));
    panel.appendChild(renderModeSwitcher());
    panel.appendChild(renderContextToolbar());

    const isHinglish = (userProfile.language || "Hinglish").toLowerCase().includes("hinglish");
    const starters = isHinglish
      ? [
          { label: "✨ Warm Check-in", text: "Hey! Kaisa chal raha hai sab? Kafi time ho gaya baat kiye." },
          { label: "⚡ Quick Question", text: "Hey! Ek quick sawaal tha jab bhi free ho batana." },
          { label: "☕ Catch-up / Plans", text: "Hey! Kya scene hai aajkal? Milte hain soon!" }
        ]
      : [
          { label: "✨ Friendly Check-in", text: "Hey! Hope you're having a great week, wanted to check in." },
          { label: "⚡ Quick Question", text: "Hey! Quick question whenever you have a minute." },
          { label: "☕ Catch-up", text: "Hey! Been a while, let's catch up soon!" }
        ];

    const list = document.createElement("div");
    list.className = "suggestions-list";

    for (const opt of starters) {
      const card = document.createElement("div");
      card.className = "suggestion-card";

      const cardHeader = document.createElement("div");
      cardHeader.className = "card-header";
      cardHeader.innerHTML = `
        <div class="tone-title-group">
          <span class="tone-badge badge-agree">${opt.label}</span>
        </div>
        <span class="card-status-badge"></span>
      `;

      const textDiv = document.createElement("div");
      textDiv.className = "suggestion-text";
      textDiv.textContent = opt.text;

      card.appendChild(cardHeader);
      card.appendChild(textDiv);

      card.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await insertIntoComposer(opt.text);
        const badge = card.querySelector(".card-status-badge");
        if (badge) {
          badge.className = "card-status-badge";
          badge.textContent = "✓ Inserted";
          setTimeout(() => (badge.textContent = ""), 1200);
        }
      };

      list.appendChild(card);
    }

    panel.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "panel-footer";

    const scanBtn = document.createElement("button");
    scanBtn.className = "footer-btn";
    scanBtn.type = "button";
    scanBtn.textContent = "↻ Scan Messages Again";
    scanBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fetchAndShowSuggestions();
    };

    footer.appendChild(scanBtn);
    panel.appendChild(footer);
  }

  function openPanel() {
    updateTheme();
    ensureHostMounted();
    isPanelOpen = true;
    panel.style.display = "flex";
    panel.classList.add("open");

    let currentDraft = "";
    try {
      currentDraft = getComposerText();
    } catch (_) {}

    if (currentDraft && currentDraft.length > 2) {
      currentMode = "rewrite";
      if (cachedRewrites && lastRewrittenDraft === currentDraft) {
        renderRewrites(cachedRewrites, currentDraft);
      } else {
        fetchAndShowRewrites(currentDraft);
      }
    } else {
      currentMode = "suggest";
      const liveMessages = getLastMessages();
      const liveSnap = createContextSnapshot(liveMessages, getActiveConversationId());

      if (
        cachedSuggestions &&
        cachedSnapshot &&
        cachedSnapshot.contextVersion === liveSnap.contextVersion &&
        cachedSnapshot.latestIncomingId === liveSnap.latestIncomingId &&
        cachedSnapshot.conversationId === liveSnap.conversationId
      ) {
        console.log("[ComUcate] Context snapshot matching, rendering valid cached suggestions.");
        renderSuggestions(cachedSuggestions);
      } else {
        console.log("[ComUcate] Context changed or no cache. Fetching fresh suggestions...", {
          cachedVer: cachedSnapshot?.contextVersion,
          liveVer: liveSnap.contextVersion
        });
        cachedSuggestions = null;
        cachedSnapshot = null;
        fetchAndShowSuggestions();
      }
    }
  }

  function closePanel() {
    isPanelOpen = false;
    panel.style.display = "none";
    panel.classList.remove("open");
    if (typeof resetIdleTimer === "function") {
      resetIdleTimer();
    }
  }

  function togglePanel() {
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  let lastToggleTime = 0;
  function handleButtonClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    // Ignore click if the user was dragging the floating button
    if (hasMoved || now - justDraggedTime < 350 || now - lastToggleTime < 250) {
      return;
    }
    lastToggleTime = now;
    console.log(`[ComUcate] Action button triggered! Toggling panel (was open: ${isPanelOpen})`);
    togglePanel();
  }

  btn.addEventListener("click", handleButtonClick);

  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  panel.addEventListener("pointerup", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", (e) => {
    if (!isPanelOpen) return;
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.includes(host) || path.includes(btn) || path.includes(panel) || path.includes(container)) {
      return;
    }
    if (e.target === host || (host && host.contains && host.contains(e.target))) {
      return;
    }
    closePanel();
  });

  document.addEventListener("keydown", (e) => {
    if (typeof resetIdleTimer === "function") resetIdleTimer();

    // Alt+D or Option+D to toggle Diagnostics HUD
    if (e.altKey && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
      e.preventDefault();
      if (!isPanelOpen) {
        openPanel();
      }
      toggleDiagnosticsModal();
      return;
    }

    // Alt+C or Option+C to toggle suggestions panel
    if (e.altKey && (e.key === "c" || e.key === "C" || e.code === "KeyC")) {
      e.preventDefault();
      togglePanel();
      return;
    }

    // Escape closes open panel
    if (e.key === "Escape" && isPanelOpen) {
      e.preventDefault();
      closePanel();
      hideGhostPill();
      return;
    }

    // Tab key inside composer to accept Ghost Autocomplete OR top suggestion
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const adapter = getActiveAdapter();
      const composer = adapter && typeof adapter.getComposer === "function" ? adapter.getComposer() : null;
      const activeEl = document.activeElement;
      const isComposerFocused = composer && (activeEl === composer || (composer.contains && composer.contains(activeEl)));

      if (isComposerFocused) {
        // Priority 1: Ghost completion active
        if (activeGhostCompletion) {
          e.preventDefault();
          e.stopPropagation();
          acceptGhostCompletion();
          return;
        }

        // Priority 2: Empty composer + cached suggestions
        const currentDraft = adapter.getComposerText ? adapter.getComposerText() : "";
        if (!currentDraft.trim() && cachedSuggestions) {
          const topReply = cachedSuggestions.agree || cachedSuggestions.natural;
          if (topReply) {
            e.preventDefault();
            e.stopPropagation();
            insertIntoComposer(topReply);
            if (isPanelOpen) closePanel();
            return;
          }
        }
      }
    }

    // Right Arrow accepts ghost completion if active
    if (e.key === "ArrowRight" && activeGhostCompletion && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const adapter = getActiveAdapter();
      const composer = adapter && typeof adapter.getComposer === "function" ? adapter.getComposer() : null;
      const activeEl = document.activeElement;
      const isComposerFocused = composer && (activeEl === composer || (composer.contains && composer.contains(activeEl)));
      if (isComposerFocused) {
        e.preventDefault();
        e.stopPropagation();
        acceptGhostCompletion();
        return;
      }
    }

    // Escape or Backspace hides ghost pill
    if (e.key === "Escape" || e.key === "Backspace") {
      hideGhostPill();
    }

    // Quick Keys 1, 2, 3 to insert suggestions when panel is open
    if (isPanelOpen && (e.key === "1" || e.key === "2" || e.key === "3") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const activeEl = document.activeElement;
      const inPanel = host && host.contains && host.contains(activeEl);
      if (!inPanel) {
        const idx = parseInt(e.key, 10) - 1;
        const optionsList = cachedSuggestions
          ? [
              cachedSuggestions.primary?.text || cachedSuggestions.agree || cachedSuggestions.natural,
              cachedSuggestions.alternatives?.[0]?.text || cachedSuggestions.decline || cachedSuggestions.playful,
              cachedSuggestions.alternatives?.[1]?.text || cachedSuggestions.clarify || cachedSuggestions.keep_going
            ]
          : [];
        const chosen = cachedSuggestions?.suggestions?.[idx]?.text || optionsList[idx];
        if (chosen) {
          e.preventDefault();
          e.stopPropagation();
          insertIntoComposer(chosen);
          closePanel();
          return;
        }
      }
    }
  });

  // =========================================================
  // 👻 Feature 2: Ghost Text / Inline Tab Autocomplete
  // =========================================================
  let ghostPillEl = null;
  let activeGhostCompletion = "";
  let ghostFetchTimeout = null;

  function ensureGhostPill() {
    if (ghostPillEl && document.body.contains(ghostPillEl)) return ghostPillEl;
    ghostPillEl = document.createElement("div");
    ghostPillEl.id = "comucate-ghost-pill";
    ghostPillEl.className = "hidden";
    ghostPillEl.innerHTML = `
      <span class="ghost-text-content"></span>
      <span class="ghost-tab-badge">Tab ⇥</span>
    `;
    ghostPillEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      acceptGhostCompletion();
    });
    document.body.appendChild(ghostPillEl);
    return ghostPillEl;
  }

  function hideGhostPill() {
    if (ghostPillEl) {
      ghostPillEl.classList.add("hidden");
      ghostPillEl.style.display = "none";
    }
    activeGhostCompletion = "";
  }

  function showGhostPill(completion, anchorEl) {
    if (!completion || !anchorEl) {
      hideGhostPill();
      return;
    }
    const pill = ensureGhostPill();
    activeGhostCompletion = completion;
    const content = pill.querySelector(".ghost-text-content");
    if (content) content.textContent = completion;

    const rect = anchorEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideGhostPill();
      return;
    }

    let top = rect.top - 38;
    let left = rect.left + 12;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      try {
        const range = sel.getRangeAt(0).cloneRange();
        const clientRects = range.getClientRects();
        if (clientRects.length > 0) {
          const caretRect = clientRects[clientRects.length - 1];
          if (caretRect.top > 0) {
            top = caretRect.top - 36;
            left = Math.min(caretRect.right + 8, window.innerWidth - 320);
          }
        }
      } catch (_) {}
    }

    if (top < 10) top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;

    pill.style.top = `${Math.round(top)}px`;
    pill.style.left = `${Math.round(left)}px`;
    pill.style.display = "flex";
    pill.classList.remove("hidden");
  }

  async function acceptGhostCompletion() {
    if (!activeGhostCompletion) return false;
    const completionToInsert = activeGhostCompletion;
    hideGhostPill();

    const adapter = getActiveAdapter();
    const currentDraft = (adapter && typeof adapter.getComposerText === "function" ? adapter.getComposerText() : "") || "";
    const needsSpace = currentDraft.length > 0 && !currentDraft.endsWith(" ") && !completionToInsert.startsWith(" ");
    const fullText = currentDraft + (needsSpace ? " " : "") + completionToInsert;
    return await insertIntoComposer(fullText);
  }

  function triggerGhostAutocomplete() {
    clearTimeout(ghostFetchTimeout);
    const adapter = getActiveAdapter();
    if (!adapter) return;
    const composer = adapter.getComposer ? adapter.getComposer() : null;
    if (!composer || isSensitiveField(composer)) {
      hideGhostPill();
      return;
    }

    const draft = adapter.getComposerText ? adapter.getComposerText() : "";
    if (!draft || draft.trim().length < 3 || draft.endsWith("//") || isPanelOpen) {
      hideGhostPill();
      return;
    }

    ghostFetchTimeout = setTimeout(() => {
      const sanitizedDraft = redactSensitiveTokens(draft);
      const messages = getLastMessages().slice(-3);
      const profile = getEffectiveProfile(APP, currentContactRole);

      chrome.runtime.sendMessage(
        {
          type: "AUTOCOMPLETE",
          draft: sanitizedDraft,
          messages,
          app: APP,
          profile,
          context: {
            app: APP,
            contactRole: currentContactRole
          }
        },
        (res) => {
          if (res && res.ok && res.data?.completion) {
            const currentNow = adapter.getComposerText ? adapter.getComposerText() : "";
            if (currentNow.trim() === draft.trim()) {
              showGhostPill(res.data.completion, composer);
            }
          } else {
            hideGhostPill();
          }
        }
      );
    }, 320);
  }

  // Inline // trigger & Ghost Text trigger inside composer
  document.addEventListener(
    "input",
    () => {
      const adapter = getActiveAdapter();
      if (!adapter) return;
      const text = adapter.getComposerText ? adapter.getComposerText() : "";
      if (text === "//" || text.endsWith(" //")) {
        hideGhostPill();
        adapter.clearComposer().then(() => {
          if (!isPanelOpen) openPanel();
        });
      } else {
        triggerGhostAutocomplete();
      }
    },
    true
  );

  // Click outside composer hides ghost text
  document.addEventListener("click", (e) => {
    const adapter = getActiveAdapter();
    const composer = adapter?.getComposer ? adapter.getComposer() : null;
    if (ghostPillEl && !ghostPillEl.contains(e.target) && composer && !composer.contains(e.target)) {
      hideGhostPill();
    }
  });

  updateWidgetVisibility();
  console.log(`[ComUcate v4.2] Ready on ${APP} (Adapter: ${getActiveAdapter().name})`);
})();