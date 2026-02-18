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

MANDATORY STRUCTURE:
1. Start with "Ol� {first name from profile}". If first name is missing/unknown, start with "Ol�,".
2. Brief factual reference from the profile.
3. Causal linkage sentence connecting their profile to my own atua��o.
4. Close with a short low-friction sentence about connecting.

Tone: peer-level, neutral, specific, not salesy.
Avoid praise/flattery/emotional adjectives.
Use profile-observation verbs and never invent facts.

CLOSING RULES:
- Do NOT end with a question.
- Do NOT mention meetings, calls, agenda, or presenting services.
- Closing should only express openness to connect.

Output format:
Return valid JSON only (no markdown, no extra text):
{
  "invite_text": string
}`;

    const appended = normalizeText(additionalPrompt);
    if (!appended) return prompt;
    return `${prompt}\n\nAdditional context from user:\n${appended}`;
  }

  /**
   * Purpose: Backward-compatible alias for invitation prompt builder.
   * Used when: Legacy call sites still reference buildInvitePrompt.
   * Inputs: { language?: string, additionalPrompt?: string }
   * Output: string (system prompt text)
   */
  function buildInvitePrompt({ language, additionalPrompt } = {}) {
    return buildInviteTextPrompt({ language, additionalPrompt });
  }

  /**
   * Purpose: Build the first-message system prompt.
   * Used when: Clicking Generate first message.
   * Inputs: { language?: string, userPrompt?: string }
   * Output: string (system prompt text)
   */
  function buildFirstMessagePrompt({ language, userPrompt } = {}) {
    const overridePrompt = normalizeText(userPrompt);
    if (overridePrompt) return overridePrompt;
    const langRule =
      normalizeText(language) && normalizeText(language) !== "auto"
        ? normalizeText(language)
        : "the dominant language of the provided profile_context and profile_excerpt_fallback";

    return `Write a natural and socially intelligent first LinkedIn message in ${langRule} after connection acceptance.

The message must feel like something a real professional would write.

Core behavior:
- Start with greeting and appreciation.
- Keep it factual, respectful, and concise.
- Do not overpraise.
- Do not infer transitions, timing, or intentions.

Tone calibration:
- Peer-level, calm, understated.
- No hype language.
- No consultant tone.

Engagement:
- A question is optional, only if natural and light.
- No forced engagement.
- No meeting suggestion.

Fact usage:
- Use only facts explicitly present in the profile.
- Never invent context.

Structure:
- Max 600 characters.
- 2-3 short paragraphs.
- No emojis.
- No hashtags.
- Plain text only.`;
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
    void objective;
    void includeStrategy;
    void strategyText;
    void chatHistory;
    const languageRule = normalizeText(language) || "auto";
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
    buildInvitePrompt,
    buildFirstMessagePrompt,
    buildFollowupPrompt,
    buildEnrichProfilePrompt,
    buildInviteUserInput,
    buildFirstMessageUserInput,
    buildFollowupUserInput,
  };
})(globalThis);
