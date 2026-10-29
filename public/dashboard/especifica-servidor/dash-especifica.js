const dadosDashboard = window.InfraTechDashboardData;
const servidorSelecionado = dadosDashboard.servidores.find((servidor) => servidor.id === 'SRV-BR-01');
const historicoServidor = dadosDashboard.historicoServidor[servidorSelecionado.id];
const RECURSOS_ALERTA = ['cpu', 'ram', 'disco', 'rede'];
const CORES_SEVERIDADE = { saudavel: '#22c55e', atencao: '#f59e0b', critico: '#ef4444', 'sem-dados': '#94a3b8' };
let limitesAtuais = window.InfraTechAlertas.obter(servidorSelecionado.id);
const horasRecursos = historicoServidor.horas;
const recursos = {
  cpu: { label: 'CPU', data: historicoServidor.cpu, color: '#25AFC0', titulo: 'Uso de CPU — 24h', subtitulo: 'Utilização do processador ao longo do dia' },
  disco: { label: 'Disco', data: historicoServidor.disco, color: '#20A881', titulo: 'Uso de Disco — 24h', subtitulo: 'Utilização do armazenamento ao longo do dia' },
  ram: { label: 'RAM', data: historicoServidor.ram, color: '#8050C7', titulo: 'Uso de RAM — 24h', subtitulo: 'Utilização da memória ao longo do dia' }
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
  tituloGraficoRecursos.textContent = visaoGeral ? 'Uso de Recursos — 24h' : recursos[chave].titulo;
  subtituloGraficoRecursos.textContent = visaoGeral
    ? 'CPU, RAM e Disco ao longo do dia'
    : recursos[chave].subtitulo;
  graficoRecursos.data.datasets = visaoGeral
    ? [recursos.cpu, recursos.ram, recursos.disco].map(criarDatasetRecurso)
    : [criarDatasetRecurso(recursos[chave])];
  graficoRecursos.options.plugins.legend.display = visaoGeral;
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
  minutosCriticos: [...dia.minutosCriticos]
}));
const formatoPercentual = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

function media(recurso) {
  return recurso.data.reduce((total, valor) => total + valor, 0) / recurso.data.length;
}

function formatarPercentual(valor) {
  return `${formatoPercentual.format(valor)}%`;
}

function renderizarMatrizCalor() {
  const corpo = document.getElementById('corpoMatrizCalor');
  corpo.replaceChildren(...semanaMatriz.map((dia) => {
    const linha = document.createElement('tr');
    const rotuloDia = document.createElement('th');
    rotuloDia.scope = 'row';
    rotuloDia.textContent = dia.dia;
    linha.append(rotuloDia);

    dia.picos.forEach((pico, indice) => {
      const faixa = faixasMatriz[indice];
      const celula = document.createElement('td');
      celula.className = 'matriz-sem-classificacao';
      celula.textContent = `${Math.round(pico)}%`;
      celula.title = `${dia.dia} · ${faixa.nome} ${faixa.horario}: pico agregado ${Math.round(pico)}%. Recurso responsável e limite histórico não identificados.`;
      celula.setAttribute('aria-label', `${dia.dia}, ${faixa.nome}: pico agregado ${Math.round(pico)}%; recurso responsável sem dados`);
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
    barra.style.setProperty('--kpi-progresso', `${valor}%`);
  barra.closest('.kpi').classList.remove('kpi-positivo');
  });

  document.getElementById('kpiTempoCritico').textContent = 'Sem histórico';
  document.getElementById('kpiTempoCritico').closest('.kpi').classList.add('metric-color--sem-dados');
  const detalhe = document.querySelector('#kpiTempoCritico')?.closest('.kpi')?.querySelector('.meta-kpi');
  if (detalhe) detalhe.textContent = 'Histórico por recurso e timestamps não disponível';
}

renderizarMatrizCalor();
renderizarKpis();

function atualizarClassificacoes() {
  limitesAtuais = window.InfraTechAlertas.obter(servidorSelecionado.id);
  const ids = { cpu: 'kpiCpuMedia', ram: 'kpiRamMedia', disco: 'kpiDiscoMedia' };
  for (const [recurso, id] of Object.entries(ids)) {
    const valor = servidorSelecionado[recurso];
    const estado = window.InfraTechAlertas.classificar(recurso, valor, servidorSelecionado.id);
    const card = document.getElementById(id)?.closest('.kpi');
    if (!card) continue;
    card.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico');
    card.classList.add(`metric-color--${estado}`);
    card.setAttribute('aria-label', `${recurso.toUpperCase()} ${valor}% · ${estado} · atenção ${limitesAtuais[recurso].atencao}%, crítico ${limitesAtuais[recurso].critico}%`);
    const barra = card.querySelector('[data-barra]');
    if (barra) { barra.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico'); barra.classList.add(`metric-color--${estado}`); }
  }
  const abaSelecionada = abasRecursos.find((aba) => aba.getAttribute('aria-selected') === 'true');
  if (abaSelecionada) selecionarRecurso(abaSelecionada);
  const servidores = dadosDashboard.servidores;
  const offline = servidores.filter((servidor) => servidor.status === 'offline').length;
  const atencao = servidores.filter((servidor) => servidor.status !== 'offline' && ['cpu','ram','disco'].some((recurso) => window.InfraTechAlertas.classificar(recurso, servidor[recurso], servidor.id) !== 'saudavel')).length;
  document.getElementById('especifica-online').textContent = `${servidores.length - offline} online`;
  document.getElementById('especifica-atencao').textContent = `${atencao} atenção · última leitura`;
  document.getElementById('especifica-offline').textContent = `${offline} offline`;
}

function valoresLimitesModal() {
  const limites = {};
  for (const recurso of RECURSOS_ALERTA) {
    limites[recurso] = {
      atencao: Number(document.querySelector(`[data-faixa="${recurso}"][data-nivel="atencao"]`).value),
      critico: Number(document.querySelector(`[data-faixa="${recurso}"][data-nivel="critico"]`).value)
    };
  }
  return limites;
}
function atualizarFaixaModal(recurso) {
  const limites = valoresLimitesModal()[recurso];
  document.getElementById(`out-${recurso}-a`).textContent = `${limites.atencao}%`;
  document.getElementById(`out-${recurso}-c`).textContent = `${limites.critico}%`;
  const faixas = [];
  if (limites.atencao > 0) faixas.push(`Saudável 0–${limites.atencao - 1}`);
  faixas.push(`Atenção ${limites.atencao}–${limites.critico - 1}`, `Crítico ${limites.critico}–100%`);
  document.getElementById(`faixa-${recurso}`).textContent = faixas.join(' · ');
  const previa = document.getElementById(`previa-${recurso}`);
  if (previa && recurso !== 'rede') {
    const valorAtual = Number(servidorSelecionado[recurso]);
    const estado = valorAtual >= limites.critico ? 'Crítico' : valorAtual >= limites.atencao ? 'Atenção' : 'Saudável';
    previa.textContent = `Leitura do card: ${valorAtual}% · ${estado}`;
  } else if (previa) {
    const capacidade = Number(dadosDashboard.capacidadesRedePorServidor?.[servidorSelecionado.id] ?? dadosDashboard.rede.capacidadeMbps);
    if (!Number.isFinite(capacidade) || capacidade <= 0) previa.textContent = 'Sem capacidade cadastrada · sem classificação de saturação';
    else {
      const maiorPico = Math.max(...graficoBanda.data.datasets.flatMap((serie) => serie.data));
      const percentual = maiorPico / capacidade * 100;
      const estado = percentual >= limites.critico ? 'Crítico' : percentual >= limites.atencao ? 'Atenção' : 'Saudável';
      previa.textContent = `Maior ponto do gráfico: ${Math.round(percentual)}% da capacidade · ${estado}`;
    }
  }
  const controls = document.querySelectorAll(`[data-faixa="${recurso}"]`);
  controls[0].style.setProperty('--faixa-atencao', `${limites.atencao}%`);
  controls[0].style.setProperty('--faixa-critica', `${limites.critico}%`);
  controls[1].style.setProperty('--faixa-atencao', `${limites.atencao}%`);
  controls[1].style.setProperty('--faixa-critica', `${limites.critico}%`);
}
function preencherModalLimites(limites) {
  for (const recurso of RECURSOS_ALERTA) {
    document.querySelector(`[data-faixa="${recurso}"][data-nivel="atencao"]`).value = limites[recurso].atencao;
    document.querySelector(`[data-faixa="${recurso}"][data-nivel="critico"]`).value = limites[recurso].critico;
    atualizarFaixaModal(recurso);
  }
}
function inicializarModalLimites() {
  const modal = document.getElementById('modalLimites');
  const form = document.getElementById('formLimites');
  const botaoAbrir = document.getElementById('abrir-config-alertas');
  if (!modal || !form || !botaoAbrir) return;
  botaoAbrir.addEventListener('click', () => {
    limitesAtuais = window.InfraTechAlertas.obter(servidorSelecionado.id);
    preencherModalLimites(limitesAtuais);
    modal.showModal();
  });
  document.querySelectorAll('[data-faixa]').forEach((controle) => controle.addEventListener('input', () => {
    const { faixa, nivel } = controle.dataset;
    const atenção = document.querySelector(`[data-faixa="${faixa}"][data-nivel="atencao"]`);
    const critico = document.querySelector(`[data-faixa="${faixa}"][data-nivel="critico"]`);
    if (nivel === 'atencao' && Number(controle.value) >= Number(critico.value)) controle.value = Number(critico.value) - 1;
    if (nivel === 'critico' && Number(controle.value) <= Number(atenção.value)) controle.value = Number(atenção.value) + 1;
    atualizarFaixaModal(faixa);
  }));
  document.querySelectorAll('.ajuda-recurso').forEach((botao) => botao.addEventListener('click', () => {
    const aviso = document.getElementById('avisoLimites');
    aviso.textContent = botao.dataset.explicacao;
  }));
  const ajuda = document.getElementById('botaoAjudaLimites');
  ajuda.addEventListener('click', () => {
    const texto = document.getElementById('textoAjudaLimites');
    texto.hidden = !texto.hidden;
    ajuda.setAttribute('aria-expanded', String(!texto.hidden));
  });
  document.getElementById('fecharLimites').addEventListener('click', () => modal.close());
  document.getElementById('cancelarLimites').addEventListener('click', () => modal.close());
  document.getElementById('restaurarLimites').addEventListener('click', () => preencherModalLimites(window.InfraTechAlertas.padrao));
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const escopo = document.querySelector('[name="escopoLimites"]:checked').value;
    try {
      const substituir = document.getElementById('substituirIndividuais').checked;
      const limites = valoresLimitesModal();
      window.InfraTechAlertas.salvar(escopo, servidorSelecionado.id, limites, substituir);
      let textoSalvo = 'Limites atualizados neste navegador. Entre com a conta da empresa para sincronizar entre dispositivos.';
      let backendSalvo = false;
      try {
        backendSalvo = await window.InfraTechAlertas.salvarBackend(escopo, servidorSelecionado.id, limites, substituir);
        if (backendSalvo) textoSalvo = 'Limites atualizados e sincronizados com a empresa.';
      } catch (erroBackend) {
        textoSalvo = `Salvo neste navegador; a sincronização com o backend falhou: ${erroBackend.message}`;
      }
      document.getElementById('avisoLimites').textContent = textoSalvo;
      atualizarClassificacoes();
      modal.close();
      const toast = document.getElementById('alertaLimitesToast');
      toast.textContent = backendSalvo ? 'Limites atualizados e sincronizados com a empresa.' : 'Limites atualizados neste navegador.';
      toast.dataset.status = backendSalvo ? 'ok' : 'local';
      toast.hidden = false;
      window.setTimeout(() => { toast.hidden = true; }, 4000);
    } catch (erro) {
      document.getElementById('avisoLimites').textContent = erro.message || 'Não foi possível salvar os limites neste navegador.';
    }
  });
}
inicializarModalLimites();
atualizarClassificacoes();
window.addEventListener('infratech:limites-alerta-alterados', atualizarClassificacoes);
window.addEventListener('storage', () => window.InfraTechAlertas.sincronizarBackend().finally(atualizarClassificacoes));

const gradientUpload = ctxrede.createLinearGradient(0, 0, 0, 300);
gradientUpload.addColorStop(0, 'rgba(139, 92, 246, 0.25)'); 
gradientUpload.addColorStop(1, 'rgba(139, 92, 246, 0.0)'); 

const gradientDownload = ctxrede.createLinearGradient(0, 0, 0, 300);
gradientDownload.addColorStop(0, 'rgba(6, 182, 212, 0.20)'); 
gradientDownload.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

const graficoBanda = new Chart(ctxrede, {
  type: 'line',
  data: {
    labels: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
    datasets: [
      {
        label: 'Upload (envio)',
        data: [90, 110, 150, 300, 400, 470, 500, 680, 710, 880, 950, 700, 620],
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
        data: [60, 80, 100, 180, 220, 200, 200, 290, 320, 380, 400, 310, 260],
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
    if (subtitle) subtitle.textContent = '25 out 2026 · medições em Mbps · capacidade do link não cadastrada';
    graficoBanda.options.plugins.tooltip.callbacks.label = (contexto) => ` ${contexto.dataset.label}: ${contexto.parsed.y} Mbps · saturação sem classificação`;
  } else {
    const limites = window.InfraTechAlertas.obter(servidorSelecionado.id).rede;
    if (subtitle) subtitle.textContent = `25 out 2026 · medições em Mbps · capacidade ${capacidade} Mbps`;
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
