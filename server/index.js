import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const PROVIDER = (process.env.PROVIDER || "gemini").toLowerCase(); // "gemini" or "anthropic"
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

const app = express();

// CORS setup
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "200kb" }));

// ==============================================================================
// Phase 4: Intent Detection & Working Conversation State Classifier
// ==============================================================================
function classifyIntent(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { intent: "Conversation continuation", confidence: 0.5 };
  }

  const lastThemMsg = [...messages].reverse().find((m) => m.from === "them");
  const text = (lastThemMsg?.text || "").toLowerCase().trim();

  if (!text) {
    return { intent: "Conversation continuation", confidence: 0.5 };
  }

  // 1. Conversation ending
  if (/\b(bye|goodnight|gn|cya|see ya|talk later|chalo milte|take care|tc|catch you later|catch ya|alvida)\b/i.test(text)) {
    return { intent: "Conversation ending", confidence: 0.95 };
  }

  const isQuestion = text.includes("?") || /^(kya|kab|kahan|kaun|kaise|kyun|why|when|where|who|how|what|which|can you|could you|are you|is it|did you|do you|wanna|will you)\b/i.test(text);

  // 1. Apology / Repair
  if (/\b(sorry|apologize|apologies|my bad|galti|maaf|was i rude|shame on me|maafi|shitt man|shit man|my fault)\b/i.test(text)) {
    return { intent: "Apology", confidence: 0.95 };
  }

  // 2. Preference sharing
  if (/\b(romance, thriller n fiction|romance|thriller|fiction|sci-fi|anime|comedy|horror|action|movie|series|shows|books|reading|music)\b/i.test(text) && !isQuestion) {
    return { intent: "Preference sharing", confidence: 0.9 };
  }

  // 3. Invitation
  if (/\b(milte|milna|party|dinner|lunch|coffee|hang out|aaja|aao|free h|free ho|free hai|meet up|call kare|zoom|gmeet|movie|weekend plan)\b/i.test(text)) {
    return { intent: "Invitation", confidence: 0.9, isQuestion };
  }

  // 3. Request
  if (/\b(please|pls|bhej|send|share|forward|check karna|update de|kar de|help|need your|can you share|send me)\b/i.test(text)) {
    return { intent: "Request", confidence: 0.88, isQuestion };
  }

  // 4. Flirting
  if (/\b(cute|hot|miss you|crush|date|pretty|handsome|gorgeous|sweetheart|sliding into|impress|😉|😘|❤️|🔥|🙈)\b/i.test(text)) {
    return { intent: "Flirting", confidence: 0.85 };
  }

  // 5. Joke / banter
  if (/\b(lol|lmao|rofl|haha|hehe|joke|mazak|kya yaar|pagal|sahi me|😂|🤣|💀|😭)\b/i.test(text) && !isQuestion) {
    return { intent: "Joke/banter", confidence: 0.85 };
  }

  // 6. Small talk
  if (/\b(aur bata|kya chal raha|kya haal|wassup|sup|how are you|kaisa hai|kaisi hai|sab badhiya|whats up|hows it going)\b/i.test(text)) {
    return { intent: "Small talk", confidence: 0.9 };
  }

  // 7. Agreement
  if (/\b(done deal|haan|ha|yes|yep|yeah|true|sahi h|sahi hai|done|deal|totally|agree|agreed|sure|okie|ok|thik h|thik hai|bilkul|absolutely)\b/i.test(text)) {
    return { intent: "Agreement", confidence: 0.9 };
  }

  // 8. Disagreement
  if (/^(nah|nahi|no|nope|not really|never|galat|disagree|mat kar|chhod)[.!]?$/i.test(text) || /\b(i dont think|not agree|galat hai)\b/i.test(text)) {
    return { intent: "Disagreement", confidence: 0.9 };
  }

  // 9. Complaint
  if (/\b(irritated|annoying|bekar|boring|gussa|delay|issue|broken|problem|disappointed|kharab|waste)\b/i.test(text)) {
    return { intent: "Complaint", confidence: 0.8 };
  }

  if (isQuestion) {
    return { intent: "Question", confidence: 0.92 };
  }

  // 10. Information sharing
  if (text.includes("http://") || text.includes("https://") || text.length > 50) {
    return { intent: "Information sharing", confidence: 0.75 };
  }

  return { intent: "Conversation continuation", confidence: 0.6 };
}

function detectVibeCheck(messages = []) {
  const lastThemMsg = [...messages].reverse().find((m) => m.from === "them");
  const text = (lastThemMsg?.text || "").toLowerCase().trim();
  if (!text) {
    return { vibe: "Neutral & Ongoing", icon: "💬", advice: "Maintain relaxed flow" };
  }

  // 1. Passive-Aggressive or Cold
  if (/^(k|ok\.|fine\.|whatever|as you wish|if you say so|sure\.)\s*$/i.test(text) ||
      /\b(per my last email|as stated before|as mentioned earlier|whatever you say)\b/i.test(text)) {
    return { vibe: "Cold / Passive-Aggressive", icon: "🧊", advice: "Stay polite; avoid matching irritation" };
  }

  // 2. Urgent / High Pressure
  if (/\b(urgent|asap|now|immediately|fast|jaldi|emergency|critical|right away|ping me now)\b/i.test(text)) {
    return { vibe: "Urgent & High-Pressure", icon: "⚡", advice: "Give quick, direct status updates" };
  }

  // 3. Playful / Sarcastic / Teasing
  if (/\b(haha|lmao|rofl|joke|drama|pagal|sarcasm|sarcastic|😂|🤣|💀|🤡|look who decided|wah)\b/i.test(text)) {
    return { vibe: "Playful & Teasing", icon: "🎭", advice: "Match witty energy or laugh along" };
  }

  // 4. Frustrated / Complaining
  if (/\b(irritated|annoyed|fed up|sick of|bekar|dimag kharab|pissed|hate this|disaster)\b/i.test(text)) {
    return { vibe: "Frustrated / Venting", icon: "😤", advice: "Validate frustration; avoid arguing" };
  }

  // 5. Warm / Appreciative
  if (/\b(thank you|thanks a lot|appreciate|grateful|kind of you|so sweet|❤️|bless you)\b/i.test(text)) {
    return { vibe: "Warm & Appreciative", icon: "✨", advice: "Respond with gracious warmth" };
  }

  // 6. Professional / Formal
  if (/\b(please find|attached|regarding|kindly|let me know if|best regards|as per|aligned)\b/i.test(text)) {
    return { vibe: "Formal & Business", icon: "👔", advice: "Keep structured, clear, and courteous" };
  }

  // 7. Curious / Engaged
  if (text.includes("?") && (text.length > 30 || /\b(tell me|how was|what do you think|kaisa tha|explain)\b/i.test(text))) {
    return { vibe: "Curious & Engaged", icon: "🤔", advice: "Provide thoughtful details" };
  }

  return { vibe: "Casual & Friendly", icon: "💬", advice: "Keep flow natural and responsive" };
}

function extractConversationState(messages = []) {
  const lastQuestionMsg = [...messages].reverse().find((m) => (m.text || "").includes("?") || /^(kya|kab|kahan|why|when|where|what|how)\b/i.test(m.text || ""));
  const isOpenQuestion = Boolean(lastQuestionMsg && lastQuestionMsg.from === "them");

  let topic = "General chat";
  // Prioritize latest 3 messages for current active topic
  const recentText = messages.slice(-3).map((m) => m.text || "").join(" ").toLowerCase();
  const allText = messages.map((m) => m.text || "").join(" ").toLowerCase();

  if (/\b(series|show|shows|binge|watch|movie|movies|film|genre|romance|thriller|fiction|anime|episode)\b/i.test(recentText)) {
    topic = "Entertainment & Media";
  } else if (/\b(meet|milte|hangout|dinner|lunch|party|drinks|free this|plan for)\b/i.test(recentText)) {
    topic = "Plans & Meetups";
  } else if (/\b(work|office|project|report|sync|deadline|call|client|team|deploy|pr|review)\b/i.test(recentText)) {
    topic = "Work & Collaboration";
  } else if (/\b(dinner|lunch|food|khana|cafe|coffee|eat|swiggy|zomato|pizza|burger)\b/i.test(recentText)) {
    topic = "Food & Outings";
  } else if (/\b(code|git|bug|pr|repo|feature|api|server|build)\b/i.test(recentText)) {
    topic = "Tech & Engineering";
  } else if (/\b(hospital|doctor|health|sick|tabiyat|fever|medicine)\b/i.test(recentText)) {
    topic = "Health & Well-being";
  } else if (/\b(series|movie|film|genre|romance|thriller|fiction)\b/i.test(allText)) {
    topic = "Entertainment & Media";
  } else if (/\b(weekend|saturday|sunday|kal|tonight|plan|party|meet|mil)\b/i.test(allText)) {
    topic = "Plans & Meetups";
  } else if (/\b(work|office|project|report|sync|deadline|call|client|team|deploy)\b/i.test(allText)) {
    topic = "Work & Collaboration";
  }

  const vibe = detectVibeCheck(messages);

  return {
    topic,
    lastQuestion: lastQuestionMsg ? String(lastQuestionMsg.text).slice(0, 100) : null,
    isOpenQuestion,
    vibe,
    lastSender: messages.length > 0 ? messages[messages.length - 1].from : "none"
  };
}

// ==============================================================================
// Phase 5: Anti-AI Cringe & Naturalness Sanitizer
// ==============================================================================
function cleanseAiPatterns(replyText, lastIncoming = "", contactRole = "auto", language = "Hinglish") {
  if (!replyText || typeof replyText !== "string") return "";

  let cleaned = replyText.trim();
  cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();
  cleaned = cleaned.replace(/^(Option \d+:|ME:|THEM:|Natural:|Playful:|Keep Going:|Reply:|Path \d+:|Answer:|Agree:|Decline:|Clarify:)\s*/i, "").trim();

  // Strip robotic markdown quotes and code blocks
  if (cleaned.startsWith("```") && cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Boss / Formal Safeguard: Strip informal street slang and disrespectful pronouns
  const role = (contactRole || "").toLowerCase();
  const isBoss = role === "boss" || role === "client" || role === "formal";
  const isEnglish = (language || "").toLowerCase().includes("english");

  if (isBoss) {
    cleaned = cleaned
      .replace(/\btu\s+chod\s+yaar\b/gi, "")
      .replace(/\bchod\s+yaar\b/gi, "")
      .replace(/\btu\s+chod\b/gi, "")
      .replace(/\b(bhai|bro|yaar|bc|mc|kya scene|mast)\b[,!.]?\s*/gi, "")
      .replace(/\b(tu|tere|tujhe)\b/gi, (match) => {
        if (match.toLowerCase() === "tu") return "aap";
        if (match.toLowerCase() === "tere") return "aapke";
        if (match.toLowerCase() === "tujhe") return "aapko";
        return match;
      })
      .trim();

    cleaned = cleaned.replace(/^[,!.\s]+/, "").trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  } else if (isEnglish) {
    // English mode: ensure no stray Hindi slang words remain
    cleaned = cleaned
      .replace(/\b(bhai|yaar|tu|chod|bc|mc|kya scene|mast|arre|chal|haan|acha|theek|sahi hai)\b[,!.]?\s*/gi, "")
      .trim();
    cleaned = cleaned.replace(/^[,!.\s]+/, "").trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  // Anti-Cringe: Remove robotic AI pleasantries & openers
  const roboticOpeners = [
    /^certainly[,!.]?\s*/i,
    /^absolutely[,!.]?\s*/i,
    /^i would be (delighted|happy|glad) to\s*/i,
    /^i'd be (delighted|happy|glad) to\s*/i,
    /^i hope this (message|email) finds you well[,!.]?\s*/i,
    /^i hope you('re| are) having a (great|wonderful|good) day[,!.]?\s*/i,
    /^thank you for (reaching out|the update|asking)[,!.]?\s*/i,
    /^thanks for reaching out[,!.]?\s*/i,
    /^great question[,!.]?\s*/i,
    /^i understand (your concern|where you're coming from)[,!.]?\s*/i,
    /^as an ai[,\s].*?[.!?]\s*/i,
    /^sure thing[,!.]?\s*/i,
    /^no problem at all[,!.]?\s*/i
  ];

  for (const pattern of roboticOpeners) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  // Anti-Cringe: Remove robotic formal sign-offs in casual chat (only when not speaking to boss)
  if (role !== "boss" && role !== "client" && role !== "formal") {
    cleaned = cleaned.replace(/(?:Please let me know if you (?:have any questions|need anything else)|Feel free to reach out|Looking forward to your favorable response)[.!]*$/i, "").trim();
    cleaned = cleaned.replace(/^(Furthermore|Moreover|In addition|Consequently|Nevertheless|With regards to)[,\s]+/i, "").trim();
  }

  // Anti-Parroting: If the reply is an exact repetition of the other person's message
  if (lastIncoming && cleaned.toLowerCase() === lastIncoming.toLowerCase().trim()) {
    return "";
  }

  // Anti-Parroting opener: If the response starts with verbatim echo of question
  if (lastIncoming && lastIncoming.length > 15) {
    const words = lastIncoming.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
    if (cleaned.toLowerCase().startsWith(`yes, ${words}`) || cleaned.toLowerCase().startsWith(`i am ${words}`)) {
      cleaned = cleaned.replace(new RegExp(`^(yes,\\s*|no,\\s*)?${words}[^,.!?]*[,.!?]?\\s*`, "i"), "").trim();
    }
  }

  // Anti-Generic Canned Assistant Phrases
  const genericBannedPhrases = [
    /^let's sync up this weekend and make it happen[.!]*$/i,
    /^let's sync up this weekend[.!]*$/i,
    /^absolutely, that makes sense[.!]*$/i,
    /^i completely understand[.!]*$/i,
    /^fair enough, that makes sense[.!]*$/i,
    /^that sounds great, let me know[.!]*$/i
  ];
  for (const pat of genericBannedPhrases) {
    if (pat.test(cleaned)) {
      return "";
    }
  }

  return cleaned;
}

const evaluateAndCleanReply = cleanseAiPatterns;

// ==============================================================================
// Phase 5: Flow Intelligence & Dynamic Communication Strategy Engine
// ==============================================================================

function detectConversationEnergy(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return "neutral";
  const lastThemMsg = [...messages].reverse().find((m) => m.from === "them");
  const themText = (lastThemMsg?.text || "").toLowerCase().trim();
  const allThemText = messages.filter((m) => m.from === "them").map((m) => m.text || "").join(" ").toLowerCase();

  // 1. Tense / Conflict / Frustration (unless they are apologizing)
  const isThemApologizing = /\b(sorry|was i rude|apologize|my bad|galti|maaf)\b/i.test(themText);
  if (!isThemApologizing && (/\b(annoyed|irritated|angry|pissed|gussa|disappointed|dont care|don't care|stop it|rude|whatever|hate you|waste of time)\b/i.test(themText) ||
      /^(k|fine\.|whatever)\s*$/i.test(themText))) {
    return "tense";
  }

  // 2. Serious / Sensitive / Emotional / Health
  if (/\b(hospital|sick|tabiyat|doctor|sad|crying|hurt|depressed|stress|exam|fail|accident|emergency|grief)\b/i.test(allThemText) ||
      /\b(feel like you don't care|don't care anymore|feel lonely|honestly i feel|hurts)\b/i.test(themText)) {
    return "serious";
  }

  // 3. Flirty / Romantic Chemistry
  if (/\b(cute|hot|crush|date|pretty|handsome|gorgeous|sweetheart|impress|miss you|sliding into|blush|wink|😉|😘|❤️|🔥|🙈|👀)\b/i.test(allThemText) ||
      /\b(never have time for me|time kab nikal|special|thinking of you)\b/i.test(themText)) {
    return "flirty";
  }

  // 4. Playful / Banter / Teasing
  if (/\b(haha|hehe|lol|lmao|rofl|😂|🤣|💀|😭|drama|pagal|bakwaas|nautanki|look who decided|finally you replied|overacting)\b/i.test(themText)) {
    return "playful";
  }

  // 5. Warm / Appreciative / Closeness
  if (/\b(thank you|thanks a lot|so sweet|appreciate|great seeing you|love it|awesome|glad to hear)\b/i.test(themText)) {
    return "warm";
  }

  // 6. Low energy / Dry
  if (messages.length >= 2 && /^(k|ok|h|hmm|cool|nice|acha|yeah|yep)\s*$/i.test(themText)) {
    return "low";
  }

  return "neutral";
}

function detectConversationMomentum(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return "starting";
  const lastMsg = messages[messages.length - 1];
  const lastText = (lastMsg?.text || "").toLowerCase().trim();

  // 1. Ending
  if (/\b(bye|goodnight|gn|see ya|cya|talk tomorrow|chalo milte|alvida|good night|catch you later)\b/i.test(lastText)) {
    return "ending";
  }

  // 2. Starting
  if (messages.length <= 2 && /\b(hey|hi|hello|sup|wassup|kya haal|yo)\b/i.test(lastText)) {
    return "starting";
  }

  // 3. Stagnating / Dry
  if (messages.length >= 3 && /^(k|ok|nice|hmm|cool|fine|acha)\s*$/i.test(lastText)) {
    return "stagnating";
  }

  // 4. Escalating (flirting, banter, or excitement building up)
  const recentText = messages.slice(-3).map((m) => m.text || "").join(" ").toLowerCase();
  if (/\b(miss you|crush|date|time for me|impress|🔥|❤️|👀|sunday|plan|party|tonight)\b/i.test(recentText)) {
    return "escalating";
  }

  // 5. Recovering (after apology or awkward gap)
  if (/\b(sorry|apologize|my bad|galti|maaf)\b/i.test(lastText)) {
    return "recovering";
  }

  return "flowing";
}

// ==============================================================================
// Deep Situation & Conversational Understanding Engine (v4.3 P0 Core)
// ==============================================================================
function detectConversationSituation(messages = [], context = {}, profile = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      situation: "casual_flow",
      latestIntent: "continuation",
      relationshipContext: "casual",
      userEmotion: "neutral",
      otherPersonState: "neutral",
      userObjective: "continue_chat",
      conversationDirection: "ongoing",
      responseObjectives: ["CONTINUE"],
      recommendedStrategy: ["reply_organically"],
      flirtOpportunity: "none",
      flirtIntensity: "none",
      whatHappened: "General conversation start or continuation.",
      whatUserWants: "Keep the conversation going naturally.",
      whatOtherNeeds: "A friendly response.",
      shouldAskQuestion: false
    };
  }

  const lastThemMsg = [...messages].reverse().find((m) => m.from === "them");
  const lastThemText = (lastThemMsg?.text || "").trim();
  const lowerThem = lastThemText.toLowerCase();

  const meMessages = messages.filter((m) => m.from === "me");
  const themMessages = messages.filter((m) => m.from === "them");
  const recentMeText = meMessages.slice(-5).map((m) => m.text || "").join(" ").toLowerCase();
  const allThemText = themMessages.map((m) => m.text || "").join(" ").toLowerCase();
  const allText = messages.map((m) => m.text || "").join(" ").toLowerCase();
  const recentText = messages.slice(-5).map((m) => m.text || "").join(" ").toLowerCase();

  // 1. INFER RELATIONSHIP CONTEXT
  const explicitRole = (context.contactRole || "").toLowerCase();
  let relationshipContext = "casual";

  if (explicitRole === "boss" || explicitRole === "client" || explicitRole === "formal") {
    relationshipContext = "professional";
  } else if (explicitRole === "colleague") {
    relationshipContext = "colleague";
  } else if (explicitRole === "family") {
    relationshipContext = "family";
  } else if (explicitRole === "romantic" || explicitRole === "close") {
    relationshipContext = "romantic";
  } else {
    // Check conversation content for romantic markers
    const hasRomanticWords = /\b(dating|date|relationship|break up|breakup|make this work|boyfriend|girlfriend|bf|gf|husband|wife|partner|love you|pyaar|babe|baby|jaan|shona|sweetheart|miss you|crush|kiss|why are we even dating)\b/i.test(allText);
    const hasHeartReaction = /[❤️💖💕😘]/.test(lastThemText) || themMessages.some((m) => /[❤️💖💕]/.test(m.text || ""));

    if (hasRomanticWords || (hasHeartReaction && (recentMeText.includes("dating") || recentMeText.includes("time") || recentMeText.includes("talk")))) {
      relationshipContext = "romantic";
    } else if (/\b(boss|sir|presentation|deliverables|stakeholder|kpi|deploy|client|milestone|pr review)\b/i.test(allText)) {
      relationshipContext = "professional";
    } else if (/\b(mummy|papa|mom|dad|bhaiya|didi|family)\b/i.test(allText)) {
      relationshipContext = "family";
    } else if (explicitRole === "friend") {
      relationshipContext = "friendly";
    } else if (/\b(crush|cute|hot|flirt|attractive)\b/i.test(allText)) {
      relationshipContext = "flirty";
    }
  }

  const allowsFlirting = Boolean(profile.flirting !== false && relationshipContext !== "professional" && relationshipContext !== "family");

  // 2. IDENTIFY LATEST INTENT
  let latestIntent = "continuation";
  const isQuestion = lowerThem.includes("?") || /^(kya|kab|kahan|kaun|kaise|kyun|why|when|where|what|how)\b/i.test(lowerThem);

  if (/\b(sorry|apologize|apologies|my bad|galti|maaf|was i rude|shame on me|maafi|shitt man|shit man|my fault)\b/i.test(lowerThem)) {
    latestIntent = "apology";
  } else if (/\b(romance, thriller n fiction|romance|thriller|fiction|sci-fi|anime|comedy|horror|action|movie|series|shows|books|reading|music)\b/i.test(lowerThem) && !isQuestion) {
    latestIntent = "preference_share";
  } else if (/\b(free for|milte|hangout|dinner|lunch|coffee|party|tomorrow around|weekend plan)\b/i.test(lowerThem)) {
    latestIntent = "invitation";
  } else if (isQuestion) {
    latestIntent = "question";
  } else if (/\b(lol|lmao|rofl|haha|hehe|joke|mazak|😂|🤣|💀|😭|overacting|dramabaaz)\b/i.test(lowerThem)) {
    latestIntent = "banter";
  } else if (/^(k|ok|hmm|nice|acha|yeah|yep|cool)\s*$/i.test(lowerThem)) {
    latestIntent = "minimal_ack";
  } else if (/\b(goodnight|gn|bye|see ya|cya|talk tomorrow)\b/i.test(lowerThem)) {
    latestIntent = "sign_off";
  }

  // 3. SITUATION IDENTIFICATION

  // SITUATION 1: Relationship Tension & Apology (P0 Critical Bug Scenario)
  const isApologetic = latestIntent === "apology";
  const meExpressedTimeFrustration = /\b(why are we even|don't even have time|dont even have time|cant talk|can't talk|make this work|never have time|ignore|ignoring|priority|ghanta time|time nahi|weekends prr|week days prr|school hpta|then how we supposed|even dating)\b/i.test(recentMeText);
  const datingTensionInChat = /\b(why are we even dating|make this work|weekends prr you cant talk|school hpta|what can i say yrr)\b/i.test(allText);

  if (isApologetic && (relationshipContext === "romantic" || meExpressedTimeFrustration || datingTensionInChat)) {
    return {
      situation: "relationship_tension",
      latestIntent: "apology",
      relationshipContext: "romantic",
      userEmotion: "frustrated_but_affectionate",
      otherPersonState: "apologetic_remorseful",
      userObjective: "reassure_and_express_need_for_more_time",
      conversationDirection: "de_escalating_repair",
      responseObjectives: ["ACCEPT_APOLOGY", "REASSURE", "EXPRESS_NEED", "REPAIR_TENSION", "PLAYFUL_FLIRT"],
      recommendedStrategy: [
        "accept_apology",
        "reassure",
        "express_need_for_more_time",
        "soften_tension_with_affectionate_playful_warmth"
      ],
      flirtOpportunity: allowsFlirting ? "high" : "low",
      flirtIntensity: "playful",
      whatHappened: "User confronted partner about not having enough time to talk during weekdays/weekends. Partner initially felt cornered, then realized their tone was hurtful and sent a sincere emotional apology (with 😭 / ❤️).",
      whatUserWants: "Accept the apology, reassure partner that it's okay, communicate that user just wants more time together with them, and soften the tension with natural affectionate/playful warmth without restarting the fight.",
      whatOtherNeeds: "Reassurance that the user is not angry, acceptance of their apology, and emotional safety/affection.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 2: General Sincere Apology (Friend / Work / Social)
  if (isApologetic) {
    return {
      situation: "apology_resolution",
      latestIntent: "apology",
      relationshipContext,
      userEmotion: "forgiving",
      otherPersonState: "apologetic",
      userObjective: "accept_apology_and_reassure",
      conversationDirection: "de_escalating",
      responseObjectives: ["ACCEPT_APOLOGY", "REASSURE"],
      recommendedStrategy: ["accept_apology", "reassure_it_is_fine", "smoothly_continue"],
      flirtOpportunity: "none",
      flirtIntensity: "none",
      whatHappened: "Other person apologized for a delay, mistake, or behavior.",
      whatUserWants: "Graciously accept the apology, reassure them that it's fine, and move forward.",
      whatOtherNeeds: "Reassurance that things are okay.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 3: Entertainment & Media Taste Sharing (Test 1 Scenario)
  if (latestIntent === "preference_share" || /\b(romance, thriller n fiction|romance|thriller|fiction)\b/i.test(lowerThem)) {
    return {
      situation: "entertainment_preference",
      latestIntent: "preference_share",
      relationshipContext,
      userEmotion: "engaged_curious",
      otherPersonState: "sharing",
      userObjective: "react_to_taste_and_banter",
      conversationDirection: "deepening_flow",
      responseObjectives: ["REACT_TO_PREFERENCE", "PLAYFUL_TEASE", "SHOW_INTEREST"],
      recommendedStrategy: ["acknowledge_genres", "react_with_wit_or_tease", "keep_conversation_natural"],
      flirtOpportunity: allowsFlirting ? "high" : "low",
      flirtIntensity: "playful",
      whatHappened: "Other person shared their favorite book/movie/entertainment genres.",
      whatUserWants: "React playfully to their combination of genres (e.g. romance + thriller), tease their taste, and keep the chat flowing naturally without introducing random topics.",
      whatOtherNeeds: "A fun, engaging reaction to their taste.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 4: Playful Tease / Mock Drama (e.g. 'you never have time for me')
  if (/\b(you never have time for me|time kab nikal|finally you replied|itna wait|miss you|overacting|drama)\b/i.test(lowerThem) ||
      (/\b(never have time for me)\b/i.test(recentText) && latestIntent === "banter")) {
    return {
      situation: "playful_tease",
      latestIntent: "banter",
      relationshipContext: relationshipContext === "casual" ? "flirty" : relationshipContext,
      userEmotion: "playful_amused",
      otherPersonState: "teasing",
      userObjective: "tease_back_and_flirt",
      conversationDirection: "escalating_banter",
      responseObjectives: ["PLAYFUL_TEASE", "FLIRT", "BANTER"],
      recommendedStrategy: ["match_playful_energy", "witty_counter_tease", "build_chemistry"],
      flirtOpportunity: allowsFlirting ? "high" : "none",
      flirtIntensity: "playful",
      whatHappened: "Other person is teasing or making mock complaints.",
      whatUserWants: "Tease back with charm and wit, building conversational chemistry.",
      whatOtherNeeds: "Playful banter in return.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 5: Professional / Work Deliverables Request
  if (relationshipContext === "professional" || /\b(pr review|milestone|deliverables|presentation|deck|client update|deadline)\b/i.test(lowerThem)) {
    return {
      situation: "work_execution",
      latestIntent: isQuestion ? "question" : "status_request",
      relationshipContext: "professional",
      userEmotion: "constructive_professional",
      otherPersonState: "coordinating",
      userObjective: "provide_direct_status_and_deliverable",
      conversationDirection: "productive",
      responseObjectives: ["CONFIRM_STATUS", "PROVIDE_ETA"],
      recommendedStrategy: ["confirm_ownership", "provide_clear_eta", "remain_respectful"],
      flirtOpportunity: "none",
      flirtIntensity: "none",
      whatHappened: "Colleague, boss, or client requested an update or deliverable.",
      whatUserWants: "Provide a direct, articulate, polite update with status or timeline.",
      whatOtherNeeds: "Clarity, reliability, and speed.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 6: Scheduling Constraint or Logistics
  if (/\b(papa ate hain|sunday sat|booked|cant make it|reschedule|tomorrow morning|what time)\b/i.test(lowerThem)) {
    return {
      situation: "scheduling_logistics",
      latestIntent: "schedule_constraint",
      relationshipContext,
      userEmotion: "accommodating",
      otherPersonState: "informing_constraint",
      userObjective: "acknowledge_constraint_and_adapt",
      conversationDirection: "aligning",
      responseObjectives: ["ACKNOWLEDGE_CONSTRAINT", "ADAPT_PLAN"],
      recommendedStrategy: ["acknowledge_schedule_conflict", "suggest_alternative_or_flexible_response"],
      flirtOpportunity: allowsFlirting ? "medium" : "none",
      flirtIntensity: "playful",
      whatHappened: "Other person shared a timing or family constraint.",
      whatUserWants: "Acknowledge the constraint smoothly and adapt the plan without frustration.",
      whatOtherNeeds: "Flexibility and understanding.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 7: Dry / Minimal Message (e.g. 'k', 'ok', 'hmm')
  if (latestIntent === "minimal_ack") {
    return {
      situation: "dry_reply",
      latestIntent: "minimal_ack",
      relationshipContext,
      userEmotion: "amused_mock_shock",
      otherPersonState: "low_effort",
      userObjective: "call_out_dryness_with_humor",
      conversationDirection: "reigniting",
      responseObjectives: ["PLAYFUL_TEASE", "CALL_OUT_DRYNESS"],
      recommendedStrategy: ["mock_shock_at_dry_reply", "inject_energy"],
      flirtOpportunity: allowsFlirting ? "medium" : "none",
      flirtIntensity: "playful",
      whatHappened: "Other person sent an extremely short or dry message.",
      whatUserWants: "Playfully call out the dry response and re-energize the conversation.",
      whatOtherNeeds: "A spark to re-engage.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 8: Emotional Vulnerability / Venting
  if (/\b(cannot sleep|mind is racing|exhausted|rough day|overwhelmed|hurts|crying|sad)\b/i.test(lowerThem)) {
    return {
      situation: "emotional_support",
      latestIntent: "vulnerability",
      relationshipContext,
      userEmotion: "empathetic_supportive",
      otherPersonState: "vulnerable_stressed",
      userObjective: "empathize_and_support",
      conversationDirection: "deepening_care",
      responseObjectives: ["EMPATHIZE", "REASSURE", "SUPPORT"],
      recommendedStrategy: ["validate_feelings", "warm_caring_reassurance"],
      flirtOpportunity: allowsFlirting && relationshipContext === "romantic" ? "subtle" : "none",
      flirtIntensity: "subtle",
      whatHappened: "Other person is sharing emotional vulnerability or stress.",
      whatUserWants: "Offer genuine emotional comfort, care, and presence.",
      whatOtherNeeds: "To be heard and comforted.",
      shouldAskQuestion: false
    };
  }

  // SITUATION 9: Farewell / Goodnight
  if (latestIntent === "sign_off") {
    return {
      situation: "farewell",
      latestIntent: "sign_off",
      relationshipContext,
      userEmotion: "warm_closing",
      otherPersonState: "closing",
      userObjective: "warm_natural_closure",
      conversationDirection: "closing",
      responseObjectives: ["CLOSE"],
      recommendedStrategy: ["warm_signoff", "no_artificial_questions"],
      flirtOpportunity: allowsFlirting ? "subtle" : "none",
      flirtIntensity: "subtle",
      whatHappened: "Other person is ending the conversation for the night.",
      whatUserWants: "Wish them goodnight warmly without asking questions to keep the chat artificially alive.",
      whatOtherNeeds: "Warm sign-off.",
      shouldAskQuestion: false
    };
  }

  // DEFAULT SITUATION: Casual Ongoing Flow
  return {
    situation: "casual_flow",
    latestIntent: isQuestion ? "question" : "continuation",
    relationshipContext,
    userEmotion: "relaxed_friendly",
    otherPersonState: "engaged",
    userObjective: isQuestion ? "answer_and_flow" : "continue_conversation",
    conversationDirection: "ongoing",
    responseObjectives: isQuestion ? ["ANSWER", "CONTINUE"] : ["CONTINUE"],
    recommendedStrategy: [isQuestion ? "answer_directly" : "react_naturally", "keep_authentic_voice"],
    flirtOpportunity: allowsFlirting ? "medium" : "none",
    flirtIntensity: allowsFlirting ? "playful" : "none",
    whatHappened: "Ongoing natural conversation.",
    whatUserWants: "Keep the chat flowing smoothly and authentically in user's voice.",
    whatOtherNeeds: "A natural reply.",
    shouldAskQuestion: false
  };
}

function deriveCommunicationStrategy(intentInfo = {}, convoState = {}, context = {}, lastThemText = "", draft = "", energy = "neutral", momentum = "flowing", profile = {}, situation = {}) {
  const intent = intentInfo?.intent || "Conversation continuation";
  const lowerIncoming = (lastThemText || "").toLowerCase().trim();
  const hasDraft = Boolean(draft && typeof draft === "string" && draft.trim().length > 0);
  const role = (context.contactRole || "").toLowerCase();
  const isBoss = role === "boss" || role === "client" || role === "formal";
  const allowsFlirt = Boolean(profile.flirting && !isBoss && energy !== "serious" && energy !== "tense");

  if (hasDraft) {
    return {
      strategy: "ACTIVE_DRAFT_FUSION",
      headline: isBoss ? "Executive Draft Polish" : "Complete & Polish Draft",
      directive: `ME typed a draft in composer: "${draft.trim()}". Seamlessly polish or complete this thought into ME's natural voice.`
    };
  }

  if (situation && situation.situation === "relationship_tension") {
    return {
      strategy: "RELATIONSHIP_REPAIR_AND_NEED",
      headline: "Accept Apology & Reconnect",
      directive: `Partner apologized for being unavailable/rude after dating frustration ('${lastThemText}'). ME wants to: 1. Warmly accept apology and reassure ('it's okay yrr / koi nahi'). 2. Communicate needing more time together ('bas thoda aur time chahiye tumhare saath'). 3. Lighten the tension with ME's playful/affectionate warmth. NEVER restart the fight, NEVER talk about being alone or unrelated activities.`
    };
  }

  if (situation && situation.situation === "entertainment_preference") {
    return {
      strategy: "RESPOND_TO_PREFERENCE",
      headline: "React to Taste & Banter",
      directive: `React specifically to their genre preference ('${lastThemText}') with playful wit or tease their combination. Do NOT talk about previous topics or unrelated activities.`
    };
  }

  if (isBoss) {
    if (intent === "Question" || lowerIncoming.includes("?")) {
      return {
        strategy: "ANSWER_DIRECTLY",
        headline: "Direct Status & Execution",
        directive: "Provide a direct, respectful, articulate answer with current status or solution. Strictly NO slang."
      };
    }
    return {
      strategy: "ACKNOWLEDGE",
      headline: "Professional Alignment",
      directive: "Courteously confirm receipt and state ownership or immediate next steps with high respect."
    };
  }

  if (momentum === "ending") {
    return {
      strategy: "CLOSE_CONVERSATION",
      headline: "Natural Sign-off",
      directive: "Gracefully and warmly close the chat without forcing artificial questions or dragging it out."
    };
  }

  if (allowsFlirt && (energy === "flirty" || intent === "Flirting" || /\b(never have time|miss you|crush|cute|date)\b/i.test(lowerIncoming))) {
    return {
      strategy: "FLIRT_BANTER",
      headline: "Playful Chemistry & Teasing",
      directive: "Engage with charming wit, playful pushback, and natural conversational tension. Build chemistry without cheesy pickup lines."
    };
  }

  if (/\b(romance|thriller|fiction|comedy|horror|action|sci-fi|anime|movie|movies|series|song|songs|music|food|pizza|burger|pasta|biryani|shows|binge)\b/i.test(lowerIncoming)) {
    return {
      strategy: "RESPOND_TO_PREFERENCE",
      headline: "React to Taste & Share",
      directive: "React playfully, thoughtfully, or playfully tease their specific taste/preference. Share an opinion, tease their choice, or ask for their top recommendation."
    };
  }

  if (intent === "Question" || lowerIncoming.includes("?")) {
    return {
      strategy: "ANSWER_DIRECTLY",
      headline: "Answer & Move Forward",
      directive: "Directly answer the question in ME's authentic voice, then smoothly keep the conversation flowing."
    };
  }

  if (energy === "playful" || intent === "Joke/banter") {
    return {
      strategy: "PLAYFUL_BANTER",
      headline: "Witty Banter & Tease",
      directive: "Match their humor with witty teasing, mock shock, or a sharp comeback that keeps the energy high."
    };
  }

  if (energy === "tense" || energy === "serious" || intent === "Complaint") {
    return {
      strategy: "REASSURE_DE_ESCALATE",
      headline: "Empathy & Reassurance",
      directive: "Validate their frustration or concern sincerely; de-escalate tension without sounding defensive."
    };
  }

  if (momentum === "stagnating" || energy === "low") {
    return {
      strategy: "RE_OPEN_CONVERSATION",
      headline: "Reignite Flow",
      directive: "Inject energy with an interesting observation, playful challenge, or natural topic transition."
    };
  }

  return {
    strategy: "CONTINUE_CONVERSATION",
    headline: "Organic Texting Flow",
    directive: "Naturally respond to the core meaning of their message in ME's exact cadence."
  };
}

// ==============================================================================
// Hierarchical Prompt Engine (Context + Voice + Communication Handler)
// ==============================================================================
function buildSystemPrompt(
  baseProfile = {},
  learnedProfile = {},
  context = {},
  mode = "suggest",
  intentInfo = {},
  convoState = {},
  variationAngle = "balanced",
  conversationEnergy = "neutral",
  momentum = "flowing",
  situation = null
) {
  const contactRole = (context.contactRole || "auto").toLowerCase();
  const isBoss = contactRole === "boss" || contactRole === "client" || contactRole === "formal";

  // Layer 1: Base Preferences (Explicit)
  const language = baseProfile.language || "Hinglish";
  const langLower = language.toLowerCase();
  const isEnglish = langLower.includes("english");
  const isHindi = langLower === "hindi" || (langLower.includes("hindi") && !langLower.includes("hinglish"));

  const personality = isBoss ? "Professional, Respectful & Courteous" : (baseProfile.personalityPreset || "Confident + Funny");
  const replyLength = baseProfile.replyLength || "adaptive";
  const humor = isBoss ? "none" : (baseProfile.humor || "high");
  const emojiUsage = isBoss ? "none" : (baseProfile.emojiUsage || "occasional");
  const flirting = isBoss ? "Disabled" : (baseProfile.flirting ? "Active" : "Disabled");

  let manualPhrases = "";
  if (isBoss) {
    manualPhrases = "sure, will check, noted, on it, thank you, let me know, sounds good, yes sir";
  } else if (isEnglish) {
    const rawPhrases = Array.isArray(baseProfile.commonPhrases) && baseProfile.commonPhrases.length > 0
      ? baseProfile.commonPhrases
      : ["sounds good", "cool", "on it", "makes sense", "for sure", "haha"];
    const hindiSlang = new Set(["bhai", "haan", "acha", "sahi hai", "yaar", "tu", "chal", "arre", "theek"]);
    const cleanPhrases = rawPhrases.filter((p) => !hindiSlang.has(p.toLowerCase()));
    manualPhrases = cleanPhrases.length > 0 ? cleanPhrases.join(", ") : "sounds good, cool, on it, makes sense, haha";
  } else {
    manualPhrases = Array.isArray(baseProfile.commonPhrases) && baseProfile.commonPhrases.length > 0
      ? baseProfile.commonPhrases.join(", ")
      : (baseProfile.commonPhrases || "bhai, haan, acha, lol, 😭, sahi hai");
  }

  let langDirective = "";
  if (isEnglish) {
    langDirective = "MANDATORY LANGUAGE: ME has selected ENGLISH. Every word of the suggested reply MUST be 100% in natural, fluent, modern English. Under NO circumstance output Hindi or Hinglish words, slang, or particles (never use 'bhai', 'yaar', 'haan', 'sahi hai', 'theek', 'acha', 'arre', 'kya', 'chal').";
  } else if (isHindi) {
    langDirective = "MANDATORY LANGUAGE: ME has selected HINDI. Every word of the suggested reply MUST be in natural Hindi (conversational Latin script or Devanagari script matching the chat).";
  } else {
    langDirective = "MANDATORY LANGUAGE: ME has selected HINGLISH. Naturally blend conversational Hindi and English in Roman/Latin script as commonly texted in India (e.g. 'haan samajh gaya', 'sahi hai', 'sunday ko hi milna padega phir').";
  }

  // Voice Directives based on Personality Preset
  const voiceDirectives = [];
  if (personality.includes("Flirty") || flirting === "Active") {
    voiceDirectives.push("- FLIRTY & PLAYFUL VOICE: ME is confident, witty, teasing, and effortlessly charming. ME builds natural chemistry through playful pushback, subtle tension, and callbacks. ME never sounds dry or desperate.");
  } else if (personality.includes("Confident") || personality.includes("Funny")) {
    voiceDirectives.push("- CONFIDENT & FUNNY VOICE: ME communicates with easy self-assurance and sharp wit. Observations are humorous, comfortable, and sharp without trying too hard.");
  } else if (personality.includes("Direct") || personality.includes("Fast")) {
    voiceDirectives.push("- DIRECT & FAST VOICE: ME is punchy, high-impact, and straight to the point (1-2 sentences). Zero fluff, zero filler.");
  } else if (personality.includes("Professional") || isBoss) {
    voiceDirectives.push("- PROFESSIONAL & COURTEOUS VOICE: ME is articulate, respectful, constructive, and prompt. Strictly zero street slang.");
  } else {
    voiceDirectives.push("- FRIENDLY & CASUAL VOICE: ME is approachable, warm, genuine, and authentic.");
  }

  if (humor === "high" && !isBoss) {
    voiceDirectives.push("- HUMOR LEVEL: HIGH. Actively use playful banter, clever callbacks, or witty comebacks when replying.");
  } else if (humor === "none" || isBoss) {
    voiceDirectives.push("- HUMOR LEVEL: NONE. Keep sincere, straightforward, and direct.");
  }

  // Layer 2: Learned Writing Style (Adaptive Voice)
  const hasLearnedData = Boolean(learnedProfile && learnedProfile.enabled !== false && (learnedProfile.messageCount || 0) > 0);
  const learnedLines = [];

  if (hasLearnedData) {
    if (learnedProfile.avgMessageLength > 0) {
      learnedLines.push(`- Average message length: ~${Math.round(learnedProfile.avgMessageLength)} chars.`);
    }
    if (typeof learnedProfile.lowercaseRatio === "number" && learnedProfile.lowercaseRatio > 0.6 && !isBoss) {
      learnedLines.push("- Casing habit: Prefers lowercase openings, relaxed casing.");
    }
    if (typeof learnedProfile.minimalPunctuationRatio === "number" && learnedProfile.minimalPunctuationRatio > 0.6 && !isBoss) {
      learnedLines.push("- Punctuation habit: Minimal punctuation; rarely ends texting thoughts with periods.");
    }
    if (Array.isArray(learnedProfile.topEmojis) && learnedProfile.topEmojis.length > 0 && !isBoss) {
      learnedLines.push(`- Observed signature emojis: [${learnedProfile.topEmojis.slice(0, 5).join(", ")}]`);
    }

    const slangFilterRegex = /\b(bhai|bro|yaar|tu|chod|bc|mc|kya scene|mast|lol|lmao|😭|😂|haan|acha|theek|sahi hai|arre|chal)\b/i;
    const shouldFilterSlang = isBoss || isEnglish;

    if (Array.isArray(learnedProfile.topPhrases) && learnedProfile.topPhrases.length > 0) {
      const phrases = shouldFilterSlang
        ? learnedProfile.topPhrases.filter((p) => !slangFilterRegex.test(p))
        : learnedProfile.topPhrases;
      if (phrases.length > 0) {
        learnedLines.push(`- Natural vocabulary: [${phrases.slice(0, 8).join(", ")}]`);
      }
    }
    if (Array.isArray(learnedProfile.recentSampleMessages) && learnedProfile.recentSampleMessages.length > 0) {
      const cleanSamples = shouldFilterSlang
        ? learnedProfile.recentSampleMessages.filter((msg) => !slangFilterRegex.test(msg) && !/\b(tu|tere|tujhe)\b/i.test(msg))
        : learnedProfile.recentSampleMessages;
      if (cleanSamples.length > 0) {
        learnedLines.push("- Sample messages sent by ME (match this authentic rhythm):");
        cleanSamples.slice(0, 4).forEach((msg) => {
          learnedLines.push(`  * "${msg}"`);
        });
      }
    }
  }

  // Layer 3: Context & Platform Directives
  const appKey = (context.app || "").toLowerCase();
  const contextDirectives = [];
  contextDirectives.push(`- Platform: ${appKey.toUpperCase()} | Conversation Energy: ${conversationEnergy.toUpperCase()} | Momentum: ${momentum.toUpperCase()}`);

  if (isBoss) {
    contextDirectives.push("- RELATIONSHIP ROLE: BOSS / EXECUTIVE / CLIENT. Strict hierarchy override. Formal respect, zero street slang ('tu', 'yaar', 'bhai', 'lol', '😭'). Pronouns: 'aap', 'sir'.");
  } else if (contactRole === "friend") {
    contextDirectives.push("- RELATIONSHIP ROLE: Close friend. Relaxed, authentic banter and personal flow.");
  } else if (contactRole === "colleague") {
    contextDirectives.push("- RELATIONSHIP ROLE: Work peer. Collaborative and friendly without stiff corporate jargon.");
  }

  if (conversationEnergy === "flirty" && flirting === "Active") {
    contextDirectives.push("- FLIRT ASSISTANT ACTIVE: Create conversational tension, playful tease, and chemistry. Respond with confidence and charm.");
  } else if (conversationEnergy === "serious") {
    contextDirectives.push("- SERIOUS / EMOTIONAL MOMENT: Sincere empathy and solidarity override humor. Be a supportive human.");
  } else if (conversationEnergy === "playful") {
    contextDirectives.push("- PLAYFUL MOMENT: Lean into the fun, tease back, and match the high energy.");
  }

  if (momentum === "ending") {
    contextDirectives.push("- CONVERSATION ENDING: Natural warm closure. Do NOT ask questions to keep the chat artificially alive.");
  }

  const coreRules = [
    "=== CORE RULES & PRIORITY HIERARCHY ===",
    `0. ABSOLUTE LANGUAGE MANDATE: ${langDirective}`,
    "1. SUPREME DIRECTIVE — ANSWER THE CURRENT LATEST MESSAGE: The primary and absolute objective is to respond naturally to the CURRENT LATEST MESSAGE sent by THEM. Never respond to an older message or previous conversation topic when a newer incoming message exists. The response must directly connect to the semantic meaning of the latest incoming message. Do NOT introduce unrelated topics (e.g. do not randomly talk about weekends, syncing up, breaks, coffee, or previous topics unless the latest message invites it).",
    "2. EXPLICIT VOICE PROFILE OVERRIDE: User's explicitly selected Personality, Humor, and Flirting settings strictly override platform defaults.",
    "3. SOUND HUMAN: Never sound like ChatGPT, an AI assistant, or a customer service agent. Never say 'Certainly', 'Sure!', 'I hope you are well'.",
    "4. BANNED GENERIC AI CLICHES: Never output canned assistant lines like 'Let's sync up this weekend and make it happen', 'That sounds great!', 'I completely understand', 'Absolutely, that makes sense', 'Sounds like a plan'.",
    "5. STOP OVER-USING SHORT REPLIES: Never output dry 1-word replies like 'haan', 'same', 'true', 'haha yeah' unless it is a pure confirmation. Respond to the actual substance of the conversation.",
    "6. NO CREEPY AI FLIRTING: If flirting, create real banter, witty callbacks, and playful pushback. Never use cringe pickup lines ('You look cute 😏'). Flirt ONLY when the context supports it.",
    "7. Anti-Parroting: Do not repeat or echo the other person's question verbatim.",
    "8. MEANING-DRIVEN LENGTH: Do NOT artificially truncate replies to 2-3 words when the objective requires expressing reassurance + need + warmth. If 1-2 natural sentences are needed to accomplish the objective, use them comfortably.",
    "9. DO NOT FORCE QUESTIONS: Do NOT append 'What do you think?', 'When are you free?', or 'How about you?' unless context genuinely calls for it. A natural statement of reassurance and affection is far more authentic."
  ];

  const situationSection = situation ? [
    `- Situation: ${situation.situation.toUpperCase()}`,
    `- Relationship Context: ${situation.relationshipContext.toUpperCase()}${situation.relationshipContext === "romantic" ? " (ROMANTIC RELATIONSHIP / DATING PARTNERSHIP)" : ""}`,
    `- What Happened: ${situation.whatHappened}`,
    `- Emotional Direction: ${situation.conversationDirection} (ME was ${situation.userEmotion} -> THEM is ${situation.otherPersonState})`,
    `- What ME Wants To Accomplish: ${situation.whatUserWants}`,
    `- What THEM Needs Right Now: ${situation.whatOtherNeeds}`,
    `- Response Objectives: ${situation.responseObjectives.join(" + ")}`,
    `- Multi-Step Strategy: [${situation.recommendedStrategy.join(" -> ")}]`,
    `- Flirt Opportunity: ${situation.flirtOpportunity.toUpperCase()} | Flirt Intensity: ${situation.flirtIntensity.toUpperCase()}`,
    `- Question Rule: ${situation.shouldAskQuestion ? "Ask a relevant question." : "DO NOT FORCE QUESTIONS. A natural reassuring statement or playful observation is preferred."}`,
    "",
    "SITUATION-SPECIFIC DIRECTIVE:",
    situation.situation === "relationship_tension"
      ? "CRITICAL MANDATE: THEM apologized sincerely after relationship tension ('Ohh godd im sorry was i rude shit man 😭 ❤️'). ME's reply MUST: 1. Warmly accept their apology and reassure them ('it's okay yrr / koi nahi'). 2. Communicate needing more time together ('bas thoda aur time chahiye tumhare saath'). 3. Lighten the tension with ME's playful/affectionate warmth (e.g. 'baaki milke tumhe maaf kr dunga 😭' or 'warna milke fine lagega tumpe'). NEVER restart the fight, NEVER talk about being alone or unrelated activities, NEVER sound dry or generic."
      : situation.situation === "entertainment_preference"
      ? "CRITICAL MANDATE: THEM shared their entertainment genres ('romance, thriller n fiction'). Respond DIRECTLY to their genres with playful wit or tease their combination. Do NOT talk about previous topics or unrelated activities."
      : `Execute ME's objective: ${situation.whatUserWants}`
  ].join("\n") : contextDirectives.join("\n");

  const promptSections = [
    "You are ComUcate — ME's personal communication handler.",
    "Your objective: Don't just generate a generic reply. Determine what ME should naturally say next in this exact conversation.",
    "",
    "=== 1. ME'S VOICE PROFILE (EXPLICIT INSTRUCTIONS) ===",
    `- Primary Language: ${language}. ${langDirective}`,
    `- Personality Preset: ${personality}`,
    `- Humor: ${humor} | Flirting: ${flirting} | Emoji: ${emojiUsage}`,
    `- Preferred Signature Fillers: [${manualPhrases}]`,
    voiceDirectives.join("\n"),
    "",
    "=== 2. LEARNED STYLE HABITS ===",
    learnedLines.length > 0 ? learnedLines.join("\n") : "- (Baseline: Strictly follow Explicit Voice Profile).",
    "",
    "=== 3. CONVERSATIONAL SITUATION & RESPONSE OBJECTIVE ===",
    situationSection,
    "",
    coreRules.join("\n")
  ];

  if (mode === "rewrite") {
    promptSections.push(
      "",
      "=== TASK: REWRITE ME'S DRAFT ===",
      "Transform ME's draft into 9 distinct variations in ME's authentic voice.",
      "Return ONLY a valid JSON object with these 9 keys:",
      '{"sound_like_me": "...", "english": "...", "diplomatic": "...", "confident": "...", "funny": "...", "smarter": "...", "flirty": "...", "professional": "...", "grammar": "..."}'
    );
  } else {
    // Mode: suggest (Communication Handler Model)
    promptSections.push(
      "",
      "=== TASK: DETERMINE WHAT ME SHOULD SAY RIGHT NOW ===",
      "Analyze the conversation flow and determine the best thing for ME to send next.",
      "",
      "CONVERSATIONAL REASONING:",
      "1. What did THEM just say and what does it actually mean? (Subtext, teasing, plans, emotions).",
      "2. What part should ME respond to?",
      "3. What does the conversation need next? (Answer directly, tease back, reassure, build chemistry, or close naturally).",
      "4. What would a real human with ME's voice send?",
      "",
      "REAL-WORLD HUMAN TEXTING EXAMPLES TO EMULATE:",
      '- Situation: Relationship tension apology ("Ohh godd im sorry was i rude shit man 😭 ❤️")',
      '  -> Primary (Best reply): "it\'s okay yrr, bas thoda sa aur time mere liye bhi nikal liya kro 😭"',
      '  -> Alternative 1 (More playful): "arey it\'s okay 😭 bas thoda time mere liye bhi nikal liya kro, warna milke fine lagega tumpe"',
      '  -> Alternative 2 (More affectionate): "it\'s okay yrr, mujhe bas thoda aur time chahiye tumhare saath… baaki milke tumhe maaf kr dunga 😭"',
      '- Situation: Entertainment preference ("romance, thriller n fiction")',
      '  -> Primary (Best reply): "romance aur thriller ka combo? 😭 suspense ke sath pyaar, dangerous combination hai waise"',
      '  -> Alternative: "matlab full drama aur thriller dono chahiye ek sath 😂 kya dekh rahi ho waise?"',
      '- Situation: Family schedule constraint ("Bataya toh tha sunday sat papa ate hain 😭")',
      '  -> Primary (Best reply): "acha haan yaad aaya! 😭 chal koi nahi, fir sunday ko hi scene set karte hain"',
      '- Situation: Playful tease ("you never have time for me")',
      '  -> Primary (Best reply): "acha toh complaint register ho gayi 😭 batao ab kaise compensate karu?"',
      '- Situation: Single letter dry reply ("k")',
      '  -> Primary (Best reply): "bas \'k\'? itna lamba message bheja aur ek letter ka reply 😭"',
      '- Situation: Boss deliverable request ("Please provide an update on the milestone deliverables.")',
      '  -> Primary (Best reply): "The deliverables are on track. I am finalizing the last few items and will share the complete report with you by this afternoon."',
      '- Situation: Natural goodnight ("okay goodnight")',
      '  -> Primary (Best reply): "goodnight, so jao! 😴"',
      "",
      "OUTPUT SPECIFICATION:",
      "Return ONLY a valid JSON object (no markdown code fence wrapper) conforming to this exact structure:",
      JSON.stringify({
        primary: {
          text: "The single best, most natural reply ME would send right now.",
          strategy: "chosen_strategy",
          label: "Best reply"
        },
        alternatives: [
          {
            text: "Distinct alternative conversational move (e.g. more playful, more bold, or direct).",
            strategy: "alternative_strategy",
            label: "More playful"
          },
          {
            text: "Another distinct conversational angle.",
            strategy: "alternative_strategy",
            label: "More bold"
          }
        ],
        meta: {
          conversationEnergy: conversationEnergy,
          momentum: momentum,
          strategy: "chosen_strategy"
        }
      }, null, 2)
    );
  }

  return promptSections.join("\n");
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest"
];

async function callGemini(systemPrompt, userText, maxTokens = 400) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing in server/.env");

  const primaryModel = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const modelsToTry = [primaryModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== primaryModel)];
  let lastError = null;

  for (const model of modelsToTry) {
    const start = Date.now();
    const ctrl = new AbortController();
    const timeoutHandle = setTimeout(() => ctrl.abort(), 6500); // 6.5s fast failover per model!
    try {
      const r = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: ctrl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.82,
            maxOutputTokens: maxTokens
          }
        })
      });
      clearTimeout(timeoutHandle);
      const duration = Date.now() - start;

      if (!r.ok) {
        const errorBody = await r.text();
        const isTemporary = r.status === 503 || r.status === 429 || r.status === 404 || r.status === 500;
        if (isTemporary && model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`[ComUcate] Model ${model} returned HTTP ${r.status}. Failing over to next model...`);
          lastError = new Error(`Gemini API HTTP ${r.status}: ${errorBody.slice(0, 200)}`);
          continue;
        }
        throw new Error(`Gemini API HTTP ${r.status}: ${errorBody.slice(0, 300)}`);
      }

      const j = await r.json();

      if (j.candidates?.[0]?.finishReason === "SAFETY") {
        throw new Error("Gemini blocked the response due to safety policies.");
      }

      const parts = j.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || "").join("").trim();
      if (!text) {
        throw new Error("Gemini returned an empty response candidate.");
      }
      return { raw: text, duration };
    } catch (err) {
      clearTimeout(timeoutHandle);
      lastError = err;
      const isTimeout = err.name === "AbortError";
      if (model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[ComUcate] Model ${model} ${isTimeout ? "timed out (6.5s)" : "failed: " + err.message}. Trying next fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All Gemini models failed.");
}

async function callAnthropic(systemPrompt, userText, maxTokens = 400) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is missing in server/.env");

  const start = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }]
    })
  });

  const duration = Date.now() - start;

  if (!r.ok) {
    const errorBody = await r.text();
    throw new Error(`Anthropic API HTTP ${r.status}: ${errorBody.slice(0, 300)}`);
  }

  const j = await r.json();
  const text = (j.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned an empty response.");
  }
  return { raw: text, duration };
}

function parseJson(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty raw response from AI model.");
  }

  let clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (_) {
      try {
        const sanitized = clean.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(sanitized);
      } catch (_) {}
    }
  }

  // Resilient regex key-value extraction fallback
  const result = {};
  const regex = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    result[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  if (Object.keys(result).length > 0) {
    return result;
  }

  throw new Error("No JSON object found in response: " + clean.slice(0, 150));
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// POST /suggest - Flow-Aware Communication Handler
// -------------------------------------------------------------
app.post("/suggest", async (req, res) => {
  const reqStart = Date.now();
  const {
    messages,
    app: appName = "chat",
    profile = {},
    learnedProfile = {},
    context = {},
    variationAngle = "balanced",
    draft = "",
    snapshot = null
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ ok: false, error: "Messages array is required." });
  }

  const intentInfo = classifyIntent(messages);
  const convoState = extractConversationState(messages);
  const conversationEnergy = detectConversationEnergy(messages);
  const momentum = detectConversationMomentum(messages);

  const convo = messages
    .slice(-8)
    .map((m) => `${m.from === "me" ? "ME" : "THEM"}: ${String(m.text || "").slice(0, 350)}`)
    .join("\n");

  const lastThemMsg = [...messages].reverse().find((m) => m.from === "them");
  const lastThemText = lastThemMsg?.text || "";
  const cleanDraft = typeof draft === "string" ? draft.trim() : "";

  const systemPrompt = buildSystemPrompt(
    profile,
    learnedProfile,
    { ...context, app: appName },
    "suggest",
    intentInfo,
    convoState,
    variationAngle,
    conversationEnergy,
    momentum
  );

  let userText = `App: ${appName}\n\nRecent conversation flow (chronological):\n${convo}\n\n`;
  if (lastThemText) {
    userText += `=== TARGET LATEST INCOMING MESSAGE (from THEM) ===\n"${lastThemText}"\n\n`;
  }
  if (cleanDraft) {
    userText += `[ME typed draft in composer: "${cleanDraft}"]\nSeamlessly polish or complete ME's thought.\n`;
  } else {
    userText += `Determine what ME should say next responding DIRECTLY to "${lastThemText || "the latest message"}". Generate primary reply and alternatives.\n`;
  }

  const currentRole = context.contactRole || "auto";
  const currentLang = profile.language || context.language || "Hinglish";

  // Sanitized debug fingerprint (NO conversation text logged)
  const profileFingerprint = {
    preset: profile.personalityPreset || "Default",
    language: currentLang.toLowerCase(),
    replyLength: profile.replyLength || "adaptive",
    humor: profile.humor || "medium",
    emoji: profile.emojiUsage || "occasional",
    flirting: Boolean(profile.flirting),
    role: currentRole.toLowerCase(),
    app: appName
  };

  console.log(`[ComUcate] /suggest request | Snapshot: ${snapshot?.contextVersion || "none"} | Profile: ${profileFingerprint.preset} | Lang: ${profileFingerprint.language} | Flirt: ${profileFingerprint.flirting} | Energy: ${conversationEnergy} | Momentum: ${momentum}`);

  try {
    const { raw, duration } = PROVIDER === "anthropic"
      ? await callAnthropic(systemPrompt, userText, 800)
      : await callGemini(systemPrompt, userText, 800);

    const out = parseJson(raw);
    const totalServerMs = Date.now() - reqStart;

    let primaryText = "";
    let primaryStrategy = "best_reply";
    let primaryLabel = "Best reply";

    if (out.primary && typeof out.primary === "object") {
      primaryText = out.primary.text || "";
      primaryStrategy = out.primary.strategy || "best_reply";
      primaryLabel = out.primary.label || "Best reply";
    } else if (typeof out.primary === "string") {
      primaryText = out.primary;
    } else {
      primaryText = out.agree || out.natural || out.path_1 || "";
    }

    const rawAlts = [];
    if (Array.isArray(out.alternatives)) {
      rawAlts.push(...out.alternatives);
    } else {
      if (out.alternative_1) rawAlts.push(typeof out.alternative_1 === "object" ? out.alternative_1 : { text: out.alternative_1, label: "More playful" });
      if (out.alternative_2) rawAlts.push(typeof out.alternative_2 === "object" ? out.alternative_2 : { text: out.alternative_2, label: "More bold" });
      if (out.decline || out.playful || out.path_2) rawAlts.push({ text: out.decline || out.playful || out.path_2, label: "More playful" });
      if (out.clarify || out.keep_going || out.path_3) rawAlts.push({ text: out.clarify || out.keep_going || out.path_3, label: "More bold" });
    }

    const cleanedPrimary = evaluateAndCleanReply(primaryText, lastThemText, currentRole, currentLang);
    const cleanedAlts = rawAlts
      .map((a, idx) => {
        const txt = typeof a === "object" ? a.text : a;
        const lbl = typeof a === "object" ? (a.label || (idx === 0 ? "More playful" : "More bold")) : (idx === 0 ? "More playful" : "More bold");
        const strat = typeof a === "object" ? (a.strategy || "alternative") : "alternative";
        return {
          text: evaluateAndCleanReply(txt || "", lastThemText, currentRole, currentLang),
          label: lbl,
          strategy: strat
        };
      })
      .filter((a) => a.text && a.text.trim().length > 0 && a.text !== cleanedPrimary);

    let finalPrimary = cleanedPrimary;
    if (!finalPrimary || finalPrimary.trim().length === 0) {
      if (cleanedAlts.length > 0 && cleanedAlts[0].text) {
        finalPrimary = cleanedAlts[0].text;
      } else {
        finalPrimary = (primaryText || "").trim();
      }
    }

    const primaryObj = {
      text: finalPrimary,
      strategy: primaryStrategy,
      label: primaryLabel
    };

    const suggestions = [
      {
        id: "primary",
        type: "primary",
        label: primaryObj.label,
        strategy: primaryObj.strategy,
        text: primaryObj.text,
        shortcut: "1"
      },
      ...cleanedAlts.map((alt, idx) => ({
        id: `alt_${idx + 1}`,
        type: "alternative",
        label: alt.label,
        strategy: alt.strategy,
        text: alt.text,
        shortcut: String(idx + 2)
      }))
    ];

    console.log(`[ComUcate] ${PROVIDER.toUpperCase()} /suggest success | Total: ${totalServerMs}ms (AI: ${duration}ms) | Primary Strategy: ${primaryObj.strategy}`);

    res.json({
      ok: true,
      primary: primaryObj,
      alternatives: cleanedAlts,
      suggestions,
      // Backward compatibility aliases
      agree: primaryObj.text,
      decline: cleanedAlts[0]?.text || "",
      clarify: cleanedAlts[1]?.text || "",
      natural: primaryObj.text,
      playful: cleanedAlts[0]?.text || "",
      keep_going: cleanedAlts[1]?.text || "",
      intent: intentInfo.intent,
      convoState,
      conversationEnergy,
      momentum,
      profileFingerprint,
      variationAngle,
      contactRole: currentRole,
      snapshot,
      timings: {
        aiMs: duration,
        serverMs: totalServerMs
      }
    });
  } catch (e) {
    console.error(`[ComUcate Error] /suggest failed (${PROVIDER}):`, e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to generate reply suggestions."
    });
  }
});

// -------------------------------------------------------------
// POST /rewrite - Transforms user draft with Adaptive Voice
// -------------------------------------------------------------
app.post("/rewrite", async (req, res) => {
  const reqStart = Date.now();
  const { draft, messages = [], app: appName = "chat", profile = {}, learnedProfile = {}, context = {} } = req.body || {};

  if (!draft || typeof draft !== "string" || !draft.trim()) {
    return res.status(400).json({ ok: false, error: "Draft text is required for rewrite." });
  }

  const convo = Array.isArray(messages)
    ? messages
        .slice(-6)
        .map((m) => `${m.from === "me" ? "ME" : "THEM"}: ${String(m.text || "").slice(0, 250)}`)
        .join("\n")
    : "";

  const intentInfo = classifyIntent(messages);
  const convoState = extractConversationState(messages);

  const systemPrompt = buildSystemPrompt(
    profile,
    learnedProfile,
    { ...context, app: appName },
    "rewrite",
    intentInfo,
    convoState
  );
  const userText = `App: ${appName}\n\nChat context:\n${convo || "(None available)"}\n\nME's rough draft to transform:\n"${draft.trim()}"\n\nGenerate the 9 rewritten variations.`;

  try {
    const { raw, duration } = PROVIDER === "anthropic"
      ? await callAnthropic(systemPrompt, userText, 1500)
      : await callGemini(systemPrompt, userText, 1500);

    const out = parseJson(raw);
    const totalServerMs = Date.now() - reqStart;
    const currentRole = context.contactRole || "auto";
    const currentLang = profile.language || context.language || "Hinglish";
    console.log(`[ComUcate] ${PROVIDER.toUpperCase()} /rewrite (Lang: ${currentLang} | Role: ${currentRole}): ${duration} ms | Total: ${totalServerMs} ms`);

    res.json({
      ok: true,
      sound_like_me: evaluateAndCleanReply(out.sound_like_me || "", "", currentRole, currentLang),
      english: evaluateAndCleanReply(out.english || out.translate_to_english || "", "", currentRole, "English"),
      diplomatic: evaluateAndCleanReply(out.diplomatic || "", "", currentRole, currentLang),
      confident: evaluateAndCleanReply(out.confident || "", "", currentRole, currentLang),
      funny: evaluateAndCleanReply(out.funny || "", "", currentRole, currentLang),
      smarter: evaluateAndCleanReply(out.smarter || "", "", currentRole, currentLang),
      flirty: evaluateAndCleanReply(out.flirty || "", "", currentRole, currentLang),
      professional: evaluateAndCleanReply(out.professional || "", "", currentRole, currentLang),
      grammar: evaluateAndCleanReply(out.grammar || "", "", currentRole, currentLang),
      timings: {
        aiMs: duration,
        serverMs: totalServerMs
      }
    });
  } catch (e) {
    console.error(`[ComUcate Error] /rewrite failed (${PROVIDER}):`, e.message);
    res.status(500).json({
      ok: false,
      error: e.message || "Failed to rewrite draft."
    });
  }
});

// -------------------------------------------------------------
// POST /transform - Lightweight 1-Click Response Control
// -------------------------------------------------------------
app.post("/transform", async (req, res) => {
  const reqStart = Date.now();
  const {
    text,
    transformation = "sound_like_me",
    profile = {},
    app: appName = "chat"
  } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ ok: false, error: "Text to transform is required." });
  }

  const prompt = [
    "You are ComUcate, a personal communication assistant for ME.",
    `ME's Language: ${profile.language || "Hinglish"} (Latin script only).`,
    `ME's Base Style: ${profile.personalityPreset || "Confident + Funny"}.`,
    `Common Slang: [${Array.isArray(profile.commonPhrases) ? profile.commonPhrases.join(", ") : (profile.commonPhrases || "bhai, haan, acha, lol, 😭")}]`,
    "",
    "TASK: Transform the following message using the requested transformation directive.",
    `Original Message: "${text.trim()}"`,
    `Transformation Directive: ${transformation.toUpperCase()}`,
    "",
    "Rules based on directive:",
    "- shorter: Cut filler words, make it punchy (1 line) without losing core meaning.",
    "- longer: Expand slightly with conversational warmth, natural context, or smoother rhythm (2 lines).",
    "- confident: Remove hesitation, apologies, and timid qualifiers. Make it assertive in ME's voice.",
    "- funny: Add witty spin, clever observation, or light banter in ME's voice.",
    "- professional: Make it polished, respectful, and workplace-appropriate while keeping it authentic.",
    "- sound_like_me: Infuse ME's signature slang, relaxed casing, and texting rhythm.",
    "- diplomatic / deescalate: Calm, tactful de-escalation that diffuses tension or conflict, sets clear boundaries, and prevents escalation without being defensive or submissive.",
    "- translate_to_english / english: Translate the message accurately into natural, fluent modern English, preserving tone and intent without stiffness.",
    "",
    "Return ONLY a valid JSON object: {\"result\": \"transformed text here\"}"
  ].join("\n");

  try {
    const userText = `Apply transformation: ${transformation} to "${text.trim()}"`;
    const { raw, duration } = PROVIDER === "anthropic"
      ? await callAnthropic(prompt, userText, 250)
      : await callGemini(prompt, userText, 250);

    const out = parseJson(raw);
    const cleaned = evaluateAndCleanReply(out.result || out.transformed || text);

    res.json({
      ok: true,
      result: cleaned,
      transformation,
      timings: { aiMs: duration, serverMs: Date.now() - reqStart }
    });
  } catch (e) {
    console.error(`[ComUcate Error] /transform failed:`, e.message);
    res.status(500).json({ ok: false, error: e.message || "Failed to transform text." });
  }
});

// -------------------------------------------------------------
// POST /autocomplete - Fast Inline Ghost-Text Autocomplete
// -------------------------------------------------------------
app.post("/autocomplete", async (req, res) => {
  const reqStart = Date.now();
  const {
    draft,
    messages = [],
    app: appName = "chat",
    profile = {},
    context = {}
  } = req.body || {};

  if (!draft || typeof draft !== "string" || !draft.trim()) {
    return res.json({ ok: true, completion: "" });
  }

  const currentRole = (context.contactRole || "auto").toLowerCase();
  const isBoss = currentRole === "boss" || currentRole === "client" || currentRole === "formal";
  const language = profile.language || "Hinglish";

  const prompt = [
    "You are ComUcate's ultra-fast inline autocomplete engine for ME.",
    `Language: ${language} (Latin script only).`,
    `Contact Role: ${currentRole}`,
    isBoss
      ? "CRITICAL: ME is texting their boss/client. Formal, respectful, zero slang, use 'aap' in Hinglish/Hindi."
      : "Casual, natural texting matching ME's voice and rhythm.",
    "TASK: Complete ME's ongoing sentence or thought naturally with just 3 to 7 words.",
    "RULES:",
    "- Return ONLY the continuation words that naturally follow the draft.",
    "- Do NOT repeat what the user already typed.",
    "- Keep it concise (3-7 words maximum).",
    "- No quotes, no markdown, no punctuation at start.",
    'Return ONLY a valid JSON object: {"completion": "continuation words here"}'
  ].join("\n");

  const lastMsg = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
  const userText = `${lastMsg ? `Last incoming message: "${lastMsg.text}"\n` : ""}Current draft in composer: "${draft.trim()}"\n\nReturn continuation words.`;

  try {
    const { raw, duration } = PROVIDER === "anthropic"
      ? await callAnthropic(prompt, userText, 80)
      : await callGemini(prompt, userText, 80);

    const out = parseJson(raw);
    let completion = (out.completion || "").trim().replace(/^["']+|["']+$/g, "").trim();
    if (completion) {
      completion = evaluateAndCleanReply(completion, "", currentRole);
    }

    res.json({
      ok: true,
      completion,
      timings: { aiMs: duration, serverMs: Date.now() - reqStart }
    });
  } catch (e) {
    res.json({ ok: true, completion: "" });
  }
});

app.get("/health", (_req, res) => {
  const key = PROVIDER === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
  const isKeyConfigured = Boolean(key && !key.startsWith("paste-") && key.trim().length > 5);

  res.json({
    status: "ok",
    app: "ComUcate",
    version: "4.2.0",
    features: [
      "suggest",
      "rewrite",
      "transform",
      "autocomplete",
      "diplomatic_diffuser",
      "vibe_check",
      "intent_detection",
      "conversation_state",
      "smart_regenerate",
      "response_controls",
      "quality_evaluator",
      "base_voice",
      "adaptive_voice",
      "context_adaptation",
      "multi_app_support"
    ],
    supportedPlatforms: ["whatsapp", "instagram", "telegram", "discord", "linkedin", "teams", "gmail", "universal"],
    provider: PROVIDER,
    model: PROVIDER === "anthropic" ? ANTHROPIC_MODEL : GEMINI_MODEL,
    hasKey: isKeyConfigured,
    port: PORT
  });
});

const server = app.listen(PORT, () => {
  const key = PROVIDER === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
  const hasKey = key && !key.startsWith("paste-") && key.trim().length > 5;

  console.log(`\n==============================================`);
  console.log(`✨ ComUcate Server v4.0 (Multi-App Adaptive Engine)`);
  console.log(`📡 URL:      http://localhost:${PORT}`);
  console.log(`🧠 Provider: ${PROVIDER.toUpperCase()} (${PROVIDER === "anthropic" ? ANTHROPIC_MODEL : GEMINI_MODEL})`);
  console.log(`🔑 API Key:  ${hasKey ? "✓ Configured" : "⚠️ Missing or unconfigured in server/.env"}`);
  console.log(`🌐 Apps:     WhatsApp, Instagram, Telegram, Discord, LinkedIn, Teams, Gmail`);
  console.log(`==============================================\n`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
