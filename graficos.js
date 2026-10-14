/* =========================================================
   FINANÇA — Módulo Gráficos (Chart.js)
   🔔 Cores vindas de window.coresPersonalizadas
========================================================= */

(function () {
  "use strict";

  let graficosInicializado = false;
  let charts = {};

  function money(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function toastSafe(m, t) { if (typeof window.toast === "function") window.toast(m, t || "info"); }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function getTextColor() { return cssVar("--text", "#f1f5f9"); }
  function getMutedColor() { return cssVar("--text-muted", "#94a3b8"); }
  function getGridColor() { return cssVar("--border", "rgba(148,163,184,.1)"); }
  function getSurfaceColor() { return cssVar("--surface", "#141a2e"); }

  /* =========================================================
     CORES PERSONALIZADAS
  ========================================================= */

  const CORES_FALLBACK = {
    entrada: "#10b981",
    saida: "#ef4444",
    saldo: "#6366f1",
  };

  const PALETA_AUTO = [
    "#6366f1", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
    "#ec4899", "#14b8a6", "#06b6d4", "#f97316", "#84cc16",
    "#22c55e", "#eab308", "#e11d48", "#0891b2", "#a855f7",
  ];

  const COR_SEM_BANCO = "#64748b"; // cinza neutro

  function getCores() {
    const c = window.coresPersonalizadas || {};
    return {
      entrada: c.entrada || CORES_FALLBACK.entrada,
      saida: c.saida || CORES_FALLBACK.saida,
      saldo: c.saldo || CORES_FALLBACK.saldo,
      beneficios: c.beneficios || {},
      bancos: c.bancos || {},
      criptos: c.criptos || {},
    };
  }

  /* 🔔 Normaliza chave pra comparação (remove acentos, espaços, case) */
  function normalizarChave(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  /* 🔔 Busca cor em um mapa, ignorando case/acentos/espaços */
  function corDoMapa(mapa, chave, fallback) {
    if (!mapa || !chave) return fallback;
    if (mapa[chave]) return mapa[chave]; // match exato primeiro

    const alvo = normalizarChave(chave);
    for (const k of Object.keys(mapa)) {
      if (normalizarChave(k) === alvo) return mapa[k];
    }
    return fallback;
  }

  /* Converte hex (#6366f1) em rgba(99,102,241,alpha) */
  function hexParaRgba(hex, alpha) {
    if (!hex || typeof hex !== "string") return `rgba(99,102,241,${alpha})`;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* Mapa de cores por banco */
  function coresPorBanco(labels) {
    const cores = getCores();
    return labels.map((label, i) => {
      // 🔔 "Sem banco" sempre em cinza neutro
      if (label === "Sem banco") return COR_SEM_BANCO;
      return corDoMapa(cores.bancos, label, PALETA_AUTO[i % PALETA_AUTO.length]);
    });
  }

  /* Mapa de cores por benefício */
  function coresPorBeneficio(labels) {
    const cores = getCores();
    return labels.map((label, i) =>
      corDoMapa(cores.beneficios, label, PALETA_AUTO[i % PALETA_AUTO.length])
    );
  }

  /* Mapa de cores por cripto */
  function coresPorCripto(labels) {
    const cores = getCores();
    return labels.map((label, i) =>
      corDoMapa(cores.criptos, label, PALETA_AUTO[i % PALETA_AUTO.length])
    );
  }

  /* ============ PERÍODO ============ */

  function getPeriodoPadrao() {
    const hoje = new Date();
    const y = hoje.getFullYear(), m = hoje.getMonth();
    const inicio = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const fim = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    return { inicio, fim };
  }

  function getPeriodo() {
    const di = document.getElementById("graficoDataInicio")?.value;
    const df = document.getElementById("graficoDataFim")?.value;
    if (di && df) return { inicio: di, fim: df };
    return getPeriodoPadrao();
  }

  function transNoPeriodo(inicio, fim) {
    return (window.transacoes || []).filter((t) => t.data >= inicio && t.data <= fim);
  }

  /* ============ MÉTRICAS ============ */

  function renderMetricas() {
    const { inicio, fim } = getPeriodo();
    const trans = transNoPeriodo(inicio, fim);

    let ent = 0, sai = 0;
    trans.forEach((t) => {
      if (t.tipo === "entrada") ent += t.valor;
      else if (t.tipo === "saida" && t.modalidade !== "Crédito") sai += t.valor;
    });

    let criptoAtual = 0;
    if (window.criptoCalcularPosicoes && window.criptoGetCotacoes) {
      const pos = window.criptoCalcularPosicoes();
      const cot = window.criptoGetCotacoes();
      Object.values(pos).forEach((p) => {
        const pr = cot[p.cripto]?.brl || 0;
        criptoAtual += p.quantidade * pr;
      });
    }

    /* Fatura total: soma o total real de cada fatura ABERTA */
    let faturaTotal = 0;
    if (typeof window.totalFaturaDinamico === "function" && typeof window.mesesFatura === "function") {
      const bancos = (window.configUsuario && window.configUsuario.bancos) || [];
      bancos.forEach((b) => {
        const meses = window.mesesFatura(b);
        meses.forEach((mes) => {
          const st = window.statusFatura ? window.statusFatura(b, mes) : "aberta";
          if (st !== "aberta") return;
          faturaTotal += window.totalFaturaDinamico(b, mes);
        });
      });
    }

    const cores = getCores();
    const elS = document.getElementById("graficoSaldo");
    const elE = document.getElementById("graficoEntradas");
    const elSai = document.getElementById("graficoSaidas");
    const elC = document.getElementById("graficoCripto");
    const elF = document.getElementById("graficoFatura");

    if (elS) {
      elS.textContent = money(ent - sai);
      elS.style.color = (ent - sai) >= 0 ? cores.saldo : cores.saida;
    }
    if (elE) { elE.textContent = money(ent); elE.style.color = cores.entrada; }
    if (elSai) { elSai.textContent = money(sai); elSai.style.color = cores.saida; }
    if (elC) elC.textContent = money(criptoAtual);
    if (elF) elF.textContent = money(faturaTotal);
  }

  /* ============ GRÁFICO: CATEGORIAS ============ */
  /* 🔔 Aplica cores personalizadas quando a categoria (modalidade) também
        existir em benefícios ou bancos; senão paleta automática. */

  function chartCategorias() {
    const { inicio, fim } = getPeriodo();
    const trans = transNoPeriodo(inicio, fim).filter((t) => t.tipo === "saida");

    const porCat = {};
    trans.forEach((t) => {
      const cat = t.modalidade || "Outros";
      porCat[cat] = (porCat[cat] || 0) + t.valor;
    });

    const labels = Object.keys(porCat);
    const valores = Object.values(porCat);

    if (charts.categorias) charts.categorias.destroy();
    const ctx = document.getElementById("chartCategorias");
    if (!ctx) return;

    /* 🔔 Cor: benefício > banco > paleta automática */
    const cores = getCores();
    const bg = labels.map((label, i) => {
      const cB = corDoMapa(cores.beneficios, label, null);
      if (cB) return cB;
      const cBc = corDoMapa(cores.bancos, label, null);
      if (cBc) return cBc;
      return PALETA_AUTO[i % PALETA_AUTO.length];
    });

    charts.categorias = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: bg,
          borderColor: getSurfaceColor(),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: getTextColor(), font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${money(ctx.raw)}` } },
        },
      },
    });
  }

  /* ============ GRÁFICO: BANCOS ============ */

  function chartBancos() {
    const { inicio, fim } = getPeriodo();
    const trans = transNoPeriodo(inicio, fim);

    const porBanco = {};

    // Saídas normais (débito, pix, boleto, fora do crédito)
    trans.forEach((t) => {
      if (t.tipo !== "saida") return;
      if (t.modalidade === "Crédito") return;
      const b = t.banco || "Sem banco";
      porBanco[b] = (porBanco[b] || 0) + t.valor;
    });

    // 🔔 Faturas pagas no período — entram como gasto do banco
    const faturasSalvas = window.getFaturasSalvas ? window.getFaturasSalvas() : {};
    const bancos = (window.configUsuario && window.configUsuario.bancos) || [];
    bancos.forEach((b) => {
      Object.keys(faturasSalvas).forEach((chave) => {
        const idx = chave.lastIndexOf("_");
        const bancoChave = chave.substring(0, idx);
        const mes = chave.substring(idx + 1);
        if (bancoChave !== b) return;
        const salva = faturasSalvas[chave];
        if (!salva || salva.status !== "paga" || salva.valorFechado == null) return;
        const refMes = `${mes}-01`;
        if (refMes < inicio || refMes > fim) return;
        porBanco[b] = (porBanco[b] || 0) + (Number(salva.valorFechado) || 0);
      });
    });

    const labels = Object.keys(porBanco);
    const valores = Object.values(porBanco);

    if (charts.bancos) charts.bancos.destroy();
    const ctx = document.getElementById("chartBancos");
    if (!ctx) return;

    /* 🔔 Cores por banco vindas de coresPersonalizadas.bancos */
    const cores = coresPorBanco(labels);

    charts.bancos = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Gasto",
          data: valores,
          backgroundColor: cores,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } } },
        scales: {
          x: { ticks: { color: getMutedColor(), callback: (v) => "R$ " + v }, grid: { color: getGridColor() } },
          y: { ticks: { color: getTextColor() }, grid: { display: false } },
        },
      },
    });
  }

  /* ============ GRÁFICO: EVOLUÇÃO MENSAL ============ */

  function chartEvolucao() {
    const hoje = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push({
        ref: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      });
    }

    const entradas = meses.map(() => 0);
    const saidas = meses.map(() => 0);

    (window.transacoes || []).forEach((t) => {
      const mes = t.data.substring(0, 7);
      const idx = meses.findIndex((m) => m.ref === mes);
      if (idx === -1) return;
      if (t.tipo === "entrada") entradas[idx] += t.valor;
      else if (t.tipo === "saida" && t.modalidade !== "Crédito") saidas[idx] += t.valor;
    });

    if (charts.evolucao) charts.evolucao.destroy();
    const ctx = document.getElementById("chartEvolucao");
    if (!ctx) return;

    /* 🔔 Usa coresPersonalizadas.entrada e .saida */
    const cores = getCores();
    const cE = cores.entrada;
    const cS = cores.saida;

    charts.evolucao = new Chart(ctx, {
      type: "line",
      data: {
        labels: meses.map((m) => m.label),
        datasets: [
          {
            label: "Entradas",
            data: entradas,
            borderColor: cE,
            backgroundColor: hexParaRgba(cE, 0.15),
            fill: true, tension: 0.35, borderWidth: 2,
          },
          {
            label: "Saídas",
            data: saidas,
            borderColor: cS,
            backgroundColor: hexParaRgba(cS, 0.15),
            fill: true, tension: 0.35, borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: getTextColor() } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.raw)}` } },
        },
        scales: {
          x: { ticks: { color: getMutedColor() }, grid: { color: getGridColor() } },
          y: { ticks: { color: getMutedColor(), callback: (v) => "R$ " + v }, grid: { color: getGridColor() } },
        },
      },
    });
  }

  /* ============ GRÁFICO: CRIPTO ============ */

  function chartCripto() {
    if (!window.criptoCalcularPosicoes || !window.criptoGetCotacoes) return;
    const pos = window.criptoCalcularPosicoes();
    const cot = window.criptoGetCotacoes();

    const labels = [];
    const valores = [];
    Object.values(pos).forEach((p) => {
      if (p.quantidade <= 0.00000001) return;
      const pr = cot[p.cripto]?.brl || 0;
      labels.push(p.cripto);
      valores.push(p.quantidade * pr);
    });

    if (charts.cripto) charts.cripto.destroy();
    const ctx = document.getElementById("chartCripto");
    if (!ctx) return;

    if (labels.length === 0) {
      charts.cripto = new Chart(ctx, {
        type: "doughnut",
        data: { labels: ["Sem dados"], datasets: [{ data: [1], backgroundColor: [getGridColor()] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getMutedColor() } } } },
      });
      return;
    }

    /* 🔔 Cores por cripto se existirem, senão paleta automática */
    const cores = coresPorCripto(labels);

    charts.cripto = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: cores,
          borderColor: getSurfaceColor(),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: getTextColor() } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${money(ctx.raw)}` } },
        },
      },
    });
  }

  /* ============ GRÁFICO: FATURA ============ */
  /* 🔔 Inclui faturas abertas, fechadas e pagas (ignora apenas futuras) */

  function chartFatura() {
    const bancos = (window.configUsuario && window.configUsuario.bancos) || [];
    const porBanco = {};

    if (typeof window.totalFaturaDinamico === "function" && typeof window.mesesFatura === "function") {
      bancos.forEach((b) => {
        let total = 0;
        const meses = window.mesesFatura(b);
        meses.forEach((mes) => {
          const st = window.statusFatura ? window.statusFatura(b, mes) : "aberta";
          // 🔔 Inclui abertas, fechadas e pagas — ignora apenas futuras
          if (st === "futura") return;
          total += window.totalFaturaDinamico(b, mes);
        });
        if (total > 0) porBanco[b] = total;
      });
    }

    const labels = Object.keys(porBanco);
    const valores = Object.values(porBanco);

    if (charts.fatura) charts.fatura.destroy();
    const ctx = document.getElementById("chartFatura");
    if (!ctx) return;

    /* 🔔 Cores por banco (mesmas dos cards de fatura) */
    const cores = labels.length ? coresPorBanco(labels) : [getGridColor()];

    charts.fatura = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels.length ? labels : ["Sem dados"],
        datasets: [{
          label: "Fatura",
          data: valores.length ? valores : [0],
          backgroundColor: cores,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } } },
        scales: {
          x: { ticks: { color: getTextColor() }, grid: { display: false } },
          y: { ticks: { color: getMutedColor(), callback: (v) => "R$ " + v }, grid: { color: getGridColor() } },
        },
      },
    });
  }

  /* ============ GRÁFICO: BENEFÍCIOS ============ */

  function chartBeneficios() {
    const beneficios = (window.configUsuario && window.configUsuario.beneficios) || [];
    const trans = window.transacoes || [];

    const labels = [];
    const valores = [];

    beneficios.forEach((b) => {
      let saldo = 0;
      trans.forEach((t) => {
        if (t.modalidade !== b) return;
        if (t.tipo === "entrada") saldo += t.valor;
        else saldo -= t.valor;
      });
      labels.push(b);
      valores.push(saldo);
    });

    if (charts.beneficios) charts.beneficios.destroy();
    const ctx = document.getElementById("chartBeneficios");
    if (!ctx) return;

    if (labels.length === 0) {
      charts.beneficios = new Chart(ctx, {
        type: "bar",
        data: { labels: ["Sem dados"], datasets: [{ data: [0], backgroundColor: [getGridColor()] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
      return;
    }

    /* 🔔 Cor personalizada do benefício (mesma do card) */
    const coresB = coresPorBeneficio(labels);

    charts.beneficios = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Saldo",
          data: valores,
          backgroundColor: coresB,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => money(ctx.raw) } } },
        scales: {
          x: { ticks: { color: getTextColor() }, grid: { display: false } },
          y: { ticks: { color: getMutedColor(), callback: (v) => "R$ " + v }, grid: { color: getGridColor() } },
        },
      },
    });
  }

  /* ============ RENDER GERAL ============ */

  function renderTudo() {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js não carregado");
      return;
    }
    renderMetricas();
    chartCategorias();
    chartBancos();
    chartEvolucao();
    chartCripto();
    chartFatura();
    chartBeneficios();
  }

  /* =========================================================
     🔔 APLICAR CORES EM TEMPO REAL
     Estratégia: se o gráfico existe, atualiza dataset + update().
     Se o gráfico de cripto ainda não existe, cria do zero.
  ========================================================= */

  function aplicarCores() {
    const cores = getCores();

    if (charts.evolucao && charts.evolucao.data.datasets.length >= 2) {
      const cE = cores.entrada;
      const cS = cores.saida;
      charts.evolucao.data.datasets[0].borderColor = cE;
      charts.evolucao.data.datasets[0].backgroundColor = hexParaRgba(cE, 0.15);
      charts.evolucao.data.datasets[1].borderColor = cS;
      charts.evolucao.data.datasets[1].backgroundColor = hexParaRgba(cS, 0.15);
      charts.evolucao.update();
    }

    if (charts.categorias) {
      const labels = charts.categorias.data.labels || [];
      const bg = labels.map((label, i) => {
        const cB = corDoMapa(cores.beneficios, label, null);
        if (cB) return cB;
        const cBc = corDoMapa(cores.bancos, label, null);
        if (cBc) return cBc;
        return PALETA_AUTO[i % PALETA_AUTO.length];
      });
      charts.categorias.data.datasets[0].backgroundColor = bg;
      charts.categorias.update();
    }

    if (charts.bancos) {
      charts.bancos.data.datasets[0].backgroundColor = coresPorBanco(charts.bancos.data.labels);
      charts.bancos.update();
    }

    if (charts.fatura) {
      charts.fatura.data.datasets[0].backgroundColor = coresPorBanco(charts.fatura.data.labels);
      charts.fatura.update();
    }

    if (charts.beneficios) {
      charts.beneficios.data.datasets[0].backgroundColor = coresPorBeneficio(charts.beneficios.data.labels);
      charts.beneficios.update();
    }

    if (charts.cripto) {
      charts.cripto.data.datasets[0].backgroundColor = coresPorCripto(charts.cripto.data.labels);
      charts.cripto.update();
    }

    /* 🔔 Se o gráfico de cripto ainda não existe, cria pra já nascer com a cor certa */
    if (!charts.cripto && typeof window.criptoCalcularPosicoes === "function") {
      chartCripto();
    }

    /* Métricas também recebem as novas cores */
    renderMetricas();
  }

  /* ============ BOTÕES DE PERÍODO ============ */

  function setPeriodo(inicio, fim) {
    const di = document.getElementById("graficoDataInicio");
    const df = document.getElementById("graficoDataFim");
    if (di) di.value = inicio;
    if (df) df.value = fim;
    renderTudo();
  }

  function periodoMesAtual() {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth();
    const ini = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const fim = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    setPeriodo(ini, fim);
  }

  function periodoUltimosMeses(n) {
    const hoje = new Date();
    const iniD = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1), 1);
    const ini = `${iniD.getFullYear()}-${String(iniD.getMonth() + 1).padStart(2, "0")}-01`;
    const lastD = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const fim = `${lastD.getFullYear()}-${String(lastD.getMonth() + 1).padStart(2, "0")}-${String(lastD.getDate()).padStart(2, "0")}`;
    setPeriodo(ini, fim);
  }

  function periodoAno() {
    const y = new Date().getFullYear();
    setPeriodo(`${y}-01-01`, `${y}-12-31`);
  }

  /* ============ INICIALIZAÇÃO ============ */

  function iniciar() {
    if (graficosInicializado) { renderTudo(); return; }
    graficosInicializado = true;

    const { inicio, fim } = getPeriodoPadrao();
    const di = document.getElementById("graficoDataInicio");
    const df = document.getElementById("graficoDataFim");
    if (di) di.value = inicio;
    if (df) df.value = fim;

    const btnMes = document.getElementById("btnGraficoMesAtual");
    const btn3 = document.getElementById("btnGraficoUltimos3");
    const btn6 = document.getElementById("btnGraficoUltimos6");
    const btnAno = document.getElementById("btnGraficoAno");
    const btnAp = document.getElementById("btnGraficoAplicar");

    if (btnMes) btnMes.addEventListener("click", periodoMesAtual);
    if (btn3) btn3.addEventListener("click", () => periodoUltimosMeses(3));
    if (btn6) btn6.addEventListener("click", () => periodoUltimosMeses(6));
    if (btnAno) btnAno.addEventListener("click", periodoAno);
    if (btnAp) btnAp.addEventListener("click", () => { renderTudo(); toastSafe("Período aplicado", "info"); });

    renderTudo();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.nav-item[data-aba="graficos"]');
    if (btn) setTimeout(() => {
      if (!graficosInicializado) iniciar();
      else renderTudo();
    }, 100);
  });

  /* 🔔 Escuta mudanças de tema */
  window.addEventListener("financa-tema-mudou", () => {
    if (graficosInicializado) renderTudo();
  });

  /* 🔔 API pública */
  window.graficosIniciar = iniciar;
  window.graficosRenderTudo = renderTudo;
  window.graficosAplicarCores = aplicarCores;
})();
