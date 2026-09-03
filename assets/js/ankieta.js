(() => {
  "use strict";

  const FORM_ID = "analysis-form";
  const DRAFT_KEY = "futrek_analysis_draft_v1";
  const REQUIRED_QUESTIONS = [
    "email",
    "name",
    "division",
    "budget",
    "playStyle",
    "favoritePlaystyles",
    "squadImage",
    "rebuildGoals",
    "tradablePlayers"
  ];
  const MAX_REBUILD_GOALS = 3;

  const form = document.getElementById(FORM_ID);
  if (!form) return;

  const progressPercent = document.getElementById("progress-percent");
  const progressLeft = document.getElementById("progress-left");
  const progressBar = document.getElementById("progress-bar");
  const goalCount = document.getElementById("goal-count");
  const squadImageInput = document.getElementById("squad-image");
  const fileLabel = document.getElementById("file-label");
  const filePreview = document.getElementById("file-preview");
  const filePreviewImage = document.getElementById("file-preview-image");
  const submitStatus = document.getElementById("submit-status");

  let hasSquadImage = false;
  let draftTimer = null;

  function checkedValues(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }

  function hasText(id) {
    const element = document.getElementById(id);
    return Boolean(element && element.value.trim());
  }

  function isQuestionComplete(question) {
    switch (question) {
      case "email": {
        const email = document.getElementById("email");
        return Boolean(email.value.trim() && email.validity.valid);
      }
      case "name": return hasText("name");
      case "division": return hasText("division");
      case "budget": {
        const value = Number(document.getElementById("budget").value);
        return Number.isFinite(value) && value >= 0 && document.getElementById("budget").value !== "";
      }
      case "playStyle": return checkedValues("playStyle").length > 0;
      case "favoritePlaystyles": return checkedValues("favoritePlaystyles").length > 0 || hasText("other-playstyle");
      case "squadImage": return hasSquadImage;
      case "rebuildGoals": return checkedValues("rebuildGoals").length > 0;
      case "tradablePlayers": return hasText("tradable-players");
      default: return false;
    }
  }

  function updateProgress() {
    const completed = REQUIRED_QUESTIONS.filter(isQuestionComplete).length;
    const total = REQUIRED_QUESTIONS.length;
    const percent = Math.round((completed / total) * 100);
    const left = total - completed;

    progressPercent.textContent = `${percent}%`;
    progressLeft.textContent = left === 0
      ? "Wszystkie wymagane odpowiedzi gotowe"
      : `Pozostało ${left} ${left === 1 ? "odpowiedź" : left >= 2 && left <= 4 ? "odpowiedzi" : "odpowiedzi"}`;
    progressBar.style.width = `${percent}%`;

    REQUIRED_QUESTIONS.forEach(question => {
      const card = form.querySelector(`[data-question="${question}"]`);
      if (card) card.classList.toggle("is-complete", isQuestionComplete(question));
    });
  }

  function setError(question, message = "") {
    const card = form.querySelector(`[data-question="${question}"]`);
    const error = form.querySelector(`[data-error-for="${question}"]`);
    if (card) card.classList.toggle("has-error", Boolean(message));
    if (error) error.textContent = message;
  }

  function clearErrors() {
    REQUIRED_QUESTIONS.forEach(question => setError(question));
  }

  function validateForm() {
    clearErrors();
    const messages = {
      email: "Podaj poprawny adres e-mail.",
      name: "Podaj swoje imię.",
      division: "Wybierz aktualną dywizję.",
      budget: "Podaj budżet w coinsach.",
      playStyle: "Wybierz przynajmniej jeden styl gry.",
      favoritePlaystyles: "Wybierz przynajmniej jeden PlayStyle lub wpisz własny.",
      squadImage: "Dodaj zdjęcie aktualnego składu.",
      rebuildGoals: "Wybierz przynajmniej jeden priorytet przebudowy.",
      tradablePlayers: "Wpisz zawodników wymiennych. Jeśli nie masz żadnych, wpisz „brak”."
    };

    const invalid = REQUIRED_QUESTIONS.filter(question => !isQuestionComplete(question));
    invalid.forEach(question => setError(question, messages[question]));

    if (invalid.length > 0) {
      const firstCard = form.querySelector(`[data-question="${invalid[0]}"]`);
      firstCard?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function getDraftData() {
    return {
      email: document.getElementById("email").value,
      name: document.getElementById("name").value,
      division: document.getElementById("division").value,
      budget: document.getElementById("budget").value,
      playStyle: checkedValues("playStyle"),
      favoritePlaystyles: checkedValues("favoritePlaystyles"),
      otherPlaystyle: document.getElementById("other-playstyle").value,
      rebuildGoals: checkedValues("rebuildGoals"),
      tradablePlayers: document.getElementById("tradable-players").value,
      mustKeepPlayers: document.getElementById("must-keep-players").value,
      feedback: document.getElementById("feedback").value,
      savedAt: new Date().toISOString()
    };
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
    } catch (error) {
      console.warn("Nie udało się zapisać wersji roboczej ankiety.", error);
    }
  }

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 250);
  }

  function restoreCheckboxes(name, values = []) {
    form.querySelectorAll(`input[name="${name}"]`).forEach(input => {
      input.checked = values.includes(input.value);
    });
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      const fields = ["email", "name", "division", "budget"];
      fields.forEach(id => {
        const element = document.getElementById(id);
        if (element && draft[id] != null) element.value = draft[id];
      });

      document.getElementById("other-playstyle").value = draft.otherPlaystyle || "";
      document.getElementById("tradable-players").value = draft.tradablePlayers || "";
      document.getElementById("must-keep-players").value = draft.mustKeepPlayers || "";
      document.getElementById("feedback").value = draft.feedback || "";

      restoreCheckboxes("playStyle", draft.playStyle);
      restoreCheckboxes("favoritePlaystyles", draft.favoritePlaystyles);
      restoreCheckboxes("rebuildGoals", draft.rebuildGoals);
    } catch (error) {
      console.warn("Nie udało się odtworzyć wersji roboczej ankiety.", error);
    }
  }

  function updateGoalLimit(changedInput) {
    const selected = form.querySelectorAll('input[name="rebuildGoals"]:checked');
    const all = form.querySelectorAll('input[name="rebuildGoals"]');

    if (selected.length > MAX_REBUILD_GOALS && changedInput) {
      changedInput.checked = false;
    }

    const finalSelected = form.querySelectorAll('input[name="rebuildGoals"]:checked');
    goalCount.textContent = String(finalSelected.length);
    const atLimit = finalSelected.length >= MAX_REBUILD_GOALS;

    all.forEach(input => {
      input.disabled = atLimit && !input.checked;
    });
  }

  function handleImageSelection() {
    const [file] = squadImageInput.files;
    hasSquadImage = Boolean(file);

    if (!file) {
      fileLabel.textContent = "Dodaj zdjęcie składu";
      filePreview.hidden = true;
      filePreviewImage.removeAttribute("src");
      updateProgress();
      return;
    }

    fileLabel.textContent = file.name;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      filePreviewImage.src = reader.result;
      filePreview.hidden = false;
    });
    reader.readAsDataURL(file);
    updateProgress();
  }

  function handleBrokenPlaystyleImages() {
    form.querySelectorAll(".playstyle-image img").forEach(image => {
      image.addEventListener("error", () => image.classList.add("broken"));
      if (image.complete && image.naturalWidth === 0) image.classList.add("broken");
    });
  }

  form.addEventListener("input", event => {
    if (event.target.name === "rebuildGoals") updateGoalLimit(event.target);
    updateProgress();
    scheduleDraftSave();
  });

  form.addEventListener("change", event => {
    if (event.target === squadImageInput) handleImageSelection();
    if (event.target.name === "rebuildGoals") updateGoalLimit(event.target);
    updateProgress();
    scheduleDraftSave();
  });

  async function submitAnalysis() {
    const submitButton = form.querySelector('.submit-button');
    const payload = getDraftData();
    delete payload.savedAt;

    if (IS_LOCAL_PREVIEW) {
      saveDraft();
      submitStatus.textContent = "Podgląd lokalny: ankieta jest poprawnie wypełniona. Odpowiedzi nie zostały wysłane — zapis do Supabase działa po uruchomieniu przez Netlify.";
      return;
    }

    submitButton.disabled = true;
    submitStatus.textContent = "Wysyłamy odpowiedzi…";

    try {
      const response = await fetch("/.netlify/functions/save-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let result = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(result.error || "Nie udało się zapisać analizy.");
      }

      localStorage.removeItem(DRAFT_KEY);
      submitStatus.textContent = `Gotowe! Odpowiedzi zostały zapisane. ID analizy: ${result.analysisId}`;
      form.querySelectorAll("input, select, textarea, button").forEach(element => {
        element.disabled = true;
      });
    } catch (error) {
      console.error("Błąd wysyłania analizy:", error);
      submitStatus.textContent = error.message || "Nie udało się wysłać odpowiedzi. Spróbuj ponownie.";
      submitButton.disabled = false;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submitStatus.textContent = "";

    if (!validateForm()) {
      submitStatus.textContent = "Uzupełnij zaznaczone pola przed wysłaniem.";
      return;
    }

    saveDraft();
    await submitAnalysis();
  });

  restoreDraft();
  updateGoalLimit();
  handleBrokenPlaystyleImages();
  updateProgress();
})();
