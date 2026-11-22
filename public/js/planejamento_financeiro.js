/*
 * Controla a página Planejamento Financeiro & Billing.
 * Nesta fase os números vêm de um objeto local (dados ilustrativos). Quando o
 * backend estiver pronto, basta trocar o objeto pelas respostas das rotas.
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
var nomesMeses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* ---------- Formatação ---------- */

function formatarMoeda(valor, casas) {
  var decimais = casas === undefined ? 0 : casas;
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  });
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function formatarPercentual(valor, casas) {
  var decimais = casas === undefined ? 1 : casas;
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  }) + '%';
}

function mesesTexto(meses) {
  var inteiros = Math.floor(meses);
  var semanas = Math.round((meses - inteiros) * 4);
  if (semanas >= 4) {
    inteiros += 1;
    semanas = 0;
  }
  var texto = inteiros + (inteiros === 1 ? ' mês' : ' meses');
  if (semanas > 0) texto += ' e ' + semanas + (semanas === 1 ? ' semana' : ' semanas');
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

  return {
    custoTotal: custoTotal,
    ociosoTotal: ociosoTotal,
    usoMedio: planejamento.servidores.length ? somaUso / planejamento.servidores.length : 0,
    percentualOcioso: custoTotal > 0 ? (ociosoTotal / custoTotal) * 100 : 0
  };
}

function dadosBilling() {
  var receita = planejamento.jogadores * planejamento.ticketMedio;
  var lucro = receita - planejamento.custoInfraTech;
  var margem = receita > 0 ? (lucro / receita) * 100 : 0;
  var roi = planejamento.custoInfraTech > 0 ? (lucro / planejamento.custoInfraTech) * 100 : 0;
  var breakeven = planejamento.ticketMedio > 0 ? Math.ceil(planejamento.custoInfraTech / planejamento.ticketMedio) : 0;

  return {
    receita: receita,
    lucro: lucro,
    margem: margem,
    roi: roi,
    breakeven: breakeven
  };
}

function situacaoServidor(uso) {
  if (uso >= planejamento.metaUso) return { classe: 'saturado', texto: 'Saturado' };
  if (uso < planejamento.limiteSubutilizado) return { classe: 'subutilizado', texto: 'Subutilizado' };
  return { classe: 'normal', texto: 'Normal' };
}

function runwayMeses(capacidade) {
  if (planejamento.crescimento <= 0) return capacidade > planejamento.jogadores ? Infinity : 0;
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
  var percentual = capacidadeTotal > 0 ? (planejamento.jogadores / capacidadeTotal) * 100 : 0;

  document.getElementById('runway-valor').textContent =
    runway === Infinity ? 'Sem saturação prevista' : runway > 0 ? mesesTexto(runway) : 'Capacidade esgotada';
  document.getElementById('runway-barra').style.width = Math.min(100, percentual).toFixed(1) + '%';
  document.getElementById('runway-uso').textContent =
    formatarNumero(planejamento.jogadores) + ' / ' + formatarNumero(capacidadeTotal) + ' jogadores';
  document.getElementById('runway-percentual').textContent = formatarPercentual(percentual);
  document.getElementById('runway-detalhe').textContent = runway === Infinity
    ? 'Sem crescimento cadastrado; o prazo de decisão não se aplica.'
    : 'Prazo útil para decidir: ' + mesesTexto(Math.max(0, runway - planejamento.provisionamento)) +
      ' (provisionamento: ' + planejamento.provisionamento +
      (planejamento.provisionamento === 1 ? ' mês' : ' meses') + ').';

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
    status.textContent = usoMaior >= planejamento.metaUso ? 'Gargalo local' : situacao.texto;
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

function renderServidores() {
  var corpo = document.getElementById('corpo-servidores');
  var totais = totaisServidores();
  var html = '';

  planejamento.servidores.forEach(function (servidor) {
    var uso = Number(servidor.uso) || 0;
    var ocioso = custoOcioso(servidor);
    var situacao = situacaoServidor(uso);

    html += '<tr>' +
      '<td><strong>' + servidor.nome + '</strong></td>' +
      '<td class="plan-tabela__valor">' + formatarMoeda(servidor.custo) + '</td>' +
      '<td class="plan-tabela__valor">' + uso + '%</td>' +
      '<td class="' + (ocioso > 0 ? 'plan-tabela__destaque' : 'plan-tabela__zero') + '">' +
        formatarMoeda(ocioso) +
      '</td>' +
      '<td><span class="plan-situacao plan-situacao--' + situacao.classe + '">' + situacao.texto + '</span></td>' +
      '</tr>';
  });

  html += '<tr class="plan-tabela__total">' +
    '<td>Total</td>' +
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
    var classe = cenario.destaque ? 'plan-tabela__linha--destaque' : '';
    var nome = cenario.destaque
      ? '<span class="plan-tabela__cenario-nome">' + cenario.nome + '</span>'
      : cenario.nome;
    var servidoresTexto = cenario.adicionais > 0
      ? servidores + ' (+' + cenario.adicionais + ')'
      : formatarNumero(servidores);
    var capacidadeTexto = formatarNumero(capacidade) +
      (adicionalCapacidade > 0 ? ' (+' + formatarNumero(adicionalCapacidade) + ')' : '');

    html += '<tr class="' + classe + '">' +
      '<td>' + nome + '<small>' + cenario.detalhe + '</small></td>' +
      '<td class="plan-tabela__valor">' + servidoresTexto + '</td>' +
      '<td class="plan-tabela__valor">' + capacidadeTexto + '</td>' +
      '<td class="plan-tabela__valor">' +
        (custoMensal > 0 ? '+ ' + formatarMoeda(custoMensal) + '/mês' : 'R$ 0/mês') +
      '</td>' +
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
    return indice === valores.length - 1 ? 'rgba(0, 207, 255, 0.35)' : 'rgba(0, 207, 255, 0.85)';
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
          labels: { color: '#a6b7c7', boxWidth: 12, font: { size: 10 } }
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
          ticks: { color: '#8da1b3', font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#8da1b3',
            font: { size: 10 },
            callback: function (valor) { return formatarMoeda(valor); }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });

  var ultimo = valores[valores.length - 1] || 0;
  var percentual = planejamento.orcamento > 0 ? (ultimo / planejamento.orcamento) * 100 : 0;

  document.getElementById('projecao-orcamento').textContent =
    'Projeção de ' + labels[labels.length - 1] + ': ' + formatarMoeda(ultimo) +
    ' (' + percentual.toFixed(0) + '% do orçamento)';
  document.getElementById('texto-orcamento').textContent = formatarMoeda(planejamento.orcamento);
}

function renderPremissasResumo() {
  document.getElementById('nome-gestor').textContent = planejamento.gestor;
  document.getElementById('data-cadastro').textContent = planejamento.data;
  document.getElementById('modal-data').textContent = planejamento.data;

  document.getElementById('resumo-premissas').textContent =
    'crescimento ' + formatarNumero(planejamento.crescimento) + ' jogadores/mês · ' +
    formatarNumero(planejamento.capacidadeAtual) + ' jogadores por servidor · provisionamento ' +
    planejamento.provisionamento + (planejamento.provisionamento === 1 ? ' mês' : ' meses') +
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

function abrirPremissas() {
  preencherFormulario();
  document.getElementById('modal-premissas').hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('premissa-capacidade-atual').focus();
}

function fecharPremissas() {
  document.getElementById('modal-premissas').hidden = true;
  document.body.style.overflow = '';
}

function lerNumero(id, padrao) {
  var valor = parseFloat(document.getElementById(id).value);
  return isNaN(valor) ? padrao : valor;
}

function aplicarPremissas(evento) {
  evento.preventDefault();

  CAMPOS_PREMISSAS.forEach(function (campo) {
    var valor = Math.max(campo.min, lerNumero(campo.id, planejamento[campo.chave]));
    if (campo.max !== undefined) valor = Math.min(campo.max, valor);
    planejamento[campo.chave] = valor;
  });

  renderTudo();
  fecharPremissas();
  mostrarToast();
}

function mostrarToast() {
  var toast = document.getElementById('toast-premissas');
  toast.hidden = false;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 3200);
}

/* ---------- Inicialização ---------- */

document.addEventListener('DOMContentLoaded', function () {
  renderTudo();
  iniciarRelogio();

  document.getElementById('btn-premissas-topo').addEventListener('click', abrirPremissas);
  document.getElementById('btn-editar-premissas').addEventListener('click', abrirPremissas);
  document.getElementById('btn-fechar-premissas').addEventListener('click', fecharPremissas);
  document.getElementById('btn-cancelar-premissas').addEventListener('click', fecharPremissas);
  document.getElementById('form-premissas').addEventListener('submit', aplicarPremissas);

  document.querySelector('[data-fechar-premissas]').addEventListener('click', fecharPremissas);

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && !document.getElementById('modal-premissas').hidden) {
      fecharPremissas();
    }
  });
});

/* Deixa os dados acessíveis para uma futura integração com o backend. */
window.InfraTechPlanejamentoFinanceiro = {
  dados: planejamento,
  renderTudo: renderTudo
};
