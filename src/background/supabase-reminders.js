(function initSupabaseReminders(globalObj) {
  const service = globalObj.LEFSupabaseService || {};
  const openai = globalObj.LEFOpenAIService || {};
  const normalize = globalObj.LEFUtils?.normalizeProfileField || ((v) => String(v ?? "").trim());

  async function request(path, { method = "GET", body, prefer } = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } = await service.getSupabaseRequestContext();
    const res = await openai.fetchWithTimeout(`${supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, 15000, "Supabase request");
    if (!res.ok) {
      const message = await res.text().catch(() => "");
      throw openai.createProviderHttpError("supabase", res.status, message);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function listReminders(payload = {}) {
    const params = new URLSearchParams();
    params.set("select", "id,title,details,status,due_at,next_review_at,snoozed_until,completed_at,contact_id,company_id,deal_id,source_note_id,completed_by_note_id,created_at");
    params.set("status", "in.(open,snoozed)");
    params.set("order", "next_review_at.asc");
    const contactId = normalize(payload.contact_id);
    const companyId = normalize(payload.company_id);
    if (contactId) params.set("contact_id", `eq.${contactId}`);
    if (companyId) params.set("company_id", `eq.${companyId}`);
    return request(`crm_reminders?${params}`);
  }

  async function createNoteWithOptionalReminder(payload = {}) {
    return request("rpc/create_note_with_optional_reminder", {
      method: "POST",
      body: {
        p_note_title: normalize(payload.note_title) || null,
        p_note_description: normalize(payload.note_description) || null,
        p_occurred_at: payload.date || new Date().toISOString(),
        p_status: payload.status || "ready",
        p_notes_type: payload.notes_type || "note",
        p_duration: payload.duration == null || payload.duration === "" ? null : Number(payload.duration),
        p_main_person_id: normalize(payload.main_person_id) || null,
        p_company_id: normalize(payload.company_id) || null,
        p_deal_id: normalize(payload.deal_id) || null,
        p_create_reminder: Boolean(payload.create_reminder),
        p_reminder_title: normalize(payload.reminder_title) || null,
        p_reminder_at: payload.reminder_at || null,
        p_reminder_kind: payload.reminder_kind === "review" ? "review" : "due",
      },
    });
  }

  async function completeReminderWithNote(payload = {}) {
    const reminderId = normalize(payload.reminder_id);
    if (!reminderId) throw new Error("Reminder id is required.");
    return request("rpc/complete_reminder_with_note", {
      method: "POST",
      body: {
        p_reminder_id: reminderId,
        p_note_title: normalize(payload.note_title) || null,
        p_note_description: normalize(payload.note_description) || null,
        p_occurred_at: payload.date || new Date().toISOString(),
        p_notes_type: payload.notes_type || "note",
        p_duration: payload.duration == null || payload.duration === "" ? null : Number(payload.duration),
      },
    });
  }

  globalObj.LEFSupabaseReminders = Object.freeze({
    listReminders,
    createNoteWithOptionalReminder,
    completeReminderWithNote,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
