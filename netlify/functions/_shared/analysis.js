const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Brakuje SUPABASE_URL lub SUPABASE_SECRET_KEY.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function hashSecret(secret) {
  return crypto.createHash("sha256").update(String(secret)).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validDraftCredentials(id, secret) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""))
    && typeof secret === "string" && secret.length >= 32;
}

function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  return { contentType, extension: extensions[contentType], buffer };
}

function normalizeDraftFields(body) {
  const numberBudget = body.budget === "" || body.budget == null ? null : Number(body.budget);
  return {
    email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
    division: typeof body.division === "string" && body.division.trim() ? body.division.trim() : null,
    budget: Number.isFinite(numberBudget) && numberBudget >= 0 ? numberBudget : null,
    play_style: Array.isArray(body.playStyle) ? body.playStyle : [],
    playstyles: Array.isArray(body.favoritePlaystyles) ? body.favoritePlaystyles : [],
    other_playstyle: typeof body.otherPlaystyle === "string" && body.otherPlaystyle.trim() ? body.otherPlaystyle.trim() : null,
    rebuild_priorities: Array.isArray(body.rebuildGoals) ? body.rebuildGoals : [],
    tradeable_players: typeof body.tradablePlayers === "string" && body.tradablePlayers.trim() ? body.tradablePlayers.trim() : null,
    must_keep_players: typeof body.mustKeepPlayers === "string" && body.mustKeepPlayers.trim() ? body.mustKeepPlayers.trim() : null,
    feedback: typeof body.feedback === "string" && body.feedback.trim() ? body.feedback.trim() : null
  };
}

async function getAuthorizedDraft(supabase, id, secret) {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { row: null, authorized: true };

  const expected = hashSecret(secret);
  return { row: data, authorized: safeEqual(data.draft_key_hash, expected) };
}

module.exports = {
  json,
  getSupabase,
  hashSecret,
  validDraftCredentials,
  parseImageDataUrl,
  normalizeDraftFields,
  getAuthorizedDraft
};
