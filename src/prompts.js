(function (global) {
  "use strict";

  function normalizeText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function profileContextBlock(profile) {
    const fullName =
      normalizeText(profile?.full_name) ||
      normalizeText(profile?.name) ||
      normalizeText(profile?.fullName);
    const headline = normalizeText(profile?.headline);
    const company =
      normalizeText(profile?.company) ||
      normalizeText(profile?.current_company) ||
      normalizeText(profile?.company_name);
    const location = normalizeText(profile?.location);
    const about =
      normalizeText(profile?.about) || normalizeText(profile?.summary);
    const recentExperience =
      normalizeText(profile?.recent_experience) ||
      normalizeText(profile?.recentExperience) ||
      normalizeText(profile?.experience);
    const profileUrl =
      normalizeText(profile?.profile_url) ||
      normalizeText(profile?.url) ||
      normalizeText(profile?.linkedin_url);
    const missingKeyFields = !company || !headline || !about;
    const fallbackExcerpt = missingKeyFields
      ? normalizeText(profile?.excerpt_fallback)
      : "";

    return `
profile_context:
- profile_url: ${profileUrl || "(unknown)"}
- full_name: ${fullName || "(unknown)"}
- headline: ${headline || "(unknown)"}
- company: ${company || "(unknown)"}
- location: ${location || "(unknown)"}
- about: ${about || "(unknown)"}
- recent_experience: ${recentExperience || "(unknown)"}${
      fallbackExcerpt
        ? `

profile_excerpt_fallback (sanitized, max 800 chars):
${fallbackExcerpt}`
        : ""
    }`;
  }

  /**
--------------------------------EXTRACT PROFILE ------------------------------------------
  * Purpose: Build an extraction-only system prompt for profile enrichment.
   * Used when: Clicking ?? Enrich data.
   * Inputs: none
   * Output: string (system prompt text)
   */
  function buildProfileExtractionPrompt() {
    return `Extract structured profile fields from the provided LinkedIn profile context.

Return strict JSON only (no markdown, no prose) with exactly:
{
  "company": string,
  "headline": string,
  "language": string
}

Rules:
- "headline" means the person's current job title/role (cargo), not a marketing headline.
- Ignore/remove leading ordinal or line markers in headline, like "2�", "1�", "3�", "#2", "I", "II", "III", and similar.
- "company" must be only the company/organization name.
- "language" must be the dominant profile language (prefer: Portuguese, English, Dutch, Spanish).
- If possible, return language as one of: Portuguese, English, Dutch, Spanish.
- Never invent facts; use only the provided profile context.
- If a value cannot be confidently extracted, return an empty string for that field.`;
  }

  /**
 --------------------------------CREATE INVITATION ------------------------------------------
  * Purpose: Build an invitation-writing-only system prompt.
   * Used when: Clicking Generate invite.
   * Inputs: { language?: string, additionalPrompt?: string }
   * Output: string (system prompt text)
   */
  function buildInviteTextPrompt({ language, additionalPrompt } = {}) {
    const inviteLanguage = normalizeText(language) || "Portuguese";
    const prompt = `Write a LinkedIn connection invitation in ${inviteLanguage} with MAX 300 characters (including spaces). STRICT.

   Primary objective: maximize connection acceptance rate (not replies).
   The invitation must be a single paragraph (no line breaks). Aim for 220-280 characters.

   KEY PRINCIPLES (optimize acceptance):
   - Relevance beats cleverness: a concrete, verifiable hook increases trust.
   - Notes that feel generic/salesy can reduce acceptance; if you lack a real hook, prefer sending WITHOUT a note.

   MANDATORY STRUCTURE (when invite_text is not empty):
   1) Start with "Olá {first name from profile}". If first name is missing/unknown, start with "Olá,".
   2) Brief factual reference (ONLY verifiable).
   3) One causal linkage sentence connecting their profile/context to my atuação (neutral, peer-level).
   4) Close with a short low-friction sentence about connecting (NO question mark).

   CONTEXT PRIORITIZATION (pick the FIRST available and DO NOT mix multiple weak hooks):
   A) If user indicates they know the person (met/worked together/same client/class/community) → use that specific context (event + date or setting if provided).
   B) Else if user provides a mutual connection name or “via X” → use that.
   C) Else if user provides shared group/community/program/company overlap (alumni, group, accelerator, event, forum) → use that.
   D) Else if user provides common ground inputs (topic, stack, domain, initiative) → use that.
   E) Else use ONE specific profile fact (role, company, post topic, project/keyword) → keep it factual.
   F) Else (no real hook at all) → return an empty note (invite_text = "") to signal “send without note”.

   HARD RULES:
   - Single paragraph, no emojis, no hashtags.
   - Avoid praise/flattery/emotional adjectives (e.g., “incrível”, “admiro”, “sensacional”).
   - Use profile-observation verbs and never invent facts.
   - Do NOT end with a question.
   - Do NOT mention meetings, calls, agenda, demos, proposals, pricing, or presenting services.
   - Closing should only express openness to connect (e.g., “Vamos nos conectar por aqui.” / “Fico à disposição para conectar por aqui.”).

   Output format:
   Return valid JSON only (no markdown, no extra text):
   {
     "invite_text": string
   }

   Validation:
   - If invite_text is not empty: must start with "Olá" and must NOT end with "?".
   - Character count must be <= 300 (including spaces).`;

    const appended = normalizeText(additionalPrompt);
    if (!appended) return prompt;
    return `${prompt}\n\nAdditional context from user:\n${appended}`;
  }

  /**
  --------------------------------FIRST MESSAGE ------------------------------------------
  * Purpose: Build a first-message writing-only system prompt.
   * Used when: Clicking Generate first message.
   * Inputs: { language?: string, additionalPrompt?: string }
   * Output: string (system prompt text)
   */
  function buildFirstMessageTextPrompt({ language, additionalPrompt } = {}) {
    const langRule =
      normalizeText(language) && normalizeText(language) !== "auto"
        ? normalizeText(language)
        : "the dominant language of the provided profile_context and profile_excerpt_fallback";

    const userContext = normalizeText(additionalPrompt);

    const basePrompt = `Write a simple, natural first LinkedIn message in ${langRule} after connection acceptance.

   Tone:
   - Calm, direct, human.
   - No corporate language, no enthusiasm, no flattery, no profile analysis.

   NON-NEGOTIABLE USER CONTEXT RULE:
   - If user context is present, you MUST base the message on a SHARED SIMILARITY using "nós" / "a gente" framing.
   - Do NOT frame it as "eu me interesso" or "meu interesse".
   - Transform the user context into a single sentence starting with something like:
     - "Parece que compartilhamos..."
     - "Pelo que vi, temos em comum..."
     - "Parece que estamos alinhados em..."
   - Do not quote the context verbatim if it sounds unnatural; rewrite it in a human way.
   - No technical detail; keep it relational and high-level.
   - The message is INVALID if it ignores the user context when provided.

   USER CONTEXT (must use if present):
   ${userContext ? userContext : "(none)"}

   Primary structure (keep it short, 3 lines):
   1) Greeting + appreciation for accepting the connection.
   2) Shared similarity sentence using "nós/a gente" and the USER CONTEXT (mandatory if context is present).
   3) Light, optional invitation phrased as mutual interest:
      - Use "podemos" / "a gente pode" / "vale trocar uma ideia"
      - End with "se você achar interessante" (or equivalent)
      - Do NOT say "fico à disposição" or anything that sounds submissive.

   Critical do-not rules:
   - Do NOT use intensifiers like "muito", "super", "bastante", "extremamente".
   - Avoid redundancy (do not repeat the same idea twice).
   - No praise, no awards, no CV language.
   - No consultant tone.
   - No agenda justification.
   - No strategic/technical questions.
   - Prefer ZERO questions.

   Constraints:
   - Max 600 characters.
   - 2–3 short lines.
   - No emojis.
   - No hashtags.
   - Plain text only.

   Target vibe (match this style, do not copy literally):
   "Oi Ricardo, obrigado por aceitar a conexão.
   Parece que compartilhamos essa visão de transformação mais profunda nas organizações.
   Se você achar interessante, podemos trocar uma ideia sobre isso."`;

    return basePrompt;
  }

  /**
   * Purpose: Build the follow-up generation system prompt.
   * Used when: Clicking Generate follow-up.
   * Inputs: { language?: string, objective?: string, includeStrategy?: boolean, strategyText?: string, chatHistory?: Array }
   * Output: string (system prompt text)
   */
  function buildFollowupPrompt({
    language,
    objective,
    includeStrategy,
    strategyText,
    chatHistory,
  } = {}) {
    const languageRule = normalizeText(language) || "auto";
    const objectiveHint = normalizeText(objective);
    const strategyHint = includeStrategy ? normalizeText(strategyText) : "";
    const hasChatHistory = normalizeText(chatHistory).length > 0;
    return `Write a reply message for an ongoing LinkedIn conversation.

Language rules:
- If a specific language is provided, respond in that language.
- If language is "auto", detect dominant conversation language and use it.
- Never default to English unless conversation is in English.

Selected language setting: ${languageRule}

Tone and style:
- Peer-level, neutral, specific, non-salesy.
- Keep it concise (1-2 short paragraphs).
- Maintain natural conversation tone.

Constraints:
- Use only the provided context.
- Do not invent facts.
- Focus strictly on the user's objective.
${objectiveHint ? "- The objective is provided and must be prioritized." : ""}
${strategyHint ? "- Apply the provided strategy guidance." : ""}
${hasChatHistory ? "- Use the provided chat history to stay consistent with the thread." : ""}

Output plain text only.`;
  }

  /**
   * Purpose: Backward-compatible alias for enrich prompt builder.
   * Used when: Legacy call sites still reference buildEnrichProfilePrompt.
   * Inputs: ignored
   * Output: string (system prompt text)
   */
  function buildEnrichProfilePrompt(_args = {}) {
    return buildProfileExtractionPrompt();
  }

  function buildInviteUserInput({ positioning, profile, strategyCore }) {
    return `
strategy_core:
${strategyCore || "(none)"}

my_positioning:
${positioning || "(none)"}
${profileContextBlock(profile)}
`;
  }

  function buildFirstMessageUserInput({ profile }) {
    return `
${profileContextBlock(profile)}
`;
  }

  function buildFollowupUserInput({
    objective,
    strategy,
    includeStrategy,
    contextLast10,
    chatHistory,
    profileContext,
  }) {
    const contextBlock = (Array.isArray(contextLast10) ? contextLast10 : [])
      .slice(-10)
      .map((m) => {
        const direction =
          m?.direction === "them"
            ? "them"
            : m?.direction === "me"
              ? "me"
              : "unknown";
        const text = normalizeText(m?.text);
        return text ? `- ${direction}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");

    return `
Objective:
${objective || "(none)"}

${includeStrategy && strategy ? `Strategy:\n${strategy}` : ""}

${normalizeText(chatHistory) ? `Chat history:\n${normalizeText(chatHistory)}` : ""}

Context (last 10 messages, chronological):
${contextBlock || "(none)"}

Instruction:
${
  includeStrategy && strategy
    ? "Respond with this objective using this context (last 10 messages) and respecting this strategy. Output ONLY the message text."
    : "Respond with this objective using this context (last 10 messages). Output ONLY the message text."
}
${profileContextBlock(profileContext || {})}
`;
  }

  global.LEFPrompts = {
    buildProfileExtractionPrompt,
    buildInviteTextPrompt,
    buildFirstMessageTextPrompt,
    buildFollowupPrompt,
    buildEnrichProfilePrompt,
    buildInviteUserInput,
    buildFirstMessageUserInput,
    buildFollowupUserInput,
  };
})(globalThis);
