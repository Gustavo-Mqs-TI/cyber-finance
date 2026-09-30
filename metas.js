/* =========================================================
   FINANÇA — Módulo Metas (Firebase)
========================================================= */

(function () {
  "use strict";

  let metas = [];
  let metasInicializado = false;

  function money(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function id() { return Date.now() + Math.floor(Math.random() * 1000); }

  function toastSafe(m, t) { if (typeof window.toast === "function") window.toast(m, t || "info"); }

  function escapeHtmlSafe(s) {
    if (window.escapeHtml) return window.escapeHtml(s);
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* =========================================================
     FIRESTORE
  ========================================================= */

  async function carregarDoFB() {
    if (!window.usuarioLogado) return [];
    try {
      const arr = await window.fbCarregarColecao(window.usuarioLogado.uid, "metas");
      return arr || [];
    } catch (e) { return []; }
  }

  async function salvarNoFB(item) {
    if (!window.usuarioLogado) return null;
    try {
      const dados = { ...item };
      delete dados._fbId;
      return await window.fbAdicionarItem(window.usuarioLogado.uid, "metas", dados);
    } catch (e) { return null; }
  }

  async function excluirNoFB(fbId) {
    if (!window.usuarioLogado || !fbId) return;
    try {
      await window.fbExcluirItem(window.usuarioLogado.uid, "metas", fbId);
    } catch (e) {}
  }

  /* =========================================================
     CÁLCULOS
  ========================================================= */

  function getPeriodo(meta) {
    const hoje = new Date();
    if (meta.periodo === "personalizado") {
      return { inicio: meta.dataInicio, fim: meta.dataFim };
    }
    if (meta.periodo === "mensal") {
      const y = hoje.getFullYear(), m = hoje.getMonth();
      const inicio = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const last = new Date(y, m + 1, 0).getDate();
      const fim = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      return { inicio, fim };
    }
    if (meta.periodo === "anual") {
      const y = hoje.getFullYear();
      return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
    }
    return { inicio: "1900-01-01", fim: "2100-12-31" };
  }

  function calcularProgresso(meta) {
    const { inicio, fim } = getPeriodo(meta);
    const trans = window.transacoes || [];
    const ops = (window.criptoGetOperacoes && window.criptoGetOperacoes()) || [];

    let atual = 0;

    if (meta.tipo === "gasto") {
      trans.forEach((t) => {
        if (t.tipo !== "saida") return;
        if (t.data < inicio || t.data > fim) return;
        if (meta.categoria && meta.categoria !== "TODAS" && t.modalidade !== meta.categoria) return;
        atual += t.valor;
      });
    } else if (meta.tipo === "economia") {
      let ent = 0, sai = 0;
      trans.forEach((t) => {
        if (t.data < inicio || t.data > fim) return;
        if (t.tipo === "entrada") ent += t.valor;
        else if (t.tipo === "saida" && t.modalidade !== "Crédito") sai += t.valor;
      });
      atual = ent - sai;
      if (atual < 0) atual = 0;
    } else if (meta.tipo === "cripto") {
      ops.forEach((o) => {
        if (o.tipo !== "compra") return;
        if (o.data < inicio || o.data > fim) return;
        if (meta.cripto && meta.cripto !== "TODAS" && o.cripto !== meta.cripto) return;
        atual += o.valorLiquido;
      });
    }

    const alvo = meta.valor;
    const pct = alvo > 0 ? (atual / alvo) * 100 : 0;
    return { atual, alvo, pct, inicio, fim };
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function renderCards() {
    const container = document.getElementById("metasContainer");
    if (!container) return;

    if (metas.length === 0) {
      container.innerHTML = `<div class="empty-cards">Nenhuma meta cadastrada ainda. Crie uma acima.</div>`;
      const cont = document.getElementById("metasContador");
      if (cont) cont.textContent = "0 metas";
      return;
    }

    container.innerHTML = metas.map((m) => {
      const { atual, alvo, pct, inicio, fim } = calcularProgresso(m);
      const tpLabel = m.tipo === "gasto" ? "Gasto" : m.tipo === "economia" ? "Economia" : "Cripto";

      let cor = "";
      let status = "";
      let statusLabel = "";

      if (m.tipo === "gasto") {
        if (pct <= 80) { cor = "success"; status = "ativo"; statusLabel = "Dentro do limite"; }
        else if (pct <= 100) { cor = "warning"; status = "ativo"; statusLabel = "Atenção"; }
        else { cor = "danger"; status = "estourado"; statusLabel = "Estourou"; }
      } else {
        if (pct >= 100) { cor = "success"; status = "concluido"; statusLabel = "Concluída!"; }
        else if (pct >= 60) { cor = ""; status = "ativo"; statusLabel = "Em progresso"; }
        else { cor = "warning"; status = "ativo"; statusLabel = "Iniciando"; }
      }

      const pctShow = Math.min(100, pct);
      const filtroExtra = m.tipo === "gasto" && m.categoria && m.categoria !== "TODAS"
        ? `<div class="meta-card-type">Categoria: ${escapeHtmlSafe(m.categoria)}</div>` : "";
      const filtroCripto = m.tipo === "cripto" && m.cripto && m.cripto !== "TODAS"
        ? `<div class="meta-card-type">Cripto: ${escapeHtmlSafe(m.cripto)}</div>` : "";

      return `
        <div class="meta-card">
          <div class="meta-card-head">
            <div>
              <div class="meta-card-title">${escapeHtmlSafe(m.descricao)}</div>
              <div class="meta-card-type">${tpLabel} · ${m.periodo}</div>
              ${filtroExtra}
              ${filtroCripto}
            </div>
            <button class="action-btn danger" onclick="window.metaExcluir(${m.id})" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>

          <div class="meta-card-values">
            <span>Atual: <strong>${money(atual)}</strong></span>
            <span>Alvo: <strong>${money(alvo)}</strong></span>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-dim);margin-bottom:4px;">
              <span>${pct.toFixed(1)}%</span>
              <span>${statusLabel}</span>
            </div>
            <div class="progress-bar"><div class="progress-bar-fill ${cor}" style="width:${pctShow}%"></div></div>
          </div>

          <div style="font-size:11px;color:var(--text-dim);">${inicio} até ${fim}</div>
        </div>
      `;
    }).join("");

    const cont = document.getElementById("metasContador");
    if (cont) cont.textContent = `${metas.length} ${metas.length === 1 ? "meta" : "metas"}`;
  }

  /* =========================================================
     FORMULÁRIO
  ========================================================= */

  function preencherSelects() {
    const mods = [
      ...((window.configUsuario && window.configUsuario.beneficios) || []),
      ...((window.configUsuario && window.configUsuario.modalidades) || []),
    ];
    const sel = document.getElementById("metaCategoria");
    if (sel) {
      const v = sel.value;
      sel.innerHTML = '<option value="TODAS">Todas</option>';
      mods.forEach((m) => { sel.innerHTML += `<option value="${escapeHtmlSafe(m)}">${escapeHtmlSafe(m)}</option>`; });
      if (mods.includes(v)) sel.value = v;
    }
  }

  function atualizarVisibilidadeCampos() {
    const tipo = document.getElementById("metaTipo").value;
    const periodo = document.getElementById("metaPeriodo").value;
    const wCat = document.getElementById("metaCategoriaWrapper");
    const wCrip = document.getElementById("metaCriptoWrapper");
    const wIni = document.getElementById("metaDataInicioWrapper");
    const wFim = document.getElementById("metaDataFimWrapper");
    if (wCat) wCat.style.display = tipo === "gasto" ? "" : "none";
    if (wCrip) wCrip.style.display = tipo === "cripto" ? "" : "none";
    if (wIni) wIni.style.display = periodo === "personalizado" ? "" : "none";
    if (wFim) wFim.style.display = periodo === "personalizado" ? "" : "none";
  }

  function resetarForm() {
    const f = document.getElementById("formMeta");
    if (f) f.reset();
    atualizarVisibilidadeCampos();
  }

  async function excluir(idM) {
    const m = metas.find((x) => x.id === idM);
    if (!m) return;
    if (!confirm(`Excluir a meta "${m.descricao}"?`)) return;
    if (m._fbId) await excluirNoFB(m._fbId);
    metas = metas.filter((x) => x.id !== idM);
    toastSafe("Meta excluída", "info");
    renderCards();
  }

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================= */

  async function iniciar() {
    if (metasInicializado) {
      metas = await carregarDoFB();
      preencherSelects();
      renderCards();
      return;
    }
    metasInicializado = true;

    metas = await carregarDoFB();
    preencherSelects();

    const selTipo = document.getElementById("metaTipo");
    const selPer = document.getElementById("metaPeriodo");
    if (selTipo) selTipo.addEventListener("change", atualizarVisibilidadeCampos);
    if (selPer) selPer.addEventListener("change", atualizarVisibilidadeCampos);
    atualizarVisibilidadeCampos();

    const form = document.getElementById("formMeta");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = document.getElementById("metaDescricao").value.trim();
        const t = document.getElementById("metaTipo").value;
        const v = parseFloat(document.getElementById("metaValor").value);
        const p = document.getElementById("metaPeriodo").value;
        const cat = document.getElementById("metaCategoria").value;
        const cri = document.getElementById("metaCripto").value;
        const dI = document.getElementById("metaDataInicio").value;
        const dF = document.getElementById("metaDataFim").value;

        if (!d || !t || !v || !p) { toastSafe("Preencha todos os campos obrigatórios", "error"); return; }
        if (v <= 0) { toastSafe("Valor deve ser maior que zero", "error"); return; }
        if (p === "personalizado" && (!dI || !dF)) { toastSafe("Informe as datas início e fim", "error"); return; }
        if (p === "personalizado" && dI > dF) { toastSafe("Data início maior que fim", "error"); return; }

        const nova = {
          id: id(), descricao: d, tipo: t, valor: v, periodo: p,
          categoria: t === "gasto" ? cat : null,
          cripto: t === "cripto" ? cri : null,
          dataInicio: p === "personalizado" ? dI : null,
          dataFim: p === "personalizado" ? dF : null,
          criadoEm: Date.now(),
        };

        const fbId = await salvarNoFB(nova);
        nova._fbId = fbId;
        metas.push(nova);

        resetarForm();
        toastSafe("Meta criada!", "success");
        renderCards();
      });
    }

    renderCards();
  }

  async function renderTudo() {
    preencherSelects();
    renderCards();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.nav-item[data-aba="metas"]');
    if (btn) setTimeout(async () => {
      if (!metasInicializado) await iniciar();
      else {
        metas = await carregarDoFB();
        renderTudo();
      }
    }, 50);
  });

  window.metasIniciar = iniciar;
  window.metasRenderTudo = renderTudo;
  window.metaExcluir = excluir;
  window.metasGetTodas = () => metas;
  window.metasCalcularProgresso = calcularProgresso;
})();
