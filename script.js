```javascript
/* ========================================
   CRM LR INTERIORES
   Cadastro de clientes e armazenamento local
======================================== */

"use strict";

const STORAGE_KEY = "lr-interiores-crm-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let clients = loadClients();

/* ---------- Armazenamento ---------- */

function loadClients() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((client) =>
      client &&
      typeof client.id === "string" &&
      typeof client.name === "string"
    );
  } catch (error) {
    console.error("Não foi possível carregar os clientes:", error);
    return [];
  }
}

function saveClients() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os clientes:", error);
    alert(
      "Não foi possível salvar os dados neste navegador. " +
      "Verifique o espaço disponível ou as configurações de privacidade."
    );
    return false;
  }
}

/* ---------- Navegação ---------- */

const pageNames = {
  dashboard: "Painel inicial",
  clientes: "Clientes",
  orcamentos: "Orçamentos",
  vendas: "Funil de vendas",
  producao: "Produção e entregas",
  financeiro: "Financeiro",
  marketing: "Marketing"
};

function navigateTo(pageName) {
  if (!pageNames[pageName]) return;

  $$(".page").forEach((page) => page.classList.remove("active"));
  $$(".nav-item").forEach((button) => button.classList.remove("active"));

  const page = $(`#page-${pageName}`);
  const navButton = $(`.nav-item[data-page="${pageName}"]`);

  if (page) page.classList.add("active");
  if (navButton) navButton.classList.add("active");

  $("#pageTitle").textContent = pageNames[pageName];
  $("#sidebar").classList.remove("open");

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (pageName === "clientes") {
    renderClients($("#clientSearch").value);
  }

  if (pageName === "dashboard") {
    renderDashboard();
  }
}

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.page);
  });
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.go);
  });
});

$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

/* ---------- Formulário de clientes ---------- */

function openClientForm(client = null) {
  const form = $("#clientForm");

  form.reset();
  $("#clientId").value = "";

  if (client) {
    $("#formTitle").textContent = "Editar cliente";
    $("#clientId").value = client.id;
    $("#clientName").value = client.name || "";
    $("#clientPhone").value = client.phone || "";
    $("#clientEmail").value = client.email || "";
    $("#clientSource").value = client.source || "";
    $("#clientAddress").value = client.address || "";
    $("#clientNotes").value = client.notes || "";
  } else {
    $("#formTitle").textContent = "Novo cliente";
  }

  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#clientName").focus({ preventScroll: true });
}

function closeClientForm() {
  $("#clientForm").hidden = true;
  $("#clientForm").reset();
  $("#clientId").value = "";
}

$("#newClientBtn").addEventListener("click", () => {
  openClientForm();
});

$("#cancelFormBtn").addEventListener("click", closeClientForm);
$("#cancelFormBtnBottom").addEventListener("click", closeClientForm);

$("#clientForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("#clientId").value;
  const name = $("#clientName").value.trim();
  const phone = $("#clientPhone").value.trim();
  const email = $("#clientEmail").value.trim();
  const source = $("#clientSource").value;
  const address = $("#clientAddress").value.trim();
  const notes = $("#clientNotes").value.trim();

  if (!name || !phone) {
    alert("Preencha o nome e o telefone do cliente.");
    return;
  }

  const existingClient = clients.find((client) => client.id === id);

  const clientData = {
    id: id || createId(),
    name,
    phone,
    email,
    source,
    address,
    notes,
    createdAt: existingClient?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const previousClients = [...clients];

  if (id) {
    clients = clients.map((client) =>
      client.id === id ? clientData : client
    );
  } else {
    clients.unshift(clientData);
  }

  if (!saveClients()) {
    clients = previousClients;
    return;
  }

  closeClientForm();
  renderClients($("#clientSearch").value);
  renderDashboard();

  alert(id ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!");
});

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ---------- Lista de clientes ---------- */

function renderClients(searchTerm = "") {
  const list = $("#clientList");
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");

  const filteredClients = clients.filter((client) => {
    const searchableText = [
      client.name,
      client.phone,
      client.email,
      client.source
    ].join(" ").toLocaleLowerCase("pt-BR");

    return searchableText.includes(normalizedSearch);
  });

  $("#clientCount").textContent =
    `${filteredClients.length} ${filteredClients.length === 1 ? "cliente" : "clientes"} encontrados`;

  if (filteredClients.length === 0) {
    list.innerHTML = `
      <div class="list-empty">
        ${clients.length === 0
          ? "Você ainda não cadastrou clientes."
          : "Nenhum cliente encontrado para essa busca."}
      </div>
    `;
    return;
  }

  list.innerHTML = filteredClients.map((client) => `
    <article class="client-row">
      <div class="client-avatar">${escapeHTML(getInitials(client.name))}</div>

      <div class="client-info">
        <strong>${escapeHTML(client.name)}</strong>
        <span>${escapeHTML(client.phone)}</span>
        ${client.email
          ? `<span>${escapeHTML(client.email)}</span>`
          : ""}
        ${client.source
          ? `<span class="client-source">${escapeHTML(client.source)}</span>`
          : ""}
      </div>

      <div class="client-actions">
        <button
          type="button"
          class="icon-button"
          data-action="edit"
          data-id="${escapeHTML(client.id)}"
          aria-label="Editar ${escapeHTML(client.name)}"
        >Editar</button>

        <button
          type="button"
          class="icon-button delete"
          data-action="delete"
          data-id="${escapeHTML(client.id)}"
          aria-label="Excluir ${escapeHTML(client.name)}"
        >Excluir</button>
      </div>
    </article>
  `).join("");
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("");
}

/* Evita que textos digitados pelo usuário sejam interpretados como HTML. */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return replacements[character];
  });
}

$("#clientSearch").addEventListener("input", (event) => {
  renderClients(event.target.value);
});

$("#clientList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const client = clients.find((item) => item.id === button.dataset.id);
  if (!client) return;

  if (button.dataset.action === "edit") {
    openClientForm(client);
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(
      `Deseja realmente excluir o cadastro de "${client.name}"?`
    );

    if (!confirmed) return;

    const previousClients = [...clients];
    clients = clients.filter((item) => item.id !== client.id);

    if (!saveClients()) {
      clients = previousClients;
      return;
    }

    renderClients($("#clientSearch").value);
    renderDashboard();
  }
});

/* ---------- Painel inicial ---------- */

function renderDashboard() {
  $("#totalClientes").textContent = clients.length;

  const recentClients = $("#recentClients");

  if (clients.length === 0) {
    recentClients.innerHTML = `
      <div class="empty-icon">♙</div>
      <strong>Nenhum cliente cadastrado ainda</strong>
      <p>Comece adicionando seu primeiro cliente.</p>
      <button class="button button-primary" data-go="clientes">
        Cadastrar cliente
      </button>
    `;

    recentClients.querySelector("[data-go]").addEventListener("click", () => {
      navigateTo("clientes");
    });

    return;
  }

  const recent = [...clients]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) -
                    new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  recentClients.innerHTML = recent.map((client) => `
    <article class="client-row">
      <div class="client-avatar">${escapeHTML(getInitials(client.name))}</div>
      <div class="client-info">
        <strong>${escapeHTML(client.name)}</strong>
        <span>${escapeHTML(client.phone)}</span>
        ${client.source
          ? `<span class="client-source">${escapeHTML(client.source)}</span>`
          : ""}
      </div>
      <button
        type="button"
        class="button button-outline"
        data-edit-recent="${escapeHTML(client.id)}"
      >Editar</button>
    </article>
  `).join("");

  recentClients.querySelectorAll("[data-edit-recent]").forEach((button) => {
    button.addEventListener("click", () => {
      const client = clients.find((item) => item.id === button.dataset.editRecent);
      if (!client) return;

      navigateTo("clientes");
      openClientForm(client);
    });
  });
}

/* ---------- Inicialização ---------- */

renderClients();
renderDashboard();
```
