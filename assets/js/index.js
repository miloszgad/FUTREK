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
      updateCartCount();
    }

    function updateCartCount() {
      const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
      const badge = document.getElementById("cart-count");
      if (badge) badge.textContent = count;
    }

    function showToast(message) {
      const toast = document.getElementById("cart-toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(window.cartToastTimer);
      window.cartToastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
    }

    document.querySelectorAll(".add-to-cart").forEach(button => {
      button.addEventListener("click", () => {
        const cart = getCart();
        const existing = cart.find(item => item.id === button.dataset.id);

        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({
            id: button.dataset.id,
            name: button.dataset.name,
            price: Number(button.dataset.price),
            quantity: 1
          });
        }

        saveCart(cart);
        showToast("Dodano do koszyka: " + button.dataset.name);
      });
    });


    function formatPrice(value) {
      return value.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
    }

    function renderDrawer() {
      const cart = getCart();
      const items = document.getElementById("drawer-items");
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const checkout = document.getElementById("drawer-checkout");

      document.getElementById("drawer-total").textContent = formatPrice(total);

      if (!cart.length) {
        items.innerHTML = '<div class="drawer-empty">Koszyk jest pusty.</div>';
        checkout.classList.add("disabled");
        return;
      }

      checkout.classList.remove("disabled");
      items.innerHTML = cart.map(item => `
        <article class="drawer-item">
          <h3>${item.name}</h3>
          <div class="drawer-row">
            <span>${formatPrice(item.price)} × ${item.quantity}</span>
            <strong>${formatPrice(item.price * item.quantity)}</strong>
          </div>
          <div class="drawer-controls">
            <button type="button" data-drawer-action="minus" data-id="${item.id}">−</button>
            <strong>${item.quantity}</strong>
            <button type="button" data-drawer-action="plus" data-id="${item.id}">+</button>
            <button class="drawer-remove" type="button" data-drawer-action="remove" data-id="${item.id}">Usuń</button>
          </div>
        </article>
      `).join("");

      document.querySelectorAll("[data-drawer-action]").forEach(button => {
        button.addEventListener("click", () => {
          const cart = getCart();
          const item = cart.find(product => product.id === button.dataset.id);
          if (!item) return;

          if (button.dataset.drawerAction === "plus") item.quantity += 1;
          if (button.dataset.drawerAction === "minus") item.quantity -= 1;

          const updated = button.dataset.drawerAction === "remove"
            ? cart.filter(product => product.id !== item.id)
            : cart.filter(product => product.quantity > 0);

          saveCart(updated);
          renderDrawer();
        });
      });
    }

    const drawer = document.getElementById("cart-drawer");
    const overlay = document.getElementById("cart-overlay");

    function openDrawer() {
      renderDrawer();
      drawer.classList.add("open");
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }

    document.getElementById("open-cart").addEventListener("click", openDrawer);
    document.getElementById("close-cart").addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    document.querySelectorAll(".add-to-cart").forEach(button => {
      button.addEventListener("click", () => setTimeout(openDrawer, 120));
    });

    updateCartCount();
    renderDrawer();