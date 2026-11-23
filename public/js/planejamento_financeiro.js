/*
 * Controla a página Planejamento Financeiro & Billing.
 * Carrega os dados da empresa em GET /planejamento e persiste alterações de
 * premissas em PUT /planejamento, mantendo os dados locais como fallback.
 */

var planejamento = {
  gestor: 'Alberto Santos',
  data: '10/11/2026',
  plano: 'Profissional',
  jogadores: 10000,
  ticketMedio: 3.2,
  custoInfraTech: 19200,
  economiaInfraPropria: 8400,
  orcamento: 20000,
  metaUso: 75,
  limiteSubutilizado: 40,
  crescimento: 375,
  provisionamento: 2,
  capacidadeAtual: 2000,
  capacidadeNova: 1250,
  custoNovoServidor: 3200,
  custoImplantacao: 2000,

  servidores: [
    { nome: 'SRV-SP-01', local: 'São Paulo - Paulista', custo: 3200, uso: 78, pico: 96 },
    { nome: 'SRV-SP-02', local: 'São Paulo - Paulista', custo: 3200, uso: 58, pico: 58 },
    { nome: 'SRV-RJ-01', local: 'Rio de Janeiro', custo: 3200, uso: 52, pico: 52 },
    { nome: 'SRV-RJ-02', local: 'Rio de Janeiro', custo: 3200, uso: 44, pico: 44 },
    { nome: 'SRV-FOR-01', local: 'Fortaleza', custo: 3200, uso: 41, pico: 41 },
    { nome: 'SRV-FOR-02', local: 'Fortaleza', custo: 3200, uso: 18, pico: 18 }
  ],

  historico: [
    { mes: 'Jun/26', valor: 12800 },
    { mes: 'Jul/26', valor: 12800 },
    { mes: 'Ago/26', valor: 16000 },
    { mes: 'Set/26', valor: 16000 },
    { mes: 'Out/26', valor: 19200 },
    { mes: 'Nov/26', valor: 19200 }
  ],

  cenarios: [
    { nome: 'Manter frota', detalhe: 'Sem expansão', adicionais: 0, capacidadeExtra: 0, prazo: '—' },
    { nome: 'Otimizar frota', detalhe: 'Realocar carga, sem comprar', adicionais: 0, capacidadeExtra: 500, prazo: 'Imediato' },
    { nome: 'Crescimento esperado', detalhe: 'Adicionar 2 servidores físicos', adicionais: 2, capacidadeExtra: 0, prazo: '2 meses', destaque: true },
    { nome: 'Expansão agressiva', detalhe: 'Adicionar 5 servidores físicos', adicionais: 5, capacidadeExtra: 0, prazo: '2 meses' }
  ]
};

var graficoCusto = null;
var toastTimer = null;
var filtroServidorAtual = 'alertas';
var termoBuscaServidor = '';
var nomesMeses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
var USOS_ILUSTRATIVOS = [
  { uso: 78, pico: 96 },
  { uso: 58, pico: 58 },
  { uso: 52, pico: 52 },
  { uso: 44, pico: 44 },
  { uso: 41, pico: 41 },
  { uso: 18, pico: 18 }
];

/* ---------- Formatação ---------- */

function formatarMoeda(valor, casas) {
  var decimais = 0;
  if (casas !== undefined) {
    decimais = casas;
  }
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  });
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function formatarPercentual(valor, casas) {
  var decimais = 1;
  if (casas !== undefined) {
    decimais = casas;
  }
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  }) + '%';
}

function textoUnidade(quantidade, singular, plural) {
  if (quantidade === 1) {
    return quantidade + ' ' + singular;
  }
  return quantidade + ' ' + plural;
}

function mesesTexto(meses) {
  var inteiros = Math.floor(meses);
  var semanas = Math.round((meses - inteiros) * 4);
  if (semanas >= 4) {
    inteiros += 1;
    semanas = 0;
  }
  var texto = textoUnidade(inteiros, 'mês', 'meses');
  if (semanas > 0) {
    texto += ' e ' + textoUnidade(semanas, 'semana', 'semanas');
  }
  return texto;
}

function mesAno(mesesAdiante) {
  var data = new Date();
  data.setDate(1);
  data.setMonth(data.getMonth() + mesesAdiante);
  return nomesMeses[data.getMonth()] + '/' + data.getFullYear();
}

/* ---------- Cálculos ---------- */

function custoOcioso(servidor) {
  var uso = Number(servidor.uso) || 0;
  if (uso >= planejamento.metaUso) return 0;
  return (Number(servidor.custo) || 0) * (planejamento.metaUso - uso) / 100;
}

function totaisServidores() {
  var custoTotal = 0;
  var ociosoTotal = 0;
  var somaUso = 0;

  planejamento.servidores.forEach(function (servidor) {
    custoTotal += Number(servidor.custo) || 0;
    ociosoTotal += custoOcioso(servidor);
    somaUso += Number(servidor.uso) || 0;
  });

  var usoMedio = 0;
  if (planejamento.servidores.length > 0) {
    usoMedio = somaUso / planejamento.servidores.length;
  }

  var percentualOcioso = 0;
  if (custoTotal > 0) {
    percentualOcioso = (ociosoTotal / custoTotal) * 100;
  }

  return {
    custoTotal: custoTotal,
    ociosoTotal: ociosoTotal,
    usoMedio: usoMedio,
    percentualOcioso: percentualOcioso
  };
}

function dadosBilling() {
  var receita = planejamento.jogadores * planejamento.ticketMedio;
  var lucro = receita - planejamento.custoInfraTech;
  var margem = 0;
  var roi = 0;
  var breakeven = 0;

  if (receita > 0) {
    margem = (lucro / receita) * 100;
  }
  if (planejamento.custoInfraTech > 0) {
    roi = (lucro / planejamento.custoInfraTech) * 100;
  }
  if (planejamento.ticketMedio > 0) {
    breakeven = Math.ceil(planejamento.custoInfraTech / planejamento.ticketMedio);
  }

  return {
    receita: receita,
    lucro: lucro,
    margem: margem,
    roi: roi,
    breakeven: breakeven
  };
}

function situacaoServidor(uso) {
  if (uso >= planejamento.metaUso) {
    return {
      classe: 'saturado',
      texto: 'Saturado',
      prioridade: 1,
      nivel: '1 · Crítico',
      classePrioridade: 'critico'
    };
  }
  if (uso < planejamento.limiteSubutilizado) {
    return {
      classe: 'subutilizado',
      texto: 'Subutilizado',
      prioridade: 2,
      nivel: '2 · Alerta',
      classePrioridade: 'alerta'
    };
  }
  return {
    classe: 'normal',
    texto: 'Normal',
    prioridade: 3,
    nivel: '3 · Saudável',
    classePrioridade: 'saudavel'
  };
}

function runwayMeses(capacidade) {
  if (planejamento.crescimento <= 0) {
    if (capacidade > planejamento.jogadores) return Infinity;
    return 0;
  }
  return Math.max(0, (capacidade - planejamento.jogadores) / planejamento.crescimento);
}

function textoRunway(capacidade) {
  var meses = runwayMeses(capacidade);
  if (meses === Infinity) return 'Sem saturação prevista';
  if (meses <= 0) return 'Capacidade esgotada';
  return mesesTexto(meses) + ', satura em ' + mesAno(Math.floor(meses));
}

/* ---------- Renderização ---------- */

function renderBilling() {
  var billing = dadosBilling();

  document.getElementById('kpi-custo').textContent = formatarMoeda(planejamento.custoInfraTech);
  document.getElementById('kpi-custo-detalhe').textContent =
    'Plano ' + planejamento.plano + ' · ' + planejamento.servidores.length + ' servidores';

  document.getElementById('kpi-receita').textContent = formatarMoeda(billing.receita);
  document.getElementById('kpi-receita-detalhe').textContent =
    formatarNumero(planejamento.jogadores) + ' jogadores × ' + formatarMoeda(planejamento.ticketMedio, 2);

  var lucro = document.getElementById('kpi-lucro');
  lucro.textContent = formatarMoeda(billing.lucro);
  lucro.classList.toggle('plan-kpi__valor--positivo', billing.lucro >= 0);
  lucro.classList.toggle('plan-kpi__valor--negativo', billing.lucro < 0);
  document.getElementById('kpi-margem').textContent = 'Margem de ' + formatarPercentual(billing.margem, 2);

  document.getElementById('kpi-roi').textContent = formatarPercentual(billing.roi, 2);
  document.getElementById('kpi-breakeven').textContent =
    'Break-even: ' + formatarNumero(billing.breakeven) + ' jogadores';

  document.getElementById('economia-estimada').textContent = formatarMoeda(planejamento.economiaInfraPropria);
}

function renderCards() {
  var capacidadeTotal = planejamento.servidores.length * planejamento.capacidadeAtual;
  var runway = runwayMeses(capacidadeTotal);
  var percentual = 0;
  if (capacidadeTotal > 0) {
    percentual = (planejamento.jogadores / capacidadeTotal) * 100;
  }

  var textoRunwayValor = 'Capacidade esgotada';
  if (runway === Infinity) {
    textoRunwayValor = 'Sem saturação prevista';
  } else if (runway > 0) {
    textoRunwayValor = mesesTexto(runway);
  }
  document.getElementById('runway-valor').textContent = textoRunwayValor;
  document.getElementById('runway-barra').style.width = Math.min(100, percentual).toFixed(1) + '%';
  document.getElementById('runway-uso').textContent =
    formatarNumero(planejamento.jogadores) + ' / ' + formatarNumero(capacidadeTotal) + ' jogadores';
  document.getElementById('runway-percentual').textContent = formatarPercentual(percentual);

  if (runway === Infinity) {
    document.getElementById('runway-detalhe').textContent = 'Sem crescimento cadastrado; o prazo de decisão não se aplica.';
  } else {
    document.getElementById('runway-detalhe').textContent =
      'Prazo útil para decidir: ' + mesesTexto(Math.max(0, runway - planejamento.provisionamento)) +
      ' (provisionamento: ' + textoUnidade(planejamento.provisionamento, 'mês', 'meses') + ').';
  }

  var maior = planejamento.servidores[0] || null;
  planejamento.servidores.forEach(function (servidor) {
    if ((Number(servidor.uso) || 0) > (Number(maior.uso) || 0)) maior = servidor;
  });

  if (maior) {
    var usoMaior = Number(maior.uso) || 0;
    document.getElementById('expansao-servidor').textContent = maior.nome;
    document.getElementById('expansao-local').textContent = maior.local;

    var situacao = situacaoServidor(usoMaior);
    var status = document.getElementById('expansao-status');
    if (usoMaior >= planejamento.metaUso) {
      status.textContent = 'Gargalo local';
    } else {
      status.textContent = situacao.texto;
    }
    status.className = 'plan-situacao plan-situacao--' + situacao.classe;

    document.getElementById('bloqueados-risco').textContent =
      'Risco local: ' + maior.nome + ' a ' + (maior.pico || usoMaior) +
      '% de uso pode gerar fila antes do teto global.';
  } else {
    document.getElementById('expansao-servidor').textContent = '—';
    document.getElementById('expansao-local').textContent = 'Sem servidores ativos';
    var statusVazio = document.getElementById('expansao-status');
    statusVazio.textContent = 'Sem dados';
    statusVazio.className = 'plan-situacao';
    document.getElementById('bloqueados-risco').textContent = 'Nenhum servidor ativo cadastrado.';
  }

  [1, 3, 6].forEach(function (mes) {
    var previstos = planejamento.jogadores + planejamento.crescimento * mes;
    var bloqueados = Math.max(0, previstos - capacidadeTotal);
    document.getElementById('bloqueados-' + mes).textContent = formatarNumero(bloqueados);
  });

  document.getElementById('fisicos-online').textContent = planejamento.servidores.length;
}

function prepararServidoresPriorizados() {
  var lista = planejamento.servidores.map(function (servidor) {
    var uso = Number(servidor.uso) || 0;
    var ocioso = custoOcioso(servidor);
    var situacao = situacaoServidor(uso);
    return {
      nome: servidor.nome,
      local: servidor.local || '-',
      custo: Number(servidor.custo) || 0,
      uso: uso,
      ocioso: ocioso,
      situacao: situacao
    };
  });

  lista.sort(function (a, b) {
    if (a.situacao.prioridade !== b.situacao.prioridade) {
      return a.situacao.prioridade - b.situacao.prioridade;
    }
    if (a.situacao.prioridade === 2 && b.ocioso !== a.ocioso) {
      return b.ocioso - a.ocioso;
    }
    if (b.uso !== a.uso) {
      return b.uso - a.uso;
    }
    return String(a.nome).localeCompare(String(b.nome));
  });

  return lista;
}

function correspondeFiltroServidor(item, filtro) {
  if (filtro === 'alertas') {
    return item.situacao.prioridade === 1 || item.situacao.prioridade === 2;
  }
  if (filtro === 'criticos') {
    return item.situacao.prioridade === 1;
  }
  if (filtro === 'subutilizados') {
    return item.situacao.prioridade === 2;
  }
  if (filtro === 'normais') {
    return item.situacao.prioridade === 3;
  }
  return true;
}

function correspondeBuscaServidor(item, termo) {
  if (!termo) return true;
  var busca = termo.toLowerCase();
  var nome = String(item.nome || '').toLowerCase();
  var local = String(item.local || '').toLowerCase();
  return nome.indexOf(busca) !== -1 || local.indexOf(busca) !== -1;
}

function atualizarContadoresFiltros(lista) {
  var contadores = {
    alertas: 0,
    criticos: 0,
    subutilizados: 0,
    normais: 0,
    todos: lista.length
  };

  lista.forEach(function (item) {
    if (item.situacao.prioridade === 1) {
      contadores.criticos += 1;
      contadores.alertas += 1;
    } else if (item.situacao.prioridade === 2) {
      contadores.subutilizados += 1;
      contadores.alertas += 1;
    } else {
      contadores.normais += 1;
    }
  });

  var mapaIds = {
    alertas: 'cont-filtro-alertas',
    criticos: 'cont-filtro-criticos',
    subutilizados: 'cont-filtro-subutilizados',
    normais: 'cont-filtro-normais',
    todos: 'cont-filtro-todos'
  };

  Object.keys(mapaIds).forEach(function (chave) {
    var el = document.getElementById(mapaIds[chave]);
    if (el) el.textContent = contadores[chave];
  });
}

function selecionarFiltroServidor(filtro) {
  filtroServidorAtual = filtro;
  document.querySelectorAll('[data-filtro-servidor]').forEach(function (botao) {
    var ativo = botao.getAttribute('data-filtro-servidor') === filtro;
    botao.classList.toggle('plan-filtro-botao--ativo', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
  });
  renderServidores();
}

function renderServidores() {
  var corpo = document.getElementById('corpo-servidores');
  var totais = totaisServidores();
  var priorizados = prepararServidoresPriorizados();
  atualizarContadoresFiltros(priorizados);

  var visiveis = priorizados.filter(function (item) {
    return correspondeFiltroServidor(item, filtroServidorAtual) && correspondeBuscaServidor(item, termoBuscaServidor);
  });

  var html = '';

  if (visiveis.length === 0) {
    html += '<tr><td colspan="6" class="plan-tabela__vazio">' +
      'Nenhum servidor encontrado para o filtro atual.' +
      '<button type="button" class="plan-atalho" id="btn-ver-todos-servidores">Ver todos os servidores</button>' +
      '</td></tr>';
  } else {
    visiveis.forEach(function (item) {
      var classeOcioso = 'plan-tabela__zero';
      if (item.ocioso > 0) {
        classeOcioso = 'plan-tabela__destaque';
      }

      html += '<tr>' +
        '<td><span class="plan-prioridade plan-prioridade--' + item.situacao.classePrioridade + '">' + item.situacao.nivel + '</span></td>' +
        '<td><strong>' + escaparTexto(item.nome) + '</strong><span class="plan-servidor-local">' + escaparTexto(item.local) + '</span></td>' +
        '<td class="plan-tabela__valor">' + formatarMoeda(item.custo) + '</td>' +
        '<td class="plan-tabela__valor">' + item.uso + '%</td>' +
        '<td class="' + classeOcioso + '">' + formatarMoeda(item.ocioso) + '</td>' +
        '<td><span class="plan-situacao plan-situacao--' + item.situacao.classe + '">' + item.situacao.texto + '</span></td>' +
        '</tr>';
    });
  }

  var rotuloTotal = 'Total da frota (' + priorizados.length + ')';
  if (visiveis.length !== priorizados.length) {
    rotuloTotal = 'Total da frota (' + visiveis.length + ' de ' + priorizados.length + ' exibidos)';
  }

  html += '<tr class="plan-tabela__total">' +
    '<td>—</td>' +
    '<td>' + rotuloTotal + '</td>' +
    '<td>' + formatarMoeda(totais.custoTotal) + '</td>' +
    '<td>' + formatarPercentual(totais.usoMedio) + '</td>' +
    '<td>' + formatarMoeda(totais.ociosoTotal) + ' (' + formatarPercentual(totais.percentualOcioso) + ')</td>' +
    '<td>—</td>' +
    '</tr>';

  corpo.innerHTML = html;
}

function renderCenarios() {
  var corpo = document.getElementById('corpo-cenarios');
  var baseServidores = planejamento.servidores.length;
  var html = '';

  planejamento.cenarios.forEach(function (cenario) {
    var servidores = baseServidores + cenario.adicionais;
    var capacidade = baseServidores * planejamento.capacidadeAtual +
      cenario.adicionais * planejamento.capacidadeNova +
      cenario.capacidadeExtra;
    var adicionalCapacidade = cenario.adicionais * planejamento.capacidadeNova + cenario.capacidadeExtra;
    var custoMensal = cenario.adicionais * planejamento.custoNovoServidor;
    var implantacao = cenario.adicionais * planejamento.custoImplantacao;

    var classe = '';
    var nome = cenario.nome;
    if (cenario.destaque) {
      classe = 'plan-tabela__linha--destaque';
      nome = '<span class="plan-tabela__cenario-nome">' + cenario.nome + '</span>';
    }

    var servidoresTexto = formatarNumero(servidores);
    if (cenario.adicionais > 0) {
      servidoresTexto = servidores + ' (+' + cenario.adicionais + ')';
    }

    var capacidadeTexto = formatarNumero(capacidade);
    if (adicionalCapacidade > 0) {
      capacidadeTexto += ' (+' + formatarNumero(adicionalCapacidade) + ')';
    }

    var custoMensalTexto = 'R$ 0/mês';
    if (custoMensal > 0) {
      custoMensalTexto = '+ ' + formatarMoeda(custoMensal) + '/mês';
    }

    html += '<tr class="' + classe + '">' +
      '<td>' + nome + '<small>' + cenario.detalhe + '</small></td>' +
      '<td class="plan-tabela__valor">' + servidoresTexto + '</td>' +
      '<td class="plan-tabela__valor">' + capacidadeTexto + '</td>' +
      '<td class="plan-tabela__valor">' + custoMensalTexto + '</td>' +
      '<td class="plan-tabela__valor">' + formatarMoeda(implantacao) + '</td>' +
      '<td>' + cenario.prazo + '</td>' +
      '<td>' + textoRunway(capacidade) + '</td>' +
      '</tr>';
  });

  corpo.innerHTML = html;
}

function renderGrafico() {
  var canvas = document.getElementById('grafico-custo');
  if (!canvas || typeof Chart === 'undefined') return;

  var labels = [];
  var valores = [];
  var orcamentos = [];

  planejamento.historico.forEach(function (item) {
    labels.push(item.mes);
    valores.push(item.valor);
    orcamentos.push(planejamento.orcamento);
  });

  var cores = valores.map(function (valor, indice) {
    if (valor > planejamento.orcamento) {
      return 'rgba(253, 164, 175, 0.85)';
    }
    if (indice === valores.length - 1) {
      return 'rgba(0, 207, 255, 0.35)';
    }
    return 'rgba(0, 207, 255, 0.85)';
  });

  if (graficoCusto) graficoCusto.destroy();

  graficoCusto = new Chart(canvas, {
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Custo estimado',
          data: valores,
          backgroundColor: cores,
          borderRadius: 4,
          maxBarThickness: 46
        },
        {
          type: 'line',
          label: 'Orçamento mensal',
          data: orcamentos,
          borderColor: '#fda4af',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#a6b7c7', boxWidth: 12, font: { family: 'Inter, sans-serif', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function (contexto) {
              return contexto.dataset.label + ': ' + formatarMoeda(contexto.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8da1b3', font: { family: 'Inter, sans-serif', size: 11 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#8da1b3',
            font: { family: 'Inter, sans-serif', size: 11 },
            callback: function (valor) { return formatarMoeda(valor); }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });

  var ultimo = valores[valores.length - 1] || 0;
  var percentual = 0;
  if (planejamento.orcamento > 0) {
    percentual = (ultimo / planejamento.orcamento) * 100;
  }

  var projecaoEl = document.getElementById('projecao-orcamento');
  if (labels.length > 0) {
    projecaoEl.textContent =
      'Projeção de ' + labels[labels.length - 1] + ': ' + formatarMoeda(ultimo) +
      ' (' + percentual.toFixed(0) + '% do orçamento)';
    projecaoEl.classList.toggle('plan-projecao--acima', ultimo > planejamento.orcamento);
  } else {
    projecaoEl.textContent = 'Sem histórico mensal cadastrado';
    projecaoEl.classList.remove('plan-projecao--acima');
  }
  document.getElementById('texto-orcamento').textContent = formatarMoeda(planejamento.orcamento);
}

function renderPremissasResumo() {
  document.getElementById('nome-gestor').textContent = planejamento.gestor;
  document.getElementById('data-cadastro').textContent = planejamento.data;
  document.getElementById('modal-data').textContent = planejamento.data;

  document.getElementById('resumo-premissas').textContent =
    'crescimento ' + formatarNumero(planejamento.crescimento) + ' jogadores/mês · ' +
    formatarNumero(planejamento.capacidadeAtual) + ' jogadores por servidor · provisionamento ' +
    textoUnidade(planejamento.provisionamento, 'mês', 'meses') +
    ' · meta de uso ' + planejamento.metaUso + '% · novo servidor ' +
    formatarMoeda(planejamento.custoNovoServidor) + '/mês + ' +
    formatarMoeda(planejamento.custoImplantacao) + ' de implantação.';

  document.getElementById('limite-saturado').textContent = planejamento.metaUso;
  document.getElementById('limite-normal').textContent = Math.max(0, planejamento.metaUso - 1);
  document.querySelectorAll('.limite-subutilizado-nota').forEach(function (item) {
    item.textContent = planejamento.limiteSubutilizado;
  });
}

function renderTudo() {
  renderBilling();
  renderCards();
  renderServidores();
  renderCenarios();
  renderGrafico();
  renderPremissasResumo();
}

/* ---------- Integração com API ---------- */

function aplicarDadosServidor(dados) {
  if (!dados) return;
  var servidoresRecebidos = [];
  if (Array.isArray(dados.servidores)) {
    servidoresRecebidos = dados.servidores;
  }

  planejamento.gestor = dados.gestor || planejamento.gestor;
  planejamento.data = dados.data || planejamento.data;
  planejamento.plano = dados.plano || planejamento.plano;
  planejamento.jogadores = Number(dados.jogadores) || 0;
  planejamento.ticketMedio = Number(dados.ticketMedio) || 0;
  planejamento.custoInfraTech = Number(dados.custoInfraTech) || 0;
  planejamento.economiaInfraPropria = Number(dados.economiaInfraPropria) || 0;
  planejamento.orcamento = Number(dados.orcamento) || 0;
  planejamento.metaUso = Number(dados.metaUso) || 0;
  planejamento.limiteSubutilizado = Number(dados.limiteSubutilizado) || 0;
  planejamento.crescimento = Number(dados.crescimento) || 0;
  planejamento.provisionamento = Number(dados.provisionamento) || 0;
  planejamento.capacidadeAtual = Number(dados.capacidadeAtual) || 0;
  planejamento.capacidadeNova = Number(dados.capacidadeNova) || 0;
  planejamento.custoNovoServidor = Number(dados.custoNovoServidor) || 0;
  planejamento.custoImplantacao = Number(dados.custoImplantacao) || 0;

  planejamento.servidores = servidoresRecebidos.map(function (servidor, indice) {
    var referencia = USOS_ILUSTRATIVOS[indice] || { uso: 0, pico: 0 };
    var uso = referencia.uso;
    if (servidor.uso != null) {
      uso = Number(servidor.uso);
    }
    var pico = referencia.pico;
    if (servidor.pico != null) {
      pico = Number(servidor.pico);
    }
    return {
      nome: servidor.nome,
      local: servidor.local || '-',
      custo: Number(servidor.custo) || 0,
      uso: uso,
      pico: pico
    };
  });

  if (Array.isArray(dados.historico)) {
    planejamento.historico = dados.historico;
  } else {
    planejamento.historico = [];
  }
}

function atualizarAvisoOrigem(conectadoAoBanco) {
  var aviso = document.getElementById('aviso-ilustrativo');
  if (!aviso) return;
  aviso.hidden = false;
  if (conectadoAoBanco) {
    aviso.classList.add('plan-aviso--banco');
    aviso.innerHTML = '<strong>Origem dos dados:</strong> custos dos servidores, histórico e premissas vêm do ' +
      '<strong>banco de dados</strong>; quantidade de jogadores, uso médio/pico dos servidores e projeções ' +
      'utilizam <strong>dados simulados/ilustrativos</strong>.';
  } else {
    aviso.classList.remove('plan-aviso--banco');
    aviso.innerHTML = '<strong>Modo ilustrativo (offline):</strong> exibindo dados locais de demonstração. ' +
      'As premissas podem ser alteradas no botão <strong>Premissas</strong>.';
  }
}

function carregarPlanejamentoBackend() {
  return fetch('/planejamento', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (resposta) {
      if (!resposta.ok) throw new Error('Falha ao carregar planejamento');
      return resposta.json();
    })
    .then(function (dados) {
      aplicarDadosServidor(dados);
      atualizarAvisoOrigem(true);
      renderTudo();
    })
    .catch(function () {
      atualizarAvisoOrigem(false);
    });
}

/* ---------- Relógio ---------- */

function iniciarRelogio() {
  var relogio = document.getElementById('relogio');
  if (!relogio) return;

  function atualizar() {
    var agora = new Date();
    relogio.textContent = agora.toLocaleDateString('pt-BR') + ' ' +
      agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  atualizar();
  setInterval(atualizar, 30000);
}

/* ---------- Modal de premissas ---------- */

var CAMPOS_PREMISSAS = [
  { chave: 'capacidadeAtual', id: 'premissa-capacidade-atual', min: 1 },
  { chave: 'capacidadeNova', id: 'premissa-capacidade-nova', min: 1 },
  { chave: 'crescimento', id: 'premissa-crescimento', min: 0 },
  { chave: 'provisionamento', id: 'premissa-provisionamento', min: 0 },
  { chave: 'orcamento', id: 'premissa-orcamento', min: 1 },
  { chave: 'metaUso', id: 'premissa-meta', min: 1, max: 100 },
  { chave: 'limiteSubutilizado', id: 'premissa-subutilizado', min: 1, max: 100 },
  { chave: 'custoNovoServidor', id: 'premissa-custo-servidor', min: 0 },
  { chave: 'custoImplantacao', id: 'premissa-custo-implantacao', min: 0 }
];

function preencherFormulario() {
  CAMPOS_PREMISSAS.forEach(function (campo) {
    document.getElementById(campo.id).value = planejamento[campo.chave];
  });
}

function definirErroModal(mensagem) {
  var erroEl = document.getElementById('erro-premissas');
  if (!erroEl) return;
  if (mensagem) {
    erroEl.textContent = mensagem;
    erroEl.hidden = false;
  } else {
    erroEl.textContent = '';
    erroEl.hidden = true;
  }
}

function definirSalvandoModal(salvando) {
  var btnSalvar = document.getElementById('btn-salvar-premissas');
  var btnCancelar = document.getElementById('btn-cancelar-premissas');
  if (btnSalvar) {
    btnSalvar.disabled = salvando;
    if (salvando) {
      btnSalvar.textContent = 'Salvando...';
    } else {
      btnSalvar.textContent = 'Aplicar e recalcular';
    }
  }
  if (btnCancelar) {
    btnCancelar.disabled = salvando;
  }
}

function abrirPremissas() {
  preencherFormulario();
  definirErroModal('');
  definirSalvandoModal(false);
  document.getElementById('modal-premissas').hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('premissa-capacidade-atual').focus();
}

function fecharPremissas() {
  definirErroModal('');
  definirSalvandoModal(false);
  document.getElementById('modal-premissas').hidden = true;
  document.body.style.overflow = '';
}

function lerNumero(id, padrao) {
  var valor = parseFloat(document.getElementById(id).value);
  if (isNaN(valor)) return padrao;
  return valor;
}

function aplicarPremissas(evento) {
  evento.preventDefault();
  definirErroModal('');

  var novasPremissas = {};
  CAMPOS_PREMISSAS.forEach(function (campo) {
    var valor = Math.max(campo.min, lerNumero(campo.id, planejamento[campo.chave]));
    if (campo.max !== undefined) valor = Math.min(campo.max, valor);
    novasPremissas[campo.chave] = valor;
  });

  if (novasPremissas.limiteSubutilizado >= novasPremissas.metaUso) {
    var msg = 'O limite subutilizado deve ser menor que a meta de uso.';
    definirErroModal(msg);
    mostrarToast(msg, true);
    document.getElementById('premissa-subutilizado').focus();
    return;
  }

  definirSalvandoModal(true);

  fetch('/planejamento', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(novasPremissas)
  })
    .then(function (resposta) {
      if (resposta.ok) {
        return resposta.json().then(function (dados) {
          aplicarDadosServidor(dados);
          atualizarAvisoOrigem(true);
          renderTudo();
          fecharPremissas();
          mostrarToast('Premissas salvas e valores recalculados.', false);
        });
      }
      return resposta.json().catch(function () { return {}; }).then(function (corpo) {
        if (resposta.status >= 400 && resposta.status < 500) {
          var erroMsg = corpo.erro || 'Não foi possível validar as premissas.';
          definirErroModal(erroMsg);
          mostrarToast(erroMsg, true);
          return;
        }
        throw new Error(corpo.erro || 'Erro no servidor');
      });
    })
    .catch(function () {
      CAMPOS_PREMISSAS.forEach(function (campo) {
        planejamento[campo.chave] = novasPremissas[campo.chave];
      });
      renderTudo();
      fecharPremissas();
      mostrarToast('Premissas aplicadas localmente (servidor indisponível).', false);
    })
    .finally(function () {
      definirSalvandoModal(false);
    });
}

function mostrarToast(mensagem, erro) {
  var toast = document.getElementById('toast-premissas');
  toast.textContent = mensagem || 'Premissas aplicadas. Valores recalculados.';
  toast.classList.toggle('plan-notificacao--erro', Boolean(erro));
  toast.hidden = false;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 3200);
}

/* ---------- Relatório Executivo com IA (Google Gemini + PDF) ---------- */

function escaparTexto(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function definirCarregandoRelatorio(carregando) {
  var btnTopo = document.getElementById('btn-gerar-relatorio');
  var btnRegerar = document.getElementById('btn-regerar-relatorio');
  if (btnTopo) {
    btnTopo.disabled = carregando;
    if (carregando) {
      btnTopo.textContent = 'Analisando com IA...';
    } else {
      btnTopo.textContent = 'Gerar relatório IA';
    }
  }
  if (btnRegerar) {
    btnRegerar.disabled = carregando;
    if (carregando) {
      btnRegerar.textContent = 'Analisando...';
    } else {
      btnRegerar.textContent = 'Regerar análise';
    }
  }
}

function montarRelatorioLocalFallback() {
  var billing = dadosBilling();
  var totais = totaisServidores();
  var capacidadeTotal = planejamento.servidores.length * planejamento.capacidadeAtual;
  var runway = runwayMeses(capacidadeTotal);
  var servidoresDetalhados = planejamento.servidores.map(function (srv, indice) {
    var ref = USOS_ILUSTRATIVOS[indice] || { uso: 0, pico: 0 };
    var uso = ref.uso;
    if (srv.uso !== undefined && srv.uso !== null) {
      uso = Number(srv.uso) || 0;
    }
    var pico = ref.pico;
    if (srv.pico !== undefined && srv.pico !== null) {
      pico = Number(srv.pico) || uso;
    }
    var situacao = situacaoServidor(uso);
    return {
      nome: srv.nome,
      local: srv.local || '-',
      custo: Number(srv.custo) || 0,
      uso: uso,
      pico: pico,
      custoOcioso: custoOcioso(srv),
      situacao: situacao.texto
    };
  });

  var maior = servidoresDetalhados[0] || null;
  servidoresDetalhados.forEach(function (srv) {
    if (srv.uso > maior.uso) maior = srv;
  });

  var nomeGargalo = 'Nenhum servidor';
  if (maior) {
    nomeGargalo = maior.nome;
  }

  var projecoes = [1, 3, 6].map(function (meses) {
    var previstos = planejamento.jogadores + planejamento.crescimento * meses;
    var bloqueados = Math.max(0, previstos - capacidadeTotal);
    var unidadeMes = ' meses';
    if (meses === 1) unidadeMes = ' mês';
    var impacto = 'Capacidade global suficiente, monitorando picos em ' + nomeGargalo + '.';
    if (bloqueados > 0) {
      impacto = 'Risco de bloquear ' + formatarNumero(bloqueados) + ' jogadores (' + formatarMoeda(bloqueados * planejamento.ticketMedio) + '/mês).';
    }
    return {
      horizonte: meses + unidadeMes,
      previsao: 'Demanda estimada de ' + formatarNumero(previstos) + ' jogadores simultâneos.',
      impactoNegocio: impacto
    };
  });

  return {
    origem: 'analitico_local',
    modelo: 'motor-analitico-local',
    emitidoEm: new Date().toLocaleString('pt-BR'),
    dados: planejamento,
    metricas: {
      receita: billing.receita,
      lucro: billing.lucro,
      margem: billing.margem,
      roi: billing.roi,
      breakeven: billing.breakeven,
      capacidadeTotal: capacidadeTotal,
      runwayMeses: runway,
      custoOciosoTotal: totais.ociosoTotal,
      servidoresDetalhados: servidoresDetalhados
    },
    analise: {
      tituloExecutivo: 'Relatório Executivo de Infraestrutura e FinOps — Plano ' + planejamento.plano,
      vereditoSituacao: 'Operação Analisada pelo Motor Analítico InfraTech',
      resumoExecutivo: 'Operação com ' + servidoresDetalhados.length + ' servidores ativos suportando ' +
        formatarNumero(planejamento.jogadores) + ' jogadores, gerando receita estimada de ' +
        formatarMoeda(billing.receita) + ' e lucro líquido de ' + formatarMoeda(billing.lucro) + '.',
      analiseFinanceira: 'Margem estimada de ' + formatarPercentual(billing.margem, 2) +
        ' e ROI de ' + formatarPercentual(billing.roi, 2) + ', com break-even em ' +
        formatarNumero(billing.breakeven) + ' jogadores.',
      analiseFrotaGargalos: 'Custo ocioso total estimado em ' + formatarMoeda(totais.ociosoTotal) +
        '/mês. Principal ponto de atenção: ' + nomeGargalo + '.',
      previsoesFuturas: projecoes,
      insightsEstrategicos: [
        'Avaliar realocação de carga em ' + nomeGargalo + ' para equilibrar a frota.',
        'Reduzir ociosidade aproximando os servidores subutilizados da meta de ' + planejamento.metaUso + '%.'
      ],
      cenarioRecomendado: 'Crescimento esperado (+2 servidores físicos)',
      justificativaRecomendacao: 'Considerando o provisionamento de ' + textoUnidade(planejamento.provisionamento, 'mês', 'meses') +
        ', a antecipação evita bloqueios nos próximos meses.',
      planoAcaoImediato: [
        'Revisar distribuição de jogadores em ' + nomeGargalo + '.',
        'Validar orçamento de expansão antes do prazo crítico de decisão.'
      ]
    }
  };
}

function renderizarRelatorio(pacote) {
  var dados = pacote.dados || planejamento;
  var metricas = pacote.metricas || {};
  var analise = pacote.analise || {};

  var selo = document.getElementById('relatorio-selo-origem');
  if (selo) {
    if (pacote.origem === 'ia') {
      selo.textContent = 'Gerado com Google Gemini';
    } else {
      selo.textContent = 'Análise Analítica Local';
    }
  }

  document.getElementById('rel-titulo').textContent = analise.tituloExecutivo || 'Relatório Executivo de Infraestrutura';
  document.getElementById('rel-gestor').textContent = dados.gestor || 'Não informado';
  document.getElementById('rel-plano').textContent = dados.plano || 'Padrão';
  document.getElementById('rel-emissao').textContent = pacote.emitidoEm || new Date().toLocaleString('pt-BR');
  document.getElementById('rel-modelo').textContent = pacote.modelo || 'gemini-3.8-flash';
  document.getElementById('rel-veredito').textContent = analise.vereditoSituacao || '';
  document.getElementById('rel-resumo').textContent = analise.resumoExecutivo || '';
  document.getElementById('rel-financeiro').textContent = analise.analiseFinanceira || '';
  document.getElementById('rel-frota-analise').textContent = analise.analiseFrotaGargalos || '';

  var textoRunwayRel = 'Sem saturação';
  if (metricas.runwayMeses !== null && metricas.runwayMeses !== undefined && metricas.runwayMeses !== Infinity) {
    textoRunwayRel = mesesTexto(Number(metricas.runwayMeses));
  }

  var listaKpis = [
    { rotulo: 'Custo InfraTech', valor: formatarMoeda(dados.custoInfraTech) },
    { rotulo: 'Receita Estimada', valor: formatarMoeda(metricas.receita) },
    { rotulo: 'Lucro Líquido', valor: formatarMoeda(metricas.lucro) },
    { rotulo: 'Margem / ROI', valor: formatarPercentual(metricas.margem, 1) + ' · ' + formatarPercentual(metricas.roi, 1) },
    { rotulo: 'Break-even', valor: formatarNumero(metricas.breakeven) + ' jog.' },
    { rotulo: 'Capacidade Global', valor: formatarNumero(metricas.capacidadeTotal) + ' jog.' },
    { rotulo: 'Runway Global', valor: textoRunwayRel },
    { rotulo: 'Custo Ocioso', valor: formatarMoeda(metricas.custoOciosoTotal) }
  ];

  var kpisHtml = '';
  listaKpis.forEach(function (item) {
    kpisHtml += '<div class="plan-folha__kpi"><span>' + escaparTexto(item.rotulo) + '</span><strong>' + escaparTexto(item.valor) + '</strong></div>';
  });
  document.getElementById('rel-kpis').innerHTML = kpisHtml;

  var servidoresRel = metricas.servidoresDetalhados || [];
  var tabelaHtml = '';
  servidoresRel.forEach(function (srv) {
    tabelaHtml += '<tr>' +
      '<td><strong>' + escaparTexto(srv.nome) + '</strong></td>' +
      '<td>' + escaparTexto(srv.local) + '</td>' +
      '<td>' + escaparTexto(formatarMoeda(srv.custo)) + '</td>' +
      '<td>' + escaparTexto(srv.uso) + '%</td>' +
      '<td>' + escaparTexto(srv.pico) + '%</td>' +
      '<td>' + escaparTexto(formatarMoeda(srv.custoOcioso)) + '</td>' +
      '<td>' + escaparTexto(srv.situacao) + '</td>' +
      '</tr>';
  });
  document.getElementById('rel-tabela-servidores').innerHTML = tabelaHtml;

  var previsoesHtml = '';
  var previsoes = analise.previsoesFuturas || [];
  previsoes.forEach(function (prev) {
    previsoesHtml += '<div class="plan-folha__previsao-card">' +
      '<strong>' + escaparTexto(prev.horizonte) + '</strong>' +
      '<p>' + escaparTexto(prev.previsao) + '</p>' +
      '<p><em>' + escaparTexto(prev.impactoNegocio) + '</em></p>' +
      '</div>';
  });
  document.getElementById('rel-previsoes').innerHTML = previsoesHtml;

  document.getElementById('rel-cenario-recomendado').textContent = 'Cenário recomendado: ' + (analise.cenarioRecomendado || '—');
  document.getElementById('rel-cenario-justificativa').textContent = analise.justificativaRecomendacao || '';

  var insightsHtml = '';
  (analise.insightsEstrategicos || []).forEach(function (item) {
    insightsHtml += '<li>' + escaparTexto(item) + '</li>';
  });
  document.getElementById('rel-insights').innerHTML = insightsHtml;

  var acoesHtml = '';
  (analise.planoAcaoImediato || []).forEach(function (item) {
    acoesHtml += '<li>' + escaparTexto(item) + '</li>';
  });
  document.getElementById('rel-plano-acao').innerHTML = acoesHtml;

  document.getElementById('rel-premissas-rodape').textContent =
    'crescimento ' + formatarNumero(dados.crescimento) + ' jog./mês · ' +
    formatarNumero(dados.capacidadeAtual) + ' jog./servidor · provisionamento ' +
    textoUnidade(dados.provisionamento, 'mês', 'meses') + ' · orçamento ' +
    formatarMoeda(dados.orcamento) + ' · meta ' + dados.metaUso + '% · subutilizado <' + dados.limiteSubutilizado + '%.';
}

function abrirModalRelatorio() {
  document.getElementById('modal-relatorio').hidden = false;
  document.body.style.overflow = 'hidden';
}

function fecharModalRelatorio() {
  document.getElementById('modal-relatorio').hidden = true;
  document.body.style.overflow = '';
}

function gerarRelatorioIA() {
  definirCarregandoRelatorio(true);

  fetch('/planejamento/relatorio', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dados: planejamento, servidores: planejamento.servidores })
  })
    .then(function (resposta) {
      if (!resposta.ok) throw new Error('Falha ao gerar relatório');
      return resposta.json();
    })
    .then(function (pacote) {
      renderizarRelatorio(pacote);
      abrirModalRelatorio();
      if (pacote.origem === 'ia') {
        mostrarToast('Relatório gerado com Google Gemini.', false);
      } else if (pacote.avisoIA) {
        mostrarToast('Motor local usado (' + pacote.avisoIA + ').', true);
      } else {
        mostrarToast('Relatório gerado com motor analítico local.', false);
      }
    })
    .catch(function () {
      renderizarRelatorio(montarRelatorioLocalFallback());
      abrirModalRelatorio();
      mostrarToast('Relatório gerado localmente (servidor indisponível).', false);
    })
    .finally(function () {
      definirCarregandoRelatorio(false);
    });
}

function imprimirRelatorioPDF() {
  window.print();
}

/* ---------- Inicialização ---------- */

document.addEventListener('DOMContentLoaded', function () {
  renderTudo();
  iniciarRelogio();
  carregarPlanejamentoBackend();

  document.getElementById('btn-premissas-topo').addEventListener('click', abrirPremissas);
  document.getElementById('btn-editar-premissas').addEventListener('click', abrirPremissas);
  document.getElementById('btn-fechar-premissas').addEventListener('click', fecharPremissas);
  document.getElementById('btn-cancelar-premissas').addEventListener('click', fecharPremissas);
  document.getElementById('form-premissas').addEventListener('submit', aplicarPremissas);

  document.getElementById('btn-gerar-relatorio').addEventListener('click', gerarRelatorioIA);
  document.getElementById('btn-regerar-relatorio').addEventListener('click', gerarRelatorioIA);
  document.getElementById('btn-imprimir-relatorio').addEventListener('click', imprimirRelatorioPDF);
  document.getElementById('btn-fechar-relatorio').addEventListener('click', fecharModalRelatorio);

  var campoPesquisa = document.getElementById('pesquisa-servidor');
  if (campoPesquisa) {
    campoPesquisa.addEventListener('input', function (evento) {
      termoBuscaServidor = evento.target.value.trim();
      renderServidores();
    });
  }

  document.querySelectorAll('[data-filtro-servidor]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      selecionarFiltroServidor(botao.getAttribute('data-filtro-servidor'));
    });
  });

  document.getElementById('corpo-servidores').addEventListener('click', function (evento) {
    if (evento.target && evento.target.id === 'btn-ver-todos-servidores') {
      termoBuscaServidor = '';
      if (campoPesquisa) campoPesquisa.value = '';
      selecionarFiltroServidor('todos');
    }
  });

  document.querySelector('[data-fechar-premissas]').addEventListener('click', fecharPremissas);
  document.querySelector('[data-fechar-relatorio]').addEventListener('click', fecharModalRelatorio);

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') {
      if (!document.getElementById('modal-premissas').hidden) {
        fecharPremissas();
      }
      if (!document.getElementById('modal-relatorio').hidden) {
        fecharModalRelatorio();
      }
    }
  });
});

/* Deixa os dados acessíveis para inspeção e testes. */
window.InfraTechPlanejamentoFinanceiro = {
  dados: planejamento,
  renderTudo: renderTudo
};
