(function initWorkflowService(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_RUNTIME_UTILS = globalObj.LEFRuntimeUtils || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const LEF_SUPABASE_COMPANY = globalObj.LEFSupabaseCompany || {};

  const sanitizeHeadlineJobTitle =
    LEF_RUNTIME_UTILS.sanitizeHeadlineJobTitle ||
    LEF_UTILS.sanitizeHeadlineJobTitle;
  const normalizeLinkedinCompanyUrl =
    LEF_RUNTIME_UTILS.normalizeLinkedinCompanyUrl ||
    LEF_UTILS.normalizeLinkedinCompanyUrl;

  async function enrichProfile(payload) {
    const extraction = await LEF_OPENAI.callOpenAIProfileExtraction(
      payload || {},
    );
    return {
      company: extraction.company || "",
      headline: sanitizeHeadlineJobTitle(extraction.headline || ""),
      language: extraction.language || "",
    };
  }

  async function enrichCompanyProfile(payload) {
    const extraction = await LEF_OPENAI.callOpenAICompanyExtraction(
      payload || {},
    );
    console.log("[LEF][company AI extraction result]", extraction);
    return extraction;
  }

  async function upsertCompanyProfile(payload) {
    const safePayload = payload || {};
    const existing =
      await LEF_SUPABASE_COMPANY.supabaseGetCompanyByLinkedinId(safePayload);
    const company =
      await LEF_SUPABASE_COMPANY.supabaseUpsertCompanyProfile(safePayload);
    console.log(
      existing ? "[LEF][company row updated]" : "[LEF][company row created]",
      {
        linkedin_id: normalizeLinkedinCompanyUrl(safePayload?.linkedin_id),
      },
    );
    return company;
  }

  async function updateCompanyById(payload) {
    const safePayload = payload || {};
    const company =
      await LEF_SUPABASE_COMPANY.supabaseUpdateCompanyById(safePayload);
    console.log("[LEF][company row updated]", {
      company_id: LEF_SUPABASE_COMPANY.normalizeProfileField(
        safePayload?.company_id,
      ),
      linkedin_id: LEF_SUPABASE_COMPANY.normalizeLinkedinCompanyUrl(
        safePayload?.linkedin_id,
      ),
    });
    return company;
  }

  globalObj.LEFWorkflowService = Object.freeze({
    enrichProfile,
    enrichCompanyProfile,
    upsertCompanyProfile,
    updateCompanyById,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
