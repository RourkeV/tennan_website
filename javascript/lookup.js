// Load categories from the API and render tabs/cards

const STATE = { flavours: [], toppings: [], thickness: [] };

const q = (sel) => document.querySelector(sel);
const qa = (sel) => Array.from(document.querySelectorAll(sel));

// Derive API base; fallback when opened via file://
const API_ORIGIN = (() => {
    const origin = window.location.origin;
    return origin && origin.startsWith('http') ? origin : 'http://localhost:3000';
})();
// Force API base to always use port 3000 where Node.js server runs
const API_BASE = 'http://localhost:3000/api';

// Normalize possible response shapes
function extractArray(json, key) {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (key && Array.isArray(json[key])) return json[key];
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    return [];
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

async function fetchAllCategories() {
  try {
    const [flavoursRes, toppingsRes, thicknessRes] = await Promise.all([
      fetch(`${API_BASE}/flavours`),
      fetch(`${API_BASE}/toppings`),
      fetch(`${API_BASE}/thicknesses`),
    ]);

    if (!flavoursRes.ok || !toppingsRes.ok || !thicknessRes.ok) {
      throw new Error('Unable to load categories. Please try again later.');
    }

    const flavoursJson = await flavoursRes.json();
    const toppingsJson = await toppingsRes.json();
    const thicknessJson = await thicknessRes.json();

    const flavours = extractArray(flavoursJson, 'flavours');
    const toppings = extractArray(toppingsJson, 'toppings');
    const thicknesses = extractArray(thicknessJson, 'thicknesses');

    STATE.flavours = flavours.map(f => ({
      id: f.flavour_id,
      name: f.flavour_name ?? f.name ?? String(f),
      desc: '',
      time: f.createdModified_at ?? f.updated_at ?? f.created_at ?? null
    }));
    STATE.toppings = toppings.map(t => ({
      id: t.topping_id,
      name: t.topping_name ?? t.name ?? String(t),
      desc: '',
      time: t.createdModified_at ?? t.updated_at ?? t.created_at ?? null
    }));
    STATE.thickness = thicknesses.map(th => ({
      id: th.thickness_id,
      name: th.thickness_name ?? th.name ?? String(th),
      desc: '',
      time: th.createdModified_at ?? th.updated_at ?? th.created_at ?? null
    }));

    console.log('Loaded lookup data:', {
      flavours: Array.isArray(STATE.flavours) ? STATE.flavours.length : 0,
      toppings: Array.isArray(STATE.toppings) ? STATE.toppings.length : 0,
      thickness: Array.isArray(STATE.thickness) ? STATE.thickness.length : 0,
    });
  } catch (err) {
    console.error('Lookup data fetch failed:', err);
    STATE.flavours = [];
    STATE.toppings = [];
    STATE.thickness = [];
    showToast('Failed to load categories. ' + (err.message || err), 'error');
  }
}

function renderCards(containerId, items, query = "") {
  const container = q(containerId);
  if (!container) return;
  const needle = query.trim().toLowerCase();
  const filtered = !needle
    ? items
    : items.filter(i =>
        i.name?.toLowerCase().includes(needle) ||
        (i.desc || "").toLowerCase().includes(needle)
      );
  let cardsHtml = filtered.length
    ? filtered.map(i => `
        <article class="card" tabindex="0" aria-label="${i.name}">
          <h3 class="card-title">${i.name}</h3>
          <p class="card-time">${fmtDate(i.time)}</p>
          <p class="card-desc">${i.desc || ""}</p>
          <div class="card-actions">
            <button class="btn-edit" aria-label="Edit ${i.name}" data-id="${i.id ?? ''}" data-name="${i.name}">Edit</button>
            <button class="btn-delete" aria-label="Delete ${i.name}" data-id="${i.id ?? ''}" data-name="${i.name}">Delete</button>
          </div>
        </article>`).join("")
    : `<p class="card-desc" style="padding:0.5rem;color:#666;">No items found.</p>`;

  // Add "Add new item" card
  const category = containerId.includes("flavours") ? "Flavour"
    : containerId.includes("toppings") ? "Topping"
    : "Thickness";
  cardsHtml += `
    <article class="card card-add" tabindex="0" aria-label="Add new ${category}">
      <h3 class="card-title">Add new ${category}</h3>
      <input type="text" class="add-input" placeholder="Enter ${category} name" />
      <div class="card-actions">
        <button class="btn-add" aria-label="Add ${category}">Add</button>
      </div>
    </article>
  `;
  container.innerHTML = cardsHtml;

    // Add event listeners for Edit buttons (manager only)
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'manager') {
      container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => {
          // Remove all edit effects by re-rendering all tabs
          renderCards("#flavours-list", STATE.flavours, q("#lookup-search")?.value || "");
          renderCards("#toppings-list", STATE.toppings, q("#lookup-search")?.value || "");
          renderCards("#thickness-list", STATE.thickness, q("#lookup-search")?.value || "");
          // Now activate edit for the clicked item only
          // Find the correct container and items for this button
          let thisContainerId = containerId;
          let thisItems = items;
          let thisQuery = query;
          // Find the card again in the newly rendered DOM
          setTimeout(() => {
            const container = q(thisContainerId);
            if (!container) return;
            const btns = container.querySelectorAll('.btn-edit');
            btns.forEach(b => {
              if (b.getAttribute('data-id') === btn.getAttribute('data-id')) {
                // Simulate click again, but now only for this button
                // Original edit logic
                const itemId = b.getAttribute('data-id');
                let itemName = b.getAttribute('data-name');
                if (itemName == null || itemName === 'null' || itemName.trim() === '') {
                  const card = b.closest('article.card');
                  const titleEl = card ? card.querySelector('.card-title') : null;
                  itemName = titleEl ? titleEl.textContent.trim() : '';
                }
                const card = b.closest('article.card');
                if (!card) return;
                const titleEl = card.querySelector('.card-title');
                const actionsEl = card.querySelector('.card-actions');
                if (!titleEl || !actionsEl) return;
                const originalName = itemName;
                titleEl.innerHTML = `<input type="text" class="edit-input" value="${itemName}" style="width:80%">`;
                actionsEl.innerHTML = `
                  <button class="btn-save" aria-label="Save">Save</button>
                  <button class="btn-cancel" aria-label="Cancel">Cancel</button>
                `;
                const inputEl = card.querySelector('.edit-input');
                const saveBtn = card.querySelector('.btn-save');
                const cancelBtn = card.querySelector('.btn-cancel');
                saveBtn.onclick = async () => {
                  const newName = inputEl.value.trim();
                  if (!newName || newName === originalName) {
                    renderCards(thisContainerId, thisItems, thisQuery);
                    return;
                  }
                  if (!confirm(`Are you sure you want to update '${originalName}' to '${newName}'? This action cannot be undone.`)) {
                    renderCards(thisContainerId, thisItems, thisQuery);
                    return;
                  }
                  let endpoint = "";
                  if (thisContainerId === "#flavours-list") endpoint = "flavours";
                  else if (thisContainerId === "#toppings-list") endpoint = "toppings";
                  else if (thisContainerId === "#thickness-list") endpoint = "thicknesses";
                  try {
                    const res = await fetch(`${API_BASE}/${endpoint}/${itemId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json", "x-user-id": localStorage.getItem('userId') },
                      body: JSON.stringify({ name: newName })
                    });
                    let errorText = '';
                    let data = {};
                    try {
                      data = await res.json();
                    } catch (e) {
                      errorText = await res.text();
                    }
                    if (res.ok && data.success) {
                      await fetchAllCategories();
                      let stateKey = endpoint;
                      if (endpoint === "thicknesses") stateKey = "thickness";
                      let updatedItems = Array.isArray(STATE[stateKey]) ? STATE[stateKey] : [];
                      renderCards(thisContainerId, updatedItems, thisQuery);
                      showToast(data.message || "Item updated successfully.", "success");
                    } else {
                      let msg = (data.message ? data.message + ' ' : '') + (data.error || errorText || "Failed to update item.");
                      showToast(msg.trim(), "error");
                      renderCards(thisContainerId, thisItems, thisQuery);
                    }
                  } catch (err) {
                    showToast("Error updating item: " + (err.message || err), "error");
                    renderCards(thisContainerId, thisItems, thisQuery);
                  }
                };
                cancelBtn.onclick = () => {
                  renderCards(thisContainerId, thisItems, thisQuery);
                };
              }
            });
          }, 0);
        };
      });
    }
  // Add event listener for the Add button
  const addBtn = container.querySelector('.btn-add');
  const addInput = container.querySelector('.add-input');
  if (addBtn && addInput) {
    addBtn.onclick = async () => {
      const value = addInput.value.trim();
      if (!value) return addInput.focus();

      let endpoint = "";
      if (category === "Flavour") endpoint = "flavours";
      else if (category === "Topping") endpoint = "toppings";
      else endpoint = "thicknesses";

      try {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": localStorage.getItem('userId') },
          body: JSON.stringify({ name: value })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          addInput.value = "";
          await fetchAllCategories();
          // Always rerender all tabs so UI is in sync
          renderCards("#flavours-list", STATE.flavours, q("#lookup-search")?.value || "");
          renderCards("#toppings-list", STATE.toppings, q("#lookup-search")?.value || "");
          renderCards("#thickness-list", STATE.thickness, q("#lookup-search")?.value || "");
          showToast(data.message || "Item added successfully!", "success");
        } else {
          let msg = (data.message ? data.message + ' ' : '') + (data.error || "Failed to add item.");
          showToast(msg.trim(), "error");
        }
      } catch (err) {
        showToast("Error adding item: " + (err.message || err), "error");
      }
    };
  }

  // Add event listeners for Delete buttons
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = async () => {
      const itemId = btn.getAttribute('data-id');
      const itemName = btn.getAttribute('data-name');
      if (!confirm(`Are you sure you want to delete '${itemName}'? This action cannot be undone.`)) return;

      // Determine endpoint and ID field
      let endpoint = "";
      if (containerId === "#flavours-list") endpoint = "flavours";
      else if (containerId === "#toppings-list") endpoint = "toppings";
      else if (containerId === "#thickness-list") endpoint = "thicknesses";

      try {
        const res = await fetch(`${API_BASE}/${endpoint}/${itemId}`, {
          method: "DELETE",
          headers: { "x-user-id": localStorage.getItem('userId') }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await fetchAllCategories();
          // Always rerender all tabs so UI is in sync
          renderCards("#flavours-list", STATE.flavours, q("#lookup-search")?.value || "");
          renderCards("#toppings-list", STATE.toppings, q("#lookup-search")?.value || "");
          renderCards("#thickness-list", STATE.thickness, q("#lookup-search")?.value || "");
          showToast(data.message || "Item deleted successfully.", "success");
        } else {
          let msg = (data.message ? data.message + ' ' : '') + (data.error || "Failed to delete item.");
          showToast(msg.trim(), "error");
        }
      } catch (err) {
        showToast("Error deleting item: " + (err.message || err), "error");
      }
    };
  });
}

function showTab(tabId, panelId) {
    qa(".tab").forEach((b) => {
    const active = b.id === tabId;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    });
    qa(".tab-panel").forEach((p) => {
    const active = p.id === panelId;
    p.classList.toggle("active", active);
    p.toggleAttribute("hidden", !active);
  } );
}

function initTabs() {
  qa(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panelId = btn.getAttribute("aria-controls");
      showTab(btn.id, panelId);
    });
  });
}

function activateDefaultTab() {
  const firstTab = q(".tab");
  if (firstTab) {
    const panelId = firstTab.getAttribute("aria-controls");
    showTab(firstTab.id, panelId);
  }
}

function initSearch() {
  const input = q("#lookup-search");
  input?.addEventListener("input", () => {
    const term = input.value || "";
    renderCards("#flavours-list", STATE.flavours, term);
    renderCards("#toppings-list", STATE.toppings, term);
    renderCards("#thickness-list", STATE.thickness, term);
  });
}

async function init() {
  await fetchAllCategories();
  renderCards("#flavours-list", STATE.flavours);
  renderCards("#toppings-list", STATE.toppings);
  renderCards("#thickness-list", STATE.thickness);
  initTabs();
  activateDefaultTab();
  initSearch();
}

document.addEventListener("DOMContentLoaded", () => {
  // Check user authentication
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');
  if (!userId || Number(userId) <= 0 || userRole !== 'manager') {
    window.location.href = 'home.html'; // or your home page path
    return;
  }
  // Home button navigation
  const homeBtn = document.getElementById('btn-to-home');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = '../pages/home.html';
    });
  }
  init();
});
// Express route for deleting a flavour
// Toast notification utility
function showToast(message, type = "info", duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

