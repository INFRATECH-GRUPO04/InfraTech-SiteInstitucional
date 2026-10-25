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
    let cargoFormatado = 'GESTOR';
    const acessoUpper = acessoSalvo.toUpperCase();

    if (acessoUpper === 'ADMIN') {
      cargoFormatado = 'ADMINISTRADOR';
    } else if (acessoUpper === 'GESTOR') {
      cargoFormatado = 'GESTOR';
    } else if (acessoUpper === 'FUNCIONARIO' || acessoUpper === 'ANALISTA') {
      cargoFormatado = 'ANALISTA';
    } else {
      cargoFormatado = acessoUpper;
    }

    if (elCargo) {
      elCargo.textContent = cargoFormatado;
    }
  }
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
      labels: ['00h', '04h', '08h', '12h', '16h', '20h'],
      datasets: [{
        label: 'Tráfego',
        data: [18, 16, 68, 88, 42, 26],
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
        data: [4, 1, 1],
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

// Inicialização automática ao carregar o DOM
document.addEventListener('DOMContentLoaded', function () {
  carregarUsuario();
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  inicializarGraficoRede();
  inicializarGraficoSaude();
  inicializarHamburguer();
});
