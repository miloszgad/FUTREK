const CART_KEY = "futrek_cart";

    function getCart() {
      try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
      } catch {
        return [];
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

    const stripe = Stripe("pk_live_51SURRXHduHJ2QTTSlimtyJvtOBVpMcVTU1DBPmhyOSciY6foTbMKGMBcQllfMh5jRE3HJY71YMg878n4k9rCZPwf00WKssvdeK");
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

      if (window.location.protocol === "file:") {
        showPaymentError("Płatność Stripe nie działa po otwarciu pliku z dysku. Wdróż cały folder na Netlify i otwórz stronę przez adres https://.");
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