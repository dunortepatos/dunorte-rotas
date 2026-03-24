const STORAGE_KEY = "dunorte_rotas_pro_v1";
const AUTH_KEY = "dunorte_rotas_auth_v1";
const DEFAULT_USER = { username: "admin", password: "1234" };
const $ = (id) => document.getElementById(id);

const refs = {
  loginScreen: $("loginScreen"),
  dashboardScreen: $("dashboardScreen"),
  loginForm: $("loginForm"),
  loginUser: $("loginUser"),
  loginPass: $("loginPass"),
  btnLogout: $("btnLogout"),

  pedidoForm: $("pedidoForm"),
  pedidoId: $("pedidoId"),
  loja: $("loja"),
  status: $("status"),
  numeroPedido: $("numeroPedido"),
  nomeCliente: $("nomeCliente"),
  cidade: $("cidade"),
  bairro: $("bairro"),
  endereco: $("endereco"),
  listaContatos: $("listaContatos"),
  listaItens: $("listaItens"),
  fotosPedido: $("fotosPedido"),
  previewFotos: $("previewFotos"),
  valorTotal: $("valorTotal"),
  valorEntrada: $("valorEntrada"),
  valorReceber: $("valorReceber"),
  formaReceber: $("formaReceber"),
  bancoOuObsPagamento: $("bancoOuObsPagamento"),
  parcelamento: $("parcelamento"),
  blocoFormaReceber: $("blocoFormaReceber"),
  blocoBancoOuDetalhe: $("blocoBancoOuDetalhe"),
  blocoParcelamento: $("blocoParcelamento"),
  observacoes: $("observacoes"),
  formTitle: $("formTitle"),
  editingBadge: $("editingBadge"),
  btnCancelarEdicao: $("btnCancelarEdicao"),

  btnAddContato: $("btnAddContato"),
  btnAddItem: $("btnAddItem"),
  btnNovoPedido: $("btnNovoPedido"),
  btnExportar: $("btnExportar"),
  inputImportar: $("inputImportar"),
  busca: $("busca"),
  filtroStatus: $("filtroStatus"),
  filtroLoja: $("filtroLoja"),
  dataRota: $("dataRota"),
  btnRotaWhatsapp: $("btnRotaWhatsapp"),
  btnImprimirRota: $("btnImprimirRota"),
  statsBar: $("statsBar"),
  listaPedidos: $("listaPedidos"),

  pedidoModal: $("pedidoModal"),
  pedidoModalBackdrop: $("pedidoModalBackdrop"),
  fecharPedidoModal: $("fecharPedidoModal"),
  pedidoModalConteudo: $("pedidoModalConteudo")
};

let fotosAtuais = [];

function getAuthData() {
  return JSON.parse(localStorage.getItem(AUTH_KEY) || JSON.stringify(DEFAULT_USER));
}
function isLogged() { return sessionStorage.getItem("dunorte_logged") === "1"; }
function setLogged(v) { if (v) sessionStorage.setItem("dunorte_logged", "1"); else sessionStorage.removeItem("dunorte_logged"); }

function showDashboard() { refs.loginScreen.classList.add("hidden"); refs.dashboardScreen.classList.remove("hidden"); renderAll(); }
function showLogin() { refs.dashboardScreen.classList.add("hidden"); refs.loginScreen.classList.remove("hidden"); }

refs.loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const auth = getAuthData();
  if (refs.loginUser.value.trim() === auth.username && refs.loginPass.value.trim() === auth.password) {
    setLogged(true); refs.loginForm.reset(); showDashboard();
  } else alert("Usuário ou senha incorretos.");
});
refs.btnLogout.addEventListener("click", () => { setLogged(false); showLogin(); });

function getPedidos() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
function savePedidos(pedidos) { localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos)); }

function uid() { return "p_" + Date.now() + "_" + Math.floor(Math.random() * 100000); }
function escapeHtml(str) {
  return String(str ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function addContato(valor = "") {
  const tpl = $("tplContato").content.firstElementChild.cloneNode(true);
  tpl.querySelector(".contato-input").value = valor;
  tpl.querySelector(".remove-btn").addEventListener("click", () => tpl.remove());
  refs.listaContatos.appendChild(tpl);
}
function addItem(item = null) {
  const tpl = $("tplItem").content.firstElementChild.cloneNode(true);
  if (item) {
    tpl.querySelector(".item-qtd").value = item.quantidade || 1;
    tpl.querySelector(".item-nome").value = item.nome || "";
    tpl.querySelector(".item-desc").value = item.descricao || "";
  }
  tpl.querySelector(".remove-btn").addEventListener("click", () => tpl.remove());
  refs.listaItens.appendChild(tpl);
}
function clearRepeats() { refs.listaContatos.innerHTML = ""; refs.listaItens.innerHTML = ""; }
function parseMoney(v) { if (!v) return 0; const clean = String(v).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""); return Number(clean)||0; }
function formatMoney(v) { return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
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
  const needsBank = ["TRANSFERENCIA","PIX"].includes(tipo);
  const needsDetail = ["CARTAO","CHEQUE","CREDIARIO"].includes(tipo);
  refs.blocoBancoOuDetalhe.classList.toggle("hidden", !(needsBank || needsDetail));
  refs.blocoParcelamento.classList.toggle("hidden", !needsDetail);
  const label = refs.blocoBancoOuDetalhe.querySelector("label");
  if (needsBank) { label.textContent = "Banco / detalhe"; refs.bancoOuObsPagamento.placeholder = "Ex.: Sicredi, Nubank, Caixa..."; }
  else if (needsDetail) { label.textContent = "Detalhe"; refs.bancoOuObsPagamento.placeholder = "Observação opcional"; }
}
refs.btnAddContato.addEventListener("click", () => addContato());
refs.btnAddItem.addEventListener("click", () => addItem());
refs.btnNovoPedido.addEventListener("click", resetForm);
refs.btnCancelarEdicao.addEventListener("click", resetForm);

refs.fotosPedido.addEventListener("change", async (e) => {
  const files = [...(e.target.files || [])];
  for (const file of files) fotosAtuais.push(await fileToBase64(file));
  renderPhotoPreview(); refs.fotosPedido.value = "";
});
refs.pedidoModalBackdrop.addEventListener("click", fecharPedidoModal);
refs.fecharPedidoModal.addEventListener("click", fecharPedidoModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPedidoModal(); });

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function renderPhotoPreview() {
  refs.previewFotos.innerHTML = "";
  fotosAtuais.forEach((src, index) => {
    const div = document.createElement("div");
    div.className = "photo-thumb";
    div.innerHTML = `<img src="${src}" alt="Foto do pedido"><button type="button">×</button>`;
    div.querySelector("button").addEventListener("click", () => { fotosAtuais.splice(index,1); renderPhotoPreview(); });
    refs.previewFotos.appendChild(div);
  });
}
function collectForm() {
  const contatos = [...refs.listaContatos.querySelectorAll(".contato-input")].map(i => i.value.trim()).filter(Boolean);
  const itens = [...refs.listaItens.querySelectorAll(".item-card")].map(card => ({
    quantidade: Math.max(1, Number(card.querySelector(".item-qtd").value) || 1),
    nome: card.querySelector(".item-nome").value.trim(),
    descricao: card.querySelector(".item-desc").value.trim()
  })).filter(item => item.nome);
  if (!itens.length) { alert("Adicione pelo menos um item."); return null; }
  const original = getPedidos().find(p => p.id === refs.pedidoId.value);
  return {
    id: refs.pedidoId.value || uid(),
    loja: refs.loja.value,
    status: refs.status.value,
    numeroPedido: refs.numeroPedido.value.trim(),
    nomeCliente: refs.nomeCliente.value.trim(),
    cidade: refs.cidade.value.trim(),
    bairro: refs.bairro.value.trim(),
    endereco: refs.endereco.value.trim(),
    contatos, itens, fotos: fotosAtuais,
    valorTotal: parseMoney(refs.valorTotal.value),
    valorEntrada: parseMoney(refs.valorEntrada.value),
    valorReceber: parseMoney(refs.valorReceber.value),
    formaReceber: refs.formaReceber.value,
    bancoOuObsPagamento: refs.bancoOuObsPagamento.value.trim(),
    parcelamento: refs.parcelamento.value,
    observacoes: refs.observacoes.value.trim(),
    criadoEm: original?.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
}
refs.pedidoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const pedido = collectForm();
  if (!pedido) return;
  const pedidos = getPedidos();
  const i = pedidos.findIndex(p => p.id === pedido.id);
  if (i >= 0) pedidos[i] = pedido; else pedidos.unshift(pedido);
  savePedidos(pedidos); resetForm(); renderAll();
});
function resetForm() {
  refs.pedidoForm.reset(); refs.pedidoId.value = "";
  refs.formTitle.textContent = "Novo pedido";
  refs.editingBadge.classList.add("hidden"); refs.btnCancelarEdicao.classList.add("hidden");
  clearRepeats(); addContato(); addItem(); fotosAtuais = []; renderPhotoPreview();
  refs.valorReceber.value = "";
  refs.blocoFormaReceber.classList.add("hidden");
  refs.blocoBancoOuDetalhe.classList.add("hidden");
  refs.blocoParcelamento.classList.add("hidden");
}
function fillForm(pedido) {
  refs.pedidoId.value = pedido.id; refs.loja.value = pedido.loja || ""; refs.status.value = pedido.status || "AGUARDANDO";
  refs.numeroPedido.value = pedido.numeroPedido || ""; refs.nomeCliente.value = pedido.nomeCliente || "";
  refs.cidade.value = pedido.cidade || ""; refs.bairro.value = pedido.bairro || ""; refs.endereco.value = pedido.endereco || "";
  refs.valorTotal.value = pedido.valorTotal ? pedido.valorTotal.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  refs.valorEntrada.value = pedido.valorEntrada ? pedido.valorEntrada.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  refs.valorReceber.value = pedido.valorReceber ? pedido.valorReceber.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  refs.formaReceber.value = pedido.formaReceber || ""; refs.bancoOuObsPagamento.value = pedido.bancoOuObsPagamento || "";
  refs.parcelamento.value = pedido.parcelamento || ""; refs.observacoes.value = pedido.observacoes || "";
  clearRepeats(); (pedido.contatos?.length ? pedido.contatos : [""]).forEach(addContato); (pedido.itens?.length ? pedido.itens : [null]).forEach(addItem);
  fotosAtuais = [...(pedido.fotos || [])]; renderPhotoPreview(); updateReceber(); updatePayFields();
  refs.formTitle.textContent = "Editar pedido"; refs.editingBadge.classList.remove("hidden"); refs.btnCancelarEdicao.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}
function pluralizeItem(nome, qtd) {
  const n = (nome || "").trim(); if (qtd <= 1) return n;
  const lower = n.toLowerCase();
  if (lower.endsWith("m")) return n.slice(0,-1) + "ns";
  if (lower.endsWith("r") || lower.endsWith("z")) return n + "es";
  if (lower.endsWith("ão")) return n.slice(0,-2) + "ões";
  if (/[aeiou]$/i.test(n)) return n + "s";
  return n + "s";
}
function mapsLink(p) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.endereco}, ${p.cidade}`)}`; }
function paymentText(p) {
  const arr = [p.formaReceber]; if (p.parcelamento) arr.push(p.parcelamento); if (p.bancoOuObsPagamento) arr.push(p.bancoOuObsPagamento);
  return arr.filter(Boolean).join(" • ");
}
function filteredPedidos() {
  const termo = refs.busca.value.trim().toLowerCase();
  const status = refs.filtroStatus.value;
  const loja = refs.filtroLoja.value;
  return getPedidos().filter(p => {
    const text = [p.nomeCliente,p.numeroPedido,p.cidade,p.bairro,p.endereco,p.loja,...(p.contatos||[]),...(p.itens||[]).map(i=>`${i.quantidade} ${i.nome} ${i.descricao}`)].join(" ").toLowerCase();
    return (!termo || text.includes(termo)) && (!status || p.status === status) && (!loja || p.loja === loja);
  });
}
function renderStats(todosPedidos) {
  const total = todosPedidos.length;
  const aguardando = todosPedidos.filter(p => p.status === "AGUARDANDO").length;
  const emRota = todosPedidos.filter(p => p.status === "EM ROTA DE ENTREGA").length;
  const entregue = todosPedidos.filter(p => p.status === "ENTREGUE").length;
  const stats = [
    {label:"Total", value:total, filter:""},
    {label:"Aguardando", value:aguardando, filter:"AGUARDANDO"},
    {label:"Em rota", value:emRota, filter:"EM ROTA DE ENTREGA"},
    {label:"Entregues", value:entregue, filter:"ENTREGUE"}
  ];
  refs.statsBar.innerHTML = stats.map(stat => `
    <button type="button" class="stat-card filtro-card ${refs.filtroStatus.value===stat.filter ? "ativo" : ""}" data-filter="${stat.filter}">
      <div>${stat.label}</div><strong>${stat.value}</strong>
    </button>
  `).join("");
  [...refs.statsBar.querySelectorAll(".filtro-card")].forEach(btn => btn.addEventListener("click", () => {
    refs.filtroStatus.value = btn.dataset.filter; renderAll();
  }));
}
function renderPedidos() {
  const todos = getPedidos();
  const pedidos = filteredPedidos();
  renderStats(todos);
  if (!pedidos.length) {
    refs.listaPedidos.className = "orders-list empty-state";
    refs.listaPedidos.innerHTML = "<p>Nenhum pedido encontrado.</p>";
    return;
  }
  refs.listaPedidos.className = "orders-list cards-view";
  refs.listaPedidos.innerHTML = pedidos.map(p => {
    const statusClass = p.status.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/\s+/g,"-");
    const itens = (p.itens || []).slice(0,4).map(item => `
      <div class="resumo-item">
        <strong>${item.quantidade} ${escapeHtml(pluralizeItem(item.nome, item.quantidade))}</strong>
        ${item.descricao ? `<span>${escapeHtml(item.descricao)}</span>` : ""}
      </div>
    `).join("");
    const restante = (p.itens || []).length - 4;
    return `
      <article class="order-card resumo-card status-${statusClass}" data-id="${p.id}">
        <div class="resumo-topo">
          <div>
            <h4>${escapeHtml(p.nomeCliente)}</h4>
            <div class="resumo-cidade">${escapeHtml(p.cidade || "-")}</div>
          </div>
          <div class="badge-wrap">
            <span class="badge ${statusClass}">${escapeHtml(p.status)}</span>
          </div>
        </div>
        <div class="resumo-itens">${itens}</div>
        ${restante > 0 ? `<div class="resumo-mais">+ ${restante} item(ns)</div>` : ""}
        <div class="click-hint">CLIQUE PARA VER TODOS OS DETALHES</div>
      </article>
    `;
  }).join("");
  [...refs.listaPedidos.querySelectorAll(".resumo-card")].forEach(card => card.addEventListener("click", () => abrirPedidoModal(card.dataset.id)));
}
function abrirPedidoModal(id) {
  const pedido = getPedidos().find(p => p.id === id);
  if (!pedido) return;
  const statusClass = pedido.status.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/\s+/g,"-");
  refs.pedidoModalConteudo.innerHTML = `
    <article class="order-card">
      <div class="order-top">
        <div>
          <h4>${escapeHtml(pedido.nomeCliente)}</h4>
          <div class="subtext">Pedido ${escapeHtml(pedido.numeroPedido)} • ${escapeHtml(pedido.loja)} • Atualizado em ${new Date(pedido.atualizadoEm).toLocaleString("pt-BR")}</div>
        </div>
        <div class="badge-wrap">
          <span class="badge ${statusClass}">${escapeHtml(pedido.status)}</span>
          <span class="badge badge-loja">${escapeHtml(pedido.loja)}</span>
        </div>
      </div>
      <div class="order-grid">
        <div class="box">
          <h5>Entrega</h5>
          <p><strong>Cidade:</strong> ${escapeHtml(pedido.cidade || "-")}</p>
          <p><strong>Bairro:</strong> ${escapeHtml(pedido.bairro || "-")}</p>
          <p><strong>Endereço:</strong> ${escapeHtml(pedido.endereco || "-")}</p>
          <p><strong>Maps:</strong> <a href="${mapsLink(pedido)}" target="_blank" rel="noopener">Abrir localização</a></p>
          ${pedido.contatos?.length ? `<p><strong>Contatos:</strong> ${escapeHtml(pedido.contatos.join(" • "))}</p>` : ""}
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
          ${pedido.itens.map(item => `
            <div class="item-row">
              <strong>${item.quantidade} ${escapeHtml(pluralizeItem(item.nome, item.quantidade))}</strong>
              ${item.descricao ? `<em>${escapeHtml(item.descricao)}</em>` : ""}
            </div>
          `).join("")}
        </div>
        ${pedido.fotos?.length ? `<div class="order-photo-cover">${pedido.fotos.map(src => `<img src="${src}" alt="Foto do pedido">`).join("")}</div>` : ""}
      </div>
      <div class="order-actions">
        <button class="btn-mini" data-modal-action="editar">Editar</button>
        <button class="btn-mini" data-modal-action="status">Mover status</button>
        <button class="btn-mini" data-modal-action="whatsapp">WhatsApp</button>
        <button class="btn-mini danger" data-modal-action="excluir">Excluir</button>
        <div class="sort-box">
          <button class="btn-mini" data-modal-action="subir">↑ Subir</button>
          <button class="btn-mini" data-modal-action="descer">↓ Descer</button>
        </div>
      </div>
    </article>
  `;
  [...refs.pedidoModalConteudo.querySelectorAll("[data-modal-action]")].forEach(btn => {
    btn.addEventListener("click", () => { fecharPedidoModal(); handleCardAction(id, btn.dataset.modalAction); });
  });
  refs.pedidoModal.classList.remove("hidden");
}
function fecharPedidoModal() { refs.pedidoModal.classList.add("hidden"); }

function nextStatus(atual) {
  if (atual === "AGUARDANDO") return "EM ROTA DE ENTREGA";
  if (atual === "EM ROTA DE ENTREGA") return "ENTREGUE";
  return "AGUARDANDO";
}
function handleCardAction(id, action) {
  const pedidos = getPedidos();
  const i = pedidos.findIndex(p => p.id === id);
  if (i < 0) return;
  if (action === "editar") { fillForm(pedidos[i]); return; }
  if (action === "excluir") { if (!confirm("Deseja excluir este pedido?")) return; pedidos.splice(i,1); savePedidos(pedidos); renderAll(); return; }
  if (action === "status") { pedidos[i].status = nextStatus(pedidos[i].status); pedidos[i].atualizadoEm = new Date().toISOString(); savePedidos(pedidos); renderAll(); return; }
  if (action === "subir") { if (i === 0) return; [pedidos[i-1], pedidos[i]] = [pedidos[i], pedidos[i-1]]; savePedidos(pedidos); renderAll(); return; }
  if (action === "descer") { if (i === pedidos.length - 1) return; [pedidos[i+1], pedidos[i]] = [pedidos[i], pedidos[i+1]]; savePedidos(pedidos); renderAll(); return; }
  if (action === "whatsapp") openWhatsApp(orderWhatsAppText(pedidos[i]));
}
function orderWhatsAppText(p) {
  const lines = [`*PEDIDO ${p.numeroPedido} - DUNORTE*`,`Cliente: ${p.nomeCliente}`,`Loja: ${p.loja}`,`Status: ${p.status}`,`Cidade: ${p.cidade}`];
  if (p.bairro) lines.push(`Bairro: ${p.bairro}`); lines.push(`Endereço: ${p.endereco}`);
  if (p.contatos?.length) lines.push(`Contato(s): ${p.contatos.join(" | ")}`);
  lines.push("", "*Itens:*");
  p.itens.forEach(item => lines.push(`- ${item.quantidade} ${pluralizeItem(item.nome, item.quantidade)}${item.descricao ? " • " + item.descricao : ""}`));
  lines.push("", `Total: ${formatMoney(p.valorTotal)}`, `Entrada: ${formatMoney(p.valorEntrada)}`);
  if (p.valorReceber > 0) lines.push(`A receber: ${formatMoney(p.valorReceber)}`);
  if (p.formaReceber) lines.push(`Pagamento a receber: ${paymentText(p)}`);
  if (p.observacoes) lines.push("", `Obs.: ${p.observacoes}`);
  lines.push("", `Maps: ${mapsLink(p)}`);
  return lines.join("\\n");
}
function routePedidos() { return filteredPedidos().filter(p => p.status === "EM ROTA DE ENTREGA"); }
function routeItemSummary(items) { return "🌳 " + items.map(i => `${i.quantidade} ${pluralizeItem(i.nome, i.quantidade)}`).join(" + "); }
function formatDateBR(isoDate) { const [y,m,d] = isoDate.split("-"); return `${d}/${m}/${y}`; }
function openWhatsApp(text) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }

refs.btnRotaWhatsapp.addEventListener("click", () => {
  const pedidos = routePedidos();
  if (!pedidos.length) { alert('Não há pedidos com status "EM ROTA DE ENTREGA".'); return; }
  const data = refs.dataRota.value || new Date().toISOString().slice(0,10);
  const lines = [`*ROTA (${formatDateBR(data)})*`, ""];
  pedidos.forEach(p => { lines.push(`*${p.nomeCliente}*`); lines.push(routeItemSummary(p.itens)); lines.push(`📍 ${mapsLink(p)}`); lines.push(""); });
  openWhatsApp(lines.join("\\n").trim());
});
refs.btnImprimirRota.addEventListener("click", () => {
  if (!routePedidos().length) { alert('Não há pedidos com status "EM ROTA DE ENTREGA".'); return; }
  refs.filtroStatus.value = "EM ROTA DE ENTREGA"; renderAll(); window.print();
});
refs.busca.addEventListener("input", renderAll);
refs.filtroStatus.addEventListener("change", renderAll);
refs.filtroLoja.addEventListener("change", renderAll);

refs.btnExportar.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(getPedidos(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "dunorte-pedidos-pro.json"; a.click(); URL.revokeObjectURL(url);
});
refs.inputImportar.addEventListener("change", (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result); if (!Array.isArray(data)) throw new Error();
      savePedidos(data); renderAll(); alert("Importação concluída.");
    } catch { alert("Arquivo inválido."); }
    e.target.value = "";
  };
  reader.readAsText(file);
});
function renderAll() { renderPedidos(); }

(function init() {
  refs.dataRota.value = new Date().toISOString().slice(0,10);
  resetForm();
  if (isLogged()) showDashboard(); else showLogin();
})();
