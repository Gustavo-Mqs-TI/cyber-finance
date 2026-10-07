/* =========================================================
   FINANÇA — Módulo Criptos (Firebase)
========================================================= */

(function () {
  "use strict";

  const CRIPTO_MAP = {
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
    ADA: "cardano", DOGE: "dogecoin", BNB: "binancecoin", LTC: "litecoin",
    DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink",
    AVAX: "avalanche-2", TRX: "tron", ATOM: "cosmos", NEAR: "near",
    SHIB: "shiba-inu", UNI: "uniswap", AAVE: "aave", USDT: "tether",
    USDC: "usd-coin",
  };

  let criptoOperacoes = [];
  let criptoCotacoes = {};
  let criptoCores = {};
  let criptoInicializado = false;

  const CRIPTO_CORES_PADRAO = [
    "#f7931a", "#627eea", "#14f195", "#23292f", "#0033ad",
    "#c2a633", "#f3ba2f", "#345d9d", "#e6007a", "#8247e5",
    "#2a5ada", "#e84142", "#ff060a", "#2e3148", "#00d395",
    "#ffa409", "#ff007a", "#b6509e", "#26a17b", "#2775ca",
  ];

  function criptoCorPadrao(c) {
    let h = 0;
    for (let i = 0; i < c.length; i++) h = c.charCodeAt(i) + ((h << 5) - h);
    return CRIPTO_CORES_PADRAO[Math.abs(h) % CRIPTO_CORES_PADRAO.length];
  }

  function criptoCorDe(c) { return criptoCores[c] || criptoCorPadrao(c); }

  function escurecerHex(hex, f) {
    const h = hex.replace("#", "");
    const r = Math.max(0, Math.floor(parseInt(h.substring(0, 2), 16) * (1 - f)));
    const g = Math.max(0, Math.floor(parseInt(h.substring(2, 4), 16) * (1 - f)));
    const b = Math.max(0, Math.floor(parseInt(h.substring(4, 6), 16) * (1 - f)));
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function criptoGradiente(c) {
    const base = criptoCorDe(c);
    return `linear-gradient(135deg, ${base}, ${escurecerHex(base, 0.35)})`;
  }

  function money(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function qtdFmt(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 0, maximumFractionDigits: 8,
    });
  }

  function pctFmt(v) {
    const n = Number(v) || 0;
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  function cid() { return Date.now() + Math.floor(Math.random() * 1000); }

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

  /* =========================================================
     PERSISTÊNCIA — FIRESTORE
  ========================================================= */

  async function salvarCriptoNoFB(op) {
    if (!window.usuarioLogado) return null;
    try {
      const dados = { ...op };
      delete dados._fbId;
      const fbId = await window.fbAdicionarItem(window.usuarioLogado.uid, "criptos", dados);
      return fbId;
    } catch (e) {
      console.warn("Erro ao salvar cripto:", e);
      return null;
    }
  }

  async function excluirCriptoNoFB(fbId) {
    if (!window.usuarioLogado || !fbId) return;
    try {
      await window.fbExcluirItem(window.usuarioLogado.uid, "criptos", fbId);
    } catch (e) {
      console.warn("Erro ao excluir cripto:", e);
    }
  }

  async function carregarCriptosDoFB() {
    if (!window.usuarioLogado) return [];
    try {
      const arr = await window.fbCarregarColecao(window.usuarioLogado.uid, "criptos");
      return arr || [];
    } catch (e) {
      return [];
    }
  }

  async function salvarCoresCriptoNoFB() {
    if (!window.usuarioLogado) return;
    try {
      await window.fbSalvarDoc(window.usuarioLogado.uid, criptoCores, "criptosCores", "geral");
    } catch (e) {}
  }

  async function carregarCoresCriptoDoFB() {
    if (!window.usuarioLogado) return;
    try {
      const cores = await window.fbCarregarDoc(window.usuarioLogado.uid, "criptosCores", "geral");
      criptoCores = cores || {};
    } catch (e) {
      criptoCores = {};
    }
  }

  /* =========================================================
     CÁLCULOS
  ========================================================= */

  function calcularPosicoes() {
    const pos = {};
    [...criptoOperacoes].sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? -1 : 1;
      return (a.criadoEm || 0) - (b.criadoEm || 0);
    }).forEach((op) => {
      if (!pos[op.cripto]) pos[op.cripto] = { cripto: op.cripto, quantidade: 0, custoTotal: 0 };
      const p = pos[op.cripto];
      if (op.tipo === "compra") { p.quantidade += op.quantidade; p.custoTotal += op.valorLiquido; }
      else {
        const pm = p.quantidade > 0 ? p.custoTotal / p.quantidade : 0;
        p.quantidade -= op.quantidade;
        p.custoTotal -= op.quantidade * pm;
      }
    });
    Object.values(pos).forEach((p) => {
      p.precoMedio = p.quantidade > 0 ? p.custoTotal / p.quantidade : 0;
    });
    return pos;
  }

  function precoMedioNaData(cripto, dataRef) {
    const hist = [...criptoOperacoes]
      .filter((o) => o.cripto === cripto && o.data < dataRef)
      .sort((a, b) => {
        if (a.data !== b.data) return a.data < b.data ? -1 : 1;
        return (a.criadoEm || 0) - (b.criadoEm || 0);
      });
    let q = 0, c = 0;
    hist.forEach((op) => {
      if (op.tipo === "compra") { q += op.quantidade; c += op.valorLiquido; }
      else { const pm = q > 0 ? c / q : 0; q -= op.quantidade; c -= op.quantidade * pm; }
    });
    return q > 0 ? c / q : 0;
  }

  function qtdDisponivelNaData(cripto, dataRef) {
    const hist = [...criptoOperacoes]
      .filter((o) => o.cripto === cripto && o.data < dataRef)
      .sort((a, b) => {
        if (a.data !== b.data) return a.data < b.data ? -1 : 1;
        return (a.criadoEm || 0) - (b.criadoEm || 0);
      });
    let q = 0;
    hist.forEach((op) => { q += op.tipo === "compra" ? op.quantidade : -op.quantidade; });
    return q;
  }

  /* =========================================================
     COTAÇÕES
  ========================================================= */

  async function buscarCotacoes() {
    const criptos = [...new Set(criptoOperacoes.map((o) => o.cripto))];
    const ids = criptos.map((c) => CRIPTO_MAP[c]).filter(Boolean);
    const el = document.getElementById("criptoUltimaAtualizacao");
    if (ids.length === 0) { criptoCotacoes = {}; if (el) el.textContent = "Cotações carregadas automaticamente"; return; }
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=brl&include_24hr_change=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("API");
      const data = await res.json();
      const out = {};
      criptos.forEach((s) => {
        const id = CRIPTO_MAP[s];
        if (id && data[id]) out[s] = { brl: data[id].brl || 0, change24h: data[id].brl_24h_change || 0 };
      });
      criptoCotacoes = out;
      if (el) el.textContent = `Cotações atualizadas às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (e) {
      if (el) el.textContent = "Não foi possível carregar as cotações agora";
    }
  }

  /* =========================================================
     RENDER — RESUMO
  ========================================================= */

  function atualizarResumo() {
    const pos = calcularPosicoes();
    let inv = 0, atual = 0;
    Object.values(pos).forEach((p) => {
      inv += p.custoTotal;
      const pr = criptoCotacoes[p.cripto]?.brl || 0;
      atual += p.quantidade * pr;
    });
    const lucro = atual - inv;
    const rent = inv > 0 ? (lucro / inv) * 100 : 0;
    const elI = document.getElementById("criptoTotalInvestido");
    const elA = document.getElementById("criptoValorAtual");
    const elL = document.getElementById("criptoLucroPrejuizo");
    const elR = document.getElementById("criptoRentabilidade");
    if (elI) elI.textContent = money(inv);
    if (elA) elA.textContent = money(atual);
    if (elL) { elL.textContent = money(lucro); elL.style.color = lucro >= 0 ? "var(--success)" : "var(--danger)"; }
    if (elR) { elR.textContent = pctFmt(rent); elR.style.color = rent >= 0 ? "var(--success)" : "var(--danger)"; }
  }

  /* =========================================================
     RENDER — CARDS
  ========================================================= */

  function renderCards() {
    const container = document.getElementById("criptoCards");
    if (!container) return;
    const pos = calcularPosicoes();
    const ativas = Object.values(pos).filter((p) => p.quantidade > 0.00000001);
    if (ativas.length === 0) {
      container.innerHTML = `<div class="empty-cards">Nenhuma cripto na carteira ainda.</div>`;
      return;
    }
    container.innerHTML = ativas.map((p) => {
      const cot = criptoCotacoes[p.cripto];
      const pr = cot?.brl || 0;
      const val = p.quantidade * pr;
      const lucro = val - p.custoTotal;
      const rent = p.custoTotal > 0 ? (lucro / p.custoTotal) * 100 : 0;
      const cor = lucro >= 0 ? "#10b981" : "#ef4444";
      const ch = cot?.change24h || 0;
      return `
        <div class="beneficio-card" style="background: ${criptoGradiente(p.cripto)}" onclick="window.filtrarCriptoPorMoeda('${p.cripto}')">
          <div class="card-title">${p.cripto}</div>
          <div class="card-line"><span>Qtd</span><strong>${qtdFmt(p.quantidade)}</strong></div>
          <div class="card-line"><span>Valor</span><strong>${money(val)}</strong></div>
          <div class="card-line"><span>P&L</span><strong style="color:${cor}">${money(lucro)}</strong></div>
          <div class="card-hint">${pctFmt(rent)} · Preço ${money(pr)}${ch ? ` · 24h ${pctFmt(ch)}` : ""}</div>
        </div>
      `;
    }).join("");
  }

  /* =========================================================
     RENDER — TABELA
  ========================================================= */

  function renderTabela(filtro) {
    const tbody = document.getElementById("criptoLista");
    if (!tbody) return;
    let dados = [...criptoOperacoes];
    if (filtro) {
      if (filtro.moeda && filtro.moeda !== "todas") dados = dados.filter((o) => o.cripto === filtro.moeda);
      if (filtro.tipo && filtro.tipo !== "todos") dados = dados.filter((o) => o.tipo === filtro.tipo);
      if (filtro.dataInicio) dados = dados.filter((o) => o.data >= filtro.dataInicio);
      if (filtro.dataFim) dados = dados.filter((o) => o.data <= filtro.dataFim);
    }
    dados.sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      return (b.criadoEm || 0) - (a.criadoEm || 0);
    });
    const cont = document.getElementById("criptoContador");
    if (cont) cont.textContent = `${dados.length} ${dados.length === 1 ? "registro" : "registros"}`;
    if (dados.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="12">Nenhuma operação registrada</td></tr>`;
      return;
    }
    tbody.innerHTML = dados.map((op) => {
      const pu = op.quantidade > 0 ? op.valorLiquido / op.quantidade : 0;
      const tp = op.tipo === "compra" ? "tipo-entrada" : "tipo-saida";
      const tpL = op.tipo === "compra" ? "Compra" : "Venda";
      let pmTxt = "—", lTxt = "—", rTxt = "—", cor = "";
      if (op.tipo === "compra") {
        pmTxt = money(op.valorLiquido / op.quantidade);
      } else {
        const pm = precoMedioNaData(op.cripto, op.data);
        if (pm > 0) {
          const custo = op.quantidade * pm;
          const lucro = op.valorLiquido - custo;
          const rent = custo > 0 ? (lucro / custo) * 100 : 0;
          pmTxt = money(pm);
          lTxt = money(lucro);
          rTxt = pctFmt(rent);
          cor = lucro >= 0 ? "var(--success)" : "var(--danger)";
        }
      }
      return `
        <tr>
          <td>${formatarDataSafe(op.data)}</td>
          <td class="${tp}">${tpL}</td>
          <td><strong>${escapeHtmlSafe(op.cripto)}</strong></td>
          <td class="valor-cell">${qtdFmt(op.quantidade)}</td>
          <td class="valor-cell">${money(op.valorBruto)}</td>
          <td class="valor-cell">${money(op.taxa)}</td>
          <td class="valor-cell">${money(op.valorLiquido)}</td>
          <td class="valor-cell">${money(pu)}</td>
          <td class="valor-cell">${pmTxt}</td>
          <td class="valor-cell" style="color:${cor}">${lTxt}</td>
          <td class="valor-cell" style="color:${cor}">${rTxt}</td>
          <td class="text-right">
            <div class="row-actions">
              <button class="action-btn danger" onclick="window.criptoExcluir(${op.id})" title="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  /* =========================================================
     SELECTS / FILTROS
  ========================================================= */

  function atualizarSelectMoedas() {
    const sel = document.getElementById("filtroCriptoMoeda");
    if (!sel) return;
    const moedas = [...new Set(criptoOperacoes.map((o) => o.cripto))].sort();
    const v = sel.value;
    sel.innerHTML = '<option value="todas">Todas</option>';
    moedas.forEach((m) => { sel.innerHTML += `<option value="${m}">${m}</option>`; });
    if (moedas.includes(v)) sel.value = v;
  }

  function filtrarPorMoeda(m) {
    const sel = document.getElementById("filtroCriptoMoeda");
    if (!sel) return;
    sel.value = m;
    aplicarFiltros();
    const cont = document.getElementById("filtrosCriptoContent");
    if (cont && cont.classList.contains("collapsed")) {
      cont.classList.remove("collapsed");
      const btn = cont.previousElementSibling;
      if (btn) btn.classList.add("open");
    }
  }

  function aplicarFiltros() {
    renderTabela({
      moeda: document.getElementById("filtroCriptoMoeda").value,
      tipo: document.getElementById("filtroCriptoTipo").value,
      dataInicio: document.getElementById("filtroCriptoDataInicio").value,
      dataFim: document.getElementById("filtroCriptoDataFim").value,
    });
  }

  function limparFiltros() {
    const m = document.getElementById("filtroCriptoMoeda");
    const t = document.getElementById("filtroCriptoTipo");
    const di = document.getElementById("filtroCriptoDataInicio");
    const df = document.getElementById("filtroCriptoDataFim");
    if (m) m.value = "todas";
    if (t) t.value = "todos";
    if (di) di.value = "";
    if (df) df.value = "";
  }

  /* =========================================================
     FORMULÁRIO
     🔔 Regra: VALOR BRUTO já inclui a taxa.
        Valor líquido = bruto − taxa (sempre).
        Preço unitário = líquido / quantidade.
  ========================================================= */

  function camposAuto() {
    const q = parseFloat(document.getElementById("criptoQuantidade")?.value) || 0;
    const b = parseFloat(document.getElementById("criptoValorBruto")?.value) || 0;
    const t = parseFloat(document.getElementById("criptoTaxa")?.value) || 0;

    // 🔔 Valor bruto JÁ INCLUI a taxa — líquido é SEMPRE bruto − taxa
    const liq = b - t;
    const pu = q > 0 ? liq / q : 0;

    const elL = document.getElementById("criptoValorLiquido");
    const elP = document.getElementById("criptoPrecoUnitario");
    if (elL) elL.value = liq > 0 ? money(liq) : "—";
    if (elP) elP.value = pu > 0 ? money(pu) : "—";
  }

  function resetarForm() {
    const f = document.getElementById("formCripto");
    if (!f) return;
    f.reset();
    const d = document.getElementById("criptoData");
    if (d) d.value = window.dataHoje ? window.dataHoje() : new Date().toISOString().split("T")[0];
    const t = document.getElementById("criptoTaxa");
    if (t) t.value = 0;
    const w = document.getElementById("criptoOutraWrapper");
    if (w) w.style.display = "none";
    const elL = document.getElementById("criptoValorLiquido");
    const elP = document.getElementById("criptoPrecoUnitario");
    if (elL) elL.value = "";
    if (elP) elP.value = "";
  }

  async function excluir(id) {
    if (!confirm("Deseja realmente excluir esta operação?")) return;
    const op = criptoOperacoes.find((o) => o.id === id);
    if (!op) return;

    if (op._fbId) await excluirCriptoNoFB(op._fbId);
    criptoOperacoes = criptoOperacoes.filter((o) => o.id !== id);
    toastSafe("Operação excluída", "info");
    atualizarTudo();
  }

  /* =========================================================
     EXPORTAR / IMPORTAR
  ========================================================= */

  function exportarJSON() {
    if (criptoOperacoes.length === 0) { toastSafe("Nada para exportar", "warning"); return; }
    const blob = new Blob([JSON.stringify(criptoOperacoes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `criptos_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastSafe("Backup exportado!", "success");
  }

  function exportarCSV() {
    if (criptoOperacoes.length === 0) { toastSafe("Nada para exportar", "warning"); return; }
    const ordenadas = [...criptoOperacoes].sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? -1 : 1;
      return (a.criadoEm || 0) - (b.criadoEm || 0);
    });
    const header = ["Data","Tipo","Cripto","Valor Bruto","Taxa","Valor Líquido","Quantidade","Preço Unit","Preço Médio","Lucro","Rentabilidade","Observação"];
    const linhas = ordenadas.map((op) => {
      const pu = op.quantidade > 0 ? op.valorLiquido / op.quantidade : 0;
      let pm = "", lu = "", re = "";
      if (op.tipo === "venda") {
        const p = precoMedioNaData(op.cripto, op.data);
        if (p > 0) {
          const cv = op.quantidade * p;
          const l = op.valorLiquido - cv;
          pm = p.toFixed(2); lu = l.toFixed(2); re = cv > 0 ? ((l / cv) * 100).toFixed(2) : "0";
        }
      }
      return [
        formatarDataSafe(op.data), op.tipo, op.cripto,
        op.valorBruto.toFixed(2), op.taxa.toFixed(2), op.valorLiquido.toFixed(2),
        op.quantidade.toString(), pu.toFixed(2), pm, lu, re, op.observacao || "",
      ];
    });
    const csv = [header, ...linhas].map((l) => l.map((c) => {
      const s = String(c ?? "");
      return (s.includes(";") || s.includes("\n") || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `criptos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastSafe("CSV exportado!", "success");
  }

  async function importarJSON(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        if (!Array.isArray(dados)) throw new Error("Formato inválido");
        if (!confirm(`Importar ${dados.length} operações? Serão adicionadas ao Firestore.`)) return;

        for (const item of dados) {
          const nova = {
            id: item.id || cid(),
            data: item.data, tipo: item.tipo,
            cripto: String(item.cripto).toUpperCase(),
            quantidade: Number(item.quantidade) || 0,
            valorBruto: Number(item.valorBruto) || 0,
            taxa: Number(item.taxa) || 0,
            valorLiquido: Number(item.valorLiquido) || 0,
            observacao: item.observacao || "",
            criadoEm: item.criadoEm || Date.now(),
          };
          const fbId = await salvarCriptoNoFB(nova);
          nova._fbId = fbId;
          criptoOperacoes.push(nova);
        }
        atualizarTudo();
        toastSafe(`${dados.length} operações importadas!`, "success");
      } catch (err) {
        console.error(err);
        toastSafe("Erro ao importar arquivo", "error");
      }
    };
    reader.readAsText(file);
  }

  /* =========================================================
     ATUALIZAÇÃO
  ========================================================= */

  function atualizarTudo() {
    atualizarResumo();
    renderCards();
    renderTabela();
    atualizarSelectMoedas();
  }

  async function atualizarCotacoesERender() {
    await buscarCotacoes();
    atualizarTudo();
  }

  /* =========================================================
     MODAL DE CORES
  ========================================================= */

  function renderListaCores() {
    const container = document.getElementById("listaCoresCriptos");
    if (!container) return;
    const moedas = [...new Set(criptoOperacoes.map((o) => o.cripto))].sort();
    if (moedas.length === 0) {
      container.innerHTML = `<div class="empty-cards">Nenhuma cripto cadastrada ainda</div>`;
      return;
    }
    container.innerHTML = moedas.map((m) => `
      <div class="color-item">
        <span>${m}</span>
        <input type="color" class="cor-cripto-input" data-nome="${m}" value="${criptoCorDe(m)}">
      </div>
    `).join("");
  }

  async function aplicarCoresDoModal() {
    document.querySelectorAll(".cor-cripto-input").forEach((inp) => {
      criptoCores[inp.dataset.nome] = inp.value;
    });
    await salvarCoresCriptoNoFB();
    renderCards();
  }

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================= */

  async function iniciar() {
    if (criptoInicializado) {
      await recarregar();
      return;
    }
    criptoInicializado = true;

    await carregar();

    const d = document.getElementById("criptoData");
    if (d) d.value = window.dataHoje ? window.dataHoje() : new Date().toISOString().split("T")[0];

    const selM = document.getElementById("criptoMoeda");
    const wO = document.getElementById("criptoOutraWrapper");
    if (selM && wO) {
      selM.addEventListener("change", () => {
        wO.style.display = selM.value === "OUTRA" ? "" : "none";
      });
    }

    ["criptoQuantidade", "criptoValorBruto", "criptoTaxa", "criptoTipo"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener("input", camposAuto); el.addEventListener("change", camposAuto); }
    });

    const form = document.getElementById("formCripto");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = document.getElementById("criptoData").value;
        const tipo = document.getElementById("criptoTipo").value;
        const selV = document.getElementById("criptoMoeda").value;
        const outra = document.getElementById("criptoOutra").value.trim().toUpperCase();
        const cripto = selV === "OUTRA" ? outra : selV;
        const q = parseFloat(document.getElementById("criptoQuantidade").value);
        const b = parseFloat(document.getElementById("criptoValorBruto").value);
        const t = parseFloat(document.getElementById("criptoTaxa").value) || 0;
        const obs = document.getElementById("criptoObservacao").value.trim();

        if (!data || !cripto || !q || !b) { toastSafe("Preencha todos os campos obrigatórios", "error"); return; }
        if (q <= 0 || b <= 0) { toastSafe("Quantidade e valor devem ser maiores que zero", "error"); return; }
        if (t < 0 || t >= b) { toastSafe("A taxa não pode ser maior ou igual ao valor bruto", "error"); return; }

        if (tipo === "venda") {
          const qd = qtdDisponivelNaData(cripto, data);
          if (q > qd + 1e-9) { toastSafe(`Você só tem ${qtdFmt(qd)} ${cripto} até essa data`, "error"); return; }
        }

        // 🔔 Valor bruto já inclui a taxa → líquido = bruto − taxa
        const liq = b - t;
        const nova = {
          id: cid(), data, tipo, cripto, quantidade: q,
          valorBruto: b, taxa: t, valorLiquido: liq, observacao: obs,
          criadoEm: Date.now(),
        };

        const fbId = await salvarCriptoNoFB(nova);
        nova._fbId = fbId;
        criptoOperacoes.push(nova);

        resetarForm();
        toastSafe("Operação adicionada!", "success");
        atualizarTudo();
      });
    }

    const btnAt = document.getElementById("btnAtualizarCotacoes");
    if (btnAt) btnAt.addEventListener("click", async () => {
      await atualizarCotacoesERender();
      toastSafe("Cotações atualizadas!", "success");
    });

    const btnAp = document.getElementById("btnAplicarFiltroCripto");
    if (btnAp) btnAp.addEventListener("click", aplicarFiltros);

    const btnLim = document.getElementById("btnLimparFiltroCripto");
    if (btnLim) btnLim.addEventListener("click", () => { limparFiltros(); renderTabela(); });

    const btnJ = document.getElementById("btnExportarJSON");
    if (btnJ) btnJ.addEventListener("click", exportarJSON);

    const btnC = document.getElementById("btnExportarCSV");
    if (btnC) btnC.addEventListener("click", exportarCSV);

    const btnI = document.getElementById("btnImportarJSON");
    const inpI = document.getElementById("inputImportarJSON");
    if (btnI && inpI) {
      btnI.addEventListener("click", () => inpI.click());
      inpI.addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (f) importarJSON(f);
        inpI.value = "";
      });
    }

    atualizarTudo();
    atualizarCotacoesERender();

    setInterval(() => {
      const aba = document.getElementById("abaCriptos");
      if (aba && aba.classList.contains("active")) atualizarCotacoesERender();
    }, 120000);
  }

  async function carregar() {
    criptoOperacoes = await carregarCriptosDoFB();
    await carregarCoresCriptoDoFB();
  }

  async function recarregar() {
    await carregar();
    atualizarTudo();
    await atualizarCotacoesERender();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.nav-item[data-aba="criptos"]');
    if (btn) setTimeout(() => {
      if (!criptoInicializado) iniciar();
      else recarregar();
    }, 50);
  });

  window.criptoIniciar = iniciar;
  window.criptoAtualizarTudo = atualizarTudo;
  window.criptoAtualizarCotacoesERender = atualizarCotacoesERender;
  window.criptoExcluir = excluir;
  window.filtrarCriptoPorMoeda = filtrarPorMoeda;
  window.renderListaCoresCriptos = renderListaCores;
  window.criptoAplicarCoresDoModal = aplicarCoresDoModal;
  window.criptoCalcularPosicoes = calcularPosicoes;
  window.criptoGetCotacoes = () => criptoCotacoes;
  window.criptoGetOperacoes = () => criptoOperacoes;
})();
