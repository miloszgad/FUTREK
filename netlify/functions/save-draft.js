const {
  json,
  getSupabase,
  hashSecret,
  validDraftCredentials,
  normalizeDraftFields,
  getAuthorizedDraft
} = require("./_shared/analysis");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Dozwolona jest tylko metoda POST." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Nieprawidłowe dane formularza." }); }

  const { draftId, draftSecret } = body;
  if (!validDraftCredentials(draftId, draftSecret)) return json(400, { error: "Nieprawidłowy identyfikator wersji roboczej." });

  try {
    const supabase = getSupabase();
    const { row, authorized } = await getAuthorizedDraft(supabase, draftId, draftSecret);
    if (!authorized) return json(403, { error: "Brak dostępu do tej wersji roboczej." });
    if (row?.status === "submitted") return json(409, { error: "Ta ankieta została już wysłana.", status: "submitted" });

    const fields = normalizeDraftFields(body);
    let result;

    if (row) {
      result = await supabase
        .from("analyses")
        .update(fields)
        .eq("id", draftId)
        .eq("status", "draft")
        .select("id, status")
        .single();
    } else {
      result = await supabase
        .from("analyses")
        .insert({
          id: draftId,
          ...fields,
          draft_key_hash: hashSecret(draftSecret),
          status: "draft"
        })
        .select("id, status")
        .single();
    }

    if (result.error) {
      console.error("Supabase draft error:", result.error);
      return json(500, { error: "Nie udało się zapisać postępu." });
    }

    return json(200, { success: true, id: result.data.id, status: result.data.status });
  } catch (error) {
    console.error("save-draft error:", error);
    return json(500, { error: "Nie udało się zapisać postępu." });
  }
};
