let graficoRede = null;
let graficoSaude = null;

const CORES_ALERTA = { saudavel: '#22c55e', atencao: '#f59e0b', critico: '#ef4444', 'sem-dados': '#94a3b8' };
const NOMES_RECURSOS_ALERTA = { cpu: 'CPU', ram: 'RAM', disco: 'Disco' };
function classificarMetrica(recurso, valor, servidorId) { return window.InfraTechAlertas.classificar(recurso, valor, servidorId); }
function obterCorAlerta(recurso, valor) { return CORES_ALERTA[classificarMetrica(recurso, valor)] || CORES_ALERTA['sem-dados']; }
function faixaTexto(limites, recurso) { return `Atenção ≥${limites[recurso].atencao}% · Crítico ≥${limites[recurso].critico}%`; }

function atualizarCoresMetricas() {
  const dados = window.InfraTechDashboardData;
  if (!dados) return;

  let totalAtencao = 0;
  dados.servidores.forEach((servidor) => {
    const linha = document.querySelector(`[data-servidor="${servidor.id}"]`);
    if (!linha) return;

    const estados = [];
    ['cpu', 'ram', 'disco'].forEach((recurso, indice) => {
      const valor = servidor[recurso];
      if (valor == null) return;
      const celula = linha.querySelectorAll('.celula-metrica__valor')[indice];
      const barra = linha.querySelectorAll('.barra-progresso__fill')[indice];
      const faixa = classificarMetrica(recurso, valor, servidor.id);
      estados.push(faixa);
      if (celula) {
        celula.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico', 'metric-color--sem-dados');
        celula.classList.add(`metric-color--${faixa}`);
        const limites = window.InfraTechAlertas.obter(servidor.id);
        celula.title = `${NOMES_RECURSOS_ALERTA[recurso]} ${valor}% · ${faixa} · ${faixaTexto(limites, recurso)}`;
      }
      if (barra) {
        barra.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico', 'metric-color--sem-dados');
        barra.classList.add(`metric-color--${faixa}`);
        barra.setAttribute('aria-label', `${NOMES_RECURSOS_ALERTA[recurso]} ${valor}%: ${faixa}`);
      }
    });
    const piorEstado = estados.includes('critico') ? 'critico' : estados.includes('atencao') ? 'atencao' : 'saudavel';
    linha.classList.remove('metric-row--atencao', 'metric-row--critico', 'metric-row--offline');
    if (servidor.status === 'offline') linha.classList.add('metric-row--offline');
    else if (estados.includes('critico')) linha.classList.add('metric-row--critico');
    else if (estados.includes('atencao')) linha.classList.add('metric-row--atencao');
    if (servidor.status !== 'offline' && (piorEstado === 'atencao' || piorEstado === 'critico')) totalAtencao++;
  });
  const online = dados.servidores.filter((servidor) => servidor.status !== 'offline').length;
  const offline = dados.servidores.length - online;
  const resumoAtencao = document.getElementById('resumo-atencao');
  const resumoOffline = document.getElementById('resumo-offline');
  if (resumoAtencao) resumoAtencao.textContent = `• ${totalAtencao} atenção · última leitura`;
  if (resumoOffline) resumoOffline.textContent = `• ${offline} offline`;
  const problema = document.getElementById('kpi-problemas');
  if (problema) problema.textContent = totalAtencao + offline;
  const problemasBadge = document.getElementById('alerta-problemas-badge');
  if (problemasBadge) problemasBadge.textContent = `${offline} offline · ${totalAtencao} em atenção`;
  const problemasDetalhe = document.getElementById('problemas-detalhe');
  if (problemasDetalhe) problemasDetalhe.textContent = `${offline} offline · ${totalAtencao} servidor(es) com recursos em atenção (última leitura)`;
  if (graficoSaude) {
    graficoSaude.data.datasets[0].data = [online - totalAtencao, totalAtencao, offline];
    graficoSaude.update();
  }
  atualizarIndicadorRede();
  atualizarCorGraficoRede();
}

function atualizarIndicadorRede() {
  const rede = window.InfraTechDashboardData.rede;
  const indicador = window.InfraTechAlertas.classificarRede(rede.picoMbps, rede.capacidadeMbps);
  const valor = document.getElementById('kpi-rede-valor');
  const badge = document.getElementById('alerta-rede-badge');
  const detalhe = document.getElementById('alerta-rede-faixas');
  if (!valor || !badge || !detalhe) return;
  valor.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico');
  badge.classList.remove('metric-color--saudavel', 'metric-color--atencao', 'metric-color--critico');
  if (indicador.percentual == null) {
    valor.title = 'Tráfego em Mbps; sem capacidade cadastrada não é possível classificar saturação.';
    badge.textContent = 'Sem capacidade cadastrada';
    detalhe.textContent = 'Tráfego em Mbps; sem capacidade do link não há classificação de saturação.';
    return;
  }
  const estado = indicador.estado;
  valor.classList.add(`metric-color--${estado}`);
  badge.classList.add(`metric-color--${estado}`);
  badge.textContent = `${estado.toUpperCase()} · ${Math.round(indicador.percentual)}% da capacidade`;
  detalhe.textContent = `Tráfego ${rede.picoMbps} Mbps de ${rede.capacidadeMbps} Mbps`;
  valor.title = detalhe.textContent;
}

function atualizarCorGraficoRede() {
  if (!graficoRede) return;
  const capacidadeAtual = Number(window.InfraTechDashboardData.rede.capacidadeMbps);
  const maiorPonto = Math.max(...graficoRede.data.datasets[0].data.map(Number));
  const maximoEixo = Number.isFinite(capacidadeAtual) && capacidadeAtual > 0
    ? capacidadeAtual
    : Math.max(25, Math.ceil(maiorPonto * 1.15 / 25) * 25);
  graficoRede.options.scales.y.max = maximoEixo;
  graficoRede.options.scales.y.ticks.stepSize = Math.max(1, Math.ceil(maximoEixo / 4 / 25) * 25);
  const serie = graficoRede.data.datasets[0];
  serie.segment = {
    borderColor(contexto) {
      const capacidade = window.InfraTechDashboardData.rede.capacidadeMbps;
      if (!Number.isFinite(Number(capacidade)) || capacidade <= 0) return '#9333ea';
      const mediaSegmento = (contexto.p0.parsed.y + contexto.p1.parsed.y) / 2 / capacidade * 100;
      const estado = window.InfraTechAlertas.classificar('rede', mediaSegmento);
      return CORES_ALERTA[estado];
    }
  };
  serie.pointRadius = 3;
  serie.pointHoverRadius = 6;
  serie.pointBackgroundColor = (contexto) => {
    const capacidade = window.InfraTechDashboardData.rede.capacidadeMbps;
    return !Number.isFinite(Number(capacidade)) || capacidade <= 0 ? '#9333ea'
      : CORES_ALERTA[window.InfraTechAlertas.classificar('rede', Number(contexto.raw) / capacidade * 100)];
  };
  serie.pointBorderColor = serie.pointBackgroundColor;
  serie.pointBorderWidth = 1;
  graficoRede.options.plugins.tooltip.callbacks.label = (contexto) => {
    const capacidade = window.InfraTechDashboardData.rede.capacidadeMbps;
    if (!Number.isFinite(Number(capacidade)) || capacidade <= 0) return ` ${contexto.parsed.y} Mbps · sem capacidade cadastrada; saturação não classificada`;
    const percentual = contexto.parsed.y / capacidade * 100;
    return ` ${contexto.parsed.y} Mbps · ${percentual.toFixed(1)}% da capacidade · ${classificarMetrica('rede', percentual)}`;
  };
  graficoRede.update();
}

// Carrega dados da sessão do usuário logado
function carregarUsuario() {
  const nomeSalvo = sessionStorage.NOME_USUARIO;
  const acessoSalvo = sessionStorage.TIPO_ACESSO;

  const elNome = document.getElementById('nome_usuario');
  const elCargo = document.getElementById('cargo_usuario');

  if (nomeSalvo) {
    if (elNome) {
      elNome.textContent = nomeSalvo.toUpperCase();
    }
  }

  if (acessoSalvo) {
    const cargoFormatado = typeof formatarCargoDashboard === 'function'
      ? formatarCargoDashboard(acessoSalvo)
      : acessoSalvo.toUpperCase();

    if (elCargo) {
      elCargo.textContent = cargoFormatado;
    }
  }
}

function aplicarLeiturasFrota() {
  const dados = window.InfraTechDashboardData;
  if (!dados) return;

  const totais = { online: 0, atencao: 0, offline: 0 };
  dados.servidores.forEach((servidor) => {
    totais[servidor.status === 'offline' ? 'offline' : 'online'] += 1;
    const linha = document.querySelector(`[data-servidor="${servidor.id}"]`);
    if (!linha) return;

    const status = linha.querySelector('.status');
    const ponto = linha.querySelector('.celula-servidor .ponto');
    const metricas = linha.querySelectorAll('.celula-metrica__valor');
    const metricasVazias = linha.querySelectorAll('.celula-metrica__vazio');
    const disponibilidade = linha.querySelector('.disponibilidade');
    const detalheDisponibilidade = linha.querySelector('.disponibilidade__detalhe');

    linha.classList.toggle('tabela-servidores__linha--atencao', false);
    linha.classList.toggle('tabela-servidores__linha--offline', servidor.status === 'offline');
    if (status) {
      status.className = `status status--${servidor.status === 'offline' ? 'offline' : 'online'}`;
      status.textContent = servidor.status === 'offline' ? 'Offline' : 'Online';
    }
    if (ponto) {
      ponto.classList.remove('ponto--online', 'ponto--atencao', 'ponto--offline');
      ponto.classList.add(`ponto--${servidor.status === 'offline' ? 'offline' : 'online'}`);
    }

    ['cpu', 'ram', 'disco'].forEach((recurso, indice) => {
      if (servidor[recurso] == null) {
        if (metricasVazias[indice]) metricasVazias[indice].textContent = '—';
        return;
      }
      const valor = metricas[indice];
      if (valor) {
        valor.textContent = `${servidor[recurso]}%`;
        valor.classList.remove('celula-metrica__valor--ok', 'celula-metrica__valor--atencao');
      }
      const barra = linha.querySelectorAll('.barra-progresso__fill')[indice];
      if (barra) {
        barra.style.width = `${servidor[recurso]}%`;
        barra.classList.remove('barra-progresso__fill--ok', 'barra-progresso__fill--atencao');
      }
    });

    if (servidor.status === 'offline') {
      if (disponibilidade) {
        disponibilidade.className = 'disponibilidade disponibilidade--offline';
        disponibilidade.textContent = 'Fora do ar';
      }
      if (detalheDisponibilidade) detalheDisponibilidade.remove();
    } else if (disponibilidade) {
      const estavel = servidor.disponibilidade >= 99;
      disponibilidade.className = `disponibilidade disponibilidade--${estavel ? 'estavel' : 'instavel'}`;
      disponibilidade.textContent = estavel ? 'Estável' : 'Instável';
      if (detalheDisponibilidade) detalheDisponibilidade.textContent = `${servidor.disponibilidade.toFixed(1)}% do tempo`;
    }
  });

  document.getElementById('resumo-online').textContent = `• ${totais.online} online`;
  document.getElementById('resumo-atencao').textContent = `• ${totais.atencao} atenção`;
  document.getElementById('resumo-offline').textContent = `• ${totais.offline} offline`;
  document.getElementById('kpi-problemas').textContent = totais.atencao + totais.offline;
  document.getElementById('servidores-online').textContent = totais.online;
  document.getElementById('servidores-total').textContent = `/${dados.servidores.length}`;
  document.getElementById('kpi-rede-atual').textContent = dados.rede.picoMbps;
  const badgeRede = document.getElementById('rede-pico-badge');
  if (badgeRede) {
    const data = new Date(dados.dataLeitura);
    const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(data);
    badgeRede.textContent = `● ${dados.rede.picoMbps} Mbps · registrado ${dataCurta}`;
  }
  atualizarCoresMetricas();
}

// Atualização do relógio em tempo real
function atualizarRelogio() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const el = document.getElementById('relogio');
  if (el) {
    el.textContent = `${dia}/${mes}/${ano} ${horas}:${minutos}`;
  }
}

// Gráfico de linha e área do tráfego de rede
function inicializarGraficoRede() {
  const ctxRede = document.getElementById('grafico-rede');
  if (!ctxRede) return;

  const gradiente = ctxRede.getContext('2d').createLinearGradient(0, 0, 0, 180);
  gradiente.addColorStop(0, 'rgba(168, 85, 247, 0.22)');
  gradiente.addColorStop(1, 'rgba(168, 85, 247, 0.00)');

  graficoRede = new Chart(ctxRede, {
    type: 'line',
    data: {
      labels: window.InfraTechDashboardData.rede.horas,
      datasets: [{
        label: 'Tráfego',
        data: window.InfraTechDashboardData.rede.mbps,
        borderColor: '#9333ea',
        borderWidth: 2.2,
        backgroundColor: gradiente,
        fill: true,
        tension: 0.45,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#9333ea'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.parsed.y} Mbps`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 }
          }
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 25,
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 }
          },
          grid: {
            color: '#f1f5f9'
          }
        }
      }
    }
  });
  atualizarCorGraficoRede();
}

// Gráfico de rosca do resumo de saúde
function inicializarGraficoSaude() {
  const ctxSaude = document.getElementById('grafico-saude');
  if (!ctxSaude) return;

  graficoSaude = new Chart(ctxSaude, {
    type: 'doughnut',
    data: {
      labels: ['Online', 'Atenção', 'Offline'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${context.parsed}`;
            }
          }
        }
      }
    }
  });
  atualizarCoresMetricas();
}

// Controle do menu hambúrguer para telas menores
function inicializarHamburguer() {
  const btnHamburguer = document.getElementById('btn_hamburguer');
  const sidebar = document.getElementById('sidebar_dash');
  const overlay = document.getElementById('overlay_sidebar');

  if (!btnHamburguer || !sidebar || !overlay) return;

  // Abre ou fecha a sidebar
  btnHamburguer.addEventListener('click', function () {
    sidebar.classList.toggle('aberta');
    overlay.classList.toggle('visivel');
  });

  // Fecha ao clicar no overlay
  overlay.addEventListener('click', function () {
    sidebar.classList.remove('aberta');
    overlay.classList.remove('visivel');
  });

  // Fecha ao clicar em um link do menu
  const itensMenu = sidebar.querySelectorAll('.nav-item, .btn-logout');
  itensMenu.forEach(function (item) {
    item.addEventListener('click', function () {
      sidebar.classList.remove('aberta');
      overlay.classList.remove('visivel');
    });
  });
}

function inicializarTabelaLinhas() {
  document.querySelectorAll('.tabela-servidores__linha').forEach(function (linha) {
    linha.style.cursor = 'default';
  });
}

// Inicialização automática ao carregar o DOM
document.addEventListener('DOMContentLoaded', function () {
  carregarUsuario();
  aplicarLeiturasFrota();
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  inicializarGraficoRede();
  inicializarGraficoSaude();
  inicializarTabelaLinhas();
  window.addEventListener('infratech:limites-alerta-alterados', atualizarCoresMetricas);
  window.addEventListener('storage', () => window.InfraTechAlertas.sincronizarBackend().finally(atualizarCoresMetricas));
});
