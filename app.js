// =====================================================================
//  DUNORTE • Sistema de Pedidos e Rotas PRO
//  app.js – versão com:
//   • cadastros ilimitados (IndexedDB como storage principal)
//   • cards verdes para ENTREGUE
//   • checkboxes de destaque (marca-texto) por campo
//   • observações em vermelho na impressão
//   • data do pedido com default hoje
//   • modal de relatório com filtros e geração de PDF via print
// =====================================================================

// ─── IndexedDB helpers ──────────────────────────────────────────────
const DB_NAME = "dunorte_db";
const DB_VER  = 1;
const STORE   = "pedidos";

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => { reject(e.target.error); };
  });
}

async function dbGetAll() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function dbPut(pedido) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(pedido);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function dbClear() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Migração do localStorage antigo ────────────────────────────────
async function migrarLocalStorage() {
  const OLD_KEY = "dunorte_rotas_pro_v1";
  const raw = localStorage.getItem(OLD_KEY);
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return;
    const existing = await dbGetAll();
    if (existing.length > 0) return; // já migrou
    for (const p of arr) await dbPut(p);
    localStorage.removeItem(OLD_KEY);
    console.log(`Migração: ${arr.length} pedido(s) movido(s) para IndexedDB.`);
  } catch (err) {
    console.warn("Migração falhou:", err);
  }
}

// ─── Cache em memória (para operações de reordenação e filtro rápido) ─
let _pedidosCache = null;

async function getPedidos() {
  if (_pedidosCache !== null) return _pedidosCache;
  _pedidosCache = await dbGetAll();
  // Manter ordem: se tiverem campo "ordem", ordenar por ele
  _pedidosCache.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return _pedidosCache;
}

async function savePedido(pedido) {
  _pedidosCache = null;
  await dbPut(pedido);
}

async function deletePedido(id) {
  _pedidosCache = null;
  await dbDelete(id);
}

async function saveAllPedidos(arr) {
  _pedidosCache = null;
  // Reordenar: adicionar campo ordem
  arr.forEach((p, i) => { p.ordem = i; });
  await dbClear();
  for (const p of arr) await dbPut(p);
}

// ─── Auth ────────────────────────────────────────────────────────────
const AUTH_KEY    = "dunorte_rotas_auth_v1";
const DEFAULT_USER = { username: "admin", password: "1234" };
function getAuthData() { return JSON.parse(localStorage.getItem(AUTH_KEY) || JSON.stringify(DEFAULT_USER)); }
function isLogged()    { return sessionStorage.getItem("dunorte_logged") === "1"; }
function setLogged(v)  { if (v) sessionStorage.setItem("dunorte_logged","1"); else sessionStorage.removeItem("dunorte_logged"); }

// ─── DOM refs ────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const refs = {
  loginScreen: $("loginScreen"), dashboardScreen: $("dashboardScreen"),
  loginForm: $("loginForm"), loginUser: $("loginUser"), loginPass: $("loginPass"),
  btnLogout: $("btnLogout"),
  pedidoForm: $("pedidoForm"), pedidoId: $("pedidoId"),
  dataPedido: $("dataPedido"),
  loja: $("loja"), status: $("status"),
  numeroPedido: $("numeroPedido"), nomeCliente: $("nomeCliente"),
  cidade: $("cidade"), bairro: $("bairro"), endereco: $("endereco"), mapsShareLink: $("mapsShareLink"),
  retiradaLojaAtiva: $("retiradaLojaAtiva"), retiradaLojaLocal: $("retiradaLojaLocal"), retiradaLojaSelectWrap: $("retiradaLojaSelectWrap"),
  listaContatos: $("listaContatos"), listaItens: $("listaItens"),
  valorTotal: $("valorTotal"), valorEntrada: $("valorEntrada"), valorReceber: $("valorReceber"),
  formaReceber: $("formaReceber"), bancoOuObsPagamento: $("bancoOuObsPagamento"),
  parcelamento: $("parcelamento"),
  blocoFormaReceber: $("blocoFormaReceber"), blocoBancoOuDetalhe: $("blocoBancoOuDetalhe"),
  blocoParcelamento: $("blocoParcelamento"),
  observacoes: $("observacoes"),
  formTitle: $("formTitle"), editingBadge: $("editingBadge"), btnCancelarEdicao: $("btnCancelarEdicao"),
  btnAddContato: $("btnAddContato"), btnAddItem: $("btnAddItem"),
  btnNovoPedido: $("btnNovoPedido"), btnExportar: $("btnExportar"), inputImportar: $("inputImportar"),
  btnRelatorio: $("btnRelatorio"),
  busca: $("busca"), filtroStatus: $("filtroStatus"), filtroLoja: $("filtroLoja"),
  dataRota: $("dataRota"), btnRotaWhatsapp: $("btnRotaWhatsapp"), btnImprimirRota: $("btnImprimirRota"),
  statsBar: $("statsBar"), listaPedidos: $("listaPedidos"),
  pedidoModal: $("pedidoModal"), pedidoModalBackdrop: $("pedidoModalBackdrop"),
  fecharPedidoModal: $("fecharPedidoModal"), pedidoModalConteudo: $("pedidoModalConteudo"),
  relatorioModal: $("relatorioModal"), relatorioModalBackdrop: $("relatorioModalBackdrop"),
  fecharRelatorioModal: $("fecharRelatorioModal"),
  relDataInicio: $("relDataInicio"), relDataFim: $("relDataFim"),
  relValorMin: $("relValorMin"), relValorMax: $("relValorMax"),
  relCidade: $("relCidade"), relStatusFiltro: $("relStatusFiltro"), relLoja: $("relLoja"),
  relOrdem: $("relOrdem"), relPreviewInfo: $("relPreviewInfo"),
  btnGerarRelatorio: $("btnGerarRelatorio"), btnPreviewRelatorio: $("btnPreviewRelatorio")
};

let fotosAtuais = [];

// ─── Highlights (campos marcados para impressão) ─────────────────────
// Armazena quais campos estão marcados para destaque
let camposDestacados = {};

function initHighlightCheckboxes() {
  document.querySelectorAll(".highlight-cb").forEach(cb => {
    const targetId = cb.dataset.target;
    cb.checked = camposDestacados[targetId] || false;
    updateFieldHighlight(targetId, cb.checked);
    cb.addEventListener("change", () => {
      camposDestacados[targetId] = cb.checked;
      updateFieldHighlight(targetId, cb.checked);
    });
  });
}

function updateFieldHighlight(targetId, active) {
  const el = $(targetId);
  if (!el) return;
  if (active) el.classList.add("field-highlighted");
  else el.classList.remove("field-highlighted");
}

function resetHighlights() {
  camposDestacados = {};
  document.querySelectorAll(".highlight-cb").forEach(cb => {
    cb.checked = false;
    updateFieldHighlight(cb.dataset.target, false);
  });
}

function setHighlightsFromPedido(pedido) {
  camposDestacados = { ...(pedido.camposDestacados || {}) };
  document.querySelectorAll(".highlight-cb").forEach(cb => {
    const val = camposDestacados[cb.dataset.target] || false;
    cb.checked = val;
    updateFieldHighlight(cb.dataset.target, val);
  });
}

// ─── Auth events ─────────────────────────────────────────────────────
refs.loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const auth = getAuthData();
  if (refs.loginUser.value.trim() === auth.username && refs.loginPass.value.trim() === auth.password) {
    setLogged(true); refs.loginForm.reset(); showDashboard();
  } else alert("Usuário ou senha incorretos.");
});
refs.btnLogout.addEventListener("click", () => { setLogged(false); showLogin(); });

function showDashboard() { refs.loginScreen.classList.add("hidden"); refs.dashboardScreen.classList.remove("hidden"); renderAll(); }
function showLogin()     { refs.dashboardScreen.classList.add("hidden"); refs.loginScreen.classList.remove("hidden"); }

// ─── Utils ────────────────────────────────────────────────────────────
function uid()          { return "p_" + Date.now() + "_" + Math.floor(Math.random() * 1e6); }
function escapeHtml(s)  { return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
function parseMoney(v)  { if (!v) return 0; return Number(String(v).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"")) || 0; }
function formatMoney(v) { return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function formatDateBR(iso) {
  if (!iso) return "-";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function todayISO() { return new Date().toISOString().slice(0,10); }

// ─── Contatos e Itens ─────────────────────────────────────────────────
function addContato(valor = "") {
  const tpl = $("tplContato").content.firstElementChild.cloneNode(true);
  tpl.querySelector(".contato-input").value = valor;
  tpl.querySelector(".remove-btn").addEventListener("click", () => tpl.remove());
  refs.listaContatos.appendChild(tpl);
}
function addItem(item = null) {
  const tpl = $("tplItem").content.firstElementChild.cloneNode(true);
  if (item) {
    tpl.querySelector(".item-qtd").value  = item.quantidade || 1;
    tpl.querySelector(".item-nome").value = item.nome || "";
    tpl.querySelector(".item-desc").value = item.descricao || "";
    tpl.querySelector(".item-destaque").checked = !!item.destacarNaImpressao;
  }
  tpl.querySelector(".remove-btn").addEventListener("click", () => tpl.remove());
  refs.listaItens.appendChild(tpl);
}
function clearRepeats() { refs.listaContatos.innerHTML = ""; refs.listaItens.innerHTML = ""; }

// ─── Máscaras monetárias ──────────────────────────────────────────────
function maskMoneyInput(e) {
  const digits = e.target.value.replace(/\D/g,"");
  const value = Number(digits)/100;
  e.target.value = value.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
}
refs.valorTotal.addEventListener("input", maskMoneyInput);
refs.valorEntrada.addEventListener("input", maskMoneyInput);
refs.valorTotal.addEventListener("input", updateReceber);
refs.valorEntrada.addEventListener("input", updateReceber);

function updateReceber() {
  const receber = Math.max(parseMoney(refs.valorTotal.value) - parseMoney(refs.valorEntrada.value), 0);
  refs.valorReceber.value = receber.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  refs.blocoFormaReceber.classList.toggle("hidden", receber <= 0);
  if (receber <= 0) {
    refs.formaReceber.value = ""; refs.bancoOuObsPagamento.value = ""; refs.parcelamento.value = "";
    refs.blocoBancoOuDetalhe.classList.add("hidden"); refs.blocoParcelamento.classList.add("hidden");
  }
}
refs.formaReceber.addEventListener("change", updatePayFields);
function updatePayFields() {
  const tipo = refs.formaReceber.value;
  const needsBank   = ["TRANSFERENCIA","PIX"].includes(tipo);
  const needsDetail = ["CARTAO","CHEQUE","CREDIARIO"].includes(tipo);
  refs.blocoBancoOuDetalhe.classList.toggle("hidden", !(needsBank || needsDetail));
  refs.blocoParcelamento.classList.toggle("hidden", !needsDetail);
  const label = refs.blocoBancoOuDetalhe.querySelector("label");
  if (needsBank)   { label.textContent = "Banco / detalhe"; refs.bancoOuObsPagamento.placeholder = "Ex.: Sicredi, Nubank, Caixa..."; }
  else if (needsDetail) { label.textContent = "Detalhe"; refs.bancoOuObsPagamento.placeholder = "Observação opcional"; }
}

refs.btnAddContato.addEventListener("click", () => addContato());
refs.btnAddItem.addEventListener("click", () => addItem());
refs.btnNovoPedido.addEventListener("click", resetForm);
refs.btnCancelarEdicao.addEventListener("click", resetForm);
refs.retiradaLojaAtiva?.addEventListener("change", () => {
  refs.retiradaLojaSelectWrap.classList.toggle("hidden", !refs.retiradaLojaAtiva.checked);
  if (!refs.retiradaLojaAtiva.checked) refs.retiradaLojaLocal.value = "";
});

// ─── Fotos (removido do cadastro) ────────────────────────────────────────
function renderPhotoPreview() {}

// ─── Coleta do formulário ─────────────────────────────────────────────
async function collectForm() {
  const contatos = [...refs.listaContatos.querySelectorAll(".contato-input")].map(i => i.value.trim()).filter(Boolean);
  const itens    = [...refs.listaItens.querySelectorAll(".item-card")].map(card => ({
    quantidade: Math.max(1, Number(card.querySelector(".item-qtd").value) || 1),
    nome:       card.querySelector(".item-nome").value.trim(),
    descricao:  card.querySelector(".item-desc").value.trim(),
    destacarNaImpressao: !!card.querySelector(".item-destaque")?.checked
  })).filter(item => item.nome);
  if (!itens.length) { alert("Adicione pelo menos um item."); return null; }
  const todos    = await getPedidos();
  const original = todos.find(p => p.id === refs.pedidoId.value);
  return {
    id:                original?.id || uid(),
    ordem:             original?.ordem ?? Date.now(),
    dataPedido:        refs.dataPedido.value || todayISO(),
    loja:              refs.loja.value,
    status:            refs.status.value,
    numeroPedido:      refs.numeroPedido.value.trim(),
    nomeCliente:       refs.nomeCliente.value.trim(),
    cidade:            refs.cidade.value.trim(),
    bairro:            refs.bairro.value.trim(),
    endereco:          refs.endereco.value.trim(),
    mapsShareLink:     refs.mapsShareLink?.value.trim() || "",
    retiradaLojaAtiva: !!refs.retiradaLojaAtiva.checked,
    retiradaLojaLocal: refs.retiradaLojaAtiva.checked ? refs.retiradaLojaLocal.value : "",
    contatos, itens, fotos: original?.fotos || [],
    valorTotal:        parseMoney(refs.valorTotal.value),
    valorEntrada:      parseMoney(refs.valorEntrada.value),
    valorReceber:      parseMoney(refs.valorReceber.value),
    formaReceber:      refs.formaReceber.value,
    bancoOuObsPagamento: refs.bancoOuObsPagamento.value.trim(),
    parcelamento:      refs.parcelamento.value,
    observacoes:       refs.observacoes.value.trim(),
    camposDestacados:  { ...camposDestacados },
    criadoEm:          original?.criadoEm || new Date().toISOString(),
    atualizadoEm:      new Date().toISOString()
  };
}

refs.pedidoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pedido = await collectForm();
  if (!pedido) return;
  await savePedido(pedido);
  resetForm();
  await renderAll();
});

// ─── Reset / Fill form ────────────────────────────────────────────────
function resetForm() {
  refs.pedidoForm.reset();
  refs.pedidoId.value = "";
  refs.dataPedido.value = todayISO();
  refs.formTitle.textContent = "Novo pedido";
  refs.editingBadge.classList.add("hidden");
  refs.btnCancelarEdicao.classList.add("hidden");
  clearRepeats(); addContato(); addItem();
  refs.valorReceber.value = "";
  refs.blocoFormaReceber.classList.add("hidden");
  refs.blocoBancoOuDetalhe.classList.add("hidden");
  refs.blocoParcelamento.classList.add("hidden");
  if (refs.retiradaLojaAtiva) refs.retiradaLojaAtiva.checked = false;
  if (refs.retiradaLojaLocal) refs.retiradaLojaLocal.value = "";
  if (refs.mapsShareLink) refs.mapsShareLink.value = "";
  if (refs.retiradaLojaSelectWrap) refs.retiradaLojaSelectWrap.classList.add("hidden");
  resetHighlights();
}

function fillForm(pedido) {
  refs.pedidoId.value        = pedido.id;
  refs.dataPedido.value      = pedido.dataPedido || todayISO();
  refs.loja.value            = pedido.loja || "";
  refs.status.value          = pedido.status || "AGUARDANDO";
  refs.numeroPedido.value    = pedido.numeroPedido || "";
  refs.nomeCliente.value     = pedido.nomeCliente || "";
  refs.cidade.value          = pedido.cidade || "";
  refs.bairro.value          = pedido.bairro || "";
  refs.endereco.value        = pedido.endereco || "";
  if (refs.mapsShareLink) refs.mapsShareLink.value = pedido.mapsShareLink || "";
  if (refs.retiradaLojaAtiva) refs.retiradaLojaAtiva.checked = !!pedido.retiradaLojaAtiva;
  if (refs.retiradaLojaLocal) refs.retiradaLojaLocal.value = pedido.retiradaLojaLocal || "";
  if (refs.retiradaLojaSelectWrap) refs.retiradaLojaSelectWrap.classList.toggle("hidden", !pedido.retiradaLojaAtiva);
  refs.valorTotal.value      = pedido.valorTotal ? pedido.valorTotal.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  refs.valorEntrada.value    = pedido.valorEntrada ? pedido.valorEntrada.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  refs.valorReceber.value    = pedido.valorReceber ? pedido.valorReceber.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  refs.formaReceber.value    = pedido.formaReceber || "";
  refs.bancoOuObsPagamento.value = pedido.bancoOuObsPagamento || "";
  refs.parcelamento.value    = pedido.parcelamento || "";
  refs.observacoes.value     = pedido.observacoes || "";
  clearRepeats();
  (pedido.contatos?.length ? pedido.contatos : [""]).forEach(addContato);
  (pedido.itens?.length ? pedido.itens : [null]).forEach(addItem);
  updateReceber(); updatePayFields();
  setHighlightsFromPedido(pedido);
  refs.formTitle.textContent = "Editar pedido";
  refs.editingBadge.classList.remove("hidden");
  refs.btnCancelarEdicao.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

// ─── Helpers ──────────────────────────────────────────────────────────
function pluralizeItem(nome, qtd) {
  const n = (nome||"").trim(); if (qtd<=1) return n;
  const lower = n.toLowerCase();
  if (lower.endsWith("m")) return n.slice(0,-1) + "ns";
  if (lower.endsWith("r") || lower.endsWith("z")) return n + "es";
  if (lower.endsWith("ão")) return n.slice(0,-2) + "ões";
  if (/[aeiou]$/i.test(n)) return n + "s";
  return n + "s";
}
function mapsLink(p)    { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${(p.endereco||"").trim()}, ${(p.cidade||"").trim()}`)}`; }
const TREE_EMOJI = String.fromCodePoint(0x1F333);
const PIN_EMOJI  = String.fromCodePoint(0x1F4CD);
function paymentText(p) { const arr=[p.formaReceber]; if(p.parcelamento) arr.push(p.parcelamento); if(p.bancoOuObsPagamento) arr.push(p.bancoOuObsPagamento); return arr.filter(Boolean).join(" • "); }
function statusClass(status) { return status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-"); }
function openWhatsApp(text) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank"); }

// ─── Filtragem ────────────────────────────────────────────────────────
async function filteredPedidos() {
  const termo  = refs.busca.value.trim().toLowerCase();
  const status = refs.filtroStatus.value;
  const loja   = refs.filtroLoja.value;
  const todos  = await getPedidos();
  return todos.filter(p => {
    const text = [p.nomeCliente,p.numeroPedido,p.cidade,p.bairro,p.endereco,p.loja,...(p.contatos||[]),...(p.itens||[]).map(i=>`${i.quantidade} ${i.nome} ${i.descricao}`)].join(" ").toLowerCase();
    return (!termo||text.includes(termo)) && (!status||p.status===status) && (!loja||p.loja===loja);
  });
}

// ─── Stats ────────────────────────────────────────────────────────────
function renderStats(todosPedidos) {
  const total         = todosPedidos.length;
  const aguardando    = todosPedidos.filter(p => p.status === "AGUARDANDO").length;
  const emRota        = todosPedidos.filter(p => p.status === "EM ROTA DE ENTREGA").length;
  const entregue      = todosPedidos.filter(p => p.status === "ENTREGUE").length;
  const entregaFutura = todosPedidos.filter(p => p.status === "ENTREGA FUTURA").length;
  const retirada      = todosPedidos.filter(p => p.status === "RETIRADA").length;
  const stats = [
    {label:"Total", value:total, filter:""},
    {label:"Aguardando", value:aguardando, filter:"AGUARDANDO"},
    {label:"Entrega futura", value:entregaFutura, filter:"ENTREGA FUTURA"},
    {label:"Retirada", value:retirada, filter:"RETIRADA"},
    {label:"Em rota", value:emRota, filter:"EM ROTA DE ENTREGA"},
    {label:"Entregues", value:entregue, filter:"ENTREGUE"}
  ];
  refs.statsBar.innerHTML = stats.map(stat => `
    <button type="button" class="stat-card filtro-card ${refs.filtroStatus.value===stat.filter ? "ativo" : ""}" data-filter="${stat.filter}">
      <div>${stat.label}</div><strong>${stat.value}</strong>
    </button>
  `).join("");
  [...refs.statsBar.querySelectorAll(".filtro-card")].forEach(btn =>
    btn.addEventListener("click", () => { refs.filtroStatus.value = btn.dataset.filter; renderAll(); })
  );
}

// ─── Render lista ─────────────────────────────────────────────────────
async function renderPedidos() {
  const todos   = await getPedidos();
  const pedidos = await filteredPedidos();
  renderStats(todos);
  if (!pedidos.length) {
    refs.listaPedidos.className = "orders-list empty-state";
    refs.listaPedidos.innerHTML = "<p>Nenhum pedido encontrado.</p>";
    return;
  }
  refs.listaPedidos.className = "orders-list cards-view";
  refs.listaPedidos.innerHTML = pedidos.map(p => {
    const sc    = statusClass(p.status);
    const itens = (p.itens||[]).slice(0,4).map(item => `
      <div class="resumo-item">
        <strong>${item.quantidade} ${escapeHtml(pluralizeItem(item.nome, item.quantidade))}</strong>
        ${item.descricao ? `<span>${escapeHtml(item.descricao)}</span>` : ""}
      </div>
    `).join("");
    const restante = (p.itens||[]).length - 4;
    return `
      <article class="order-card resumo-card status-${sc}" data-id="${p.id}">
        <div class="resumo-topo">
          <div>
            <h4>${escapeHtml(p.nomeCliente)}</h4>
            <div class="resumo-cidade">${escapeHtml(p.cidade||"-")}</div>
          </div>
          <div class="badge-wrap">
            <span class="badge ${sc}">${escapeHtml(p.status)}</span>
          </div>
        </div>
        <div class="resumo-itens">${itens}</div>
        ${restante > 0 ? `<div class="resumo-mais">+ ${restante} item(ns)</div>` : ""}
        <div class="click-hint">CLIQUE PARA VER TODOS OS DETALHES</div>
      </article>
    `;
  }).join("");
  [...refs.listaPedidos.querySelectorAll(".resumo-card")].forEach(card =>
    card.addEventListener("click", () => abrirPedidoModal(card.dataset.id))
  );
}

async function renderAll() { await renderPedidos(); }

// ─── Modal pedido ──────────────────────────────────────────────────────
async function abrirPedidoModal(id) {
  const todos  = await getPedidos();
  const pedido = todos.find(p => p.id === id);
  if (!pedido) return;
  const sc = statusClass(pedido.status);
  refs.pedidoModalConteudo.innerHTML = `
    <article class="order-card">
      <div class="order-top">
        <div>
          <h4>${escapeHtml(pedido.nomeCliente)}</h4>
          <div class="subtext">Pedido ${escapeHtml(pedido.numeroPedido)} • ${escapeHtml(pedido.loja)}
            ${pedido.dataPedido ? ` • ${formatDateBR(pedido.dataPedido)}` : ""}
            • Atualizado em ${new Date(pedido.atualizadoEm).toLocaleString("pt-BR")}
          </div>
        </div>
        <div class="badge-wrap">
          <span class="badge ${sc}">${escapeHtml(pedido.status)}</span>
          <span class="badge badge-loja">${escapeHtml(pedido.loja)}</span>
        </div>
      </div>
      <div class="order-grid">
        <div class="box">
          <h5>Entrega</h5>
          <p><strong>Cidade:</strong> ${escapeHtml(pedido.cidade||"-")}</p>
          <p><strong>Bairro:</strong> ${escapeHtml(pedido.bairro||"-")}</p>
          <p><strong>Endereço:</strong> ${escapeHtml(pedido.endereco||"-")}</p>
          <p><strong>Maps:</strong> <a href="${getRouteLink(pedido)}" target="_blank" rel="noopener">Abrir localização</a></p>
          ${pedido.contatos?.length ? `<p><strong>Contatos:</strong> ${escapeHtml(pedido.contatos.join(" • "))}</p>` : ""}
          ${pedido.retiradaLojaAtiva ? `<p><strong>Retirada do cliente em:</strong> ${escapeHtml(pedido.retiradaLojaLocal || "-")}</p>` : ""}
        </div>
        <div class="box">
          <h5>Financeiro</h5>
          <p><strong>Total:</strong> ${formatMoney(pedido.valorTotal)}</p>
          <p><strong>Entrada:</strong> ${formatMoney(pedido.valorEntrada)}</p>
          ${pedido.valorReceber > 0 ? `<p><strong>A receber:</strong> ${formatMoney(pedido.valorReceber)}</p>` : ""}
          ${pedido.formaReceber ? `<p><strong>Pagamento:</strong> ${escapeHtml(paymentText(pedido))}</p>` : ""}
          ${pedido.observacoes ? `<p><strong>Obs.:</strong> ${escapeHtml(pedido.observacoes)}</p>` : ""}
        </div>
      </div>
      <div class="box" style="margin-bottom:12px;">
        <h5>Itens</h5>
        <div class="items-list">
          ${(pedido.itens||[]).map(item => `
            <div class="item-row">
              <strong>${item.quantidade} ${escapeHtml(pluralizeItem(item.nome,item.quantidade))}</strong>
              ${item.descricao ? `<em>${escapeHtml(item.descricao)}</em>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
      <div class="order-actions">
        <button class="btn-mini" data-modal-action="editar">Editar</button>
        <button class="btn-mini" data-modal-action="status">Alterar status</button>
        <button class="btn-mini" data-modal-action="whatsapp">WhatsApp</button>
        <button class="btn-mini danger" data-modal-action="excluir">Excluir</button>
        <div class="sort-box">
          <button class="btn-mini" data-modal-action="subir">↑ Subir</button>
          <button class="btn-mini" data-modal-action="descer">↓ Descer</button>
        </div>
      </div>
    </article>
  `;
  [...refs.pedidoModalConteudo.querySelectorAll("[data-modal-action]")].forEach(btn =>
    btn.addEventListener("click", () => { fecharPedidoModal(); handleCardAction(id, btn.dataset.modalAction); })
  );
  refs.pedidoModal.classList.remove("hidden");
}
function fecharPedidoModal() { refs.pedidoModal.classList.add("hidden"); }
refs.pedidoModalBackdrop.addEventListener("click", fecharPedidoModal);
refs.fecharPedidoModal.addEventListener("click", fecharPedidoModal);

// ─── Ações do card ────────────────────────────────────────────────────
const STATUS_OPTIONS = ["AGUARDANDO", "ENTREGA FUTURA", "RETIRADA", "EM ROTA DE ENTREGA", "ENTREGUE"];

function showStatusSelectDialog(currentStatus) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "status-select-overlay";
    overlay.innerHTML = `
      <div class="status-select-card">
        <h3>Alterar status</h3>
        <select id="statusDialogSelect" class="status-select-input">
          ${STATUS_OPTIONS.map(status => `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <div class="status-select-actions">
          <button type="button" class="btn btn-light" data-action="cancelar">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="confirmar">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cleanup = (value) => { overlay.remove(); resolve(value); };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(null);
    });
    overlay.querySelector('[data-action="cancelar"]').addEventListener("click", () => cleanup(null));
    overlay.querySelector('[data-action="confirmar"]').addEventListener("click", () => cleanup(overlay.querySelector("#statusDialogSelect").value));
  });
}
async function handleCardAction(id, action) {
  const todos = await getPedidos();
  const i     = todos.findIndex(p => p.id === id);
  if (i < 0) return;
  if (action === "editar")   { fillForm(todos[i]); return; }
  if (action === "excluir")  { if (!confirm("Deseja excluir este pedido?")) return; await deletePedido(id); await renderAll(); return; }
  if (action === "status") {
    const novoStatus = await showStatusSelectDialog(todos[i].status);
    if (!novoStatus || novoStatus === todos[i].status) return;
    todos[i].status = novoStatus;
    todos[i].atualizadoEm = new Date().toISOString();
    await savePedido(todos[i]);
    await renderAll();
    return;
  }
  if (action === "subir") {
    if (i === 0) return;
    [todos[i-1].ordem, todos[i].ordem] = [todos[i].ordem, todos[i-1].ordem];
    await savePedido(todos[i-1]); await savePedido(todos[i]); _pedidosCache = null; await renderAll(); return;
  }
  if (action === "descer") {
    if (i === todos.length-1) return;
    [todos[i+1].ordem, todos[i].ordem] = [todos[i].ordem, todos[i+1].ordem];
    await savePedido(todos[i+1]); await savePedido(todos[i]); _pedidosCache = null; await renderAll(); return;
  }
  if (action === "whatsapp") openWhatsApp(orderWhatsAppText(todos[i]));
}

function orderWhatsAppText(p) {
  const lines = [`*PEDIDO ${p.numeroPedido} - DUNORTE*`,`Cliente: ${p.nomeCliente}`,`Loja: ${p.loja}`,`Status: ${p.status}`,`Cidade: ${p.cidade}`];
  if (p.bairro) lines.push(`Bairro: ${p.bairro}`);
  lines.push(`Endereço: ${p.endereco}`);
  if (p.contatos?.length) lines.push(`Contato(s): ${p.contatos.join(" | ")}`);
  lines.push("","*Itens:*");
  p.itens.forEach(item => lines.push(`- ${item.quantidade} ${pluralizeItem(item.nome,item.quantidade)}${item.descricao ? " • "+item.descricao : ""}`));
  lines.push("",`Total: ${formatMoney(p.valorTotal)}`,`Entrada: ${formatMoney(p.valorEntrada)}`);
  if (p.valorReceber > 0) lines.push(`A receber: ${formatMoney(p.valorReceber)}`);
  if (p.formaReceber) lines.push(`Pagamento a receber: ${paymentText(p)}`);
  if (p.observacoes) lines.push("",`Obs.: ${p.observacoes}`);
  lines.push("",`Maps: ${getRouteLink(p)}`);
  return lines.join("\n");
}

// ─── Rota ─────────────────────────────────────────────────────────────
async function routePedidos() {
  const todos = await getPedidos();
  return todos
    .filter(p => p.status === "EM ROTA DE ENTREGA" || p.retiradaLojaAtiva)
    .sort((a,b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
function routeItemSummary(items) {
  return `${TREE_EMOJI} ` + items.map(i => `${i.quantidade} ${pluralizeItem(i.nome, i.quantidade)}`).join(" + ");
}

refs.btnRotaWhatsapp.addEventListener("click", async () => {
  const pedidos = await routePedidos();
  if (!pedidos.length) { alert('Não há pedidos com status "EM ROTA DE ENTREGA".'); return; }
  const data = refs.dataRota.value || todayISO();
  const lines = [`*ROTA (${formatDateBR(data)})*`, ""];
  pedidos.forEach(p => {
    lines.push(`*${p.nomeCliente}*`);
    lines.push(routeItemSummary(p.itens));
    lines.push(`${PIN_EMOJI} ${mapsLink(p)}`);
    lines.push("");
  });
  openWhatsApp(lines.join("\n").trim());
});

function getPrintHighlightClass(pedido, field) {
  return pedido.camposDestacados?.[field] ? "hl-text" : "";
}

function renderPrintFinanceiro(pedido) {
  if ((pedido.valorReceber || 0) <= 0) {
    return `<div class="line"><strong>Pago</strong></div>`;
  }
  const linhas = [
    `<div class="line ${getPrintHighlightClass(pedido, "valorTotal")}"><strong>Total:</strong> ${escapeHtml(formatMoney(pedido.valorTotal))}</div>`,
    `<div class="line ${getPrintHighlightClass(pedido, "valorEntrada")}"><strong>Entrada:</strong> ${escapeHtml(formatMoney(pedido.valorEntrada))}</div>`,
    `<div class="line ${getPrintHighlightClass(pedido, "valorReceber")}"><strong>A receber:</strong> ${escapeHtml(formatMoney(pedido.valorReceber))}</div>`
  ];
  if (pedido.formaReceber) {
    linhas.push(`<div class="line ${getPrintHighlightClass(pedido, "formaReceber")} ${getPrintHighlightClass(pedido, "bancoOuObsPagamento")} ${getPrintHighlightClass(pedido, "parcelamento")}"><strong>Pagamento:</strong> ${escapeHtml(paymentText(pedido))}</div>`);
  }
  return linhas.join("");
}

function gerarHTMLRotaImpressao(pedidos, data) {
  const pedidosEntrega = pedidos.filter(p => !p.retiradaLojaAtiva);
  const pedidosRetirada = pedidos.filter(p => p.retiradaLojaAtiva);

  function renderCard(p) {
    const itens = (p.itens || []).map(item => `
      <div class="item-row"><span class="${item.destacarNaImpressao ? "hl-text" : ""}"><strong>${escapeHtml(`${item.quantidade} ${pluralizeItem(item.nome, item.quantidade)}`)}</strong>${item.descricao ? ` ${escapeHtml(item.descricao)}` : ""}</span></div>
    `).join("");

    const enderecoPartes = [p.endereco?.trim(), p.bairro ? `Bairro: ${p.bairro}` : "", p.cidade ? `Cidade: ${p.cidade}` : ""].filter(Boolean).join("   ");

    return `
      <article class="print-card">
        <div class="print-head">
          <div class="client ${getPrintHighlightClass(p, "nomeCliente")}">${escapeHtml(p.nomeCliente || "-")}</div>
          <div class="pedido-num ${getPrintHighlightClass(p, "numeroPedido")}">Pedido ${escapeHtml(p.numeroPedido || "-")}</div>
        </div>
        <div class="meta-grid">
          <div class="line ${getPrintHighlightClass(p, "loja")}"><strong>Loja:</strong> <span>${escapeHtml(p.loja || "-")}</span></div>
          <div class="line ${getPrintHighlightClass(p, "dataPedido")}"><strong>Data:</strong> <span>${escapeHtml(formatDateBR(p.dataPedido || ""))}</span></div>
          <div class="line ${getPrintHighlightClass(p, "status")}"><strong>Status:</strong> <span>${escapeHtml(p.status || "-")}</span></div>
          ${p.retiradaLojaAtiva ? `<div class="line"><strong>Retirar em:</strong> <span>${escapeHtml(p.retiradaLojaLocal || "-")}</span></div>` : ""}
        </div>
        <div class="line endereco-line ${getPrintHighlightClass(p, "endereco")} ${getPrintHighlightClass(p, "bairro")} ${getPrintHighlightClass(p, "cidade")}"><strong>Endereço:</strong> <span>${escapeHtml(enderecoPartes || "-")}</span></div>
        ${p.contatos?.length ? `<div class="line"><strong>Contato:</strong> <span>${escapeHtml(p.contatos.join(" | "))}</span></div>` : ""}
        <div class="section-title">Itens</div>
        <div class="items-block">${itens}</div>
        <div class="section-title">Financeiro</div>
        <div class="finance-block">${renderPrintFinanceiro(p)}</div>
        ${p.observacoes ? `<div class="section-title">Observações</div><div class="obs"><span class="${getPrintHighlightClass(p, "observacoes")}">${escapeHtml(p.observacoes)}</span></div>` : ""}
      </article>
    `;
  }

  const cardsEntrega = pedidosEntrega.map(renderCard).join("");
  const cardsRetirada = pedidosRetirada.map(renderCard).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rota ${escapeHtml(formatDateBR(data))}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  :root { --paper-w: 195mm; --paper-h: 282mm; --lime: #eef8a8; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: var(--paper-w); height: var(--paper-h); overflow: hidden; margin: 7.5mm auto; }
  .scale-wrap { width: 180mm; transform-origin: top left; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; gap:10px; margin-bottom:10px; }
  .header h1 { margin:0; font-size:16px; }
  .header .sub { font-size:10px; color:#444; }
  .section-heading { font-size:11px; font-weight:700; text-transform:uppercase; margin:0 0 6px; }
  .cards { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; align-content:start; }
  .print-card { border:1px solid #333; border-radius:8px; padding:8px 9px; break-inside:avoid; background:#fff; }
  .print-head { display:flex; justify-content:space-between; gap:8px; margin-bottom:6px; align-items:flex-start; }
  .client { font-size:12px; font-weight:700; line-height:1.15; }
  .pedido-num { font-size:10px; text-align:right; white-space:nowrap; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:3px 8px; margin-bottom:4px; }
  .line, .obs, .item-row { font-size:9.4px; line-height:1.24; padding:1px 0; }
  .section-title { font-size:9px; font-weight:700; text-transform:uppercase; margin:6px 0 2px; color:#333; }
  .items-block, .finance-block { display:flex; flex-direction:column; gap:2px; }
  .obs { color:#9b1c1c; font-weight:600; }
  .hl-text { background: var(--lime); display:inline; padding:1px 3px; border-radius:2px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
  .retirada-group { margin-top: 10px; }
  @media print { html, body { width: 210mm; height: 297mm; } }
</style>
</head>
<body>
  <div class="page">
    <div class="scale-wrap" id="scaleWrap">
      <div class="header">
        <div>
          <h1>DUNORTE • ROTA DE ENTREGA</h1>
          <div class="sub">Data da rota: ${escapeHtml(formatDateBR(data))}</div>
        </div>
        <div class="sub">Pedidos na folha: ${pedidos.length}</div>
      </div>
      <div class="section-heading">ENTREGAS EM ROTA</div>
      <div class="cards">${cardsEntrega}</div>
      ${cardsRetirada ? `<div class="retirada-group"><div class="section-heading">LEVAR PARA LOJA • CLIENTE IRÁ RETIRAR</div><div class="cards">${cardsRetirada}</div></div>` : ""}
    </div>
  </div>
<script>
(function(){
  const mm = 3.7795275591;
  const pageW = 195 * mm;
  const pageH = 282 * mm;
  const wrap = document.getElementById('scaleWrap');
  const fit = () => {
    wrap.style.transform = 'scale(1)';
    wrap.style.height = 'auto';
    const w = wrap.scrollWidth;
    const h = wrap.scrollHeight;
    const scale = Math.min(pageW / Math.max(w, 1), pageH / Math.max(h, 1));
    wrap.style.transform = 'scale(' + scale + ')';
    wrap.style.height = (h * scale) + 'px';
  };
  window.addEventListener('load', () => { fit(); setTimeout(() => { fit(); window.print(); }, 80); });
})();
<\/script>
</body>
</html>`;
}

refs.btnImprimirRota.addEventListener("click", async () => {
  const pedidos = await routePedidos();
  if (!pedidos.length) { alert('Não há pedidos com status "EM ROTA DE ENTREGA".'); return; }
  const data = refs.dataRota.value || todayISO();
  const html = gerarHTMLRotaImpressao(pedidos, data);
  const win = window.open("", "_blank");
  if (!win) { alert("Pop-up bloqueado! Permita pop-ups para gerar o PDF da rota."); return; }
  win.document.write(html);
  win.document.close();
});

// ─── Busca / filtros ──────────────────────────────────────────────────
refs.busca.addEventListener("input", renderAll);
refs.filtroStatus.addEventListener("change", renderAll);
refs.filtroLoja.addEventListener("change", renderAll);

// ─── Exportar / Importar ──────────────────────────────────────────────
refs.btnExportar.addEventListener("click", async () => {
  const pedidos = await getPedidos();
  const blob = new Blob([JSON.stringify(pedidos, null, 2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href=url; a.download="dunorte-pedidos-pro.json"; a.click(); URL.revokeObjectURL(url);
});
refs.inputImportar.addEventListener("change", (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result); if (!Array.isArray(data)) throw new Error();
      await saveAllPedidos(data); await renderAll(); alert("Importação concluída.");
    } catch { alert("Arquivo inválido."); }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ─── Modal Relatório ─────────────────────────────────────────────────
refs.btnRelatorio.addEventListener("click", async () => {
  // Popular cidades no select
  const todos = await getPedidos();
  const cidades = [...new Set(todos.map(p => p.cidade).filter(Boolean))].sort();
  refs.relCidade.innerHTML = `<option value="">Todas as cidades</option>` +
    cidades.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  refs.relPreviewInfo.textContent = "";
  refs.relatorioModal.classList.remove("hidden");
});
refs.relatorioModalBackdrop.addEventListener("click", () => refs.relatorioModal.classList.add("hidden"));
refs.fecharRelatorioModal.addEventListener("click", () => refs.relatorioModal.classList.add("hidden"));

async function getRelatorioData() {
  const todos = await getPedidos();
  const dataIni  = refs.relDataInicio.value;
  const dataFim  = refs.relDataFim.value;
  const valMin   = parseMoney(refs.relValorMin.value);
  const valMax   = refs.relValorMax.value ? parseMoney(refs.relValorMax.value) : Infinity;
  const cidade   = refs.relCidade.value;
  const status   = refs.relStatusFiltro.value;
  const loja     = refs.relLoja.value;
  const ordem    = refs.relOrdem.value;

  let result = todos.filter(p => {
    if (dataIni && (p.dataPedido||"") < dataIni) return false;
    if (dataFim && (p.dataPedido||"") > dataFim) return false;
    if (valMin  && (p.valorTotal||0) < valMin)   return false;
    if (valMax !== Infinity && (p.valorTotal||0) > valMax) return false;
    if (cidade && p.cidade !== cidade)            return false;
    if (status && p.status !== status)            return false;
    if (loja   && p.loja   !== loja)              return false;
    return true;
  });

  result.sort((a,b) => {
    if (ordem === "alfabetica")   return (a.nomeCliente||"").localeCompare(b.nomeCliente||"","pt-BR");
    if (ordem === "numeroPedido") return (a.numeroPedido||"").localeCompare(b.numeroPedido||"","pt-BR",{numeric:true});
    if (ordem === "data")         return (a.dataPedido||"").localeCompare(b.dataPedido||"");
    if (ordem === "valorTotal")   return (a.valorTotal||0) - (b.valorTotal||0);
    return 0;
  });
  return result;
}

function getCamposSelecionados() {
  return [...document.querySelectorAll("[name='relCampo']:checked")].map(cb => cb.value);
}

const CAMPO_LABELS = {
  dataPedido:"Data do pedido", numeroPedido:"Número do pedido", nomeCliente:"Nome do cliente",
  loja:"Loja", status:"Status", cidade:"Cidade", bairro:"Bairro", endereco:"Endereço",
  contatos:"Contatos", itens:"Itens", valorTotal:"Valor total", valorEntrada:"Entrada",
  valorReceber:"A receber", formaReceber:"Forma de pagamento", parcelamento:"Parcelamento",
  observacoes:"Observações"
};

function formatCampo(campo, pedido) {
  switch(campo) {
    case "dataPedido":    return formatDateBR(pedido.dataPedido);
    case "numeroPedido":  return pedido.numeroPedido || "-";
    case "nomeCliente":   return pedido.nomeCliente || "-";
    case "loja":          return pedido.loja || "-";
    case "status":        return pedido.status || "-";
    case "cidade":        return pedido.cidade || "-";
    case "bairro":        return pedido.bairro || "-";
    case "endereco":      return pedido.endereco || "-";
    case "contatos":      return pedido.contatos?.join(" • ") || "-";
    case "itens":         return (pedido.itens||[]).map(i=>`${i.quantidade}x ${i.nome}${i.descricao?" – "+i.descricao:""}`).join("; ") || "-";
    case "valorTotal":    return formatMoney(pedido.valorTotal);
    case "valorEntrada":  return formatMoney(pedido.valorEntrada);
    case "valorReceber":  return formatMoney(pedido.valorReceber);
    case "formaReceber":  return paymentText(pedido) || "-";
    case "parcelamento":  return pedido.parcelamento || "-";
    case "observacoes":   return pedido.observacoes || "-";
    default: return "-";
  }
}

refs.btnPreviewRelatorio.addEventListener("click", async () => {
  const dados  = await getRelatorioData();
  const campos = getCamposSelecionados();
  refs.relPreviewInfo.innerHTML = `<strong>${dados.length} pedido(s)</strong> encontrado(s) com os filtros selecionados.`;
  if (dados.length === 0) return;
  // pequena prévia: 3 primeiros
  const preview = dados.slice(0,3).map(p =>
    campos.map(c => `${CAMPO_LABELS[c]}: ${formatCampo(c,p)}`).join(" | ")
  ).join("<br/>");
  refs.relPreviewInfo.innerHTML += `<div class="rel-preview-list">${preview}${dados.length>3?`<br/>... e mais ${dados.length-3}.`:""}</div>`;
});

refs.btnGerarRelatorio.addEventListener("click", async () => {
  const dados  = await getRelatorioData();
  const campos = getCamposSelecionados();
  if (!dados.length) { alert("Nenhum pedido encontrado com esses filtros."); return; }
  if (!campos.length) { alert("Selecione pelo menos um campo para o relatório."); return; }
  gerarRelatorioHTML(dados, campos);
});

function gerarRelatorioHTML(dados, campos) {
  const dataAtual  = new Date().toLocaleString("pt-BR");
  const totalValor = dados.reduce((s,p) => s + (p.valorTotal||0), 0);
  const rows = dados.map((p, idx) => {
    const cells = campos.map(c => {
      const val   = escapeHtml(formatCampo(c, p));
      const isObs = c === "observacoes";
      return `<td style="${isObs ? "color:#c0392b;font-weight:600;" : ""}">${val}</td>`;
    }).join("");
    return `<tr style="background:${idx%2===0?"#fff":"#f9f6f2"};">${cells}</tr>`;
  }).join("");

  const cabecalhos = campos.map(c => `<th>${escapeHtml(CAMPO_LABELS[c])}</th>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Dunorte</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #2f241c; margin: 0; }
  h1 { font-size: 20px; color: #6d4a33; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #7d6d62; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #6d4a33; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e7d9cc; font-size: 11px; vertical-align: top; }
  .resumo { background: #f7f1e8; border: 1px solid #e7d9cc; border-radius: 8px; padding: 12px; margin-top: 12px; font-size: 12px; }
  .resumo strong { color: #6d4a33; }
</style>
</head>
<body>
<h1>🌳 DUNORTE — Relatório de Pedidos</h1>
<div class="sub">Gerado em: ${dataAtual} &nbsp;|&nbsp; Total de pedidos: ${dados.length}</div>
<table>
  <thead><tr>${cabecalhos}</tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="resumo">
  <strong>Total de pedidos:</strong> ${dados.length} &nbsp;&nbsp;
  <strong>Soma dos valores:</strong> ${formatMoney(totalValor)}
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("","_blank");
  if (!win) { alert("Pop-up bloqueado! Permita pop-ups para gerar o PDF."); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Teclado ──────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { fecharPedidoModal(); refs.relatorioModal.classList.add("hidden"); }
});

// ─── Init ─────────────────────────────────────────────────────────────
(async function init() {
  refs.dataRota.value   = todayISO();
  await migrarLocalStorage();
  initHighlightCheckboxes();
  resetForm();
  if (isLogged()) showDashboard(); else showLogin();
})();
