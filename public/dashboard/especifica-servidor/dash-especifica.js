const dadosDashboard = window.InfraTechDashboardData;
const parametrosDashboard = new URLSearchParams(window.location.search);
const servidorIdSolicitado = parametrosDashboard.get('servidor') || sessionStorage.SERVIDOR_DASHBOARD_SELECIONADO || 'SRV-BR-01';
const servidorSelecionado = dadosDashboard.obterServidorPorId(servidorIdSolicitado) || dadosDashboard.obterServidorPorId('SRV-BR-01');
sessionStorage.SERVIDOR_DASHBOARD_SELECIONADO = servidorSelecionado.id;
const historicoServidor = dadosDashboard.obterHistoricoServidor(servidorSelecionado.id);
const historicoRedeServidor = dadosDashboard.obterHistoricoRedeServidor(servidorSelecionado.id)
  || (dadosDashboard.rede.escopo === servidorSelecionado.id ? dadosDashboard.rede : null);
const CORES_SEVERIDADE = { saudavel: '#22c55e', atencao: '#f59e0b', critico: '#ef4444', 'sem-dados': '#94a3b8' };
let limitesAtuais = window.InfraTechAlertas.obter(servidorSelecionado.id);
const horasRecursos = historicoServidor?.horas || [];
const recursos = {
  cpu: { label: 'CPU', data: historicoServidor?.cpu || [], color: '#25AFC0', titulo: 'Uso de CPU — 24h', subtitulo: 'Utilização do processador ao longo do dia' },
  disco: { label: 'Disco', data: historicoServidor?.disco || [], color: '#20A881', titulo: 'Uso de Disco — 24h', subtitulo: 'Utilização do armazenamento ao longo do dia' },
  ram: { label: 'RAM', data: historicoServidor?.ram || [], color: '#8050C7', titulo: 'Uso de RAM — 24h', subtitulo: 'Utilização da memória ao longo do dia' }
};

function criarDatasetRecurso(recurso) {
  return { label: recurso.label, data: recurso.data, borderColor: recurso.color, backgroundColor: recurso.color,
    borderWidth: 2, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 };
}

const abasRecursos = [...document.querySelectorAll('.aba-recurso')];
const tituloGraficoRecursos = document.getElementById('tituloGraficoRecursos');
const subtituloGraficoRecursos = document.getElementById('subtituloGraficoRecursos');
const painelGraficoRecursos = document.getElementById('graficoRecursosPainel');
const ctxrecursos = document.getElementById('graficoRecursos').getContext('2d');

const graficoRecursos = new Chart(ctxrecursos, {
  type: 'line',
  data: {
    labels: horasRecursos,
    datasets: [recursos.cpu, recursos.ram, recursos.disco].map(criarDatasetRecurso)
  },
  options: {
    responsive: true,
    maintainAspectRatio: false, // preenche toda a largura e altura do container
    interaction: {
      intersect: false, // não precisa colocar o mouse exatamente em cima da bolinha para ela aparecer
      mode: 'index' // mostra as 3 bolinhas juntas
    },
    plugins: {
      legend: { // bolinhas da legenda
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      annotation: {
        annotations: {
          linhaAtencao: {
            type: 'line',
            yMin: 70,
            yMax: 70,
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderDash: [4, 4],   //tracejado
            label: {
              display: false,
              content: 'Atenção',
              position: 'end',
              backgroundColor: 'transparent',
              color: '#f59e0b',
              font: { size: 10 },
              yAdjust: -10,
            }
          },
          linhaCritica: {
            type: 'line', yMin: 85, yMax: 85, borderColor: '#ef4444', borderWidth: 1.5, borderDash: [4, 4],
            label: { display: false, content: 'Crítico', position: 'end', backgroundColor: 'transparent', color: '#ef4444', font: { size: 10 }, yAdjust: -10 }
          }
        }
      },
      tooltip: {
        callbacks: {
          title: (itens) => `${itens[0]?.label || 'Horário'} · leitura registrada`,
          label: (contexto) => {
            const recurso = contexto.dataset.label.toLowerCase();
            const valor = contexto.parsed.y;
            const estado = window.InfraTechAlertas.classificar(recurso, valor, servidorSelecionado.id);
            const limite = window.InfraTechAlertas.obter(servidorSelecionado.id)[recurso];
            return ` ${contexto.dataset.label}: ${valor}% · leitura ${estado} · atenção ${limite.atencao}% · crítico ${limite.critico}%`;
          }
        }
      }
    },
    scales: {
      x: { //eixo x
        grid: {
          display: false // esconde linhas verticais
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      },
      y: { //eixo y
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: '#94a3b8',
          callback: function(val) {
            return val + '%'; // adiciona o '%' no eixo Y
          }
        },
        grid: {
          color: '#f1f5f9'
        }
      }
    }
  }
});

function selecionarRecurso(aba) {
  const chave = aba.dataset.recurso;
  const visaoGeral = chave === 'geral';

  abasRecursos.forEach((item) => {
    const selecionada = item === aba;
    item.classList.toggle('ativa', selecionada);
    item.setAttribute('aria-selected', String(selecionada));
    item.tabIndex = selecionada ? 0 : -1;
  });

  painelGraficoRecursos.setAttribute('aria-labelledby', aba.id);
  const possuiHistoricoRecurso = Boolean(historicoServidor?.horas?.length);
  tituloGraficoRecursos.textContent = visaoGeral
    ? (possuiHistoricoRecurso ? 'Uso de Recursos — 24h' : 'Leituras atuais dos recursos')
    : (possuiHistoricoRecurso ? recursos[chave].titulo : `Uso de ${recursos[chave].label} — leitura atual`);
  subtituloGraficoRecursos.textContent = visaoGeral
    ? historicoServidor ? 'CPU, RAM e Disco · leitura por horário · estados são leitura, não confirmação de incidente' : 'Sem histórico por recurso para este servidor.'
    : (possuiHistoricoRecurso ? recursos[chave].subtitulo : `Série temporal não disponível para ${servidorSelecionado.id}.`);
  graficoRecursos.data.datasets = visaoGeral
    ? [recursos.cpu, recursos.ram, recursos.disco].map(criarDatasetRecurso)
    : [criarDatasetRecurso(recursos[chave])];
  graficoRecursos.options.plugins.legend.display = visaoGeral;
  graficoRecursos.options.plugins.tooltip.enabled = (visaoGeral ? horasRecursos.length > 0 : recursos[chave].data.length > 0);
  const faixa = visaoGeral ? null : limitesAtuais[chave];
  const annotations = graficoRecursos.options.plugins.annotation.annotations;
  annotations.linhaAtencao.yMin = annotations.linhaAtencao.yMax = faixa ? faixa.atencao : 70;
  annotations.linhaCritica.yMin = annotations.linhaCritica.yMax = faixa ? faixa.critico : 85;
  annotations.linhaAtencao.label.display = !visaoGeral;
  annotations.linhaCritica.label.display = !visaoGeral;
  annotations.linhaAtencao.label.content = faixa ? `Atenção ${faixa.atencao}%` : '';
  annotations.linhaCritica.label.content = faixa ? `Crítico ${faixa.critico}%` : '';
  graficoRecursos.update();
}

function atualizarIdentidadeServidor() {
  document.getElementById('servidorSelecionadoNome').textContent = servidorSelecionado.id;
  document.getElementById('servidorSelecionadoStatus').textContent = servidorSelecionado.status === 'offline' ? 'Offline' : 'Online';
  document.getElementById('servidorSelecionadoCidade').textContent = servidorSelecionado.cidade;
  const dataLeitura = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dadosDashboard.dataLeitura));
  document.getElementById('resumoServidorLeitura').textContent = `Visão Geral · última leitura ${dataLeitura}`;
  document.querySelectorAll('[data-meta-servidor]').forEach((elemento) => {
    elemento.textContent = `Leitura registrada · ${servidorSelecionado.id} · ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(dadosDashboard.dataLeitura))}`;
  });
  const escopo = document.querySelector('#servidorConfigNome');
  if (escopo) escopo.textContent = servidorSelecionado.id;
  const escopoNome = document.getElementById('escopoServidorLimites');
  if (escopoNome) escopoNome.textContent = servidorSelecionado.id;
}

abasRecursos.forEach((aba, indice) => {
  aba.addEventListener('click', () => selecionarRecurso(aba));
  aba.addEventListener('keydown', (evento) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
    evento.preventDefault();
    const proximo = evento.key === 'Home' ? 0 : evento.key === 'End' ? abasRecursos.length - 1
      : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + abasRecursos.length) % abasRecursos.length;
    abasRecursos[proximo].focus();
    selecionarRecurso(abasRecursos[proximo]);
  });
});

const ctxrede = document.getElementById('graficoBanda').getContext('2d');

const faixasMatriz = [
  { nome: 'Manhã', horario: '06–12h', indices: [3, 4, 5, 6] },
  { nome: 'Tarde', horario: '12–18h', indices: [6, 7, 8, 9] },
  { nome: 'Noite', horario: '18–24h', indices: [9, 10, 11, 12] },
  { nome: 'Madrugada', horario: '00–06h', indices: [0, 1, 2, 3] }
];
const semanaMatriz = dadosDashboard.picoSemanalFrota.map((dia) => ({
  dia: dia.dia,
  picos: [...dia.picos],
  picosPorRecurso: dia.picosPorRecurso.map((pico) => ({ ...pico }))
}));
const formatoPercentual = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

function media(recurso) {
  return recurso.data.reduce((total, valor) => total + valor, 0) / recurso.data.length;
}

function formatarPercentual(valor) {
  return valor == null || !Number.isFinite(Number(valor)) ? '—' : `${formatoPercentual.format(valor)}%`;
}

atualizarIdentidadeServidor();

function renderizarMatrizCalor() {
  const corpo = document.getElementById('corpoMatrizCalor');
  const ordem = { saudavel: 0, atencao: 1, critico: 2 };
  corpo.replaceChildren(...semanaMatriz.map((dia) => {
    const linha = document.createElement('tr');
    const rotuloDia = document.createElement('th');
    rotuloDia.scope = 'row';
    rotuloDia.textContent = dia.dia;
    linha.append(rotuloDia);

    dia.picos.forEach((pico, indice) => {
      const faixa = faixasMatriz[indice];
      const limites = window.InfraTechAlertas.obter();
      const metricas = Object.entries(dia.picosPorRecurso[indice]).map(([recurso, valor]) => ({
        recurso, valor, estado: window.InfraTechAlertas.classificar(recurso, valor),
        pressao: (valor - limites[recurso].atencao) / (limites[recurso].critico - limites[recurso].atencao)
      }));
      const responsavel = metricas.sort((a, b) => ordem[b.estado] - ordem[a.estado] || b.pressao - a.pressao)[0];
      const celula = document.createElement('td');
      celula.className = `matriz-${responsavel.estado === 'saudavel' ? 'ideal' : responsavel.estado}`;
      celula.textContent = `${Math.round(pico)}%`;
      celula.title = `${dia.dia} · ${faixa.nome} ${faixa.horario}: pico agregado mock de ${Math.round(pico)}%. ${responsavel.recurso.toUpperCase()} ${responsavel.valor}% determina a pior classificação (${responsavel.estado}); atenção ${limites[responsavel.recurso].atencao}%, crítico ${limites[responsavel.recurso].critico}%.`;
      celula.setAttribute('aria-label', `${dia.dia}, ${faixa.nome}: pico mock ${Math.round(pico)}%; ${responsavel.recurso.toUpperCase()} ${responsavel.valor}% ${responsavel.estado}`);
      linha.append(celula);
    });

    return linha;
  }));
}

function renderizarKpis() {
  const idsKpis = { cpu: 'kpiCpuMedia', ram: 'kpiRamMedia', disco: 'kpiDiscoMedia' };
  Object.entries(idsKpis).forEach(([chave, id]) => {
    const valor = servidorSelecionado[chave];
    document.getElementById(id).textContent = formatarPercentual(valor);
    const barra = document.querySelector(`[data-barra="${chave}"]`);
    barra.style.setProperty('--kpi-progresso', `${Number(valor) || 0}%`);
  barra.closest('.kpi').classList.remove('kpi-positivo', 'metric-color--sem-dados');
    if (valor == null) barra.closest('.kpi').classList.add('metric-color--sem-dados');
  });

  document.getElementById('kpiTempoCritico').textContent = 'Sem histórico';
  document.getElementById('kpiTempoCritico').closest('.kpi').classList.add('metric-color--sem-dados');
  const detalhe = document.querySelector('#kpiTempoCritico')?.closest('.kpi')?.querySelector('.meta-kpi');
  if (detalhe) detalhe.textContent = 'Histórico por recurso e timestamps não disponível';
}

renderizarMatrizCalor();
renderizarKpis();

function atualizarAnaliseComportamento() {
  const lista = document.getElementById('observacoesComportamento');
  if (!lista) return;
  if (!historicoServidor || !historicoServidor.horas.length) {
    lista.replaceChildren(Object.assign(document.createElement('li'), { textContent: `Não há série temporal disponível para ${servidorSelecionado.id}; padrões não podem ser calculados.` }));
    return;
  }
  const observacoes = [];
  for (const recurso of ['cpu', 'ram', 'disco']) {
    const serie = recursos[recurso].data;
    const pico = Math.max(...serie);
    const indice = serie.indexOf(pico);
    if (pico >= window.InfraTechAlertas.obter(servidorSelecionado.id)[recurso].atencao) {
      observacoes.push(`${recursos[recurso].label} teve pico de ${pico}% às ${horasRecursos[indice]}; é uma leitura, não confirmação de alerta persistente.`);
    }
  }
  let aumentoSimultaneo = null;
  for (let indice = 1; indice < horasRecursos.length; indice++) {
    const deltas = ['cpu', 'ram', 'disco'].map((recurso) => recursos[recurso].data[indice] - recursos[recurso].data[indice - 1]);
    const pares = [['CPU', 'Disco', 0, 2], ['CPU', 'RAM', 0, 1], ['RAM', 'Disco', 1, 2]];
    const par = pares.find(([, , a, b]) => deltas[a] >= 10 && deltas[b] >= 10);
    if (par) { aumentoSimultaneo = `${horasRecursos[indice - 1]}–${horasRecursos[indice]}: ${par[0]} e ${par[1]} cresceram simultaneamente (+${deltas[par[2]]} e +${deltas[par[3]]} pontos percentuais).`; break; }
  }
  if (aumentoSimultaneo) observacoes.unshift(aumentoSimultaneo);
  if (!observacoes.length) observacoes.push('Não foi identificado aumento simultâneo ou pico acima da faixa de atenção nesta série.');
  lista.replaceChildren(...observacoes.slice(0, 3).map((texto) => Object.assign(document.createElement('li'), { textContent: texto })));
}

function configurarPeriodosDisponiveis() {
  document.querySelectorAll('.filtros-periodo button').forEach((botao) => {
    const disponivel = botao.textContent.trim() === '24h' && Boolean(historicoServidor?.horas?.length);
    botao.disabled = !disponivel;
    botao.title = disponivel ? 'Período disponível na série histórica compartilhada' : 'O mock ainda não possui série com timestamps para este período';
    botao.classList.toggle('ativo', disponivel);
    botao.setAttribute('aria-pressed', String(disponivel));
  });
  if (!historicoServidor?.horas?.length) {
    const subtitulo = document.getElementById('subtituloGraficoRecursos');
    if (subtitulo) subtitulo.textContent = `Sem histórico por recurso para ${servidorSelecionado.id}.`;
  }
}

configurarPeriodosDisponiveis();
atualizarAnaliseComportamento();

function atualizarClassificacoes() {
  limitesAtuais = window.InfraTechAlertas.obter(servidorSelecionado.id);
  const ids = { cpu: 'kpiCpuMedia', ram: 'kpiRamMedia', disco: 'kpiDiscoMedia' };
  for (const [recurso, id] of Object.entries(ids)) {
    const valor = servidorSelecionado[recurso];
    const estado = window.InfraTechAlertas.classificar(recurso, valor, servidorSelecionado.id);
    const card = document.getElementById(id)?.closest('.kpi');
    if (!card) continue;
    card.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico', 'metric-color--sem-dados');
    card.classList.add(`metric-color--${estado}`);
    card.setAttribute('aria-label', `${recurso.toUpperCase()} ${formatarPercentual(valor)} · ${estado} · atenção ${limitesAtuais[recurso].atencao}%, crítico ${limitesAtuais[recurso].critico}%`);
    const barra = card.querySelector('[data-barra]');
    if (barra) { barra.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico'); barra.classList.add(`metric-color--${estado}`); }
  }
  const abaSelecionada = abasRecursos.find((aba) => aba.getAttribute('aria-selected') === 'true');
  if (abaSelecionada) selecionarRecurso(abaSelecionada);
  renderizarMatrizCalor();
  const servidores = dadosDashboard.servidores;
  const offline = servidores.filter((servidor) => servidor.status === 'offline').length;
  const atencao = servidores.filter((servidor) => servidor.status !== 'offline' && ['cpu','ram','disco'].some((recurso) => ['atencao', 'critico'].includes(window.InfraTechAlertas.classificar(recurso, servidor[recurso], servidor.id)))).length;
  document.getElementById('especifica-online').textContent = `${servidores.length - offline} online`;
  document.getElementById('especifica-atencao').textContent = `${atencao} atenção · última leitura`;
  document.getElementById('especifica-offline').textContent = `${offline} offline`;
  atualizarAnaliseComportamento();
}

atualizarClassificacoes();
window.addEventListener('infratech:limites-alerta-alterados', atualizarClassificacoes);
window.addEventListener('storage', () => window.InfraTechAlertas.sincronizarBackend().finally(atualizarClassificacoes));
const recursoSolicitado = parametrosDashboard.get('recurso');
if (['cpu', 'ram', 'disco'].includes(recursoSolicitado)) document.getElementById(`aba-${recursoSolicitado}`)?.click();

const gradientUpload = ctxrede.createLinearGradient(0, 0, 0, 300);
gradientUpload.addColorStop(0, 'rgba(139, 92, 246, 0.25)'); 
gradientUpload.addColorStop(1, 'rgba(139, 92, 246, 0.0)'); 

const gradientDownload = ctxrede.createLinearGradient(0, 0, 0, 300);
gradientDownload.addColorStop(0, 'rgba(6, 182, 212, 0.20)'); 
gradientDownload.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

const graficoBanda = new Chart(ctxrede, {
  type: 'line',
  data: {
    labels: historicoRedeServidor?.horas || [],
    datasets: [
      {
        label: 'Upload (envio)',
        data: historicoRedeServidor?.uploadMbps || [],
        borderColor: '#8b5cf6',      
        backgroundColor: gradientUpload,
        fill: true,           // preenche da área
        borderWidth: 2,
        tension: 0.4,      
        pointRadius: 0,       
        pointHoverRadius: 6
      },
      {
        label: 'Download (recebimento)',
        data: historicoRedeServidor?.downloadMbps || [],
        borderColor: '#06b6d4',   
        backgroundColor: gradientDownload,
        fill: true,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end', // alinha a legenda no canto superior direito
        labels: {
          usePointStyle: false,
          boxWidth: 16,
          boxHeight: 2,
          padding: 15,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      annotation: { annotations: {} }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      },
      y: {
        min: 0,
        max: 1100,
        ticks: {
          stepSize: 250,
          color: '#94a3b8',
          font: { size: 11 }
        },
        grid: {
          color: '#f1f5f9'
        }
      }
    }
  }
});

function atualizarRedeEspecifica() {
  if (!graficoBanda) return;
  const capacidade = Number(dadosDashboard.capacidadesRedePorServidor?.[servidorSelecionado.id] ?? dadosDashboard.rede.capacidadeMbps);
  const maiorPonto = Math.max(...graficoBanda.data.datasets.flatMap((serie) => serie.data.map(Number)));
  const maximoEixo = Number.isFinite(capacidade) && capacidade > 0
    ? capacidade
    : Math.max(25, Math.ceil(maiorPonto * 1.15 / 25) * 25);
  graficoBanda.options.scales.y.max = maximoEixo;
  graficoBanda.options.scales.y.ticks.stepSize = Math.max(1, Math.ceil(maximoEixo / 4 / 25) * 25);
  const annotations = {};
  const subtitle = document.getElementById('estadoCapacidadeRede');
  graficoBanda.options.plugins.tooltip ||= { callbacks: {} };
  graficoBanda.options.plugins.tooltip.callbacks ||= {};
  if (!Number.isFinite(capacidade) || capacidade <= 0) {
    if (subtitle) subtitle.textContent = historicoRedeServidor
      ? `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dadosDashboard.dataLeitura))} · medições em Mbps · capacidade do link não cadastrada`
      : 'Sem histórico de rede para este servidor · capacidade não cadastrada';
    graficoBanda.options.plugins.tooltip.callbacks.label = (contexto) => ` ${contexto.dataset.label}: ${contexto.parsed.y} Mbps · saturação sem classificação`;
  } else {
    const limites = window.InfraTechAlertas.obter(servidorSelecionado.id).rede;
    if (subtitle) subtitle.textContent = `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dadosDashboard.dataLeitura))} · medições em Mbps · capacidade ${capacidade} Mbps`;
    [['Atencao', limites.atencao, '#f59e0b'], ['Critico', limites.critico, '#ef4444']].forEach(([nome, percentual, cor]) => {
      const valor = capacidade * percentual / 100;
      annotations[`rede${nome}`] = {
        type: 'line', yMin: valor, yMax: valor, borderColor: cor, borderWidth: 1, borderDash: [4, 4],
        label: { display: true, content: `${nome} ${percentual}% · ${Math.round(valor)} Mbps`, position: 'end', backgroundColor: 'transparent', color: cor, font: { size: 9 } }
      };
    });
    graficoBanda.options.plugins.tooltip.callbacks.label = (contexto) => {
      const percentual = contexto.parsed.y / capacidade * 100;
      return ` ${contexto.dataset.label}: ${contexto.parsed.y} Mbps · ${percentual.toFixed(1)}% · ${window.InfraTechAlertas.classificar('rede', percentual, servidorSelecionado.id)}`;
    };
  }
  graficoBanda.options.plugins.annotation.annotations = annotations;
  graficoBanda.update();
}
atualizarRedeEspecifica();
window.addEventListener('infratech:limites-alerta-alterados', atualizarRedeEspecifica);
window.addEventListener('storage', () => window.InfraTechAlertas.sincronizarBackend().finally(atualizarRedeEspecifica));
