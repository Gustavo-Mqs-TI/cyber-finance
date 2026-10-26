/* =========================================================
   FINANÇA — Histórico de Criptomoedas
   ✅ Preço atual em tempo real (consistente com o card)
   ✅ Média, Mínima e Máxima corretas
   ✅ 24h em alta frequência (1h) sem downsample
   ✅ Downsamples apenas em períodos longos
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

  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const CACHE_KEY = "financa_hist_cripto";
  const MAX_PONTOS = 40;

  let graficoAtual = null;
  let moedaAtual = null;
  let periodoAtual = 30;
  let carregando = false;

  function money(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  function pctFmt(v) {
    const n = Number(v) || 0;
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  function toastSafe(m, t) {
    if (typeof window.toast === "function") window.toast(m, t || "info");
  }

  /* ---------- UI DE LOADING ---------- */

  function mostrarLoading(mensagem) {
    carregando = true;
    const loading = document.getElementById("histCriptoLoading");
    const texto = document.getElementById("histCriptoLoadingTexto");
    const canvas = document.getElementById("canvasHistoricoCripto");
    const resumo = document.getElementById("histCriptoResumo");
    const erro = document.getElementById("histCriptoErro");

    if (loading) loading.classList.add("active");
    if (texto) texto.textContent = mensagem || "Carregando dados...";
    if (canvas) canvas.style.opacity = "0.3";
    if (resumo) resumo.style.opacity = "0.4";
    if (erro) erro.classList.remove("active");

    document.querySelectorAll(".hist-periodo-btn").forEach((b) => {
      b.disabled = true;
      b.style.opacity = "0.5";
      b.style.cursor = "not-allowed";
    });
  }

  function esconderLoading() {
    carregando = false;
    const loading = document.getElementById("histCriptoLoading");
    const canvas = document.getElementById("canvasHistoricoCripto");
    const resumo = document.getElementById("histCriptoResumo");

    if (loading) loading.classList.remove("active");
    if (canvas) canvas.style.opacity = "1";
    if (resumo) resumo.style.opacity = "1";

    document.querySelectorAll(".hist-periodo-btn").forEach((b) => {
      b.disabled = false;
      b.style.opacity = "";
      b.style.cursor = "";
    });
  }

  function mostrarErro(mensagem) {
    esconderLoading();
    const erro = document.getElementById("histCriptoErro");
    const textoErro = document.getElementById("histCriptoErroTexto");
    if (erro) erro.classList.add("active");
    if (textoErro) textoErro.textContent = mensagem || "Não foi possível carregar o histórico agora.";
  }

  /* ---------- CACHE ---------- */

  function lerCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    } catch { return {}; }
  }

  function salvarCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  function chaveCache(coinId, dias) {
    return `${coinId}_${dias}`;
  }

  function getCache(coinId, dias) {
    const cache = lerCache();
    const item = cache[chaveCache(coinId, dias)];
    if (!item) return null;
    if (Date.now() - item.ts > CACHE_TTL_MS) return null;
    return item.dados;
  }

  function setCache(coinId, dias, dados) {
    const cache = lerCache();
    cache[chaveCache(coinId, dias)] = { ts: Date.now(), dados };
    salvarCache(cache);
  }

  /* ---------- DOWNSAMPLE ---------- */

  function downsample(pontos, maxPontos) {
    if (pontos.length <= maxPontos) return pontos;
    const passo = Math.ceil(pontos.length / maxPontos);
    const reduzido = [];
    for (let i = 0; i < pontos.length; i += passo) {
      reduzido.push(pontos[i]);
    }
    const ultimo = pontos[pontos.length - 1];
    if (reduzido[reduzido.length - 1]?.ts !== ultimo.ts) {
      reduzido.push(ultimo);
    }
    return reduzido;
  }

  /* ---------- BUSCA NA API ---------- */

  async function buscarHistorico(coinId, dias) {
    const cache = getCache(coinId, dias);
    if (cache) return cache;

    // 🔑 Para 24h usamos alta frequência (1h); para o resto, diário
    const interval = dias === 1 ? "hourly" : "daily";
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=brl&days=${dias}&interval=${interval}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    const data = await res.json();

    if (!data.prices || data.prices.length === 0) {
      throw new Error("Sem dados de preço no retorno");
    }

    let simplificado = data.prices.map(([ts, preco]) => ({ ts, preco }));

    // 🔑 Não aplica downsample em 24h (queremos ver a variação real)
    if (dias !== 1) {
      simplificado = downsample(simplificado, MAX_PONTOS);
    }

    setCache(coinId, dias, simplificado);
    return simplificado;
  }

  /* ---------- COR DA MOEDA ---------- */

  function corDaMoeda(simbolo) {
    if (window.coresPersonalizadas?.criptos?.[simbolo]) {
      return window.coresPersonalizadas.criptos[simbolo];
    }
    const CORES = [
      "#f7931a","#627eea","#14f195","#23292f","#0033ad",
      "#c2a633","#f3ba2f","#345d9d","#e6007a","#8247e5",
      "#2a5ada","#e84142","#ff060a","#2e3148","#00d395",
      "#ffa409","#ff007a","#b6509e","#26a17b","#2775ca",
    ];
    let h = 0;
    for (let i = 0; i < simbolo.length; i++) h = simbolo.charCodeAt(i) + ((h << 5) - h);
    return CORES[Math.abs(h) % CORES.length];
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /* ---------- RENDER DO GRÁFICO (layout da imagem) ---------- */

  function renderGrafico(simbolo, pontos) {
    const canvas = document.getElementById("canvasHistoricoCripto");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const cor = corDaMoeda(simbolo);
    const gradiente = ctx.createLinearGradient(0, 0, 0, 320);
    gradiente.addColorStop(0, hexToRgba(cor, 0.35));
    gradiente.addColorStop(1, hexToRgba(cor, 0));

    const labels = pontos.map((p) => {
      const d = new Date(p.ts);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    });
    const valores = pontos.map((p) => p.preco);

    if (graficoAtual) graficoAtual.destroy();

    const escuro = document.documentElement.getAttribute("data-theme") !== "light";
    const texto = escuro ? "#94a3b8" : "#64748b";
    const grade = escuro ? "rgba(148, 163, 184, 0.12)" : "rgba(100, 116, 139, 0.12)";

    graficoAtual = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `Preço ${simbolo} (BRL)`,
          data: valores,
          borderColor: cor,
          backgroundColor: gradiente,
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: cor,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: escuro ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.98)",
            titleColor: escuro ? "#e2e8f0" : "#0f172a",
            bodyColor: escuro ? "#cbd5e1" : "#334155",
            borderColor: escuro ? "rgba(148,163,184,0.2)" : "rgba(100,116,139,0.2)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx2) => ` ${money(ctx2.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: grade, drawBorder: false },
            ticks: { color: texto, maxTicksLimit: 8, font: { size: 11 } },
          },
          y: {
            grid: { color: grade, drawBorder: false },
            ticks: {
              color: texto,
              font: { size: 11 },
              callback: (v) => money(v),
            },
          },
        },
      },
    });
  }

  /* ---------- RESUMO (correções) ---------- */

  function renderResumo(simbolo, pontos) {
    const elAtual = document.getElementById("histCriptoPrecoAtual");
    const elVar = document.getElementById("histCriptoVariacao");
    const elMedia = document.getElementById("histCriptoMedia");
    const elMin = document.getElementById("histCriptoMin");
    const elMax = document.getElementById("histCriptoMax");
    if (!elAtual || !pontos || pontos.length === 0) return;

    const precos = pontos.map((p) => p.preco);

    // 🔑 Preço atual: se existir cotação em tempo real, usa. Senão, último ponto.
    const cotacoes = typeof window.criptoGetCotacoes === "function" ? window.criptoGetCotacoes() : {};
    const cotacaoAtual = cotacoes[simbolo]?.brl;
    const precoAtual = (cotacaoAtual && cotacaoAtual > 0) ? cotacaoAtual : precos[precos.length - 1];

    // 🔑 Máxima correta: considera o preço atual também
    const max = Math.max(...precos, precoAtual);
    const min = Math.min(...precos, precoAtual);
    const media = (precos.reduce((s, v) => s + v, 0) + precoAtual) / (precos.length + 1);

    const primeiro = precos[0];
    const variacao = primeiro > 0 ? ((precoAtual - primeiro) / primeiro) * 100 : 0;

    elAtual.textContent = money(precoAtual);
    if (elVar) {
      elVar.textContent = pctFmt(variacao);
      elVar.style.color = variacao >= 0 ? "var(--success)" : "var(--danger)";
    }
    if (elMedia) elMedia.textContent = money(media);
    if (elMin) elMin.textContent = money(min);
    if (elMax) elMax.textContent = money(max);

    return { variacao, media };
  }

  /* ---------- ABRIR MODAL ---------- */

  async function abrir(simbolo, periodo) {
    if (carregando) return;

    simbolo = String(simbolo).toUpperCase();
    periodo = periodo || periodoAtual || 30;

    const coinId = CRIPTO_MAP[simbolo];
    if (!coinId) {
      toastSafe(`Não temos dados históricos para ${simbolo}`, "warning");
      return;
    }

    moedaAtual = simbolo;
    periodoAtual = periodo;

    const modal = document.getElementById("modalHistoricoCripto");
    const titulo = document.getElementById("tituloHistoricoCripto");
    const sub = document.getElementById("subtituloHistoricoCripto");
    if (!modal) return;

    if (titulo) titulo.textContent = `Histórico — ${simbolo}`;

    document.querySelectorAll(".hist-periodo-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.dias) === periodo);
    });

    modal.classList.add("active");
    mostrarLoading(`Buscando histórico de ${simbolo}...`);

    try {
      const [pontos] = await Promise.all([
        buscarHistorico(coinId, periodo),
        new Promise((r) => setTimeout(r, 300)),
      ]);

      renderGrafico(simbolo, pontos);
      const info = renderResumo(simbolo, pontos);
      esconderLoading();

      if (sub) {
        const labelPeriodo = periodo === 1 ? "Últimas 24h" : `Últimos ${periodo} dias`;
        const varTxt = info ? ` · ${pctFmt(info.variacao)}` : "";
        sub.textContent = `${labelPeriodo}${varTxt}`;
      }
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      mostrarErro(`Erro ao carregar ${simbolo}. Tente novamente em alguns segundos.`);
      if (sub) sub.textContent = "Falha ao carregar dados";
    }
  }

  function fechar() {
    const modal = document.getElementById("modalHistoricoCripto");
    if (modal) modal.classList.remove("active");
    if (graficoAtual) {
      graficoAtual.destroy();
      graficoAtual = null;
    }
    esconderLoading();
    const erro = document.getElementById("histCriptoErro");
    if (erro) erro.classList.remove("active");
  }

  /* ---------- LISTENERS ---------- */

  function registrarListeners() {
    document.querySelectorAll(".hist-periodo-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (carregando) return;
        const dias = Number(btn.dataset.dias);
        if (moedaAtual) abrir(moedaAtual, dias);
      });
    });

    const btnFechar = document.getElementById("fecharHistoricoCripto");
    if (btnFechar) btnFechar.addEventListener("click", fechar);

    const btnTentarNovamente = document.getElementById("histCriptoTentarNovamente");
    if (btnTentarNovamente) {
      btnTentarNovamente.addEventListener("click", () => {
        if (moedaAtual) abrir(moedaAtual, periodoAtual);
      });
    }

    const modal = document.getElementById("modalHistoricoCripto");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) fechar();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fechar();
    });

    window.addEventListener("financa-tema-mudou", () => {
      if (moedaAtual && graficoAtual && !carregando) {
        const pontos = graficoAtual.data.datasets[0].data.map((v, i) => ({
          ts: new Date(graficoAtual.data.labels[i]).getTime(),
          preco: v,
        }));
        renderGrafico(moedaAtual, pontos);
      }
    });
  }

  function iniciar() {
    registrarListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.abrirHistoricoCripto = abrir;
  window.fecharHistoricoCripto = fechar;
})();