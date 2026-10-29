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
    totais[servidor.status] += 1;
    const linha = document.querySelector(`[data-servidor="${servidor.id}"]`);
    if (!linha) return;

    const status = linha.querySelector('.status');
    const ponto = linha.querySelector('.celula-servidor .ponto');
    const metricas = linha.querySelectorAll('.celula-metrica__valor');
    const metricasVazias = linha.querySelectorAll('.celula-metrica__vazio');
    const disponibilidade = linha.querySelector('.disponibilidade');
    const detalheDisponibilidade = linha.querySelector('.disponibilidade__detalhe');

    linha.classList.toggle('tabela-servidores__linha--atencao', servidor.status === 'atencao');
    linha.classList.toggle('tabela-servidores__linha--offline', servidor.status === 'offline');
    if (status) {
      status.className = `status status--${servidor.status}`;
      status.textContent = servidor.status === 'atencao' ? 'Atenção'
        : servidor.status === 'offline' ? 'Offline' : 'Online';
    }
    if (ponto) {
      ponto.classList.remove('ponto--online', 'ponto--atencao', 'ponto--offline');
      ponto.classList.add(`ponto--${servidor.status}`);
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
        valor.classList.add(servidor.status === 'atencao' ? 'celula-metrica__valor--atencao' : 'celula-metrica__valor--ok');
      }
      const barra = linha.querySelectorAll('.barra-progresso__fill')[indice];
      if (barra) {
        barra.style.width = `${servidor[recurso]}%`;
        barra.classList.remove('barra-progresso__fill--ok', 'barra-progresso__fill--atencao');
        barra.classList.add(servidor.status === 'atencao' ? 'barra-progresso__fill--atencao' : 'barra-progresso__fill--ok');
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

  new Chart(ctxRede, {
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
}

// Gráfico de rosca do resumo de saúde
function inicializarGraficoSaude() {
  const ctxSaude = document.getElementById('grafico-saude');
  if (!ctxSaude) return;

  new Chart(ctxSaude, {
    type: 'doughnut',
    data: {
      labels: ['Online', 'Atenção', 'Offline'],
      datasets: [{
        data: ['online', 'atencao', 'offline'].map((status) => window.InfraTechDashboardData.servidores.filter((servidor) => servidor.status === status).length),
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
});
