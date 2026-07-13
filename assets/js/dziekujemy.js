const sessionId = new URLSearchParams(window.location.search).get("session_id");

    async function checkSession() {
      const message = document.getElementById("message");
      const status = document.getElementById("status");

      if (!sessionId) {
        message.textContent = "Nie znaleziono identyfikatora płatności.";
        status.textContent = "W razie problemów skontaktuj się z FUTrek.";
        return;
      }

      try {
        const response = await fetch(
          "/.netlify/functions/session-status?session_id=" + encodeURIComponent(sessionId)
        );
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Nie udało się sprawdzić płatności.");

        if (data.paymentStatus === "paid") {
          localStorage.removeItem("futrek_cart");
          message.textContent = "Płatność została przyjęta.";
          status.textContent = data.customerEmail
            ? "Potwierdzenie zostanie wysłane na: " + data.customerEmail
            : "Potwierdzenie otrzymasz na podany adres e-mail.";
        } else {
          message.textContent = "Płatność nie została jeszcze potwierdzona.";
          status.textContent = "Odśwież stronę za chwilę.";
        }
      } catch (error) {
        message.textContent = "Nie udało się sprawdzić statusu płatności.";
        status.textContent = error.message;
      }
    }

    checkSession();