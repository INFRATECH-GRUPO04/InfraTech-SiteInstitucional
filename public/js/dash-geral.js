/*
 * Dashboard Geral (gestor) – "Monitoramento da Frota".
 * Front mockado: todos os dados saem do objeto MOCK abaixo. Quando os endpoints
 * existirem, basta trocar MOCK por um fetch com o mesmo formato e chamar
 * renderizarTudo() de novo. Os limites de alerta (atenção/crítico) continuam
 * vindo de window.InfraTechAlertas (dashboard-data.js).
 */
(function () {
  'use strict';

  /* ---------- Dados mockados ---------- */
  const MOCK = {
    ambiente: 'Produção',
    servidores: [
      { id: 'SRV-BR-01', cidade: 'São Paulo',      situacao: 'normal',  cpu: 34,   ram: 42,   disco: 47,   disp: 99.8, tempoMin: null, inc7d: 0 },
      { id: 'SRV-BR-02', cidade: 'Rio de Janeiro', situacao: 'normal',  cpu: 28,   ram: 35,   disco: 40,   disp: 99.9, tempoMin: null, inc7d: 0 },
      { id: 'SRV-BR-03', cidade: 'São Paulo',      situacao: 'atencao', cpu: 72,   ram: 68,   disco: 61,   disp: 97.4, tempoMin: 72,   inc7d: 3 },
      { id: 'SRV-BR-04', cidade: 'São Paulo',      situacao: 'critico', cpu: 95,   ram: 87,   disco: 82,   disp: 93.2, tempoMin: 37,   inc7d: 5 },
      { id: 'SRV-BR-05', cidade: 'Rio de Janeiro', situacao: 'offline', cpu: null, ram: null, disco: null, disp: null, tempoMin: 123,  inc7d: 4 },
      { id: 'SRV-BR-06', cidade: 'Recife',         situacao: 'normal',  cpu: 21,   ram: 38,   disco: 45,   disp: 99.1, tempoMin: null, inc7d: 0 },
      { id: 'SRV-BR-07', cidade: 'Salvador',       situacao: 'normal',  cpu: 31,   ram: 44,   disco: 52,   disp: 99.4, tempoMin: null, inc7d: 0 }
    ],
    incidentesAbertos: [
      { id: 'INFRA-142', servidor: 'SRV-BR-04', prioridade: 'critico', minutos: 37 },
      { id: 'INFRA-141', servidor: 'SRV-BR-03', prioridade: 'atencao', minutos: 72 },
      { id: 'INFRA-140', servidor: 'SRV-BR-05', prioridade: 'offline', minutos: 123 }
    ],
    mttr: { minutos: 42, periodo: '(últimos 30d)' },
    // "anterior" = média/total do período imediatamente anterior, usada no comparativo
    disponibilidade: {
      '24h': {
        rotulos: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'],
        valores: [99.2, 99.4, 99.1, 99.0, 98.8, 98.9, 99.3, 99.5, 99.2, 98.7, 98.9, 99.1],
        anterior: 98.9
      },
      '7d': {
        rotulos: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        valores: [97.9, 98.2, 99.2, 98.4, 98.9, 98.6, 98.3],
        anterior: 98.3
      },
      '30d': {
        rotulos: ultimosDias(30),
        valores: Array.from({ length: 30 }, (_, i) =>
          Math.min(100, +(98.6 + Math.sin(i / 3) * 0.6 + ((i * 7) % 5) * 0.05).toFixed(1))),
        anterior: 98.1
      }
    },
    incidentesPorDia: {
      '7d': {
        rotulos: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        valores: [3, 1, 1, 3, 2, 1, 1],
        anterior: 16
      },
      '30d': {
        rotulos: ultimosDias(30),
        valores: Array.from({ length: 30 }, (_, i) => [0, 1, 2, 1, 0, 3, 1][(i * 3) % 7]),
        anterior: 45
      }
    },
    ia: {
      geradoEm: new Date(),
      resumo: 'A infraestrutura apresentou estabilidade na maior parte do período, com 1 servidor em atenção, 1 em estado crítico e 1 offline.',
      pontos: [
        'SRV-BR-05 permanece offline.',
        'SRV-BR-04 com alta carga.'
      ],
      recomendacoes: [
        'Verificar o SRV-BR-05',
        'Monitorar o SRV-BR-04',
        'Avaliar expansão de recursos'
      ]
    }
  };

  /* ---------- Utilitários ---------- */
  const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ROTULO_SITUACAO = { normal: 'Normal', atencao: 'Atenção', critico: 'Crítico', offline: 'Offline' };
  const ORDEM_SITUACAO = { critico: 0, offline: 1, atencao: 2, normal: 3 };
  const ICONE_SETA = '<svg class="fr-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const ICONE_ALERTA = '<svg class="fr-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';

  const CIANO = '#00d8ff';
  const COR_TEXTO = '#9db4c6';
  const COR_GRADE = 'rgb(145 165 183 / 0.14)';

  const graficos = { disp: null, inc: null };
  const periodo = { disp: '7d', inc: '7d' };

  function ultimosDias(n) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    });
  }

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

  function soma(lista) { return lista.reduce((t, v) => t + v, 0); }
  function media(lista) { return soma(lista) / lista.length; }

  /* "37 min", "1h12", "2h03" */
  function formatarDuracao(min) {
    if (min == null) return '—';
    if (min < 60) return min + ' min';
    return Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0');
  }

  function horaAgora(data) {
    return String(data.getHours()).padStart(2, '0') + ':' + String(data.getMinutes()).padStart(2, '0');
  }

  /* Usa os limites configurados (InfraTechAlertas); sem eles, cai num padrão local. */
  function estadoMetrica(recurso, valor, idServidor) {
    if (valor == null) return 'sem-dados';
    const alertas = window.InfraTechAlertas;
    if (alertas && typeof alertas.classificar === 'function') {
      return alertas.classificar(recurso, valor, idServidor);
    }
    return valor >= 85 ? 'critico' : valor >= 70 ? 'atencao' : 'saudavel';
  }

  /* ---------- Topo, relógio e KPIs ---------- */
  function atualizarRelogio() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    definirTexto('relogio', dia + '/' + mes + '/' + agora.getFullYear() + ' ' + horaAgora(agora));
  }

  function renderizarResumo() {
    const servidores = MOCK.servidores;
    const total = servidores.length;
    const normais = servidores.filter((s) => s.situacao === 'normal').length;
    const alerta = servidores.filter((s) => s.situacao === 'atencao' || s.situacao === 'critico').length;
    const offline = servidores.filter((s) => s.situacao === 'offline').length;

    definirTexto('ambiente-nome', MOCK.ambiente);
    definirTexto('topo-online', normais + ' online');
    definirTexto('topo-atencao', alerta + ' atenção');
    definirTexto('topo-offline', offline + ' offline');

    definirTexto('kpi-normais', normais + '/' + total);
    definirTexto('kpi-alerta', alerta + '/' + total);
    definirTexto('kpi-offline', offline + '/' + total);
    definirTexto('kpi-incidentes', String(MOCK.incidentesAbertos.length));
    definirTexto('kpi-mttr', MOCK.mttr.minutos + ' min');
    definirTexto('kpi-mttr-periodo', MOCK.mttr.periodo);
  }

  /* ---------- Gráficos ---------- */
  function montarDelta(alvoId, texto, classe, complemento) {
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;
    alvo.replaceChildren(el('span', 'fr-delta ' + classe, texto), document.createTextNode(' ' + complemento));
  }

  function opcoesBase() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      font: { family: 'Inter, sans-serif', size: 11 }
    };
  }

  function criarGraficoDisp() {
    const canvas = document.getElementById('grafico-disp');
    if (!canvas || !window.Chart) return;
    const opcoes = opcoesBase();
    opcoes.interaction = { mode: 'index', intersect: false };
    opcoes.plugins.tooltip = {
      callbacks: { label: (ctx) => ' Disponibilidade: ' + fmt1.format(ctx.parsed.y) + '%' }
    };
    opcoes.scales = {
      y: {
        min: 90, max: 100,
        ticks: { stepSize: 5, color: COR_TEXTO, callback: (v) => v + '%' },
        grid: { color: COR_GRADE },
        border: { display: false }
      },
      x: {
        ticks: { color: COR_TEXTO, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { display: false },
        border: { color: COR_GRADE }
      }
    };
    graficos.disp = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderColor: CIANO,
          backgroundColor: CIANO,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#07121c',
          pointBorderColor: CIANO,
          pointBorderWidth: 1.5
        }]
      },
      options: opcoes
    });
  }

  function criarGraficoIncidentes() {
    const canvas = document.getElementById('grafico-inc');
    if (!canvas || !window.Chart) return;
    const opcoes = opcoesBase();
    opcoes.plugins.tooltip = {
      callbacks: {
        label: (ctx) => ' ' + ctx.parsed.y + (ctx.parsed.y === 1 ? ' incidente' : ' incidentes')
      }
    };
    opcoes.scales = {
      y: { display: false, beginAtZero: true, grace: '10%' },
      x: {
        ticks: { color: COR_TEXTO, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        grid: { display: false },
        border: { color: COR_GRADE }
      }
    };
    graficos.inc = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: CIANO, borderRadius: 3, barPercentage: 0.6, categoryPercentage: 0.85 }]
      },
      options: opcoes
    });
  }

  function atualizarDisponibilidade() {
    const dados = MOCK.disponibilidade[periodo.disp];
    const atual = media(dados.valores);
    const diferenca = +(atual - dados.anterior).toFixed(1);
    const sinal = diferenca > 0 ? '▲ +' : diferenca < 0 ? '▼ ' : '';

    definirTexto('disp-valor', fmt1.format(atual) + '%');
    montarDelta(
      'disp-delta',
      sinal + fmt1.format(diferenca) + '%',
      diferenca > 0 ? 'fr-delta--bom' : diferenca < 0 ? 'fr-delta--ruim' : 'fr-delta--neutro',
      'vs período anterior'
    );

    if (graficos.disp) {
      graficos.disp.data.labels = dados.rotulos;
      graficos.disp.data.datasets[0].data = dados.valores;
      graficos.disp.update();
    }
  }

  function atualizarIncidentes() {
    const dados = MOCK.incidentesPorDia[periodo.inc];
    const total = soma(dados.valores);
    const variacao = dados.anterior ? Math.round(((total - dados.anterior) / dados.anterior) * 100) : 0;
    // Para incidentes, cair é bom.
    const seta = variacao < 0 ? '▼ ' : variacao > 0 ? '▲ +' : '';

    definirTexto('inc-valor', String(total));
    montarDelta(
      'inc-delta',
      seta + variacao + '%',
      variacao < 0 ? 'fr-delta--bom' : variacao > 0 ? 'fr-delta--ruim' : 'fr-delta--neutro',
      'vs período anterior'
    );

    if (graficos.inc) {
      graficos.inc.data.labels = dados.rotulos;
      graficos.inc.data.datasets[0].data = dados.valores;
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
        aoMudar();
      });
    });
  }

  /* ---------- Tabela de status ---------- */
  function celulaMetrica(recurso, servidor) {
    const valor = servidor[recurso];
    const celula = el('td');
    const wrap = el('span', 'fr-metrica');
    if (valor == null) {
      wrap.classList.add('fr-metrica--sem-dados');
      wrap.append(el('span', 'fr-metrica__valor', '—'));
      celula.append(wrap);
      return celula;
    }
    const estado = estadoMetrica(recurso, valor, servidor.id);
    if (estado === 'atencao') wrap.classList.add('fr-metrica--atencao');
    if (estado === 'critico') wrap.classList.add('fr-metrica--critico');
    const barra = el('span', 'fr-barra');
    const preenchimento = el('span');
    preenchimento.style.width = Math.min(100, valor) + '%';
    barra.append(preenchimento);
    wrap.append(el('span', 'fr-metrica__valor', valor + '%'), barra);
    wrap.title = recurso.toUpperCase() + ' ' + valor + '% · ' + estado;
    celula.append(wrap);
    return celula;
  }

  function linkServidor(id) {
    const link = el('a', 'fr-link-servidor', id);
    link.href = './especifica-servidor/dash-especifica.html?servidor=' + encodeURIComponent(id);
    return link;
  }

  function renderizarTabelaStatus() {
    const corpo = document.getElementById('corpo-status');
    if (!corpo) return;
    const linhas = [...MOCK.servidores]
      .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || a.id.localeCompare(b.id))
      .map((servidor) => {
        const linha = el('tr');

        const tdServidor = el('td');
        const bloco = el('span', 'fr-servidor');
        bloco.append(el('span', 'fr-ponto fr-ponto--' + servidor.situacao), linkServidor(servidor.id));
        tdServidor.append(bloco);

        const tdLocal = el('td', '', servidor.cidade);

        const tdSituacao = el('td');
        tdSituacao.append(el('span', 'fr-pilula fr-pilula--' + servidor.situacao, ROTULO_SITUACAO[servidor.situacao]));

        const tdDisp = el('td');
        if (servidor.disp == null) {
          tdDisp.append(el('span', 'fr-disp fr-disp--vazio', '—'));
        } else {
          const classe = servidor.disp >= 99 ? 'ok' : servidor.disp >= 95 ? 'atencao' : 'critico';
          tdDisp.append(el('span', 'fr-disp fr-disp--' + classe, fmt1.format(servidor.disp) + '%'));
        }

        const tdTempo = el('td', '', formatarDuracao(servidor.tempoMin));

        linha.append(
          tdServidor, tdLocal, tdSituacao,
          celulaMetrica('cpu', servidor), celulaMetrica('ram', servidor), celulaMetrica('disco', servidor),
          tdDisp, tdTempo
        );
        return linha;
      });
    corpo.replaceChildren(...linhas);
  }

  /* ---------- Mais problemáticos ---------- */
  function renderizarProblematicos() {
    const lista = document.getElementById('lista-problematicos');
    if (!lista) return;
    const top = MOCK.servidores
      .filter((s) => s.inc7d > 0)
      .sort((a, b) => b.inc7d - a.inc7d)
      .slice(0, 3);

    if (!top.length) {
      lista.replaceChildren(el('li', 'fr-vazio', 'Nenhum incidente registrado no período.'));
      return;
    }

    const maior = top[0].inc7d;
    lista.replaceChildren(...top.map((servidor, indice) => {
      const item = el('li', 'fr-ranking__item');
      const trilho = el('span', 'fr-ranking__trilho fr-ranking__trilho--' + servidor.situacao);
      const preenchimento = el('span');
      preenchimento.style.width = Math.round((servidor.inc7d / maior) * 100) + '%';
      trilho.append(preenchimento);
      item.append(
        el('span', 'fr-ranking__pos', (indice + 1) + '.'),
        linkServidor(servidor.id),
        trilho,
        el('span', 'fr-ranking__qtd', servidor.inc7d + (servidor.inc7d === 1 ? ' incidente' : ' incidentes'))
      );
      return item;
    }));
  }

  /* ---------- Incidentes abertos ---------- */
  function renderizarIncidentesAbertos() {
    const corpo = document.getElementById('corpo-incidentes');
    if (!corpo) return;
    if (!MOCK.incidentesAbertos.length) {
      const linha = el('tr');
      const celula = el('td', 'fr-vazio', 'Nenhum incidente aberto no momento.');
      celula.colSpan = 5;
      linha.append(celula);
      corpo.replaceChildren(linha);
      return;
    }
    corpo.replaceChildren(...MOCK.incidentesAbertos.map((incidente) => {
      const linha = el('tr');
      const tdPrioridade = el('td');
      tdPrioridade.append(el('span', 'fr-pilula fr-pilula--' + incidente.prioridade, ROTULO_SITUACAO[incidente.prioridade]));

      const tdAcao = el('td');
      const botao = el('a', 'fr-seta');
      botao.href = './especifica-servidor/dash-especifica.html?servidor=' + encodeURIComponent(incidente.servidor);
      botao.setAttribute('aria-label', 'Abrir ' + incidente.id + ' no ' + incidente.servidor);
      botao.innerHTML = ICONE_SETA;
      tdAcao.append(botao);

      linha.append(
        el('td', '', incidente.id),
        el('td', '', incidente.servidor),
        tdPrioridade,
        el('td', '', formatarDuracao(incidente.minutos)),
        tdAcao
      );
      return linha;
    }));
  }

  /* ---------- Relatório com IA (mock) ---------- */
  function renderizarRelatorioIA() {
    const ia = MOCK.ia;
    definirTexto('ia-gerado', 'Gerado por IA • hoje ' + horaAgora(ia.geradoEm));
    definirTexto('ia-resumo', ia.resumo);

    const pontos = document.getElementById('ia-pontos');
    pontos.replaceChildren(...ia.pontos.map((texto) => {
      const item = el('li');
      item.innerHTML = ICONE_ALERTA;
      item.append(el('span', '', texto));
      return item;
    }));

    const recomendacoes = document.getElementById('ia-recomendacoes');
    recomendacoes.replaceChildren(...ia.recomendacoes.map((texto) => el('li', '', texto)));
  }

  function configurarAtualizacaoIA() {
    const botao = document.getElementById('ia-atualizar');
    if (!botao) return;
    botao.addEventListener('click', () => {
      if (botao.disabled) return;
      const rotulo = botao.querySelector('span');
      botao.disabled = true;
      botao.classList.add('carregando');
      if (rotulo) rotulo.textContent = 'Analisando…';
      // Simula a chamada ao serviço de IA; trocar por fetch quando existir o endpoint.
      setTimeout(() => {
        MOCK.ia.geradoEm = new Date();
        renderizarRelatorioIA();
        botao.disabled = false;
        botao.classList.remove('carregando');
        if (rotulo) rotulo.textContent = 'Atualizar análise';
      }, 1200);
    });
  }

  /* ---------- Inicialização ---------- */
  function renderizarTudo() {
    renderizarResumo();
    renderizarTabelaStatus();
    renderizarProblematicos();
    renderizarIncidentesAbertos();
    renderizarRelatorioIA();
    atualizarDisponibilidade();
    atualizarIncidentes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    atualizarRelogio();
    setInterval(atualizarRelogio, 30000);

    criarGraficoDisp();
    criarGraficoIncidentes();
    configurarFiltro('filtro-disp', 'disp', atualizarDisponibilidade);
    configurarFiltro('filtro-inc', 'inc', atualizarIncidentes);
    configurarAtualizacaoIA();

    renderizarTudo();

    // Reclassifica CPU/RAM/Disco quando os limites de alerta mudarem em outra tela.
    window.addEventListener('infratech:limites-alerta-alterados', renderizarTabelaStatus);
  });
})();
