
const IS_LOCAL_PREVIEW = window.location.protocol === "file:";

function isTikTokBrowser() {
  const ua = navigator.userAgent || "";
  return /TikTok|musical_ly|BytedanceWebview|ByteLocale/i.test(ua);
}

function restoreCartFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("cart");
  if (!encoded) return;

  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) return;

    const allowedIds = new Set([
      "build-your-team",
      "full-game-control",
      "area-control",
      "goal-machine",
      "wild-mentality"
    ]);

    const cleanCart = parsed
      .filter(item => allowedIds.has(item.id))
      .map(item => ({
        id: item.id,
        name: String(item.name || ""),
        price: Number(item.price),
        quantity: Math.max(1, Math.min(10, Number(item.quantity) || 1))
      }));

    if (cleanCart.length) {
      localStorage.setItem("futrek_cart", JSON.stringify(cleanCart));
    }
  } catch (error) {
    console.error("Nie udało się odtworzyć koszyka z linku:", error);
  }
}

restoreCartFromUrl();

const tiktokBlocker = document.getElementById("tiktok-blocker");
const copyCurrentCheckout = document.getElementById("copy-current-checkout");
const copyCurrentStatus = document.getElementById("copy-current-status");

if (isTikTokBrowser()) {
  tiktokBlocker.hidden = false;
  document.body.style.overflow = "hidden";
}

copyCurrentCheckout.addEventListener("click", async () => {
  const url = window.location.href;

  try {
    await navigator.clipboard.writeText(url);
    copyCurrentStatus.textContent = "Link skopiowany. Wklej go do Safari lub Chrome.";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    copyCurrentStatus.textContent = "Link skopiowany. Wklej go do Safari lub Chrome.";
  }
});


const CART_KEY = "futrek_cart";
const LOCAL_PREVIEW_CART = [
  { id: "build-your-team", name: "BUILD YOUR TEAM — Analiza składu", price: 29.99, quantity: 1 }
];

    function getCart() {
      try {
        const cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
        if (IS_LOCAL_PREVIEW && cart.length === 0) return LOCAL_PREVIEW_CART.map(item => ({ ...item }));
        return cart;
      } catch {
        return IS_LOCAL_PREVIEW ? LOCAL_PREVIEW_CART.map(item => ({ ...item })) : [];
      }
    }

    function saveCart(cart) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      renderCart();
    }

    function formatPrice(value) {
      return value.toLocaleString("pl-PL", {
        style: "currency",
        currency: "PLN"
      });
    }

    function changeQuantity(id, change) {
      const cart = getCart();
      const item = cart.find(product => product.id === id);

      if (!item) return;

      item.quantity += change;

      const updatedCart = cart.filter(product => product.quantity > 0);
      saveCart(updatedCart);
    }

    function removeItem(id) {
      const updatedCart = getCart().filter(product => product.id !== id);
      saveCart(updatedCart);
    }

    function renderCart() {
      const cart = getCart();
      const list = document.getElementById("cart-list");
      const checkoutButton = document.getElementById("checkout-button");

      if (cart.length === 0) {
        list.innerHTML = `
          <div class="empty">
            <strong>Twój koszyk jest pusty</strong>
            Wróć do ofert i dodaj interesujące Cię produkty.
          </div>
        `;
      } else {
        list.innerHTML = cart.map(item => {
          const itemTotal = item.price * item.quantity;

          return `
            <article class="cart-item">
              <div>
                <h3>${item.name}</h3>
                <p>${formatPrice(item.price)} za sztukę</p>
                <div class="controls">
                  <button class="qty" type="button" data-action="decrease" data-id="${item.id}" aria-label="Zmniejsz ilość">−</button>
                  <strong>${item.quantity}</strong>
                  <button class="qty" type="button" data-action="increase" data-id="${item.id}" aria-label="Zwiększ ilość">+</button>
                  <button class="remove" type="button" data-action="remove" data-id="${item.id}">Usuń</button>
                </div>
              </div>
              <div class="item-price">${formatPrice(itemTotal)}</div>
            </article>
          `;
        }).join("");
      }

      const count = cart.reduce((sum, item) => sum + item.quantity, 0);
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      document.getElementById("summary-count").textContent = count;
      document.getElementById("summary-total").textContent = formatPrice(total);
      checkoutButton.disabled = cart.length === 0;

      document.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => {
          const id = button.dataset.id;
          const action = button.dataset.action;

          if (action === "increase") changeQuantity(id, 1);
          if (action === "decrease") changeQuantity(id, -1);
          if (action === "remove") removeItem(id);
        });
      });
    }

    // Stripe uruchamiamy tylko na stronie serwowanej przez http/https.
    // Dzięki temu lokalny podgląd wyglądu działa także bez ładowania Stripe.
    const stripe = !IS_LOCAL_PREVIEW && typeof Stripe !== "undefined"
      ? Stripe("pk_live_51SURRXHduHJ2QTTSlimtyJvtOBVpMcVTU1DBPmhyOSciY6foTbMKGMBcQllfMh5jRE3HJY71YMg878n4k9rCZPwf00WKssvdeK")
      : null;
    let embeddedCheckout = null;

    function showPaymentError(message) {
      const box = document.getElementById("payment-error");
      box.textContent = message;
      box.classList.add("show");
    }

    function hidePaymentError() {
      const box = document.getElementById("payment-error");
      box.textContent = "";
      box.classList.remove("show");
    }

    document.getElementById("checkout-button").addEventListener("click", async () => {
      const button = document.getElementById("checkout-button");
      const cart = getCart();

      if (!cart.length) return;

      if (IS_LOCAL_PREVIEW) {
        showPaymentError("Tryb podglądu lokalnego: wygląd kasy możesz sprawdzać z dysku, ale prawdziwa płatność Stripe działa dopiero przez Netlify / https://.");
        return;
      }

      hidePaymentError();
      button.disabled = true;
      button.classList.add("loading");
      button.textContent = "Ładowanie płatności…";

      try {
        if (embeddedCheckout) {
          embeddedCheckout.destroy();
          embeddedCheckout = null;
        }

        embeddedCheckout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => {
            const response = await fetch("/.netlify/functions/create-checkout-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: cart.map(item => ({
                  id: item.id,
                  quantity: item.quantity
                }))
              })
            });

            let data;
            try {
              data = await response.json();
            } catch {
              data = {};
            }

            if (!response.ok || !data.clientSecret) {
              if (response.status === 404) {
                throw new Error("Nie znaleziono funkcji Netlify. Wdróż cały folder projektu, a nie tylko pliki HTML.");
              }
              if (response.status === 500) {
                throw new Error(data.error || "Brakuje zmiennej STRIPE_SECRET_KEY w Netlify albo funkcja nie została ponownie wdrożona.");
              }
              throw new Error(data.error || "Nie udało się rozpocząć płatności.");
            }

            return data.clientSecret;
          }
        });

        embeddedCheckout.mount("#embedded-checkout");

        const layout = document.querySelector(".layout");
        if (layout) layout.classList.add("payment-active");

        button.style.display = "none";

        document.getElementById("embedded-checkout").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      } catch (error) {
        console.error(error);
        showPaymentError(error.message || "Nie udało się załadować płatności.");
        button.disabled = false;
        button.classList.remove("loading");
        button.textContent = "Przejdź do płatności";
      }
    });

    renderCart();