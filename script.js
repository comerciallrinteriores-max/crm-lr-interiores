/* ========================================
   CRM LR INTERIORES
   Clientes, orçamentos e armazenamento local
======================================== */

"use strict";

const STORAGE_KEY = "lr-interiores-crm-v1";
const QUOTES_STORAGE_KEY = "lr-interiores-orcamentos-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let clients = loadClients();
let quotes = loadQuotes();

/* ---------- Armazenamento de clientes ---------- */
function loadClients() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((client) =>
      client && typeof client.id === "string" && typeof client.name === "string"
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
    alert("Não foi possível salvar os dados neste navegador. Verifique o espaço disponível ou as configurações de privacidade.");
    return false;
  }
}

/* ---------- Armazenamento de orçamentos ---------- */
function loadQuotes() {
  try {
    const saved = localStorage.getItem(QUOTES_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((quote) =>
      quote && typeof quote.id === "string" && typeof quote.name === "string"
    ).map((quote) => {
      // A mão de obra é sempre 30% do preço de venda.
      const price = Math.max(0, Number(quote.price) || 0);
      const materials = Math.max(0, Number(quote.materials) || 0);
      const labor = Math.round(price * 0.30 * 100) / 100;
      const extra = Math.max(0, Number(quote.extra) || 0);
      const totalCost = materials + labor + extra;
      const profit = price - totalCost;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      return { ...quote, labor, totalCost, profit, margin };
    });
  } catch (error) {
    console.error("Não foi possível carregar os orçamentos:", error);
    return [];
  }
}

function saveQuotes() {
  try {
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os orçamentos:", error);
    alert("Não foi possível salvar os orçamentos neste navegador. Verifique o espaço disponível ou as configurações de privacidade.");
    return false;
  }
}

/* ---------- Navegação ---------- */
const pageNames = {
  dashboard: "Painel inicial",
  clientes: "Clientes",
  orcamentos: "Orçamentos e custos",
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

  if (pageName === "clientes") renderClients($("#clientSearch").value);
  if (pageName === "dashboard") renderDashboard();
  if (pageName === "orcamentos") renderQuotes();
}

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => navigateTo(button.dataset.page));
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => navigateTo(button.dataset.go));
});

$("#quickNewClientBtn").addEventListener("click", () => {
  navigateTo("clientes");
  openClientForm();
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

$("#newClientBtn").addEventListener("click", () => openClientForm());
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
    clients = clients.map((client) => client.id === id ? clientData : client);
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
    const searchableText = [client.name, client.phone, client.email, client.source]
      .join(" ").toLocaleLowerCase("pt-BR");
    return searchableText.includes(normalizedSearch);
  });

  $("#clientCount").textContent =
    `${filteredClients.length} ${filteredClients.length === 1 ? "cliente" : "clientes"} encontrados`;

  if (filteredClients.length === 0) {
    list.innerHTML = `<div class="list-empty">${clients.length === 0
      ? "Você ainda não cadastrou clientes."
      : "Nenhum cliente encontrado para essa busca."}</div>`;
    return;
  }

  list.innerHTML = filteredClients.map((client) => `
    <article class="client-row">
      <div class="client-avatar">${escapeHTML(getInitials(client.name))}</div>
      <div class="client-info">
        <strong>${escapeHTML(client.name)}</strong>
        <span>${escapeHTML(client.phone)}</span>
        ${client.email ? `<span>${escapeHTML(client.email)}</span>` : ""}
        ${client.source ? `<span class="client-source">${escapeHTML(client.source)}</span>` : ""}
      </div>
      <div class="client-actions">
        <button type="button" class="icon-button" data-action="edit" data-id="${escapeHTML(client.id)}" aria-label="Editar ${escapeHTML(client.name)}">Editar</button>
        <button type="button" class="icon-button delete" data-action="delete" data-id="${escapeHTML(client.id)}" aria-label="Excluir ${escapeHTML(client.name)}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("");
}

function escapeHTML(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character]);
}

$("#clientSearch").addEventListener("input", (event) => renderClients(event.target.value));

$("#clientList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const client = clients.find((item) => item.id === button.dataset.id);
  if (!client) return;

  if (button.dataset.action === "edit") {
    openClientForm(client);
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(`Deseja realmente excluir o cadastro de "${client.name}"?`);
    if (!confirmed) return;

    const previousClients = [...clients];
    clients = clients.filter((item) => item.id !== client.id);
    if (!saveClients()) {
      clients = previousClients;
      return;
    }
    renderClients($("#clientSearch").value);
    renderDashboard();
    renderClientOptions();
  }
});

/* ---------- Painel inicial ---------- */
function renderDashboard() {
  $("#totalClientes").textContent = clients.length;
  $("#totalOrcamentos").textContent = quotes.length;

  const recentClients = $("#recentClients");
  if (clients.length === 0) {
    recentClients.innerHTML = `
      <div class="empty-icon">♙</div>
      <strong>Nenhum cliente cadastrado ainda</strong>
      <p>Comece adicionando seu primeiro cliente.</p>
      <button class="button button-primary" data-go="clientes">Cadastrar cliente</button>
    `;
    recentClients.querySelector("[data-go]").addEventListener("click", () => navigateTo("clientes"));
    return;
  }

  const recent = [...clients]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  recentClients.innerHTML = recent.map((client) => `
    <article class="client-row">
      <div class="client-avatar">${escapeHTML(getInitials(client.name))}</div>
      <div class="client-info">
        <strong>${escapeHTML(client.name)}</strong>
        <span>${escapeHTML(client.phone)}</span>
        ${client.source ? `<span class="client-source">${escapeHTML(client.source)}</span>` : ""}
      </div>
      <button type="button" class="button button-outline" data-edit-recent="${escapeHTML(client.id)}">Editar</button>
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

/* ---------- Orçamentos e custos ---------- */
const quoteMoneyFields = ["#quoteMaterials", "#quoteLabor", "#quoteExtra", "#quotePrice"];

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function getQuoteValues() {
  const materials = Math.max(0, Number($("#quoteMaterials").value) || 0);
  const extra = Math.max(0, Number($("#quoteExtra").value) || 0);
  const price = Math.max(0, Number($("#quotePrice").value) || 0);
  // Calcula automaticamente 30% do preço de venda, arredondado em centavos.
  const labor = Math.round(price * 0.30 * 100) / 100;
  $("#quoteLabor").value = labor.toFixed(2);
  const totalCost = materials + labor + extra;
  const profit = price - totalCost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  return { materials, labor, extra, price, totalCost, profit, margin };
}

function updateQuoteCalculations() {
  const values = getQuoteValues();
  $("#quoteTotalCost").textContent = formatBRL(values.totalCost);
  $("#quoteProfit").textContent = formatBRL(values.profit);
  $("#quoteMargin").textContent = `${values.margin.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;

  $("#quoteProfit").classList.toggle("negative-value", values.profit < 0);
  $("#quoteMargin").classList.toggle("negative-value", values.profit < 0);
}

function renderClientOptions(selectedId = $("#quoteClient").value) {
  const select = $("#quoteClient");
  select.innerHTML = `<option value="">Sem cliente vinculado</option>` +
    clients.map((client) =>
      `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name)}</option>`
    ).join("");
  select.value = clients.some((client) => client.id === selectedId) ? selectedId : "";
}

function openQuoteForm(quote = null) {
  const form = $("#quoteForm");
  form.reset();
  $("#quoteId").value = "";
  $("#quoteMaterials").value = "0";
  $("#quoteLabor").value = "0";
  $("#quoteExtra").value = "0";
  $("#quoteStatus").value = "Rascunho";
  renderClientOptions("");

  if (quote) {
    $("#quoteFormTitle").textContent = "Editar orçamento";
    $("#quoteId").value = quote.id;
    $("#quoteName").value = quote.name || "";
    $("#quoteClient").value = quote.clientId || "";
    $("#quoteStatus").value = quote.status || "Rascunho";
    $("#quoteDeadline").value = quote.deadline || "";
    $("#quoteDescription").value = quote.description || "";
    $("#quoteMaterials").value = String(quote.materials ?? 0);
    $("#quoteLabor").value = String(quote.labor ?? 0);
    $("#quoteExtra").value = String(quote.extra ?? 0);
    $("#quotePrice").value = String(quote.price ?? "");
  } else {
    $("#quoteFormTitle").textContent = "Novo orçamento";
    $("#quotePrice").value = "";
  }

  form.hidden = false;
  updateQuoteCalculations();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#quoteName").focus({ preventScroll: true });
}

function closeQuoteForm() {
  $("#quoteForm").hidden = true;
  $("#quoteForm").reset();
  $("#quoteId").value = "";
  updateQuoteCalculations();
}

$("#newQuoteBtn").addEventListener("click", () => openQuoteForm());
$("#cancelQuoteBtn").addEventListener("click", closeQuoteForm);
$("#cancelQuoteBtnBottom").addEventListener("click", closeQuoteForm);
quoteMoneyFields.forEach((selector) => {
  $(selector).addEventListener("input", updateQuoteCalculations);
});

$("#quoteForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("#quoteId").value;
  const name = $("#quoteName").value.trim();
  const priceValue = $("#quotePrice").value;

  if (!name) {
    alert("Informe o nome do projeto ou produto.");
    return;
  }
  if (priceValue === "" || Number(priceValue) <= 0) {
    alert("Informe um preço de venda maior que zero.");
    $("#quotePrice").focus();
    return;
  }

  const values = getQuoteValues();
  const existing = quotes.find((quote) => quote.id === id);
  const clientId = $("#quoteClient").value;
  const client = clients.find((item) => item.id === clientId);

  const quoteData = {
    id: id || createId(),
    name,
    clientId,
    clientName: client ? client.name : "",
    status: $("#quoteStatus").value,
    deadline: $("#quoteDeadline").value.trim(),
    description: $("#quoteDescription").value.trim(),
    materials: values.materials,
    labor: values.labor,
    extra: values.extra,
    totalCost: values.totalCost,
    price: values.price,
    profit: values.profit,
    margin: values.margin,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const previousQuotes = [...quotes];
  if (id) {
    quotes = quotes.map((quote) => quote.id === id ? quoteData : quote);
  } else {
    quotes.unshift(quoteData);
  }

  if (!saveQuotes()) {
    quotes = previousQuotes;
    return;
  }

  closeQuoteForm();
  renderQuotes();
  renderDashboard();
  alert(id ? "Orçamento atualizado com sucesso!" : "Orçamento salvo com sucesso!");
});

function renderQuotes(searchTerm = $("#quoteSearch").value) {
  renderClientOptions();
  const normalizedSearch = (searchTerm || "").trim().toLocaleLowerCase("pt-BR");
  const filtered = quotes.filter((quote) =>
    `${quote.name} ${quote.clientName || ""} ${quote.status || ""}`
      .toLocaleLowerCase("pt-BR").includes(normalizedSearch)
  );

  $("#quoteCount").textContent = `${filtered.length} ${filtered.length === 1 ? "orçamento encontrado" : "orçamentos encontrados"}`;
  $("#quoteSummaryCount").textContent = quotes.length;
  $("#quoteSummaryOpen").textContent = quotes.filter((quote) =>
    quote.status === "Rascunho" || quote.status === "Enviado"
  ).length;
  $("#quoteSummaryApproved").textContent = quotes.filter((quote) => quote.status === "Aprovado").length;

  const list = $("#quoteList");
  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-empty">${quotes.length === 0
      ? "Você ainda não cadastrou orçamentos. Clique em “+ Novo orçamento” para começar."
      : "Nenhum orçamento encontrado para essa busca."}</div>`;
    return;
  }

  list.innerHTML = filtered.map((quote) => {
    const statusClass = {
      "Rascunho": "status-draft",
      "Enviado": "status-sent",
      "Aprovado": "status-approved",
      "Recusado": "status-rejected"
    }[quote.status] || "status-draft";
    return `
      <article class="quote-row">
        <div class="quote-row-main">
          <div class="quote-row-top">
            <h3>${escapeHTML(quote.name)}</h3>
            <span class="quote-status ${statusClass}">${escapeHTML(quote.status || "Rascunho")}</span>
          </div>
          <p class="quote-client-name">${escapeHTML(quote.clientName || "Sem cliente vinculado")}</p>
          ${quote.deadline ? `<p class="quote-deadline">Prazo: ${escapeHTML(quote.deadline)}</p>` : ""}
          <div class="quote-row-values">
            <span><small>Custo total</small><strong>${formatBRL(quote.totalCost)}</strong></span>
            <span><small>Preço de venda</small><strong>${formatBRL(quote.price)}</strong></span>
            <span><small>Lucro estimado</small><strong class="${quote.profit < 0 ? "negative-value" : ""}">${formatBRL(quote.profit)}</strong></span>
            <span><small>Margem</small><strong class="${quote.profit < 0 ? "negative-value" : ""}">${Number(quote.margin || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></span>
          </div>
          ${quote.description ? `<p class="quote-description">${escapeHTML(quote.description)}</p>` : ""}
        </div>
        <div class="quote-row-actions">
          <button type="button" class="button button-outline" data-quote-edit="${escapeHTML(quote.id)}">Editar</button>
          <button type="button" class="button button-outline quote-delete" data-quote-delete="${escapeHTML(quote.id)}">Excluir</button>
        </div>
      </article>
    `;
  }).join("");
}

$("#quoteSearch").addEventListener("input", (event) => renderQuotes(event.target.value));

$("#quoteList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-quote-edit]");
  const deleteButton = event.target.closest("[data-quote-delete]");

  if (editButton) {
    const quote = quotes.find((item) => item.id === editButton.dataset.quoteEdit);
    if (quote) openQuoteForm(quote);
    return;
  }

  if (deleteButton) {
    const quote = quotes.find((item) => item.id === deleteButton.dataset.quoteDelete);
    if (!quote) return;
    if (!confirm(`Deseja realmente excluir o orçamento "${quote.name}"?`)) return;

    const previousQuotes = [...quotes];
    quotes = quotes.filter((item) => item.id !== quote.id);
    if (!saveQuotes()) {
      quotes = previousQuotes;
      return;
    }
    renderQuotes();
    renderDashboard();
  }
});

/* ---------- Inicialização ---------- */
renderClients();
renderDashboard();
renderQuotes();
updateQuoteCalculations();
