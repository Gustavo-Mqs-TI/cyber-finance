/* =========================================================
   FINANÇA — Controle Financeiro Pessoal
   Script completo
========================================================= */

/* =========================================================
   ESPERA O FIREBASE CARREGAR
========================================================= */

function esperarFirebase() {
  return new Promise((resolve) => {
    if (window.firebaseReady) return resolve();
    window.addEventListener("firebase-ready", () => resolve(), { once: true });
  });
}

/* =========================================================
   ESTADO GLOBAL
========================================================= */

let usuarios = JSON.parse(localStorage.getItem("financa_usuarios")) || [];
let usuarioLogado = null;

let transacoes = [];
let configUsuario = {
  beneficios: [],
  bancos: [],
  modalidades: [],
};

let coresPersonalizadas = {
  entrada: "#10b981",
  saida: "#ef4444",
  saldo: "#6366f1",
  beneficios: {},
  bancos: {},
};

let beneficioSelecionado = null;
let transacoesOriginais = [];
let bancoSelecionadoFatura = null;
let comprasOriginais = [];

const THEME_KEY = "financa_tema";

/* =========================================================
   HELPERS
========================================================= */

function formatarMoeda(v) {
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function $(id) {
  return document.getElementById(id);
}

function gerarId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function normalizarIdBanco(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function dataHoje() {
  return new Date().toISOString().split("T")[0];
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function formatarData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* =========================================================
   TOASTS
========================================================= */

function toast(mensagem, tipo = "info") {
  const container = $("toastContainer");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = mensagem;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

/* =========================================================
   EXPOR HELPERS GLOBALMENTE
========================================================= */

window.formatarMoeda = formatarMoeda;
window.formatarData = formatarData;
window.dataHoje = dataHoje;
window.toast = toast;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;

Object.defineProperty(window, "usuarioLogado", {
  get: () => usuarioLogado,
  configurable: true,
});

Object.defineProperty(window, "configUsuario", {
  get: () => configUsuario,
  configurable: true,
});

Object.defineProperty(window, "transacoes", {
  get: () => transacoes,
  configurable: true,
});

Object.defineProperty(window, "coresPersonalizadas", {
  get: () => coresPersonalizadas,
  configurable: true,
});

/* =========================================================
   TEMA
========================================================= */

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(THEME_KEY, tema);
}

function alternarTema() {
  const atual = document.documentElement.getAttribute("data-theme") || "dark";
  aplicarTema(atual === "dark" ? "light" : "dark");
}

/* =========================================================
   NAVEGAÇÃO ENTRE TELAS
========================================================= */

function mostrarTela(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  // Trava a rolagem quando NÃO for o app principal
  document.body.classList.toggle("auth-mode", id !== "telaApp");

  window.scrollTo(0, 0);
}

function mostrarApp() {
  mostrarTela("telaApp");
}

/* =========================================================
   LOGIN / REGISTRO / RECUPERAR
========================================================= */

if (usuarios.length === 0) {
  usuarios.push({
    id: 1,
    nome: "Usuário Demo",
    email: "demo@financeiro.com",
    senha: "123456",
  });
  localStorage.setItem("financa_usuarios", JSON.stringify(usuarios));
}

function salvarUsuarios() {
  localStorage.setItem("financa_usuarios", JSON.stringify(usuarios));
}

$("formLogin").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const senha = $("loginSenha").value;

  const user = usuarios.find((u) => u.email === email && u.senha === senha);
  if (!user) {
    toast("E-mail ou senha incorretos", "error");
    return;
  }

  usuarioLogado = { id: user.id, nome: user.nome, email: user.email };
  sessionStorage.setItem("financa_usuario", JSON.stringify(usuarioLogado));

  toast(`Bem-vindo, ${user.nome.split(" ")[0]}!`, "success");
  iniciarSessao();
});

$("formRegistro").addEventListener("submit", (e) => {
  e.preventDefault();

  const nome = $("regNome").value.trim();
  const email = $("regEmail").value.trim();
  const senha = $("regSenha").value;
  const confirmar = $("regConfirmarSenha").value;

  if (senha !== confirmar) { toast("As senhas não coincidem", "error"); return; }
  if (senha.length < 6) { toast("A senha deve ter no mínimo 6 caracteres", "error"); return; }
  if (usuarios.find((u) => u.email === email)) { toast("E-mail já cadastrado", "error"); return; }

  usuarios.push({ id: gerarId(), nome, email, senha });
  salvarUsuarios();

  toast("Conta criada com sucesso!", "success");
  $("formRegistro").reset();
  mostrarTela("telaLogin");
});

$("formRecuperar").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("recEmail").value.trim();
  const user = usuarios.find((u) => u.email === email);

  if (!user) { toast("E-mail não encontrado", "error"); return; }

  toast(`Sua senha é: ${user.senha}`, "info");
  $("formRecuperar").reset();
  mostrarTela("telaLogin");
});

/* =========================================================
   CONFIGURAÇÃO INICIAL
========================================================= */

function adicionarItemConfig(listaId) {
  const lista = $(listaId);
  const div = document.createElement("div");
  div.className = "item-row";
  div.innerHTML = `
    <input type="text" class="item-input" placeholder="Digite...">
    <button type="button" class="item-remove" onclick="removerItemConfig(this)" aria-label="Remover">×</button>
  `;
  lista.appendChild(div);
  div.querySelector("input").focus();
}

function adicionarSugestao(listaId, valor) {
  const lista = $(listaId);
  const div = document.createElement("div");
  div.className = "item-row";
  div.innerHTML = `
    <input type="text" class="item-input" value="${valor}">
    <button type="button" class="item-remove" onclick="removerItemConfig(this)" aria-label="Remover">×</button>
  `;
  lista.appendChild(div);
}

function removerItemConfig(btn) {
  btn.parentElement.remove();
}

$("formConfiguracao").addEventListener("submit", (e) => {
  e.preventDefault();

  const beneficios = [...document.querySelectorAll("#listaBeneficiosConfig .item-input")]
    .map((i) => i.value.trim().toUpperCase())
    .filter(Boolean);

  const bancos = [...document.querySelectorAll("#listaBancosConfig .item-input")]
    .map((i) => i.value.trim())
    .filter(Boolean);

  const modalidades = [...document.querySelectorAll("#listaModalidadesConfig .item-input")]
    .map((i) => i.value.trim())
    .filter(Boolean);

  if (bancos.length === 0 || modalidades.length === 0) {
    toast("Cadastre ao menos um banco e uma forma de pagamento", "error");
    return;
  }

  configUsuario = { beneficios, bancos, modalidades };
  salvarConfiguracoes(usuarioLogado.id);

  toast("Configurações salvas!", "success");
  aplicarConfiguracoes();
  mostrarApp();
  atualizarTudo();

  iniciarModulos();
});

/* =========================================================
   PERSISTÊNCIA
========================================================= */

function salvarConfiguracoes(userId) {
  localStorage.setItem(`financa_config_${userId}`, JSON.stringify(configUsuario));
}

function carregarConfiguracoes(userId) {
  const raw = localStorage.getItem(`financa_config_${userId}`);
  if (raw) {
    configUsuario = JSON.parse(raw);
    return true;
  }
  return false;
}

function salvarTransacoes() {
  if (!usuarioLogado) return;
  localStorage.setItem(`financa_dados_${usuarioLogado.id}`, JSON.stringify(transacoes));
}

function carregarTransacoes() {
  if (!usuarioLogado) return;
  const raw = localStorage.getItem(`financa_dados_${usuarioLogado.id}`);
  transacoes = raw ? JSON.parse(raw) : [];
}

function salvarCores() {
  if (!usuarioLogado) return;
  localStorage.setItem(`financa_cores_${usuarioLogado.id}`, JSON.stringify(coresPersonalizadas));
}

function carregarCores() {
  if (!usuarioLogado) return;
  const raw = localStorage.getItem(`financa_cores_${usuarioLogado.id}`);
  if (raw) coresPersonalizadas = JSON.parse(raw);
}

/* =========================================================
   APLICAR CONFIGURAÇÕES
========================================================= */

function aplicarConfiguracoes() {
  [$("banco"), $("editarBanco")].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Nenhum</option>';
    configUsuario.bancos.forEach((b) => {
      sel.innerHTML += `<option value="${b}">${b}</option>`;
    });
  });

  const filtroBanco = $("filtroBanco");
  if (filtroBanco) {
    filtroBanco.innerHTML = "";
    configUsuario.bancos.forEach((b) => {
      filtroBanco.innerHTML += `
        <label class="check-pill">
          <input type="checkbox" value="${b}">
          <span>${b}</span>
        </label>
      `;
    });
  }

  const todasModalidades = [...configUsuario.beneficios, ...configUsuario.modalidades];

  [$("modalidade"), $("editarModalidade")].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione</option>';
    todasModalidades.forEach((m) => {
      sel.innerHTML += `<option value="${m}">${m}</option>`;
    });
  });

  const filtroMod = $("filtroModalidade");
  if (filtroMod) {
    filtroMod.innerHTML = "";
    todasModalidades.forEach((m) => {
      filtroMod.innerHTML += `
        <label class="check-pill">
          <input type="checkbox" value="${m}">
          <span>${m}</span>
        </label>
      `;
    });
  }

  renderBeneficiosCards();
  renderFaturaCards();
  aplicarCores();
}

/* =========================================================
   INICIAR SESSÃO
========================================================= */

function iniciarModulos() {
  if (typeof window.criptoIniciar === "function") window.criptoIniciar();
  if (typeof window.parcelasIniciar === "function") window.parcelasIniciar();
  if (typeof window.recorrentesIniciar === "function") window.recorrentesIniciar();
  if (typeof window.metasIniciar === "function") window.metasIniciar();
  if (typeof window.graficosIniciar === "function") window.graficosIniciar();
}

function iniciarSessao() {
  $("userNome").textContent = usuarioLogado.nome;
  $("userEmail").textContent = usuarioLogado.email;
  $("userAvatar").textContent = usuarioLogado.nome.charAt(0).toUpperCase();

  const jaConfigurado = carregarConfiguracoes(usuarioLogado.id);
  carregarTransacoes();
  carregarCores();

  if (!jaConfigurado) {
    mostrarTela("telaConfiguracao");
  } else {
    aplicarConfiguracoes();
    aplicarCores();
    mostrarApp();
    atualizarTudo();
    iniciarModulos();
  }
}

function verificarLogin() {
  const raw = sessionStorage.getItem("financa_usuario");
  if (raw) {
    usuarioLogado = JSON.parse(raw);
    iniciarSessao();
  } else {
    mostrarTela("telaLogin");
  }
}

function logout() {
  sessionStorage.removeItem("financa_usuario");
  usuarioLogado = null;
  transacoes = [];
  configUsuario = { beneficios: [], bancos: [], modalidades: [] };
  beneficioSelecionado = null;
  bancoSelecionadoFatura = null;
  toast("Sessão encerrada", "info");
  mostrarTela("telaLogin");
}

/* =========================================================
   NAVEGAÇÃO ENTRE ABAS
========================================================= */

const titulosAbas = {
  geral: { titulo: "Visão geral", subtitulo: "Acompanhe suas finanças em tempo real" },
  beneficios: { titulo: "Benefícios", subtitulo: "Acompanhe seus cartões de benefício" },
  fatura: { titulo: "Fatura", subtitulo: "Controle suas compras no crédito" },
  criptos: { titulo: "Criptos", subtitulo: "Acompanhe sua carteira de criptomoedas" },
  parcelas: { titulo: "Parcelas", subtitulo: "Compras parceladas e suas faturas futuras" },
  recorrentes: { titulo: "Recorrentes", subtitulo: "Contas e recebimentos fixos mensais" },
  metas: { titulo: "Metas", subtitulo: "Objetivos de gasto, economia e cripto" },
  graficos: { titulo: "Gráficos", subtitulo: "Visualize sua vida financeira" },
};

function trocarAba(aba) {
  document.querySelectorAll(".aba").forEach((a) => a.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-aba]").forEach((b) => b.classList.remove("active"));

  const sec = $("aba" + aba.charAt(0).toUpperCase() + aba.slice(1));
  const btn = document.querySelector(`.nav-item[data-aba="${aba}"]`);

  if (sec) sec.classList.add("active");
  if (btn) btn.classList.add("active");

  const meta = titulosAbas[aba];
  if (meta) {
    $("pageTitle").textContent = meta.titulo;
    $("pageSubtitle").textContent = meta.subtitulo;
  }
}

document.querySelectorAll(".nav-item[data-aba]").forEach((btn) => {
  btn.addEventListener("click", () => trocarAba(btn.dataset.aba));
});

/* =========================================================
   TOGGLE DE FILTROS
========================================================= */

function toggleFiltro(containerId, btnEl) {
  const container = $(containerId);
  if (!container) return;
  container.classList.toggle("collapsed");
  if (btnEl) btnEl.classList.toggle("open", !container.classList.contains("collapsed"));
}

/* =========================================================
   CRUD — LANÇAMENTOS
========================================================= */

$("formGasto").addEventListener("submit", (e) => {
  e.preventDefault();

  const desc = $("descricao").value.trim();
  const val = parseFloat($("valor").value);
  const tipoVal = $("tipo").value;
  const bancoVal = $("banco").value;
  const modVal = $("modalidade").value;
  const dataVal = $("data").value;

  if (!desc || !val || !tipoVal || !modVal || !dataVal) {
    toast("Preencha todos os campos obrigatórios", "error");
    return;
  }

  transacoes.push({
    id: gerarId(),
    descricao: desc,
    valor: val,
    tipo: tipoVal,
    modalidade: modVal,
    banco: bancoVal || "",
    data: dataVal,
  });

  salvarTransacoes();
  e.target.reset();
  $("data").value = dataHoje();

  toast("Lançamento adicionado!", "success");
  atualizarTudo();
});

function removerTransacao(id) {
  if (!confirm("Deseja realmente excluir este lançamento?")) return;
  transacoes = transacoes.filter((t) => t.id !== id);
  salvarTransacoes();
  toast("Lançamento excluído", "info");
  atualizarTudo();
}

function abrirModalEditar(id) {
  const item = transacoes.find((t) => t.id === id);
  if (!item) return;

  $("editarId").value = item.id;
  $("editarDescricao").value = item.descricao;
  $("editarValor").value = item.valor;
  $("editarTipo").value = item.tipo;
  $("editarBanco").value = item.banco || "";
  $("editarModalidade").value = item.modalidade;
  $("editarData").value = item.data;

  $("modalEditar").classList.add("active");
}

function fecharModalEditar() {
  $("modalEditar").classList.remove("active");
  $("formEditar").reset();
}

$("formEditar").addEventListener("submit", (e) => {
  e.preventDefault();

  const id = parseInt($("editarId").value);
  const idx = transacoes.findIndex((t) => t.id === id);
  if (idx === -1) return;

  transacoes[idx] = {
    id,
    descricao: $("editarDescricao").value.trim(),
    valor: parseFloat($("editarValor").value),
    tipo: $("editarTipo").value,
    modalidade: $("editarModalidade").value,
    banco: $("editarBanco").value || "",
    data: $("editarData").value,
  };

  salvarTransacoes();
  fecharModalEditar();
  toast("Lançamento atualizado!", "success");
  atualizarTudo();
});

/* =========================================================
   RENDERIZAÇÃO — TABELA PRINCIPAL
========================================================= */

function atualizarTabela() {
  const lista = $("listaGastos");
  if (!lista) return;

  let dados = [...transacoes];

  const bancosSel = [...document.querySelectorAll("#filtroBanco input:checked")].map((i) => i.value);
  const tiposSel = [...document.querySelectorAll("#filtroTipo input:checked")].map((i) => i.value);
  const modsSel = [...document.querySelectorAll("#filtroModalidade input:checked")].map((i) => i.value);

  if (bancosSel.length) dados = dados.filter((t) => bancosSel.includes(t.banco));
  if (tiposSel.length) dados = dados.filter((t) => tiposSel.includes(t.tipo));
  if (modsSel.length) dados = dados.filter((t) => modsSel.includes(t.modalidade));

  dados.sort((a, b) => new Date(b.data) - new Date(a.data));

  $("contadorResultados").textContent = `${dados.length} ${dados.length === 1 ? "registro" : "registros"}`;

  if (dados.length === 0) {
    lista.innerHTML = `<tr class="empty-row"><td colspan="7">Nenhum lançamento encontrado</td></tr>`;
    return;
  }

  lista.innerHTML = dados.map((t) => {
    const tipoClasse = t.tipo === "entrada" ? "tipo-entrada" : "tipo-saida";
    const tipoLabel = t.tipo === "entrada" ? "Entrada" : "Saída";
    return `
      <tr>
        <td>${escapeHtml(t.descricao)}</td>
        <td class="valor-cell">${formatarMoeda(t.valor)}</td>
        <td class="${tipoClasse}">${tipoLabel}</td>
        <td>${escapeHtml(t.modalidade)}</td>
        <td>${t.banco ? escapeHtml(t.banco) : "—"}</td>
        <td>${formatarData(t.data)}</td>
        <td class="text-right">
          <div class="row-actions">
            <button class="action-btn" onclick="abrirModalEditar(${t.id})" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn danger" onclick="removerTransacao(${t.id})" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* =========================================================
   RESUMO
========================================================= */

function atualizarResumo() {
  let entrada = 0;
  let saida = 0;

  transacoes.forEach((t) => {
    if (configUsuario.beneficios.includes(t.modalidade)) return;
    if (t.tipo === "entrada") entrada += t.valor;
    else if (t.tipo === "saida" && t.modalidade !== "Crédito") saida += t.valor;
  });

  $("totalEntrada").textContent = formatarMoeda(entrada);
  $("totalSaida").textContent = formatarMoeda(saida);
  $("saldoFinal").textContent = formatarMoeda(entrada - saida);
}

/* =========================================================
   BENEFÍCIOS
========================================================= */

function renderBeneficiosCards() {
  const container = $("beneficiosContainer");
  if (!container) return;

  if (configUsuario.beneficios.length === 0) {
    container.innerHTML = `<div class="empty-cards">Nenhum benefício cadastrado.</div>`;
    return;
  }

  const saldos = {};
  configUsuario.beneficios.forEach((b) => (saldos[b] = 0));

  transacoes.forEach((t) => {
    if (configUsuario.beneficios.includes(t.modalidade)) {
      if (t.tipo === "entrada") saldos[t.modalidade] += t.valor;
      else saldos[t.modalidade] -= t.valor;
    }
  });

  container.innerHTML = configUsuario.beneficios.map((b) => {
    const cor = coresPersonalizadas.beneficios[b] || "#6366f1";
    return `
      <div class="beneficio-card" style="background: linear-gradient(135deg, ${cor}, ${cor})" onclick="filtrarBeneficio('${escapeAttr(b)}')">
        <div class="card-title">${escapeHtml(b)}</div>
        <div class="card-line"><span>Saldo</span><strong>${formatarMoeda(saldos[b])}</strong></div>
        <div class="card-hint">Clique para ver transações →</div>
      </div>
    `;
  }).join("");
}

function filtrarBeneficio(nome) {
  beneficioSelecionado = nome;
  transacoesOriginais = transacoes
    .filter((t) => t.modalidade === nome)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  $("beneficioFiltroAtivo").textContent = `${nome} — ${transacoesOriginais.length} transações`;
  limparFiltrosBeneficioUI();
  renderTabelaBeneficio(transacoesOriginais);
}

function renderTabelaBeneficio(lista) {
  const tbody = $("listaBeneficioFiltrado");
  if (!tbody) return;

  if (!beneficioSelecionado) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Clique em um benefício acima</td></tr>`;
    return;
  }
  if (lista.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Nenhuma transação encontrada</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((t) => {
    const tipoClasse = t.tipo === "entrada" ? "tipo-entrada" : "tipo-saida";
    const tipoLabel = t.tipo === "entrada" ? "Entrada" : "Saída";
    return `
      <tr>
        <td>${escapeHtml(t.descricao)}</td>
        <td class="valor-cell">${formatarMoeda(t.valor)}</td>
        <td class="${tipoClasse}">${tipoLabel}</td>
        <td>${formatarData(t.data)}</td>
      </tr>
    `;
  }).join("");
}

function aplicarFiltrosBeneficio() {
  if (!beneficioSelecionado) { toast("Clique em um benefício primeiro", "warning"); return; }

  let dados = [...transacoesOriginais];
  const inicio = $("filtroBeneficioDataInicio").value;
  const fim = $("filtroBeneficioDataFim").value;
  const min = parseFloat($("filtroBeneficioValorMin").value);
  const max = parseFloat($("filtroBeneficioValorMax").value);
  const busca = $("filtroBeneficioDescricao").value.toLowerCase().trim();
  const tipoFiltro = $("filtroBeneficioTipo").value;
  const ordenar = $("filtroBeneficioOrdenar").value;

  if (inicio) dados = dados.filter((t) => t.data >= inicio);
  if (fim) dados = dados.filter((t) => t.data <= fim);
  if (!isNaN(min)) dados = dados.filter((t) => t.valor >= min);
  if (!isNaN(max)) dados = dados.filter((t) => t.valor <= max);
  if (busca) dados = dados.filter((t) => t.descricao.toLowerCase().includes(busca));
  if (tipoFiltro !== "todos") dados = dados.filter((t) => t.tipo === tipoFiltro);

  if (ordenar === "data_desc") dados.sort((a, b) => new Date(b.data) - new Date(a.data));
  if (ordenar === "data_asc") dados.sort((a, b) => new Date(a.data) - new Date(b.data));
  if (ordenar === "valor_desc") dados.sort((a, b) => b.valor - a.valor);
  if (ordenar === "valor_asc") dados.sort((a, b) => a.valor - b.valor);

  renderTabelaBeneficio(dados);
  toast(`${dados.length} resultado(s)`, "info");
}

function limparFiltrosBeneficioUI() {
  $("filtroBeneficioDataInicio").value = "";
  $("filtroBeneficioDataFim").value = "";
  $("filtroBeneficioValorMin").value = "";
  $("filtroBeneficioValorMax").value = "";
  $("filtroBeneficioDescricao").value = "";
  $("filtroBeneficioTipo").value = "todos";
  $("filtroBeneficioOrdenar").value = "data_desc";
}

/* =========================================================
   FATURA
========================================================= */

function renderFaturaCards() {
  const container = $("faturaContainer");
  if (!container) return;

  if (configUsuario.bancos.length === 0) {
    container.innerHTML = `<div class="empty-cards">Nenhum banco cadastrado.</div>`;
    return;
  }

  const totaisFatura = {};
  const saldosBancos = {};
  configUsuario.bancos.forEach((b) => {
    totaisFatura[b] = 0;
    saldosBancos[b] = 0;
  });

  transacoes.forEach((t) => {
    if (!t.banco || !configUsuario.bancos.includes(t.banco)) return;
    if (t.modalidade === "Crédito" && t.tipo === "saida") totaisFatura[t.banco] += t.valor;
    if (t.tipo === "entrada") saldosBancos[t.banco] += t.valor;
    else if (t.tipo === "saida" && t.modalidade !== "Crédito") saldosBancos[t.banco] -= t.valor;
  });

  if (typeof window.totalParcelasPorBancoNoMes === "function") {
    const mesAtual = new Date().toISOString().substring(0, 7);
    const parcelasMes = window.totalParcelasPorBancoNoMes(mesAtual);
    Object.keys(parcelasMes).forEach((b) => {
      if (totaisFatura[b] !== undefined) totaisFatura[b] += parcelasMes[b];
    });
  }

  container.innerHTML = configUsuario.bancos.map((b) => {
    const cor = coresPersonalizadas.bancos[b] || "#6366f1";
    return `
      <div class="banco-card" style="background: linear-gradient(135deg, ${cor}, ${cor})" onclick="filtrarBancoCredito('${escapeAttr(b)}')">
        <div class="card-title">${escapeHtml(b)}</div>
        <div class="card-line"><span>Fatura</span><strong>${formatarMoeda(totaisFatura[b])}</strong></div>
        <div class="card-line"><span>Saldo</span><strong>${formatarMoeda(saldosBancos[b])}</strong></div>
        <div class="card-hint">Clique para ver compras →</div>
      </div>
    `;
  }).join("");
}

function filtrarBancoCredito(nome) {
  bancoSelecionadoFatura = nome;

  const mesAtual = new Date().toISOString().substring(0, 7);
  comprasOriginais = transacoes
    .filter((t) => t.modalidade === "Crédito" && t.tipo === "saida" && t.banco === nome)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  if (typeof window.parcelasDoMes === "function") {
    const parcelas = window.parcelasDoMes(mesAtual).filter((p) => p.banco === nome);
    parcelas.forEach((p) => {
      comprasOriginais.push({
        descricao: `${p.descricao} (${p.numero}/${p.total})`,
        valor: p.valor,
        banco: p.banco,
        data: p.data,
        modalidade: "Crédito",
        _parcela: true,
      });
    });
    comprasOriginais.sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  $("tituloFaturaFiltro").textContent = nome;
  $("filtroBancoAtivo").textContent = `${comprasOriginais.length} compras`;
  limparFiltrosFaturaUI();
  renderTabelaFatura(comprasOriginais);
}

function renderTabelaFatura(lista) {
  const tbody = $("listaFatura");
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Nenhuma compra encontrada</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((t) => `
    <tr>
      <td>${escapeHtml(t.descricao)}</td>
      <td class="valor-cell tipo-saida">${formatarMoeda(t.valor)}</td>
      <td>${escapeHtml(t.banco || "—")}</td>
      <td>${formatarData(t.data)}</td>
      <td>Crédito</td>
    </tr>
  `).join("");
}

function aplicarFiltrosFatura() {
  if (!bancoSelecionadoFatura) { toast("Clique em um banco primeiro", "warning"); return; }

  let dados = [...comprasOriginais];
  const inicio = $("filtroDataInicio").value;
  const fim = $("filtroDataFim").value;
  const min = parseFloat($("filtroValorMin").value);
  const max = parseFloat($("filtroValorMax").value);
  const busca = $("filtroDescricao").value.toLowerCase().trim();
  const ordenar = $("filtroOrdenar").value;

  if (inicio) dados = dados.filter((t) => t.data >= inicio);
  if (fim) dados = dados.filter((t) => t.data <= fim);
  if (!isNaN(min)) dados = dados.filter((t) => t.valor >= min);
  if (!isNaN(max)) dados = dados.filter((t) => t.valor <= max);
  if (busca) dados = dados.filter((t) => t.descricao.toLowerCase().includes(busca));

  if (ordenar === "data_desc") dados.sort((a, b) => new Date(b.data) - new Date(a.data));
  if (ordenar === "data_asc") dados.sort((a, b) => new Date(a.data) - new Date(b.data));
  if (ordenar === "valor_desc") dados.sort((a, b) => b.valor - a.valor);
  if (ordenar === "valor_asc") dados.sort((a, b) => a.valor - b.valor);

  renderTabelaFatura(dados);
  toast(`${dados.length} resultado(s)`, "info");
}

function limparFiltrosFaturaUI() {
  $("filtroDataInicio").value = "";
  $("filtroDataFim").value = "";
  $("filtroValorMin").value = "";
  $("filtroValorMax").value = "";
  $("filtroDescricao").value = "";
  $("filtroOrdenar").value = "data_desc";
}

/* =========================================================
   CORES PERSONALIZADAS
========================================================= */

function abrirPersonalizacaoCores() {
  fecharTodosModais();

  const listaB = $("listaCoresBeneficios");
  if (listaB) {
    listaB.innerHTML = configUsuario.beneficios.length
      ? configUsuario.beneficios.map((b) => `
          <div class="color-item">
            <span>${escapeHtml(b)}</span>
            <input type="color" class="cor-beneficio-input" data-nome="${escapeAttr(b)}" value="${coresPersonalizadas.beneficios[b] || "#6366f1"}">
          </div>
        `).join("")
      : `<div class="empty-cards">Nenhum benefício cadastrado</div>`;
  }

  const listaBc = $("listaCoresBancos");
  if (listaBc) {
    listaBc.innerHTML = configUsuario.bancos.length
      ? configUsuario.bancos.map((b) => `
          <div class="color-item">
            <span>${escapeHtml(b)}</span>
            <input type="color" class="cor-banco-input" data-nome="${escapeAttr(b)}" value="${coresPersonalizadas.bancos[b] || "#6366f1"}">
          </div>
        `).join("")
      : `<div class="empty-cards">Nenhum banco cadastrado</div>`;
  }

  $("corEntrada").value = coresPersonalizadas.entrada;
  $("corSaida").value = coresPersonalizadas.saida;
  $("corSaldo").value = coresPersonalizadas.saldo;

  if (typeof window.renderListaCoresCriptos === "function") window.renderListaCoresCriptos();

  $("telaCores").classList.add("active");
}

$("formCores").addEventListener("submit", (e) => {
  e.preventDefault();

  coresPersonalizadas.entrada = $("corEntrada").value;
  coresPersonalizadas.saida = $("corSaida").value;
  coresPersonalizadas.saldo = $("corSaldo").value;

  document.querySelectorAll(".cor-beneficio-input").forEach((inp) => {
    coresPersonalizadas.beneficios[inp.dataset.nome] = inp.value;
  });

  document.querySelectorAll(".cor-banco-input").forEach((inp) => {
    coresPersonalizadas.bancos[inp.dataset.nome] = inp.value;
  });

  salvarCores();
  aplicarCores();

  if (typeof window.criptoAplicarCoresDoModal === "function") window.criptoAplicarCoresDoModal();

  toast("Cores salvas com sucesso!", "success");
  fecharTodosModais();
});

function aplicarCores() {
  const cE = coresPersonalizadas.entrada;
  const cS = coresPersonalizadas.saida;
  const cSaldo = coresPersonalizadas.saldo;

  const mc = document.querySelector('.metric-card[data-metric="entrada"]');
  const ms = document.querySelector('.metric-card[data-metric="saida"]');
  const mSa = document.querySelector('.metric-card[data-metric="saldo"]');

  if (mc) mc.querySelector(".metric-value").style.color = cE;
  if (ms) ms.querySelector(".metric-value").style.color = cS;
  if (mSa) mSa.querySelector(".metric-value").style.color = cSaldo;

  renderBeneficiosCards();
  renderFaturaCards();
}

/* =========================================================
   PERFIL
========================================================= */

function abrirPerfil() {
  fecharTodosModais();
  renderPerfilInfo();
  $("telaPerfil").classList.add("active");
}

function renderPerfilInfo() {
  const container = $("perfilInfo");
  if (!container || !usuarioLogado) return;

  const listaB = configUsuario.beneficios.length
    ? configUsuario.beneficios.map((b) => `<li>${escapeHtml(b)}</li>`).join("")
    : "<li>Nenhum</li>";
  const listaBc = configUsuario.bancos.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
  const listaM = configUsuario.modalidades.map((m) => `<li>${escapeHtml(m)}</li>`).join("");

  container.innerHTML = `
    <h4>Dados pessoais</h4>
    <p><strong>Nome:</strong> ${escapeHtml(usuarioLogado.nome)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(usuarioLogado.email)}</p>
    <h4>Benefícios</h4>
    <ul>${listaB}</ul>
    <h4>Bancos</h4>
    <ul>${listaBc}</ul>
    <h4>Formas de pagamento</h4>
    <ul>${listaM}</ul>
  `;
}

function abrirConfiguracoes() {
  fecharTodosModais();

  const listaB = $("listaBeneficiosConfig");
  listaB.innerHTML = "";
  configUsuario.beneficios.forEach((b) => {
    listaB.innerHTML += `
      <div class="item-row">
        <input type="text" class="item-input" value="${escapeHtml(b)}">
        <button type="button" class="item-remove" onclick="removerItemConfig(this)">×</button>
      </div>
    `;
  });

  const listaBc = $("listaBancosConfig");
  listaBc.innerHTML = "";
  configUsuario.bancos.forEach((b) => {
    listaBc.innerHTML += `
      <div class="item-row">
        <input type="text" class="item-input" value="${escapeHtml(b)}">
        <button type="button" class="item-remove" onclick="removerItemConfig(this)">×</button>
      </div>
    `;
  });

  const listaM = $("listaModalidadesConfig");
  listaM.innerHTML = "";
  configUsuario.modalidades.forEach((m) => {
    listaM.innerHTML += `
      <div class="item-row">
        <input type="text" class="item-input" value="${escapeHtml(m)}">
        <button type="button" class="item-remove" onclick="removerItemConfig(this)">×</button>
      </div>
    `;
  });

  mostrarTela("telaConfiguracao");
}

/* =========================================================
   MODAIS
========================================================= */

function fecharTodosModais() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.remove("active"));
}

document.querySelectorAll(".fechar-modal").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.close;
    if (target) $(target).classList.remove("active");
    else fecharTodosModais();
  });
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });
});

document.querySelectorAll(".btn-cancelar").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = btn.closest(".modal");
    if (modal) modal.classList.remove("active");
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharTodosModais();
});

/* =========================================================
   BOTÕES GLOBAIS
========================================================= */

$("btnTema").addEventListener("click", alternarTema);
$("btnCores").addEventListener("click", abrirPersonalizacaoCores);
$("btnPerfilSide").addEventListener("click", abrirPerfil);
$("btnLogout").addEventListener("click", logout);
$("userChip")?.addEventListener("click", abrirPerfil);

$("btnAplicarFiltro").addEventListener("click", () => {
  atualizarTabela();
  toast("Filtros aplicados", "info");
});
$("btnLimparFiltro").addEventListener("click", () => {
  document.querySelectorAll("#filtroBanco input, #filtroModalidade input, #filtroTipo input").forEach((i) => (i.checked = false));
  atualizarTabela();
});

$("btnAplicarFiltroBeneficio").addEventListener("click", aplicarFiltrosBeneficio);
$("btnLimparFiltroBeneficio").addEventListener("click", () => {
  limparFiltrosBeneficioUI();
  if (beneficioSelecionado) renderTabelaBeneficio(transacoesOriginais);
});

$("btnAplicarFiltroFatura").addEventListener("click", aplicarFiltrosFatura);
$("btnLimparFiltroFatura").addEventListener("click", () => {
  limparFiltrosFaturaUI();
  if (bancoSelecionadoFatura) renderTabelaFatura(comprasOriginais);
});

/* =========================================================
   ATUALIZAÇÃO GERAL
========================================================= */

function atualizarTudo() {
  atualizarTabela();
  atualizarResumo();
  renderBeneficiosCards();
  renderFaturaCards();
  aplicarCores();
}

/* =========================================================
   INICIALIZAÇÃO — espera o Firebase antes de tudo
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const temaSalvo = localStorage.getItem(THEME_KEY) || "dark";
  aplicarTema(temaSalvo);

  const campoData = $("data");
  if (campoData) campoData.value = dataHoje();

  // 🔥 Espera o Firebase carregar antes de continuar
  await esperarFirebase();

  console.log("✅ Firebase pronto, iniciando app...");
  console.log("   Auth:", typeof window.firebaseAuth);
  console.log("   DB:", typeof window.firebaseDB);

  verificarLogin();
});
