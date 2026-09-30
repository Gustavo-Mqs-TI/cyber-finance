/* =========================================================
   FINANÇA — Módulo Recorrentes (Firebase)
========================================================= */

(function () {
  "use strict";

  let recorrentes = [];
  let recorrentesInicializado = false;

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

  function valorMensalizado(r) {
    if (r.frequencia === "semanal") return r.valor * 4.33;
    if (r.frequencia === "anual") return r.valor / 12;
    return r.valor;
  }

  /* =========================================================
     FIRESTORE
  ========================================================= */

  async function carregarDoFB() {
    if (!window.usuarioLogado) return [];
    try {
      const arr = await window.fbCarregarColecao(window.usuarioLogado.uid, "recorrentes");
      return arr || [];
    } catch (e) { return []; }
  }

  async function salvarNoFB(item) {
    if (!window.usuarioLogado) return null;
    try {
      const dados = { ...item };
      delete dados._fbId;
      return await window.fbAdicionarItem(window.usuarioLogado.uid, "recorrentes", dados);
    } catch (e) { return null; }
  }

  async function atualizarNoFB(fbId, dados) {
    if (!window.usuarioLogado || !fbId) return;
    try {
      const d = { ...dados };
      delete d._fbId;
      await window.fbAtualizarItem(window.usuarioLogado.uid, "recorrentes", fbId, d);
    } catch (e) {}
  }

  async function excluirNoFB(fbId) {
    if (!window.usuarioLogado || !fbId) return;
    try {
      await window.fbExcluirItem(window.usuarioLogado.uid, "recorrentes", fbId);
    } catch (e) {}
  }

  /* =========================================================
     CÁLCULOS
  ========================================================= */

  function totalSaidasMensal() {
    return recorrentes.filter((r) => r.tipo === "saida" && r.ativo !== false)
      .reduce((s, r) => s + valorMensalizado(r), 0);
  }

  function totalEntradasMensal() {
    return recorrentes.filter((r) => r.tipo === "entrada" && r.ativo !== false)
      .reduce((s, r) => s + valorMensalizado(r), 0);
  }

  function recorrentesNoDia(dataISO) {
    const [y, m, d] = dataISO.split("-").map(Number);
    const ds = new Date(y, m - 1, d).getDay();
    return recorrentes.filter((r) => {
      if (r.ativo === false) return false;
      if (r.frequencia === "mensal") return Number(r.dia) === d;
      if (r.frequencia === "semanal") return Number(r.diaSemana ?? 1) === ds;
      if (r.frequencia === "anual") return Number(r.mesAnual) === m && Number(r.dia) === d;
      return false;
    });
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function renderResumo() {
    const s = totalSaidasMensal();
    const e = totalEntradasMensal();
    const saldo = e - s;
    const elS = document.getElementById("recorrentesTotalSaidas");
    const elE = document.getElementById("recorrentesTotalEntradas");
    const elSal = document.getElementById("recorrentesSaldoFixo");
    if (elS) elS.textContent = money(s);
    if (elE) elE.textContent = money(e);
    if (elSal) { elSal.textContent = money(saldo); elSal.style.color = saldo >= 0 ? "var(--success)" : "var(--danger)"; }
  }

  function renderTabela() {
    const tbody = document.getElementById("recorrenteLista");
    if (!tbody) return;
    if (recorrentes.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Nenhuma recorrência cadastrada</td></tr>`;
      const cont = document.getElementById("recorrentesContador");
      if (cont) cont.textContent = "0 recorrências";
      return;
    }
    const ord = [...recorrentes].sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "entrada" ? -1 : 1;
      return (a.descricao || "").localeCompare(b.descricao || "");
    });
    const cont = document.getElementById("recorrentesContador");
    if (cont) cont.textContent = `${recorrentes.length} ${recorrentes.length === 1 ? "recorrência" : "recorrências"}`;
    tbody.innerHTML = ord.map((r) => {
      const tp = r.tipo === "entrada" ? "tipo-entrada" : "tipo-saida";
      const tpL = r.tipo === "entrada" ? "Entrada" : "Saída";
      const fL = r.frequencia === "semanal" ? "Semanal" : r.frequencia === "anual" ? "Anual" : "Mensal";
      const inat = r.ativo === false;
      const bc = inat ? "inativo" : "ativo";
      const bl = inat ? "Inativo" : "Ativo";
      return `
        <tr style="${inat ? "opacity:.55;" : ""}">
          <td><strong>${escapeHtmlSafe(r.descricao)}</strong></td>
          <td class="${tp}">${tpL}</td>
          <td class="valor-cell">${money(r.valor)}</td>
          <td>${fL}</td>
          <td>${r.frequencia === "semanal" ? "-" : (r.dia || "-")}</td>
          <td>${r.banco ? escapeHtmlSafe(r.banco) : "—"}</td>
          <td>${r.modalidade ? escapeHtmlSafe(r.modalidade) : "—"}</td>
          <td class="text-right">
            <div class="row-actions">
              <span class="status-badge ${bc}" style="margin-right:6px;">${bl}</span>
              <button class="action-btn" onclick="window.recorrenteToggle(${r.id})" title="${inat ? "Ativar" : "Desativar"}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
              </button>
              <button class="action-btn danger" onclick="window.recorrenteExcluir(${r.id})" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderTudo() { renderResumo(); renderTabela(); }

  /* =========================================================
     FORMULÁRIO
  ========================================================= */

  function preencherSelects() {
    const bancos = (window.configUsuario && window.configUsuario.bancos) || [];
    const mods = [
      ...((window.configUsuario && window.configUsuario.beneficios) || []),
      ...((window.configUsuario && window.configUsuario.modalidades) || []),
    ];
    const selB = document.getElementById("recorrenteBanco");
    if (selB) {
      const v = selB.value;
      selB.innerHTML = '<option value="">Nenhum</option>';
      bancos.forEach((b) => { selB.innerHTML += `<option value="${escapeHtmlSafe(b)}">${escapeHtmlSafe(b)}</option>`; });
      if (bancos.includes(v)) selB.value = v;
    }
    const selM = document.getElementById("recorrenteModalidade");
    if (selM) {
      const v = selM.value;
      selM.innerHTML = '<option value="">Selecione</option>';
      mods.forEach((m) => { selM.innerHTML += `<option value="${escapeHtmlSafe(m)}">${escapeHtmlSafe(m)}</option>`; });
      if (mods.includes(v)) selM.value = v;
    }
  }

  function resetarForm() {
    const f = document.getElementById("formRecorrente");
    if (f) f.reset();
  }

  async function excluir(idR) {
    const r = recorrentes.find((x) => x.id === idR);
    if (!r) return;
    if (!confirm(`Excluir "${r.descricao}"?`)) return;
    if (r._fbId) await excluirNoFB(r._fbId);
    recorrentes = recorrentes.filter((x) => x.id !== idR);
    toastSafe("Recorrência excluída", "info");
    renderTudo();
  }

  async function toggle(idR) {
    const r = recorrentes.find((x) => x.id === idR);
    if (!r) return;
    r.ativo = r.ativo === false ? true : false;
    if (r._fbId) await atualizarNoFB(r._fbId, r);
    toastSafe(r.ativo ? "Recorrência ativada" : "Recorrência desativada", "info");
    renderTudo();
  }

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================= */

  async function iniciar() {
    if (recorrentesInicializado) {
      recorrentes = await carregarDoFB();
      preencherSelects();
      renderTudo();
      return;
    }
    recorrentesInicializado = true;

    recorrentes = await carregarDoFB();
    preencherSelects();

    const form = document.getElementById("formRecorrente");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = document.getElementById("recorrenteDescricao").value.trim();
        const v = parseFloat(document.getElementById("recorrenteValor").value);
        const t = document.getElementById("recorrenteTipo").value;
        const f = document.getElementById("recorrenteFrequencia").value;
        const dia = parseInt(document.getElementById("recorrenteDia").value);
        const b = document.getElementById("recorrenteBanco").value;
        const m = document.getElementById("recorrenteModalidade").value;

        if (!d || !v || !t || !f) { toastSafe("Preencha todos os campos obrigatórios", "error"); return; }
        if (v <= 0) { toastSafe("Valor deve ser maior que zero", "error"); return; }
        if (f !== "semanal" && (!dia || dia < 1 || dia > 31)) { toastSafe("Dia entre 1 e 31", "error"); return; }

        const nova = {
          id: id(), descricao: d, valor: v, tipo: t, frequencia: f,
          dia: f === "semanal" ? null : dia,
          diaSemana: f === "semanal" ? 1 : null,
          banco: b, modalidade: m, ativo: true, criadoEm: Date.now(),
        };

        const fbId = await salvarNoFB(nova);
        nova._fbId = fbId;
        recorrentes.push(nova);

        resetarForm();
        toastSafe("Recorrência adicionada!", "success");
        renderTudo();
      });
    }

    renderTudo();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.nav-item[data-aba="recorrentes"]');
    if (btn) setTimeout(async () => {
      if (!recorrentesInicializado) await iniciar();
      else {
        recorrentes = await carregarDoFB();
        preencherSelects();
        renderTudo();
      }
    }, 50);
  });

  window.recorrentesIniciar = iniciar;
  window.recorrentesRenderTudo = renderTudo;
  window.recorrenteExcluir = excluir;
  window.recorrenteToggle = toggle;
  window.recorrentesNoDia = recorrentesNoDia;
  window.totalSaidasMensal = totalSaidasMensal;
  window.totalEntradasMensal = totalEntradasMensal;
  window.recorrentesGetTodas = () => recorrentes;
})();
