# ✨ ComUcate — Adaptive AI Communication Companion (v4.2)

> A personal communication companion for **WhatsApp Web, Instagram DMs, Telegram Web, Discord Web, LinkedIn Messaging, Microsoft Teams, and Gmail / Mail Writing** that learns how you actually write and adapts to your natural voice, slang, language mix, and texting flow across every app.

---

## 🚀 What's New in v4.2

1. **🛡️ Client-Side Privacy Scrubber (Zero-Leak Security)**: Automatically scrubs phone numbers, email addresses, UPI handles, crypto wallet addresses, passwords, OTPs, credit cards, SSNs, and API keys *before* any text leaves your browser.
2. **👻 Ghost Text / Inline Tab Autocomplete**: Ultra-fast inline completions (3-7 words) rendered via a non-intrusive floating overlay pill. Press **Tab ⇥** or **→** to accept smoothly without crashing React/Lexical editors.
3. **🌡️ Vibe Check (Incoming Emotional Subtext)**: Automatically identifies incoming emotional cues (*Urgent / High-Pressure, Cold / Passive-Aggressive, Playful / Teasing, Frustrated / Venting, Warm / Appreciative, Formal / Business, Curious / Engaged*) and offers actionable conversational advice.
4. **🕊️ Diplomatic De-Escalator (Conflict Diffuser)**: A dedicated tactful rewrite mode designed to diffuse friction, de-escalate tension, and establish calm boundaries with high emotional intelligence.
5. **🌐 Quick Language & Script Toggle in Toolbar**: Instant one-click switching between `[🌐 Hinglish]`, `[🇬🇧 English]`, and `[🇮🇳 Hindi]` directly in the chat panel with persistent sync.
6. **🎙️ WhatsApp / Instagram Voice Note Quick Responder**: Automatically detects incoming voice notes and presents instant high-EQ acknowledgment options ("Can't listen right now, in a meeting", etc.).

---

## 🌐 Supported Apps Ecosystem

ComUcate works seamlessly across your entire messaging and workplace communication stack:
1. **WhatsApp Web** (`web.whatsapp.com`) — Draft.js selection-safe insertion & conversation tracking
2. **Instagram Web** (`instagram.com/direct`) — Native Lexical editor MAIN-world bridge & SPA sync
3. **Telegram Web** (`web.telegram.org/k/` & `web.telegram.org/a/`) — Support for both K and A/Z versions
4. **Discord Web** (`discord.com/channels`) — Slate editor insertion & channel message scraping
5. **LinkedIn Messaging** (`linkedin.com/messaging`) — ArtDeco contenteditable & professional networking context
6. **Microsoft Teams** (`teams.microsoft.com`, `teams.live.com`) — CKEditor integration & workplace collaboration context
7. **Gmail / Mail Writing** (`mail.google.com`) — Email composer integration & thread context
8. **Universal Fallback** — Any active `contenteditable`, `textarea`, or `input` on supported pages

---

## 🎯 Adaptive Voice + Multi-App Adaptation

ComUcate combines **Explicit Preferences** with **Automatic Behavioral Learning** and **Platform Environment Awareness**:

```text
My Base Voice (Explicit Preferences)
      +
Learned Writing Style (Adaptive Voice)
      +
Current Conversation Context & Tone
      +
Platform Environment (LinkedIn vs Teams vs Discord vs WhatsApp vs Gmail)
      +
Requested Mode (Quick Reply vs Rewrite Draft)
      +
Current Draft (if any)
      ↓
ComUcate Authentic Response
```

> **"Don't just write a good reply. Write the reply I would naturally send."**

---

### 1. Layer 1: My Base Voice (Explicit Preferences)
You manually define your preferred baseline in the popup:
- **Personality Presets:** Confident + Funny, Smart + Casual, Flirty + Playful, Direct + Fast, Professional, Custom.
- **Language / Script:** Hinglish (Roman script), English (Casual), etc.
- **Slang & Signature Words:** `bhai, haan, acha, lol, 😭, sahi hai, yaar`.
- **Length, Humor & Emoji Settings.**

### 2. Layer 2: Adaptive Voice (Automatic Learning)
ComUcate continuously analyzes **ONLY messages written by you** (`from === 'me'`):
- **Analyzes non-sensitive patterns:** Average message length, sentence counts, lowercase opening preference, punctuation habits (minimal vs formal), signature emojis, and code-switching / Hinglish frequency.
- **Privacy First:** Zero raw conversation history is stored—only compact statistical profiles in `chrome.storage.local`. Client-side regex scrubber scrubs all PII.
- **Anti-Overfitting:** Uses weighted rolling updates so a single unusual message never destabilizes your profile.
- **Full User Control:** Pause, resume, or reset your learned profile anytime from the extension popup.

### 3. Layer 3: Automatic Communication Context
ComUcate reads situational signals from the active chat:
- **Tone Detection:** Detects serious/medical/conflict topics (tempering jokes and prioritizing sincere empathy) vs playful/banter vs casual.
- **Length Mirroring:** Adapts reply lengths to match the natural flow of the conversation.
- **Ending Detection:** Identifies conversational closure ("bye", "goodnight", "take care").

---

## ⚡ Action Modes

### 1. ✨ Quick Reply Mode (Composer is Empty)
Generates 3 contextual replies synthesized through your base and learned voice:
- **Direct Reply / Agree**: What you would most authentically say next.
- **Alternative / Decline**: Graceful pass, deferral, or counter-perspective.
- **Clarify / Deepen**: Adds an engaging question or hook to keep the chat moving.

### 2. ✍️ Rewrite Draft Mode (Composer Contains Text)
Transforms your rough draft into **9 tailored variations**:
- ✨ **Make it sound like me**: Matches your exact learned texting style, slang, sentence length, lowercase flow, and vocabulary.
- 🌐 **Translate to English**: Fluent, natural modern English translation retaining tone and intent.
- 🕊️ **Diplomatic / Diffuse**: Tactful de-escalation that diffuses tension and sets calm boundaries.
- 😎 **Make Confident**: Direct and assertive, removing hesitation or apologies.
- 😂 **Make Funny**: Adds a witty punchline or banter.
- 🧠 **Make Smarter**: Articulate, clear, and thoughtful.
- ❤️ **Make Flirty**: Charming and playful.
- 💼 **Make Professional**: Clean and workplace-appropriate.
- 🔤 **Fix Grammar**: Fixes spelling & flow while preserving your casual slang and casing.

---

## 🧩 Architecture

```
ComUcate/
│
├── extension/
│   ├── icons/                   # 16, 48, 128 px PNG icons
│   ├── manifest.json            # Manifest V3 (v3.0.0)
│   ├── instagram-bridge.js      # MAIN-world script accessing Instagram Lexical editor & SPA router
│   ├── content.js               # Platform Adapters, StyleLearner, Context Engine, Shadow DOM
│   ├── content.css              # Isolated UI styles & special sound-like-me card styling
│   ├── background.js            # Service worker passing profile, learnedProfile, and context
│   ├── popup.html               # "My Voice" Studio & Adaptive Voice controls
│   ├── popup.js                 # Base preferences & adaptive learning controls
│   └── popup.css                # Popup styling
│
└── server/
    ├── index.js                 # Express server with Phase 3 Hierarchical System Prompt
    ├── package.json             # Express, Dotenv, Anthropic SDK
    ├── .env.example             # Environment variable template
    └── .env                     # Your local API keys (never exposed to extension)
```

---

## 🚀 Quick Start Guide

### 1. Launch the Server
```bash
./start.sh
```

### 2. Load / Refresh the Extension
1. Go to `chrome://extensions`.
2. Toggle on **Developer mode** and click the **Refresh (🔄)** icon on **ComUcate**.

### 3. Chat with Your Adaptive Voice
1. Open any supported app:
   - [WhatsApp Web](https://web.whatsapp.com)
   - [Instagram DMs](https://www.instagram.com/direct/)
   - [Telegram Web](https://web.telegram.org)
   - [Discord Web](https://discord.com/app)
   - [LinkedIn Messaging](https://www.linkedin.com/messaging/)
   - [Microsoft Teams](https://teams.microsoft.com)
   - [Gmail](https://mail.google.com)
2. As you send messages, ComUcate learns your natural pacing and vocabulary.
3. Click the **✨** button to get suggestions or rewrite your drafts with **✨ Make it sound like me**!
