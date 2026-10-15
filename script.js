
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

    return parsed
      .filter((quote) =>
        quote &&
        typeof quote.id === "string" &&
        typeof quote.name === "string"
      )
      .map((quote) => {
        const price = Math.max(0, Number(quote.price) || 0);

        // Materiais: 50% do preço de venda.
        const materials = Math.round(price * 0.50 * 100) / 100;

        // Mão de obra: 30% do preço de venda.
        const labor = Math.round(price * 0.30 * 100) / 100;

        const extra = Math.max(0, Number(quote.extra) || 0);
        const totalCost = materials + labor + extra;
        const profit = price - totalCost;
        const margin = price > 0 ? (profit / price) * 100 : 0;

        return {
          ...quote,
          materials,
          labor,
          totalCost,
          profit,
          margin
        };
      });
  } catch (error) {
    console.error("Não foi possível carregar os orçamentos:", error);
    return [];
  }
}

function saveQuotes() {
  try {
    localStorage.setItem(
      QUOTES_STORAGE_KEY,
      JSON.stringify(quotes)
    );
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

  $$(".page").forEach((page) =>
    page.classList.remove("active")
  );

  $$(".nav-item").forEach((button) =>
    button.classList.remove("active")
  );

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

  if (pageName === "dashboard") renderDashboard();
  if (pageName === "orcamentos") renderQuotes();
  if (pageName === "vendas") renderSales();
  if (pageName === "producao") renderProduction();
}

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () =>
    navigateTo(button.dataset.page)
  );
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () =>
    navigateTo(button.dataset.go)
  );
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
  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("#clientName").focus({ preventScroll: true });
}

function closeClientForm() {
  $("#clientForm").hidden = true;
  $("#clientForm").reset();
  $("#clientId").value = "";
}

$("#newClientBtn").addEventListener("click", () =>
  openClientForm()
);

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

  const existingClient = clients.find(
    (client) => client.id === id
  );

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

  alert(
    id
      ? "Cliente atualizado com sucesso!"
      : "Cliente cadastrado com sucesso!"
  );
});

function createId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ---------- Lista de clientes ---------- */
function renderClients(searchTerm = "") {
  const list = $("#clientList");

  const normalizedSearch = searchTerm
    .trim()
    .toLocaleLowerCase("pt-BR");

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
    `${filteredClients.length} ${
      filteredClients.length === 1
        ? "cliente"
        : "clientes"
    } encontrados`;

  if (filteredClients.length === 0) {
    list.innerHTML = `<div class="list-empty">${
      clients.length === 0
        ? "Você ainda não cadastrou clientes."
        : "Nenhum cliente encontrado para essa busca."
    }</div>`;

    return;
  }

  list.innerHTML = filteredClients.map((client) => `
    <article class="client-row">
      <div class="client-avatar">
        ${escapeHTML(getInitials(client.name))}
      </div>

      <div class="client-info">
        <strong>${escapeHTML(client.name)}</strong>
        <span>${escapeHTML(client.phone)}</span>
        ${
          client.email
            ? `<span>${escapeHTML(client.email)}</span>`
            : ""
        }
        ${
          client.source
            ? `<span class="client-source">${escapeHTML(client.source)}</span>`
            : ""
        }
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

function escapeHTML(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => replacements[character]
  );
}

$("#clientSearch").addEventListener("input", (event) =>
  renderClients(event.target.value)
);

$("#clientList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const client = clients.find(
    (item) => item.id === button.dataset.id
  );

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

    clients = clients.filter(
      (item) => item.id !== client.id
    );

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
      <button class="button button-primary" data-go="clientes">
        Cadastrar cliente
      </button>
    `;

    recentClients.querySelector("[data-go]")
      .addEventListener("click", () => navigateTo("clientes"));

    return;
  }

  const recent = [...clients]
    .sort((a, b) =>
      new Date(b.updatedAt || b.createdAt) -
      new Date(a.updatedAt || a.createdAt)
    )
    .slice(0, 5);

  recentClients.innerHTML = recent.map((client) => `
    <article class="client-row">
      <div class="client-avatar">
        ${escapeHTML(getInitials(client.name))}
      </div>

      <div class="client-info">
        <strong>${escapeHTML(client.name)}</strong>
        <span>${escapeHTML(client.phone)}</span>
        ${
          client.source
            ? `<span class="client-source">${escapeHTML(client.source)}</span>`
            : ""
        }
      </div>

      <button
        type="button"
        class="button button-outline"
        data-edit-recent="${escapeHTML(client.id)}"
      >Editar</button>
    </article>
  `).join("");

  recentClients.querySelectorAll("[data-edit-recent]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const client = clients.find(
          (item) => item.id === button.dataset.editRecent
        );

        if (!client) return;

        navigateTo("clientes");
        openClientForm(client);
      });
    });
}

/* ---------- Orçamentos e custos ---------- */
const quoteMoneyFields = [
  "#quoteMaterials",
  "#quoteLabor",
  "#quoteExtra",
  "#quotePrice"
];

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/* Calcula materiais e mão de obra a partir do preço de venda. */
function getQuoteValues() {
  const price = Math.max(
    0,
    Number($("#quotePrice").value) || 0
  );

  // MATERIAIS: 50% do preço de venda.
  const materials = Math.round(price * 0.50 * 100) / 100;

  // MÃO DE OBRA: 30% do preço de venda.
  const labor = Math.round(price * 0.30 * 100) / 100;

  // Extras continuam sendo informados manualmente.
  const extra = Math.max(
    0,
    Number($("#quoteExtra").value) || 0
  );

  // Atualiza os campos automaticamente na tela.
  $("#quoteMaterials").value = materials.toFixed(2);
  $("#quoteLabor").value = labor.toFixed(2);

  const totalCost = materials + labor + extra;
  const profit = price - totalCost;
  const margin = price > 0
    ? (profit / price) * 100
    : 0;

  return {
    materials,
    labor,
    extra,
    price,
    totalCost,
    profit,
    margin
  };
}

function updateQuoteCalculations() {
  const values = getQuoteValues();

  $("#quoteTotalCost").textContent =
    formatBRL(values.totalCost);

  $("#quoteProfit").textContent =
    formatBRL(values.profit);

  $("#quoteMargin").textContent =
    `${values.margin.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;

  $("#quoteProfit").classList.toggle(
    "negative-value",
    values.profit < 0
  );

  $("#quoteMargin").classList.toggle(
    "negative-value",
    values.profit < 0
  );
}

function renderClientOptions(
  selectedId = $("#quoteClient").value
) {
  const select = $("#quoteClient");

  select.innerHTML =
    `<option value="">Sem cliente vinculado</option>` +
    clients.map((client) => `
      <option value="${escapeHTML(client.id)}">
        ${escapeHTML(client.name)}
      </option>
    `).join("");

  select.value = clients.some(
    (client) => client.id === selectedId
  ) ? selectedId : "";
}

function openQuoteForm(quote = null) {
  const form = $("#quoteForm");

  form.reset();

  $("#quoteId").value = "";
  $("#quoteMaterials").value = "0.00";
  $("#quoteLabor").value = "0.00";
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

    // Os valores serão recalculados a partir do preço de venda.
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

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("#quoteName").focus({ preventScroll: true });
}

function closeQuoteForm() {
  $("#quoteForm").hidden = true;
  $("#quoteForm").reset();
  $("#quoteId").value = "";
  updateQuoteCalculations();
}

$("#newQuoteBtn").addEventListener("click", () =>
  openQuoteForm()
);

$("#cancelQuoteBtn").addEventListener("click", closeQuoteForm);
$("#cancelQuoteBtnBottom").addEventListener("click", closeQuoteForm);

quoteMoneyFields.forEach((selector) => {
  $(selector).addEventListener(
    "input",
    updateQuoteCalculations
  );
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

  // Recalcula antes de salvar para garantir os percentuais corretos.
  const values = getQuoteValues();

  const existing = quotes.find(
    (quote) => quote.id === id
  );

  const clientId = $("#quoteClient").value;
  const client = clients.find(
    (item) => item.id === clientId
  );

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
    quotes = quotes.map((quote) =>
      quote.id === id ? quoteData : quote
    );
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

  alert(
    id
      ? "Orçamento atualizado com sucesso!"
      : "Orçamento salvo com sucesso!"
  );
});

function renderQuotes(
  searchTerm = $("#quoteSearch").value
) {
  renderClientOptions();

  const normalizedSearch = (searchTerm || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const filtered = quotes.filter((quote) =>
    `${quote.name} ${quote.clientName || ""} ${quote.status || ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch)
  );

  $("#quoteCount").textContent =
    `${filtered.length} ${
      filtered.length === 1
        ? "orçamento encontrado"
        : "orçamentos encontrados"
    }`;

  $("#quoteSummaryCount").textContent = quotes.length;

  $("#quoteSummaryOpen").textContent = quotes.filter(
    (quote) =>
      quote.status === "Rascunho" ||
      quote.status === "Enviado"
  ).length;

  $("#quoteSummaryApproved").textContent = quotes.filter(
    (quote) => quote.status === "Aprovado"
  ).length;

  const list = $("#quoteList");

  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-empty">${
      quotes.length === 0
        ? "Você ainda não cadastrou orçamentos. Clique em “+ Novo orçamento” para começar."
        : "Nenhum orçamento encontrado para essa busca."
    }</div>`;

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
            <span class="quote-status ${statusClass}">
              ${escapeHTML(quote.status || "Rascunho")}
            </span>
          </div>

          <p class="quote-client-name">
            ${escapeHTML(quote.clientName || "Sem cliente vinculado")}
          </p>

          ${
            quote.deadline
              ? `<p class="quote-deadline">Prazo: ${escapeHTML(quote.deadline)}</p>`
              : ""
          }

          <div class="quote-row-values">
            <span>
              <small>Custo total</small>
              <strong>${formatBRL(quote.totalCost)}</strong>
            </span>

            <span>
              <small>Preço de venda</small>
              <strong>${formatBRL(quote.price)}</strong>
            </span>

            <span>
              <small>Lucro estimado</small>
              <strong class="${quote.profit < 0 ? "negative-value" : ""}">
                ${formatBRL(quote.profit)}
              </strong>
            </span>

            <span>
              <small>Margem</small>
              <strong class="${quote.profit < 0 ? "negative-value" : ""}">
                ${Number(quote.margin || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1
                })}%
              </strong>
            </span>
          </div>

          ${
            quote.description
              ? `<p class="quote-description">${escapeHTML(quote.description)}</p>`
              : ""
          }
        </div>

        <div class="quote-row-actions">
          <button
            type="button"
            class="button button-outline"
            data-quote-edit="${escapeHTML(quote.id)}"
          >Editar</button>

          <button
            type="button"
            class="button button-outline quote-delete"
            data-quote-delete="${escapeHTML(quote.id)}"
          >Excluir</button>
        </div>
      </article>
    `;
  }).join("");
}

$("#quoteSearch").addEventListener("input", (event) =>
  renderQuotes(event.target.value)
);

$("#quoteList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-quote-edit]");
  const deleteButton = event.target.closest("[data-quote-delete]");

  if (editButton) {
    const quote = quotes.find(
      (item) => item.id === editButton.dataset.quoteEdit
    );

    if (quote) openQuoteForm(quote);
    return;
  }

  if (deleteButton) {
    const quote = quotes.find(
      (item) => item.id === deleteButton.dataset.quoteDelete
    );

    if (!quote) return;

    if (!confirm(
      `Deseja realmente excluir o orçamento "${quote.name}"?`
    )) {
      return;
    }

    const previousQuotes = [...quotes];

    quotes = quotes.filter(
      (item) => item.id !== quote.id
    );

    if (!saveQuotes()) {
      quotes = previousQuotes;
      return;
    }

    renderQuotes();
    renderDashboard();
  }
});

/* ---------- Funil de vendas / Kanban ---------- */
const SALES_STORAGE_KEY = "lr-interiores-funil-v1";

const salesStages = [
  { id: "lead", title: "Novo contato", description: "Oportunidades recém-chegadas" },
  { id: "contact", title: "Contato realizado", description: "Entendimento da necessidade" },
  { id: "proposal", title: "Proposta enviada", description: "Orçamento em avaliação" },
  { id: "negotiation", title: "Em negociação", description: "Ajustes e fechamento" },
  { id: "won", title: "Venda concluída", description: "Oportunidades ganhas" },
  { id: "lost", title: "Perdida / cancelada", description: "Oportunidades encerradas" }
];

let sales = loadSales();

function loadSales() {
  try {
    const saved = localStorage.getItem(SALES_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];

    const validStages = salesStages.map((stage) => stage.id);
    return parsed.filter((sale) =>
      sale &&
      typeof sale.id === "string" &&
      typeof sale.title === "string"
    ).map((sale) => ({
      ...sale,
      stage: validStages.includes(sale.stage) ? sale.stage : "lead",
      clientId: typeof sale.clientId === "string" ? sale.clientId : "",
      quoteId: typeof sale.quoteId === "string" ? sale.quoteId : "",
      nextAction: typeof sale.nextAction === "string" ? sale.nextAction : "",
      followupDate: typeof sale.followupDate === "string" ? sale.followupDate : "",
      expectedValue: Math.max(0, Number(sale.expectedValue) || 0),
      notes: typeof sale.notes === "string" ? sale.notes : ""
    }));
  } catch (error) {
    console.error("Não foi possível carregar o funil de vendas:", error);
    return [];
  }
}

function saveSales() {
  try {
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(sales));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar o funil de vendas:", error);
    alert("Não foi possível salvar as oportunidades neste navegador. Verifique o espaço disponível ou as configurações de privacidade.");
    return false;
  }
}

function renderSalesOptions(selectedClientId = $("#saleClient").value, selectedQuoteId = $("#saleQuote").value) {
  const clientSelect = $("#saleClient");
  const quoteSelect = $("#saleQuote");

  clientSelect.innerHTML = '<option value="">Sem cliente vinculado</option>' +
    clients.map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name)}</option>`).join("");
  clientSelect.value = clients.some((client) => client.id === selectedClientId) ? selectedClientId : "";

  const availableQuotes = quotes.filter((quote) =>
    !clientSelect.value || !quote.clientId || quote.clientId === clientSelect.value
  );
  quoteSelect.innerHTML = '<option value="">Sem orçamento vinculado</option>' +
    availableQuotes.map((quote) => {
      const clientLabel = quote.clientName ? ` — ${quote.clientName}` : "";
      return `<option value="${escapeHTML(quote.id)}">${escapeHTML(quote.name)}${escapeHTML(clientLabel)} · ${formatBRL(quote.price)}</option>`;
    }).join("");
  quoteSelect.value = availableQuotes.some((quote) => quote.id === selectedQuoteId) ? selectedQuoteId : "";
}

function openSaleForm(sale = null) {
  const form = $("#saleForm");
  form.reset();
  $("#saleId").value = "";
  $("#saleStage").value = "lead";
  $("#saleFormTitle").textContent = sale ? "Editar oportunidade" : "Nova oportunidade";
  renderSalesOptions("", "");

  if (sale) {
    $("#saleId").value = sale.id;
    $("#saleTitle").value = sale.title || "";
    $("#saleStage").value = sale.stage || "lead";
    $("#saleClient").value = sale.clientId || "";
    renderSalesOptions(sale.clientId || "", sale.quoteId || "");
    $("#saleNextAction").value = sale.nextAction || "";
    $("#saleFollowupDate").value = sale.followupDate || "";
    $("#saleExpectedValue").value = String(sale.expectedValue ?? "");
    $("#saleNotes").value = sale.notes || "";
  }

  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#saleTitle").focus({ preventScroll: true });
}

function closeSaleForm() {
  $("#saleForm").hidden = true;
  $("#saleForm").reset();
  $("#saleId").value = "";
}

$("#newSaleBtn").addEventListener("click", () => openSaleForm());
$("#cancelSaleBtn").addEventListener("click", closeSaleForm);
$("#cancelSaleBtnBottom").addEventListener("click", closeSaleForm);

$("#saleClient").addEventListener("change", () => {
  renderSalesOptions($("#saleClient").value, $("#saleQuote").value);
});

$("#saleQuote").addEventListener("change", () => {
  const quote = quotes.find((item) => item.id === $("#saleQuote").value);
  if (!quote) return;
  if (quote.clientId) {
    $("#saleClient").value = quote.clientId;
    renderSalesOptions(quote.clientId, quote.id);
  }
  $("#saleExpectedValue").value = Number(quote.price || 0).toFixed(2);
  if (!$("#saleTitle").value.trim()) $("#saleTitle").value = quote.name || "";
});

$("#saleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("#saleId").value;
  const title = $("#saleTitle").value.trim();
  if (!title) {
    alert("Informe o nome da oportunidade.");
    return;
  }

  const existing = sales.find((sale) => sale.id === id);
  const clientId = $("#saleClient").value;
  const quoteId = $("#saleQuote").value;
  const client = clients.find((item) => item.id === clientId);
  const quote = quotes.find((item) => item.id === quoteId);
  const opportunity = {
    id: id || createId(),
    title,
    stage: $("#saleStage").value,
    clientId,
    clientName: client ? client.name : "",
    quoteId,
    quoteName: quote ? quote.name : "",
    nextAction: $("#saleNextAction").value.trim(),
    followupDate: $("#saleFollowupDate").value,
    expectedValue: Math.max(0, Number($("#saleExpectedValue").value) || 0),
    notes: $("#saleNotes").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const previousSales = [...sales];
  if (id) {
    sales = sales.map((sale) => sale.id === id ? opportunity : sale);
  } else {
    sales.unshift(opportunity);
  }

  if (!saveSales()) {
    sales = previousSales;
    return;
  }

  closeSaleForm();
  renderSales();
});

function formatSalesDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function moveSaleToStage(saleId, stageId) {
  if (!salesStages.some((stage) => stage.id === stageId)) return;
  const previousSales = [...sales];
  sales = sales.map((sale) => sale.id === saleId
    ? { ...sale, stage: stageId, updatedAt: new Date().toISOString() }
    : sale
  );
  if (!saveSales()) {
    sales = previousSales;
    return;
  }
  renderSales();
}

function renderSales(searchTerm = $("#salesSearch").value) {
  renderSalesOptions();
  const normalizedSearch = (searchTerm || "").trim().toLocaleLowerCase("pt-BR");
  const filteredSales = sales.filter((sale) => {
    const client = clients.find((item) => item.id === sale.clientId);
    const clientName = client?.name || sale.clientName || "";
    return `${sale.title} ${clientName} ${sale.nextAction} ${sale.notes}`
      .toLocaleLowerCase("pt-BR").includes(normalizedSearch);
  });

  const openSales = sales.filter((sale) => !["won", "lost"].includes(sale.stage));
  $("#salesOpenCount").textContent = openSales.length;
  $("#salesOpenValue").textContent = formatBRL(openSales.reduce((sum, sale) => sum + sale.expectedValue, 0));
  $("#salesWonCount").textContent = sales.filter((sale) => sale.stage === "won").length;
  $("#salesBoardCount").textContent = `${filteredSales.length} ${filteredSales.length === 1 ? "oportunidade" : "oportunidades"}`;

  const board = $("#salesBoard");
  board.innerHTML = salesStages.map((stage) => {
    const stageSales = filteredSales.filter((sale) => sale.stage === stage.id);
    const stageValue = stageSales.reduce((sum, sale) => sum + sale.expectedValue, 0);
    return `
      <section class="sales-column" data-stage="${stage.id}">
        <header class="sales-column-header">
          <div>
            <h3>${escapeHTML(stage.title)}</h3>
            <p>${escapeHTML(stage.description)}</p>
          </div>
          <span class="sales-column-count">${stageSales.length}</span>
        </header>
        <div class="sales-column-total">${formatBRL(stageValue)} <span>previstos</span></div>
        <div class="sales-column-cards">
          ${stageSales.length ? stageSales.map((sale) => {
            const client = clients.find((item) => item.id === sale.clientId);
            const clientName = client?.name || sale.clientName || "Sem cliente vinculado";
            const stageOptions = salesStages.map((option) =>
              `<option value="${option.id}" ${option.id === sale.stage ? "selected" : ""}>${escapeHTML(option.title)}</option>`
            ).join("");
            return `
              <article class="sales-opportunity">
                <div class="sales-card-top">
                  <span class="sales-card-label">OPORTUNIDADE</span>
                  <button type="button" class="icon-button" data-sale-edit="${escapeHTML(sale.id)}" aria-label="Editar ${escapeHTML(sale.title)}">Editar</button>
                </div>
                <h4>${escapeHTML(sale.title)}</h4>
                <p class="sales-client-name">${escapeHTML(clientName)}</p>
                ${sale.quoteName ? `<p class="sales-quote-name">Orçamento: ${escapeHTML(sale.quoteName)}</p>` : ""}
                <div class="sales-expected-value">
                  <small>Valor previsto</small>
                  <strong>${formatBRL(sale.expectedValue)}</strong>
                </div>
                ${sale.nextAction ? `<div class="sales-card-detail"><small>Próxima ação</small><span>${escapeHTML(sale.nextAction)}</span></div>` : ""}
                ${sale.followupDate ? `<div class="sales-card-detail"><small>Próximo contato</small><span>${escapeHTML(formatSalesDate(sale.followupDate))}</span></div>` : ""}
                <label class="sales-move-label">Mover para
                  <select data-sale-stage="${escapeHTML(sale.id)}" aria-label="Mover ${escapeHTML(sale.title)} para outra etapa">${stageOptions}</select>
                </label>
                <button type="button" class="button button-outline sales-delete" data-sale-delete="${escapeHTML(sale.id)}">Excluir</button>
              </article>
            `;
          }).join("") : '<div class="sales-column-empty">Nenhuma oportunidade nesta etapa.</div>'}
        </div>
      </section>
    `;
  }).join("");
}

$("#salesSearch").addEventListener("input", (event) => renderSales(event.target.value));

$("#salesBoard").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-sale-edit]");
  const deleteButton = event.target.closest("[data-sale-delete]");

  if (editButton) {
    const sale = sales.find((item) => item.id === editButton.dataset.saleEdit);
    if (sale) openSaleForm(sale);
    return;
  }

  if (deleteButton) {
    const sale = sales.find((item) => item.id === deleteButton.dataset.saleDelete);
    if (!sale) return;
    if (!confirm(`Deseja realmente excluir a oportunidade "${sale.title}"?`)) return;

    const previousSales = [...sales];
    sales = sales.filter((item) => item.id !== sale.id);
    if (!saveSales()) {
      sales = previousSales;
      return;
    }
    renderSales();
  }
});

$("#salesBoard").addEventListener("change", (event) => {
  const select = event.target.closest("[data-sale-stage]");
  if (select) moveSaleToStage(select.dataset.saleStage, select.value);
});

/* ---------- Produção e entregas ---------- */
const PRODUCTION_STORAGE_KEY = "lr-interiores-producao-v1";

const productionStatuses = [
  { id: "pending", title: "Aguardando início" },
  { id: "production", title: "Em produção" },
  { id: "finishing", title: "Acabamento / revisão" },
  { id: "ready", title: "Pronto para entrega" },
  { id: "delivered", title: "Entregue ao cliente" },
  { id: "paused", title: "Pausado" }
];

let productionOrders = loadProductionOrders();

function loadProductionOrders() {
  try {
    const saved = localStorage.getItem(PRODUCTION_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];

    const validStatuses = productionStatuses.map((status) => status.id);
    return parsed.filter((order) =>
      order &&
      typeof order.id === "string" &&
      typeof order.title === "string"
    ).map((order) => ({
      ...order,
      status: validStatuses.includes(order.status) ? order.status : "pending",
      saleId: typeof order.saleId === "string" ? order.saleId : "",
      clientId: typeof order.clientId === "string" ? order.clientId : "",
      quoteId: typeof order.quoteId === "string" ? order.quoteId : "",
      startDate: typeof order.startDate === "string" ? order.startDate : "",
      deadline: typeof order.deadline === "string" ? order.deadline : "",
      deliveredDate: typeof order.deliveredDate === "string" ? order.deliveredDate : "",
      notes: typeof order.notes === "string" ? order.notes : ""
    }));
  } catch (error) {
    console.error("Não foi possível carregar a produção:", error);
    return [];
  }
}

function saveProductionOrders() {
  try {
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(productionOrders));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar a produção:", error);
    alert("Não foi possível salvar os projetos neste navegador. Verifique o espaço disponível ou as configurações de privacidade.");
    return false;
  }
}

function renderProductionOptions(selectedSaleId = $("#productionSale").value, selectedClientId = $("#productionClient").value, selectedQuoteId = $("#productionQuote").value) {
  const saleSelect = $("#productionSale");
  const clientSelect = $("#productionClient");
  const quoteSelect = $("#productionQuote");

  const wonSales = sales.filter((sale) => sale.stage === "won");
  saleSelect.innerHTML = '<option value="">Sem venda vinculada</option>' +
    wonSales.map((sale) => {
      const client = clients.find((item) => item.id === sale.clientId);
      const clientName = client?.name || sale.clientName || "Sem cliente";
      return `<option value="${escapeHTML(sale.id)}">${escapeHTML(sale.title)} — ${escapeHTML(clientName)}</option>`;
    }).join("");
  saleSelect.value = wonSales.some((sale) => sale.id === selectedSaleId) ? selectedSaleId : "";

  clientSelect.innerHTML = '<option value="">Sem cliente vinculado</option>' +
    clients.map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name)}</option>`).join("");
  clientSelect.value = clients.some((client) => client.id === selectedClientId) ? selectedClientId : "";

  const availableQuotes = quotes.filter((quote) =>
    !clientSelect.value || !quote.clientId || quote.clientId === clientSelect.value
  );
  quoteSelect.innerHTML = '<option value="">Sem orçamento vinculado</option>' +
    availableQuotes.map((quote) => {
      const clientLabel = quote.clientName ? ` — ${quote.clientName}` : "";
      return `<option value="${escapeHTML(quote.id)}">${escapeHTML(quote.name)}${escapeHTML(clientLabel)} · ${formatBRL(quote.price)}</option>`;
    }).join("");
  quoteSelect.value = availableQuotes.some((quote) => quote.id === selectedQuoteId) ? selectedQuoteId : "";
}

function openProductionForm(order = null) {
  const form = $("#productionForm");
  form.reset();
  $("#productionId").value = "";
  $("#productionStatus").value = "pending";
  $("#productionFormTitle").textContent = order ? "Editar ordem de produção" : "Nova ordem de produção";
  renderProductionOptions("", "", "");

  if (order) {
    $("#productionId").value = order.id;
    $("#productionTitle").value = order.title || "";
    $("#productionStatus").value = order.status || "pending";
    renderProductionOptions(order.saleId || "", order.clientId || "", order.quoteId || "");
    $("#productionStartDate").value = order.startDate || "";
    $("#productionDeadline").value = order.deadline || "";
    $("#productionDeliveredDate").value = order.deliveredDate || "";
    $("#productionNotes").value = order.notes || "";
  }

  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#productionTitle").focus({ preventScroll: true });
}

function closeProductionForm() {
  $("#productionForm").hidden = true;
  $("#productionForm").reset();
  $("#productionId").value = "";
}

$("#newProductionBtn").addEventListener("click", () => openProductionForm());
$("#cancelProductionBtn").addEventListener("click", closeProductionForm);
$("#cancelProductionBtnBottom").addEventListener("click", closeProductionForm);

$("#productionSale").addEventListener("change", () => {
  const sale = sales.find((item) => item.id === $("#productionSale").value);
  if (!sale) return;

  const linkedQuote = quotes.find((quote) => quote.id === sale.quoteId);
  const clientId = sale.clientId || "";
  const quoteId = linkedQuote ? linkedQuote.id : "";
  renderProductionOptions(sale.id, clientId, quoteId);
  if (!$("#productionTitle").value.trim()) {
    $("#productionTitle").value = sale.title || sale.quoteName || "";
  }
});

$("#productionClient").addEventListener("change", () => {
  renderProductionOptions($("#productionSale").value, $("#productionClient").value, $("#productionQuote").value);
});

$("#productionQuote").addEventListener("change", () => {
  const quote = quotes.find((item) => item.id === $("#productionQuote").value);
  if (!quote) return;
  if (quote.clientId) {
    $("#productionClient").value = quote.clientId;
    renderProductionOptions($("#productionSale").value, quote.clientId, quote.id);
  }
  if (!$("#productionTitle").value.trim()) $("#productionTitle").value = quote.name || "";
});

$("#productionForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("#productionId").value;
  const title = $("#productionTitle").value.trim();
  if (!title) {
    alert("Informe o nome do projeto.");
    return;
  }

  const existing = productionOrders.find((order) => order.id === id);
  const saleId = $("#productionSale").value;
  const clientId = $("#productionClient").value;
  const quoteId = $("#productionQuote").value;
  const sale = sales.find((item) => item.id === saleId);
  const client = clients.find((item) => item.id === clientId);
  const quote = quotes.find((item) => item.id === quoteId);
  const status = $("#productionStatus").value;
  const deliveredDate = $("#productionDeliveredDate").value ||
    (status === "delivered" ? new Date().toISOString().slice(0, 10) : "");

  const orderData = {
    id: id || createId(),
    title,
    status,
    saleId,
    saleTitle: sale ? sale.title : "",
    clientId,
    clientName: client ? client.name : "",
    quoteId,
    quoteName: quote ? quote.name : "",
    startDate: $("#productionStartDate").value,
    deadline: $("#productionDeadline").value,
    deliveredDate,
    notes: $("#productionNotes").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const previousOrders = [...productionOrders];
  if (id) {
    productionOrders = productionOrders.map((order) => order.id === id ? orderData : order);
  } else {
    productionOrders.unshift(orderData);
  }

  if (!saveProductionOrders()) {
    productionOrders = previousOrders;
    return;
  }

  closeProductionForm();
  renderProduction();
});

function formatProductionDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function renderProduction(searchTerm = $("#productionSearch").value) {
  renderProductionOptions();
  const normalizedSearch = (searchTerm || "").trim().toLocaleLowerCase("pt-BR");
  const filtered = productionOrders.filter((order) => {
    const client = clients.find((item) => item.id === order.clientId);
    const clientName = client?.name || order.clientName || "";
    return `${order.title} ${clientName} ${order.saleTitle} ${order.quoteName} ${order.notes}`
      .toLocaleLowerCase("pt-BR").includes(normalizedSearch);
  });

  const activeOrders = productionOrders.filter((order) => !["delivered"].includes(order.status));
  $("#productionActiveCount").textContent = activeOrders.length;
  $("#productionWorkingCount").textContent = productionOrders.filter((order) =>
    ["production", "finishing"].includes(order.status)
  ).length;
  $("#productionReadyCount").textContent = productionOrders.filter((order) => order.status === "ready").length;
  $("#productionListCount").textContent = `${filtered.length} ${filtered.length === 1 ? "projeto" : "projetos"}`;

  const list = $("#productionList");
  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">${productionOrders.length === 0
      ? "Você ainda não cadastrou projetos de produção. Clique em “+ Nova ordem” para começar."
      : "Nenhum projeto encontrado para essa busca."}</div>`;
    return;
  }

  const statusClasses = {
    pending: "production-status-pending",
    production: "production-status-working",
    finishing: "production-status-finishing",
    ready: "production-status-ready",
    delivered: "production-status-delivered",
    paused: "production-status-paused"
  };

  list.innerHTML = filtered.map((order) => {
    const statusInfo = productionStatuses.find((item) => item.id === order.status) || productionStatuses[0];
    const client = clients.find((item) => item.id === order.clientId);
    const clientName = client?.name || order.clientName || "Sem cliente vinculado";
    const isOverdue = order.deadline && order.deadline < new Date().toISOString().slice(0, 10) && order.status !== "delivered";
    const statusOptions = productionStatuses.map((status) =>
      `<option value="${status.id}" ${status.id === order.status ? "selected" : ""}>${escapeHTML(status.title)}</option>`
    ).join("");

    return `
      <article class="production-order">
        <div class="production-order-main">
          <div class="production-order-top">
            <div>
              <span class="production-order-kicker">PROJETO</span>
              <h3>${escapeHTML(order.title)}</h3>
            </div>
            <span class="production-status ${statusClasses[order.status] || ""}">${escapeHTML(statusInfo.title)}</span>
          </div>
          <p class="production-client-name">${escapeHTML(clientName)}</p>
          ${order.saleTitle ? `<p class="production-linked-record">Venda: ${escapeHTML(order.saleTitle)}</p>` : ""}
          ${order.quoteName ? `<p class="production-linked-record">Orçamento: ${escapeHTML(order.quoteName)}</p>` : ""}
          <div class="production-dates">
            ${order.startDate ? `<span><small>Início</small><strong>${escapeHTML(formatProductionDate(order.startDate))}</strong></span>` : ""}
            ${order.deadline ? `<span class="${isOverdue ? "production-overdue" : ""}"><small>Prazo de entrega</small><strong>${escapeHTML(formatProductionDate(order.deadline))}${isOverdue ? " · Atrasado" : ""}</strong></span>` : ""}
            ${order.deliveredDate ? `<span><small>Entregue em</small><strong>${escapeHTML(formatProductionDate(order.deliveredDate))}</strong></span>` : ""}
          </div>
          ${order.notes ? `<p class="production-notes">${escapeHTML(order.notes)}</p>` : ""}
        </div>
        <div class="production-order-actions">
          <label>Atualizar status
            <select data-production-status="${escapeHTML(order.id)}" aria-label="Atualizar status de ${escapeHTML(order.title)}">${statusOptions}</select>
          </label>
          <button type="button" class="button button-outline" data-production-edit="${escapeHTML(order.id)}">Editar</button>
          <button type="button" class="button button-outline production-delete" data-production-delete="${escapeHTML(order.id)}">Excluir</button>
        </div>
      </article>
    `;
  }).join("");
}

function updateProductionStatus(orderId, status) {
  if (!productionStatuses.some((item) => item.id === status)) return;
  const previousOrders = [...productionOrders];
  productionOrders = productionOrders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      status,
      deliveredDate: status === "delivered"
        ? (order.deliveredDate || new Date().toISOString().slice(0, 10))
        : order.deliveredDate,
      updatedAt: new Date().toISOString()
    };
  });
  if (!saveProductionOrders()) {
    productionOrders = previousOrders;
    return;
  }
  renderProduction();
}

$("#productionSearch").addEventListener("input", (event) => renderProduction(event.target.value));

$("#productionList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-production-edit]");
  const deleteButton = event.target.closest("[data-production-delete]");

  if (editButton) {
    const order = productionOrders.find((item) => item.id === editButton.dataset.productionEdit);
    if (order) openProductionForm(order);
    return;
  }

  if (deleteButton) {
    const order = productionOrders.find((item) => item.id === deleteButton.dataset.productionDelete);
    if (!order) return;
    if (!confirm(`Deseja realmente excluir o projeto "${order.title}"?`)) return;
    const previousOrders = [...productionOrders];
    productionOrders = productionOrders.filter((item) => item.id !== order.id);
    if (!saveProductionOrders()) {
      productionOrders = previousOrders;
      return;
    }
    renderProduction();
  }
});

$("#productionList").addEventListener("change", (event) => {
  const select = event.target.closest("[data-production-status]");
  if (select) updateProductionStatus(select.dataset.productionStatus, select.value);
});

/* ---------- Inicialização ---------- */
renderClients();
renderDashboard();
renderQuotes();
updateQuoteCalculations();
renderSales();
renderProduction();
