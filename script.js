/* =========================================================
   FINANÇA — Controle Financeiro Pessoal
   Script principal (migrado para Firestore)
========================================================= */

/* =========================================================
   ESPERA O FIREBASE CARREGAR
========================================================= */

function esperarFirebase() {
  return new Promise((resolve) => {
    if (window.firebaseReady) return resolve();
    window.addEventListener(
      "firebase-ready",
      () => resolve(),
      { once: true }
    );
  });
}

/* =========================================================
   ESTADO GLOBAL
========================================================= */

let usuarioLogado = null;
let transacoes = [];
let configUsuario = {
  beneficios: [],
  bancos: [],
  modalidades: [],
  bancoProximoMesFatura: {},
  faturasFechadas: {},
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

function normalizarZero(v) {
  const n = Number(v) || 0;
  return Math.abs(n) < 0.005 ? 0 : n;
}

function $(id) {
  return document.getElementById(id);
}

function gerarId() {
  return Date.now() + Math.floor(Math.random() * 1000);
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
  return String(str)
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

function formatarData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* =========================================================
   HELPERS DE MÊS
========================================================= */

function mesSeguinte(ref) {
  const [ano, mes] = ref.split("-").map(Number);
  const novoMes = mes === 12 ? 1 : mes + 1;
  const novoAno = mes === 12 ? ano + 1 : ano;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

function mesAnterior(ref) {
  const [ano, mes] = ref.split("-").map(Number);
  const novoMes = mes === 1 ? 12 : mes - 1;
  const novoAno = mes === 1 ? ano - 1 : ano;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
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
window.normalizarZero = normalizarZero;
window.mesSeguinte = mesSeguinte;
window.mesAnterior = mesAnterior;

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
  document.body.classList.toggle("auth-mode", id !== "telaApp");
  window.scrollTo(0, 0);
}

window.mostrarTela = mostrarTela;

function mostrarApp() {
  mostrarTela("telaApp");
}

/* =========================================================
   LOGIN
========================================================= */

$("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("loginEmail").value.trim();
  const senha = $("loginSenha").value;

  if (!email || !senha) {
    toast("Preencha o e-mail e a senha", "error");
    return;
  }

  try {
    const user = await window.fbLogin(email, senha);

    usuarioLogado = {
      uid: user.uid,
      nome: user.displayName || "Usuário",
      email: user.email,
    };

    sessionStorage.setItem("financa_usuario", JSON.stringify(usuarioLogado));

    toast(`Bem-vindo, ${usuarioLogado.nome.split(" ")[0]}!`, "success");

    await iniciarSessao();

  } catch (error) {
    console.error("Erro no login Firebase:", error);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      toast("E-mail ou senha incorretos", "error");
    } else if (error.code === "auth/too-many-requests") {
      toast("Muitas tentativas. Aguarde alguns minutos.", "error");
    } else {
      toast("Não foi possível realizar o login", "error");
    }
  }
});

/* =========================================================
   CADASTRO
========================================================= */

$("formRegistro").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = $("regNome").value.trim();
  const email = $("regEmail").value.trim();
  const senha = $("regSenha").value;
  const confirmar = $("regConfirmarSenha").value;

  if (!nome || !email || !senha || !confirmar) {
    toast("Preencha todos os campos", "error");
    return;
  }

  if (senha !== confirmar) {
    toast("As senhas não coincidem", "error");
    return;
  }

  if (senha.length < 6) {
    toast("A senha deve ter no mínimo 6 caracteres", "error");
    return;
  }

  try {
    const user = await window.fbCadastrar(email, senha, nome);
    console.log("Usuário criado no Firebase:", user);

    toast("Conta criada com sucesso!", "success");
    $("formRegistro").reset();
    mostrarTela("telaLogin");

  } catch (error) {
    console.error("Erro no cadastro Firebase:", error);

    if (error.code === "auth/email-already-in-use") {
      toast("Este e-mail já está cadastrado", "error");
    } else if (error.code === "auth/invalid-email") {
      toast("E-mail inválido", "error");
    } else if (error.code === "auth/weak-password") {
      toast("A senha é muito fraca", "error");
    } else {
      toast("Não foi possível criar a conta", "error");
    }
  }
});

/* =========================================================
   RECUPERAÇÃO DE SENHA
========================================================= */

$("formRecuperar").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("recEmail").value.trim();

  if (!email) {
    toast("Digite seu e-mail", "error");
    return;
  }

  try {
    await window.fbRecuperarSenha(email);
    toast("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.", "success");
    $("formRecuperar").reset();
    mostrarTela("telaLogin");

  } catch (error) {
    console.error("Erro ao recuperar senha:", error);

    if (error.code === "auth/invalid-email") {
      toast("E-mail inválido", "error");
    } else if (error.code === "auth/user-not-found") {
      toast("Não foi possível localizar este e-mail", "error");
    } else {
      toast("Não foi possível enviar o link de recuperação", "error");
    }
  }
});

/* =========================================================
   PERSISTÊNCIA — FIRESTORE
========================================================= */

async function salvarConfiguracoes() {
  if (!usuarioLogado) return;
  await window.fbSalvarDoc(usuarioLogado.uid, configUsuario, "config", "geral");
}

async function carregarConfiguracoes() {
  if (!usuarioLogado) return false;
  const cfg = await window.fbCarregarDoc(usuarioLogado.uid, "config", "geral");
  if (cfg) {
    configUsuario = {
      beneficios: cfg.beneficios || [],
      bancos: cfg.bancos || [],
      modalidades: cfg.modalidades || [],
      bancoProximoMesFatura: cfg.bancoProximoMesFatura || {},
      faturasFechadas: cfg.faturasFechadas || {},
    };
    return true;
  }
  return false;
}

async function salvarTransacoes() {
  if (!usuarioLogado) return;
  await window.fbSubstituirColecao(usuarioLogado.uid, "transacoes", transacoes);
}

async function carregarTransacoes() {
  if (!usuarioLogado) return;
  const arr = await window.fbCarregarColecao(usuarioLogado.uid, "transacoes");
  transacoes = arr.map((t) => {
    const { _fbId, ...resto } = t;
    return resto;
  });
}

async function salvarCores() {
  if (!usuarioLogado) return;
  await window.fbSalvarDoc(usuarioLogado.uid, coresPersonalizadas, "cores", "geral");
}

async function carregarCores() {
  if (!usuarioLogado) return;
  const c = await window.fbCarregarDoc(usuarioLogado.uid, "cores", "geral");
  if (c) {
    coresPersonalizadas = {
      entrada: c.entrada || "#10b981",
      saida: c.saida || "#ef4444",
      saldo: c.saldo || "#6366f1",
      beneficios: c.beneficios || {},
      bancos: c.bancos || {},
    };
  }
}

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

$("formConfiguracao").addEventListener("submit", async (e) => {
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

  configUsuario = {
    ...configUsuario,
    beneficios,
    bancos,
    modalidades,
  };

  await salvarConfiguracoes();

  toast("Configurações salvas!", "success");

  aplicarConfiguracoes();
  mostrarApp();
  atualizarTudo();
  iniciarModulos();
});

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
  const modulos = {
    criptoIniciar: window.criptoIniciar,
    parcelasIniciar: window.parcelasIniciar,
    recorrentesIniciar: window.recorrentesIniciar,
    metasIniciar: window.metasIniciar,
    graficosIniciar: window.graficosIniciar,
  };

  Object.entries(modulos).forEach(([nome, fn]) => {
    if (typeof fn === "function") {
      try {
        fn();
      } catch (e) {
        console.error(`❌ Erro ao iniciar ${nome}:`, e);
      }
    } else {
      console.warn(`⚠️ ${nome} não está disponível ainda`);
    }
  });
}

async function iniciarSessao() {
  $("userNome").textContent = usuarioLogado.nome;
  $("userEmail").textContent = usuarioLogado.email;
  $("userAvatar").textContent = usuarioLogado.nome.charAt(0).toUpperCase();

  const jaConfigurado = await carregarConfiguracoes();
  await carregarTransacoes();
  await carregarCores();
  await carregarFaturasSalvas();

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

async function logout() {
  try {
    if (typeof window.fbLogout === "function") {
      await window.fbLogout();
    }
  } catch (error) {
    console.error("Erro ao encerrar sessão no Firebase:", error);
  }

  sessionStorage.removeItem("financa_usuario");
  usuarioLogado = null;
  transacoes = [];
  configUsuario = {
    beneficios: [],
    bancos: [],
    modalidades: [],
    bancoProximoMesFatura: {},
    faturasFechadas: {},
  };
  coresPersonalizadas = {
    entrada: "#10b981",
    saida: "#ef4444",
    saldo: "#6366f1",
    beneficios: {},
    bancos: {},
  };
  beneficioSelecionado = null;
  transacoesOriginais = [];
  bancoSelecionadoFatura = null;
  comprasOriginais = [];
  faturasSalvas = {};

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
  if (btnEl) {
    btnEl.classList.toggle("open", !container.classList.contains("collapsed"));
  }
}

/* =========================================================
   CRUD — LANÇAMENTOS
========================================================= */

$("formGasto").addEventListener("submit", async (e) => {
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

  if (tipoVal === "saida" && !bancoVal) {
    toast("Toda saída precisa de um banco cadastrado.", "error");
    return;
  }

  const nova = {
    id: gerarId(),
    descricao: desc,
    valor: val,
    tipo: tipoVal,
    modalidade: modVal,
    banco: bancoVal || "",
    data: dataVal,
  };

  // 🔔 Se for CRÉDITO, decide em qual fatura a compra entra
  if (tipoVal === "saida" && modVal === "Crédito" && bancoVal) {
    const proximoMes = configUsuario.bancoProximoMesFatura?.[bancoVal];
    nova._mesFatura = proximoMes || dataVal.substring(0, 7);
  }

  transacoes.push(nova);

  await salvarTransacoes();

  e.target.reset();
  $("data").value = dataHoje();

  toast("Lançamento adicionado!", "success");
  atualizarTudo();
});

async function removerTransacao(id) {
  if (!confirm("Deseja realmente excluir este lançamento?")) return;

  transacoes = transacoes.filter((t) => t.id !== id);
  await salvarTransacoes();

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

$("formEditar").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = parseInt($("editarId").value);
  const idx = transacoes.findIndex((t) => t.id === id);
  if (idx === -1) return;

  const tipoVal = $("editarTipo").value;
  const bancoVal = $("editarBanco").value;

  if (tipoVal === "saida" && !bancoVal) {
    toast("Toda saída precisa de um banco cadastrado.", "error");
    return;
  }

  const dataVal = $("editarData").value;
  const modVal = $("editarModalidade").value;

  const atualizada = {
    id,
    descricao: $("editarDescricao").value.trim(),
    valor: parseFloat($("editarValor").value),
    tipo: tipoVal,
    modalidade: modVal,
    banco: bancoVal || "",
    data: dataVal,
  };

  const anterior = transacoes[idx];
  const eraCredito = anterior.modalidade === "Crédito" && anterior.tipo === "saida";
  const ehCredito = tipoVal === "saida" && modVal === "Crédito";

  if (ehCredito && bancoVal) {
    if (!eraCredito || anterior.banco !== bancoVal) {
      const proximoMes = configUsuario.bancoProximoMesFatura?.[bancoVal];
      atualizada._mesFatura = proximoMes || dataVal.substring(0, 7);
    } else {
      atualizada._mesFatura = anterior._mesFatura || dataVal.substring(0, 7);
    }
  } else {
    atualizada._mesFatura = undefined;
  }

  transacoes[idx] = atualizada;

  await salvarTransacoes();

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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="action-btn danger" onclick="removerTransacao(${t.id})" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* =========================================================
   CÁLCULO UNIFICADO DE SALDO
========================================================= */

function calcularSaldosPorBanco() {
  const porBanco = {};
  configUsuario.bancos.forEach((b) => (porBanco[b] = 0));
  let geral = 0;

  transacoes.forEach((t) => {
    if (configUsuario.beneficios.includes(t.modalidade)) return;
    if (t.tipo === "saida" && t.modalidade === "Crédito") return;

    const valor = t.tipo === "entrada" ? t.valor : -t.valor;

    geral += valor;

    if (t.banco && configUsuario.bancos.includes(t.banco)) {
      porBanco[t.banco] += valor;
    }
  });

  Object.keys(faturasSalvas).forEach((chave) => {
    const idx = chave.lastIndexOf("_");
    const b = chave.substring(0, idx);
    const salva = faturasSalvas[chave];
    if (!salva || salva.status !== "paga" || salva.valorFechado == null) return;

    const valor = Number(salva.valorFechado) || 0;
    geral -= valor;
    if (configUsuario.bancos.includes(b)) {
      porBanco[b] -= valor;
    }
  });

  geral = normalizarZero(geral);
  Object.keys(porBanco).forEach((b) => {
    porBanco[b] = normalizarZero(porBanco[b]);
  });

  return { geral, porBanco };
}

window.calcularSaldosPorBanco = calcularSaldosPorBanco;

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

  const { geral } = calcularSaldosPorBanco();
  $("saldoFinal").textContent = formatarMoeda(geral);
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
  if (!beneficioSelecionado) {
    toast("Clique em um benefício primeiro", "warning");
    return;
  }

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
  configUsuario.bancos.forEach((b) => (totaisFatura[b] = 0));

  transacoes.forEach((t) => {
    if (!t.banco || !configUsuario.bancos.includes(t.banco)) return;
    if (t.modalidade === "Crédito" && t.tipo === "saida") {
      totaisFatura[t.banco] += t.valor;
    }
  });

  if (typeof window.totalParcelasPorBancoNoMes === "function") {
    const mesAtual = new Date().toISOString().substring(0, 7);
    const parcelasMes = window.totalParcelasPorBancoNoMes(mesAtual);
    Object.keys(parcelasMes).forEach((b) => {
      if (totaisFatura[b] !== undefined) {
        totaisFatura[b] += parcelasMes[b];
      }
    });
  }

  const { porBanco } = calcularSaldosPorBanco();

  container.innerHTML = configUsuario.bancos.map((b) => {
    const cor = coresPersonalizadas.bancos[b] || "#6366f1";
    const saldo = porBanco[b] || 0;
    const saldoClasse = saldo < 0 ? "saldo-negativo" : "";
    return `
      <div class="banco-card" style="background: linear-gradient(135deg, ${cor}, ${cor})" onclick="filtrarBancoCredito('${escapeAttr(b)}')">
        <div class="card-title">${escapeHtml(b)}</div>
        <div class="card-line"><span>Fatura</span><strong>${formatarMoeda(totaisFatura[b])}</strong></div>
        <div class="card-line ${saldoClasse}"><span>Saldo</span><strong>${formatarMoeda(saldo)}</strong></div>
        <div class="card-hint">Clique para ver compras →</div>
      </div>
    `;
  }).join("");
}

function filtrarBancoCredito(nome) {
  bancoSelecionadoFatura = nome;
  abrirModalFaturas(nome);
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
  if (!bancoSelecionadoFatura) {
    toast("Clique em um banco primeiro", "warning");
    return;
  }

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
   FATURAS — Motor de cálculo
========================================================= */

let faturasSalvas = {};

function mesAtualRef() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMesAno(ref) {
  const [ano, mes] = ref.split("-").map(Number);
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${meses[mes - 1]}/${ano}`;
}

function mesAnoCurto(ref) {
  const [ano, mes] = ref.split("-").map(Number);
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  return `${meses[mes - 1]}/${ano}`;
}

function chaveFatura(banco, mes) {
  return `${banco}_${mes}`;
}

function mesFaturaDaTransacao(t) {
  if (t._mesFatura) return t._mesFatura;
  return t.data ? t.data.substring(0, 7) : null;
}

function comprasCreditoDoMes(banco, mes) {
  return transacoes.filter((t) => {
    return (
      t.banco === banco &&
      t.modalidade === "Crédito" &&
      t.tipo === "saida" &&
      mesFaturaDaTransacao(t) === mes
    );
  });
}

function parcelasDoMesBanco(banco, mes) {
  if (typeof window.parcelasDoMes !== "function") return [];
  return window.parcelasDoMes(mes).filter((p) => p.banco === banco);
}

function itensFatura(banco, mes) {
  const compras = comprasCreditoDoMes(banco, mes).map((t) => ({
    tipo: "compra",
    descricao: t.descricao,
    valor: t.valor,
    data: t.data,
  }));

  const parcelas = parcelasDoMesBanco(banco, mes).map((p) => ({
    tipo: "parcela",
    descricao: `${p.descricao} (${p.numero}/${p.total})`,
    valor: p.valor,
    data: p.data,
  }));

  return [...compras, ...parcelas].sort(
    (a, b) => new Date(a.data) - new Date(b.data)
  );
}

function totalFaturaDinamico(banco, mes) {
  return itensFatura(banco, mes).reduce((s, i) => s + i.valor, 0);
}

function statusFatura(banco, mes) {
  const chave = chaveFatura(banco, mes);
  const salva = faturasSalvas[chave];
  if (salva && salva.status) return salva.status;

  const mesAtual = mesAtualRef();
  if (mes > mesAtual) return "futura";
  if (mes === mesAtual) return "aberta";
  return "aberta";
}

function totalFaturaExibir(banco, mes) {
  const chave = chaveFatura(banco, mes);
  const salva = faturasSalvas[chave];
  const st = statusFatura(banco, mes);

  if ((st === "fechada" || st === "paga") && salva && salva.valorFechado != null) {
    return salva.valorFechado;
  }
  return totalFaturaDinamico(banco, mes);
}

function temComprasAposFechamento(banco, mes) {
  const chave = chaveFatura(banco, mes);
  const salva = faturasSalvas[chave];
  if (!salva) return false;
  if (salva.status !== "fechada" && salva.status !== "paga") return false;

  const totalAtual = totalFaturaDinamico(banco, mes);
  const totalCongelado = salva.valorFechado || 0;
  return totalAtual > totalCongelado + 0.01;
}

/* 🔔 Retorna o mês que foi fechado do banco (ex: "2026-01") */
function mesFechadoDoBanco(banco) {
  return configUsuario.faturasFechadas?.[banco] || null;
}

/* 🔔 Retorna o mês destino das próximas compras (ex: "2026-02") */
function bancoEstaFechado(banco) {
  return configUsuario.bancoProximoMesFatura?.[banco] || null;
}

/* 🔔 Retorna TRUE se ESSE mês específico é o que foi fechado */
function mesEstaFechado(banco, mes) {
  return mesFechadoDoBanco(banco) === mes;
}

function mesesFatura(banco) {
  const meses = new Set();

  transacoes.forEach((t) => {
    if (
      t.banco === banco &&
      t.modalidade === "Crédito" &&
      t.tipo === "saida"
    ) {
      const mf = mesFaturaDaTransacao(t);
      if (mf) meses.add(mf);
    }
  });

  if (typeof window.parcelasGetTodas === "function") {
    window.parcelasGetTodas().forEach((c) => {
      if (c.banco !== banco) return;
      const [y, m, d] = c.dataPrimeira.split("-").map(Number);
      for (let i = 0; i < c.numeroParcelas; i++) {
        const dt = new Date(y, m - 1 + i, d);
        const ref = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        meses.add(ref);
      }
    });
  }

  Object.keys(faturasSalvas).forEach((chave) => {
    const idx = chave.lastIndexOf("_");
    const b = chave.substring(0, idx);
    const mes = chave.substring(idx + 1);
    if (b === banco) meses.add(mes);
  });

  // 🔔 Adiciona o mês que foi fechado (pra ele aparecer na lista)
  const mesFechado = mesFechadoDoBanco(banco);
  if (mesFechado) meses.add(mesFechado);

  return [...meses].sort();
}

function faturaAtualDoBanco(banco) {
  const mesAtual = mesAtualRef();

  if (faturasSalvas[chaveFatura(banco, mesAtual)]) {
    return mesAtual;
  }

  const itens = itensFatura(banco, mesAtual);
  if (itens.length > 0) return mesAtual;

  const todosMeses = mesesFatura(banco);
  const futuro = todosMeses.find((m) => m >= mesAtual);
  if (futuro) return futuro;

  const ultimo = todosMeses[todosMeses.length - 1];
  if (ultimo) return ultimo;

  return mesAtual;
}

async function carregarFaturasSalvas() {
  if (!usuarioLogado) return;
  try {
    const arr = await window.fbCarregarColecao(usuarioLogado.uid, "faturas");
    faturasSalvas = {};
    arr.forEach((f) => {
      faturasSalvas[chaveFatura(f.banco, f.mes)] = f;
    });
    console.log("📄 Faturas salvas carregadas:", Object.keys(faturasSalvas).length);
  } catch (e) {
    console.warn("Erro ao carregar faturas salvas:", e);
  }
}

async function salvarFatura(banco, mes, dados) {
  if (!usuarioLogado) return false;
  const chave = chaveFatura(banco, mes);
  const docId = chave.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ok = await window.fbSalvarDoc(
    usuarioLogado.uid,
    dados,
    "faturas",
    docId
  );
  if (ok) {
    faturasSalvas[chave] = { ...dados, banco, mes };
  }
  return ok;
}

window.mesAtualRef = mesAtualRef;
window.nomeMesAno = nomeMesAno;
window.mesAnoCurto = mesAnoCurto;
window.itensFatura = itensFatura;
window.totalFaturaDinamico = totalFaturaDinamico;
window.totalFaturaExibir = totalFaturaExibir;
window.statusFatura = statusFatura;
window.temComprasAposFechamento = temComprasAposFechamento;
window.mesesFatura = mesesFatura;
window.faturaAtualDoBanco = faturaAtualDoBanco;
window.carregarFaturasSalvas = carregarFaturasSalvas;
window.salvarFatura = salvarFatura;
window.getFaturasSalvas = () => faturasSalvas;
window.bancoEstaFechado = bancoEstaFechado;
window.mesEstaFechado = mesEstaFechado;
window.mesFechadoDoBanco = mesFechadoDoBanco;
window.mesFaturaDaTransacao = mesFaturaDaTransacao;

/* =========================================================
   FATURAS — Modal e renderização
========================================================= */

let faturaAbertaAtual = null;

function labelStatusFatura(status) {
  const map = {
    futura: { label: "🔮 Futura", classe: "futura" },
    aberta: { label: "🔓 Em aberto", classe: "aberta" },
    fechada: { label: "🔒 Fechada", classe: "fechada" },
    paga: { label: "✅ Paga", classe: "paga" },
  };
  return map[status] || map.aberta;
}

function abrirModalFaturas(banco) {
  fecharTodosModais();
  faturaAbertaAtual = null;

  $("tituloModalFaturas").textContent = `Faturas — ${banco}`;
  $("subtituloModalFaturas").textContent = `Histórico de faturas mensais`;

  renderListaFaturas(banco);

  $("modalFaturas").classList.add("active");
}

function renderListaFaturas(banco) {
  const container = $("listaFaturas");
  if (!container) return;

  try {
    const meses = mesesFatura(banco);

    if (meses.length === 0) {
      container.innerHTML = `
        <div class="fatura-vazia">
          Nenhuma movimentação no crédito deste banco ainda.
        </div>
      `;
      return;
    }

    container.innerHTML = meses.map((mes) => {
      const st = statusFatura(banco, mes);
      const total = totalFaturaExibir(banco, mes);
      const itens = itensFatura(banco, mes);
      const compras = itens.filter((i) => i.tipo === "compra").length;
      const parcelas = itens.filter((i) => i.tipo === "parcela").length;
      const chave = chaveFatura(banco, mes);
      const salva = faturasSalvas[chave];
      const badge = labelStatusFatura(st);
      const expandido = faturaAbertaAtual === mes ? "expandido" : "";

      const temComprasPos = temComprasAposFechamento(banco, mes);

      // 🔔 Destino das próximas compras (ou null)
      const proximoMesDestino = bancoEstaFechado(banco);
      // 🔔 Mês que foi fechado (ou null)
      const mesFechado = mesFechadoDoBanco(banco);
      // 🔔 Só é "mês ativo de fechamento" se ESSE mês for o que foi fechado
      const estaFechado = mesEstaFechado(banco, mes);

      let detalheExtra = "";
      if (st === "paga" && salva?.dataPagamento) {
        detalheExtra = ` · Paga em ${formatarData(salva.dataPagamento)}`;
      } else if (st === "fechada" && salva?.dataFechamento) {
        detalheExtra = ` · Fechada em ${formatarData(salva.dataFechamento)}`;
      } else if (st === "futura") {
        detalheExtra = " (estimado)";
      }

      let aviso = "";
      if (temComprasPos) {
        aviso = `
          <div style="margin-top:8px;padding:8px 12px;background:var(--danger-soft);border-radius:var(--r-sm);font-size:12px;color:var(--danger);">
            ⚠️ Há compras lançadas após o fechamento desta fatura.
          </div>
        `;
      }

      // 🔔 Aviso de fatura fechada (só no mês que foi fechado)
      let avisoFechado = "";
      if (estaFechado && proximoMesDestino) {
        avisoFechado = `
          <div style="margin-top:8px;padding:8px 12px;background:var(--primary-soft);border-radius:var(--r-sm);font-size:12px;color:var(--primary);">
            🔒 Fatura fechada — novas compras vão pra <strong>${nomeMesAno(proximoMesDestino)}</strong>.
          </div>
        `;
      }

      const itensHtml = itens.length
        ? itens.map((i) => `
            <div class="fatura-item">
              <div class="fatura-item-desc">
                ${escapeHtml(i.descricao)}
                <small>${formatarData(i.data)} · ${i.tipo === "compra" ? "Compra" : "Parcela"}</small>
              </div>
              <div class="fatura-item-valor">${formatarMoeda(i.valor)}</div>
            </div>
          `).join("")
        : `<div class="fatura-vazia">Sem itens nesta fatura.</div>`;

      const botaoPagar = st === "paga"
        ? `<button type="button" class="btn btn-ghost" onclick="pagarFatura('${escapeAttr(banco)}', '${mes}', event)">↺ Desmarcar pagamento</button>`
        : `<button type="button" class="btn btn-primary" onclick="pagarFatura('${escapeAttr(banco)}', '${mes}', event)">✓ Pagar fatura</button>`;

      const botaoFechar = estaFechado
        ? `<button type="button" class="btn btn-ghost" onclick="reabrirFatura('${escapeAttr(banco)}', event)">↺ Reabrir fatura</button>`
        : `<button type="button" class="btn btn-ghost" onclick="fecharFatura('${escapeAttr(banco)}', '${mes}', event)">🔒 Fechar fatura</button>`;

      return `
        <div class="fatura-card ${expandido}" data-mes="${mes}" data-banco="${escapeAttr(banco)}">
          <div class="fatura-card-head" onclick="toggleFaturaCard('${escapeAttr(banco)}', '${mes}')">
            <div class="fatura-card-info">
              <div class="fatura-card-mes">
                📅 ${nomeMesAno(mes)}
                <span class="fatura-card-badge ${badge.classe}">${badge.label}</span>
              </div>
              <div class="fatura-card-valor">
                ${formatarMoeda(total)}${detalheExtra}
              </div>
              <div class="fatura-card-detalhe">
                Compras: ${compras} · Parcelas: ${parcelas}
              </div>
            </div>
            <span class="fatura-card-arrow">▾</span>
          </div>

          <div class="fatura-card-body">
            <div class="fatura-itens">
              ${itensHtml}
            </div>
            <div class="fatura-item-total">
              <span>TOTAL</span>
              <span>${formatarMoeda(total)}</span>
            </div>
            ${aviso}
            ${avisoFechado}
            <div class="fatura-actions">
              ${botaoPagar}
              ${botaoFechar}
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("❌ Erro em renderListaFaturas:", err);
    container.innerHTML = `<div class="fatura-vazia">Erro ao carregar faturas: ${err.message}</div>`;
  }
}

function toggleFaturaCard(banco, mes) {
  if (faturaAbertaAtual === mes) {
    faturaAbertaAtual = null;
  } else {
    faturaAbertaAtual = mes;
  }
  renderListaFaturas(banco);
}

async function pagarFatura(banco, mes, event) {
  if (event) event.stopPropagation();

  const chave = chaveFatura(banco, mes);
  const salva = faturasSalvas[chave] || {};
  const jaPaga = salva.status === "paga";

  const total = totalFaturaExibir(banco, mes);
  const acao = jaPaga ? "desmarcar como paga" : "marcar como paga";

  if (!confirm(`Deseja ${acao} a fatura de ${nomeMesAno(mes)} (${formatarMoeda(total)})?`)) {
    return;
  }

  let dados;
  if (jaPaga) {
    dados = {
      banco,
      mes,
      status: "aberta",
      valorFechado: null,
      dataFechamento: null,
      dataPagamento: null,
    };
  } else {
    dados = {
      banco,
      mes,
      status: "paga",
      valorFechado: total,
      dataFechamento: salva.dataFechamento || dataHoje(),
      dataPagamento: dataHoje(),
    };
  }

  const ok = await salvarFatura(banco, mes, dados);

  if (ok) {
    toast(jaPaga ? "Pagamento desfeito" : "Fatura marcada como paga!", "success");
    renderListaFaturas(banco);
    renderFaturaCards();
    atualizarResumo();
  } else {
    toast("Não foi possível salvar. Verifique a conexão.", "error");
  }
}

/* 🔔 Fechar fatura → próximas compras vão pro mês seguinte */
async function fecharFatura(banco, mesAtual, event) {
  if (event) event.stopPropagation();

  const mesProx = mesSeguinte(mesAtual);

  if (!confirm(`Fechar a fatura de ${nomeMesAno(mesAtual)}?\n\nAs próximas compras no crédito desse banco vão pra fatura de ${nomeMesAno(mesProx)}.`)) {
    return;
  }

  if (!configUsuario.bancoProximoMesFatura) configUsuario.bancoProximoMesFatura = {};
  if (!configUsuario.faturasFechadas) configUsuario.faturasFechadas = {};

  configUsuario.bancoProximoMesFatura[banco] = mesProx;   // destino das próximas compras
  configUsuario.faturasFechadas[banco] = mesAtual;        // mês que foi fechado

  await salvarConfiguracoes();

  toast(`Fatura de ${nomeMesAno(mesAtual)} fechada. Próximas compras → ${nomeMesAno(mesProx)}.`, "success");

  renderListaFaturas(banco);
  renderFaturaCards();
}

/* 🔔 Reabrir fatura → volta ao comportamento normal */
async function reabrirFatura(banco, event) {
  if (event) event.stopPropagation();

  const mesFechado = mesFechadoDoBanco(banco);

  if (!confirm(`Reabrir a fatura de ${mesFechado ? nomeMesAno(mesFechado) : "do " + banco}?\n\nAs próximas compras no crédito vão pro mês da data real.`)) {
    return;
  }

  if (configUsuario.bancoProximoMesFatura) delete configUsuario.bancoProximoMesFatura[banco];
  if (configUsuario.faturasFechadas) delete configUsuario.faturasFechadas[banco];

  await salvarConfiguracoes();

  toast(`Fatura do ${banco} reaberta.`, "info");

  renderListaFaturas(banco);
  renderFaturaCards();
}

window.abrirModalFaturas = abrirModalFaturas;
window.renderListaFaturas = renderListaFaturas;
window.toggleFaturaCard = toggleFaturaCard;
window.pagarFatura = pagarFatura;
window.fecharFatura = fecharFatura;
window.reabrirFatura = reabrirFatura;

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

  if (typeof window.renderListaCoresCriptos === "function") {
    window.renderListaCoresCriptos();
  }

  $("telaCores").classList.add("active");
}

$("formCores").addEventListener("submit", async (e) => {
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

  await salvarCores();
  aplicarCores();

  if (typeof window.criptoAplicarCoresDoModal === "function") {
    window.criptoAplicarCoresDoModal();
  }

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
   EXPOR FUNÇÕES
========================================================= */

window.mostrarApp = mostrarApp;
window.alternarTema = alternarTema;
window.toggleFiltro = toggleFiltro;
window.adicionarItemConfig = adicionarItemConfig;
window.adicionarSugestao = adicionarSugestao;
window.removerItemConfig = removerItemConfig;
window.removerTransacao = removerTransacao;
window.abrirModalEditar = abrirModalEditar;
window.fecharModalEditar = fecharModalEditar;
window.filtrarBeneficio = filtrarBeneficio;
window.filtrarBancoCredito = filtrarBancoCredito;
window.abrirPersonalizacaoCores = abrirPersonalizacaoCores;
window.abrirPerfil = abrirPerfil;
window.abrirConfiguracoes = abrirConfiguracoes;
window.fecharTodosModais = fecharTodosModais;
window.logout = logout;
window.trocarAba = trocarAba;
window.atualizarTudo = atualizarTudo;

/* =========================================================
   LISTENER — parcelas atualizadas
========================================================= */

window.addEventListener("parcelas-atualizadas", () => {
  if (typeof renderFaturaCards === "function") {
    renderFaturaCards();
  }

  const modalFaturasAberto = $("modalFaturas")?.classList.contains("active");
  if (modalFaturasAberto && bancoSelecionadoFatura) {
    renderListaFaturas(bancoSelecionadoFatura);
  }
});

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const temaSalvo = localStorage.getItem(THEME_KEY) || "dark";
  aplicarTema(temaSalvo);

  const campoData = $("data");
  if (campoData) campoData.value = dataHoje();

  await esperarFirebase();

  console.log("✅ Firebase pronto, iniciando app...");
  console.log("   Auth:", typeof window.firebaseAuth);
  console.log("   DB:", typeof window.firebaseDB);

  verificarLogin();
});
