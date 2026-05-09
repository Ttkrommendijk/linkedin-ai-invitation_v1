(function initOpenAIService(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_PROMPTS = globalObj.LEFPrompts || {};

  const normalizeProfileField = LEF_UTILS.normalizeProfileField;
  const clampText = LEF_UTILS.clampText;
  const sanitizeHeadlineJobTitle =
    LEF_UTILS.sanitizeHeadlineJobTitle || normalizeProfileField;

  function profileContextBlock(profile) {
    return LEF_PROMPTS.buildFirstMessageUserInput({ profile });
  }

  async function fetchWithTimeout(
    url,
    options,
    timeoutMs = 15000,
    label = "Request",
  ) {
    const controller = new AbortController();
    const externalSignal = options?.signal;
    let timeoutId;

    const forwardExternalAbort = () => {
      controller.abort(externalSignal?.reason);
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        forwardExternalAbort();
      } else {
        externalSignal.addEventListener("abort", forwardExternalAbort, {
          once: true,
        });
      }
    }

    timeoutId = setTimeout(() => {
      controller.abort("__timeout__");
    }, timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (
        controller.signal.aborted &&
        controller.signal.reason === "__timeout__"
      ) {
        throw new Error(`${label} timed out.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", forwardExternalAbort);
      }
    }
  }

  async function fetchOpenAIWithRetry(url, options) {
    let attempt = 0;
    while (attempt < 2) {
      try {
        const res = await fetchWithTimeout(
          url,
          options,
          15000,
          "OpenAI request",
        );
        if (res.status >= 500 && res.status <= 599 && attempt === 0) {
          attempt += 1;
          continue;
        }
        return res;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e || "");
        const isTimeout = message === "OpenAI request timed out.";
        const isAbort = e && typeof e === "object" && e.name === "AbortError";
        const isNetwork =
          e instanceof TypeError || /failed to fetch|network/i.test(message);

        if (!isTimeout && !isAbort && isNetwork && attempt === 0) {
          attempt += 1;
          continue;
        }
        throw e;
      }
    }
  }

  function createProviderHttpError(provider, status, body) {
    const providerLabel = provider === "openai" ? "OpenAI" : "Supabase";
    const err = new Error(`${providerLabel} request failed (${status}).`);
    err.details = {
      provider,
      http_status: status,
      body: String(body || "").slice(0, 1000),
    };
    return err;
  }

  function extractRawModelText(data) {
    const direct = normalizeProfileField(data?.output_text || "");
    if (direct) return direct;

    const contentText =
      data?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      data?.output?.[0]?.content?.find((c) => c.type === "text")?.text ||
      "";
    return normalizeProfileField(contentText);
  }

  function buildPromptContextInput({
    language,
    profile,
    strategyCore,
    chatHistory,
    contextLast10,
    objective,
    includeProfile,
    includeStrategy,
    include_profile,
    include_strategy,
  }) {
    const requestedLanguage = normalizeProfileField(language) || "Portuguese";

    const includeProfileFlag =
      typeof include_profile === "boolean"
        ? include_profile
        : Boolean(includeProfile);

    const includeStrategyFlag =
      typeof include_strategy === "boolean"
        ? include_strategy
        : Boolean(includeStrategy);

    const sections = [`Language:\n${requestedLanguage}`];

    const normalizedObjective = normalizeProfileField(objective);
    if (normalizedObjective) {
      sections.push(`Objective:\n${normalizedObjective}`);
    }

    if (includeProfileFlag && profile) {
      sections.push(`Profile context:\n${profileContextBlock(profile)}`);
    }

    if (includeStrategyFlag) {
      sections.push(
        `Strategy context:\n${normalizeProfileField(strategyCore) || "(none)"}`,
      );
    }

    const normalizedChatHistory = normalizeProfileField(chatHistory);
    if (normalizedChatHistory) {
      sections.push(`Chat history:\n${normalizedChatHistory}`);
    }

    const contextBlock = (Array.isArray(contextLast10) ? contextLast10 : [])
      .slice(-10)
      .map((m) => {
        const direction =
          m?.direction === "them"
            ? "them"
            : m?.direction === "me"
              ? "me"
              : "unknown";
        const text = normalizeProfileField(m?.text);
        return text ? `- ${direction}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");

    if (contextBlock) {
      sections.push(`Last messages:\n${contextBlock}`);
    }

    sections.push("Return only the final message text.");

    return sections.join("\n\n");
  }

  async function callOpenAIFromPrompt({
    apiKey,
    model,
    prompt,
    language,
    profile,
    strategyCore,
    chatHistory,
    contextLast10,
    objective,
    includeProfile,
    includeStrategy,
    include_profile,
    include_strategy,
    maxOutputTokens = 500,
    maxChars = 1200,
  }) {
    const dbPrompt = normalizeProfileField(prompt);
    if (!dbPrompt) {
      throw new Error("Prompt is required.");
    }

    const res = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_output_tokens: maxOutputTokens,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    dbPrompt,
                    "",
                    "Important rules:",
                    "- Use only the context provided by the user message.",
                    "- Do not invent facts.",
                    "- Do not explain your reasoning.",
                    "- Output plain text only.",
                  ].join("\n"),
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildPromptContextInput({
                    language,
                    profile,
                    strategyCore,
                    chatHistory,
                    contextLast10,
                    objective,
                    includeProfile,
                    includeStrategy,
                    include_profile,
                    include_strategy,
                  }),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError(
        "openai",
        res.status,
        txt || res.statusText,
      );
    }

    const data = await res.json();
    const text = extractRawModelText(data);
    if (!text) {
      throw new Error("Model returned empty output.");
    }

    return clampText(text, maxChars);
  }

  function parseProfileEnrichmentJson(rawText) {
    let parsed;

    try {
      parsed = JSON.parse(rawText);
    } catch (_e) {
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");

      if (firstBrace < 0 || lastBrace <= firstBrace) {
        throw new Error("Model returned invalid profile enrichment JSON.");
      }

      parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Model returned invalid profile enrichment object.");
    }

    return {
      company: normalizeProfileField(parsed.company),
      headline: normalizeProfileField(parsed.headline),
    };
  }

  function parseProfileExtractionJson(rawText) {
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (_e) {
      const err = new Error("Model returned invalid JSON.");
      err.details = { reason: "invalid_json" };
      throw err;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const err = new Error("Model returned invalid JSON object.");
      err.details = { reason: "invalid_json" };
      throw err;
    }

    const allowedKeys = new Set(["company", "headline", "language"]);
    const keys = Object.keys(parsed);
    const hasInvalidKeys = keys.some((k) => !allowedKeys.has(k));
    const hasRequiredKeys =
      "company" in parsed && "headline" in parsed && "language" in parsed;

    if (hasInvalidKeys || !hasRequiredKeys) {
      const err = new Error("Model returned unexpected JSON schema.");
      err.details = { reason: "invalid_json" };
      throw err;
    }

    return {
      company: normalizeProfileField(parsed.company),
      headline: sanitizeHeadlineJobTitle(parsed.headline),
      language: normalizeProfileField(parsed.language),
    };
  }

  function parseCompanyExtractionJson(rawText) {
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (_e) {
      const err = new Error("Model returned invalid JSON.");
      err.details = { reason: "invalid_json" };
      throw err;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const err = new Error("Model returned invalid JSON object.");
      err.details = { reason: "invalid_json" };
      throw err;
    }
    const allowedKeys = new Set([
      "company_name",
      "employee_number",
      "sector",
      "city",
      "it_members",
    ]);
    const keys = Object.keys(parsed);
    const hasInvalidKeys = keys.some((k) => !allowedKeys.has(k));
    if (hasInvalidKeys) {
      const err = new Error("Model returned unexpected JSON schema.");
      err.details = { reason: "invalid_json" };
      throw err;
    }
    return {
      company_name: normalizeProfileField(parsed.company_name),
      employee_number: normalizeProfileField(parsed.employee_number),
      sector: normalizeProfileField(parsed.sector),
      city: normalizeProfileField(parsed.city),
      it_members: normalizeProfileField(parsed.it_members),
    };
  }

  function parseProfileExtractionFromResponseData(data) {
    const primaryText = normalizeProfileField(
      data?.output?.[0]?.content?.[0]?.text || "",
    );
    if (primaryText) {
      try {
        const parsed = JSON.parse(primaryText);
        return {
          parsed: parseProfileExtractionJson(JSON.stringify(parsed)),
          rawText: primaryText,
          usedOutputParsed: false,
        };
      } catch (_e) {
        const err = new Error("Model returned invalid JSON.");
        err.details = {
          reason: "invalid_json",
          source: "output.0.content.0.text",
        };
        throw err;
      }
    }

    if (data?.output_parsed && typeof data.output_parsed === "object") {
      const parsed = {
        company: data.output_parsed.company,
        headline: data.output_parsed.headline,
        language: data.output_parsed.language,
      };
      return {
        parsed: parseProfileExtractionJson(JSON.stringify(parsed)),
        rawText: extractRawModelText(data),
        usedOutputParsed: true,
      };
    }

    const rawText = extractRawModelText(data);
    if (!rawText) {
      const err = new Error("Model returned empty output.");
      err.details = { reason: "empty_output" };
      throw err;
    }

    try {
      return {
        parsed: parseProfileExtractionJson(rawText),
        rawText,
        usedOutputParsed: false,
      };
    } catch (_directErr) {
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const jsonSlice = rawText.slice(firstBrace, lastBrace + 1);
        return {
          parsed: parseProfileExtractionJson(jsonSlice),
          rawText,
          usedOutputParsed: false,
        };
      }
      throw _directErr;
    }
  }

  function buildStandardInvitePrompt(focus) {
    return LEF_PROMPTS.buildInviteTextPrompt({
      language: "Portuguese",
      additionalPrompt: normalizeProfileField(focus),
    });
  }

  async function callOpenAIProfileExtraction({ apiKey, model, profile }) {
    const res = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_output_tokens: 120,
          text: {
            format: {
              type: "json_schema",
              name: "profile_extraction",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  company: { type: "string" },
                  headline: { type: "string" },
                  language: { type: "string" },
                },
                required: ["company", "headline", "language"],
              },
            },
          },
          input: [
            {
              role: "system",
              content: [
                // prompt: buildProfileExtractionPrompt (Enrich)
                {
                  type: "input_text",
                  text: LEF_PROMPTS.buildProfileExtractionPrompt(),
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: profileContextBlock(profile),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError(
        "openai",
        res.status,
        txt || res.statusText,
      );
    }

    const data = await res.json();
    const result = parseProfileExtractionFromResponseData(data);
    return result.parsed;
  }

  async function callOpenAICompanyExtraction({ apiKey, model, profile }) {
    const res = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_output_tokens: 180,
          text: {
            format: {
              type: "json_schema",
              name: "company_extraction",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  company_name: { type: "string" },
                  employee_number: { type: "string" },
                  sector: { type: "string" },
                  city: { type: "string" },
                  it_members: { type: "string" },
                },
                required: [
                  "company_name",
                  "employee_number",
                  "sector",
                  "city",
                  "it_members",
                ],
              },
            },
          },
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: LEF_PROMPTS.buildCompanyExtractionPrompt(),
                },
              ],
            },
            {
              role: "user",
              content: [
                { type: "input_text", text: JSON.stringify(profile || {}) },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError(
        "openai",
        res.status,
        txt || res.statusText,
      );
    }
    const data = await res.json();
    if (data?.output_parsed && typeof data.output_parsed === "object") {
      return parseCompanyExtractionJson(JSON.stringify(data.output_parsed));
    }
    const rawText = extractRawModelText(data);
    return parseCompanyExtractionJson(rawText || "{}");
  }

  async function callOpenAIProfileEnrichment({ apiKey, model, profile }) {
    const res = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_output_tokens: 160,
          text: {
            format: {
              type: "json_schema",
              name: "profile_enrichment",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  company: { type: "string" },
                  headline: { type: "string" },
                },
                required: ["company", "headline"],
              },
            },
          },
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    "Extract profile enrichment fields from the provided scraped profile context.",
                    "",
                    "company rules:",
                    "- Return only the current company or organization name.",
                    "- No role, no location, no extra text.",
                    "- If unknown, return an empty string.",
                    "",
                    "headline rules:",
                    "- Return a concise role focused professional headline.",
                    "- Prefer the current role/title from the profile.",
                    "- Do not include location, follower counts, connection counts, or UI noise.",
                    "- If unknown, return an empty string.",
                    "",
                    "Use only the provided profile context.",
                    "Never invent facts.",
                    "Return valid JSON only.",
                  ].join("\n"),
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: profileContextBlock(profile),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError(
        "openai",
        res.status,
        txt || res.statusText,
      );
    }

    const data = await res.json();
    const rawText = extractRawModelText(data);
    return parseProfileEnrichmentJson(rawText || "{}");
  }

  async function callOpenAIInviteGeneration({
    apiKey,
    model,
    prompt,
    dbPrompt,
    invitationPrompt,
    positioning,
    focus,
    strategyCore,
    profile,
  }) {
    const selectedPrompt =
      normalizeProfileField(prompt) ||
      normalizeProfileField(dbPrompt) ||
      normalizeProfileField(invitationPrompt);

    if (!selectedPrompt) {
      throw new Error("Invitation prompt is required.");
    }

    const [inviteText, enrichment] = await Promise.all([
      callOpenAIFromPrompt({
        apiKey,
        model,
        prompt: selectedPrompt,
        language: "Portuguese",
        profile,
        strategyCore,
        objective: [positioning, focus].filter(Boolean).join("\n\n"),
        includeProfile: true,
        includeStrategy: Boolean(normalizeProfileField(strategyCore)),
        maxOutputTokens: 160,
        maxChars: 300,
      }),
      callOpenAIProfileEnrichment({
        apiKey,
        model,
        profile,
      }),
    ]);

    return {
      invite_text: inviteText,
      company: enrichment.company || "",
      headline: enrichment.headline || "",
    };
  }

  async function callOpenAIFirstMessage({
    apiKey,
    model,
    prompt,
    dbPrompt,
    firstMessagePrompt,
    profile,
    language,
    strategyCore,
  }) {
    const selectedPrompt =
      normalizeProfileField(prompt) ||
      normalizeProfileField(dbPrompt) ||
      normalizeProfileField(firstMessagePrompt);

    if (!selectedPrompt) {
      throw new Error("First message prompt is required.");
    }

    const firstMessage = await callOpenAIFromPrompt({
      apiKey,
      model,
      prompt: selectedPrompt,
      language: language || "Portuguese",
      profile,
      strategyCore,
      includeProfile: true,
      includeStrategy: Boolean(normalizeProfileField(strategyCore)),
      maxOutputTokens: 220,
      maxChars: 600,
    });

    return firstMessage;
  }

  async function callOpenAIFollowupMessage({
    apiKey,
    model,
    prompt,
    dbPrompt,
    followupPrompt,
    objective,
    strategy,
    strategyCore,
    includeStrategy,
    contextLast10,
    profileContext,
    profile,
    language,
  }) {
    const selectedPrompt =
      normalizeProfileField(prompt) ||
      normalizeProfileField(dbPrompt) ||
      normalizeProfileField(followupPrompt);

    if (!selectedPrompt) {
      throw new Error("Follow-up prompt is required.");
    }

    const selectedProfile = profileContext || profile || {};
    const selectedStrategy =
      normalizeProfileField(strategy) || normalizeProfileField(strategyCore);

    const followupMessage = await callOpenAIFromPrompt({
      apiKey,
      model,
      prompt: selectedPrompt,
      language: language || "Portuguese",
      profile: selectedProfile,
      strategyCore: selectedStrategy,
      objective,
      contextLast10,
      includeProfile: Boolean(selectedProfile),
      includeStrategy: Boolean(includeStrategy && selectedStrategy),
      maxOutputTokens: 260,
      maxChars: 1000,
    });

    return followupMessage;
  }

  async function callOpenAIFreePrompt(payload = {}) {
    return callOpenAIFromPrompt({
      ...payload,
      maxOutputTokens: 500,
      maxChars: 1200,
    });
  }

  globalObj.LEFOpenAIService = Object.freeze({
    fetchWithTimeout,
    fetchOpenAIWithRetry,
    createProviderHttpError,
    extractRawModelText,

    callOpenAIFromPrompt,
    callOpenAIInviteGeneration,
    callOpenAIProfileEnrichment,
    callOpenAIProfileExtraction,
    callOpenAICompanyExtraction,
    callOpenAIFirstMessage,
    callOpenAIFollowupMessage,
    callOpenAIFreePrompt,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
