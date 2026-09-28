// ==============================================================================
// ComUcate v4.2 Comprehensive Verification & Quality Test Suite
// ==============================================================================

const SERVER_URL = "http://localhost:3000";

async function postSuggest(payload) {
  const start = Date.now();
  const res = await fetch(`${SERVER_URL}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  const elapsed = Date.now() - start;
  return { ...data, roundtripMs: elapsed };
}

async function runProfileDivergenceTest() {
  console.log("\n=======================================================");
  console.log("TEST 1: PROFILE DIVERGENCE TEST (Same incoming message)");
  console.log("Incoming: 'what are you doing tonight?'");
  console.log("=======================================================");

  const messages = [
    { from: "them", text: "what are you doing tonight?" }
  ];

  // Profile A: Professional + Friendly (English, Medium, no flirting, low humor)
  const profA = {
    personalityPreset: "Professional + Friendly",
    language: "English",
    replyLength: "medium",
    humor: "low",
    flirting: false,
    commonPhrases: ["sounds like a plan", "appreciate it", "let me know"]
  };

  // Profile B: Flirty + Playful (Hinglish, Medium, high humor, flirting enabled)
  const profB = {
    personalityPreset: "Flirty + Playful",
    language: "Hinglish",
    replyLength: "medium",
    humor: "high",
    flirting: true,
    commonPhrases: ["haha", "lol", "drama", "batao"]
  };

  // Profile C: Direct + Fast (English, Short, no humor, flirting disabled)
  const profC = {
    personalityPreset: "Direct + Fast",
    language: "English",
    replyLength: "short",
    humor: "none",
    flirting: false,
    commonPhrases: ["cool", "sure", "on it"]
  };

  const resA = await postSuggest({ messages, app: "instagram", profile: profA });
  const resB = await postSuggest({ messages, app: "instagram", profile: profB });
  const resC = await postSuggest({ messages, app: "instagram", profile: profC });

  console.log("\n[Profile A - Professional + Friendly (English)]:");
  console.log(`  Best reply: "${resA.primary?.text || resA.agree}" (${resA.roundtripMs}ms)`);
  console.log(`  Fingerprint:`, JSON.stringify(resA.profileFingerprint));

  console.log("\n[Profile B - Flirty + Playful (Hinglish)]:");
  console.log(`  Best reply: "${resB.primary?.text || resB.agree}" (${resB.roundtripMs}ms)`);
  if (resB.alternatives?.length) {
    resB.alternatives.forEach(a => console.log(`  Alt (${a.label}): "${a.text}"`));
  }
  console.log(`  Fingerprint:`, JSON.stringify(resB.profileFingerprint));

  console.log("\n[Profile C - Direct + Fast (English)]:");
  console.log(`  Best reply: "${resC.primary?.text || resC.agree}" (${resC.roundtripMs}ms)`);
  console.log(`  Fingerprint:`, JSON.stringify(resC.profileFingerprint));

  const textA = (resA.primary?.text || "").toLowerCase();
  const textB = (resB.primary?.text || "").toLowerCase();
  const textC = (resC.primary?.text || "").toLowerCase();

  const isDivergent = textA !== textB && textB !== textC && textA !== textC;
  console.log(`\n✓ Divergence Result: ${isDivergent ? "PASS (Outputs are materially different)" : "FAIL"}`);
}

async function runScenariosTest() {
  console.log("\n=======================================================");
  console.log("TEST 2: 20 REAL-WORLD CONVERSATION SCENARIOS");
  console.log("=======================================================");

  const scenarios = [
    {
      name: "1. Casual Inquiry",
      incoming: "what are you doing tonight?",
      context: { app: "instagram", role: "friend" },
      profile: { personalityPreset: "Confident + Funny", language: "Hinglish", humor: "high", flirting: false }
    },
    {
      name: "2. Flirting / Chemistry",
      incoming: "you never have time for me",
      context: { app: "instagram", role: "auto" },
      profile: { personalityPreset: "Flirty + Playful", language: "Hinglish", humor: "high", flirting: true }
    },
    {
      name: "3. Playful Teasing",
      incoming: "wow finally you replied 😂",
      context: { app: "instagram", role: "friend" },
      profile: { personalityPreset: "Confident + Funny", language: "Hinglish", humor: "high", flirting: false }
    },
    {
      name: "4. Dry / Low Energy ('k')",
      incoming: "k",
      context: { app: "instagram", role: "auto" },
      profile: { personalityPreset: "Confident + Funny", language: "Hinglish", humor: "high", flirting: false }
    },
    {
      name: "5. Sincere Apology",
      incoming: "im sorry i was rude earlier",
      context: { app: "whatsapp", role: "friend" },
      profile: { personalityPreset: "Friendly + Casual", language: "English", humor: "low", flirting: false }
    },
    {
      name: "6. Group Invitation",
      incoming: "come with us tomorrow for the party",
      context: { app: "instagram", role: "friend" },
      profile: { personalityPreset: "Confident + Funny", language: "Hinglish", humor: "high", flirting: false }
    },
    {
      name: "7. Emotional / Vulnerable",
      incoming: "honestly i feel like you don't care anymore",
      context: { app: "whatsapp", role: "auto" },
      profile: { personalityPreset: "Friendly + Casual", language: "English", humor: "none", flirting: false }
    },
    {
      name: "8. Natural Sign-off / Goodnight",
      incoming: "okay goodnight",
      context: { app: "instagram", role: "auto" },
      profile: { personalityPreset: "Friendly + Casual", language: "Hinglish", humor: "low", flirting: false }
    },
    {
      name: "9. Stagnant Reopening",
      incoming: "haha true",
      context: { app: "instagram", role: "friend" },
      profile: { personalityPreset: "Confident + Funny", language: "Hinglish", humor: "high", flirting: false }
    },
    {
      name: "10. Professional Request (Boss)",
      incoming: "Can you send me the report before 5?",
      context: { app: "teams", role: "boss" },
      profile: { personalityPreset: "Professional + Polite", language: "English", humor: "none", flirting: false }
    },
    {
      name: "11. Contextual Constraint (Papa ate hain)",
      incoming: "Bataya toh tha sunday sat papa ate hain 😭",
      context: { app: "instagram", role: "auto" },
      profile: { personalityPreset: "Flirty + Playful", language: "Hinglish", humor: "high", flirting: true }
    },
    {
      name: "12. Food & Outing Decision",
      incoming: "Where should we go to eat tonight?",
      context: { app: "whatsapp", role: "friend" },
      profile: { personalityPreset: "Confident + Funny", language: "English", humor: "medium", flirting: false }
    },
    {
      name: "13. Weekend Availability",
      incoming: "Are you free this Saturday afternoon?",
      context: { app: "instagram", role: "auto" },
      profile: { personalityPreset: "Friendly + Casual", language: "English", humor: "low", flirting: false }
    },
    {
      name: "14. Passive Aggressive / Sarcastic",
      incoming: "Sure, whatever you say.",
      context: { app: "whatsapp", role: "auto" },
      profile: { personalityPreset: "Friendly + Casual", language: "English", humor: "none", flirting: false }
    },
    {
      name: "15. Urgent Request",
      incoming: "Call me immediately it's urgent",
      context: { app: "whatsapp", role: "auto" },
      profile: { personalityPreset: "Direct + Fast", language: "English", humor: "none", flirting: false }
    },
    {
      name: "16. Sweet Compliment",
      incoming: "You looked really nice today in that jacket",
      context: { app: "instagram", role: "auto" },
      profile: { personalityPreset: "Flirty + Playful", language: "English", humor: "high", flirting: true }
    },
    {
      name: "17. Late Reply Excuse",
      incoming: "Sorry just saw your text, was trapped in traffic",
      context: { app: "whatsapp", role: "friend" },
      profile: { personalityPreset: "Friendly + Casual", language: "Hinglish", humor: "medium", flirting: false }
    },
    {
      name: "18. Work Milestone (Colleague)",
      incoming: "Did you push the PR for the auth bug?",
      context: { app: "teams", role: "colleague" },
      profile: { personalityPreset: "Professional + Collaborative", language: "English", humor: "low", flirting: false }
    },
    {
      name: "19. Mock Drama / Accusation",
      incoming: "You forgot our plans didn't you 😭",
      context: { app: "instagram", role: "friend" },
      profile: { personalityPreset: "Confident + Funny", language: "Hinglish", humor: "high", flirting: false }
    },
    {
      name: "20. Meeting Reschedule Request",
      incoming: "Can we push our 3 PM sync to tomorrow morning?",
      context: { app: "teams", role: "colleague" },
      profile: { personalityPreset: "Professional + Collaborative", language: "English", humor: "none", flirting: false }
    }
  ];

  let passed = 0;
  const latencies = [];

  for (const s of scenarios) {
    const res = await postSuggest({
      messages: [{ from: "them", text: s.incoming }],
      app: s.context.app,
      context: { contactRole: s.context.role },
      profile: s.profile
    });

    const reply = res.primary?.text || res.agree || "";
    const isGood = reply && reply.length > 3 && !reply.toLowerCase().includes("certainly") && !reply.toLowerCase().includes("as an ai");
    if (isGood) passed++;
    latencies.push(res.roundtripMs);

    console.log(`\nScenario ${s.name}:`);
    console.log(`  Incoming: "${s.incoming}"`);
    console.log(`  Best reply: "${reply}"`);
    if (res.alternatives?.length) {
      console.log(`  Alternative: "${res.alternatives[0].text}" [${res.alternatives[0].label}]`);
    }
    console.log(`  Strategy: ${res.primary?.strategy || "N/A"} | Energy: ${res.conversationEnergy} | Latency: ${res.roundtripMs}ms`);
  }

  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log("\n=======================================================");
  console.log(`SCENARIOS TEST SUMMARY: ${passed}/${scenarios.length} passed.`);
  console.log(`Average Latency: ${avgLatency}ms (Min: ${Math.min(...latencies)}ms, Max: ${Math.max(...latencies)}ms)`);
  console.log("=======================================================");
}

async function main() {
  try {
    await runProfileDivergenceTest();
    await runScenariosTest();
  } catch (err) {
    console.error("Test Suite Error:", err);
  }
}

main();
