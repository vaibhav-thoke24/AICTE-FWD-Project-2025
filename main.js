const hamburger = document.querySelector(".hamburger");
const navlist = document.querySelector(".navlist");
const overlay = document.getElementById("overlay");
const icon = hamburger.querySelector("i");

hamburger.addEventListener("click", (e) => {
    e.preventDefault();
    navlist.classList.toggle("show");
    overlay.classList.toggle("active");

    // Swap icon class between bars and x
    if (icon.classList.contains("fa-bars")) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-circle-xmark");
    } else {
        icon.classList.remove("fa-circle-xmark");
        icon.classList.add("fa-bars");
    }
});

// Close menu when clicking outside
overlay.addEventListener("click", () => {
    navlist.classList.remove("show");
    overlay.classList.remove("active");

    // Make sure icon goes back to hamburger
    if (icon.classList.contains("fa-circle-xmark")) {
        icon.classList.remove("fa-circle-xmark");
        icon.classList.add("fa-bars");
    }
});

// Cart utilities using localStorage
const CART_STORAGE_KEY = 'tg_cart_v1';

function loadCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function formatINR(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

function addItemToCart(item) {
    const cart = loadCart();
    const existing = cart.find(p => p.id === item.id);
    if (existing) {
        existing.qty += item.qty;
    } else {
        cart.push(item);
    }
    saveCart(cart);
}

function removeItemFromCart(id) {
    const cart = loadCart().filter(p => p.id !== id);
    saveCart(cart);
}

function updateItemQty(id, qty) {
    const cart = loadCart().map(p => p.id === id ? { ...p, qty: Math.max(1, qty) } : p);
    saveCart(cart);
}

function clearCart() {
    saveCart([]);
}

function getCartItemsCount() {
    return loadCart().reduce((sum, p) => sum + p.qty, 0);
}

function updateCartCountBadges() {
    const count = getCartItemsCount();
    const badges = document.querySelectorAll('.cart-count');
    badges.forEach(b => {
        b.textContent = String(count);
        b.style.display = count > 0 ? 'inline-block' : 'none';
    });
}

// patch saves to also update badges
const _saveCartOriginal = saveCart;
saveCart = function(cart) {
    _saveCartOriginal(cart);
    updateCartCountBadges();
};

// Ensure count is set after DOM ready on any page
window.addEventListener('DOMContentLoaded', () => {
    updateCartCountBadges();
});

// Also update after add-to-cart action in feedback path
// (bootstrapAddToCartButtons already calls addItemToCart -> saveCart -> updateCartCountBadges)

// Hook up Add to Cart buttons on product cards
function bootstrapAddToCartButtons() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        const btn = card.querySelector('.add-to-cart');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const titleEl = card.querySelector('.title');
            const priceEl = card.querySelector('.amount');
            const imgEl = card.querySelector('img');
            const name = titleEl ? titleEl.textContent.trim() : `Product ${index + 1}`;
            const priceText = priceEl ? priceEl.textContent.replace(/[^\d]/g, '') : '0';
            const price = parseInt(priceText, 10) || 0;
            const image = imgEl ? imgEl.getAttribute('src') : '';
            const id = `${name}-${image}`;
            addItemToCart({ id, name, price, image, qty: 1 });
            // simple feedback
            btn.textContent = 'Added';
            setTimeout(() => (btn.textContent = 'Add to Cart'), 1000);
        });
    });
}

// Render cart page if present
function renderCartPage() {
    const wrapper = document.getElementById('cart-wrapper');
    const emptyState = document.getElementById('cart-empty');
    const list = document.getElementById('cart-list');
    const itemsEl = document.getElementById('summary-items');
    const subtotalEl = document.getElementById('summary-subtotal');
    const shippingEl = document.getElementById('summary-shipping');
    const totalEl = document.getElementById('summary-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const clearBtn = document.getElementById('clear-cart-btn');

    if (!wrapper || !list) return;

    function compute(cart) {
        const items = cart.reduce((sum, p) => sum + p.qty, 0);
        const subtotal = cart.reduce((sum, p) => sum + p.price * p.qty, 0);
        const shipping = subtotal > 0 ? 0 : 0; // free shipping placeholder
        const total = subtotal + shipping;
        return { items, subtotal, shipping, total };
    }

    function render() {
        const cart = loadCart();
        if (cart.length === 0) {
            // Show empty state, hide cart list, and reset summary
            wrapper.hidden = true;
            emptyState.hidden = false;
            emptyState.style.display = 'grid';
            if (list) list.innerHTML = '';
            if (itemsEl) itemsEl.textContent = '0';
            if (subtotalEl) subtotalEl.textContent = formatINR(0);
            if (shippingEl) shippingEl.textContent = formatINR(0);
            if (totalEl) totalEl.textContent = formatINR(0);
            return;
        }
        // Show cart list and hide empty state
        wrapper.hidden = false;
        emptyState.hidden = true;
        emptyState.style.display = 'none';

        list.innerHTML = '';
        cart.forEach((p) => {
            const row = document.createElement('div');
            row.className = 'cart-row';
            row.innerHTML = `
                <div class="cart-product">
                    <img src="${p.image}" alt="${p.name}">
                    <div class="info">
                        <p class="name">${p.name}</p>
                        <button class="remove" aria-label="Remove">Remove</button>
                    </div>
                </div>
                <div class="cart-price">${formatINR(p.price)}</div>
                <div class="cart-qty">
                    <button class="qty-btn dec" aria-label="Decrease">-</button>
                    <input type="number" min="1" value="${p.qty}" />
                    <button class="qty-btn inc" aria-label="Increase">+</button>
                </div>
                <div class="cart-subtotal">${formatINR(p.price * p.qty)}</div>
                <div class="cart-actions">
                    <button class="remove-icon" aria-label="Remove"><i class="fa-solid fa-trash"></i></button>
                </div>`;
            list.appendChild(row);

            const input = row.querySelector('input');
            const dec = row.querySelector('.dec');
            const inc = row.querySelector('.inc');
            const removeBtns = row.querySelectorAll('.remove, .remove-icon');

            function sync(newQty) {
                updateItemQty(p.id, newQty);
                render();
            }

            input.addEventListener('change', () => {
                const val = parseInt(input.value, 10) || 1;
                sync(Math.max(1, val));
            });
            dec.addEventListener('click', () => sync(p.qty - 1));
            inc.addEventListener('click', () => sync(p.qty + 1));
            removeBtns.forEach(b => b.addEventListener('click', () => {
                removeItemFromCart(p.id);
                render();
            }));
        });

        const { items, subtotal, shipping, total } = compute(loadCart());
        if (itemsEl) itemsEl.textContent = String(items);
        if (subtotalEl) subtotalEl.textContent = formatINR(subtotal);
        if (shippingEl) shippingEl.textContent = formatINR(shipping);
        if (totalEl) totalEl.textContent = formatINR(total);
    }

    render();

    if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
        alert('Checkout flow not implemented.');
    });
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (confirm('Clear the cart?')) {
            clearCart();
            render();
        }
    });
}

window.renderCartPage = renderCartPage;

// Bootstraps for all pages
document.addEventListener('DOMContentLoaded', () => {
    bootstrapAddToCartButtons();
    // Dynamic Our Products rendering
    setupOurProducts();
});

// Example cart store: [{ id, price, qty }]
let cartItems = [];

// Compute subtotal from in-memory cart
const getSubtotal = () => cartItems.reduce((sum, i) => sum + (i.price * i.qty), 0);

// Shipping rule:
// - subtotal > 499 → ₹40 shipping
// - subtotal ≤ 499 → ₹0 shipping (free)
function computeShipping(subtotal) {
	return subtotal > 499 ? 40 : 0;
}

// Update the Order Summary UI
function updateOrderSummary() {
	const subtotal = getSubtotal();
	const shipping = computeShipping(subtotal);
	const finalTotal = subtotal + shipping;

	const orderTotalEl = document.getElementById('orderTotal');
	const shippingEl = document.getElementById('shippingCharges');
	const finalTotalEl = document.getElementById('finalTotal');

	if (orderTotalEl) orderTotalEl.textContent = formatINR(subtotal);
	if (shippingEl) shippingEl.textContent = formatINR(shipping);
	if (finalTotalEl) finalTotalEl.textContent = formatINR(finalTotal);
}

// Call these whenever items are added/removed/qty-changed
function addItem(id, price, qty = 1) {
	const idx = cartItems.findIndex(i => i.id === id);
	if (idx >= 0) cartItems[idx].qty += qty;
	else cartItems.push({ id, price: Number(price) || 0, qty: Math.max(1, qty) });
	updateOrderSummary();
}

function removeItem(id) {
	cartItems = cartItems.filter(i => i.id !== id);
	updateOrderSummary();
}

function setQty(id, qty) {
	const item = cartItems.find(i => i.id === id);
	if (!item) return;
	item.qty = Math.max(0, Math.floor(qty) || 0);
	if (item.qty === 0) removeItem(id);
	else updateOrderSummary();
}

// Ensure summary is correct on page load
document.addEventListener('DOMContentLoaded', updateOrderSummary);

// Filtering and sorting for product gallery
(function () {
	function parsePrice(text) {
		return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
	}

	function getControls() {
		return {
			category: document.getElementById('filterCategory'),
			min: document.getElementById('filterMin'),
			max: document.getElementById('filterMax'),
			tag: document.getElementById('filterTag'),
			sortBy: document.getElementById('sortBy')
		};
	}

	function applyFiltersAndSort() {
		const { category, min, max, tag, sortBy } = getControls();
		const minVal = min && min.value !== '' ? Number(min.value) : -Infinity;
		const maxVal = max && max.value !== '' ? Number(max.value) : Infinity;
		const catVal = category ? category.value.trim() : '';
		const tagVal = tag ? tag.value.trim() : '';

		const containers = document.querySelectorAll('.card-container');
		containers.forEach(container => {
			const cards = Array.from(container.querySelectorAll('.card'));

			// Filter
			const visibleCards = cards.filter(card => {
				const c = card.getAttribute('data-category') || '';
				const t = card.getAttribute('data-tags') || '';
				const priceAttr = card.getAttribute('data-price');
				const nameAttr = card.getAttribute('data-name') || '';
				const price = priceAttr ? Number(priceAttr) : parsePrice(card.querySelector('.amount')?.textContent || '0');

				if (catVal && c !== catVal) return false;
				if (tagVal && !t.toLowerCase().includes(tagVal.toLowerCase().replace(' new arrivals', 'New'))) return false;
				if (!(price >= minVal && price <= maxVal)) return false;
				return true;
			});

			// Hide/show
			cards.forEach(card => {
				card.style.display = visibleCards.includes(card) ? '' : 'none';
			});

			// Sort only visible cards
			let toSort = [...visibleCards];
			if (sortBy && sortBy.value) {
				const v = sortBy.value;
				toSort.sort((a, b) => {
					const ap = Number(a.getAttribute('data-price')) || parsePrice(a.querySelector('.amount')?.textContent || '0');
					const bp = Number(b.getAttribute('data-price')) || parsePrice(b.querySelector('.amount')?.textContent || '0');
					const an = (a.getAttribute('data-name') || a.querySelector('.title')?.textContent || '').trim().toLowerCase();
					const bn = (b.getAttribute('data-name') || b.querySelector('.title')?.textContent || '').trim().toLowerCase();
					if (v === 'priceAsc') return ap - bp;
					if (v === 'priceDesc') return bp - ap;
					if (v === 'nameAsc') return an.localeCompare(bn);
					if (v === 'nameDesc') return bn.localeCompare(an);
					return 0;
				});
			}

			// Re-append sorted visible cards to preserve layout order
			toSort.forEach(card => container.appendChild(card));
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		const { category, min, max, tag, sortBy } = getControls();
		[category, min, max, tag, sortBy].forEach(ctrl => ctrl && ctrl.addEventListener('input', applyFiltersAndSort));
		[category, tag, sortBy].forEach(ctrl => ctrl && ctrl.addEventListener('change', applyFiltersAndSort));
		applyFiltersAndSort();
	});
})();

// Our Products dynamic rendering
function setupOurProducts() {
    const grid = document.getElementById('our-products-grid');
    const sub = document.getElementById('our-products-sub');
    if (!grid) return;

    const allProducts = collectAllProductsFromDOM();

    function render(category) {
        grid.innerHTML = '';
        const filtered = category && category !== 'All' ? allProducts.filter(p => (p.category || '').toLowerCase() === category.toLowerCase()) : allProducts;
        if (sub) sub.textContent = category && category !== 'All' ? `Our Products – For ${capitalize(category)}` : 'Our Products – All Products';
        filtered.forEach((p, idx) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-category', p.category || '');
            card.setAttribute('data-name', p.name);
            card.setAttribute('data-price', String(p.price));
            card.innerHTML = `
                <img src="${p.image}" alt="${escapeHtml(p.name)}">
                <div class="card-content">
                    <p class="title">${escapeHtml(p.name)}</p>
                    <div class="price"><span class="amount">${formatINR(p.price)}</span></div>
                    <button class="add-to-cart">Add to Cart</button>
                </div>
            `;
            grid.appendChild(card);
        });
        // rebind add-to-cart on newly rendered cards
        bootstrapAddToCartButtons();
    }

    // Category buttons
    const bind = (id, cat) => document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); render(cat); window.scrollTo({ top: grid.parentElement.offsetTop - 80, behavior: 'smooth' }); });
    bind('btnCatMen', 'Men');
    bind('btnCatWomen', 'Women');
    bind('btnCatKids', 'Kids');
    bind('btnCatAccessories', 'Accessories');
    bind('btnCatAll', 'All');

    // Default: show all products
    render('All');
}

function collectAllProductsFromDOM() {
    // Read all product cards on page and infer category by nearest hints (image filenames or headings)
    // Prefer explicit data-category, fallback to guessing from image/name
    const cards = Array.from(document.querySelectorAll('.card'));
    return cards.map((card, i) => {
        const img = card.querySelector('img');
        const titleEl = card.querySelector('.title');
        const amountEl = card.querySelector('.amount');
        const price = parseInt((amountEl?.textContent || '0').replace(/[^\d]/g, ''), 10) || 0;
        const src = img?.getAttribute('src') || '';
        const name = (titleEl?.textContent || `Product ${i+1}`).trim();
        const explicit = card.getAttribute('data-category') || '';
        const category = explicit || guessCategoryFromNameOrImage(name, src);
        return { id: `${name}-${src}`, name, price, image: src, category };
    });
}

function guessCategoryFromNameOrImage(name, src) {
    const s = (name + ' ' + src).toLowerCase();
    if (s.includes('women')) return 'Women';
    if (s.includes('men')) return 'Men';
    if (s.includes('kid')) return 'Kids';
    if (s.includes('accessor')) return 'Accessories';
    return 'Accessories';
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Reviews & Feedback Module
(function () {
    const STORAGE_KEY = 'tg_reviews_v1';

    function loadReviews() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveReviews(reviews) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    }

    function createStarIcons(rating) {
        const wrap = document.createElement('div');
        wrap.className = 'stars';
        for (let i = 1; i <= 5; i++) {
            const iEl = document.createElement('i');
            iEl.className = 'fa-solid fa-star' + (i <= rating ? ' filled' : '');
            wrap.appendChild(iEl);
        }
        return wrap;
    }

    function renderReviews() {
        const list = document.getElementById('reviews-list');
        if (!list) return;
        const reviews = loadReviews();
        list.innerHTML = '';
        reviews.forEach(r => {
            const card = document.createElement('div');
            card.className = 'review-card';

            const header = document.createElement('div');
            header.className = 'review-header';
            const name = document.createElement('div');
            name.className = 'reviewer';
            name.textContent = r.name || 'Anonymous';
            const stars = createStarIcons(r.rating || 0);
            header.appendChild(name);
            header.appendChild(stars);

            const content = document.createElement('div');
            content.className = 'content';
            content.textContent = r.text || '';

            const meta = document.createElement('div');
            meta.className = 'meta';
            const date = new Date(r.date || Date.now());
            meta.textContent = date.toLocaleString();

            card.appendChild(header);
            card.appendChild(content);
            card.appendChild(meta);
            list.prepend(card);
        });
    }

    function seedSampleReviewsIfEmpty() {
        const existing = loadReviews();
        if (existing && existing.length > 0) return;
        const samples = [
            { name: 'Aarav', rating: 5, text: 'Fantastic quality and quick delivery. Highly recommended!', date: Date.now() - 86400000 * 2 },
            { name: 'Neha', rating: 4, text: 'Great collection. Sizing was perfect for me.', date: Date.now() - 86400000 * 5 },
            { name: 'Rahul', rating: 5, text: 'Loved the design and material. Will shop again.', date: Date.now() - 86400000 * 7 },
        ];
        saveReviews(samples);
    }

    function setupStarInput() {
        const starInput = document.getElementById('star-input');
        if (!starInput) return { getValue: () => 0, setValue: () => {} };
        const stars = Array.from(starInput.querySelectorAll('.star'));
        let selected = 0;

        function updateUI(hoverVal = 0) {
            const activeVal = hoverVal || selected;
            stars.forEach(btn => {
                const val = Number(btn.getAttribute('data-value')) || 0;
                btn.classList.toggle('filled', val <= activeVal);
                btn.classList.toggle('active', val <= activeVal);
                btn.setAttribute('aria-checked', String(val === activeVal));
            });
        }

        stars.forEach(btn => {
            const val = Number(btn.getAttribute('data-value')) || 0;
            btn.addEventListener('mouseenter', () => updateUI(val));
            btn.addEventListener('focus', () => updateUI(val));
            btn.addEventListener('mouseleave', () => updateUI());
            btn.addEventListener('blur', () => updateUI());
            btn.addEventListener('click', () => { selected = val; updateUI(); });
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selected = val;
                    updateUI();
                }
            });
        });

        updateUI();
        return {
            getValue: () => selected,
            setValue: (v) => { selected = Math.max(1, Math.min(5, Number(v) || 0)); updateUI(); }
        };
    }

    function setupForm() {
        const form = document.getElementById('review-form');
        const list = document.getElementById('reviews-list');
        if (!form || !list) return;
        const nameEl = document.getElementById('reviewerName');
        const textEl = document.getElementById('reviewText');
        const stars = setupStarInput();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = (nameEl?.value || '').trim() || 'Anonymous';
            const text = (textEl?.value || '').trim();
            const rating = stars.getValue();
            if (!text || rating === 0) {
                alert('Please provide a rating and your feedback.');
                return;
            }
            const newReview = { name, text, rating, date: Date.now() };
            const all = loadReviews();
            all.push(newReview);
            saveReviews(all);
            nameEl.value = '';
            textEl.value = '';
            stars.setValue(0);
            renderReviews();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        seedSampleReviewsIfEmpty();
        setupForm();
        renderReviews();
    });
})();