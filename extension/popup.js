const DEFAULT_SERVER_URL = "http://localhost:3000";

const PRESETS = {
  "Confident + Funny": {
    language: "Hinglish",
    replyLength: "medium",
    humor: "high",
    emojiUsage: "occasional",
    flirting: true,
    commonPhrases: "bhai, haan, acha, lol, 😭, sahi hai, yaar"
  },
  "Smart + Casual": {
    language: "English (Casual)",
    replyLength: "medium",
    humor: "medium",
    emojiUsage: "occasional",
    flirting: false,
    commonPhrases: "makes sense, totally, yeah, got it, fair enough"
  },
  "Flirty + Playful": {
    language: "Hinglish",
    replyLength: "medium",
    humor: "high",
    emojiUsage: "occasional",
    flirting: true,
    commonPhrases: "haha, hmm, acha ji, drama, 😭, 💀, tell me more"
  },
  "Direct + Fast": {
    language: "English (Casual)",
    replyLength: "short",
    humor: "none",
    emojiUsage: "none",
    flirting: false,
    commonPhrases: "sure, sounds good, on it, done, cool"
  },
  "Professional + Polite": {
    language: "English (US)",
    replyLength: "short",
    humor: "none",
    emojiUsage: "none",
    flirting: false,
    commonPhrases: "appreciate it, let's sync up, on it, sounds good, thanks, will look into this"
  },
  "Professional + Friendly": {
    language: "English (US)",
    replyLength: "medium",
    humor: "low",
    emojiUsage: "none",
    flirting: false,
    commonPhrases: "appreciate it, let's sync, sounds like a plan, thanks, please let me know"
  },
  "Friendly + Casual": {
    language: "Hinglish",
    replyLength: "short",
    humor: "medium",
    emojiUsage: "occasional",
    flirting: false,
    commonPhrases: "haan, bhai, sahi hai, chal, done, theek hai, mast"
  }
};

const PLATFORM_DEFAULTS = {
  teams: {
    personalityPreset: "Professional + Polite",
    language: "English (US)",
    replyLength: "short",
    humor: "low",
    emojiUsage: "none",
    flirting: false,
    commonPhrases: "sounds good, let's sync up, on it, thanks, will look into this, appreciate it"
  },
  linkedin: {
    personalityPreset: "Professional + Polite",
    language: "English (US)",
    replyLength: "medium",
    humor: "none",
    emojiUsage: "none",
    flirting: false,
    commonPhrases: "appreciate it, thanks for reaching out, great to connect, let's discuss, looking forward"
  },
  gmail: {
    personalityPreset: "Professional + Friendly",
    language: "English (US)",
    replyLength: "medium",
    humor: "low",
    emojiUsage: "none",
    flirting: false,
    commonPhrases: "thanks, best regards, please let me know, sounds like a plan"
  },
  instagram: {
    personalityPreset: "Confident + Funny",
    language: "Hinglish",
    replyLength: "short",
    humor: "high",
    emojiUsage: "occasional",
    flirting: true,
    commonPhrases: "haha, lol, bhai, acha, 😭, sahi hai, yaar, kya scene"
  },
  whatsapp: {
    personalityPreset: "Friendly + Casual",
    language: "Hinglish",
    replyLength: "short",
    humor: "medium",
    emojiUsage: "occasional",
    flirting: false,
    commonPhrases: "haan, bhai, sahi hai, chal, done, theek hai, mast"
  },
  discord: {
    personalityPreset: "Direct + Fast",
    language: "English (Casual)",
    replyLength: "short",
    humor: "medium",
    emojiUsage: "occasional",
    flirting: false,
    commonPhrases: "gg, cool, bet, on it, fr, makes sense"
  },
  telegram: {
    personalityPreset: "Direct + Fast",
    language: "English (Casual)",
    replyLength: "short",
    humor: "low",
    emojiUsage: "occasional",
    flirting: false,
    commonPhrases: "sure, got it, done, cool, on it"
  },
  global: {
    personalityPreset: "Confident + Funny",
    language: "Hinglish",
    replyLength: "short",
    humor: "high",
    emojiUsage: "occasional",
    flirting: true,
    commonPhrases: "bhai, haan, acha, lol, 😭, sahi hai"
  }
};

const DEFAULT_PROFILE = {
  personalityPreset: "Confident + Funny",
  ...PRESETS["Confident + Funny"]
};

const DEFAULT_LEARNED_PROFILE = {
  enabled: true,
  messageCount: 0,
  avgMessageLength: 0,
  lowercaseRatio: 0,
  minimalPunctuationRatio: 0,
  emojiFrequency: "none",
  topEmojis: [],
  topPhrases: [],
  codeSwitching: "none",
  lastUpdated: null
};

// UI Elements: Tabs
const tabVoiceBtn = document.getElementById("tabVoiceBtn");
const tabSettingsBtn = document.getElementById("tabSettingsBtn");
const tabVoiceContent = document.getElementById("tabVoiceContent");
const tabSettingsContent = document.getElementById("tabSettingsContent");

// UI Elements: Platform Auto-Adapt Controls
const autoAdaptToggle = document.getElementById("autoAdaptToggle");
const platformSelector = document.getElementById("platformSelector");
const activeAppBadge = document.getElementById("activeAppBadge");
const platformNoticeText = document.getElementById("platformNoticeText");
const resetPlatformBtn = document.getElementById("resetPlatformBtn");

// UI Elements: Base Voice Profile
const personalityPreset = document.getElementById("personalityPreset");
const languageSelect = document.getElementById("languageSelect");
const replyLengthSelect = document.getElementById("replyLengthSelect");
const humorSelect = document.getElementById("humorSelect");
const emojiSelect = document.getElementById("emojiSelect");
const flirtingToggle = document.getElementById("flirtingToggle");
const commonPhrases = document.getElementById("commonPhrases");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileSaveStatus = document.getElementById("profileSaveStatus");

// UI Elements: Adaptive Voice
const learningStatusPill = document.getElementById("learningStatusPill");
const learnedCountText = document.getElementById("learnedCountText");
const learnedUpdatedText = document.getElementById("learnedUpdatedText");
const toggleLearningBtn = document.getElementById("toggleLearningBtn");
const resetLearnedBtn = document.getElementById("resetLearnedBtn");
const adaptiveStatusText = document.getElementById("adaptiveStatusText");

// UI Elements: Connection
const statusBanner = document.getElementById("statusBanner");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const statusMeta = document.getElementById("statusMeta");
const serverUrlInput = document.getElementById("serverUrl");
const saveServerBtn = document.getElementById("saveServerBtn");
const testBtn = document.getElementById("testBtn");
const enabledToggle = document.getElementById("enabledToggle");

let activeLearnedProfile = { ...DEFAULT_LEARNED_PROFILE };
let currentGlobalProfile = { ...DEFAULT_PROFILE };
let currentPlatformProfiles = {};

// Tab Switching
tabVoiceBtn.addEventListener("click", () => {
  tabVoiceBtn.classList.add("active");
  tabSettingsBtn.classList.remove("active");
  tabVoiceContent.classList.add("active");
  tabSettingsContent.classList.remove("active");
});

tabSettingsBtn.addEventListener("click", () => {
  tabSettingsBtn.classList.add("active");
  tabVoiceBtn.classList.remove("active");
  tabSettingsContent.classList.add("active");
  tabVoiceContent.classList.remove("active");
});

// Preset Selector Change
personalityPreset.addEventListener("change", () => {
  const chosen = personalityPreset.value;
  if (PRESETS[chosen]) {
    applyPresetToInputs(PRESETS[chosen]);
  }
});

function applyPresetToInputs(preset) {
  languageSelect.value = preset.language || "Hinglish";
  replyLengthSelect.value = preset.replyLength || "short";
  humorSelect.value = preset.humor || "medium";
  emojiSelect.value = preset.emojiUsage || "occasional";
  flirtingToggle.checked = Boolean(preset.flirting);
  commonPhrases.value = Array.isArray(preset.commonPhrases)
    ? preset.commonPhrases.join(", ")
    : (preset.commonPhrases || "");
}

function loadProfileIntoInputs(prof) {
  personalityPreset.value = prof.personalityPreset || "Confident + Funny";
  applyPresetToInputs(prof);
}

function getProfileFromInputs() {
  const rawPhrases = commonPhrases.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    personalityPreset: personalityPreset.value,
    language: languageSelect.value,
    replyLength: replyLengthSelect.value,
    humor: humorSelect.value,
    emojiUsage: emojiSelect.value,
    flirting: flirtingToggle.checked,
    commonPhrases: rawPhrases
  };
}

function onPlatformChange() {
  const chosen = platformSelector.value;
  if (chosen === "global") {
    loadProfileIntoInputs(currentGlobalProfile);
    resetPlatformBtn.style.display = "none";
    platformNoticeText.textContent = "Global fallback for universal sites or when auto-adapt is off.";
  } else {
    const hasCustom = Boolean(currentPlatformProfiles && currentPlatformProfiles[chosen]);
    if (hasCustom) {
      loadProfileIntoInputs(currentPlatformProfiles[chosen]);
      resetPlatformBtn.style.display = "inline";
      platformNoticeText.textContent = `Custom tone configured for ${chosen.toUpperCase()}.`;
    } else {
      const def = PLATFORM_DEFAULTS[chosen] || PLATFORM_DEFAULTS.global;
      loadProfileIntoInputs(def);
      resetPlatformBtn.style.display = "none";
      platformNoticeText.textContent = `Using smart auto-default for ${chosen.toUpperCase()}.`;
    }
  }
}

platformSelector.addEventListener("change", onPlatformChange);

autoAdaptToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ autoAdaptEnabled: autoAdaptToggle.checked });
  if (autoAdaptToggle.checked) {
    platformNoticeText.textContent = "Auto-adapt active: automatically changes tone per platform.";
  } else {
    platformNoticeText.textContent = "Auto-adapt off: always uses Global Voice everywhere.";
  }
});

// Save Preferences (Global or Per-Platform)
saveProfileBtn.addEventListener("click", () => {
  const inputProfile = getProfileFromInputs();
  const chosen = platformSelector.value;
  const autoAdapt = autoAdaptToggle.checked;

  if (chosen === "global") {
    currentGlobalProfile = inputProfile;
    chrome.storage.sync.set({ profile: currentGlobalProfile, autoAdaptEnabled: autoAdapt }, () => {
      profileSaveStatus.textContent = "✓ Global preferences saved!";
      setTimeout(() => (profileSaveStatus.textContent = ""), 1800);
    });
  } else {
    currentPlatformProfiles[chosen] = inputProfile;
    chrome.storage.sync.set({ platformProfiles: currentPlatformProfiles, autoAdaptEnabled: autoAdapt }, () => {
      profileSaveStatus.textContent = `✓ ${chosen.toUpperCase()} preferences saved!`;
      resetPlatformBtn.style.display = "inline";
      platformNoticeText.textContent = `Custom tone saved for ${chosen.toUpperCase()}.`;
      setTimeout(() => (profileSaveStatus.textContent = ""), 1800);
    });
  }
});

// Reset Platform to Default
resetPlatformBtn.addEventListener("click", () => {
  const chosen = platformSelector.value;
  if (chosen !== "global" && currentPlatformProfiles[chosen]) {
    delete currentPlatformProfiles[chosen];
    chrome.storage.sync.set({ platformProfiles: currentPlatformProfiles }, () => {
      onPlatformChange();
      profileSaveStatus.textContent = `✓ Reset ${chosen.toUpperCase()} to smart default!`;
      setTimeout(() => (profileSaveStatus.textContent = ""), 1800);
    });
  }
});

// Update Adaptive Voice UI
function updateAdaptiveUI(learned) {
  activeLearnedProfile = learned || { ...DEFAULT_LEARNED_PROFILE };
  const isLearning = activeLearnedProfile.enabled !== false;

  if (isLearning) {
    learningStatusPill.className = "status-pill active";
    learningStatusPill.textContent = "Active";
    toggleLearningBtn.textContent = "Pause Learning";
  } else {
    learningStatusPill.className = "status-pill paused";
    learningStatusPill.textContent = "Paused";
    toggleLearningBtn.textContent = "Resume Learning";
  }

  const count = activeLearnedProfile.messageCount || 0;
  learnedCountText.textContent = `${count} sent message${count === 1 ? "" : "s"}`;

  if (activeLearnedProfile.lastUpdated) {
    const minAgo = Math.max(0, Math.round((Date.now() - activeLearnedProfile.lastUpdated) / 60000));
    learnedUpdatedText.textContent = minAgo === 0 ? "Just now" : `${minAgo}m ago`;
  } else {
    learnedUpdatedText.textContent = "Not yet started";
  }
}

// Toggle Learning (Pause / Resume)
toggleLearningBtn.addEventListener("click", () => {
  const isCurrentlyActive = activeLearnedProfile.enabled !== false;
  activeLearnedProfile.enabled = !isCurrentlyActive;

  chrome.storage.local.set({ learnedProfile: activeLearnedProfile }, () => {
    updateAdaptiveUI(activeLearnedProfile);
    adaptiveStatusText.textContent = activeLearnedProfile.enabled ? "✓ Learning resumed" : "Learning paused";
    setTimeout(() => {
      adaptiveStatusText.textContent = "";
    }, 1500);
  });
});

// Reset Learned Style
resetLearnedBtn.addEventListener("click", () => {
  activeLearnedProfile = {
    ...DEFAULT_LEARNED_PROFILE,
    enabled: activeLearnedProfile.enabled !== false,
    lastUpdated: Date.now()
  };

  chrome.storage.local.set({ learnedProfile: activeLearnedProfile, processedMessageHashes: [] }, () => {
    updateAdaptiveUI(activeLearnedProfile);
    adaptiveStatusText.textContent = "✓ Learned style reset to baseline";
    setTimeout(() => {
      adaptiveStatusText.textContent = "";
    }, 1800);
  });
});

// Server Health Checker
async function checkHealth(url) {
  statusBanner.className = "status-banner";
  statusText.textContent = "Connecting to server...";
  statusMeta.textContent = "";

  const trimmed = url.replace(/\/+$/, "");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${trimmed}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    statusBanner.className = "status-banner connected";
    statusDot.className = "status-indicator online";
    statusText.textContent = `Online (${data.provider || "active"})`;
    statusMeta.textContent = `Model: ${data.model || "default"} | Adaptive: Ready`;
  } catch (err) {
    statusBanner.className = "status-banner error";
    statusDot.className = "status-indicator offline";
    statusText.textContent = "Server Offline";
    statusMeta.textContent = "Run './start.sh' in terminal.";
  }
}

// Save Server URL
saveServerBtn.addEventListener("click", () => {
  const rawUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  const cleanUrl = rawUrl.replace(/\/+$/, "");

  chrome.storage.sync.set({ serverUrl: cleanUrl }, () => {
    saveServerBtn.textContent = "Saved ✓";
    setTimeout(() => {
      saveServerBtn.textContent = "Save";
    }, 1200);
    checkHealth(cleanUrl);
  });
});

testBtn.addEventListener("click", () => {
  const url = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  checkHealth(url);
});

enabledToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledToggle.checked });
});

// Initialize Popup
document.addEventListener("DOMContentLoaded", () => {
  // Load Base Profile, Platform Profiles & Settings
  chrome.storage.sync.get(["serverUrl", "enabled", "profile", "autoAdaptEnabled", "platformProfiles"], (res) => {
    const url = res.serverUrl || DEFAULT_SERVER_URL;
    serverUrlInput.value = url;
    enabledToggle.checked = res.enabled !== false;
    checkHealth(url);

    autoAdaptToggle.checked = res.autoAdaptEnabled !== false;
    currentGlobalProfile = res.profile || DEFAULT_PROFILE;
    currentPlatformProfiles = res.platformProfiles || {};

    // Auto-detect current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        const u = tabs[0].url.toLowerCase();
        let detected = null;
        if (
          u.includes("teams.microsoft.com") ||
          u.includes("teams.live.com") ||
          u.includes("teams.cloud.microsoft") ||
          u.includes("teams.office.com") ||
          u.includes("teams.")
        ) {
          detected = "teams";
        } else if (u.includes("instagram.com")) {
          detected = "instagram";
        } else if (u.includes("whatsapp.com")) {
          detected = "whatsapp";
        } else if (u.includes("linkedin.com")) {
          detected = "linkedin";
        } else if (u.includes("mail.google.com")) {
          detected = "gmail";
        } else if (u.includes("discord.com")) {
          detected = "discord";
        } else if (u.includes("telegram.org")) {
          detected = "telegram";
        }

        if (detected) {
          platformSelector.value = detected;
          activeAppBadge.style.display = "inline-block";
          activeAppBadge.textContent = `Tab: ${detected.toUpperCase()}`;
        }
      }
      onPlatformChange();
    });
  });

  // Load Adaptive Voice Profile from local storage
  chrome.storage.local.get(["learnedProfile"], (res) => {
    updateAdaptiveUI(res.learnedProfile);
  });
});
