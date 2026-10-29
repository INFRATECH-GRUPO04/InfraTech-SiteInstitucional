/* Fonte única das leituras compartilhadas pelas dashboards. */
window.InfraTechDashboardData = {
  dataLeitura: '2026-10-25T11:35:00',
  servidores: [
    { id: 'SRV-BR-01', cidade: 'São Paulo', status: 'online', cpu: 42, ram: 67, disco: 54, disponibilidade: 99.8, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-02', cidade: 'Rio de Janeiro', status: 'online', cpu: 28, ram: 51, disco: 38, disponibilidade: 99.5, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-03', cidade: 'Curitiba', status: 'atencao', cpu: 78, ram: 83, disco: 71, disponibilidade: 96.2, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-04', cidade: 'Brasília', status: 'offline', cpu: null, ram: null, disco: null, disponibilidade: null, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-05', cidade: 'Recife', status: 'online', cpu: 35, ram: 44, disco: 29, disponibilidade: 98.7, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-06', cidade: 'Salvador', status: 'online', cpu: 21, ram: 38, disco: 45, disponibilidade: 99.1, memoriaTotalGb: 32, discoTotalGb: 400 }
  ],
  historicoServidor: {
    'SRV-BR-01': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [32, 30, 30, 37, 65, 40, 38, 42, 46, 50, 94, 72, 42],
      ram: [77, 33, 49, 52, 60, 56, 55, 61, 86, 76, 70, 78, 67],
      disco: [43, 37, 40, 43, 51, 47, 46, 52, 58, 64, 97, 74, 54]
    }
  },
  picoSemanalFrota: [
    { dia: 'Segunda · 19/10', picos: [56, 68, 84, 48], minutosCriticos: [0, 0, 0, 0] },
    { dia: 'Terça · 20/10', picos: [58, 72, 88, 51], minutosCriticos: [0, 0, 0, 0] },
    { dia: 'Quarta · 21/10', picos: [61, 76, 91, 55], minutosCriticos: [0, 0, 60, 0] },
    { dia: 'Quinta · 22/10', picos: [60, 79, 92, 57], minutosCriticos: [0, 0, 70, 0] },
    { dia: 'Sexta · 23/10', picos: [64, 85, 96, 68], minutosCriticos: [0, 0, 90, 0] },
    { dia: 'Sábado · 24/10', picos: [69, 93, 99, 82], minutosCriticos: [0, 75, 121, 0] },
    { dia: 'Domingo · 25/10', picos: [65, 86, 97, 77], minutosCriticos: [0, 0, 84, 0] }
  ],
  rede: {
    horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
    mbps: [18, 35, 70, 88, 80, 42, 26, 30],
    picoMbps: 88
  },
  prioridade: ['SRV-BR-03', 'SRV-BR-04', 'SRV-BR-01', 'SRV-BR-02', 'SRV-BR-06', 'SRV-BR-05']
};

function formatarCargoDashboard(tipoAcesso) {
  var cargos = {
    ADMIN: 'ADMINISTRADOR',
    INFRATECH: 'ADMINISTRADOR',
    GESTOR: 'GESTOR',
    ANALISTA_DADOS: 'ANALISTA DE DADOS',
    ANALISTA_NOC: 'ANALISTA NOC',
    ANALISTA: 'ANALISTA',
    FUNCIONARIO: 'FUNCIONÁRIO'
  };
  var tipo = (tipoAcesso || '').toUpperCase();
  return cargos[tipo] || tipo || 'USUÁRIO';
}

function carregarIdentidadeDashboards() {
  var nome = sessionStorage.NOME_USUARIO || 'Usuário';
  var cargo = formatarCargoDashboard(sessionStorage.TIPO_ACESSO);
  var nomeEl = document.getElementById('nome_usuario');
  var cargoEl = document.getElementById('cargo_usuario');
  if (nomeEl) nomeEl.textContent = nome.toUpperCase();
  if (cargoEl) cargoEl.textContent = cargo;

  var leitura = new Date(window.InfraTechDashboardData.dataLeitura);
  var textoLeitura = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(leitura);
  document.querySelectorAll('[data-leitura-dashboard]').forEach(function (elemento) {
    elemento.textContent = `ÚLTIMA LEITURA · ${textoLeitura}`;
  });

  var relogio = document.getElementById('relogio');
  if (!relogio) return;
  var agora = new Date();
  relogio.textContent = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(agora);
}

document.addEventListener('DOMContentLoaded', function () {
  if (window.Chart) window.Chart.defaults.font.family = 'Inter, sans-serif';
  carregarIdentidadeDashboards();
  window.setInterval(carregarIdentidadeDashboards, 60000);
});
