/* =========================================================
   FINANÇA — Módulo Parcelas (Firebase)
========================================================= */

(function () {
  "use strict";

  let parcelas = [];
  let parcelasInicializado = false;

  function money(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function today() { return new Date().toISOString().split("T")[0]; }

  function id() { return Date.now() + Math.floor(Math.random() * 1000); }

  function toastSafe(m, t) { if (typeof window.toast === "function") window.toast(m, t || "info"); }

  function escapeHtmlSafe(s) {
    if (window.escapeHtml) return window.escapeHtml(s);
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatarDataSafe(iso) {
    if (window.formatarData) return window.formatarData(iso);
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function addMonths(isoDate, months) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const tm = date.getMonth() + months;
    const ty = date.getFullYear() + Math.floor(tm / 12);
    const nm = ((tm % 12) + 12) % 12;
    const last = new Date(ty, nm + 1, 0).getDate();
    const fd = Math.min(d, last);
    return `${ty}-${String(nm + 1).padStart(2, "0")}-${String(fd).padStart(2, "0")}`;
  }

  /* =========================================================
     FIRESTORE
  ========================================================= */

  async function carregarDoFB() {
    if (!window.usuarioLogado) return [];
    try {
      const arr = await window.fbCarregarColecao(window.usuarioLogado.uid, "parcelas");
      return arr || [];
    } catch (e) { return []; }
  }

  async function salvarNoFB(item) {
    if (!window.usuarioLogado) return null;
    try {
      const dados = { ...item };
      delete dados._fbId;
      return await window.fbAdicionarItem(window.usuarioLogado.uid, "parcelas", dados);
    } catch (e) { return null; }
  }

  async function excluirNoFB(fbId) {
    if (!window.usuarioLogado || !fbId) return;
    try {
      await window.fbExcluirItem(window.usuarioLogado.uid, "parcelas", fbId);
    } catch (e) {}
  }

  /* =========================================================
     CÁLCULOS
  ========================================================= */

  function gerarParcelasCompra(c) {
    const lista = [];
    const vp = c.valorTotal / c.numeroParcelas;
    for (let i = 0; i < c.numeroParcelas; i++) {
      lista.push({
        numero: i + 1,
        data: addMonths(c.dataPrimeira, i),
        valor: vp,
        banco: c.banco,
      });
    }
    return lista;
  }

  function parcelasPagas(c) {
    const h = today();
    return gerarParcelasCompra(c).filter((p) => p.data <= h).length;
  }

  function valorRestante(c) {
    const p = parcelasPagas(c);
    return (c.valorTotal / c.numeroParcelas) * (c.numeroParcelas - p);
  }

  function proximaParcela(c) {
    const h = today();
    return gerarParcelasCompra(c).find((p) => p.data > h) || null;
  }

  function parcelasDoMes(mesRef) {
    const r = [];
    parcelas.forEach((c) => {
      gerarParcelasCompra(c).forEach((p) => {
        if (p.data.startsWith(mesRef)) {
          r.push({
            compraId: c.id,
            descricao: c.descricao,
            banco: c.banco,
            categoria: c.categoria || "",
            numero: p.numero,
            total: c.numeroParcelas,
            valor: p.valor,
            data: p.data,
          });
        }
      });
    });
    return r;
  }

  function totalPorBancoNoMes(mesRef) {
    const r = {};
    parcelasDoMes(mesRef).forEach((p) => {
      r[p.banco] = (r[p.banco] || 0) + p.valor;
    });
    return r;
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function renderResumo() {
    const mes = today().substring(0, 7);
    let ativas = 0, rest = 0, mesTot = 0;
    parcelas.forEach((c) => {
      if (parcelasPagas(c) < c.numeroParcelas) ativas++;
      rest += valorRestante(c);
    });
    parcelasDoMes(mes).forEach((p) => (mesTot += p.valor));
    const elA = document.getElementById("parcelasTotalAtivas");
    const elR = document.getElementById("parcelasValorRestante");
    const elM = document.getElementById("parcelasValorMes");
    if (elA) elA.textContent = ativas;
    if (elR) elR.textContent = money(rest);
    if (elM) elM.textContent = money(mesTot);
  }

  function renderTabela() {
    const tbody = document.getElementById("parcelaLista");
    if (!tbody) return;
    if (parcelas.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Nenhuma compra parcelada cadastrada</td></tr>`;
      const cont = document.getElementById("parcelasContador");
      if (cont) cont.textContent = "0 compras";
      return;
    }
    const ord = [...parcelas].sort((a, b) => {
      const pa = parcelasPagas(a), pb = parcelasPagas(b);
      const af = pa >= a.numeroParcelas, bf = pb >= b.numeroParcelas;
      if (af !== bf) return af ? 1 : -1;
      return (a.dataPrimeira || "").localeCompare(b.dataPrimeira || "");
    });
    const cont = document.getElementById("parcelasContador");
    if (cont) cont.textContent = `${parcelas.length} ${parcelas.length === 1 ? "compra" : "compras"}`;
    tbody.innerHTML = ord.map((c) => {
      const pg = parcelasPagas(c);
      const pct = Math.min(100, (pg / c.numeroParcelas) * 100);
      const st = pg >= c.numeroParcelas ? "concluido" : "ativo";
      const stL = pg >= c.numeroParcelas ? "Finalizada" : "Em andamento";
      const vp = c.valorTotal / c.numeroParcelas;
      const rs = valorRestante(c);
      const px = proximaParcela(c);
      const pxT = px ? `${formatarDataSafe(px.data)} · ${money(px.valor)}` : "—";
      const fl = pct >= 100 ? "success" : pct >= 50 ? "" : "warning";
      return `
        <tr>
          <td><strong>${escapeHtmlSafe(c.descricao)}</strong>${c.categoria ? `<br><small style="color:var(--text-dim)">${escapeHtmlSafe(c.categoria)}</small>` : ""}</td>
          <td>${escapeHtmlSafe(c.banco)}</td>
          <td class="valor-cell">${money(c.valorTotal)}</td>
          <td class="valor-cell">${money(vp)}</td>
          <td style="min-width:160px;">
            <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-dim);margin-bottom:2px;">
              <span>${pg} / ${c.numeroParcelas}</span>
              <span>${pct.toFixed(0)}%</span>
            </div>
            <div class="progress-bar"><div class="progress-bar-fill ${fl}" style="width:${pct}%"></div></div>
          </td>
          <td class="valor-cell">${money(rs)}</td>
          <td>${pxT}</td>
          <td class="text-right">
            <div class="row-actions">
              <span class="status-badge ${st}" style="margin-right:6px;">${stL}</span>
              ${pg < c.numeroParcelas ? `
                <button class="action-btn" onclick="window.parcelaEditar(${c.id})" title="Editar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              ` : ""}
              <button class="action-btn danger" onclick="window.parcelaExcluir(${c.id})" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderTudo() {
    renderResumo();
    renderTabela();
    window.dispatchEvent(new Event("parcelas-atualizadas"));
  }

  /* =========================================================
     FORMULÁRIO — NOVA COMPRA
  ========================================================= */

  function preencherSelects() {
    const bancos = (window.configUsuario && window.configUsuario.bancos) || [];
    const sel = document.getElementById("parcelaBanco");
    if (!sel) return;
    const v = sel.value;
    sel.innerHTML = '<option value="">Selecione</option>';
    bancos.forEach((b) => { sel.innerHTML += `<option value="${escapeHtmlSafe(b)}">${escapeHtmlSafe(b)}</option>`; });
    if (bancos.includes(v)) sel.value = v;
  }

  function camposAuto() {
    const val = parseFloat(document.getElementById("parcelaValor")?.value) || 0;
    const n = parseInt(document.getElementById("parcelaNumero")?.value) || 0;
    const d = document.getElementById("parcelaData")?.value;
    const elU = document.getElementById("parcelaValorUnit");
    const elF = document.getElementById("parcelaDataFim");
    if (elU) elU.value = n > 0 && val > 0 ? money(val / n) : "—";
    if (elF && n > 1 && d) elF.value = formatarDataSafe(addMonths(d, n - 1));
    else if (elF) elF.value = "—";
  }

  function resetarForm() {
    const f = document.getElementById("formParcela");
    if (!f) return;
    f.reset();
    const d = document.getElementById("parcelaData");
    if (d) d.value = today();
    const elU = document.getElementById("parcelaValorUnit");
    const elF = document.getElementById("parcelaDataFim");
    if (elU) elU.value = "";
    if (elF) elF.value = "";
  }

  /* =========================================================
     EDITAR COMPRA PARCELADA
  ========================================================= */

  function abrirModalEditarParcela(idC) {
    const c = parcelas.find((p) => p.id === idC);
    if (!c) return;

    const elId = document.getElementById("editarParcelaId");
    const elDesc = document.getElementById("editarParcelaDescricao");
    const elValor = document.getElementById("editarParcelaValor");
    const elNum = document.getElementById("editarParcelaNumero");
    const elBanco = document.getElementById("editarParcelaBanco");
    const elData = document.getElementById("editarParcelaData");
    const elCat = document.getElementById("editarParcelaCategoria");

    if (elId) elId.value = c.id;
    if (elDesc) elDesc.value = c.descricao;
    if (elValor) elValor.value = c.valorTotal;
    if (elNum) elNum.value = c.numeroParcelas;
    if (elData) elData.value = c.dataPrimeira;
    if (elCat) elCat.value = c.categoria || "";

    if (elBanco) {
      const bancos = (window.configUsuario && window.configUsuario.bancos) || [];
      elBanco.innerHTML = '<option value="">Selecione</option>';
      bancos.forEach((b) => {
        elBanco.innerHTML += `<option value="${escapeHtmlSafe(b)}">${escapeHtmlSafe(b)}</option>`;
      });
      elBanco.value = c.banco;
    }

    atualizarCamposAutoEditarParcela();

    const modal = document.getElementById("modalEditarParcela");
    if (modal) modal.classList.add("active");
  }

  function atualizarCamposAutoEditarParcela() {
    const val = parseFloat(document.getElementById("editarParcelaValor")?.value) || 0;
    const n = parseInt(document.getElementById("editarParcelaNumero")?.value) || 0;
    const d = document.getElementById("editarParcelaData")?.value;

    const elU = document.getElementById("editarParcelaValorUnit");
    const elF = document.getElementById("editarParcelaDataFim");

    if (elU) elU.value = n > 0 && val > 0 ? money(val / n) : "—";
    if (elF && n > 1 && d) elF.value = formatarDataSafe(addMonths(d, n - 1));
    else if (elF) elF.value = "—";
  }

  async function salvarEdicaoParcela(e) {
    if (e) e.preventDefault();

    const idC = parseInt(document.getElementById("editarParcelaId").value);
    const idx = parcelas.findIndex((p) => p.id === idC);
    if (idx === -1) return;

    const d_ = document.getElementById("editarParcelaDescricao").value.trim();
    const vT = parseFloat(document.getElementById("editarParcelaValor").value);
    const nP = parseInt(document.getElementById("editarParcelaNumero").value);
    const b = document.getElementById("editarParcelaBanco").value;
    const dp = document.getElementById("editarParcelaData").value;
    const cat = document.getElementById("editarParcelaCategoria").value.trim();

    if (!d_ || !vT || !nP || !b || !dp) {
      toastSafe("Preencha todos os campos obrigatórios", "error");
      return;
    }
    if (vT <= 0) {
      toastSafe("Valor deve ser maior que zero", "error");
      return;
    }
    if (nP < 2 || nP > 48) {
      toastSafe("Nº de parcelas entre 2 e 48", "error");
      return;
    }

    const original = parcelas[idx];

    const atualizada = {
      ...original,
      descricao: d_,
      valorTotal: vT,
      numeroParcelas: nP,
      banco: b,
      dataPrimeira: dp,
      categoria: cat,
    };

    if (original._fbId && window.usuarioLogado) {
      try {
        const dados = { ...atualizada };
        delete dados._fbId;
        delete dados.id;
        await window.fbAtualizarItem(window.usuarioLogado.uid, "parcelas", original._fbId, dados);
      } catch (err) {
        console.warn("Erro ao salvar no Firestore:", err);
        toastSafe("Erro ao salvar no servidor", "error");
        return;
      }
    }

    parcelas[idx] = atualizada;

    fecharModalEditarParcela();
    toastSafe("Compra parcelada atualizada!", "success");

    renderTudo();
    if (typeof window.renderFaturaCards === "function") window.renderFaturaCards();
  }

  function fecharModalEditarParcela() {
    const modal = document.getElementById("modalEditarParcela");
    if (modal) modal.classList.remove("active");
  }

  /* =========================================================
     EXCLUIR
  ========================================================= */

  async function excluir(idC) {
    const c = parcelas.find((p) => p.id === idC);
    if (!c) return;
    if (!confirm(`Excluir "${c.descricao}"? As parcelas futuras serão removidas.`)) return;

    if (c._fbId) await excluirNoFB(c._fbId);
    parcelas = parcelas.filter((p) => p.id !== idC);
    toastSafe("Compra parcelada excluída", "info");
    renderTudo();
    if (typeof window.renderFaturaCards === "function") window.renderFaturaCards();
  }

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================= */

  async function iniciar() {
    if (parcelasInicializado) {
      parcelas = await carregarDoFB();
      preencherSelects();
      renderTudo();
      return;
    }
    parcelasInicializado = true;

    parcelas = await carregarDoFB();
    preencherSelects();

    const d = document.getElementById("parcelaData");
    if (d) d.value = today();

    ["parcelaValor", "parcelaNumero", "parcelaData"].forEach((idC) => {
      const el = document.getElementById(idC);
      if (el) { el.addEventListener("input", camposAuto); el.addEventListener("change", camposAuto); }
    });

    const form = document.getElementById("formParcela");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d_ = document.getElementById("parcelaDescricao").value.trim();
        const vT = parseFloat(document.getElementById("parcelaValor").value);
        const nP = parseInt(document.getElementById("parcelaNumero").value);
        const b = document.getElementById("parcelaBanco").value;
        const dp = document.getElementById("parcelaData").value;
        const cat = document.getElementById("parcelaCategoria").value.trim();
        if (!d_ || !vT || !nP || !b || !dp) { toastSafe("Preencha todos os campos obrigatórios", "error"); return; }
        if (vT <= 0) { toastSafe("Valor deve ser maior que zero", "error"); return; }
        if (nP < 2 || nP > 48) { toastSafe("Nº de parcelas entre 2 e 48", "error"); return; }

        const nova = {
          id: id(), descricao: d_, valorTotal: vT, numeroParcelas: nP,
          banco: b, dataPrimeira: dp, categoria: cat, criadoEm: Date.now(),
        };

        const fbId = await salvarNoFB(nova);
        nova._fbId = fbId;
        parcelas.push(nova);

        resetarForm();
        toastSafe("Compra parcelada adicionada!", "success");
        renderTudo();
        if (typeof window.renderFaturaCards === "function") window.renderFaturaCards();
      });
    }

    /* Listener do formulário de edição */
    const formEdit = document.getElementById("formEditarParcela");
    if (formEdit) {
      formEdit.addEventListener("submit", salvarEdicaoParcela);
    }

    /* Listener dos campos auto no modal de edição */
    ["editarParcelaValor", "editarParcelaNumero", "editarParcelaData"].forEach((idC) => {
      const el = document.getElementById(idC);
      if (el) {
        el.addEventListener("input", atualizarCamposAutoEditarParcela);
        el.addEventListener("change", atualizarCamposAutoEditarParcela);
      }
    });

    renderTudo();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.nav-item[data-aba="parcelas"]');
    if (btn) setTimeout(async () => {
      if (!parcelasInicializado) await iniciar();
      else {
        parcelas = await carregarDoFB();
        preencherSelects();
        renderTudo();
      }
    }, 50);
  });

  window.parcelasIniciar = iniciar;
  window.parcelasRenderTudo = renderTudo;
  window.parcelaExcluir = excluir;
  window.parcelaEditar = abrirModalEditarParcela;
  window.parcelaSalvarEdicao = salvarEdicaoParcela;
  window.parcelaFecharEdicao = fecharModalEditarParcela;
  window.parcelaAtualizarAuto = atualizarCamposAutoEditarParcela;
  window.parcelasDoMes = parcelasDoMes;
  window.totalParcelasPorBancoNoMes = totalPorBancoNoMes;
  window.parcelasGetTodas = () => parcelas;
  window.parcelasPagas = parcelasPagas;
  window.parcelasValorRestante = valorRestante;
})();
