(function initSupabaseNotes(globalObj) {
  const LEF_UTILS = globalObj.LEFUtils || {};
  const LEF_SUPABASE = globalObj.LEFSupabaseService || {};
  const LEF_OPENAI = globalObj.LEFOpenAIService || {};

  const normalizeProfileField =
    typeof LEF_UTILS.normalizeProfileField === "function"
      ? LEF_UTILS.normalizeProfileField
      : (value) => (value == null ? "" : String(value).trim());

  const getSupabaseRequestContext = LEF_SUPABASE.getSupabaseRequestContext;
  const fetchWithTimeout = LEF_OPENAI.fetchWithTimeout;
  const createProviderHttpError = LEF_OPENAI.createProviderHttpError;

  function buildQuery(params) {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  }

  function toIsoDateTime(value) {
    const raw = normalizeProfileField(value);
    if (!raw) return new Date().toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date(`${raw}T00:00:00`).toISOString();
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  }

  function deriveStatus(dateValue, statusValue) {
    const explicitStatus = normalizeProfileField(statusValue);
    const date = new Date(toIsoDateTime(dateValue));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!Number.isNaN(date.getTime()) && date.getTime() > today.getTime()) {
      return "planned";
    }
    return explicitStatus || "ready";
  }

  function normalizeNotePayload(payload = {}) {
    const note = {
      note_title: normalizeProfileField(payload.note_title) || null,
      note_description: normalizeProfileField(payload.note_description) || null,
      date: toIsoDateTime(payload.date),
      status: deriveStatus(payload.date, payload.status),
      notes_type: normalizeProfileField(payload.notes_type) || "note",
    };

    const personId = normalizeProfileField(payload.main_person_id || payload.person_id);
    const companyId = normalizeProfileField(payload.company_id);
    const dealId = normalizeProfileField(payload.deal_id);

    if (personId) note.main_person_id = personId;
    if (companyId) note.company_id = companyId;
    if (dealId) note.deal_id = dealId;

    return note;
  }

  async function supabaseListNotes(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const personId = normalizeProfileField(payload.person_id || payload.main_person_id);
    const companyId = normalizeProfileField(payload.company_id);
    const filter = normalizeProfileField(payload.filter) || "company";

    const params = {
      select:
        "note_id,note_title,note_description,created_at,status,date,notes_type,person_name,company_name,deal_name,deal_description,archived,main_person_id,company_id,deal_id",
      archived: "eq.false",
      order: "date.desc",
    };

    if (filter === "person" && personId) {
      params.main_person_id = `eq.${personId}`;
    } else if (companyId) {
      params.company_id = `eq.${companyId}`;
    } else if (personId) {
      params.main_person_id = `eq.${personId}`;
    }

    const url = `${supabaseUrl}/rest/v1/notes_view?${buildQuery(params)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function supabaseCreateNote(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken, userId } =
      await getSupabaseRequestContext();
    const note = normalizeNotePayload(payload);
    if (userId) note.creator = userId;

    const url = `${supabaseUrl}/rest/v1/note`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify([note]),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function supabaseUpdateNote(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const noteId = normalizeProfileField(payload.note_id);
    if (!noteId) throw new Error("Note id is required.");

    const patch = normalizeNotePayload(payload);
    delete patch.main_person_id;
    delete patch.company_id;
    delete patch.deal_id;

    const url = `${supabaseUrl}/rest/v1/note?note_id=eq.${encodeURIComponent(noteId)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function supabaseArchiveNote(payload = {}) {
    const { supabaseUrl, supabaseAnonKey, accessToken } =
      await getSupabaseRequestContext();
    const noteId = normalizeProfileField(payload.note_id);
    if (!noteId) throw new Error("Note id is required.");
    const url = `${supabaseUrl}/rest/v1/note?note_id=eq.${encodeURIComponent(noteId)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ archived: true }),
      },
      15000,
      "Supabase request",
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw createProviderHttpError("supabase", res.status, txt);
    }
  }

  globalObj.LEFSupabaseNotes = Object.freeze({
    supabaseListNotes,
    supabaseCreateNote,
    supabaseUpdateNote,
    supabaseArchiveNote,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
