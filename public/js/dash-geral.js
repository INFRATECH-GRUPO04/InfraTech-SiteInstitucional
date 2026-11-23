/*
 * Dashboard Geral (gestor) — "Monitoramento da Frota".
 * Todos os dados vêm de GET /dash-geral, que devolve o mesmo contrato do JSON
 * gold já preenchido pelo backend. Os limites de alerta das células continuam
 * vindo de window.InfraTechAlertas (dashboard-data.js).
 */
(function () {
  'use strict';

  let dados = null;

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

  function soma(lista) { return lista.reduce((total, valor) => total + valor, 0); }
  function media(lista) { return lista.length ? soma(lista) / lista.length : null; }

  /* "37 min", "1h12", "2h03" */
  function formatarDuracao(min) {
    const numero = numeroOuNull(min);
    if (numero == null) return '—';
    if (numero < 60) return Math.round(numero) + ' min';
    return Math.floor(numero / 60) + 'h' + String(Math.round(numero) % 60).padStart(2, '0');
  }

  function horaAgora(data) {
    return String(data.getHours()).padStart(2, '0') + ':' + String(data.getMinutes()).padStart(2, '0');
  }

  /* dashboard-data.js indexa os limites individuais pelo nome do servidor. */
  function estadoMetrica(recurso, valor, servidor) {
    if (valor == null) return 'sem-dados';
    const alertas = window.InfraTechAlertas;
    const chave = servidor.nome || servidor.id_servidor;
    if (alertas && typeof alertas.classificar === 'function') {
      return alertas.classificar(recurso, valor, chave);
    }
    return valor >= 85 ? 'critico' : valor >= 70 ? 'atencao' : 'saudavel';
  }

  /* ---------- Carregamento ---------- */
  function mostrarCarregando() {
    ['kpi-normais', 'kpi-alerta', 'kpi-offline', 'kpi-incidentes', 'kpi-mttr',
      'disp-valor', 'inc-valor', 'ia-resumo'].forEach((id) => definirTexto(id, 'Carregando…'));
    definirTexto('disp-delta', '—');
    definirTexto('inc-delta', '—');
  }

  function mostrarErro(mensagem) {
    ['kpi-normais', 'kpi-alerta', 'kpi-offline', 'kpi-incidentes', 'kpi-mttr',
      'disp-valor', 'inc-valor'].forEach((id) => definirTexto(id, '—'));
    definirTexto('disp-delta', '—');
    definirTexto('inc-delta', '—');
    definirTexto('ia-resumo', mensagem);
    definirTexto('ia-gerado', 'Gerado por IA • —');

    const vazio = (colunas, texto) => {
      const linha = el('tr');
      const celula = el('td', 'fr-vazio', texto);
      celula.colSpan = colunas;
      linha.append(celula);
      return linha;
    };
    const corpoStatus = document.getElementById('corpo-status');
    if (corpoStatus) corpoStatus.replaceChildren(vazio(8, 'Não foi possível carregar os servidores.'));
    const corpoIncidentes = document.getElementById('corpo-incidentes');
    if (corpoIncidentes) corpoIncidentes.replaceChildren(vazio(5, 'Não foi possível carregar os incidentes.'));
    const lista = document.getElementById('lista-problematicos');
    if (lista) lista.replaceChildren(el('li', 'fr-vazio', 'Sem dados.'));
  }

  async function carregarDados() {
    mostrarCarregando();
    try {
      const resposta = await fetch('/dash-geral', { cache: 'no-store' });
      if (!resposta.ok) {
        let detalhe = '';
        try { detalhe = (await resposta.json()).erro || ''; } catch (_) { /* resposta sem JSON */ }
        throw new Error(detalhe || `Falha ao carregar a dashboard (${resposta.status}).`);
      }
      dados = await resposta.json();
      renderizarTudo();
    } catch (erro) {
      console.error('[dash-geral] falha ao carregar dados:', erro);
      mostrarErro(erro.message || 'Não foi possível carregar os dados.');
    }
  }

  /* ---------- Topo, KPIs ---------- */
  function renderizarResumo() {
    const servidores = dados.servidores || [];
    const total = servidores.length;
    const semDados = total === 0;
    const normais = servidores.filter((s) => s.situacao === 'normal').length;
    const alerta = servidores.filter((s) => s.situacao === 'atencao' || s.situacao === 'critico').length;
    const offline = servidores.filter((s) => s.situacao === 'offline').length;
    const incidentes = dados.incidentes || {};
    const mttr = incidentes.mttr || {};

    definirTexto('ambiente-nome', dados.ambiente || '—');
    definirTexto('topo-online', semDados ? '— online' : normais + ' online');
    definirTexto('topo-atencao', semDados ? '— atenção' : alerta + ' atenção');
    definirTexto('topo-offline', semDados ? '— offline' : offline + ' offline');

    definirTexto('kpi-normais', semDados ? '—' : normais + '/' + total);
    definirTexto('kpi-alerta', semDados ? '—' : alerta + '/' + total);
    definirTexto('kpi-offline', semDados ? '—' : offline + '/' + total);
    definirTexto('kpi-incidentes', String((incidentes.abertos || []).length));
    definirTexto('kpi-mttr', formatarDuracao(mttr.minutos));
    definirTexto('kpi-mttr-periodo', mttr.periodo || '(últimos 30d)');
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
      callbacks: {
        label: (ctx) => ctx.parsed.y == null ? ' Sem dados'
          : ' Disponibilidade: ' + fmt1.format(ctx.parsed.y) + '%'
      }
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
          pointBorderWidth: 1.5,
          spanGaps: false
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
    const frota = dados.disponibilidade_frota || {};
    const serie = frota[periodo.disp] || { rotulos: [], valores: [], anterior: null };
    const valores = Array.isArray(serie.valores) ? serie.valores : [];
    const validos = valores.map(numeroOuNull).filter((valor) => valor != null);
    const atual = media(validos);
    const anterior = numeroOuNull(serie.anterior);

    if (atual == null) {
      definirTexto('disp-valor', 'sem dados');
      montarDelta('disp-delta', '—', 'fr-delta--neutro', 'vs período anterior');
    } else {
      definirTexto('disp-valor', fmt1.format(atual) + '%');
      if (anterior == null) {
        montarDelta('disp-delta', '—', 'fr-delta--neutro', 'vs período anterior');
      } else {
        const diferenca = +(atual - anterior).toFixed(1);
        const sinal = diferenca > 0 ? '▲ +' : diferenca < 0 ? '▼ ' : '';
        montarDelta(
          'disp-delta',
          sinal + fmt1.format(diferenca) + '%',
          diferenca > 0 ? 'fr-delta--bom' : diferenca < 0 ? 'fr-delta--ruim' : 'fr-delta--neutro',
          'vs período anterior'
        );
      }
    }

    if (graficos.disp) {
      graficos.disp.data.labels = Array.isArray(serie.rotulos) ? serie.rotulos : [];
      graficos.disp.data.datasets[0].data = valores;
      // O gold pode trazer quedas reais a 0%; nesse caso o eixo precisa sair de 90–100.
      graficos.disp.options.scales.y.min = validos.length && Math.min(...validos) < 90 ? 0 : 90;
      graficos.disp.update();
    }
  }

  function atualizarIncidentes() {
    const porDia = ((dados.incidentes || {}).por_dia || {});
    const serie = porDia[periodo.inc] || { rotulos: [], valores: [], anterior: null };
    const valores = Array.isArray(serie.valores) ? serie.valores : [];
    const validos = valores.map(numeroOuNull).filter((valor) => valor != null);
    const total = soma(validos);
    const anterior = numeroOuNull(serie.anterior);
    let texto = '—';
    let classe = 'fr-delta--neutro';

    if (!validos.length || anterior == null || anterior === 0) {
      texto = '—';
    } else {
      const variacao = Math.round(((total - anterior) / anterior) * 100);
      // Para incidentes, cair é bom.
      texto = variacao < 0 ? '▼ ' + variacao + '%' : variacao > 0 ? '▲ +' + variacao + '%' : variacao + '%';
      classe = variacao < 0 ? 'fr-delta--bom' : variacao > 0 ? 'fr-delta--ruim' : 'fr-delta--neutro';
    }

    definirTexto('inc-valor', String(total));
    montarDelta('inc-delta', texto, classe, 'vs período anterior');

    if (graficos.inc) {
      graficos.inc.data.labels = Array.isArray(serie.rotulos) ? serie.rotulos : [];
      graficos.inc.data.datasets[0].data = valores;
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
    const valor = numeroOuNull(servidor.atual && servidor.atual[recurso]);
    const celula = el('td');
    const wrap = el('span', 'fr-metrica');
    if (valor == null) {
      wrap.classList.add('fr-metrica--sem-dados');
      wrap.append(el('span', 'fr-metrica__valor', 'sem dados'));
      celula.append(wrap);
      return celula;
    }
    const estado = estadoMetrica(recurso, valor, servidor);
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

  function linkServidor(id, nome) {
    const link = el('a', 'fr-link-servidor', nome || String(id));
    link.href = './especifica-servidor/dash-especica.html?servidor=' + encodeURIComponent(id);
    return link;
  }

  function linkIncidente(incidente) {
    const encontrado = (dados.servidores || []).find((servidor) =>
      servidor.nome === incidente.servidor || String(servidor.id_servidor) === String(incidente.servidor));
    return linkServidor(encontrado ? encontrado.id_servidor : incidente.servidor, incidente.servidor || '—');
  }

  function renderizarTabelaStatus() {
    const corpo = document.getElementById('corpo-status');
    if (!corpo || !dados) return;
    const servidores = dados.servidores || [];

    if (!servidores.length) {
      const linha = el('tr');
      const celula = el('td', 'fr-vazio', 'Sem dados de servidores para esta empresa.');
      celula.colSpan = 8;
      linha.append(celula);
      corpo.replaceChildren(linha);
      return;
    }

    const linhas = [...servidores]
      .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
        || String(a.nome || a.id_servidor).localeCompare(String(b.nome || b.id_servidor)))
      .map((servidor) => {
        const linha = el('tr');

        const tdServidor = el('td');
        const bloco = el('span', 'fr-servidor');
        const classePonto = ROTULO_SITUACAO[servidor.situacao] ? servidor.situacao : 'offline';
        bloco.append(el('span', 'fr-ponto fr-ponto--' + classePonto), linkServidor(servidor.id_servidor, servidor.nome));
        tdServidor.append(bloco);

        const tdLocal = el('td', '', servidor.cidade || '—');

        const tdSituacao = el('td');
        const rotulo = ROTULO_SITUACAO[servidor.situacao] || 'Sem dados';
        tdSituacao.append(el('span', 'fr-pilula fr-pilula--' + classePonto, rotulo));

        const tdDisp = el('td');
        const disp = numeroOuNull(servidor.disponibilidade_pct && servidor.disponibilidade_pct['24h']);
        if (disp == null) {
          tdDisp.append(el('span', 'fr-disp fr-disp--vazio', 'sem dados'));
        } else {
          const classe = disp >= 99 ? 'ok' : disp >= 95 ? 'atencao' : 'critico';
          tdDisp.append(el('span', 'fr-disp fr-disp--' + classe, fmt1.format(disp) + '%'));
        }

        const tdTempo = el('td', '', formatarDuracao(servidor.tempo_min));

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
    if (!lista || !dados) return;
    const top = (dados.servidores || [])
      .filter((s) => numeroOuNull(s.inc7d) > 0)
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
        linkServidor(servidor.id_servidor, servidor.nome),
        trilho,
        el('span', 'fr-ranking__qtd', servidor.inc7d + (servidor.inc7d === 1 ? ' incidente' : ' incidentes'))
      );
      return item;
    }));
  }

  /* ---------- Incidentes abertos ---------- */
  function renderizarIncidentesAbertos() {
    const corpo = document.getElementById('corpo-incidentes');
    if (!corpo || !dados) return;
    const abertos = ((dados.incidentes || {}).abertos || []);

    if (!abertos.length) {
      const linha = el('tr');
      const celula = el('td', 'fr-vazio', 'Nenhum incidente aberto no momento.');
      celula.colSpan = 5;
      linha.append(celula);
      corpo.replaceChildren(linha);
      return;
    }

    corpo.replaceChildren(...abertos.map((incidente) => {
      const linha = el('tr');
      const tdPrioridade = el('td');
      const prioridade = ROTULO_SITUACAO[incidente.prioridade] || 'Normal';
      tdPrioridade.append(el('span', 'fr-pilula fr-pilula--' + (incidente.prioridade || 'normal'), prioridade));

      const tdAcao = el('td');
      const botao = linkIncidente(incidente);
      botao.className = 'fr-seta';
      botao.setAttribute('aria-label', 'Abrir ' + incidente.id + ' no ' + (incidente.servidor || 'servidor'));
      botao.innerHTML = ICONE_SETA;
      tdAcao.append(botao);

      linha.append(
        el('td', '', incidente.id),
        el('td', '', incidente.servidor || '—'),
        tdPrioridade,
        el('td', '', formatarDuracao(incidente.minutos)),
        tdAcao
      );
      return linha;
    }));
  }

  /* ---------- Relatório com IA (template do backend) ---------- */
  function renderizarRelatorioIA() {
    const ia = (dados && dados.relatorio_ia) || {};
    const gerado = ia.gerado_em ? new Date(ia.gerado_em) : null;
    const valido = gerado && !Number.isNaN(gerado.getTime());
    definirTexto('ia-gerado', valido
      ? 'Gerado por IA • ' + String(gerado.getDate()).padStart(2, '0') + '/' + String(gerado.getMonth() + 1).padStart(2, '0') + ' ' + horaAgora(gerado)
      : 'Gerado por IA • —');
    definirTexto('ia-resumo', ia.resumo || 'Sem dados para análise');

    const pontos = document.getElementById('ia-pontos');
    if (pontos) {
      const itens = (ia.pontos || []).map((texto) => {
        const item = el('li');
        item.innerHTML = ICONE_ALERTA;
        item.append(el('span', '', texto));
        return item;
      });
      pontos.replaceChildren(...(itens.length ? itens : [el('li', 'fr-vazio', 'Sem dados')]));
    }

    const recomendacoes = document.getElementById('ia-recomendacoes');
    if (recomendacoes) {
      const itens = (ia.recomendacoes || []).map((texto) => el('li', '', texto));
      recomendacoes.replaceChildren(...(itens.length ? itens : [el('li', 'fr-vazio', 'Sem dados')]));
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
    renderizarResumo();
    renderizarTabelaStatus();
    renderizarProblematicos();
    renderizarIncidentesAbertos();
    renderizarRelatorioIA();
    atualizarDisponibilidade();
    atualizarIncidentes();
  }

  document.addEventListener('DOMContentLoaded', () => {
    criarGraficoDisp();
    criarGraficoIncidentes();
    configurarFiltro('filtro-disp', 'disp', atualizarDisponibilidade);
    configurarFiltro('filtro-inc', 'inc', atualizarIncidentes);
    configurarAtualizacaoIA();
    carregarDados();

    // Reclassifica CPU/RAM/Disco quando os limites de alerta mudarem em outra tela.
    window.addEventListener('infratech:limites-alerta-alterados', renderizarTabelaStatus);
  });
})();
