const { createClient } = require("@supabase/supabase-js");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Dozwolona jest tylko metoda POST." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Brakuje SUPABASE_URL lub SUPABASE_SECRET_KEY w Netlify.");
    return json(500, { error: "Błąd konfiguracji serwera." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Nieprawidłowe dane formularza." });
  }

  const {
    email,
    name,
    division,
    budget,
    playStyle,
    favoritePlaystyles,
    otherPlaystyle,
    rebuildGoals,
    tradablePlayers,
    mustKeepPlayers,
    feedback
  } = body;

  const parsedBudget = Number(budget);
  const hasRequiredData =
    typeof email === "string" && email.trim() &&
    typeof name === "string" && name.trim() &&
    typeof division === "string" && division.trim() &&
    Number.isFinite(parsedBudget) && parsedBudget >= 0 &&
    Array.isArray(playStyle) && playStyle.length > 0 &&
    ((Array.isArray(favoritePlaystyles) && favoritePlaystyles.length > 0) ||
      (typeof otherPlaystyle === "string" && otherPlaystyle.trim())) &&
    Array.isArray(rebuildGoals) && rebuildGoals.length > 0 &&
    typeof tradablePlayers === "string" && tradablePlayers.trim();

  if (!hasRequiredData) {
    return json(400, { error: "Brakuje wymaganych danych ankiety." });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase
    .from("analyses")
    .insert({
      email: email.trim(),
      name: name.trim(),
      division: division.trim(),
      budget: parsedBudget,
      play_style: playStyle,
      playstyles: Array.isArray(favoritePlaystyles) ? favoritePlaystyles : [],
      other_playstyle: otherPlaystyle?.trim() || null,
      squad_image_url: null,
      rebuild_priorities: rebuildGoals,
      tradeable_players: tradablePlayers.trim(),
      must_keep_players: mustKeepPlayers?.trim() || null,
      feedback: feedback?.trim() || null,
      status: "submitted"
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase error:", error);
    return json(500, { error: "Nie udało się zapisać analizy w bazie." });
  }

  return json(200, {
    success: true,
    analysisId: data.id
  });
};
