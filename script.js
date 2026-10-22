
/* ========================================
   CRM LR INTERIORES
   Clientes, orçamentos e armazenamento local
======================================== */

"use strict";

const STORAGE_KEY = "lr-interiores-crm-v1";
const QUOTES_STORAGE_KEY = "lr-interiores-orcamentos-v1";
const FINANCE_STORAGE_KEY = "lr-interiores-financeiro-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let clients = loadClients();
let quotes = loadQuotes();
let financeEntries = loadFinanceEntries();

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

function refreshDashboardAfterSave() {
  // Atualiza os dados do painel imediatamente após qualquer salvamento local.
  if (typeof renderDashboard === "function") renderDashboard();
}

function saveClients() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os clientes:", error);
    alert("Não foi possível preparar os dados para sincronização. Confira a conexão com o Firebase e tente novamente.");
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
    if (typeof refreshCommissionLinks === "function") refreshCommissionLinks();
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os orçamentos:", error);
    alert("Não foi possível preparar os orçamentos para sincronização. Confira a conexão com o Firebase e tente novamente.");
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
  equipe: "Equipe",
  financeiro: "Financeiro",
  marketing: "Marketing",
  parceiros: "Parceiros / Comissões"
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
  if (pageName === "equipe") renderTeamMembers();
  if (pageName === "financeiro") renderFinance();
  if (pageName === "marketing") renderMarketing();
  if (pageName === "parceiros") renderPartners();
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

  let linkedRecordsSynced = true;
  if (existingClient && existingClient.name !== clientData.name) {
    linkedRecordsSynced = syncClientNameAcrossRecords(clientData);
  }

  closeClientForm();
  renderClients($("#clientSearch").value);
  renderDashboard();
  renderQuotes();
  renderSales();
  renderProduction();
  renderFinance();

  if (!linkedRecordsSynced) {
    alert("O cadastro do cliente foi salvo, mas não foi possível atualizar todos os registros vinculados. Confira Orçamentos, Funil, Produção e Financeiro antes de continuar.");
    return;
  }

  alert(
    id
      ? (existingClient && existingClient.name !== clientData.name
          ? "Cliente atualizado! O nome também foi sincronizado nos registros vinculados."
          : "Cliente atualizado com sucesso!")
      : "Cliente cadastrado com sucesso!"
  );
});

function syncClientNameAcrossRecords(client) {
  const previousQuotes = [...quotes];
  const previousSales = [...sales];
  const previousProduction = [...productionOrders];
  const previousFinance = [...financeEntries];

  quotes = quotes.map((item) => item.clientId === client.id
    ? { ...item, clientName: client.name, updatedAt: new Date().toISOString() }
    : item
  );
  sales = sales.map((item) => item.clientId === client.id
    ? { ...item, clientName: client.name, updatedAt: new Date().toISOString() }
    : item
  );
  productionOrders = productionOrders.map((item) => item.clientId === client.id
    ? { ...item, clientName: client.name, updatedAt: new Date().toISOString() }
    : item
  );
  financeEntries = financeEntries.map((item) => item.clientId === client.id
    ? { ...item, clientName: client.name, updatedAt: new Date().toISOString() }
    : item
  );

  const saved = saveQuotes() && saveSales() && saveProductionOrders() && saveFinanceEntries();
  if (saved) return true;

  quotes = previousQuotes;
  sales = previousSales;
  productionOrders = previousProduction;
  financeEntries = previousFinance;
  saveQuotes();
  saveSales();
  saveProductionOrders();
  saveFinanceEntries();
  return false;
}

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
  if ($("#marketingChannelRows")) renderMarketing();

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

/* ---------- Proteção de vínculos entre módulos ---------- */
function linkedRecordsForClient(clientId) {
  const clientQuotes = quotes.filter((item) => item.clientId === clientId);
  const quoteIds = new Set(clientQuotes.map((item) => item.id));
  const clientSales = sales.filter((item) => item.clientId === clientId || quoteIds.has(item.quoteId));
  const saleIds = new Set(clientSales.map((item) => item.id));
  const clientProduction = productionOrders.filter((item) =>
    item.clientId === clientId || quoteIds.has(item.quoteId) || saleIds.has(item.saleId)
  );
  const clientFinance = financeEntries.filter((item) =>
    item.clientId === clientId || saleIds.has(item.saleId) ||
    (item.quoteId && quoteIds.has(item.quoteId))
  );
  const clientCommissions = commissions.filter((item) => quoteIds.has(item.quoteId));
  return { quotes: clientQuotes, sales: clientSales, production: clientProduction, finance: clientFinance, commissions: clientCommissions };
}

function explainBlockedDelete(type, label, related) {
  const details = [];
  if (related.quotes?.length) details.push(`${related.quotes.length} orçamento(s)`);
  if (related.sales?.length) details.push(`${related.sales.length} oportunidade(s) no Funil`);
  if (related.production?.length) details.push(`${related.production.length} projeto(s) na Produção`);
  if (related.finance?.length) details.push(`${related.finance.length} lançamento(s) no Financeiro`);
  if (related.commissions?.length) details.push(`${related.commissions.length} vínculo(s)/comissão(ões) de parceiro`);
  alert(`Não é possível excluir ${type} “${label}” porque existem registros vinculados: ${details.join(", ")}. Resolva os vínculos primeiro para preservar o histórico do CRM.`);
}

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
    const related = linkedRecordsForClient(client.id);
    if (related.quotes.length || related.sales.length || related.production.length || related.finance.length || related.commissions.length) {
      explainBlockedDelete("o cliente", client.name, related);
      return;
    }
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

  const currentMonth = localISODate().slice(0, 7);
  const openSales = sales.filter((sale) => !["won", "lost"].includes(sale.stage));
  const receivedThisMonth = financeEntries.reduce(
    (sum, entry) => sum + financeReceivedInMonth(entry, currentMonth),
    0
  );
  $("#dashboardOpenSales").textContent = openSales.length;
  $("#dashboardReceivedMonth").textContent = formatBRL(receivedThisMonth);

  const pipelineValue = openSales.reduce((sum, sale) => sum + Math.max(0, Number(sale.expectedValue) || 0), 0);
  const receivableValue = financeEntries.reduce((sum, entry) => sum + financeOutstandingAmount(entry), 0);
  const payableValue = financeEntries.reduce((sum, entry) => {
    if (entry.type !== "expense" || entry.status === "paid") return sum;
    return sum + Math.max(0, (Number(entry.amount) || 0) - (Number(entry.paidAmount) || 0));
  }, 0);
  const today = localISODate();
  const overdueProduction = productionOrders.filter((order) =>
    order.status !== "delivered" && order.deadline && order.deadline < today
  ).length;

  $("#dashboardPipelineValue").textContent = formatBRL(pipelineValue);
  $("#dashboardReceivableValue").textContent = formatBRL(receivableValue);
  $("#dashboardPayableValue").textContent = formatBRL(payableValue);
  $("#dashboardOverdueProduction").textContent = overdueProduction;

  renderDashboardFollowups();
  renderDashboardDeadlines();

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

function renderDashboardFollowups() {
  const container = $("#dashboardFollowups");
  const today = localISODate();
  const horizonDate = new Date();
  horizonDate.setDate(horizonDate.getDate() + 7);
  const horizon = localISODate(horizonDate);
  const allDueSales = sales
    .filter((sale) => !["won", "lost"].includes(sale.stage) && sale.followupDate && sale.followupDate <= horizon)
    .sort((a, b) => a.followupDate.localeCompare(b.followupDate));
  const overdueCount = allDueSales.filter((sale) => sale.followupDate < today).length;
  const todayCount = allDueSales.filter((sale) => sale.followupDate === today).length;
  const upcomingCount = allDueSales.filter((sale) => sale.followupDate > today).length;
  const summary = $("#dashboardFollowupSummary");
  if (summary) {
    summary.textContent = allDueSales.length
      ? `${overdueCount} vencido(s) • ${todayCount} para hoje • ${upcomingCount} nos próximos 7 dias`
      : "Nenhum retorno vencido ou previsto para os próximos 7 dias";
  }
  const dueSales = allDueSales.slice(0, 5);

  if (!dueSales.length) {
    container.innerHTML = '<div class="dashboard-alert-empty">Nenhum retorno vencido ou previsto para os próximos 7 dias.</div>';
    return;
  }

  container.innerHTML = dueSales.map((sale) => {
    const client = clients.find((item) => item.id === sale.clientId);
    const dateLabel = sale.followupDate < today ? "Atrasado" : sale.followupDate === today ? "Hoje" : formatSalesDate(sale.followupDate);
    const urgency = sale.followupDate < today ? "is-overdue" : sale.followupDate === today ? "is-today" : "";
    return `<button type="button" class="dashboard-alert-item ${urgency}" data-dashboard-sale="${escapeHTML(sale.id)}">
      <span class="dashboard-alert-date">${escapeHTML(dateLabel)}</span>
      <span class="dashboard-alert-copy"><strong>${escapeHTML(sale.title)}</strong><small>${escapeHTML(client?.name || sale.clientName || "Sem cliente vinculado")}</small></span>
      <span class="dashboard-alert-arrow">›</span>
    </button>`;
  }).join("");
}

function renderDashboardDeadlines() {
  const container = $("#dashboardDeadlines");
  const today = localISODate();
  const horizonDate = new Date();
  horizonDate.setDate(horizonDate.getDate() + 7);
  const horizon = localISODate(horizonDate);
  const dueOrders = productionOrders
    .filter((order) => order.status !== "delivered" && order.deadline && order.deadline <= horizon)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  if (!dueOrders.length) {
    container.innerHTML = '<div class="dashboard-alert-empty">Nenhum prazo atrasado ou previsto para os próximos 7 dias.</div>';
    return;
  }

  container.innerHTML = dueOrders.map((order) => {
    const client = clients.find((item) => item.id === order.clientId);
    const dateLabel = order.deadline < today ? "Atrasado" : order.deadline === today ? "Hoje" : formatProductionDate(order.deadline);
    const urgency = order.deadline < today ? "is-overdue" : order.deadline === today ? "is-today" : "";
    return `<button type="button" class="dashboard-alert-item ${urgency}" data-dashboard-production="${escapeHTML(order.id)}">
      <span class="dashboard-alert-date">${escapeHTML(dateLabel)}</span>
      <span class="dashboard-alert-copy"><strong>${escapeHTML(order.title)}</strong><small>${escapeHTML(client?.name || order.clientName || "Sem cliente vinculado")}</small></span>
      <span class="dashboard-alert-arrow">›</span>
    </button>`;
  }).join("");
}

$("#dashboardFollowups").addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-sale]");
  if (!button) return;
  const sale = sales.find((item) => item.id === button.dataset.dashboardSale);
  if (!sale) return;
  navigateTo("vendas");
  openSaleForm(sale);
});

$("#dashboardDeadlines").addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-production]");
  if (!button) return;
  const order = productionOrders.find((item) => item.id === button.dataset.dashboardProduction);
  if (!order) return;
  navigateTo("producao");
  openProductionForm(order);
});

/* ---------- Marketing ---------- */
function renderMarketing() {
  const sourceForClient = (client) => (client.source || "").trim() || "Não informado";
  const trackedContacts = clients.filter((client) => Boolean((client.source || "").trim())).length;
  const openSales = sales.filter((sale) => !["won", "lost"].includes(sale.stage));
  const wonSales = sales.filter((sale) => sale.stage === "won");
  const wonValue = wonSales.reduce((sum, sale) => sum + Math.max(0, Number(sale.expectedValue) || 0), 0);

  $("#marketingContacts").textContent = clients.length;
  $("#marketingTrackedContacts").textContent = trackedContacts;
  $("#marketingOpenSales").textContent = openSales.length;
  $("#marketingWonValue").textContent = formatBRL(wonValue);

  const channels = new Map();
  clients.forEach((client) => {
    const source = sourceForClient(client);
    if (!channels.has(source)) channels.set(source, { source, contacts: 0, opportunities: 0, won: 0, wonValue: 0 });
    channels.get(source).contacts += 1;
  });
  sales.forEach((sale) => {
    const client = clients.find((item) => item.id === sale.clientId);
    if (!client) return;
    const source = sourceForClient(client);
    if (!channels.has(source)) channels.set(source, { source, contacts: 0, opportunities: 0, won: 0, wonValue: 0 });
    const channel = channels.get(source);
    channel.opportunities += 1;
    if (sale.stage === "won") {
      channel.won += 1;
      channel.wonValue += Math.max(0, Number(sale.expectedValue) || 0);
    }
  });

  const sortedChannels = [...channels.values()].sort((a, b) =>
    b.contacts - a.contacts || b.wonValue - a.wonValue || a.source.localeCompare(b.source, "pt-BR")
  );
  $("#marketingChannelCount").textContent = sortedChannels.length
    ? `${sortedChannels.length} ${sortedChannels.length === 1 ? "origem identificada" : "origens identificadas"}`
    : "Nenhum canal identificado";

  const rows = $("#marketingChannelRows");
  if (!sortedChannels.length) {
    rows.innerHTML = '<tr><td colspan="6" class="marketing-empty-cell">Cadastre clientes e preencha o campo “Origem do contato” para começar a acompanhar os canais.</td></tr>';
    return;
  }

  rows.innerHTML = sortedChannels.map((channel) => {
    const conversion = channel.opportunities ? (channel.won / channel.opportunities) * 100 : 0;
    const conversionLabel = channel.opportunities
      ? `${conversion.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
      : "—";
    return `<tr>
      <td><strong>${escapeHTML(channel.source)}</strong></td>
      <td>${channel.contacts}</td>
      <td>${channel.opportunities}</td>
      <td>${channel.won}</td>
      <td><span class="marketing-conversion"><span style="width:${Math.max(0, Math.min(100, conversion))}%"></span></span><small class="marketing-conversion-label">${conversionLabel}</small></td>
      <td class="marketing-value-cell">${formatBRL(channel.wonValue)}</td>
    </tr>`;
  }).join("");
}


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
    const related = {
      quotes: [],
      sales: sales.filter((item) => item.quoteId === quote.id),
      production: productionOrders.filter((item) => item.quoteId === quote.id),
      finance: financeEntries.filter((entry) =>
        entry.quoteId === quote.id || sales.some((sale) => sale.quoteId === quote.id && entry.saleId === sale.id)
      ),
      commissions: commissions.filter((item) => item.quoteId === quote.id)
    };
    if (related.sales.length || related.production.length || related.finance.length || related.commissions.length) {
      explainBlockedDelete("o orçamento", quote.name, related);
      return;
    }

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
    if (typeof refreshCommissionLinks === "function") refreshCommissionLinks();
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar o funil de vendas:", error);
    alert("Não foi possível preparar as oportunidades para sincronização. Confira a conexão com o Firebase e tente novamente.");
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

  const newlyWon = opportunity.stage === "won" && existing?.stage !== "won";
  if (opportunity.stage === "won") {
    const financeSynced = syncWonSalesToFinance();
    if (!financeSynced) {
      alert("A venda foi salva, mas não foi possível atualizar o Financeiro agora. Abra a área Financeiro para tentar sincronizar novamente.");
    } else if (financeSyncProtectedReceivedAmount) {
      alert("O lançamento do Financeiro foi atualizado, mas o valor total não ficou abaixo dos recebimentos já registrados. Confira o valor da venda e o histórico de pagamentos.");
    } else if (newlyWon) {
      alert("Venda concluída! O lançamento correspondente foi conferido no Financeiro. Confira o vencimento e registre os recebimentos conforme o cliente pagar.");
    }
  }

  renderSales();
  renderDashboard();
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
  if (stageId === "won") {
    const financeSynced = syncWonSalesToFinance();
    if (!financeSynced) {
      alert("A etapa foi salva, mas não foi possível atualizar o Financeiro agora. Abra a área Financeiro para tentar sincronizar novamente.");
    } else if (financeSyncProtectedReceivedAmount) {
      alert("O lançamento do Financeiro foi atualizado, mas o valor total foi mantido no mínimo dos recebimentos já registrados. Confira o valor da venda e o histórico de pagamentos.");
    }
  }
  renderSales();
}

function renderSales(searchTerm = $("#salesSearch").value) {
  renderDashboard();
  if ($("#marketingChannelRows")) renderMarketing();
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
                ${sale.followupDate ? (() => { const followupState = sale.followupDate < localISODate() ? "overdue" : sale.followupDate === localISODate() ? "today" : "upcoming"; const followupLabel = followupState === "overdue" ? "Atrasado" : followupState === "today" ? "Hoje" : "Agendado"; return `<div class="sales-card-detail sales-followup-detail sales-followup-${followupState}"><small>Próximo contato</small><span>${escapeHTML(formatSalesDate(sale.followupDate))}<span class="sales-followup-badge">${followupLabel}</span></span></div>`; })() : ""}
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
    const linkedProduction = productionOrders.filter((item) => item.saleId === sale.id);
    const linkedFinance = financeEntries.filter((item) => item.saleId === sale.id);
    const linkedCommissions = commissions.filter((item) => item.quoteId && item.quoteId === sale.quoteId);
    const financeHasPayments = linkedFinance.some((entry) =>
      entry.status === "paid" || Number(entry.paidAmount) > 0 ||
      (Array.isArray(entry.payments) && entry.payments.some((payment) => Number(payment.amount) > 0))
    );

    // Um recebimento/pagamento ou projeto de produção exige preservar o histórico.
    if (linkedProduction.length || linkedCommissions.length || financeHasPayments) {
      explainBlockedDelete("a oportunidade do Funil", sale.title, {
        quotes: [],
        sales: [],
        production: linkedProduction,
        finance: linkedFinance,
        commissions: linkedCommissions
      });
      return;
    }

    const financeWarning = linkedFinance.length
      ? `\n\nTambém serão removidos ${linkedFinance.length} lançamento(s) pendente(s) e sem pagamentos que foram gerados para esta oportunidade.`
      : "";
    if (!confirm(`Deseja realmente excluir a oportunidade "${sale.title}"?${financeWarning}\n\nEsta ação não pode ser desfeita.`)) return;

    const previousSales = [...sales];
    const previousFinance = [...financeEntries];

    // Remove lançamentos pendentes vinculados junto com a oportunidade, evitando um vínculo órfão.
    if (linkedFinance.length) {
      financeEntries = financeEntries.filter((entry) => entry.saleId !== sale.id);
      if (!saveFinanceEntries()) {
        financeEntries = previousFinance;
        return;
      }
    }

    sales = sales.filter((item) => item.id !== sale.id);
    if (!saveSales()) {
      sales = previousSales;
      if (linkedFinance.length) {
        financeEntries = previousFinance;
        saveFinanceEntries();
      }
      return;
    }
    renderSales();
    if (linkedFinance.length) renderFinance();
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
      notes: typeof order.notes === "string" ? order.notes : "",
      photo: typeof order.photo === "string" && order.photo.startsWith("data:image/jpeg;base64,") ? order.photo : ""
    }));
  } catch (error) {
    console.error("Não foi possível carregar a produção:", error);
    return [];
  }
}

function saveProductionOrders() {
  try {
    localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(productionOrders));
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar a produção:", error);
    alert("Não foi possível preparar os projetos para sincronização. Confira a conexão com o Firebase e tente novamente.");
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

let productionPhotoData = "";

function setProductionPhotoPreview(dataUrl) {
  productionPhotoData = dataUrl || "";
  const wrap = $("#productionPhotoPreviewWrap");
  const preview = $("#productionPhotoPreview");
  preview.src = productionPhotoData;
  wrap.hidden = !productionPhotoData;
}

function compressProductionPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Esse formato de imagem não pôde ser aberto."));
      image.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível otimizar essa imagem."));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const maxBytes = 250 * 1024;
        let quality = 0.82;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length * 0.75 > maxBytes && quality > 0.42) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        while (dataUrl.length * 0.75 > maxBytes && canvas.width > 480 && canvas.height > 480) {
          canvas.width = Math.max(1, Math.round(canvas.width * 0.82));
          canvas.height = Math.max(1, Math.round(canvas.height * 0.82));
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          quality = 0.68;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length * 0.75 > maxBytes) {
          reject(new Error("Não foi possível reduzir essa foto para até 250 KB. Tente uma imagem menor."));
          return;
        }
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$("#productionPhoto").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Selecione um arquivo de imagem.");
    event.target.value = "";
    return;
  }
  try {
    const optimizedPhoto = await compressProductionPhoto(file);
    setProductionPhotoPreview(optimizedPhoto);
  } catch (error) {
    alert(error.message || "Não foi possível processar essa foto.");
    event.target.value = "";
  }
});

$("#removeProductionPhotoBtn").addEventListener("click", () => {
  setProductionPhotoPreview("");
  $("#productionPhoto").value = "";
});

function openProductionForm(order = null) {
  const form = $("#productionForm");
  form.reset();
  setProductionPhotoPreview("");
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
    setProductionPhotoPreview(order.photo || "");
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
    photo: productionPhotoData,
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
  renderDashboard();
  renderProductionOptions();
  const normalizedSearch = (searchTerm || "").trim().toLocaleLowerCase("pt-BR");
  const selectedStatus = $("#productionStatusFilter")?.value || "all";
  const today = localISODate();
  const currentMonth = today.slice(0, 7);
  const isOrderOverdue = (order) => Boolean(
    order.deadline && order.deadline < today && order.status !== "delivered"
  );
  const filtered = productionOrders.filter((order) => {
    const client = clients.find((item) => item.id === order.clientId);
    const clientName = client?.name || order.clientName || "";
    const matchesSearch = `${order.title} ${clientName} ${order.saleTitle} ${order.quoteName} ${order.notes}`
      .toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesStatus = selectedStatus === "all" ||
      (selectedStatus === "overdue" ? isOrderOverdue(order) : order.status === selectedStatus);
    return matchesSearch && matchesStatus;
  });

  $("#productionActiveCount").textContent = productionOrders.filter((order) => order.status !== "delivered").length;
  $("#productionWorkingCount").textContent = productionOrders.filter((order) =>
    ["production", "finishing"].includes(order.status)
  ).length;
  $("#productionReadyCount").textContent = productionOrders.filter((order) => order.status === "ready").length;
  $("#productionOverdueCount").textContent = productionOrders.filter(isOrderOverdue).length;
  $("#productionDeliveredMonthCount").textContent = productionOrders.filter((order) =>
    order.status === "delivered" && (order.deliveredDate || "").startsWith(currentMonth)
  ).length;
  $("#productionListCount").textContent = `${filtered.length} ${filtered.length === 1 ? "projeto" : "projetos"}`;

  const list = $("#productionList");
  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">${productionOrders.length === 0
      ? "Você ainda não cadastrou projetos de produção. Clique em “+ Nova ordem” para começar."
      : "Nenhum projeto encontrado para essa busca."}</div>`;
    renderProductionCalendar(filtered);
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
    const today = localISODate();
    const isOverdue = order.deadline && order.deadline < today && order.status !== "delivered";
    const isDueToday = order.deadline === today && order.status !== "delivered";
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const isDueSoon = order.deadline > today && order.deadline <= localISODate(nextWeek) && order.status !== "delivered";
    const deadlineClass = isOverdue ? "production-overdue" : isDueToday ? "production-due-today" : isDueSoon ? "production-due-soon" : "";
    const deadlineLabel = isOverdue ? " · Atrasado" : isDueToday ? " · Vence hoje" : isDueSoon ? " · Próximo" : "";
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
          ${order.photo ? `<a class="production-order-photo-link" href="${order.photo}" target="_blank" rel="noopener" aria-label="Abrir foto do projeto ${escapeHTML(order.title)}"><img class="production-order-photo" src="${order.photo}" alt="Foto de referência de ${escapeHTML(order.title)}" loading="lazy"></a>` : ""}
          <div class="production-dates">
            ${order.startDate ? `<span><small>Início</small><strong>${escapeHTML(formatProductionDate(order.startDate))}</strong></span>` : ""}
            ${order.deadline ? `<span class="${deadlineClass}"><small>Prazo de entrega</small><strong>${escapeHTML(formatProductionDate(order.deadline))}${deadlineLabel}</strong></span>` : ""}
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
  renderProductionCalendar(filtered);
}

let productionCalendarDate = new Date();
let productionViewMode = "list";

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderProductionCalendar(orders) {
  if (!orders) {
    const normalizedSearch = ($("#productionSearch").value || "").trim().toLocaleLowerCase("pt-BR");
    const selectedStatus = $("#productionStatusFilter")?.value || "all";
    const today = localISODate();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const horizon = localISODate(nextWeek);
    orders = productionOrders.filter((order) => {
      const client = clients.find((item) => item.id === order.clientId);
      const clientName = client?.name || order.clientName || "";
      const searchable = `${order.title} ${clientName} ${order.saleTitle} ${order.quoteName} ${order.notes}`
        .toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      const overdue = order.deadline && order.deadline < today && order.status !== "delivered";
      const matchesStatus = selectedStatus === "all" ||
        (selectedStatus === "overdue" ? overdue : order.status === selectedStatus);
      return searchable && matchesStatus;
    });
  }
  const year = productionCalendarDate.getFullYear();
  const month = productionCalendarDate.getMonth();
  const monthName = productionCalendarDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
  $("#productionCalendarMonth").textContent = monthName.charAt(0).toLocaleUpperCase("pt-BR") + monthName.slice(1);

  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());
  const todayKey = localDateKey(new Date());
  const eventsByDate = {};

  orders.forEach((order) => {
    const client = clients.find((item) => item.id === order.clientId);
    const clientName = client?.name || order.clientName || "Sem cliente";
    const addEvent = (date, type, label, cssClass) => {
      if (!date) return;
      if (!eventsByDate[date]) eventsByDate[date] = [];
      eventsByDate[date].push({
        orderId: order.id,
        title: order.title,
        clientName,
        type,
        label,
        cssClass,
        overdue: type === "deadline" && date < todayKey && order.status !== "delivered"
      });
    };
    addEvent(order.startDate, "start", "Início", "calendar-event-start");
    addEvent(order.deadline, "deadline", "Entrega", "calendar-event-deadline");
    addEvent(order.deliveredDate, "delivered", "Entregue", "calendar-event-delivered");
  });

  const weekdayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const weekdayMarkup = weekdayHeaders.map((day) => `<div class="production-calendar-weekday">${day}</div>`).join("");
  const dayCells = [];
  for (let i = 0; i < 42; i += 1) {
    const dayDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dateKey = localDateKey(dayDate);
    const dayEvents = (eventsByDate[dateKey] || []).sort((a, b) => {
      const priority = { deadline: 0, start: 1, delivered: 2 };
      return priority[a.type] - priority[b.type];
    });
    const visibleEvents = dayEvents.slice(0, 3);
    const moreCount = dayEvents.length - visibleEvents.length;
    dayCells.push(`
      <div class="production-calendar-day ${dayDate.getMonth() !== month ? "is-outside-month" : ""} ${dateKey === todayKey ? "is-today" : ""}" data-calendar-date="${dateKey}">
        <span class="production-calendar-day-number">${dayDate.getDate()}</span>
        <div class="production-calendar-events">
          ${visibleEvents.map((event) => `
            <button type="button" class="production-calendar-event ${event.cssClass} ${event.overdue ? "is-overdue" : ""}" data-production-edit="${escapeHTML(event.orderId)}" title="${escapeHTML(event.label + ": " + event.title + " — " + event.clientName)}">
              <span>${escapeHTML(event.label)}:</span> ${escapeHTML(event.title)}
            </button>
          `).join("")}
          ${moreCount > 0 ? `<span class="production-calendar-more">+${moreCount} evento(s)</span>` : ""}
        </div>
      </div>
    `);
  }
  $("#productionCalendarGrid").innerHTML = weekdayMarkup + dayCells.join("");
}

function setProductionView(mode) {
  productionViewMode = mode;
  const calendarMode = mode === "calendar";
  $("#productionList").hidden = calendarMode;
  $("#productionCalendar").hidden = !calendarMode;
  $("#productionListViewBtn").classList.toggle("active", !calendarMode);
  $("#productionCalendarViewBtn").classList.toggle("active", calendarMode);
  $("#productionListViewBtn").setAttribute("aria-pressed", String(!calendarMode));
  $("#productionCalendarViewBtn").setAttribute("aria-pressed", String(calendarMode));
  if (calendarMode) renderProductionCalendar();
}

$("#productionListViewBtn").addEventListener("click", () => setProductionView("list"));
$("#productionCalendarViewBtn").addEventListener("click", () => setProductionView("calendar"));
$("#productionCalendarPrev").addEventListener("click", () => {
  productionCalendarDate = new Date(productionCalendarDate.getFullYear(), productionCalendarDate.getMonth() - 1, 1);
  renderProductionCalendar();
});
$("#productionCalendarNext").addEventListener("click", () => {
  productionCalendarDate = new Date(productionCalendarDate.getFullYear(), productionCalendarDate.getMonth() + 1, 1);
  renderProductionCalendar();
});
$("#productionCalendarToday").addEventListener("click", () => {
  productionCalendarDate = new Date();
  renderProductionCalendar();
});
$("#productionCalendarGrid").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-production-edit]");
  if (!editButton) return;
  const order = productionOrders.find((item) => item.id === editButton.dataset.productionEdit);
  if (order) openProductionForm(order);
});

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
$("#productionStatusFilter").addEventListener("change", () => renderProduction());

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
    const relatedFinance = financeEntries.filter((entry) =>
      (order.saleId && entry.saleId === order.saleId) ||
      (order.clientId && entry.clientId === order.clientId && entry.status === "paid")
    );
    if (order.status === "delivered" || relatedFinance.some((entry) =>
      entry.status === "paid" || Number(entry.paidAmount) > 0 ||
      (Array.isArray(entry.payments) && entry.payments.some((payment) => Number(payment.amount) > 0))
    )) {
      alert("Não é possível excluir este projeto porque ele já foi entregue ou possui recebimentos/pagamentos registrados. Preserve o histórico e altere o status se necessário.");
      return;
    }
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


/* ---------- Financeiro ---------- */
function localISODate(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function loadFinanceEntries() {
  try {
    const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) =>
      entry &&
      typeof entry.id === "string" &&
      typeof entry.description === "string"
    ).map((entry) => {
      const amount = Math.max(0, Number(entry.amount) || 0);
      const saleId = typeof entry.saleId === "string" ? entry.saleId : "";
      const payments = saleId && Array.isArray(entry.payments)
        ? entry.payments.filter((payment) =>
            payment && Number(payment.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payment.date || "")
          ).map((payment) => ({
            amount: Math.max(0, Number(payment.amount) || 0),
            date: payment.date
          }))
        : (saleId && Number(entry.paidAmount) > 0
          ? [{ amount: Math.max(0, Number(entry.paidAmount) || 0), date: entry.paidDate || entry.dueDate }]
          : []);
      const paidAmount = saleId
        ? Math.min(amount, payments.reduce((sum, payment) => sum + payment.amount, 0))
        : (entry.status === "paid" ? amount : 0);
      const status = saleId
        ? (paidAmount >= amount && amount > 0 ? "paid" : paidAmount > 0 ? "partial" : "pending")
        : (entry.status === "paid" ? "paid" : "pending");
      return {
        ...entry,
        type: entry.type === "expense" ? "expense" : "income",
        category: typeof entry.category === "string" ? entry.category : "Outros",
        amount,
        paidAmount,
        payments,
        saleId,
        status,
        dueDate: typeof entry.dueDate === "string" ? entry.dueDate : "",
        paidDate: typeof entry.paidDate === "string" ? entry.paidDate : "",
        clientId: typeof entry.clientId === "string" ? entry.clientId : "",
        clientName: typeof entry.clientName === "string" ? entry.clientName : "",
        notes: typeof entry.notes === "string" ? entry.notes : ""
      };
    });
  } catch (error) {
    console.error("Não foi possível carregar o financeiro:", error);
    return [];
  }
}

function saveFinanceEntries() {
  try {
    localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(financeEntries));
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os lançamentos financeiros:", error);
    alert("Não foi possível preparar os lançamentos para sincronização. Confira a conexão com o Firebase e tente novamente.");
    return false;
  }
}

function financeEffectiveDate(entry) {
  if (entry.saleId && Array.isArray(entry.payments) && entry.payments.length) {
    return entry.payments[entry.payments.length - 1].date || entry.dueDate;
  }
  return (entry.status === "paid" || entry.status === "partial") && entry.paidDate
    ? entry.paidDate
    : entry.dueDate;
}

function financeReceivedInMonth(entry, month) {
  if (entry.type !== "income") return 0;
  if (!entry.saleId) {
    return entry.status === "paid" && financeEffectiveDate(entry).startsWith(month) ? entry.amount : 0;
  }
  return (entry.payments || []).reduce((sum, payment) =>
    payment.date.startsWith(month) ? sum + payment.amount : sum, 0);
}

function financeReceivedAmount(entry) {
  if (entry.type !== "income") return 0;
  return entry.saleId
    ? Math.min(entry.amount, Math.max(0, Number(entry.paidAmount) || 0))
    : (entry.status === "paid" ? entry.amount : 0);
}

function financeOutstandingAmount(entry) {
  if (entry.type !== "income") return 0;
  return entry.saleId
    ? Math.max(0, entry.amount - financeReceivedAmount(entry))
    : (entry.status === "paid" ? 0 : entry.amount);
}

function formatFinanceDate(dateValue) {
  if (!dateValue) return "Não informada";
  const date = new Date(dateValue + "T12:00:00");
  return Number.isNaN(date.getTime()) ? "Não informada" : date.toLocaleDateString("pt-BR");
}

function renderFinanceClientOptions(selectedId = $("#financeClient").value) {
  const select = $("#financeClient");
  select.innerHTML = '<option value="">Sem cliente vinculado</option>' +
    clients.map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name)}</option>`).join("");
  select.value = clients.some((client) => client.id === selectedId) ? selectedId : "";
}

function openFinanceForm(entry = null) {
  const form = $("#financeForm");
  form.reset();
  $("#financeId").value = entry?.id || "";
  $("#financeFormTitle").textContent = entry ? "Editar lançamento" : "Novo lançamento";
  $("#financeType").value = entry?.type || "income";
  $("#financeDescription").value = entry?.description || "";
  $("#financeCategory").value = entry?.category || "Venda / serviço";
  $("#financeAmount").value = entry ? String(entry.amount) : "";
  $("#financeDueDate").value = entry?.dueDate || localISODate();
  $("#financeStatus").value = entry?.status === "paid" ? "paid" : "pending";
  $("#financePaidDate").value = localISODate();
  $("#financePaidAmount").value = "";
  $("#financeNotes").value = entry?.notes || "";
  renderFinanceClientOptions(entry?.clientId || "");

  const linkedSale = Boolean(entry?.saleId);
  $("#financePaidAmountField").hidden = !linkedSale;
  $("#financeStatusField").hidden = linkedSale;
  $("#financePaidDateField").hidden = false;
  $("#financePaidAmount").max = entry ? String(entry.amount) : "";
  const linkedInfo = $("#financeLinkedSaleInfo");
  linkedInfo.hidden = !linkedSale;
  if (linkedSale) {
    linkedInfo.textContent = "Venda vinculada ao Funil. O valor total é o valor previsto da venda; informe quanto o cliente já pagou. O saldo restante será calculado automaticamente.";
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#financeDescription").focus({ preventScroll: true });
}

function closeFinanceForm() {
  $("#financeForm").reset();
  $("#financeId").value = "";
  $("#financeForm").hidden = true;
  $("#financePaidAmountField").hidden = true;
  $("#financeStatusField").hidden = false;
  $("#financePaidDateField").hidden = false;
  $("#financeLinkedSaleInfo").hidden = true;
}

let financeSyncProtectedReceivedAmount = false;

function syncWonSalesToFinance() {
  financeSyncProtectedReceivedAmount = false;
  const previousEntries = [...financeEntries];
  const today = localISODate();
  const linkedSaleIds = new Set(financeEntries.map((entry) => entry.saleId).filter(Boolean));
  const wonSales = sales.filter((sale) =>
    sale.stage === "won" && Number(sale.expectedValue) > 0
  );
  const newEntries = [];

  for (const sale of wonSales) {
    const client = clients.find((item) => item.id === sale.clientId);
    const existing = financeEntries.find((entry) => entry.saleId === sale.id);

    if (existing) {
      const payments = Array.isArray(existing.payments) ? existing.payments : [];
      const receivedTotal = Math.round(payments.reduce((sum, payment) =>
        sum + Math.max(0, Number(payment.amount) || 0), 0) * 100) / 100;
      let amount = Math.round(Math.max(0, Number(sale.expectedValue) || 0) * 100) / 100;
      if (amount < receivedTotal) {
        amount = receivedTotal;
        financeSyncProtectedReceivedAmount = true;
      }
      const paidAmount = Math.min(amount, receivedTotal);
      const status = paidAmount >= amount && amount > 0
        ? "paid"
        : paidAmount > 0 ? "partial" : "pending";
      const updated = {
        ...existing,
        type: "income",
        description: sale.title,
        amount,
        paidAmount,
        payments,
        status,
        paidDate: payments.length ? payments[payments.length - 1].date : "",
        clientId: sale.clientId || "",
        clientName: client ? client.name : (sale.clientName || ""),
        updatedAt: new Date().toISOString()
      };
      financeEntries = financeEntries.map((entry) => entry.id === existing.id ? updated : entry);
      continue;
    }

    if (linkedSaleIds.has(sale.id)) continue;
    newEntries.push({
      id: createId(),
      saleId: sale.id,
      type: "income",
      description: sale.title,
      category: "Venda / serviço",
      amount: Math.round(Math.max(0, Number(sale.expectedValue) || 0) * 100) / 100,
      paidAmount: 0,
      payments: [],
      dueDate: today,
      status: "pending",
      paidDate: "",
      clientId: sale.clientId || "",
      clientName: client ? client.name : (sale.clientName || ""),
      notes: "Criado automaticamente ao concluir a venda no Funil. Atualize o valor recebido conforme o cliente realizar os pagamentos.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    linkedSaleIds.add(sale.id);
  }

  if (!newEntries.length && JSON.stringify(previousEntries) === JSON.stringify(financeEntries)) {
    return true;
  }

  financeEntries = [...newEntries, ...financeEntries];
  if (!saveFinanceEntries()) {
    financeEntries = previousEntries;
    return false;
  }
  return true;
}

let financeCurrentView = "overview";

const financeViewDescriptions = {
  overview: "Todos os lançamentos do mês, sem duplicar registros.",
  receivable: "Receitas com saldo pendente ou pagamento parcial. As entradas já quitadas ficam na Visão geral.",
  payable: "Despesas que ainda precisam ser pagas. Despesas quitadas ficam na Visão geral.",
  team: "Pagamentos de mão de obra registrados pelo cadastro da Equipe.",
  commissions: "Comissões já registradas no Financeiro. Comissões aguardando pagamento continuam sendo acompanhadas em Parceiros / Comissões."
};

function setFinanceView(view) {
  if (!Object.prototype.hasOwnProperty.call(financeViewDescriptions, view)) return;
  financeCurrentView = view;
  document.querySelectorAll("[data-finance-view]").forEach((button) => {
    const active = button.dataset.financeView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#financeViewHelp").textContent = financeViewDescriptions[view];
  renderFinance();
}

function financeEntryMatchesView(entry, view) {
  if (view === "receivable") return entry.type === "income" && financeOutstandingAmount(entry) > 0;
  if (view === "payable") return entry.type === "expense" && entry.status !== "paid";
  if (view === "team") return entry.category === "Mão de obra" || Boolean(entry.teamMemberId);
  if (view === "commissions") return entry.category === "Comissões" || Boolean(entry.linkedCommissionId);
  return true;
}

function renderFinance(searchTerm = $("#financeSearch").value) {
  syncWonSalesToFinance();
  syncPaidCommissionsToFinance();
  renderDashboard();
  const month = $("#financeMonth").value || localISODate().slice(0, 7);
  const normalizedSearch = (searchTerm || "").trim().toLocaleLowerCase("pt-BR");
  const monthEntries = financeEntries.filter((entry) => {
    const effectiveDate = financeEffectiveDate(entry);
    const hasPaymentThisMonth = entry.saleId && (entry.payments || []).some((payment) => payment.date.startsWith(month));
    return effectiveDate.startsWith(month) || hasPaymentThisMonth ||
      (entry.status !== "paid" && entry.dueDate.startsWith(month));
  });
  const received = financeEntries
    .reduce((sum, entry) => sum + financeReceivedInMonth(entry, month), 0);
  const toReceive = financeEntries
    .filter((entry) => entry.type === "income" && entry.status !== "paid" && entry.dueDate.startsWith(month))
    .reduce((sum, entry) => sum + financeOutstandingAmount(entry), 0);
  const expensesPaid = monthEntries
    .filter((entry) => entry.type === "expense" && entry.status === "paid" && financeEffectiveDate(entry).startsWith(month))
    .reduce((sum, entry) => sum + entry.amount, 0);

  $("#financeReceived").textContent = formatBRL(received);
  $("#financeToReceive").textContent = formatBRL(toReceive);
  $("#financeExpensesPaid").textContent = formatBRL(expensesPaid);
  $("#financeBalance").textContent = formatBRL(received - expensesPaid);
  $("#financeBalance").classList.toggle("negative-value", received - expensesPaid < 0);

  const filtered = financeEntries.filter((entry) => {
    const effectiveDate = financeEffectiveDate(entry);
    const hasPaymentThisMonth = entry.saleId && (entry.payments || []).some((payment) => payment.date.startsWith(month));
    const matchesMonth = effectiveDate.startsWith(month) || hasPaymentThisMonth ||
      (entry.status !== "paid" && entry.dueDate.startsWith(month));
    const searchable = `${entry.description} ${entry.category} ${entry.clientName || ""} ${entry.notes || ""}`
      .toLocaleLowerCase("pt-BR");
    return matchesMonth && searchable.includes(normalizedSearch) && financeEntryMatchesView(entry, financeCurrentView);
  }).sort((a, b) => (financeEffectiveDate(b) || "").localeCompare(financeEffectiveDate(a) || ""));

  $("#financeCount").textContent = `${filtered.length} ${filtered.length === 1 ? "lançamento" : "lançamentos"}`;
  const list = $("#financeList");
  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-empty">${financeEntries.length === 0
      ? "Nenhum lançamento financeiro ainda. Ao concluir uma venda no Funil, ela será adicionada aqui automaticamente. Você também pode clicar em “+ Novo lançamento”."
      : financeCurrentView === "receivable"
        ? "Nenhuma conta a receber encontrada para este mês e busca."
        : financeCurrentView === "payable"
          ? "Nenhuma conta a pagar encontrada para este mês e busca."
          : financeCurrentView === "team"
            ? "Nenhum pagamento de equipe encontrado para este mês e busca."
            : financeCurrentView === "commissions"
              ? "Nenhuma comissão registrada no Financeiro para este mês e busca."
              : "Nenhum lançamento encontrado neste mês para essa busca."}</div>`;
    return;
  }

  const today = localISODate();
  list.innerHTML = filtered.map((entry) => {
    const isIncome = entry.type === "income";
    const outstanding = financeOutstandingAmount(entry);
    const receivedAmount = financeReceivedAmount(entry);
    const overdue = entry.status !== "paid" && outstanding > 0 && entry.dueDate && entry.dueDate < today;
    const typeLabel = isIncome ? "Receita" : "Despesa";
    const statusLabel = entry.status === "paid"
      ? (isIncome ? "Recebido" : "Pago")
      : entry.status === "partial" ? "Pago parcialmente" : (overdue ? "Atrasado" : "Pendente");
    const statusClass = entry.status === "paid" ? "paid" : entry.status === "partial" ? "partial" : overdue ? "overdue" : "pending";
    const paymentDetails = entry.saleId
      ? `<span>Recebido no total: <strong>${formatBRL(receivedAmount)}</strong></span><span>Restante: <strong>${formatBRL(outstanding)}</strong></span>`
      : "";
    return `
      <article class="finance-row ${isIncome ? "finance-income" : "finance-expense"}">
        <div class="finance-row-icon" aria-hidden="true">${isIncome ? "↙" : "↗"}</div>
        <div class="finance-row-main">
          <div class="finance-row-title">
            <h3>${escapeHTML(entry.description)}</h3>
            <span class="finance-type-pill ${isIncome ? "income" : "expense"}">${typeLabel}</span>
            <span class="finance-status-pill ${statusClass}">${statusLabel}</span>
            ${entry.saleId ? '<span class="finance-type-pill income">Do funil</span>' : ""}
          </div>
          <p>${escapeHTML(entry.category)} · ${escapeHTML(entry.clientName || "Sem cliente vinculado")}</p>
          <div class="finance-row-meta">
            <span>${entry.status === "paid" || entry.status === "partial" ? "Último pagamento" : "Vencimento"}: ${formatFinanceDate(entry.status === "paid" || entry.status === "partial" ? (entry.paidDate || entry.dueDate) : entry.dueDate)}</span>
            ${paymentDetails}
            ${entry.notes ? `<span class="finance-row-notes">${escapeHTML(entry.notes)}</span>` : ""}
          </div>
        </div>
        <div class="finance-row-side">
          <strong class="${isIncome ? "finance-positive" : "finance-negative"}">${isIncome ? "+" : "−"} ${formatBRL(entry.amount)}</strong>
          <div class="finance-row-actions">
            ${entry.status !== "paid" ? `<button type="button" class="button button-outline" data-finance-action="mark-paid" data-finance-id="${escapeHTML(entry.id)}">${entry.saleId ? "Marcar quitado" : isIncome ? "Marcar recebido" : "Marcar pago"}</button>` : `<button type="button" class="button button-outline" data-finance-action="mark-pending" data-finance-id="${escapeHTML(entry.id)}">Reabrir pendência</button>`}
            <button type="button" class="button button-outline" data-finance-action="edit" data-finance-id="${escapeHTML(entry.id)}">Editar</button>
            <button type="button" class="button button-outline finance-delete" data-finance-action="delete" data-finance-id="${escapeHTML(entry.id)}">Excluir</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

document.querySelectorAll("[data-finance-view]").forEach((button) => {
  button.addEventListener("click", () => setFinanceView(button.dataset.financeView));
});
$("#newFinanceEntryBtn").addEventListener("click", () => openFinanceForm());
$("#cancelFinanceBtn").addEventListener("click", closeFinanceForm);
$("#cancelFinanceBtnBottom").addEventListener("click", closeFinanceForm);
$("#financeSearch").addEventListener("input", (event) => renderFinance(event.target.value));
$("#financeMonth").value = localISODate().slice(0, 7);
$("#financeMonth").addEventListener("change", () => renderFinance());
$("#financeStatus").addEventListener("change", () => {
  if ($("#financeStatus").value === "paid" && !$("#financePaidDate").value) {
    $("#financePaidDate").value = localISODate();
  }
  if ($("#financeStatus").value === "pending") $("#financePaidDate").value = "";
});

$("#financeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#financeId").value;
  const description = $("#financeDescription").value.trim();
  const amount = Number($("#financeAmount").value);
  if (!description || !Number.isFinite(amount) || amount <= 0) {
    alert("Informe uma descrição e um valor maior que zero.");
    return;
  }
  const existing = financeEntries.find((entry) => entry.id === id);
  const linkedSale = Boolean(existing?.saleId);
  const clientId = $("#financeClient").value;
  const client = clients.find((item) => item.id === clientId);
  let paidAmount = 0;
  let status = $("#financeStatus").value === "paid" ? "paid" : "pending";
  let paidDate = status === "paid" ? ($("#financePaidDate").value || localISODate()) : "";
  let newPaymentAmount = 0;
  let payments = existing?.payments || [];
  if (linkedSale) {
    newPaymentAmount = Number($("#financePaidAmount").value || 0);
    const alreadyReceived = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (!Number.isFinite(newPaymentAmount) || newPaymentAmount < 0 || alreadyReceived + newPaymentAmount > amount + 0.001) {
      alert("O valor desta parcela não pode ultrapassar o saldo restante da venda.");
      $("#financePaidAmount").focus();
      return;
    }
    newPaymentAmount = Math.round(newPaymentAmount * 100) / 100;
    if (newPaymentAmount > 0) {
      const paymentDate = $("#financePaidDate").value || localISODate();
      payments = [...payments, { amount: newPaymentAmount, date: paymentDate }];
    }
    paidAmount = Math.min(amount, payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    status = paidAmount >= amount ? "paid" : paidAmount > 0 ? "partial" : "pending";
    paidDate = payments.length ? payments[payments.length - 1].date : "";
  }
  const entry = {
    id: id || createId(),
    saleId: existing?.saleId || "",
    type: $("#financeType").value === "expense" ? "expense" : "income",
    description,
    category: $("#financeCategory").value,
    amount: Math.round(amount * 100) / 100,
    paidAmount: linkedSale ? paidAmount : 0,
    payments: linkedSale ? payments : [],
    dueDate: $("#financeDueDate").value,
    status,
    paidDate,
    clientId,
    clientName: client ? client.name : "",
    notes: $("#financeNotes").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const previousEntries = [...financeEntries];
  if (id) financeEntries = financeEntries.map((item) => item.id === id ? entry : item);
  else financeEntries.unshift(entry);
  if (!saveFinanceEntries()) {
    financeEntries = previousEntries;
    return;
  }
  closeFinanceForm();
  renderFinance();
  alert(id ? "Lançamento atualizado com sucesso!" : "Lançamento salvo com sucesso!");
});

$("#financeList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-finance-action]");
  if (!button) return;
  const entry = financeEntries.find((item) => item.id === button.dataset.financeId);
  if (!entry) return;
  const action = button.dataset.financeAction;
  if (action === "edit") {
    openFinanceForm(entry);
    return;
  }
  if (action === "delete") {
    if (entry.saleId) {
      alert("Este lançamento foi gerado para uma oportunidade do Funil. Para removê-lo, vá ao Funil e exclua a oportunidade vinculada. O CRM removerá junto apenas este lançamento se ele estiver pendente e sem pagamentos; se houver recebimentos ou projeto na Produção, a exclusão será bloqueada para preservar o histórico.");
      return;
    }
    if (entry.linkedCommissionId) {
      alert("Este lançamento está vinculado a uma comissão. Acesse Parceiros / Comissões e resolva o vínculo por lá. Se a comissão não aparecer, pode ser um vínculo antigo sem registro correspondente; não exclua o lançamento manualmente antes de conferir o histórico.");
      return;
    }
    const hasPayments = entry.status === "paid" || Number(entry.paidAmount) > 0 ||
      (Array.isArray(entry.payments) && entry.payments.some((payment) => Number(payment.amount) > 0));
    const confirmMessage = hasPayments
      ? `ATENÇÃO: este lançamento possui pagamento/recebimento registrado. Como o CRM está em fase de testes, ele será excluído mesmo assim. Deseja continuar excluindo "${entry.description}"?`
      : `Deseja realmente excluir o lançamento "${entry.description}"?`;
    if (!confirm(confirmMessage)) return;
    const previousEntries = [...financeEntries];
    financeEntries = financeEntries.filter((item) => item.id !== entry.id);
    if (!saveFinanceEntries()) {
      financeEntries = previousEntries;
      return;
    }
    renderFinance();
    return;
  }
  const previousEntries = [...financeEntries];
  financeEntries = financeEntries.map((item) => {
    if (item.id !== entry.id) return item;
    if (action === "mark-paid") return {
      ...item,
      status: "paid",
      paidAmount: item.saleId ? item.amount : item.paidAmount,
      payments: item.saleId
        ? [...(item.payments || []), ...(item.amount > Number(item.paidAmount || 0)
          ? [{ amount: Math.round((item.amount - Number(item.paidAmount || 0)) * 100) / 100, date: localISODate() }]
          : [])]
        : (item.payments || []),
      paidDate: localISODate(),
      updatedAt: new Date().toISOString()
    };
    if (action === "mark-pending") return {
      ...item,
      status: "pending",
      paidAmount: item.saleId ? 0 : item.paidAmount,
      payments: item.saleId ? [] : (item.payments || []),
      paidDate: "",
      updatedAt: new Date().toISOString()
    };
    return item;
  });
  if (!saveFinanceEntries()) {
    financeEntries = previousEntries;
    return;
  }
  renderFinance();
});

/* ---------- Inicialização ---------- */

renderClients();
renderDashboard();
renderQuotes();
updateQuoteCalculations();
renderSales();
renderProduction();


/* ---------- Parceiros e comissões ---------- */
const PARTNERS_STORAGE_KEY = "lr-interiores-parceiros-v1";
const COMMISSIONS_STORAGE_KEY = "lr-interiores-comissoes-v1";
const defaultPartnerRates = { Marceneiro: 20, Arquiteto: 10, Outros: 0 };
const commissionStatusLabels = {
  awaiting_sale: "Aguardando fechamento",
  pending: "Pendente",
  paid: "Paga",
  cancelled: "Cancelada"
};
let partners = loadPartners();
let commissions = loadCommissions();

function loadPartners() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PARTNERS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        ...item,
        category: ["Marceneiro", "Arquiteto", "Outros"].includes(item.category) ? item.category : "Outros",
        rate: Math.min(100, Math.max(0, Number(item.rate) || 0)),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
      }));
  } catch (error) {
    console.error("Não foi possível carregar os parceiros:", error);
    return [];
  }
}

function savePartners() {
  try {
    localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(partners));
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os parceiros:", error);
    alert("Não foi possível preparar os parceiros para sincronização. Confira a conexão com o Firebase e tente novamente.");
    return false;
  }
}

function loadCommissions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMMISSIONS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.partnerId === "string" && typeof item.quoteId === "string")
      .map((item) => ({
        ...item,
        rate: Math.min(100, Math.max(0, Number(item.rate) || 0)),
        basePrice: Math.max(0, Number(item.basePrice) || 0),
        amount: Math.max(0, Number(item.amount) || 0),
        status: ["awaiting_sale", "pending", "paid", "cancelled"].includes(item.status) ? item.status : "awaiting_sale",
        paidAt: item.paidAt || ""
      }));
  } catch (error) {
    console.error("Não foi possível carregar as comissões:", error);
    return [];
  }
}

function saveCommissions() {
  try {
    localStorage.setItem(COMMISSIONS_STORAGE_KEY, JSON.stringify(commissions));
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar as comissões:", error);
    alert("Não foi possível preparar as comissões para sincronização. Confira a conexão com o Firebase e tente novamente.");
    return false;
  }
}

function findCommissionSale(quoteId) {
  return sales.find((sale) => sale.quoteId === quoteId && sale.stage === "won") || null;
}

function refreshCommissionLinks() {
  if (!Array.isArray(commissions) || !Array.isArray(partners)) return;
  let changed = false;
  const now = new Date().toISOString();
  commissions = commissions.map((entry) => {
    if (["paid", "cancelled"].includes(entry.status)) return entry;
    const partner = partners.find((item) => item.id === entry.partnerId);
    const quote = quotes.find((item) => item.id === entry.quoteId);
    if (!partner || !quote) return entry;
    const closedSale = findCommissionSale(quote.id);
    if (closedSale) {
      if (entry.status !== "pending" || entry.saleId !== closedSale.id) {
        changed = true;
        return {
          ...entry,
          partnerName: partner.name,
          quoteName: quote.name,
          clientName: quote.clientName || clients.find((item) => item.id === quote.clientId)?.name || "",
          saleId: closedSale.id,
          rate: partner.rate,
          basePrice: Math.max(0, Number(quote.price) || 0),
          amount: Math.round(Math.max(0, Number(quote.price) || 0) * partner.rate) / 100,
          status: "pending",
          dueAt: now,
          updatedAt: now
        };
      }
      return entry;
    }
    if (entry.status !== "awaiting_sale" || entry.saleId) {
      changed = true;
      return {
        ...entry,
        partnerName: partner.name,
        quoteName: quote.name,
        clientName: quote.clientName || clients.find((item) => item.id === quote.clientId)?.name || "",
        saleId: "",
        rate: partner.rate,
        basePrice: Math.max(0, Number(quote.price) || 0),
        amount: Math.round(Math.max(0, Number(quote.price) || 0) * partner.rate) / 100,
        status: "awaiting_sale",
        dueAt: "",
        updatedAt: now
      };
    }
    const refreshedAmount = Math.round(Math.max(0, Number(quote.price) || 0) * partner.rate) / 100;
    const refreshedClientName = quote.clientName || clients.find((item) => item.id === quote.clientId)?.name || "";
    if (entry.partnerName !== partner.name || entry.quoteName !== quote.name || entry.clientName !== refreshedClientName ||
        entry.rate !== partner.rate || entry.basePrice !== Math.max(0, Number(quote.price) || 0) || entry.amount !== refreshedAmount) {
      changed = true;
      return {
        ...entry,
        partnerName: partner.name,
        quoteName: quote.name,
        clientName: refreshedClientName,
        rate: partner.rate,
        basePrice: Math.max(0, Number(quote.price) || 0),
        amount: refreshedAmount,
        updatedAt: now
      };
    }
    return entry;
  });
  if (changed) saveCommissions();
}

function formatCommissionDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function openPartnerForm(partner = null) {
  const form = $("#partnerForm");
  form.reset();
  $("#partnerId").value = "";
  $("#partnerCategory").value = partner?.category || "Marceneiro";
  $("#partnerRate").value = String(partner ? partner.rate : defaultPartnerRates[$("#partnerCategory").value]);
  $("#partnerFormTitle").textContent = partner ? "Editar parceiro" : "Novo parceiro";
  if (partner) {
    $("#partnerId").value = partner.id;
    $("#partnerName").value = partner.name;
    $("#partnerCategory").value = partner.category;
    $("#partnerRate").value = String(partner.rate);
  }
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#partnerName").focus({ preventScroll: true });
}

function closePartnerForm() {
  $("#partnerForm").hidden = true;
  $("#partnerForm").reset();
  $("#partnerId").value = "";
}

$("#newPartnerBtn").addEventListener("click", () => openPartnerForm());
$("#cancelPartnerBtn").addEventListener("click", closePartnerForm);
$("#cancelPartnerBtnBottom").addEventListener("click", closePartnerForm);
$("#partnerCategory").addEventListener("change", () => {
  $("#partnerRate").value = String(defaultPartnerRates[$("#partnerCategory").value] ?? 0);
});
$("#partnerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#partnerId").value;
  const name = $("#partnerName").value.trim();
  const category = $("#partnerCategory").value;
  const rate = Number($("#partnerRate").value);
  if (!name || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    alert("Informe o nome e um percentual entre 0% e 100%.");
    return;
  }
  const existing = partners.find((item) => item.id === id);
  const previous = [...partners];
  const now = new Date().toISOString();
  const record = {
    id: id || createId(),
    name,
    category,
    rate,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  partners = id ? partners.map((item) => item.id === id ? record : item) : [record, ...partners];
  if (!savePartners()) {
    partners = previous;
    return;
  }
  refreshCommissionLinks();
  closePartnerForm();
  renderPartners();
});

function openCommissionForm() {
  if (!partners.length) {
    alert("Cadastre um parceiro antes de vincular um orçamento.");
    openPartnerForm();
    return;
  }
  if (!quotes.length) {
    alert("Cadastre um orçamento antes de criar uma comissão.");
    navigateTo("orcamentos");
    return;
  }
  $("#commissionForm").reset();
  $("#commissionRatePreview").value = "";
  $("#commissionAmountPreview").value = formatBRL(0);
  $("#commissionQuoteHint").textContent = "A comissão ficará aguardando até que a oportunidade vinculada seja marcada como “Venda concluída”.";
  renderCommissionOptions();
  $("#commissionForm").hidden = false;
  $("#commissionForm").scrollIntoView({ behavior: "smooth", block: "start" });
}
function closeCommissionForm() {
  $("#commissionForm").hidden = true;
  $("#commissionForm").reset();
}
function renderCommissionOptions() {
  const partnerSelect = $("#commissionPartner");
  const quoteSelect = $("#commissionQuote");
  const selectedPartner = partnerSelect.value;
  const selectedQuote = quoteSelect.value;
  partnerSelect.innerHTML = '<option value="">Selecione um parceiro</option>' +
    partners.map((partner) => `<option value="${escapeHTML(partner.id)}">${escapeHTML(partner.name)} — ${escapeHTML(partner.category)} (${partner.rate.toLocaleString("pt-BR")}% )</option>`).join("");
  quoteSelect.innerHTML = '<option value="">Selecione um orçamento</option>' +
    quotes.map((quote) => {
      const client = quote.clientName || clients.find((item) => item.id === quote.clientId)?.name || "Sem cliente";
      return `<option value="${escapeHTML(quote.id)}">${escapeHTML(quote.name)} — ${escapeHTML(client)} · ${formatBRL(quote.price)}</option>`;
    }).join("");
  if (partners.some((item) => item.id === selectedPartner)) partnerSelect.value = selectedPartner;
  if (quotes.some((item) => item.id === selectedQuote)) quoteSelect.value = selectedQuote;
  updateCommissionPreview();
}
function updateCommissionPreview() {
  const partner = partners.find((item) => item.id === $("#commissionPartner").value);
  const quote = quotes.find((item) => item.id === $("#commissionQuote").value);
  const rate = partner ? partner.rate : 0;
  const price = quote ? Math.max(0, Number(quote.price) || 0) : 0;
  $("#commissionRatePreview").value = String(rate);
  $("#commissionAmountPreview").value = formatBRL(Math.round(price * rate) / 100);
  const closedSale = quote ? findCommissionSale(quote.id) : null;
  $("#commissionQuoteHint").textContent = quote
    ? (closedSale
      ? "A venda já está concluída. Ao salvar, a comissão ficará pendente para pagamento."
      : "A comissão ficará aguardando até que a oportunidade vinculada seja marcada como “Venda concluída”.")
    : "Selecione um orçamento para calcular a estimativa.";
}
$("#newCommissionBtn").addEventListener("click", openCommissionForm);
$("#cancelCommissionBtn").addEventListener("click", closeCommissionForm);
$("#cancelCommissionBtnBottom").addEventListener("click", closeCommissionForm);
$("#commissionPartner").addEventListener("change", updateCommissionPreview);
$("#commissionQuote").addEventListener("change", updateCommissionPreview);
$("#commissionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const partner = partners.find((item) => item.id === $("#commissionPartner").value);
  const quote = quotes.find((item) => item.id === $("#commissionQuote").value);
  if (!partner || !quote) {
    alert("Selecione um parceiro e um orçamento válido.");
    return;
  }
  const duplicate = commissions.some((item) => item.partnerId === partner.id && item.quoteId === quote.id);
  if (duplicate) {
    alert("Já existe uma comissão ou vínculo desse parceiro para este orçamento. Não é permitido duplicar.");
    return;
  }
  const now = new Date().toISOString();
  const closedSale = findCommissionSale(quote.id);
  const basePrice = Math.max(0, Number(quote.price) || 0);
  const record = {
    id: createId(),
    partnerId: partner.id,
    partnerName: partner.name,
    quoteId: quote.id,
    quoteName: quote.name,
    clientName: quote.clientName || clients.find((item) => item.id === quote.clientId)?.name || "",
    saleId: closedSale?.id || "",
    rate: partner.rate,
    basePrice,
    amount: Math.round(basePrice * partner.rate) / 100,
    status: closedSale ? "pending" : "awaiting_sale",
    createdAt: now,
    dueAt: closedSale ? now : "",
    paidAt: "",
    updatedAt: now
  };
  commissions = [record, ...commissions];
  if (!saveCommissions()) {
    commissions = commissions.filter((item) => item.id !== record.id);
    return;
  }
  closeCommissionForm();
  renderPartners();
});

function setCommissionStatus(id, status) {
  const entry = commissions.find((item) => item.id === id);
  if (!entry || !["paid", "pending", "cancelled"].includes(status)) return;
  if (entry.status === "cancelled" || entry.status === status) return;
  if (status === "paid" && entry.status !== "pending") {
    alert("Só é possível marcar como paga uma comissão de uma venda concluída.");
    return;
  }
  if (status === "pending" && entry.status !== "paid") return;
  const actionText = status === "paid"
    ? "marcar esta comissão como paga"
    : status === "pending"
      ? "voltar esta comissão para pendente"
      : "cancelar este vínculo de comissão";
  if (!confirm(`Deseja ${actionText} de ${entry.partnerName} no orçamento “${entry.quoteName}”?${status === "pending" ? "\nO lançamento automático correspondente será removido do Financeiro." : ""}`)) return;
  const previous = [...commissions];
  const previousFinance = [...financeEntries];
  commissions = commissions.map((item) => item.id === id
    ? { ...item, status, paidAt: status === "paid" ? new Date().toISOString() : "", updatedAt: new Date().toISOString() }
    : item);
  if (status === "pending") {
    financeEntries = financeEntries.filter((item) => item.linkedCommissionId !== id);
    if (!saveFinanceEntries()) {
      financeEntries = previousFinance;
      commissions = previous;
      return;
    }
  }
  if (!saveCommissions()) {
    commissions = previous;
    financeEntries = previousFinance;
    saveFinanceEntries();
    return;
  }
  if (status === "paid" && !syncPaidCommissionsToFinance()) {
    commissions = previous;
    saveCommissions();
    return;
  }
  renderPartners();
  if (status === "paid" || status === "pending") renderFinance();
}

function deleteCommission(id) {
  const entry = commissions.find((item) => item.id === id);
  if (!entry) return;
  if (entry.status === "paid") {
    alert("Esta comissão já foi paga. Use “Voltar para pendente” antes de excluí-la, para que o lançamento correspondente seja retirado do Financeiro.");
    return;
  }
  if (!confirm(`Deseja excluir o vínculo de ${entry.partnerName} com o orçamento “${entry.quoteName}”? Esta ação não pode ser desfeita.`)) return;
  const previous = [...commissions];
  commissions = commissions.filter((item) => item.id !== id);
  if (!saveCommissions()) {
    commissions = previous;
    return;
  }
  renderPartners();
}

function syncPaidCommissionsToFinance() {
  if (!Array.isArray(commissions) || !Array.isArray(financeEntries)) return true;
  const existingCommissionIds = new Set(
    financeEntries.map((entry) => entry.linkedCommissionId).filter(Boolean)
  );
  const now = new Date().toISOString();
  const missingEntries = commissions
    .filter((commission) => commission.status === "paid" && !existingCommissionIds.has(commission.id))
    .map((commission) => {
      const paidDate = /^\\d{4}-\\d{2}-\\d{2}$/.test((commission.paidAt || "").slice(0, 10))
        ? commission.paidAt.slice(0, 10)
        : localISODate();
      return {
        id: createId(),
        linkedCommissionId: commission.id,
        type: "expense",
        description: `Comissão — ${commission.partnerName || "Parceiro"}`,
        category: "Comissões",
        amount: Math.round(Math.max(0, Number(commission.amount) || 0) * 100) / 100,
        paidAmount: 0,
        payments: [],
        dueDate: paidDate,
        status: "paid",
        paidDate,
        clientId: "",
        clientName: commission.partnerName || "",
        notes: `Comissão paga vinculada ao orçamento “${commission.quoteName || "Sem orçamento"}” (${Number(commission.rate) || 0}%). Lançamento gerado automaticamente pelo módulo Parceiros / Comissões.`,
        createdAt: now,
        updatedAt: now
      };
    });
  if (!missingEntries.length) return true;
  const previousEntries = [...financeEntries];
  financeEntries = [...missingEntries, ...financeEntries];
  if (!saveFinanceEntries()) {
    financeEntries = previousEntries;
    return false;
  }
  return true;
}

function renderPartners() {
  refreshCommissionLinks();
  const awaiting = commissions.filter((item) => item.status === "awaiting_sale");
  const pending = commissions.filter((item) => item.status === "pending");
  const paid = commissions.filter((item) => item.status === "paid");
  $("#commissionAwaitingTotal").textContent = formatBRL(awaiting.reduce((sum, item) => sum + item.amount, 0));
  $("#commissionAwaitingCount").textContent = `${awaiting.length} ${awaiting.length === 1 ? "vínculo" : "vínculos"}`;
  $("#commissionPendingTotal").textContent = formatBRL(pending.reduce((sum, item) => sum + item.amount, 0));
  $("#commissionPendingCount").textContent = `${pending.length} ${pending.length === 1 ? "comissão" : "comissões"}`;
  $("#commissionPaidTotal").textContent = formatBRL(paid.reduce((sum, item) => sum + item.amount, 0));
  $("#commissionPaidCount").textContent = `${paid.length} ${paid.length === 1 ? "comissão" : "comissões"}`;

  const partnerTerm = ($("#partnerSearch").value || "").trim().toLocaleLowerCase("pt-BR");
  const filteredPartners = partners.filter((item) => `${item.name} ${item.category}`.toLocaleLowerCase("pt-BR").includes(partnerTerm));
  $("#partnerCount").textContent = `${filteredPartners.length} ${filteredPartners.length === 1 ? "parceiro" : "parceiros"}`;
  $("#partnerList").innerHTML = filteredPartners.length ? filteredPartners.map((partner) => {
    const partnerCommissions = commissions.filter((item) => item.partnerId === partner.id);
    const pendingAmount = partnerCommissions.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
    return `<article class="partner-row">
      <div class="partner-avatar">${escapeHTML(partner.name.slice(0, 2).toLocaleUpperCase("pt-BR"))}</div>
      <div class="partner-info"><strong>${escapeHTML(partner.name)}</strong><span>${escapeHTML(partner.category)} · ${partner.rate.toLocaleString("pt-BR")}% de comissão</span><small>${partnerCommissions.length} ${partnerCommissions.length === 1 ? "orçamento vinculado" : "orçamentos vinculados"} · ${formatBRL(pendingAmount)} pendentes</small></div>
      <div class="partner-actions"><button class="icon-button" data-partner-edit="${escapeHTML(partner.id)}">Editar</button><button class="icon-button delete" data-partner-delete="${escapeHTML(partner.id)}">Excluir</button></div>
    </article>`;
  }).join("") : '<div class="list-empty">Nenhum parceiro cadastrado. Clique em “+ Novo parceiro” para começar.</div>';

  const term = ($("#commissionSearch").value || "").trim().toLocaleLowerCase("pt-BR");
  const filteredCommissions = commissions.filter((item) =>
    `${item.partnerName} ${item.quoteName} ${item.clientName} ${commissionStatusLabels[item.status]}`.toLocaleLowerCase("pt-BR").includes(term)
  ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  $("#commissionCount").textContent = filteredCommissions.length
    ? `${filteredCommissions.length} ${filteredCommissions.length === 1 ? "comissão/vínculo" : "comissões/vínculos"}`
    : "Nenhuma comissão cadastrada";
  $("#commissionList").innerHTML = filteredCommissions.length ? filteredCommissions.map((item) => {
    const statusClass = item.status.replace("_", "-");
    const actions = item.status === "pending"
      ? `<button class="button button-primary" data-commission-action="paid" data-commission-id="${escapeHTML(item.id)}">Marcar como paga</button><button class="button button-outline" data-commission-action="cancelled" data-commission-id="${escapeHTML(item.id)}">Cancelar</button><button class="button button-outline" data-commission-delete="${escapeHTML(item.id)}">Excluir vínculo</button>`
      : (item.status === "awaiting_sale"
        ? `<button class="button button-outline" data-commission-action="cancelled" data-commission-id="${escapeHTML(item.id)}">Cancelar vínculo</button><button class="button button-outline" data-commission-delete="${escapeHTML(item.id)}">Excluir vínculo</button>`
        : (item.status === "paid"
          ? `<button class="button button-outline" data-commission-action="pending" data-commission-id="${escapeHTML(item.id)}">Voltar para pendente</button>`
          : `<button class="button button-outline" data-commission-delete="${escapeHTML(item.id)}">Excluir vínculo</button>`));
    return `<article class="commission-row">
      <div class="commission-main"><div class="commission-top"><strong>${escapeHTML(item.partnerName || "Parceiro")}</strong><span class="commission-status ${statusClass}">${escapeHTML(commissionStatusLabels[item.status] || item.status)}</span></div>
      <p>${escapeHTML(item.quoteName || "Orçamento")} · ${escapeHTML(item.clientName || "Sem cliente vinculado")}</p>
      <div class="commission-values"><span><small>Preço de venda</small><strong>${formatBRL(item.basePrice)}</strong></span><span><small>Percentual</small><strong>${item.rate.toLocaleString("pt-BR")}%</strong></span><span><small>Comissão</small><strong>${formatBRL(item.amount)}</strong></span></div>
      <small class="commission-date">${item.status === "paid" ? "Paga em " + formatCommissionDate(item.paidAt) : item.status === "pending" ? "Devida desde " + formatCommissionDate(item.dueAt) : "Criada em " + formatCommissionDate(item.createdAt)}</small></div>
      <div class="commission-actions">${actions}</div>
    </article>`;
  }).join("") : '<div class="list-empty">Nenhuma comissão ou vínculo encontrado. Use “+ Vincular orçamento” para associar um parceiro a um orçamento existente.</div>';
}

$("#partnerSearch").addEventListener("input", () => renderPartners());
$("#commissionSearch").addEventListener("input", () => renderPartners());
$("#partnerList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-partner-edit]");
  const deleteButton = event.target.closest("[data-partner-delete]");
  if (editButton) {
    const partner = partners.find((item) => item.id === editButton.dataset.partnerEdit);
    if (partner) openPartnerForm(partner);
    return;
  }
  if (deleteButton) {
    const partner = partners.find((item) => item.id === deleteButton.dataset.partnerDelete);
    if (!partner) return;
    if (commissions.some((item) => item.partnerId === partner.id)) {
      alert("Este parceiro possui orçamentos vinculados ou comissões no histórico. Para preservar o histórico, não é possível excluí-lo.");
      return;
    }
    if (!confirm(`Deseja excluir o parceiro “${partner.name}”?`)) return;
    const previous = [...partners];
    partners = partners.filter((item) => item.id !== partner.id);
    if (!savePartners()) {
      partners = previous;
      return;
    }
    renderPartners();
  }
});
$("#commissionList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-commission-action], [data-commission-delete]");
  if (!button) return;
  if (button.hasAttribute("data-commission-delete")) {
    deleteCommission(button.dataset.commissionDelete);
    return;
  }
  setCommissionStatus(button.dataset.commissionId, button.dataset.commissionAction);
});


/* ---------- Cadastro de equipe ---------- */
const TEAM_STORAGE_KEY = "lr-interiores-equipe-v1";
let teamMembers = loadTeamMembers();

function loadTeamMembers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        role: typeof item.role === "string" ? item.role : "",
        paymentMode: ["Diário", "Mensal", "Outro"].includes(item.paymentMode) ? item.paymentMode : "Diário",
        amount: Math.max(0, Number(item.amount) || 0),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
      }));
  } catch (error) {
    console.error("Não foi possível carregar a equipe:", error);
    return [];
  }
}

function saveTeamMembers() {
  try {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teamMembers));
    refreshDashboardAfterSave();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar a equipe:", error);
    alert("Não foi possível preparar o cadastro da equipe para sincronização. Confira a conexão com o Firebase e tente novamente.");
    return false;
  }
}

function updateTeamPaymentFields() {
  const mode = $("#teamPaymentMode").value;
  const isDaily = mode === "Diário";
  $("#teamAmountLabel").textContent = isDaily ? "Valor da diária (R$) *" : mode === "Mensal" ? "Valor mensal (R$) *" : "Valor por pagamento (R$) *";
  $("#teamAmount").placeholder = isDaily ? "Ex.: 150,00 por dia" : mode === "Mensal" ? "Ex.: 2.500,00 por mês" : "Ex.: 300,00 por pagamento";
  $("#teamPaymentHint").textContent = isDaily
    ? "Informe o valor de um dia trabalhado. A quantidade de dias será preenchida ao registrar cada pagamento no Financeiro."
    : mode === "Mensal"
      ? "Informe o valor fixo mensal. No pagamento mensal, o CRM não solicitará a quantidade de dias."
      : "Informe o valor padrão de cada pagamento. Não será necessário informar a quantidade de dias.";
}

function openTeamMemberForm(member = null) {
  const form = $("#teamForm");
  form.reset();
  $("#teamMemberId").value = "";
  $("#teamPaymentMode").value = member?.paymentMode || "Diário";
  $("#teamFormTitle").textContent = member ? "Editar pessoa da equipe" : "Nova pessoa da equipe";
  if (member) {
    $("#teamMemberId").value = member.id;
    $("#teamMemberName").value = member.name || "";
    $("#teamMemberRole").value = member.role || "";
    $("#teamPaymentMode").value = member.paymentMode;
    $("#teamAmount").value = String(member.amount);
  }
    updateTeamPaymentFields();

  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#teamMemberName").focus({ preventScroll: true });
}

function closeTeamMemberForm() {
  $("#teamForm").hidden = true;
  $("#teamForm").reset();
  $("#teamMemberId").value = "";
  updateTeamPaymentFields();
}

function updateTeamPaymentPreview() {
  const memberId = $("#teamPaymentMemberId").value;
  const member = teamMembers.find((item) => item.id === memberId);
  if (!member) {
    $("#teamPaymentCalculated").value = "";
    return;
  }
  if (member.paymentMode !== "Diário") {
    $("#teamPaymentCalculated").value = member.amount.toFixed(2);
    $("#teamPaymentCalculationHint").textContent = member.paymentMode === "Mensal"
      ? `Pagamento mensal de ${formatBRL(member.amount)} para ${member.name}.`
      : `Pagamento de ${formatBRL(member.amount)} para ${member.name}, conforme o modo “Outro”.`;
    return;
  }
  const days = Number($("#teamPaymentDays").value);
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    $("#teamPaymentCalculated").value = "";
    $("#teamPaymentCalculationHint").textContent = `Valor da diária: ${formatBRL(member.amount)}. Informe de 1 a 366 dias trabalhados.`;
    return;
  }
  const total = Math.round(member.amount * days * 100) / 100;
  $("#teamPaymentCalculated").value = total.toFixed(2);
  $("#teamPaymentCalculationHint").textContent = `${days} dia(s) × ${formatBRL(member.amount)} = ${formatBRL(total)}.`;
}

function openTeamPaymentForm(member) {
  if (!member) return;
  closeTeamMemberForm();
  const form = $("#teamPaymentForm");
  form.reset();
  $("#teamPaymentMemberId").value = member.id;
  $("#teamPaymentFormTitle").textContent = `Pagamento — ${member.name}`;
  $("#teamPaymentDate").value = localISODate();
  const isDaily = member.paymentMode === "Diário";
  $("#teamPaymentDaysField").hidden = !isDaily;
  $("#teamPaymentDays").required = isDaily;
  $("#teamPaymentDays").disabled = !isDaily;
  $("#teamPaymentDays").value = "";
  $("#teamPaymentCalculated").value = "";
  form.hidden = false;
  updateTeamPaymentPreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  if (isDaily) $("#teamPaymentDays").focus({ preventScroll: true });
  else $("#teamPaymentDate").focus({ preventScroll: true });
}

function closeTeamPaymentForm() {
  const form = $("#teamPaymentForm");
  form.hidden = true;
  form.reset();
  $("#teamPaymentMemberId").value = "";
  $("#teamPaymentDaysField").hidden = false;
  $("#teamPaymentDays").required = false;
  $("#teamPaymentDays").disabled = false;
  $("#teamPaymentCalculated").value = "";
}

function renderTeamMembers() {
  const term = ($("#teamSearch").value || "").trim().toLocaleLowerCase("pt-BR");
  const filtered = teamMembers.filter((member) =>
    `${member.name} ${member.role}`.toLocaleLowerCase("pt-BR").includes(term)
  );
  $("#teamMemberCount").textContent = `${filtered.length} ${filtered.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}`;
  $("#teamMemberList").innerHTML = filtered.length ? filtered.map((member) => {
    const modeLabel = member.paymentMode === "Diário" ? "Diária" : member.paymentMode === "Mensal" ? "Mensal" : "Outro";
    const amountLabel = member.paymentMode === "Diário" ? "Valor por dia" : member.paymentMode === "Mensal" ? "Valor mensal" : "Valor por pagamento";
    return `<article class="team-row">
      <div class="team-avatar">${escapeHTML(member.name.slice(0, 2).toLocaleUpperCase("pt-BR"))}</div>
      <div class="team-info"><strong>${escapeHTML(member.name)}</strong><span>${escapeHTML(member.role)}</span>
        <small>${modeLabel} • ${amountLabel}: ${formatBRL(member.amount)}</small></div>
      <div class="team-actions">
        <button type="button" class="button button-primary" data-team-pay="${escapeHTML(member.id)}">Registrar pagamento</button>
        <button type="button" class="button button-outline" data-team-edit="${escapeHTML(member.id)}">Editar</button>
        <button type="button" class="button button-danger" data-team-delete="${escapeHTML(member.id)}">Excluir</button>
      </div>
    </article>`;
  }).join("") : '<div class="list-empty">Nenhuma pessoa cadastrada. Clique em “+ Nova pessoa” para começar.</div>';
}

$("#newTeamMemberBtn").addEventListener("click", () => openTeamMemberForm());
$("#cancelTeamBtn").addEventListener("click", closeTeamMemberForm);
$("#cancelTeamBtnBottom").addEventListener("click", closeTeamMemberForm);
$("#teamPaymentMode").addEventListener("change", updateTeamPaymentFields);
$("#teamSearch").addEventListener("input", renderTeamMembers);
$("#teamPaymentDays").addEventListener("input", updateTeamPaymentPreview);
$("#cancelTeamPaymentBtn").addEventListener("click", closeTeamPaymentForm);
$("#cancelTeamPaymentBtnBottom").addEventListener("click", closeTeamPaymentForm);

$("#teamPaymentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const member = teamMembers.find((item) => item.id === $("#teamPaymentMemberId").value);
  if (!member) {
    alert("Não foi possível localizar a pessoa da equipe. Feche o formulário e tente novamente.");
    return;
  }
  const paymentDate = $("#teamPaymentDate").value;
  const isDaily = member.paymentMode === "Diário";
  const days = isDaily ? Number($("#teamPaymentDays").value) : null;
  if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    alert("Informe uma data válida para o pagamento.");
    $("#teamPaymentDate").focus();
    return;
  }
  if (isDaily && (!Number.isInteger(days) || days < 1 || days > 366)) {
    alert("Informe a quantidade de dias trabalhados (de 1 a 366).");
    $("#teamPaymentDays").focus();
    return;
  }
  const amount = Math.round(member.amount * (isDaily ? days : 1) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("O valor calculado do pagamento precisa ser maior que zero.");
    return;
  }
  const now = new Date().toISOString();
  const paymentEntry = {
    id: createId(),
    type: "expense",
    description: `Pagamento de equipe — ${member.name}`,
    category: "Mão de obra",
    amount,
    paidAmount: 0,
    payments: [],
    dueDate: paymentDate,
    status: "paid",
    paidDate: paymentDate,
    clientId: "",
    clientName: "",
    notes: `Pessoa: ${member.name} · Função: ${member.role} · Modalidade: ${member.paymentMode}${isDaily ? ` · Dias trabalhados: ${days} · Diária: ${formatBRL(member.amount)}` : ""}`,
    teamMemberId: member.id,
    teamMemberName: member.name,
    teamPaymentMode: member.paymentMode,
    teamPaymentDays: isDaily ? days : null,
    teamDailyRate: isDaily ? member.amount : null,
    createdAt: now,
    updatedAt: now
  };
  const previousEntries = [...financeEntries];
  financeEntries.unshift(paymentEntry);
  if (!saveFinanceEntries()) {
    financeEntries = previousEntries;
    return;
  }
  closeTeamPaymentForm();
  renderTeamMembers();
  renderFinance();
  alert(`Pagamento de ${formatBRL(amount)} registrado no Financeiro para ${member.name}.`);
});

$("#teamForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#teamMemberId").value;
  const name = $("#teamMemberName").value.trim();
  const role = $("#teamMemberRole").value.trim();
  const paymentMode = $("#teamPaymentMode").value;
  const amount = Number($("#teamAmount").value);
  if (!name || !role || !["Diário", "Mensal", "Outro"].includes(paymentMode) || !Number.isFinite(amount) || amount <= 0) {
    alert("Preencha o nome, a função, o modo de recebimento e um valor maior que zero.");
    return;
  }
  const existing = teamMembers.find((item) => item.id === id);
  const previous = [...teamMembers];
  const now = new Date().toISOString();
  const record = { id: id || createId(), name, role, paymentMode, amount: Math.round(amount * 100) / 100,
    createdAt: existing?.createdAt || now, updatedAt: now };
  teamMembers = id ? teamMembers.map((item) => item.id === id ? record : item) : [record, ...teamMembers];
  if (!saveTeamMembers()) { teamMembers = previous; return; }
  closeTeamMemberForm();
  renderTeamMembers();
});

$("#teamMemberList").addEventListener("click", (event) => {
  const payButton = event.target.closest("[data-team-pay]");
  const editButton = event.target.closest("[data-team-edit]");
  const deleteButton = event.target.closest("[data-team-delete]");
  if (payButton) {
    const member = teamMembers.find((item) => item.id === payButton.dataset.teamPay);
    if (member) openTeamPaymentForm(member);
    return;
  }
  if (editButton) {
    const member = teamMembers.find((item) => item.id === editButton.dataset.teamEdit);
    if (member) openTeamMemberForm(member);
    return;
  }
  if (deleteButton) {
    const member = teamMembers.find((item) => item.id === deleteButton.dataset.teamDelete);
    if (!member) return;
    if (!confirm(`Deseja excluir o cadastro de “${member.name}”?`)) return;
    const previous = [...teamMembers];
    teamMembers = teamMembers.filter((item) => item.id !== member.id);
    if (!saveTeamMembers()) { teamMembers = previous; return; }
    renderTeamMembers();
  }
});

updateTeamPaymentFields();
// Renderiza o painel inicial assim que o CRM termina de carregar após o desbloqueio.
renderDashboard();

// Cadastro rápido de cliente dentro do formulário de orçamento.
const quoteClientDialog = $("#quoteClientDialog");
const quoteQuickClientForm = $("#quoteQuickClientForm");

function closeQuoteClientDialog() {
  if (quoteClientDialog.open) quoteClientDialog.close();
  quoteQuickClientForm.reset();
  $("#quoteQuickClientStatus").textContent = "";
}

$("#newClientFromQuoteBtn").addEventListener("click", () => {
  quoteQuickClientForm.reset();
  $("#quoteQuickClientStatus").textContent = "";
  quoteClientDialog.showModal();
  $("#quoteQuickClientName").focus();
});

$("#closeQuoteClientDialogBtn").addEventListener("click", closeQuoteClientDialog);
$("#cancelQuoteClientDialogBtn").addEventListener("click", closeQuoteClientDialog);

quoteQuickClientForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("#quoteQuickClientName").value.trim();
  const phone = $("#quoteQuickClientPhone").value.trim();
  const email = $("#quoteQuickClientEmail").value.trim();
  const source = $("#quoteQuickClientSource").value;
  const address = $("#quoteQuickClientAddress").value.trim();

  if (!name || !phone) {
    $("#quoteQuickClientStatus").textContent = "Preencha o nome e o telefone do cliente.";
    return;
  }

  const normalizePhone = (value) => value.replace(/\D/g, "");
  const normalizedPhone = normalizePhone(phone);
  const existingClient = clients.find((client) =>
    normalizedPhone && normalizePhone(client.phone || "") === normalizedPhone
  );

  if (existingClient) {
    const reuse = confirm(
      "Já existe um cliente chamado \"" + existingClient.name +
      "\" com esse telefone. Deseja usar o cadastro existente neste orçamento?"
    );
    if (!reuse) return;
    renderClientOptions(existingClient.id);
    closeQuoteClientDialog();
    $("#quoteClient").focus();
    return;
  }

  const previousClients = [...clients];
  const now = new Date().toISOString();
  const clientData = {
    id: createId(),
    name,
    phone,
    email,
    source,
    address,
    notes: "",
    createdAt: now,
    updatedAt: now
  };

  clients.unshift(clientData);
  if (!saveClients()) {
    clients = previousClients;
    return;
  }

  renderClientOptions(clientData.id);
  renderDashboard();
  closeQuoteClientDialog();
  $("#quoteClient").focus();
});
// Mantém o painel atualizado ao retornar à aba e faz uma verificação leve enquanto ele estiver aberto.
// Não consulta o Firebase em intervalos: apenas redesenha os dados já carregados em memória.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && $("#page-dashboard")?.classList.contains("active")) {
    renderDashboard();
  }
});

window.addEventListener("focus", () => {
  if ($("#page-dashboard")?.classList.contains("active")) renderDashboard();
});

window.setInterval(() => {
  if (!document.hidden && $("#page-dashboard")?.classList.contains("active")) {
    renderDashboard();
  }
}, 30000);

