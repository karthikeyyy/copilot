// ==============================================================================
// ComUcate v4.2 — Golden Regression Suite (30 Comprehensive Test Cases)
// Tests: Context Accuracy, Latest Message Targeting, Voice Fidelity, Latency.
// ==============================================================================

import http from "node:http";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 3000;

function sendSuggestRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const start = Date.now();
    const req = http.request(
      {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: "/suggest",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const duration = Date.now() - start;
          try {
            const parsed = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data: parsed, duration });
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${body.slice(0, 150)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ------------------------------------------------------------------------------
// Golden Test Cases Definition
// ------------------------------------------------------------------------------
const GOLDEN_TESTS = [
  // 1. Exact Critical Bug Scenario (Genre Preference)
  {
    id: 1,
    name: "Genre Preference (Target Bug Scenario)",
    profile: {
      personalityPreset: "Flirty + Playful",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true,
      commonPhrases: ["haha", "hmm", "acha ji", "drama", "😭", "💀"]
    },
    context: { contactRole: "auto" },
    messages: [
      { from: "them", text: "im gonna binge watch shit today" },
      { from: "them", text: "i deserve ek din a break" },
      { from: "me", text: "Acha series?" },
      { from: "them", text: "yea" },
      { from: "me", text: "Acha what kinda genre do you like?" },
      { from: "them", text: "romance, thriller n fiction" }
    ],
    targetIncoming: "romance, thriller n fiction",
    mustContainAny: ["thriller", "romance", "fiction", "combination", "series", "taste", "chaotic", "recommend"],
    mustNotContainAny: ["sync up", "weekend and make it happen", "coffee", "meeting tomorrow"]
  },

  // 2. Playful Tease / Flirting
  {
    id: 2,
    name: "Playful Tease (You never have time for me)",
    profile: {
      personalityPreset: "Flirty + Playful",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "Hey! What's up?" },
      { from: "them", text: "you never have time for me" }
    ],
    targetIncoming: "you never have time for me",
    mustContainAny: ["complaint", "ilzaam", "miss", "compensate", "drama", "time", "batao"],
    mustNotContainAny: ["sync up", "as an ai", "i understand your concern"]
  },

  // 3. Late Reply Comeback
  {
    id: 3,
    name: "Late Reply Banter",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "hey sorry was caught up" },
      { from: "them", text: "wow finally you replied 😂" }
    ],
    targetIncoming: "wow finally you replied 😂",
    mustContainAny: ["miss", "entry", "wait", "phone", "busy", "itna"],
    mustNotContainAny: ["sync up", "let's sync"]
  },

  // 4. Dry Single Letter ("k")
  {
    id: 4,
    name: "Dry Single Letter ('k')",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "sent you the details" },
      { from: "them", text: "k" }
    ],
    targetIncoming: "k",
    mustContainAny: ["essay", "lamba", "darr", "sirf", "itna", "k"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 5. Sincere Apology
  {
    id: 5,
    name: "Sincere Apology Reaction",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "low",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "im sorry i was rude earlier, was super overwhelmed" }
    ],
    targetIncoming: "im sorry i was rude earlier, was super overwhelmed",
    mustContainAny: ["good", "alright", "worry", "appreciate", "thanks", "happens", "fine", "apologize", "better"],
    mustNotContainAny: ["sync up", "bhai", "yaar"]
  },

  // 6. Story Reply (Solid 8)
  {
    id: 6,
    name: "Story Rating Reply ('solid 8')",
    profile: {
      personalityPreset: "Flirty + Playful",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true
    },
    context: { contactRole: "auto" },
    messages: [
      { from: "me", text: "On the scale of 1 to 10 how much you rate yourself on this" },
      { from: "them", text: "solid 8" }
    ],
    targetIncoming: "solid 8",
    mustContainAny: ["8", "10", "points", "baaki", "confidence", "rate"],
    mustNotContainAny: ["sync up this weekend", "let's sync"]
  },

  // 7. Weekend Dinner Invite
  {
    id: 7,
    name: "Weekend Dinner Invite",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "free for dinner tomorrow around 8?" }
    ],
    targetIncoming: "free for dinner tomorrow around 8?",
    mustContainAny: ["8", "dinner", "done", "chal", "kahan", "treat", "plan", "khane", "free", "batao"],
    mustNotContainAny: ["per my last", "as an ai"]
  },

  // 8. Boss Report Request
  {
    id: 8,
    name: "Boss Urgent Deck Request",
    profile: {
      personalityPreset: "Professional + Respectful",
      language: "English (US)",
      replyLength: "short",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "boss" },
    messages: [
      { from: "them", text: "Can you send the updated presentation before 5 PM today?" }
    ],
    targetIncoming: "Can you send the updated presentation before 5 PM today?",
    mustContainAny: ["5", "send", "have it", "presentation", "deck", "shortly", "will"],
    mustNotContainAny: ["bhai", "yaar", "tu", "lol", "😭", "sync up this weekend"]
  },

  // 9. Colleague PR Bug
  {
    id: 9,
    name: "Colleague PR Review",
    profile: {
      personalityPreset: "Direct + Fast",
      language: "English (Casual)",
      replyLength: "short",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "colleague" },
    messages: [
      { from: "them", text: "Did you push the PR for the auth bug fix?" }
    ],
    targetIncoming: "Did you push the PR for the auth bug fix?",
    mustContainAny: ["pushed", "pr", "on it", "done", "branch", "check"],
    mustNotContainAny: ["bhai", "yaar", "baby", "sync up this weekend"]
  },

  // 10. Natural Sign-off
  {
    id: 10,
    name: "Natural Goodnight Sign-off",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "Hinglish",
      replyLength: "short",
      humor: "low",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "chalo talk soon" },
      { from: "them", text: "okay goodnight" }
    ],
    targetIncoming: "okay goodnight",
    mustContainAny: ["goodnight", "gn", "so jao", "kal"],
    mustNotContainAny: ["sync up", "what do you think about"]
  },

  // 11. Contextual Constraint (Papa ate hain)
  {
    id: 11,
    name: "Family Constraint Tease",
    profile: {
      personalityPreset: "Flirty + Playful",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "milte hain phir saturday" },
      { from: "them", text: "Bataya toh tha sunday sat papa ate hain 😭" }
    ],
    targetIncoming: "Bataya toh tha sunday sat papa ate hain 😭",
    mustContainAny: ["papa", "sunday", "sat", "booked", "madam", "calendar", "samajh", "yaad", "plan", "din"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 12. Food Options Decision
  {
    id: 12,
    name: "Food Decision (Pizza vs Sushi)",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "Should we order sushi or pizza tonight?" }
    ],
    targetIncoming: "Should we order sushi or pizza tonight?",
    mustContainAny: ["pizza", "sushi", "order", "vote", "craving", "down for"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 13. Compliment Reaction
  {
    id: 13,
    name: "Compliment Reaction",
    profile: {
      personalityPreset: "Flirty + Playful",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "You looked really nice today in that jacket" }
    ],
    targetIncoming: "You looked really nice today in that jacket",
    mustContainAny: ["jacket", "thanks", "style", "notice", "noticing", "fashion", "appreciate", "glad"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 14. Passive Aggressive De-escalation
  {
    id: 14,
    name: "Passive Aggressive De-escalation",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "I think we should do option B" },
      { from: "them", text: "Sure, whatever you say." }
    ],
    targetIncoming: "Sure, whatever you say.",
    mustContainAny: ["talk", "bothering", "annoyed", "wrong", "sense", "mean", "say", "option", "like that"],
    mustNotContainAny: ["sync up this weekend", "let's sync"]
  },

  // 15. Urgent Emergency Call
  {
    id: 15,
    name: "Urgent Call Request",
    profile: {
      personalityPreset: "Direct + Fast",
      language: "English (Casual)",
      replyLength: "short",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "Call me immediately it's urgent" }
    ],
    targetIncoming: "Call me immediately it's urgent",
    mustContainAny: ["calling", "on it", "second", "dialing", "now"],
    mustNotContainAny: ["haha", "sync up this weekend"]
  },

  // 16. Late Reply Apology Excuse
  {
    id: 16,
    name: "Traffic Excuse Reaction",
    profile: {
      personalityPreset: "Friendly + Casual",
      language: "Hinglish",
      replyLength: "medium",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "Sorry just saw your text, was trapped in traffic for 2 hours" }
    ],
    targetIncoming: "Sorry just saw your text, was trapped in traffic for 2 hours",
    mustContainAny: ["traffic", "koi nahi", "chill", "ghar", "pareshan"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 17. Mock Drama Accusation
  {
    id: 17,
    name: "Mock Drama Accusation",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: true
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "You forgot our plans didn't you 😭" }
    ],
    targetIncoming: "You forgot our plans didn't you 😭",
    mustContainAny: ["ilzaam", "yaad", "busy", "plan", "bhoola", "darr"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 18. Meeting Reschedule
  {
    id: 18,
    name: "Meeting Reschedule Request",
    profile: {
      personalityPreset: "Professional + Friendly",
      language: "English (US)",
      replyLength: "medium",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "colleague" },
    messages: [
      { from: "them", text: "Can we push our 3 PM sync to tomorrow morning?" }
    ],
    targetIncoming: "Can we push our 3 PM sync to tomorrow morning?",
    mustContainAny: ["tomorrow", "morning", "works", "time", "calendar", "reschedule"],
    mustNotContainAny: ["bhai", "tu", "sync up this weekend and make it happen"]
  },

  // 19. Stagnant Reopening ('haha true')
  {
    id: 19,
    name: "Stagnant Reopening ('haha true')",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "me", text: "bhai wo movie kafi overrated thi" },
      { from: "them", text: "haha true" }
    ],
    targetIncoming: "haha true",
    mustContainAny: ["maan", "sach", "bol", "point", "dekh", "batao", "wahi", "hype", "movie"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 20. Emotional Vulnerability
  {
    id: 20,
    name: "Emotional Vulnerability",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "close" },
    messages: [
      { from: "them", text: "honestly i feel like you don't care anymore" }
    ],
    targetIncoming: "honestly i feel like you don't care anymore",
    mustContainAny: ["care", "true", "talk", "mean", "not true", "feel"],
    mustNotContainAny: ["haha", "lol", "sync up this weekend"]
  },

  // 21. Vacation in Goa
  {
    id: 21,
    name: "Vacation Sharing (Goa)",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "Just landed in Goa! Weather is unreal" }
    ],
    targetIncoming: "Just landed in Goa! Weather is unreal",
    mustContainAny: ["goa", "mast", "weather", "photos", "enjoy", "jealous"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 22. Skipped Gym Workout
  {
    id: 22,
    name: "Gym Workout Guilt",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "skipped leg day today, feeling so guilty haha" }
    ],
    targetIncoming: "skipped leg day today, feeling so guilty haha",
    mustContainAny: ["leg", "gym", "guilt", "kal", "rest", "aaj"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 23. Music Album On Repeat
  {
    id: 23,
    name: "Music Album On Repeat",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "Listening to the new album on repeat, it's so good" }
    ],
    targetIncoming: "Listening to the new album on repeat, it's so good",
    mustContainAny: ["album", "song", "track", "favorite", "listen", "recommend"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 24. Reel Share Reaction
  {
    id: 24,
    name: "Reel Share Reaction",
    profile: {
      personalityPreset: "Confident + Funny",
      language: "Hinglish",
      replyLength: "medium",
      humor: "high",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "this reel reminded me of you so much 😂" }
    ],
    targetIncoming: "this reel reminded me of you so much 😂",
    mustContainAny: ["reel", "itna", "kya", "aisa", "drama", "bhej", "achi", "cheez", "harkat", "clear", "pehle"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 25. Recommendation Request (Bored)
  {
    id: 25,
    name: "Movie Recommendation Request",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "recommend something good to watch tonight, any genre" }
    ],
    targetIncoming: "recommend something good to watch tonight, any genre",
    mustContainAny: ["watch", "check out", "movie", "series", "depends", "good", "seen", "tier", "show", "wild", "severance"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 26. Favor Gratitude
  {
    id: 26,
    name: "Favor Gratitude",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "short",
      humor: "none",
      emojiUsage: "occasional",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "thank you so much for helping me out with that earlier!" }
    ],
    targetIncoming: "thank you so much for helping me out with that earlier!",
    mustContainAny: ["welcome", "anytime", "happy to help", "glad", "no worries"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 27. Late Night Cant Sleep
  {
    id: 27,
    name: "Late Night Cant Sleep",
    profile: {
      personalityPreset: "Flirty + Playful",
      language: "Hinglish",
      replyLength: "medium",
      humor: "medium",
      emojiUsage: "occasional",
      flirting: true
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "cannot sleep at all, mind is racing" }
    ],
    targetIncoming: "cannot sleep at all, mind is racing",
    mustContainAny: ["neend", "sleep", "soch", "kya", "baat", "chalo", "thoughts", "raat", "itne", "dimag", "mind"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 28. Client Deliverables Update
  {
    id: 28,
    name: "Client Deliverables Update",
    profile: {
      personalityPreset: "Professional + Respectful",
      language: "English (US)",
      replyLength: "medium",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "boss" },
    messages: [
      { from: "them", text: "Please provide an update on the milestone deliverables." }
    ],
    targetIncoming: "Please provide an update on the milestone deliverables.",
    mustContainAny: ["milestone", "update", "track", "progress", "share", "deliverables"],
    mustNotContainAny: ["bhai", "yaar", "tu", "sync up this weekend"]
  },

  // 29. Routine Boredom / Deep Thought
  {
    id: 29,
    name: "Routine Boredom Deep Thought",
    profile: {
      personalityPreset: "Smart + Casual",
      language: "English (Casual)",
      replyLength: "medium",
      humor: "low",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "friend" },
    messages: [
      { from: "them", text: "do you ever feel like you're just stuck in a routine?" }
    ],
    targetIncoming: "do you ever feel like you're just stuck in a routine?",
    mustContainAny: ["routine", "feel", "definitely", "break", "stuck", "sometimes"],
    mustNotContainAny: ["sync up this weekend"]
  },

  // 30. Quick Call Availability Check
  {
    id: 30,
    name: "Quick Call Availability",
    profile: {
      personalityPreset: "Direct + Fast",
      language: "English (Casual)",
      replyLength: "short",
      humor: "none",
      emojiUsage: "none",
      flirting: false
    },
    context: { contactRole: "colleague" },
    messages: [
      { from: "them", text: "are you free to jump on a quick call right now?" }
    ],
    targetIncoming: "are you free to jump on a quick call right now?",
    mustContainAny: ["free", "call", "in a", "minutes", "hop on", "give me"],
    mustNotContainAny: ["bhai", "sync up this weekend"]
  }
];

// ------------------------------------------------------------------------------
// Runner Function
// ------------------------------------------------------------------------------
async function runGoldenSuite() {
  console.log("=================================================================");
  console.log("COMUCATE v4.2 — GOLDEN REGRESSION TEST SUITE (30 TEST CASES)");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;
  const latencies = [];

  for (const t of GOLDEN_TESTS) {
    process.stdout.write(`[Test ${t.id}/30] ${t.name}... `);

    try {
      const payload = {
        messages: t.messages,
        app: "instagram",
        profile: t.profile,
        context: t.context,
        snapshot: {
          conversationId: `test_convo_${t.id}`,
          latestIncomingId: `them_${t.id}`,
          contextVersion: `v42_${t.id}`,
          requestId: t.id
        }
      };

      const res = await sendSuggestRequest(payload);
      latencies.push(res.duration);

      if (res.statusCode !== 200 || !res.data || !res.data.ok) {
        console.log(`FAILED (HTTP ${res.statusCode})`);
        console.error("  Error:", res.data?.error || "Unknown server error");
        failed++;
        continue;
      }

      const reply = res.data.primary?.text || "";
      const replyLower = reply.toLowerCase();

      // Check 1: Reply must exist
      if (!reply || reply.trim().length === 0) {
        console.log("FAILED (Empty reply generated)");
        failed++;
        continue;
      }

      // Check 2: Banned generic clichés check
      const hasBanned = (t.mustNotContainAny || []).some((b) => replyLower.includes(b.toLowerCase()));
      if (hasBanned) {
        console.log("FAILED (Contained banned phrase!)");
        console.error(`  Generated: "${reply}"`);
        failed++;
        continue;
      }

      // Check 3: Semantic relevance check
      const hasRelevant = (t.mustContainAny || []).some((kw) => replyLower.includes(kw.toLowerCase()));
      if (!hasRelevant) {
        console.log("FAILED (Did not address latest incoming message!)");
        console.error(`  Incoming: "${t.targetIncoming}"`);
        console.error(`  Generated: "${reply}"`);
        console.error(`  Expected any of: [${t.mustContainAny.join(", ")}]`);
        failed++;
        continue;
      }

      console.log(`PASS (${res.duration}ms)`);
      console.log(`  -> "${reply}"`);
      passed++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }
  }

  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

  console.log("\n=================================================================");
  console.log(`RESULTS: ${passed}/${GOLDEN_TESTS.length} Passed (${failed} Failed)`);
  console.log(`Latency: Avg ${avgLatency}ms (Min: ${minLatency}ms, Max: ${maxLatency}ms)`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runGoldenSuite();
