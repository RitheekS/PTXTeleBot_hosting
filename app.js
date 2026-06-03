/**
 * PTX Shop — Telegram Web App Logic
 *
 * Manages product display, size selection, cart state,
 * and sends the final cart payload to the Telegram bot
 * via Telegram.WebApp.sendData().
 */

// ── Telegram WebApp SDK ──
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ── State ──
let products = [];
let cart = []; // { productId, name, size, quantity, price, image_url }

// ── DOM References ──
const productsContainer = document.getElementById('productsContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const cartToggle = document.getElementById('cartToggle');
const cartBadge = document.getElementById('cartBadge');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartEmpty = document.getElementById('cartEmpty');
const cartFooter = document.getElementById('cartFooter');
const cartTotal = document.getElementById('cartTotal');

// ── Toast element (created dynamically) ──
const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);

// ── Initialize ──
loadProducts();

async function loadProducts() {
    try {
        const res = await fetch('products.json');
        products = await res.json();
        renderProducts();
    } catch (err) {
        console.error('Failed to load products:', err);
        loadingSpinner.innerHTML = '<p>⚠️ Failed to load products</p>';
    }
}

function renderProducts() {
    loadingSpinner.style.display = 'none';

    products.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.id = `product-${product.id}`;

        const hasVariants = product.variants.length > 1 || product.variants[0] !== 'One Size';
        const defaultSize = hasVariants ? '' : 'One Size';

        card.innerHTML = `
            <div class="product-image-wrapper">
                <img class="product-image" src="${product.image_url}" alt="${product.name}" loading="lazy">
                <span class="product-price-tag">RM ${(product.price / 100).toFixed(2)}</span>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                ${hasVariants ? `
                    <p class="size-selector-label">Select Size</p>
                    <div class="size-selector" data-product-id="${product.id}">
                        ${product.variants.map(v => `
                            <button class="size-chip" data-size="${v}">${v}</button>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="product-actions">
                    <div class="qty-control">
                        <button class="qty-btn" data-action="decrease" data-product-id="${product.id}">−</button>
                        <span class="qty-value" id="qty-${product.id}">1</span>
                        <button class="qty-btn" data-action="increase" data-product-id="${product.id}">+</button>
                    </div>
                    <button class="add-to-cart-btn"
                            data-product-id="${product.id}"
                            ${hasVariants ? 'disabled' : ''}
                            data-default-size="${defaultSize}">
                        Add to Cart
                    </button>
                </div>
            </div>
        `;

        productsContainer.appendChild(card);
    });

    // ── Event Delegation ──
    productsContainer.addEventListener('click', handleProductClick);
}

function handleProductClick(e) {
    const target = e.target;

    // Size chip click
    if (target.classList.contains('size-chip')) {
        const selectorDiv = target.closest('.size-selector');
        const productId = selectorDiv.dataset.productId;

        // Deselect siblings
        selectorDiv.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
        target.classList.add('selected');

        // Enable Add to Cart
        const addBtn = document.querySelector(`.add-to-cart-btn[data-product-id="${productId}"]`);
        if (addBtn) addBtn.disabled = false;

        return;
    }

    // Quantity buttons
    if (target.classList.contains('qty-btn')) {
        const productId = target.dataset.productId;
        const qtyEl = document.getElementById(`qty-${productId}`);
        let qty = parseInt(qtyEl.textContent, 10);

        if (target.dataset.action === 'increase') {
            qty = Math.min(qty + 1, 10);
        } else {
            qty = Math.max(qty - 1, 1);
        }
        qtyEl.textContent = qty;
        return;
    }

    // Add to Cart
    if (target.classList.contains('add-to-cart-btn')) {
        const productId = target.dataset.productId;
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // Get selected size
        let size = target.dataset.defaultSize;
        if (!size) {
            const selectedChip = document.querySelector(`.size-selector[data-product-id="${productId}"] .size-chip.selected`);
            if (!selectedChip) return;
            size = selectedChip.dataset.size;
        }

        // Get quantity
        const qtyEl = document.getElementById(`qty-${productId}`);
        const quantity = parseInt(qtyEl.textContent, 10);

        addToCart(product, size, quantity);

        // Button feedback
        const originalText = target.textContent;
        target.textContent = '✓ Added!';
        target.classList.add('added');
        setTimeout(() => {
            target.textContent = originalText;
            target.classList.remove('added');
        }, 1200);

        showToast(`${product.name} (${size}) added to cart`);
        return;
    }
}

// ── Cart Logic ──
function addToCart(product, size, quantity) {
    const existingIndex = cart.findIndex(
        item => item.productId === product.id && item.size === size
    );

    if (existingIndex >= 0) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            size: size,
            quantity: quantity,
            price: product.price,
            image_url: product.image_url
        });
    }

    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
    renderCartItems();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Badge
    cartBadge.textContent = totalItems;
    cartBadge.classList.toggle('visible', totalItems > 0);

    // Total text
    cartTotal.textContent = `RM ${(totalPrice / 100).toFixed(2)}`;

    // Toggle empty state
    const isEmpty = cart.length === 0;
    cartEmpty.classList.toggle('visible', isEmpty);
    cartItems.style.display = isEmpty ? 'none' : 'block';
    cartFooter.style.display = isEmpty ? 'none' : 'block';

    // Telegram MainButton
    if (totalItems > 0) {
        tg.MainButton.setText(`Checkout · RM ${(totalPrice / 100).toFixed(2)}`);
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
}

function renderCartItems() {
    cartItems.innerHTML = '';

    cart.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <img class="cart-item-image" src="${item.image_url}" alt="${item.name}">
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-meta">Size: ${item.size} · Qty: ${item.quantity}</div>
            </div>
            <div class="cart-item-price">RM ${(item.price * item.quantity / 100).toFixed(2)}</div>
            <button class="cart-item-remove" data-index="${index}" aria-label="Remove item">&times;</button>
        `;
        cartItems.appendChild(el);
    });

    // Remove button events
    cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            removeFromCart(idx);
        });
    });
}

// ── Cart Drawer Toggle ──
function openCart() {
    renderCartItems();
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
}

function closeCart() {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
}

cartToggle.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// ── Checkout via Telegram MainButton ──
tg.MainButton.color = tg.themeParams.button_color || '#6c63ff';
tg.MainButton.textColor = tg.themeParams.button_text_color || '#ffffff';

tg.MainButton.onClick(() => {
    if (cart.length === 0) return;

    const payload = {
        items: cart.map(item => ({
            product_id: item.productId,
            name: item.name,
            size: item.size,
            quantity: item.quantity,
            price: item.price
        })),
        total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    };

    tg.sendData(JSON.stringify(payload));
});

// ── Toast Helper ──
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Initial UI State ──
updateCartUI();
