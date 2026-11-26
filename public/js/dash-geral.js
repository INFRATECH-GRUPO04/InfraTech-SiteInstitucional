/*
 * Dashboard Geral (gestor) — "Monitoramento da Frota".
 * O front consome três rotas:
 *   GET /dash-geral              agregados de saúde, série e ranking
 *   GET /dash-geral/incidentes   incidentes/MTTR (Jira)
 *
 * Campos do dashboard principal:
 *   gerado_em, saude_frota, disponibilidade_frota, ranking_problematicos
 *   saude_frota             { total, normais, atencao, critico, offline, pct_saudavel }
 *   disponibilidade_frota   { "7d" | "30d": { rotulos, valores } }
 *   ranking_problematicos[] { id_servidor, nome, situacao, incidentes }
 *
 * Campos complementares:
 *   incidentes.abertos[]    { id, id_servidor, servidor, prioridade, minutos, responsavel, url_jira }
 *   incidentes.por_dia      { "7d" | "30d": { rotulos, valores } }
 *   incidentes.mttr         { minutos, periodo, anterior_minutos }
 *
 * Nenhuma regra de limite é calculada no navegador: aqui só há apresentação.
 */
(function () {
  'use strict';

  const URL_DADOS = '/dash-geral';
  const URL_INCIDENTES = '/dash-geral/incidentes';

  const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000;

  let dados = null;
  let carregando = false;

  const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ROTULO_PRIORIDADE = { normal: 'Normal', atencao: 'Atenção', critico: 'Crítico', offline: 'Offline' };
  const ICONE_SETA = '<svg class="fr-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  const CIANO = '#00d8ff';
  const VERDE = '#22c55e';
  const AMARELO = '#fbbf24';
  const VERMELHO = '#ef4444';
  const CINZA = '#8b98a5';
  const COR_TEXTO = '#9db4c6';
  const COR_GRADE = 'rgb(145 165 183 / 0.14)';

  const graficos = { disp: null, inc: null, saude: null };
  const periodo = { disp: '7d', inc: '7d' };

  /* ---------- Utilitários ---------- */
  function el(tag, classe, texto) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto != null) no.textContent = texto;
    return no;
  }

  function definirTexto(id, texto) {
    const no = document.getElementById(id);
    if (no) no.textContent = texto;
  }

  function numeroOuNull(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }

  function media(lista) {
    return lista.length ? lista.reduce((t, v) => t + v, 0) / lista.length : null;
  }

  function temCampo(objeto, campo) {
    return objeto != null && Object.prototype.hasOwnProperty.call(objeto, campo);
  }

  /* "37 min", "1h12", "2h03", "3d 4h" */
  function formatarDuracao(min) {
    const numero = numeroOuNull(min);
    if (numero == null) return '—';
    const total = Math.round(numero);
    if (total < 60) return total + ' min';
    if (total < 1440) return Math.floor(total / 60) + 'h' + String(total % 60).padStart(2, '0');
    return Math.floor(total / 1440) + 'd ' + Math.floor((total % 1440) / 60) + 'h';
  }

  function iniciais(nome) {
    return String(nome).trim().split(/\s+/).slice(0, 2).map((parte) => parte.charAt(0)).join('').toUpperCase();
  }

  const fmtGerado = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  function formatarGeradoEm(valor) {
    if (!valor) return '—';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '—';
    const partes = Object.fromEntries(fmtGerado.formatToParts(data).map((p) => [p.type, p.value]));
    const hora = partes.hour === '24' ? '00' : partes.hour;
    return `${partes.day}/${partes.month}/${partes.year} ${hora}:${partes.minute}`;
  }

  function renderizarGeradoEm() {
    const no = document.getElementById('dados-gerados');
    if (!no) return;
    no.textContent = 'Dados gerados em ' + formatarGeradoEm(dados && dados.gerado_em);
    const data = dados && dados.gerado_em ? new Date(dados.gerado_em) : null;
    if (data && !Number.isNaN(data.getTime())) no.dateTime = data.toISOString();
    else no.removeAttribute('datetime');
  }

  /* ---------- Carregamento ---------- */
  function mostrarCarregando() {
    ['saude-pct', 'disp-valor', 'kpi-incidentes', 'kpi-mttr'].forEach((id) => definirTexto(id, '…'));
  }

  function linhaVazia(colunas, texto) {
    const linha = el('tr');
    const celula = el('td', 'fr-vazio', texto);
    celula.colSpan = colunas;
    linha.append(celula);
    return linha;
  }

  function mostrarErro() {
    ['saude-pct', 'disp-valor', 'kpi-incidentes', 'kpi-mttr', 'donut-numero'].forEach((id) => definirTexto(id, '—'));
    definirTexto('mttr-delta', '—');

    const corpo = document.getElementById('corpo-incidentes');
    if (corpo) corpo.replaceChildren(linhaVazia(6, 'Não foi possível carregar os incidentes.'));
    const lista = document.getElementById('lista-problematicos');
    if (lista) lista.replaceChildren(el('li', 'fr-vazio', 'Sem dados.'));
  }

  async function buscarJSON(url) {
    const resposta = await fetch(url, { cache: 'no-store' });
    if (!resposta.ok) {
      let detalhe = '';
      try { detalhe = (await resposta.json()).erro || ''; } catch (_) { /* resposta sem JSON */ }
      throw new Error(detalhe || 'Falha ao carregar ' + url + ' (' + resposta.status + ').');
    }
    return resposta.json();
  }

  // Complemento independente: se falhar, o dashboard principal segue.
  async function carregarComplementos() {
    try {
      dados.incidentes = await buscarJSON(URL_INCIDENTES);
    } catch (erro) {
      console.warn('[dash-geral] não foi possível carregar os incidentes:', erro);
    }
  }

  async function carregarDados(silent = false) {
    if (carregando) return;
    carregando = true;
    if (!silent) mostrarCarregando();
    try {
      dados = await buscarJSON(URL_DADOS);
      await carregarComplementos();
      renderizarTudo();
    } catch (erro) {
      console.error('[dash-geral] falha ao carregar dados:', erro);
      if (!silent) mostrarErro();
    } finally {
      carregando = false;
    }
  }

  /* ---------- Topo e saúde da frota ---------- */
  function renderizarSaude() {
    const saude = dados.saude_frota || {};
    const total = numeroOuNull(saude.total) || 0;
    const normais = numeroOuNull(saude.normais) || 0;
    const atencao = numeroOuNull(saude.atencao) || 0;
    const critico = numeroOuNull(saude.critico) || 0;
    const offline = numeroOuNull(saude.offline) || 0;

    definirTexto('topo-normais', total ? normais + ' normais' : '— normais');
    definirTexto('topo-atencao', total ? atencao + ' atenção' : '— atenção');
    definirTexto('topo-critico', total ? critico + ' crítico' : '— crítico');
    definirTexto('topo-offline', total ? offline + ' offline' : '— offline');

    const pct = numeroOuNull(saude.pct_saudavel);
    const tom = pct == null || pct >= 70 ? '' : pct >= 40 ? 'fr-saude--atencao' : 'fr-saude--critico';
    const card = document.getElementById('card-saude');
    if (card) card.className = 'fr-card fr-saude' + (tom ? ' ' + tom : '');

    definirTexto('saude-pct', pct == null ? '—' : pct + '%');
    definirTexto('saude-rotulo', pct == null ? 'Sem dados' : pct >= 70 ? 'Saudável' : pct >= 40 ? 'Atenção' : 'Crítico');
    const barra = document.getElementById('saude-barra');
    if (barra) barra.style.width = (pct == null ? 0 : pct) + '%';

    definirTexto('donut-numero', total ? normais + '/' + total : '—');
    definirTexto('leg-normais', total ? normais + ' Normais' : '— Normais');
    definirTexto('leg-atencao', atencao + ' Atenção');
    definirTexto('leg-critico', critico + ' Crítico');
    definirTexto('leg-offline', offline + ' Offline');

    if (graficos.saude) {
      graficos.saude.data.datasets[0].data = total ? [normais, atencao, critico, offline] : [1, 0, 0, 0];
      graficos.saude.data.datasets[0].backgroundColor = total ? [VERDE, AMARELO, VERMELHO, CINZA] : ['rgb(255 255 255 / 0.1)'];
      graficos.saude.update();
    }
  }

  function criarGraficoSaude() {
    const canvas = document.getElementById('grafico-saude');
    if (!canvas || !window.Chart) return;
    graficos.saude = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Normais', 'Atenção', 'Crítico', 'Offline'],
        datasets: [{ data: [0, 0, 0, 0], backgroundColor: [VERDE, AMARELO, VERMELHO, CINZA], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } }
      }
    });
  }

  /* ---------- Disponibilidade ---------- */
  function criarGraficoDisp() {
    const canvas = document.getElementById('grafico-disp');
    if (!canvas || !window.Chart) return;
    graficos.disp = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Disponibilidade',
            data: [],
            borderColor: CIANO,
            backgroundColor: CIANO,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#07121c',
            pointBorderColor: CIANO,
            pointBorderWidth: 1.5,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        font: { family: 'Inter, sans-serif', size: 11 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.parsed.y == null ? ' Sem dados'
                : ' Disponibilidade: ' + fmt1.format(ctx.parsed.y) + '%'
            }
          }
        },
        scales: {
          y: {
            max: 100,
            ticks: { color: COR_TEXTO, maxTicksLimit: 4, callback: (v) => v + '%' },
            grid: { color: COR_GRADE },
            border: { display: false }
          },
          x: {
            ticks: { color: COR_TEXTO, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
            grid: { display: false },
            border: { color: COR_GRADE }
          }
        }
      }
    });
  }

  function ajustarEixoDisp(validos) {
    const menor = validos.length ? Math.min(...validos) : null;
    const min = menor == null ? 90 : Math.max(0, Math.floor((menor - 0.001) / 5) * 5);
    graficos.disp.options.scales.y.min = min;
    graficos.disp.options.scales.y.max = 100;
  }

  function atualizarDisponibilidade() {
    const frota = dados.disponibilidade_frota || {};
    const serie = frota[periodo.disp] || { rotulos: [], valores: [] };
    const valores = Array.isArray(serie.valores) ? serie.valores : [];
    const validos = valores.map(numeroOuNull).filter((v) => v != null);
    const atual = media(validos);

    definirTexto('titulo-disp', 'Disponibilidade (' + periodo.disp + ')');
    definirTexto('disp-valor', atual == null ? 'sem dados' : fmt1.format(atual) + '%');

    if (!graficos.disp) return;
    const rotulos = Array.isArray(serie.rotulos) ? serie.rotulos : [];
    graficos.disp.data.labels = rotulos;
    graficos.disp.data.datasets[0].data = valores;
    ajustarEixoDisp(validos);
    graficos.disp.update();
  }

  /* ---------- Incidentes ativos e MTTR ---------- */
  function renderizarIndicadoresIncidentes() {
    const incidentes = dados.incidentes || {};
    const abertos = Array.isArray(incidentes.abertos) ? incidentes.abertos : [];
    definirTexto('kpi-incidentes', String(abertos.length));

    // O chip só aparece se o backend informou o responsável (null = sem atribuição).
    const chip = document.getElementById('kpi-chip');
    if (chip) {
      const informado = abertos.some((i) => temCampo(i, 'responsavel'));
      const semResponsavel = abertos.filter((i) => temCampo(i, 'responsavel') && !i.responsavel).length;
      chip.hidden = !informado;
      if (informado) {
        chip.className = 'fr-chip ' + (semResponsavel ? 'fr-chip--atencao' : 'fr-chip--ok');
        chip.textContent = semResponsavel ? semResponsavel + ' sem responsável' : 'Todos com responsável';
      }
    }

    const mttr = incidentes.mttr || {};
    const atual = numeroOuNull(mttr.minutos);
    const anterior = numeroOuNull(mttr.anterior_minutos);
    definirTexto('kpi-mttr', formatarDuracao(atual));

    const alvo = document.getElementById('mttr-delta');
    if (!alvo) return;
    if (atual == null || anterior == null) {
      alvo.replaceChildren(el('span', 'fr-delta fr-delta--neutro', 'sem comparação com os 30d anteriores'));
      return;
    }
    const diferenca = Math.round(atual - anterior);
    const sinal = diferenca < 0 ? '▼ -' : diferenca > 0 ? '▲ +' : '';
    // Para o tempo de resolução, cair é bom.
    const classe = diferenca < 0 ? 'fr-delta--bom' : diferenca > 0 ? 'fr-delta--ruim' : 'fr-delta--neutro';
    alvo.replaceChildren(
      el('span', 'fr-delta ' + classe, sinal + formatarDuracao(Math.abs(diferenca))),
      document.createTextNode(' vs. 30d anteriores')
    );
  }

  /* ---------- Incidentes por dia ---------- */
  // Escreve o número em cima de cada barra (até 14 barras, para não poluir o 30d).
  const pluginValoresNasBarras = {
    id: 'valoresNasBarras',
    afterDatasetsDraw(grafico) {
      const barras = grafico.getDatasetMeta(0).data;
      if (barras.length > 14) return;
      const ctx = grafico.ctx;
      ctx.save();
      ctx.fillStyle = '#eef5fb';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      barras.forEach((barra, i) => {
        const valor = grafico.data.datasets[0].data[i];
        if (valor != null) ctx.fillText(String(valor), barra.x, barra.y - 4);
      });
      ctx.restore();
    }
  };

  function criarGraficoIncidentes() {
    const canvas = document.getElementById('grafico-inc');
    if (!canvas || !window.Chart) return;
    graficos.inc = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: CIANO, borderRadius: 3, barPercentage: 0.6, categoryPercentage: 0.85 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        font: { family: 'Inter, sans-serif', size: 11 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ' ' + ctx.parsed.y + (ctx.parsed.y === 1 ? ' incidente' : ' incidentes') }
          }
        },
        scales: {
          y: { display: false, beginAtZero: true, grace: '30%' },
          x: {
            ticks: { color: COR_TEXTO, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
            grid: { display: false },
            border: { color: COR_GRADE }
          }
        }
      },
      plugins: [pluginValoresNasBarras]
    });
  }

  function atualizarIncidentes() {
    const porDia = (dados.incidentes || {}).por_dia || {};
    const serie = porDia[periodo.inc] || { rotulos: [], valores: [] };
    const valores = Array.isArray(serie.valores) ? serie.valores : [];
    const semDados = !valores.length;

    const vazio = document.getElementById('inc-vazio');
    if (vazio) vazio.hidden = !semDados;
    const area = document.getElementById('grafico-inc');
    if (area && area.parentElement) area.parentElement.hidden = semDados;

    if (graficos.inc && !semDados) {
      graficos.inc.data.labels = Array.isArray(serie.rotulos) ? serie.rotulos : [];
      graficos.inc.data.datasets[0].data = valores;
      graficos.inc.resize();
      graficos.inc.update();
    }
  }

  function configurarFiltro(idGrupo, chave, aoMudar) {
    const grupo = document.getElementById(idGrupo);
    if (!grupo) return;
    grupo.querySelectorAll('button').forEach((botao) => {
      botao.addEventListener('click', () => {
        periodo[chave] = botao.dataset.periodo;
        grupo.querySelectorAll('button').forEach((outro) => {
          const ativo = outro === botao;
          outro.classList.toggle('ativo', ativo);
          outro.setAttribute('aria-pressed', String(ativo));
        });
        if (dados) aoMudar();
      });
    });
  }

  /* ---------- Tabela de incidentes (Jira) ---------- */
  function linkServidor(id, nome) {
    const link = el('a', 'fr-link-servidor', nome || String(id));
    link.href = './especifica-servidor/dash-especifica.html?servidor=' + encodeURIComponent(id);
    return link;
  }

  function linkIncidente(incidente) {
    // A seta da tabela abre a issue no Jira em nova guia, sem sair do dashboard.
    if (!incidente.url_jira) {
      const indisponivel = el('span', 'fr-seta');
      indisponivel.setAttribute('aria-disabled', 'true');
      return indisponivel;
    }
    const link = el('a', 'fr-seta');
    link.href = incidente.url_jira;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function celulaResponsavel(incidente) {
    const celula = el('td');
    if (!temCampo(incidente, 'responsavel')) {
      celula.append(el('span', 'fr-resp fr-resp--indefinido', '—'));
    } else if (!incidente.responsavel) {
      celula.append(el('span', 'fr-resp fr-resp--vazio', 'Sem atribuição'));
    } else {
      const bloco = el('span', 'fr-resp');
      const primeiroNome = String(incidente.responsavel).trim().split(/\s+/)[0];
      const nome = el('span', 'fr-resp__nome', primeiroNome);
      nome.title = incidente.responsavel;
      bloco.append(el('span', 'fr-avatar', iniciais(incidente.responsavel)), nome);
      celula.append(bloco);
    }
    return celula;
  }

  function renderizarIncidentesAbertos() {
    const corpo = document.getElementById('corpo-incidentes');
    if (!corpo) return;
    const abertos = (dados.incidentes || {}).abertos || [];

    if (!abertos.length) {
      corpo.replaceChildren(linhaVazia(6, 'Nenhum incidente aberto no momento.'));
      return;
    }

    corpo.replaceChildren(...abertos.map((incidente) => {
      const prioridade = ROTULO_PRIORIDADE[incidente.prioridade] ? incidente.prioridade : 'normal';
      const tdPrioridade = el('td');
      tdPrioridade.append(el('span', 'fr-pilula fr-pilula--' + prioridade, ROTULO_PRIORIDADE[prioridade]));

      const tdAcao = el('td');
      const botao = linkIncidente(incidente);
      botao.className = 'fr-seta';
      botao.setAttribute('aria-label', 'Abrir ' + incidente.id + ' no Jira em nova guia');
      botao.innerHTML = ICONE_SETA;
      tdAcao.append(botao);

      const linha = el('tr');
      linha.append(
        el('td', '', incidente.id),
        el('td', '', incidente.servidor || '—'),
        tdPrioridade,
        el('td', '', formatarDuracao(incidente.minutos)),
        celulaResponsavel(incidente),
        tdAcao
      );
      return linha;
    }));
  }

  /* ---------- Servidores mais problemáticos ---------- */
  function renderizarProblematicos() {
    const lista = document.getElementById('lista-problematicos');
    if (!lista) return;
    definirTexto('titulo-problematicos', 'Servidores Mais Problemáticos (30d)');

    const ranking = Array.isArray(dados.ranking_problematicos) ? dados.ranking_problematicos : [];
    const top = ranking
      .filter((servidor) => numeroOuNull(servidor.incidentes) > 0)
      .sort((a, b) => numeroOuNull(b.incidentes) - numeroOuNull(a.incidentes))
      .slice(0, 3);

    if (!top.length) {
      lista.replaceChildren(el('li', 'fr-vazio', 'Nenhum incidente registrado no período.'));
      return;
    }

    const maior = numeroOuNull(top[0].incidentes) || 1;
    lista.replaceChildren(...top.map((servidor, indice) => {
      const situacao = ROTULO_PRIORIDADE[servidor.situacao] ? servidor.situacao : 'normal';
      const incidentes = numeroOuNull(servidor.incidentes) || 0;
      const trilho = el('span', 'fr-ranking__trilho fr-ranking__trilho--' + situacao);
      const preenchimento = el('span');
      preenchimento.style.width = Math.round((incidentes / maior) * 100) + '%';
      trilho.append(preenchimento);
      const item = el('li', 'fr-ranking__item');
      item.append(
        el('span', 'fr-ranking__pos', (indice + 1) + '.'),
        linkServidor(servidor.id_servidor, servidor.nome),
        trilho,
        el('span', 'fr-ranking__qtd', incidentes + (incidentes === 1 ? ' incidente' : ' incidentes'))
      );
      return item;
    }));
  }

  /* ---------- Inicialização ---------- */
  function renderizarTudo() {
    if (!dados) return;
    renderizarGeradoEm();
    renderizarSaude();
    renderizarIndicadoresIncidentes();
    renderizarIncidentesAbertos();
    renderizarProblematicos();
    atualizarDisponibilidade();
    atualizarIncidentes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    criarGraficoSaude();
    criarGraficoDisp();
    criarGraficoIncidentes();
    configurarFiltro('filtro-disp', 'disp', atualizarDisponibilidade);
    configurarFiltro('filtro-inc', 'inc', atualizarIncidentes);
    carregarDados();
    setInterval(() => {
      if (!document.hidden) carregarDados(true);
    }, INTERVALO_ATUALIZACAO_MS);
  });
})();
