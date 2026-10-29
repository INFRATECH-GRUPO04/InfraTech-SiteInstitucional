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
let recursoSelecionado = parametrosDashboard.get('recurso') || 'geral';
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
const painelGraficoRede = document.getElementById('graficoRedePainel');
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
  const redeSelecionada = chave === 'rede';
  recursoSelecionado = chave;

  abasRecursos.forEach((item) => {
    const selecionada = item === aba;
    item.classList.toggle('ativa', selecionada);
    item.setAttribute('aria-selected', String(selecionada));
    item.tabIndex = selecionada ? 0 : -1;
  });

  painelGraficoRecursos.hidden = redeSelecionada;
  painelGraficoRede.hidden = !redeSelecionada;
  document.getElementById('tituloLogs').textContent = `Logs e eventos — ${redeSelecionada ? 'Rede' : '24h'}`;
  painelGraficoRecursos.setAttribute('aria-labelledby', aba.id);
  painelGraficoRede.setAttribute('aria-labelledby', aba.id);
  document.getElementById('descricaoLogs').textContent = redeSelecionada
    ? 'Total de upload e download no mesmo horário do gráfico.'
    : 'Leituras registradas no mesmo período e nas séries do gráfico.';
  document.getElementById('dataHistoricoLabel').textContent = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dadosDashboard.dataLeitura));
  if (redeSelecionada) {
    renderizarLogs('rede');
    requestAnimationFrame(() => graficoBanda.resize());
    return;
  }
  const possuiHistoricoRecurso = Boolean(historicoServidor?.horas?.length);
  tituloGraficoRecursos.textContent = visaoGeral
    ? (possuiHistoricoRecurso ? 'Uso de Recursos — 24h' : 'Leituras atuais dos recursos')
    : (possuiHistoricoRecurso ? recursos[chave].titulo : `Uso de ${recursos[chave].label} — leitura atual`);
  subtituloGraficoRecursos.textContent = visaoGeral
    ? historicoServidor ? 'CPU, RAM e Disco · limites individuais por aba · leituras não confirmam incidente persistente' : 'Sem histórico por recurso para este servidor.'
    : (possuiHistoricoRecurso ? recursos[chave].subtitulo : `Série temporal não disponível para ${servidorSelecionado.id}.`);
  graficoRecursos.data.labels = horasRecursos;
  graficoRecursos.data.datasets = visaoGeral
    ? [recursos.cpu, recursos.ram, recursos.disco].map(criarDatasetRecurso)
    : [criarDatasetRecurso(recursos[chave])];
  graficoRecursos.options.plugins.legend.display = visaoGeral;
  graficoRecursos.options.plugins.tooltip.enabled = (visaoGeral ? horasRecursos.length > 0 : recursos[chave].data.length > 0);
  const faixa = visaoGeral ? null : limitesAtuais[chave];
  const annotations = graficoRecursos.options.plugins.annotation.annotations;
  annotations.linhaAtencao.yMin = annotations.linhaAtencao.yMax = faixa ? faixa.atencao : 70;
  annotations.linhaCritica.yMin = annotations.linhaCritica.yMax = faixa ? faixa.critico : 85;
  annotations.linhaAtencao.display = !visaoGeral && Boolean(faixa);
  annotations.linhaCritica.display = !visaoGeral && Boolean(faixa);
  annotations.linhaAtencao.label.display = !visaoGeral;
  annotations.linhaCritica.label.display = !visaoGeral;
  annotations.linhaAtencao.label.content = faixa ? `Atenção ${faixa.atencao}%` : '';
  annotations.linhaCritica.label.content = faixa ? `Crítico ${faixa.critico}%` : '';
  graficoRecursos.update();
  renderizarLogs(visaoGeral ? 'geral' : chave);
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

  const rede = historicoRedeServidor;
  const picoRede = rede ? Math.max(...rede.uploadMbps.map((valor, indice) => valor + rede.downloadMbps[indice])) : null;
  const redeKpi = document.getElementById('kpiRedePico');
  const redeCard = document.getElementById('kpiRedeCard');
  const redeBarra = document.querySelector('[data-barra="rede"]');
  const redeMeta = document.getElementById('kpiRedeMeta');
  redeKpi.textContent = picoRede == null ? 'Sem dados' : `${picoRede} Mbps`;
  const capacidade = Number(dadosDashboard.capacidadesRedePorServidor?.[servidorSelecionado.id] ?? dadosDashboard.rede.capacidadeMbps);
  redeCard.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico', 'metric-color--sem-dados');
  if (picoRede == null) {
    redeCard.classList.add('metric-color--sem-dados');
    redeMeta.textContent = 'Sem série histórica de rede';
    redeBarra.style.setProperty('--kpi-progresso', '0%');
  } else if (!Number.isFinite(capacidade) || capacidade <= 0) {
    redeCard.classList.add('metric-color--sem-dados');
    redeMeta.textContent = 'Pico de upload + download · capacidade não cadastrada';
    redeBarra.style.setProperty('--kpi-progresso', '0%');
  } else {
    const percentual = picoRede / capacidade * 100;
    const estado = window.InfraTechAlertas.classificar('rede', percentual, servidorSelecionado.id);
    redeCard.classList.add(`metric-color--${estado}`);
    redeMeta.textContent = `Pico de ${Math.round(percentual)}% da capacidade do link`;
    redeBarra.style.setProperty('--kpi-progresso', `${Math.min(100, percentual)}%`);
  }
}

renderizarMatrizCalor();
renderizarKpis();

function renderizarLogs(filtro = 'geral') {
  const corpo = document.getElementById('corpoLogs');
  const contador = document.getElementById('contadorLogs');
  const eventos = [];
  const ordemRecurso = { cpu: 0, ram: 1, disco: 2, rede: 3 };
  if (filtro === 'rede') {
    if (historicoRedeServidor) {
      historicoRedeServidor.horas.forEach((hora, indice) => {
        const upload = Number(historicoRedeServidor.uploadMbps[indice]);
        const download = Number(historicoRedeServidor.downloadMbps[indice]);
        if (!Number.isFinite(upload) || !Number.isFinite(download)) return;
        const total = upload + download;
        const capacidade = Number(dadosDashboard.capacidadesRedePorServidor?.[servidorSelecionado.id] ?? dadosDashboard.rede.capacidadeMbps);
        const estado = Number.isFinite(capacidade) && capacidade > 0
          ? window.InfraTechAlertas.classificar('rede', total / capacidade * 100, servidorSelecionado.id)
          : 'sem-capacidade';
        eventos.push({ hora, horaNum: parseInt(hora, 10) || 0, recurso: 'Rede', evento: `Upload ${upload} + download ${download}`, estado, valor: `${total} Mbps`, ordem: 3 });
      });
    }
  } else if (historicoServidor) {
    ['cpu', 'ram', 'disco'].filter((recurso) => filtro === 'geral' || filtro === recurso).forEach((recurso) => {
      let estadoAnterior = 'saudavel';
      historicoServidor[recurso].forEach((valor, indice) => {
        const estado = window.InfraTechAlertas.classificar(recurso, valor, servidorSelecionado.id);
        if (estado !== 'saudavel') {
          eventos.push({ hora: horasRecursos[indice], horaNum: parseInt(horasRecursos[indice], 10) || 0, recurso: recursos[recurso].label, evento: estado === 'critico' ? 'Leitura acima do limite crítico' : 'Leitura acima do limite de atenção', estado, valor: `${valor}%`, ordem: ordemRecurso[recurso] });
        } else if (estadoAnterior !== 'saudavel') {
          eventos.push({ hora: horasRecursos[indice], horaNum: parseInt(horasRecursos[indice], 10) || 0, recurso: recursos[recurso].label, evento: 'Retorno à faixa saudável', estado: 'info', valor: `${valor}%`, ordem: ordemRecurso[recurso] });
        }
        estadoAnterior = estado;
      });
    });
  }
  eventos.sort((a, b) => b.horaNum - a.horaNum || a.ordem - b.ordem);
  contador.textContent = String(eventos.length);
  corpo.replaceChildren();
  if (!eventos.length) {
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 5;
    celula.className = 'logs-vazio';
    celula.textContent = historicoServidor || historicoRedeServidor
      ? 'Nenhum registro fora da faixa configurada neste recorte.'
      : `Sem série histórica para ${servidorSelecionado.id}; não há eventos para comparar com os KPIs.`;
    linha.append(celula);
    corpo.append(linha);
    return;
  }
  eventos.forEach((evento) => {
    const linha = document.createElement('tr');
    [evento.hora, evento.recurso, evento.evento].forEach((texto) => {
      const celula = document.createElement('td');
      celula.textContent = texto;
      linha.append(celula);
    });
    const faixa = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `log-faixa log-faixa--${evento.estado}`;
    badge.textContent = evento.estado === 'info' ? 'Info' : evento.estado === 'sem-capacidade' ? 'Sem limite' : evento.estado === 'critico' ? 'Crítico' : 'Atenção';
    faixa.append(badge);
    linha.append(faixa);
    const valor = document.createElement('td');
    valor.textContent = evento.valor;
    linha.append(valor);
    linha.title = 'Evento derivado da mesma amostra mostrada no gráfico.';
    corpo.append(linha);
  });
}

function configurarPeriodosDisponiveis() {
  document.querySelectorAll('.filtros-periodo button').forEach((botao) => {
    const disponivel = botao.dataset.periodo === '24h' && Boolean(historicoServidor?.horas?.length || historicoRedeServidor?.horas?.length);
    botao.disabled = !disponivel;
    botao.title = disponivel ? 'Período disponível na série histórica compartilhada' : 'O mock ainda não possui série com timestamps para este período';
    botao.classList.toggle('ativo', disponivel);
    botao.setAttribute('aria-pressed', String(disponivel));
  });
  if (!historicoServidor?.horas?.length && !historicoRedeServidor?.horas?.length) {
    const subtitulo = document.getElementById('subtituloGraficoRecursos');
    if (subtitulo) subtitulo.textContent = `Sem histórico por recurso para ${servidorSelecionado.id}.`;
  }
}

configurarPeriodosDisponiveis();

function atualizarClassificacoes() {
  limitesAtuais = window.InfraTechAlertas.obter(servidorSelecionado.id);
  renderizarKpis();
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
}

atualizarClassificacoes();
window.addEventListener('infratech:limites-alerta-alterados', atualizarClassificacoes);
window.addEventListener('storage', () => window.InfraTechAlertas.sincronizarBackend().finally(atualizarClassificacoes));
const recursoSolicitado = parametrosDashboard.get('recurso');

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

function valoresLimitesModal() {
  return Object.fromEntries(['cpu', 'ram', 'disco', 'rede'].map((recurso) => [recurso, {
    atencao: Number(document.querySelector(`[data-faixa="${recurso}"][data-nivel="atencao"]`).value),
    critico: Number(document.querySelector(`[data-faixa="${recurso}"][data-nivel="critico"]`).value)
  }]));
}
function atualizarFaixaModal(recurso) {
  const limites = valoresLimitesModal()[recurso];
  document.getElementById(`out-${recurso}-a`).textContent = `${limites.atencao}%`;
  document.getElementById(`out-${recurso}-c`).textContent = `${limites.critico}%`;
  document.getElementById(`faixa-${recurso}`).textContent = `Saudável 0–${limites.atencao - 1}% · Atenção ${limites.atencao}–${limites.critico - 1}% · Crítico ${limites.critico}–100%`;
  document.querySelectorAll(`[data-faixa="${recurso}"]`).forEach((controle) => {
    controle.style.setProperty('--faixa-atencao', `${limites.atencao}%`);
    controle.style.setProperty('--faixa-critica', `${limites.critico}%`);
  });
}
function preencherModalLimites(limites) {
  ['cpu', 'ram', 'disco', 'rede'].forEach((recurso) => {
    document.querySelector(`[data-faixa="${recurso}"][data-nivel="atencao"]`).value = limites[recurso].atencao;
    document.querySelector(`[data-faixa="${recurso}"][data-nivel="critico"]`).value = limites[recurso].critico;
    atualizarFaixaModal(recurso);
  });
}
function inicializarModalLimites() {
  const modal = document.getElementById('modalLimites');
  const form = document.getElementById('formLimites');
  document.getElementById('abrir-config-alertas').addEventListener('click', () => {
    preencherModalLimites(window.InfraTechAlertas.obter(servidorSelecionado.id));
    document.getElementById('avisoLimites').textContent = 'As cores mudam com os limites salvos em todas as dashboards.';
    modal.showModal();
  });
  document.querySelectorAll('[data-faixa]').forEach((controle) => controle.addEventListener('input', () => {
    const { faixa, nivel } = controle.dataset;
    const atencao = document.querySelector(`[data-faixa="${faixa}"][data-nivel="atencao"]`);
    const critico = document.querySelector(`[data-faixa="${faixa}"][data-nivel="critico"]`);
    if (nivel === 'atencao' && Number(controle.value) >= Number(critico.value)) controle.value = Number(critico.value) - 1;
    if (nivel === 'critico' && Number(controle.value) <= Number(atencao.value)) controle.value = Number(atencao.value) + 1;
    atualizarFaixaModal(faixa);
  }));
  document.getElementById('botaoAjudaLimites').addEventListener('click', () => {
    const texto = document.getElementById('textoAjudaLimites');
    texto.hidden = !texto.hidden;
    document.getElementById('botaoAjudaLimites').setAttribute('aria-expanded', String(!texto.hidden));
  });
  document.getElementById('fecharLimites').addEventListener('click', () => modal.close());
  document.getElementById('cancelarLimites').addEventListener('click', () => modal.close());
  document.getElementById('restaurarLimites').addEventListener('click', () => preencherModalLimites(window.InfraTechAlertas.padrao));
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const escopo = document.querySelector('[name="escopoLimites"]:checked').value;
    const substituir = document.getElementById('substituirIndividuais').checked;
    const mensagem = document.getElementById('avisoLimites');
    const toast = document.getElementById('alertaLimitesToast');
    try {
      const limites = valoresLimitesModal();
      window.InfraTechAlertas.salvar(escopo, servidorSelecionado.id, limites, substituir);
      let sincronizado = false;
      try { sincronizado = await window.InfraTechAlertas.salvarBackend(escopo, servidorSelecionado.id, limites, substituir); }
      catch (erro) { mensagem.textContent = `Salvo neste navegador. Sincronização indisponível: ${erro.message}`; }
      if (sincronizado) mensagem.textContent = 'Limites salvos e sincronizados com a empresa.';
      atualizarClassificacoes();
      atualizarRedeEspecifica();
      toast.textContent = sincronizado ? 'Limites atualizados e sincronizados.' : 'Limites atualizados neste navegador.';
      toast.dataset.status = sincronizado ? 'ok' : 'local';
      toast.hidden = false;
      modal.close();
      window.setTimeout(() => { toast.hidden = true; }, 4000);
    } catch (erro) { mensagem.textContent = erro.message || 'Não foi possível salvar os limites.'; }
  });
}
inicializarModalLimites();
if (['cpu', 'ram', 'disco', 'rede'].includes(recursoSolicitado)) document.getElementById(`aba-${recursoSolicitado}`)?.click();
