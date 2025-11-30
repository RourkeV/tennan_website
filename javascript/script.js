// Cache the logged-in user's order amount for discount logic
let cachedOrderAmount = 0;
const API_URL = 'http://localhost:3000/api';

async function loadUserOrderAmount() {
    const uid = localStorage.getItem('userId');
    if (!uid) return null;
    try {
        const resp = await fetch(`${API_URL}/users/${uid}`);
        if (!resp.ok) {
            const errorMsg = `Failed to load user info. Status: ${resp.status}`;
            alert(errorMsg);
            return null;
        }
        const data = await resp.json();
        if (!data.success) {
            let msg = (data.message ? data.message + ' ' : '') + (data.error || 'Failed to load user info.');
            alert(msg.trim());
            return null;
        }
        cachedOrderAmount = data?.user?.order_amount ?? 0;
        const orderAmtEl = document.getElementById('userOrderAmount');
        if (orderAmtEl) orderAmtEl.textContent = cachedOrderAmount;
        return cachedOrderAmount;
    } catch (err) {
        alert('Error loading user info: ' + (err.message || err));
        return null;
    }
}

// Lifetime discount tiers (inclusive):
// 0-4: 0%, 5-8: 5%, 9-12: 10%, 13+: 15%
function calculateDiscount(numOrders) {
    if (numOrders >= 13) return 15;
    if (numOrders >= 9) return 10;
    if (numOrders >= 5) return 5;
    return 0;
}

// Removed duplicate global toggleFinalize to avoid confusion; scoped version exists later.

// On page load, fetch user amount first
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserOrderAmount();

    // Show Lookup and Reports links only for manager
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'manager') {
        const lookupLink = document.getElementById('lookup-link');
        const reportsLink = document.getElementById('reports-link');
        if (lookupLink) lookupLink.style.display = '';
        if (reportsLink) reportsLink.style.display = '';
    }
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('Website loaded successfully!');
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    let createOrderBtn = document.getElementById('createOrderBtn');
    let orderFormsContainer = document.getElementById('orderFormsContainer');
    let milkshakeQuantity = document.getElementById('milkshakeQuantity');
    let payNowBtn = document.getElementById('payNowBtn');
    let userOrderAmountSpan = document.getElementById('userOrderAmount');

    function injectBasicOrderUI() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div>
                Your total milkshakes ordered: <span id="userOrderAmount">0</span>
            </div>
            <div style="margin-top:12px;">
                <input id="milkshakeQuantity" type="number" min="1" value="1" />
                <button id="createOrderBtn">Create Order Forms</button>
            </div>
            <div id="orderFormsContainer" style="margin-top:12px;"></div>
            <div style="margin-top:12px;">
                <p><strong>Subtotal:</strong> <span id="total">R 0</span></p>
                <p><strong>Discount:</strong> <span id="discount">R 0 (0%)</span></p>
                <p><strong>Tax (15%):</strong> <span id="tax">R 0</span></p>
                <p><strong>Grand Total:</strong> <span id="grandTotal">R 0</span></p>
            </div>
            <button id="checkoutBtn">Checkout</button>
        `;
        document.body.appendChild(wrapper);
    }

    // If missing, inject UI then re-query
    if (!createOrderBtn || !orderFormsContainer) {
        injectBasicOrderUI();
        createOrderBtn = document.getElementById('createOrderBtn');
        orderFormsContainer = document.getElementById('orderFormsContainer');
        milkshakeQuantity = document.getElementById('milkshakeQuantity');
        payNowBtn = document.getElementById('payNowBtn');
        userOrderAmountSpan = document.getElementById('userOrderAmount');
    }

    if (!createOrderBtn || !orderFormsContainer) {
        console.error('Order UI missing; cannot continue.');
        return;
    }

    function getFinalizedTotal() {
        return [...orderFormsContainer.querySelectorAll('.order-form-item')]
            .filter(f => f.dataset.done === 'true')
            .reduce((sum, f) => sum + (parseInt(f.dataset.total) || 0), 0);
    }

    function updateGrandTotals() {
        const subtotalEl = document.getElementById('total');
        const taxEl = document.getElementById('tax');
        const grandEl = document.getElementById('grandTotal');
        const discountEl = document.getElementById('discount');

        const subtotal = getFinalizedTotal();
        const discountPercent = calculateDiscount(cachedOrderAmount);
        const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2);
        const subtotalAfterDiscount = subtotal - discountAmount;
        const tax = +(subtotalAfterDiscount * 0.15).toFixed(2);
        const grand = +(subtotalAfterDiscount + tax).toFixed(2);

        if (subtotalEl) subtotalEl.textContent = `R ${subtotal}`;
        if (discountEl) discountEl.textContent = `R ${discountAmount} (${discountPercent}%)`;
        if (taxEl) taxEl.textContent = `R ${tax}`;
        if (grandEl) grandEl.textContent = `R ${grand}`;
    }

    async function ensureTotalsUpToDate() {
        if (!cachedOrderAmount) await loadUserOrderAmount();
        updateGrandTotals();
    }

    if (!createOrderBtn) {
        console.error('createOrderBtn not found in DOM at binding time.');
    } else {
        console.log('Attaching Create Order Forms click listener');
    }

    createOrderBtn.addEventListener('click', () => {
        console.log('Create Order Forms button clicked');
        orderFormsContainer.innerHTML = '';
        let quantity = parseInt(milkshakeQuantity?.value) || 1;
        if (quantity > 10) {
            quantity = 10;
            milkshakeQuantity.value = 10;
            alert('You can only create up to 10 milkshake orders at a time.');
        }
        for (let i = 1; i <= quantity; i++) {
            const form = document.createElement('div');
            form.className = 'order-form-item';
            form.dataset.done = 'false';
            form.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h4>Milkshake #${i}</h4>
                    <button type="button" class="delete-btn">Delete</button>
                </div>
                <label>Flavor:</label>
                <select name="flavor">
                    <option value="" disabled selected>Select flavor</option>
                    <option data-label="Vanilla" value="15">Vanilla</option>
                    <option data-label="Chocolate" value="17">Chocolate</option>
                    <option data-label="Strawberry" value="17">Strawberry</option>
                    <option data-label="Coffee" value="18">Coffee</option>
                    <option data-label="Banana" value="17">Banana</option>
                    <option data-label="Oreo" value="19">Oreo</option>
                    <option data-label="Bar-One" value="19">Bar-One</option>
                </select>
                <label>Size:</label>
                <select name="size">
                    <option value="" disabled selected>Select size</option>
                    <option data-label="Small" value="10">Small</option>
                    <option data-label="Medium" value="13">Medium</option>
                    <option data-label="Large" value="16">Large</option>
                </select>
                <label>Thickness:</label>
                <select name="thickness">
                    <option value="" disabled selected>Select thickness</option>
                    <option data-label="Icy" value="0">Icy</option>
                    <option data-label="Milky" value="1">Milky</option>
                    <option data-label="Thick" value="4">Thick</option>
                    <option data-label="TtthickkK (Double)" value="7">TtthickkK (Double)</option>
                </select>
                <label>Topping:</label>
                <select name="topping">
                    <option value="" disabled selected>Select topping</option>
                    <option data-label="Freeze-dried bananas" value="3">Freeze-dried bananas</option>
                    <option data-label="Frozen Strawberries" value="3">Frozen Strawberries</option>
                    <option data-label="Oreo crumbs" value="3">Oreo crumbs</option>
                    <option data-label="Bar-One syrup" value="3">Bar-One syrup</option>
                    <option data-label="Coffee powder w/ chocolate" value="3">Coffee powder w/ chocolate</option>
                    <option data-label="Chocolate vermicelli" value="3">Chocolate vermicelli</option>
                </select>
                <label>Milkshake Price:</label> <h3 class="orderPrice">R 0</h3>
                <button type="button" class="formDoneButton" disabled>Done</button>
            `;
            orderFormsContainer.appendChild(form);
        }
    });

    orderFormsContainer.addEventListener('change', e => {
        const form = e.target.closest('.order-form-item');
        if (!form) return;
        updateFormPrice(form);
        updateDoneButtonState(form);
    });

    orderFormsContainer.addEventListener('click', e => {
        const form = e.target.closest('.order-form-item');
        if (!form) return;

        if (e.target.classList.contains('delete-btn')) {
            form.remove();
            updateGrandTotals();
            return;
        }

        if (e.target.classList.contains('formDoneButton')) {
            toggleFinalize(form, e.target);
        }
    });

    function updateDoneButtonState(form) {
        const btn = form.querySelector('.formDoneButton');
        if (!btn) return;
        if (form.dataset.done === 'true') {
            btn.disabled = false;
            btn.textContent = 'Edit';
            return;
        }
        const allSelected = [...form.querySelectorAll('select')]
            .every(s => s.value && s.value !== '');
        btn.disabled = !allSelected;
        btn.textContent = 'Done';
    }

    function toggleFinalize(form, btn) {
        const isDone = form.dataset.done === 'true';
        if (!isDone) {
            if ([...form.querySelectorAll('select')].some(s => !s.value)) {
                alert('Select all options first.');
                return;
            }
            form.dataset.done = 'true';
            form.querySelectorAll('select').forEach(s => s.disabled = true);
            btn.textContent = 'Edit';
        } else {
            form.dataset.done = 'false';
            form.querySelectorAll('select').forEach(s => s.disabled = false);
            btn.textContent = 'Done';
            updateDoneButtonState(form);
        }
        // Recompute totals with discount immediately
        ensureTotalsUpToDate();
    }

    function updateFormPrice(form) {
        const priceEl = form.querySelector('.orderPrice');
        const total = [...form.querySelectorAll('select')]
            .reduce((sum, s) => sum + (parseInt(s.value) || 0), 0);
        form.dataset.total = total;
        if (priceEl) priceEl.textContent = `R ${total}`;
        updateGrandTotals();
    }

    // Store last orderId for payment
    let lastOrderId = null;

    async function submitOrder() {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            alert('Login first.');
            return;
        }
        const milkshakes = [...orderFormsContainer.querySelectorAll('.order-form-item')]
            .filter(f => f.dataset.done === 'true')
            .map(f => {
                const selects = f.querySelectorAll('select');
                const obj = {};
                selects.forEach(s => {
                    const label = s.selectedOptions[0]?.getAttribute('data-label') || 'Unknown';
                    obj[s.name] = label;
                    obj.priceParts = obj.priceParts || [];
                    obj.priceParts.push(parseInt(s.value) || 0);
                });
                const price = obj.priceParts.reduce((a, b) => a + b, 0);
                return {
                    flavor: obj['flavor'],
                    size: obj['size'],
                    thickness: obj['thickness'],
                    topping: obj['topping'],
                    price
                };
            });

        if (milkshakes.length === 0) {
            alert('Finalize at least one milkshake (press Done).');
            return;
        }

        const subtotal = milkshakes.reduce((s, m) => s + m.price, 0);
        const discountPercent = calculateDiscount(cachedOrderAmount);
        const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2);
        const subtotalAfterDiscount = subtotal - discountAmount;
        const tax = +(subtotalAfterDiscount * 0.15).toFixed(2);
        const total = +(subtotalAfterDiscount + tax).toFixed(2);

        try {
            const resp = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': uid
                },
                body: JSON.stringify({
                    subtotal: subtotalAfterDiscount,
                    tax,
                    total,
                    milkshakes
                })
            });
            const data = await resp.json();
            if (!data.success) {
                let msg = (data.message ? data.message + ' ' : '') + (data.error || 'Order failed.');
                alert(msg.trim());
                return;
            }
            lastOrderId = data.orderId;
            const savings = discountAmount > 0 ? `You saved R${discountAmount} (${discountPercent}%)! ` : '';
            alert((data.message || `Order ID ${data.orderId} saved.`) + ' ' + savings + `Overall milkshakes: ${data.updatedOrderAmount}`);
            if (userOrderAmountSpan) {
                // userOrderAmountSpan.textContent = data.updatedOrderAmount;
                updateOrderCountDisplay(data.updatedOrderAmount);
                cachedOrderAmount = data.updatedOrderAmount;
                // Recompute totals to reflect new lifetime-based discount tier
                updateGrandTotals();
            }
            // Show payment modal after order is placed
            showPaymentModal();
        } catch (e) {
            alert('Network error submitting order: ' + (e.message || e));
        }
    }

    // Payment modal logic
    function showPaymentModal() {
        const modal = document.getElementById('paymentModal');
        const closeBtn = document.getElementById('closePaymentModal');
        const paymentForm = document.getElementById('paymentForm');
        const paymentStatus = document.getElementById('paymentStatus');
        if (!modal || !paymentForm) return;
        modal.style.display = 'flex';
        paymentStatus.textContent = '';
        paymentForm.reset();

        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
        window.onclick = (event) => {
            if (event.target === modal) modal.style.display = 'none';
        };

        paymentForm.onsubmit = async (e) => {
            e.preventDefault();
            paymentStatus.textContent = 'Processing payment...';
            const cardName = document.getElementById('cardName').value.trim();
            const cardNumber = document.getElementById('cardNumber').value.trim();
            if (!cardName || !cardNumber) {
                paymentStatus.textContent = 'Please enter all card details.';
                return;
            }
            if (!lastOrderId) {
                paymentStatus.textContent = 'No order to pay for.';
                return;
            }
            try {
                const uid = localStorage.getItem('userId');
                const resp = await fetch(`${API_URL}/orders/${lastOrderId}/pay`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': uid
                    },
                    body: JSON.stringify({ cardName, cardNumber })
                });
                const text = await resp.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (jsonErr) {
                    paymentStatus.textContent = 'Server error: ' + text.substring(0, 100) + '...';
                    return;
                }
                if (data.success) {
                    paymentStatus.textContent = `Payment successful! Transaction ID: ${data.transactionId}`;
                } else {
                    paymentStatus.textContent = (data.message ? data.message + ' ' : '') + (data.error || 'Payment failed.');
                }
            } catch (err) {
                paymentStatus.textContent = 'Network error: ' + (err.message || err);
            }
        };
    }

    payNowBtn?.addEventListener('click', submitOrder);

    // Load user amount before interactions
    await loadUserOrderAmount();
});

function updateOrderCountDisplay(count) {
    const orderCountElement = document.getElementById('userOrderAmount');
    if (orderCountElement) {
        orderCountElement.textContent = Math.min(count, 10);
    }
}