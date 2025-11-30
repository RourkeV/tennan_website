// Example order submission function

async function submitOrder(milkshakes, subtotal, tax, total) {
    // Limit milkshake count to 10
    if (milkshakes.length > 10) {
        alert('You can only order up to 10 milkshakes per order.');
        return;
    }

    // Get logged-in user ID from localStorage (set during login)
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        alert('Please login to place an order');
        window.location.href = '../index.html';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId  // Send authenticated user ID in header
            },
            body: JSON.stringify({
                subtotal: subtotal,
                tax: tax,
                total: total,
                milkshakes: milkshakes
            })
        });

        const result = await response.json();

        if (result.success) {
            alert((result.message || 'Order placed successfully!') + `\nTotal milkshakes: ${result.updatedOrderAmount}`);
            // Optionally update UI with new order count
            updateOrderCountDisplay(result.updatedOrderAmount);
            // Clear cart or redirect to confirmation page
        } else {
            let msg = (result.message ? result.message + ' ' : '') + (result.error || 'Order failed.');
            alert(msg.trim());
        }
    } catch (error) {
        console.error('Order error:', error);
        alert('Unable to place order. ' + (error.message || 'Please try again.'));
    }
}

// Optional: Update display of order count
function updateOrderCountDisplay(count) {
    const orderCountElement = document.getElementById('user-order-count');
    if (orderCountElement) {
        orderCountElement.textContent = count;
    }
}

// Example usage when user clicks "Place Order" button
document.getElementById('placeOrderBtn')?.addEventListener('click', async () => {
    const milkshakes = [
        {
            flavor: 'Chocolate',
            size: 'Large',
            thickness: 'Thick',
            topping: 'Sprinkles',
            price: 40.00
        },
        {
            flavor: 'Vanilla',
            size: 'Medium',
            thickness: 'Medium',
            topping: 'Cherry',
            price: 35.00
        }
    ];
    
    const subtotal = 75.00;
    const tax = 11.25;
    const total = 86.25;
    
    await submitOrder(milkshakes, subtotal, tax, total);
});