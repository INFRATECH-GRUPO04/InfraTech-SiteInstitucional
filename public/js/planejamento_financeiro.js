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
  origemTelemetria: 'simulado',
  telemetriaGeradaEm: null,

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
    { nome: 'Crescimento esperado', detalhe: 'Adicionar 2 servidores físicos', adicionais: 2, capacidadeExtra: 0, destaque: true },
    { nome: 'Expansão agressiva', detalhe: 'Adicionar 5 servidores físicos', adicionais: 5, capacidadeExtra: 0 }
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

function el(id) {
  return document.getElementById(id);
}

function definirTexto(id, texto) {
  var elemento = el(id);
  if (elemento) elemento.textContent = texto;
}

function servidorComMaiorUso(lista) {
  var maior = null;
  (lista || []).forEach(function (servidor) {
    if (servidor.semTelemetria || servidor.uso == null) return;
    if (!maior || Number(servidor.uso) > Number(maior.uso)) {
      maior = servidor;
    }
  });
  return maior;
}

function atualizarBotaoEstado(id, ativo, textoAtivo, textoNormal) {
  var botao = el(id);
  if (!botao) return;
  botao.disabled = ativo;
  if (ativo) {
    botao.textContent = textoAtivo;
  } else {
    botao.textContent = textoNormal;
  }
}

function alternarModal(id, abrir) {
  var modal = el(id);
  if (modal) modal.hidden = !abrir;
  if (abrir) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

function listaHtml(itens) {
  return (itens || []).map(function (item) {
    return '<li>' + escaparTexto(item) + '</li>';
  }).join('');
}

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
  if (!servidor || servidor.semTelemetria || servidor.uso == null) return 0;
  var uso = Number(servidor.uso);
  if (uso >= planejamento.metaUso) return 0;
  return (Number(servidor.custo) || 0) * (planejamento.metaUso - uso) / 100;
}

function totaisServidores() {
  var custoTotal = 0;
  var ociosoTotal = 0;
  var somaUso = 0;
  var qtdComTelemetria = 0;

  planejamento.servidores.forEach(function (servidor) {
    custoTotal += Number(servidor.custo) || 0;
    ociosoTotal += custoOcioso(servidor);
    if (!servidor.semTelemetria && servidor.uso != null) {
      somaUso += Number(servidor.uso);
      qtdComTelemetria += 1;
    }
  });

  var usoMedio = null;
  if (qtdComTelemetria > 0) {
    usoMedio = somaUso / qtdComTelemetria;
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
  if (uso == null) {
    return {
      classe: 'sem-dados',
      texto: 'Sem dados',
      prioridade: 4,
      nivel: '4 · Sem dados',
      classePrioridade: 'sem-dados'
    };
  }
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

  definirTexto('kpi-custo', formatarMoeda(planejamento.custoInfraTech));
  definirTexto('kpi-custo-detalhe', 'Plano ' + planejamento.plano + ' · ' + planejamento.servidores.length + ' servidores');

  definirTexto('kpi-receita', formatarMoeda(billing.receita));
  definirTexto('kpi-receita-detalhe', formatarNumero(planejamento.jogadores) + ' jogadores × ' + formatarMoeda(planejamento.ticketMedio, 2));

  var lucro = el('kpi-lucro');
  if (lucro) {
    lucro.textContent = formatarMoeda(billing.lucro);
    lucro.classList.toggle('plan-kpi__valor--positivo', billing.lucro >= 0);
    lucro.classList.toggle('plan-kpi__valor--negativo', billing.lucro < 0);
  }
  definirTexto('kpi-margem', 'Margem de ' + formatarPercentual(billing.margem, 2));

  definirTexto('kpi-roi', formatarPercentual(billing.roi, 2));
  definirTexto('kpi-breakeven', 'Break-even: ' + formatarNumero(billing.breakeven) + ' jogadores');

  definirTexto('economia-estimada', formatarMoeda(planejamento.economiaInfraPropria));
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
  definirTexto('runway-valor', textoRunwayValor);
  var barra = el('runway-barra');
  if (barra) barra.style.width = Math.min(100, percentual).toFixed(1) + '%';
  definirTexto('runway-uso', formatarNumero(planejamento.jogadores) + ' / ' + formatarNumero(capacidadeTotal) + ' jogadores');
  definirTexto('runway-percentual', formatarPercentual(percentual));

  if (runway === Infinity) {
    definirTexto('runway-detalhe', 'Sem crescimento cadastrado; o prazo de decisão não se aplica.');
  } else {
    definirTexto(
      'runway-detalhe',
      'Prazo útil para decidir: ' + mesesTexto(Math.max(0, runway - planejamento.provisionamento)) +
      ' (provisionamento: ' + textoUnidade(planejamento.provisionamento, 'mês', 'meses') + ').'
    );
  }

  var maior = servidorComMaiorUso(planejamento.servidores);
  var usoEl = el('expansao-uso');
  var picoEl = el('expansao-pico');
  var status = el('expansao-status');

  if (maior) {
    var usoMaior = Number(maior.uso) || 0;
    var picoMaior = Number(maior.pico) || usoMaior;
    definirTexto('expansao-servidor', maior.nome);
    definirTexto('expansao-local', maior.local);

    var situacao = situacaoServidor(usoMaior);
    if (status) {
      if (usoMaior >= planejamento.metaUso) {
        status.textContent = 'Gargalo local';
      } else {
        status.textContent = situacao.texto;
      }
      status.className = 'plan-situacao plan-situacao--' + situacao.classe;
    }

    if (usoEl) {
      usoEl.textContent = usoMaior + '%';
      usoEl.classList.toggle('plan-expansao-metrica__valor--alerta', usoMaior >= planejamento.metaUso);
    }
    if (picoEl) {
      picoEl.textContent = picoMaior + '%';
      picoEl.classList.toggle('plan-expansao-metrica__valor--alerta', picoMaior >= planejamento.metaUso);
    }
    definirTexto('expansao-custo', formatarMoeda(maior.custo));
    if (usoMaior >= planejamento.metaUso) {
      definirTexto('expansao-nota', 'Acima da meta de uso (' + planejamento.metaUso + '%) — prioridade de balanceamento ou expansão.');
    } else {
      definirTexto('expansao-nota', 'Servidor com maior pressão de uso no período analisado (meta: ' + planejamento.metaUso + '%).');
    }
  } else {
    definirTexto('expansao-servidor', '—');
    definirTexto('expansao-local', 'Sem servidores ativos');
    if (status) {
      status.textContent = 'Sem dados';
      status.className = 'plan-situacao';
    }
    if (usoEl) {
      usoEl.textContent = '—';
      usoEl.classList.remove('plan-expansao-metrica__valor--alerta');
    }
    if (picoEl) {
      picoEl.textContent = '—';
      picoEl.classList.remove('plan-expansao-metrica__valor--alerta');
    }
    definirTexto('expansao-custo', '—');
    definirTexto('expansao-nota', 'Nenhum servidor ativo cadastrado.');
  }

  if (planejamento.origemTelemetria === 's3_gold') {
    var onlineCount = planejamento.servidores.filter(function (s) {
      return s.conexao === 'online';
    }).length;
    definirTexto('fisicos-online', onlineCount + '/' + planejamento.servidores.length);
  } else {
    definirTexto('fisicos-online', planejamento.servidores.length);
  }
}

function prepararServidoresPriorizados() {
  var lista = planejamento.servidores.map(function (servidor) {
    var semTelemetria = Boolean(servidor.semTelemetria) || servidor.uso == null;
    var uso = null;
    if (!semTelemetria) {
      uso = Number(servidor.uso);
    }
    var ocioso = custoOcioso(servidor);
    var situacao = situacaoServidor(uso);
    return {
      nome: servidor.nome,
      local: servidor.local || '-',
      custo: Number(servidor.custo) || 0,
      uso: uso,
      semTelemetria: semTelemetria,
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
    var usoA = -1;
    if (a.uso != null) usoA = a.uso;
    var usoB = -1;
    if (b.uso != null) usoB = b.uso;
    if (usoB !== usoA) {
      return usoB - usoA;
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

  Object.keys(contadores).forEach(function (chave) {
    definirTexto('cont-filtro-' + chave, contadores[chave]);
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

      var usoCelula = 'Sem dados';
      var ociosoCelula = '—';
      if (!item.semTelemetria && item.uso != null) {
        usoCelula = item.uso + '%';
        ociosoCelula = formatarMoeda(item.ocioso);
      }

      html += '<tr>' +
        '<td><span class="plan-prioridade plan-prioridade--' + item.situacao.classePrioridade + '">' + item.situacao.nivel + '</span></td>' +
        '<td><strong>' + escaparTexto(item.nome) + '</strong><span class="plan-servidor-local">' + escaparTexto(item.local) + '</span></td>' +
        '<td class="plan-tabela__valor">' + formatarMoeda(item.custo) + '</td>' +
        '<td class="plan-tabela__valor">' + usoCelula + '</td>' +
        '<td class="' + classeOcioso + '">' + ociosoCelula + '</td>' +
        '<td><span class="plan-situacao plan-situacao--' + item.situacao.classe + '">' + item.situacao.texto + '</span></td>' +
        '</tr>';
    });
  }

  var rotuloTotal = 'Total da frota (' + priorizados.length + ')';
  if (visiveis.length !== priorizados.length) {
    rotuloTotal = 'Total da frota (' + visiveis.length + ' de ' + priorizados.length + ' exibidos)';
  }

  var usoMedioTexto = 'Sem dados';
  if (totais.usoMedio != null) {
    usoMedioTexto = formatarPercentual(totais.usoMedio);
  }

  html += '<tr class="plan-tabela__total">' +
    '<td>—</td>' +
    '<td>' + rotuloTotal + '</td>' +
    '<td>' + formatarMoeda(totais.custoTotal) + '</td>' +
    '<td>' + usoMedioTexto + '</td>' +
    '<td>' + formatarMoeda(totais.ociosoTotal) + ' (' + formatarPercentual(totais.percentualOcioso) + ')</td>' +
    '<td>—</td>' +
    '</tr>';

  corpo.innerHTML = html;
}

function calcularCenarios(dados) {
  var base = dados || planejamento;
  var listaServidores = base.servidores || [];
  var baseServidores = listaServidores.length;

  return planejamento.cenarios.map(function (cenario) {
    var servidoresTotais = baseServidores + cenario.adicionais;
    var capacidadeAdicional = cenario.adicionais * base.capacidadeNova + cenario.capacidadeExtra;
    var capacidadeTotal = baseServidores * base.capacidadeAtual + capacidadeAdicional;
    var custoMensalAdicional = cenario.adicionais * base.custoNovoServidor;
    var custoImplantacao = cenario.adicionais * base.custoImplantacao;

    var prazoEntrega = cenario.prazo;
    if (cenario.adicionais > 0) {
      if (base.provisionamento > 0) {
        prazoEntrega = textoUnidade(base.provisionamento, 'mês', 'meses');
      } else {
        prazoEntrega = 'Imediato';
      }
    }

    var runway = null;
    if (base.crescimento > 0) {
      runway = Number(Math.max(0, (capacidadeTotal - base.jogadores) / base.crescimento).toFixed(1));
    }

    return {
      nome: cenario.nome,
      detalhe: cenario.detalhe,
      adicionais: cenario.adicionais,
      servidoresTotais: servidoresTotais,
      capacidadeTotal: capacidadeTotal,
      capacidadeAdicional: capacidadeAdicional,
      custoMensalAdicional: custoMensalAdicional,
      custoImplantacao: custoImplantacao,
      prazoEntrega: prazoEntrega,
      runwayMeses: runway
    };
  });
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
  definirTexto('nome-gestor', planejamento.gestor);
  definirTexto('data-cadastro', planejamento.data);
  definirTexto('modal-data', planejamento.data);

  definirTexto(
    'resumo-premissas',
    'crescimento ' + formatarNumero(planejamento.crescimento) + ' jogadores/mês · ' +
    formatarNumero(planejamento.capacidadeAtual) + ' jogadores por servidor · provisionamento ' +
    textoUnidade(planejamento.provisionamento, 'mês', 'meses') +
    ' · meta de uso ' + planejamento.metaUso + '% · novo servidor ' +
    formatarMoeda(planejamento.custoNovoServidor) + '/mês + ' +
    formatarMoeda(planejamento.custoImplantacao) + ' de implantação.'
  );

  definirTexto('limite-saturado', planejamento.metaUso);
  definirTexto('limite-normal', Math.max(0, planejamento.metaUso - 1));
  document.querySelectorAll('.limite-subutilizado-nota').forEach(function (item) {
    item.textContent = planejamento.limiteSubutilizado;
  });
}

function renderTudo() {
  renderBilling();
  renderCards();
  renderServidores();
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
  planejamento.origemTelemetria = dados.origemTelemetria || 'simulado';
  planejamento.telemetriaGeradaEm = dados.telemetriaGeradaEm || null;

  var usandoGold = planejamento.origemTelemetria === 's3_gold';

  planejamento.servidores = servidoresRecebidos.map(function (servidor, indice) {
    var semTelemetria = Boolean(servidor.semTelemetria);
    var uso = null;
    var pico = null;

    if (usandoGold) {
      if (!semTelemetria && servidor.uso != null) {
        uso = Number(servidor.uso);
        pico = uso;
        if (servidor.pico != null) {
          pico = Number(servidor.pico);
        }
      } else {
        semTelemetria = true;
      }
    } else {
      var referencia = USOS_ILUSTRATIVOS[indice] || { uso: 0, pico: 0 };
      uso = referencia.uso;
      if (servidor.uso != null) {
        uso = Number(servidor.uso);
      }
      pico = referencia.pico;
      if (servidor.pico != null) {
        pico = Number(servidor.pico);
      }
    }

    return {
      idServidor: servidor.idServidor || null,
      nome: servidor.nome,
      local: servidor.local || '-',
      custo: Number(servidor.custo) || 0,
      uso: uso,
      pico: pico,
      ramMedia: servidor.ramMedia,
      discoMedio: servidor.discoMedio,
      conexao: servidor.conexao || 'simulado',
      semTelemetria: semTelemetria
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
  var seloUso = el('selo-uso-servidores');
  var subtituloServidores = el('subtitulo-servidores');
  var usandoGold = conectadoAoBanco && planejamento.origemTelemetria === 's3_gold';

  if (seloUso) {
    seloUso.classList.toggle('plan-selo-simulado--gold', usandoGold);
    if (usandoGold) {
      seloUso.textContent = 'Telemetria S3 · 30d';
      seloUso.title = 'Uso médio e pico calculados a partir da camada Gold (03-gold/)';
    } else {
      seloUso.textContent = 'Uso simulado';
      seloUso.title = 'Métricas de uso e pico são simuladas até a integração com 03-gold';
    }
  }

  if (subtituloServidores) {
    if (usandoGold) {
      subtituloServidores.textContent = 'Custo mensal (banco) · uso médio real de CPU (S3 Gold · 30 dias) · ordenado por prioridade.';
    } else {
      subtituloServidores.textContent = 'Custo mensal (cadastro do gestor) · uso médio simulado (30 dias) · ordenado por prioridade.';
    }
  }

  if (!aviso) return;
  aviso.hidden = false;
  if (usandoGold) {
    aviso.classList.add('plan-aviso--banco');
    aviso.innerHTML = '<strong>Origem dos dados:</strong> custos, histórico e premissas vêm do ' +
      '<strong>banco de dados</strong>; uso médio e pico (30 dias) vêm da <strong>telemetria S3 (camada Gold)</strong>; ' +
      'quantidade de jogadores e receita estimada utilizam <strong>dados simulados</strong>.';
  } else if (conectadoAoBanco) {
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
  atualizarBotaoEstado('btn-salvar-premissas', salvando, 'Salvando...', 'Aplicar e recalcular');
  var btnCancelar = el('btn-cancelar-premissas');
  if (btnCancelar) btnCancelar.disabled = salvando;
}

function abrirPremissas() {
  preencherFormulario();
  definirErroModal('');
  definirSalvandoModal(false);
  alternarModal('modal-premissas', true);
  var campoInicial = el('premissa-capacidade-atual');
  if (campoInicial) campoInicial.focus();
}

function fecharPremissas() {
  definirErroModal('');
  definirSalvandoModal(false);
  alternarModal('modal-premissas', false);
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
  atualizarBotaoEstado('btn-gerar-relatorio', carregando, 'Analisando com IA...', 'Gerar relatório IA');
  atualizarBotaoEstado('btn-regerar-relatorio', carregando, 'Analisando...', 'Regerar análise');
}

function montarRelatorioLocalFallback() {
  var billing = dadosBilling();
  var totais = totaisServidores();
  var capacidadeTotal = planejamento.servidores.length * planejamento.capacidadeAtual;
  var runway = runwayMeses(capacidadeTotal);
  var servidoresDetalhados = planejamento.servidores.map(function (srv) {
    var semTelemetria = Boolean(srv.semTelemetria) || srv.uso == null;
    var uso = null;
    var pico = null;
    if (!semTelemetria) {
      uso = Number(srv.uso);
      pico = uso;
      if (srv.pico != null) {
        pico = Number(srv.pico);
      }
    }
    return {
      idServidor: srv.idServidor || null,
      nome: srv.nome,
      local: srv.local || '-',
      custo: Number(srv.custo) || 0,
      uso: uso,
      pico: pico,
      semTelemetria: semTelemetria,
      custoOcioso: custoOcioso(srv),
      situacao: situacaoServidor(uso).texto
    };
  });

  var maior = servidorComMaiorUso(servidoresDetalhados);
  var nomeGargalo = 'Nenhum servidor';
  if (maior) nomeGargalo = maior.nome;

  var projecoes = [1, 3, 6].map(function (meses) {
    var previstos = planejamento.jogadores + planejamento.crescimento * meses;
    var ocupacaoPrevista = 0;
    if (capacidadeTotal > 0) {
      ocupacaoPrevista = (previstos / capacidadeTotal) * 100;
    }
    var excedenteCapacidade = Math.max(0, previstos - capacidadeTotal);
    var unidadeMes = ' meses';
    if (meses === 1) unidadeMes = ' mês';
    var impacto = 'Capacidade global suficiente, monitorando picos em ' + nomeGargalo + '.';
    if (excedenteCapacidade > 0) {
      impacto = 'Demanda prevista supera a capacidade atual em ' + formatarNumero(excedenteCapacidade) +
        ' jogadores (' + ocupacaoPrevista.toFixed(1) + '% de ocupação), exigindo expansão prévia.';
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
      servidoresDetalhados: servidoresDetalhados,
      cenarios: calcularCenarios(planejamento)
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
        ', a antecipação evita saturação da capacidade nos próximos meses.',
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

  if (pacote.origem === 'ia') {
    definirTexto('relatorio-selo-origem', 'Gerado com Google Gemini');
  } else {
    definirTexto('relatorio-selo-origem', 'Análise Analítica Local');
  }

  definirTexto('rel-titulo', analise.tituloExecutivo || 'Relatório Executivo de Infraestrutura');
  definirTexto('rel-gestor', dados.gestor || 'Não informado');
  definirTexto('rel-plano', dados.plano || 'Padrão');
  definirTexto('rel-emissao', pacote.emitidoEm || new Date().toLocaleString('pt-BR'));
  definirTexto('rel-modelo', pacote.modelo || 'gemini-3.8-flash');
  definirTexto('rel-veredito', analise.vereditoSituacao || '');
  definirTexto('rel-resumo', analise.resumoExecutivo || '');
  definirTexto('rel-financeiro', analise.analiseFinanceira || '');
  definirTexto('rel-frota-analise', analise.analiseFrotaGargalos || '');

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

  el('rel-kpis').innerHTML = listaKpis.map(function (item) {
    return '<div class="plan-folha__kpi"><span>' + escaparTexto(item.rotulo) + '</span><strong>' + escaparTexto(item.valor) + '</strong></div>';
  }).join('');

  el('rel-tabela-servidores').innerHTML = (metricas.servidoresDetalhados || []).map(function (srv) {
    var usoRel = 'Sem dados';
    var picoRel = 'Sem dados';
    var ociosoRel = '—';
    if (!srv.semTelemetria && srv.uso != null) {
      usoRel = escaparTexto(srv.uso) + '%';
      if (srv.pico != null) {
        picoRel = escaparTexto(srv.pico) + '%';
      } else {
        picoRel = usoRel;
      }
      ociosoRel = escaparTexto(formatarMoeda(srv.custoOcioso));
    }

    return '<tr>' +
      '<td><strong>' + escaparTexto(srv.nome) + '</strong></td>' +
      '<td>' + escaparTexto(srv.local) + '</td>' +
      '<td>' + escaparTexto(formatarMoeda(srv.custo)) + '</td>' +
      '<td>' + usoRel + '</td>' +
      '<td>' + picoRel + '</td>' +
      '<td>' + ociosoRel + '</td>' +
      '<td>' + escaparTexto(srv.situacao) + '</td>' +
      '</tr>';
  }).join('');

  el('rel-previsoes').innerHTML = (analise.previsoesFuturas || []).map(function (prev) {
    return '<div class="plan-folha__previsao-card">' +
      '<strong>' + escaparTexto(prev.horizonte) + '</strong>' +
      '<p>' + escaparTexto(prev.previsao) + '</p>' +
      '<p><em>' + escaparTexto(prev.impactoNegocio) + '</em></p>' +
      '</div>';
  }).join('');

  var cenariosRel = metricas.cenarios;
  if (!Array.isArray(cenariosRel) || cenariosRel.length === 0) {
    cenariosRel = calcularCenarios(dados);
  }
  var recomendadoTexto = String(analise.cenarioRecomendado || '').toLowerCase();
  var tabelaCenarios = el('rel-tabela-cenarios');
  if (tabelaCenarios) {
    tabelaCenarios.innerHTML = cenariosRel.map(function (cenario) {
      var classeLinha = '';
      if (recomendadoTexto && recomendadoTexto.indexOf(String(cenario.nome || '').toLowerCase()) !== -1) {
        classeLinha = ' class="plan-folha__linha--destaque"';
      }

      var servidoresTexto = formatarNumero(cenario.servidoresTotais);
      if (cenario.adicionais > 0) {
        servidoresTexto = cenario.servidoresTotais + ' (+' + cenario.adicionais + ')';
      }

      var capacidadeTexto = formatarNumero(cenario.capacidadeTotal);
      if (cenario.capacidadeAdicional > 0) {
        capacidadeTexto += ' (+' + formatarNumero(cenario.capacidadeAdicional) + ')';
      }

      var custoAdicionalTexto = 'R$ 0/mês';
      if (cenario.custoMensalAdicional > 0) {
        custoAdicionalTexto = '+ ' + formatarMoeda(cenario.custoMensalAdicional) + '/mês';
      }

      var runwayCenarioTexto = 'Sem saturação prevista';
      if (cenario.runwayMeses !== null && cenario.runwayMeses !== undefined) {
        if (Number(cenario.runwayMeses) <= 0) {
          runwayCenarioTexto = 'Capacidade esgotada';
        } else {
          runwayCenarioTexto = mesesTexto(Number(cenario.runwayMeses));
        }
      }

      return '<tr' + classeLinha + '>' +
        '<td><strong>' + escaparTexto(cenario.nome) + '</strong><small>' + escaparTexto(cenario.detalhe) + '</small></td>' +
        '<td>' + escaparTexto(servidoresTexto) + '</td>' +
        '<td>' + escaparTexto(capacidadeTexto) + '</td>' +
        '<td>' + escaparTexto(custoAdicionalTexto) + '</td>' +
        '<td>' + escaparTexto(formatarMoeda(cenario.custoImplantacao)) + '</td>' +
        '<td>' + escaparTexto(cenario.prazoEntrega) + '</td>' +
        '<td>' + escaparTexto(runwayCenarioTexto) + '</td>' +
        '</tr>';
    }).join('');
  }

  definirTexto('rel-cenario-recomendado', 'Cenário recomendado: ' + (analise.cenarioRecomendado || '—'));
  definirTexto('rel-cenario-justificativa', analise.justificativaRecomendacao || '');
  el('rel-insights').innerHTML = listaHtml(analise.insightsEstrategicos);
  el('rel-plano-acao').innerHTML = listaHtml(analise.planoAcaoImediato);

  definirTexto(
    'rel-premissas-rodape',
    'crescimento ' + formatarNumero(dados.crescimento) + ' jog./mês · ' +
    formatarNumero(dados.capacidadeAtual) + ' jog./servidor · provisionamento ' +
    textoUnidade(dados.provisionamento, 'mês', 'meses') + ' · orçamento ' +
    formatarMoeda(dados.orcamento) + ' · meta ' + dados.metaUso + '% · subutilizado <' + dados.limiteSubutilizado + '%.'
  );
}

function abrirModalRelatorio() {
  alternarModal('modal-relatorio', true);
}

function fecharModalRelatorio() {
  alternarModal('modal-relatorio', false);
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

/* ---------- Inicialização ---------- */

document.addEventListener('DOMContentLoaded', function () {
  renderTudo();
  iniciarRelogio();
  carregarPlanejamentoBackend();

  el('btn-premissas-topo').addEventListener('click', abrirPremissas);
  el('btn-editar-premissas').addEventListener('click', abrirPremissas);
  el('btn-fechar-premissas').addEventListener('click', fecharPremissas);
  el('btn-cancelar-premissas').addEventListener('click', fecharPremissas);
  el('form-premissas').addEventListener('submit', aplicarPremissas);

  el('btn-gerar-relatorio').addEventListener('click', gerarRelatorioIA);
  var btnRelatorioRodape = el('btn-relatorio-rodape');
  if (btnRelatorioRodape) btnRelatorioRodape.addEventListener('click', gerarRelatorioIA);
  el('btn-regerar-relatorio').addEventListener('click', gerarRelatorioIA);
  el('btn-imprimir-relatorio').addEventListener('click', function () { window.print(); });
  el('btn-fechar-relatorio').addEventListener('click', fecharModalRelatorio);

  var campoPesquisa = el('pesquisa-servidor');
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

  el('corpo-servidores').addEventListener('click', function (evento) {
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
      if (!el('modal-premissas').hidden) fecharPremissas();
      if (!el('modal-relatorio').hidden) fecharModalRelatorio();
    }
  });
});

/* Deixa os dados acessíveis para inspeção e testes. */
window.InfraTechPlanejamentoFinanceiro = {
  dados: planejamento,
  renderTudo: renderTudo
};
