// Tab switching logic and audit log fetch
document.addEventListener('DOMContentLoaded', () => {
  // Check user authentication
  if (!localStorage.getItem('userId') || Number(localStorage.getItem('userId')) <= 0) {
    window.location.href = 'signin-signup.html';
  }

  // Tab switching logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tabContents.forEach(tc => tc.style.display = 'none');
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const tab = document.getElementById(tabId);
      if (tab) {
        tab.classList.add('active');
        tab.style.display = '';
      }
      // Fetch audit log only when audit tab is activated
      if (tabId === 'audit-tab') {
        fetchAuditLog();
      }
      if (tabId === 'summary-tab') {
        fetchSummary();
      }
      if (tabId === 'orders-tab') {
        fetchRecentOrders();
      }
      if (tabId === 'categories-tab') {
        fetchTopCategories();
      }
    });
  });

  // Initial load for default tab
  fetchSummary();
  fetchTopCategories();
  fetchRecentOrders();
  fetchOrdersBarCharts();
});

function fetchAuditLog() {
  const el = document.getElementById('audit-log-content');
  el.textContent = 'Loading...';
  fetch('/api/audit/recent?limit=25', {
    headers: {
      'x-user-id': Number(localStorage.getItem('userId')) || ''
    }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && Array.isArray(data.audits)) {
        if (data.audits.length === 0) {
          el.textContent = 'No audit records found.';
          return;
        }
        el.innerHTML = `
          <table style="width:100%;border-collapse:collapse;box-shadow:0 2px 8px rgba(0,0,0,0.06);background:#fff;border-radius:8px;overflow:hidden;">
            <thead style="background:#f5f5f5;">
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              ${data.audits.map(a => `
                <tr>
                  <td>${new Date(a.timestamp).toLocaleString()}</td>
                  <td>${a.user || 'N/A'}</td>
                  <td>${a.action || 'N/A'}</td>
                  <td>${a.field || 'N/A'}</td>
                  <td>${a.old_value ?? ''}</td>
                  <td>${a.new_value ?? ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        el.textContent = 'Failed to load audit log.';
      }
    })
    .catch(() => {
      el.textContent = 'Error loading audit log.';
    });
}
// Reports page JS
// Fetch and display summary, top categories, and user orders

document.addEventListener('DOMContentLoaded', () => {
  // Check user authentication
  if (!localStorage.getItem('userId') || Number(localStorage.getItem('userId')) <= 0) {
    window.location.href = 'signin-signup.html'; // or your login page path
  }

  fetchSummary();
  fetchTopCategories();
  fetchRecentOrders();
  fetchOrdersBarCharts();
});

function fetchSummary() {
  fetch('/api/reports/summary', {
    headers: {
      'x-user-id': Number(localStorage.getItem('userId')) || ''
    }
  })
    .then(res => res.json())
    .then(data => {
      const tableBody = document.getElementById('summary-table-body');
      if (data.success) {
        // Fallbacks for missing data
        const ordersToday = data.ordersToday != null ? data.ordersToday : '0';
        const totalOrders = data.totalOrders != null ? data.totalOrders : '0';
        const topFlavour = data.topFlavour || 'N/A';
        const topTopping = data.topTopping || 'N/A';
        const topThickness = data.topThickness || 'N/A';
        // Update summary table
        if (tableBody) {
          tableBody.innerHTML = `
            <tr><td>Orders Today</td><td style="text-align:right;">${ordersToday}</td></tr>
            <tr><td>Total Orders</td><td style="text-align:right;">${totalOrders}</td></tr>
            <tr><td>Top Flavour</td><td style="text-align:right;">${topFlavour}</td></tr>
            <tr><td>Top Topping</td><td style="text-align:right;">${topTopping}</td></tr>
            <tr><td>Top Thickness</td><td style="text-align:right;">${topThickness}</td></tr>
          `;
        }
      } else {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan='2'>Failed to load summary.</td></tr>`;
      }
    })
    .catch(() => {
      const tableBody = document.getElementById('summary-table-body');
      if (tableBody) tableBody.innerHTML = `<tr><td colspan='2'>Error loading summary.</td></tr>`;
    });
}

function fetchUserOrders() {
  fetch('/api/reports/recent-orders', {
    headers: {
      'x-user-id': Number(localStorage.getItem('userId')) || ''
    }
  })
    .then(res => res.json())
    .then(data => {
      const el = document.getElementById('user-orders-content');
      if (data.success) {
        if (data.orders.length === 0) {
          el.textContent = 'No recent orders.';
          return;
        }
        el.innerHTML = `
          <table>
            <thead><tr><th>Order ID</th><th>User</th><th>Date</th><th>Total</th></tr></thead>
            <tbody>
              ${data.orders.map(o => `<tr><td>${o.order_id}</td><td>${o.name || 'N/A'}</td><td>${new Date(o.order_date).toLocaleString()}</td><td>R${o.total}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      } else {
        el.textContent = 'Failed to load recent orders.';
      }
    })
    .catch(() => {
      document.getElementById('user-orders-content').textContent = 'Error loading recent orders.';
    });
}

function  fetchTopCategories() {
    fetch('/api/reports/top-categories', {
      headers: {
        'x-user-id': Number(localStorage.getItem('userId')) || ''
      }
    })
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById('top-categories-content');
            if(data.success){
                // Find the max length among the three arrays
                const maxLen = Math.max(
                  data.topFlavours.length,
                  data.topToppings.length,
                  data.topThickness.length
                );
                if (maxLen === 0) {
                  el.textContent = 'No categories available';
                  return;
                }
                el.innerHTML = `
                  <table class="top-categories-table">
                    <thead>
                      <tr>
                        <th>Top Flavours</th>
                        <th>Top Toppings</th>
                        <th>Top Thickness</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Array.from({ length: maxLen }).map((_, i) => `
                        <tr>
                          <td>${data.topFlavours[i] ? data.topFlavours[i].name + ' (' + data.topFlavours[i].count + ')' : ''}</td>
                          <td>${data.topToppings[i] ? data.topToppings[i].name + ' (' + data.topToppings[i].count + ')' : ''}</td>
                          <td>${data.topThickness[i] ? data.topThickness[i].name + ' (' + data.topThickness[i].count + ')' : ''}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `;                
            } else {
                el.textContent = 'Failed to load categories'
            }
        })
        .catch(() => {
      document.getElementById('top-categories-content').textContent = 'Error loading top categories.';
    });
}

function fetchRecentOrders() {
  fetch('/api/reports/recent-orders', {
    headers: {
      'x-user-id': Number(localStorage.getItem('userId')) || ''
    }
  })
    .then(res => res.json())
    .then(data => {
      const el = document.getElementById('user-orders-content');
      if (data.success) {
        if (data.orders.length === 0) {
          el.textContent = 'No recent orders.';
          return;
        }
        el.innerHTML = data.orders.map(o => `
          <div class="user-order">
            <div class="user-order-header">User: ${o.user.name || 'N/A'} (${o.user.email || 'N/A'})</div>
            <ul class="user-order-list">
              ${o.milkshakes.map(m => `
                <li><strong>${m.flavor}</strong> <span>(${m.size}, ${m.thickness}, ${m.topping})</span></li>
              `).join('')}
            </ul>
            <div style="margin-top:0.7em;font-size:0.98em;color:#555;">Order Date: ${new Date(o.order_date).toLocaleString()} | Total: R${o.total}</div>
          </div>
        `).join('');
      } else {
        el.textContent = 'Failed to load recent orders.';
      }
    })
    .catch(() => {
      document.getElementById('user-orders-content').textContent = 'Error loading recent orders.';
    });
}

// ...existing code...

// Add Chart.js via CDN
if (!document.getElementById('chartjs-script')) {
  const script = document.createElement('script');
  script.id = 'chartjs-script';
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
  document.head.appendChild(script);
}

function renderBarChart({ ctxId, labels, datasets, chartLabel }) {
  const ctx = document.getElementById(ctxId).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: {
          display: true,
          text: chartLabel,
          font: { size: 18 }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Period' } },
        y: { title: { display: true, text: 'Order Count' }, beginAtZero: true }
      }
    }
  });
}

function fetchOrdersBarCharts() {
  fetch('/api/reports/orders-per-week', {
    headers: {
      'x-user-id': Number(localStorage.getItem('userId')) || ''
    }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const labels = data.data.map(d => `W${d.week} ${d.year}`);
        const counts = data.data.map(d => d.count);
        renderBarChart({
          ctxId: 'ordersBarChart',
          labels,
          datasets: [{
            label: 'Orders per Week',
            data: counts,
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          }],
          chartLabel: 'Weekly Orders (Last 12 Weeks)'
        });
      }
    });
  fetch('/api/reports/orders-per-month', {
    headers: {
      'x-user-id': Number(localStorage.getItem('userId')) || ''
    }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const labels = data.data.map(d => `${d.month}/${d.year}`);
        const counts = data.data.map(d => d.count);
        renderBarChart({
          ctxId: 'ordersMonthBarChart',
          labels,
          datasets: [{
            label: 'Orders per Month',
            data: counts,
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }],
          chartLabel: 'Monthly Orders (Last 12 Months)'
        });
      }
    });
}

