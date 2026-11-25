/*
 * Dashboard Geral (gestor) — "Monitoramento da Frota".
 * Todos os dados vêm de GET /dash-geral (JSON do gold já enriquecido pelo backend
 * com banco e Jira). Aqui só há apresentação: nenhuma regra de limite é
 * calculada no navegador.
 *
 * Campos que a tela usa:
 *   ambiente
 *   servidores[]            { id_servidor, nome, situacao, inc7d, inc30d }
 *   disponibilidade_frota   { "7d" | "30d": { rotulos, valores, anterior } }
 *   incidentes.abertos[]    { id, servidor, prioridade, minutos, responsavel }
 *   incidentes.por_dia      { "7d" | "30d": { rotulos, valores, anterior } }
 *   incidentes.mttr         { minutos, periodo, anterior_minutos }
 *   relatorio_ia            { gerado_em, resumo, recomendacoes }
 *   meta_sla (opcional)     meta de disponibilidade em %, padrão 99,0
 * `responsavel`, `anterior_minutos`, `inc30d` e `meta_sla` são novos: se o backend
 * ainda não enviar, a tela mostra "—" ou usa o padrão, sem quebrar.
 */
(function () {
  'use strict';

  const URL_DADOS = '/dash-geral';
  const META_SLA_PADRAO = 99.0;

  let dados = null;

  const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ROTULO_PRIORIDADE = { normal: 'Normal', atencao: 'Atenção', critico: 'Crítico', offline: 'Offline' };
  const ICONE_SETA = '<svg class="fr-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  const CIANO = '#00d8ff';
  const VERDE = '#22c55e';
  const AMARELO = '#fbbf24';
  const VERMELHO = '#ef4444';
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

  function horaAgora(data) {
    return String(data.getHours()).padStart(2, '0') + ':' + String(data.getMinutes()).padStart(2, '0');
  }

  function iniciais(nome) {
    return String(nome).trim().split(/\s+/).slice(0, 2).map((parte) => parte.charAt(0)).join('').toUpperCase();
  }

  function atualizarRelogio() {
    const agora = new Date();
    const dois = (n) => String(n).padStart(2, '0');
    definirTexto('relogio', dois(agora.getDate()) + '/' + dois(agora.getMonth() + 1) + '/' + agora.getFullYear() + ' ' + horaAgora(agora));
  }

  /* ---------- Carregamento ---------- */
  function mostrarCarregando() {
    ['saude-pct', 'disp-valor', 'kpi-incidentes', 'kpi-mttr'].forEach((id) => definirTexto(id, '…'));
    definirTexto('ia-resumo', 'Carregando…');
  }

  function linhaVazia(colunas, texto) {
    const linha = el('tr');
    const celula = el('td', 'fr-vazio', texto);
    celula.colSpan = colunas;
    linha.append(celula);
    return linha;
  }

  function mostrarErro(mensagem) {
    ['saude-pct', 'disp-valor', 'kpi-incidentes', 'kpi-mttr', 'donut-numero'].forEach((id) => definirTexto(id, '—'));
    definirTexto('mttr-delta', '—');
    definirTexto('ia-gerado', 'Gerado por IA • —');
    definirTexto('ia-resumo', mensagem);

    const corpo = document.getElementById('corpo-incidentes');
    if (corpo) corpo.replaceChildren(linhaVazia(6, 'Não foi possível carregar os incidentes.'));
    const lista = document.getElementById('lista-problematicos');
    if (lista) lista.replaceChildren(el('li', 'fr-vazio', 'Sem dados.'));
    const recomendacoes = document.getElementById('ia-recomendacoes');
    if (recomendacoes) recomendacoes.replaceChildren();
  }

  async function carregarDados() {
    mostrarCarregando();
    try {
      const resposta = await fetch(URL_DADOS, { cache: 'no-store' });
      if (!resposta.ok) {
        let detalhe = '';
        try { detalhe = (await resposta.json()).erro || ''; } catch (_) { /* resposta sem JSON */ }
        throw new Error(detalhe || 'Falha ao carregar a dashboard (' + resposta.status + ').');
      }
      dados = await resposta.json();
      renderizarTudo();
    } catch (erro) {
      console.error('[dash-geral] falha ao carregar dados:', erro);
      mostrarErro(erro.message || 'Não foi possível carregar os dados.');
    }
  }

  /* ---------- Topo e saúde da frota ---------- */
  function renderizarSaude() {
    const servidores = dados.servidores || [];
    const total = servidores.length;
    const normais = servidores.filter((s) => s.situacao === 'normal').length;
    const alerta = servidores.filter((s) => s.situacao === 'atencao' || s.situacao === 'critico').length;
    const offline = servidores.filter((s) => s.situacao === 'offline').length;

    definirTexto('ambiente-nome', dados.ambiente || '—');
    definirTexto('topo-online', total ? normais + ' online' : '— online');
    definirTexto('topo-atencao', total ? alerta + ' atenção' : '— atenção');
    definirTexto('topo-offline', total ? offline + ' offline' : '— offline');

    const pct = total ? Math.round((normais / total) * 100) : null;
    const tom = pct == null || pct >= 70 ? '' : pct >= 40 ? 'fr-saude--atencao' : 'fr-saude--critico';
    const card = document.getElementById('card-saude');
    if (card) card.className = 'fr-card fr-saude' + (tom ? ' ' + tom : '');

    definirTexto('saude-pct', pct == null ? '—' : pct + '%');
    definirTexto('saude-rotulo', pct == null ? 'Sem dados' : pct >= 70 ? 'Saudável' : pct >= 40 ? 'Atenção' : 'Crítico');
    const barra = document.getElementById('saude-barra');
    if (barra) barra.style.width = (pct == null ? 0 : pct) + '%';

    definirTexto('donut-numero', total ? normais + '/' + total : '—');
    definirTexto('leg-online', total ? normais + '/' + total + ' Online' : '— Online');
    definirTexto('leg-alerta', alerta + ' Alerta');
    definirTexto('leg-offline', offline + ' Offline');

    if (graficos.saude) {
      graficos.saude.data.datasets[0].data = total ? [normais, alerta, offline] : [1, 0, 0];
      graficos.saude.data.datasets[0].backgroundColor = total ? [VERDE, AMARELO, VERMELHO] : ['rgb(255 255 255 / 0.1)'];
      graficos.saude.update();
    }
  }

  function criarGraficoSaude() {
    const canvas = document.getElementById('grafico-saude');
    if (!canvas || !window.Chart) return;
    graficos.saude = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Online', 'Alerta', 'Offline'],
        datasets: [{ data: [0, 0, 0], backgroundColor: [VERDE, AMARELO, VERMELHO], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } }
      }
    });
  }

  /* ---------- SLA / disponibilidade ---------- */
  function metaSla() {
    const meta = numeroOuNull(dados && dados.meta_sla);
    return meta == null ? META_SLA_PADRAO : meta;
  }

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
          },
          {
            label: 'Meta de SLA',
            data: [],
            borderColor: VERMELHO,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
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
                : (ctx.datasetIndex === 1 ? ' Meta de SLA: ' : ' Disponibilidade: ') + fmt1.format(ctx.parsed.y) + '%'
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

  function atualizarDisponibilidade() {
    const frota = dados.disponibilidade_frota || {};
    const serie = frota[periodo.disp] || { rotulos: [], valores: [] };
    const valores = Array.isArray(serie.valores) ? serie.valores : [];
    const validos = valores.map(numeroOuNull).filter((v) => v != null);
    const atual = media(validos);
    const meta = metaSla();

    definirTexto('titulo-disp', 'SLA / Disponibilidade (' + periodo.disp + ')');
    definirTexto('disp-valor', atual == null ? 'sem dados' : fmt1.format(atual) + '%');
    definirTexto('disp-meta', 'Meta ' + fmt1.format(meta) + '%');

    if (!graficos.disp) return;
    const rotulos = Array.isArray(serie.rotulos) ? serie.rotulos : [];
    graficos.disp.data.labels = rotulos;
    graficos.disp.data.datasets[0].data = valores;
    graficos.disp.data.datasets[1].data = rotulos.map(() => meta);
    // O eixo acompanha os dados (inclui a meta); quedas reais a 0% também cabem.
    const menor = Math.min(meta, ...(validos.length ? validos : [meta]));
    graficos.disp.options.scales.y.min = Math.max(0, Math.floor(menor / 5) * 5);
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
      alvo.replaceChildren(el('span', 'fr-delta fr-delta--neutro', 'sem comparação com o mês anterior'));
      return;
    }
    const diferenca = Math.round(atual - anterior);
    const sinal = diferenca < 0 ? '▼ -' : diferenca > 0 ? '▲ +' : '';
    // Para o tempo de resolução, cair é bom.
    const classe = diferenca < 0 ? 'fr-delta--bom' : diferenca > 0 ? 'fr-delta--ruim' : 'fr-delta--neutro';
    alvo.replaceChildren(
      el('span', 'fr-delta ' + classe, sinal + formatarDuracao(Math.abs(diferenca))),
      document.createTextNode(' vs. mês anterior')
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
    const encontrado = (dados.servidores || []).find((servidor) =>
      servidor.nome === incidente.servidor || String(servidor.id_servidor) === String(incidente.servidor));
    return linkServidor(encontrado ? encontrado.id_servidor : incidente.servidor, incidente.servidor || '—');
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
      botao.setAttribute('aria-label', 'Abrir ' + incidente.id + ' no ' + (incidente.servidor || 'servidor'));
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
    const servidores = dados.servidores || [];
    // Prefere a contagem de 30 dias; se o backend só enviar a de 7 dias, o título acompanha.
    const campo = servidores.some((s) => numeroOuNull(s.inc30d) != null) ? 'inc30d' : 'inc7d';
    definirTexto('titulo-problematicos', 'Servidores Mais Problemáticos (' + (campo === 'inc30d' ? '30d' : '7d') + ')');

    const top = servidores
      .filter((s) => numeroOuNull(s[campo]) > 0)
      .sort((a, b) => b[campo] - a[campo])
      .slice(0, 3);

    if (!top.length) {
      lista.replaceChildren(el('li', 'fr-vazio', 'Nenhum incidente registrado no período.'));
      return;
    }

    const maior = top[0][campo];
    lista.replaceChildren(...top.map((servidor, indice) => {
      const trilho = el('span', 'fr-ranking__trilho fr-ranking__trilho--' + servidor.situacao);
      const preenchimento = el('span');
      preenchimento.style.width = Math.round((servidor[campo] / maior) * 100) + '%';
      trilho.append(preenchimento);
      const item = el('li', 'fr-ranking__item');
      item.append(
        el('span', 'fr-ranking__pos', (indice + 1) + '.'),
        linkServidor(servidor.id_servidor, servidor.nome),
        trilho,
        el('span', 'fr-ranking__qtd', servidor[campo] + (servidor[campo] === 1 ? ' incidente' : ' incidentes'))
      );
      return item;
    }));
  }

  /* ---------- Relatório executivo (IA) ---------- */
  function renderizarRelatorioIA() {
    const ia = dados.relatorio_ia || {};
    const gerado = ia.gerado_em ? new Date(ia.gerado_em) : null;
    const valido = gerado && !Number.isNaN(gerado.getTime());
    const hoje = valido && gerado.toDateString() === new Date().toDateString();
    const dois = (n) => String(n).padStart(2, '0');
    definirTexto('ia-gerado', valido
      ? 'Gerado por IA • ' + (hoje ? 'hoje' : dois(gerado.getDate()) + '/' + dois(gerado.getMonth() + 1)) + ' ' + horaAgora(gerado)
      : 'Gerado por IA • —');
    definirTexto('ia-resumo', ia.resumo || 'Sem dados para análise.');

    const recomendacoes = document.getElementById('ia-recomendacoes');
    if (recomendacoes) {
      const itens = (ia.recomendacoes || []).map((texto) => el('li', '', texto));
      recomendacoes.replaceChildren(...(itens.length ? itens : [el('li', 'fr-vazio', 'Sem recomendações.')]));
    }
  }

  function configurarAtualizacaoIA() {
    const botao = document.getElementById('ia-atualizar');
    if (!botao) return;
    botao.addEventListener('click', async () => {
      if (botao.disabled) return;
      const rotulo = botao.querySelector('span');
      botao.disabled = true;
      botao.classList.add('carregando');
      if (rotulo) rotulo.textContent = 'Analisando…';
      try {
        await carregarDados();
      } finally {
        botao.disabled = false;
        botao.classList.remove('carregando');
        if (rotulo) rotulo.textContent = 'Atualizar análise';
      }
    });
  }

  /* ---------- Inicialização ---------- */
  function renderizarTudo() {
    if (!dados) return;
    renderizarSaude();
    renderizarIndicadoresIncidentes();
    renderizarIncidentesAbertos();
    renderizarProblematicos();
    renderizarRelatorioIA();
    atualizarDisponibilidade();
    atualizarIncidentes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    atualizarRelogio();
    setInterval(atualizarRelogio, 30000);

    criarGraficoSaude();
    criarGraficoDisp();
    criarGraficoIncidentes();
    configurarFiltro('filtro-disp', 'disp', atualizarDisponibilidade);
    configurarFiltro('filtro-inc', 'inc', atualizarIncidentes);
    configurarAtualizacaoIA();
    carregarDados();
  });
})();
