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
      const celulaMetricas = linha.querySelectorAll('.celula-metrica')[indice];
      let estadoTexto = celulaMetricas && celulaMetricas.querySelector('.celula-metrica__estado');
      if (celulaMetricas && !estadoTexto) {
        estadoTexto = document.createElement('small');
        estadoTexto.className = 'celula-metrica__estado';
        celulaMetricas.append(estadoTexto);
      }
      if (estadoTexto) {
        estadoTexto.className = `celula-metrica__estado metric-color--${faixa}`;
        estadoTexto.textContent = faixa === 'saudavel' ? 'Saudável' : faixa === 'atencao' ? 'Atenção' : faixa === 'critico' ? 'Crítico' : 'Sem dados';
      }
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
  const servidoresOffline = dados.servidores.filter((servidor) => servidor.status === 'offline');
  const resumoAtencao = document.getElementById('resumo-atencao');
  const resumoOffline = document.getElementById('resumo-offline');
  if (resumoAtencao) resumoAtencao.textContent = `• ${totalAtencao} atenção · última leitura`;
  if (resumoOffline) resumoOffline.textContent = `• ${offline} offline`;
  const problema = document.getElementById('kpi-problemas');
  if (problema) problema.textContent = totalAtencao + offline;
  const offlineBadge = document.getElementById('servidores-offline-badge');
  if (offlineBadge) offlineBadge.textContent = offline ? `↗ ${offline} offline` : 'Todos online';
  const offlineDetalhe = document.getElementById('servidores-offline-detalhe');
  const linkOffline = document.getElementById('investigar-offline');
  if (offlineDetalhe) offlineDetalhe.textContent = offline ? `${dados.servidores.find((servidor) => servidor.status === 'offline')?.id} offline` : 'Nenhum servidor offline';
  if (linkOffline) {
    linkOffline.hidden = !offline;
    if (offline) linkOffline.href = `./especifica-servidor/dash-especifica.html?servidor=${encodeURIComponent(dados.servidores.find((servidor) => servidor.status === 'offline').id)}`;
  }
  const problemasBadge = document.getElementById('alerta-problemas-badge');
  if (problemasBadge) problemasBadge.textContent = `${offline} offline · ${totalAtencao} ${totalAtencao === 1 ? 'servidor com leitura em atenção/crítica' : 'servidores com leitura em atenção/crítica'}`;
  const problemasDetalhe = document.getElementById('problemas-detalhe');
  if (problemasDetalhe) {
    const atencaoPrincipal = dados.servidores.find((servidor) => servidor.status === 'online'
      && ['cpu', 'ram', 'disco'].some((recurso) => ['atencao', 'critico'].includes(classificarMetrica(recurso, servidor[recurso], servidor.id))));
    const recursoPrincipal = atencaoPrincipal && ['cpu', 'ram', 'disco'].map((recurso) => ({ recurso, valor: atencaoPrincipal[recurso], estado: classificarMetrica(recurso, atencaoPrincipal[recurso], atencaoPrincipal.id) }))
      .filter((item) => ['atencao', 'critico'].includes(item.estado)).sort((a, b) => (a.estado === 'critico' ? 1 : 0) - (b.estado === 'critico' ? 1 : 0)).pop();
    const detalhePrincipal = atencaoPrincipal && recursoPrincipal ? `${atencaoPrincipal.id}: ${recursoPrincipal.recurso.toUpperCase()} ${recursoPrincipal.valor}% (${recursoPrincipal.estado})` : '';
    problemasDetalhe.textContent = [offline ? `${offline} indisponível` : '', totalAtencao ? `${totalAtencao} com leitura de recurso em atenção` : '', 'incidente persistente sem confirmação temporal', detalhePrincipal].filter(Boolean).join(' · ');
  }
  const saudaveisNaLeitura = online - totalAtencao;
  const contagemSaudavel = document.getElementById('saude-online');
  const contagemAtencao = document.getElementById('saude-atencao');
  const contagemOffline = document.getElementById('saude-offline');
  if (contagemSaudavel) contagemSaudavel.textContent = saudaveisNaLeitura;
  if (contagemAtencao) contagemAtencao.textContent = totalAtencao;
  if (contagemOffline) contagemOffline.textContent = offline;
  if (graficoSaude) {
    graficoSaude.data.datasets[0].data = [online - totalAtencao, totalAtencao, offline];
    graficoSaude.update();
  }
  atualizarIndicadorRede();
  atualizarIndicadorDisponibilidade();
  atualizarCorGraficoRede();
}

function atualizarIndicadorDisponibilidade() {
  const servidores = window.InfraTechDashboardData.servidores;
  const leituras = servidores.filter((servidor) => servidor.disponibilidade != null)
    .map((servidor) => Number(servidor.disponibilidade)).filter(Number.isFinite);
  const valor = document.getElementById('disponibilidade-valor');
  const badge = document.getElementById('disponibilidade-badge');
  const detalhe = document.getElementById('disponibilidade-detalhe');
  const ponto = document.getElementById('disponibilidade-ponto');
  if (!valor || !badge || !detalhe || !ponto) return;
  if (!leituras.length) {
    valor.textContent = 'Sem dados';
    badge.textContent = 'Período indisponível';
    detalhe.textContent = 'Não há disponibilidade registrada para a frota.';
    return;
  }
  const media = leituras.reduce((soma, item) => soma + item, 0) / leituras.length;
  const formatado = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(media);
  const estado = media >= 99 ? 'estavel' : 'atencao';
  valor.textContent = `${formatado}%`;
  badge.textContent = media >= 99 ? 'Estável · média da frota' : 'Atenção · média da frota';
  badge.className = `kpi-card__alerta ${media >= 99 ? 'kpi-card__alerta--ok' : 'kpi-card__alerta--laranja'}`;
  ponto.className = `ponto ${media >= 99 ? 'ponto--online' : 'ponto--atencao'}`;
  detalhe.textContent = `Média de ${leituras.length} servidores · 19–25 out 2026`;
  valor.setAttribute('aria-label', `Disponibilidade média da frota ${formatado}%, faixa ${estado}`);
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
    const nomeServidor = linha.querySelector('.celula-servidor__nome');
    if (nomeServidor) nomeServidor.textContent = servidor.id;
    if (linha.cells[1]) linha.cells[1].textContent = servidor.cidade;
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
      if (servidor.disponibilidade == null) {
        disponibilidade.className = 'disponibilidade disponibilidade--sem-dados';
        disponibilidade.textContent = 'Sem histórico';
        if (detalheDisponibilidade) detalheDisponibilidade.textContent = 'Período não informado';
      } else {
        const estavel = servidor.disponibilidade >= 99;
        disponibilidade.className = `disponibilidade disponibilidade--${estavel ? 'estavel' : 'instavel'}`;
        disponibilidade.textContent = estavel ? 'Estável' : 'Instável';
        if (detalheDisponibilidade) detalheDisponibilidade.textContent = `${servidor.disponibilidade.toFixed(1)}% no período informado`;
      }
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
    badgeRede.textContent = `● pico da frota · ${dados.rede.picoMbps} Mbps`;
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
  gradiente.addColorStop(0, 'rgb(168 85 247 / 0.22)');
  gradiente.addColorStop(1, 'rgb(168 85 247 / 0.00)');

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

  // Abre ou fecha a barra lateral
  btnHamburguer.addEventListener('click', function () {
    sidebar.classList.toggle('aberta');
    overlay.classList.toggle('visivel');
  });

  // Fecha ao clicar no sobreposição
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

const DEFINICOES_HISTORICO_ALERTAS = [
  { servidorId: 'SRV-BR-04', recurso: 'status', indice: 11, titulo: 'Servidor indisponível', status: 'Em andamento', duracao: 'Indisponibilidade registrada desde 22h; duração calculada até a última leitura mock.' },
  { servidorId: 'SRV-BR-03', recurso: 'cpu', indice: 10, titulo: 'CPU acima do limite', status: 'Pendente de confirmação', duracao: 'Amostras espaçadas em 2h; duração contínua não confirmada.' },
  { servidorId: 'SRV-BR-03', recurso: 'ram', indice: 10, titulo: 'Memória RAM elevada', status: 'Pendente de confirmação', duracao: 'Amostras espaçadas em 2h; duração contínua não confirmada.' },
  { servidorId: 'SRV-BR-03', recurso: 'disco', indice: 10, titulo: 'Armazenamento próximo do limite', status: 'Normalizado na leitura', duracao: 'A faixa voltou ao normal na amostra das 22h; não equivale à resolução confirmada de incidente.' },
  { servidorId: 'SRV-BR-01', recurso: 'cpu', indice: 10, titulo: 'Pico de utilização da CPU', status: 'Normalizado na leitura', duracao: 'A faixa voltou ao normal na amostra das 24h; não equivale à resolução confirmada de incidente.' },
  { servidorId: 'SRV-BR-01', recurso: 'disco', indice: 10, titulo: 'Pico de utilização do disco', status: 'Normalizado na leitura', duracao: 'A faixa voltou ao normal na amostra das 22h; não equivale à resolução confirmada de incidente.' }
];

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);
}

function obterOcorrenciasMock() {
  const dados = window.InfraTechDashboardData;
  const dataLeitura = new Date(dados.dataLeitura);
  const dataTexto = Number.isNaN(dataLeitura.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR').format(dataLeitura);
  return DEFINICOES_HISTORICO_ALERTAS.map((definicao) => {
    const servidor = dados.obterServidorPorId(definicao.servidorId);
    if (!servidor) return null;
    if (definicao.recurso === 'status') {
      const desde = servidor.offlineDesde || '—';
      const partesHora = desde.match(/^(\d{1,2})h$/);
      const minutosDuracao = partesHora && !Number.isNaN(dataLeitura.getTime()) ? Math.max(0, dataLeitura.getHours() * 60 + dataLeitura.getMinutes() - Number(partesHora[1]) * 60) : null;
      const duracao = minutosDuracao == null ? 'Não disponível no mock.' : `${Math.floor(minutosDuracao / 60)}h ${minutosDuracao % 60}min desde ${desde} até a última leitura.`;
      return { ...definicao, hora: desde, data: dataTexto, valor: 'Sem leitura', severidade: 'critico', servidor, duracao, impacto: 'Serviços vinculados a este servidor não estão cadastrados; o impacto operacional não pode ser determinado.' };
    }
    const historico = dados.obterHistoricoServidor(servidor.id);
    const valor = historico?.[definicao.recurso]?.[definicao.indice];
    if (valor == null) return null;
    const severidade = classificarMetrica(definicao.recurso, valor, servidor.id);
    const hora = historico.horas[definicao.indice];
    const faixa = window.InfraTechAlertas.obter(servidor.id)[definicao.recurso];
    const leituraAtual = servidor[definicao.recurso];
    const estadoAtual = classificarMetrica(definicao.recurso, leituraAtual, servidor.id);
    const normalizado = estadoAtual === 'saudavel';
    return {
      ...definicao,
      status: normalizado ? 'Normalizado na leitura' : 'Pendente de confirmação',
      duracao: normalizado
        ? definicao.duracao
        : 'A condição aparece em amostras espaçadas em 2h; duração contínua e incidente não confirmados.',
      hora,
      data: dataTexto,
      valor: `${valor}%`,
      severidade,
      servidor,
      faixa: `Atenção ≥${faixa.atencao}% · crítico ≥${faixa.critico}%`,
      impacto: 'Não há vínculo de serviços neste mock; não é possível afirmar risco ou impacto em aplicações.'
    };
  }).filter(Boolean).sort((a, b) => parseInt(b.hora, 10) - parseInt(a.hora, 10));
}

function renderizarHistoricoAlertas(filtro = 'todos') {
  const lista = document.getElementById('historicoAlertas');
  if (!lista) return;
  const ocorrencias = obterOcorrenciasMock();
  const visiveis = ocorrencias.filter((ocorrencia) => filtro === 'todos' || ocorrencia.severidade === filtro);
  lista.innerHTML = '';
  if (!visiveis.length) {
    lista.innerHTML = '<li class="historico-alertas__vazio">Nenhuma ocorrência nesta faixa no período simulado.</li>';
    return;
  }
  visiveis.forEach((ocorrencia) => {
    const item = document.createElement('li');
    item.className = `ocorrencia ocorrencia--${ocorrencia.severidade}`;
    const estadoTexto = ocorrencia.severidade === 'critico' ? 'Crítico' : ocorrencia.severidade === 'atencao' ? 'Atenção' : 'Informativo';
    const recursoQuery = ocorrencia.recurso === 'status' ? 'cpu' : ocorrencia.recurso;
    const linkDetalhes = `./especifica-servidor/dash-especifica.html?servidor=${encodeURIComponent(ocorrencia.servidor.id)}&recurso=${encodeURIComponent(recursoQuery)}`;
    item.innerHTML = `
      <div class="ocorrencia__linha">
        <span class="ocorrencia__ponto" aria-hidden="true"></span>
        <div class="ocorrencia__resumo">
          <div class="ocorrencia__titulo-linha"><strong>${escaparHTML(ocorrencia.titulo)}</strong><span class="ocorrencia__severidade ocorrencia__severidade--${ocorrencia.severidade}">${estadoTexto}</span></div>
          <p>${escaparHTML(ocorrencia.servidor.id)} · ${escaparHTML(ocorrencia.data)} ${escaparHTML(ocorrencia.hora)} · <b>${escaparHTML(ocorrencia.valor)}</b></p>
          <span class="ocorrencia__status">Status: ${escaparHTML(ocorrencia.status)}</span>
        </div>
      </div>
      <details class="ocorrencia__detalhes">
        <summary>Ver detalhes</summary>
        <dl>
          <div><dt>Duração</dt><dd>${escaparHTML(ocorrencia.duracao)}</dd></div>
          ${ocorrencia.faixa ? `<div><dt>Limites configurados</dt><dd>${escaparHTML(ocorrencia.faixa)}</dd></div>` : ''}
          <div><dt>Impacto operacional</dt><dd>${escaparHTML(ocorrencia.impacto)}</dd></div>
          <div><dt>Responsável</dt><dd>Não atribuído nos dados simulados.</dd></div>
        </dl>
        <a href="${linkDetalhes}">Abrir gráfico do servidor e recurso →</a>
      </details>`;
    lista.append(item);
  });
}

function inicializarHistoricoAlertas() {
  const filtros = document.querySelectorAll('[data-filtro-alerta]');
  filtros.forEach((botao) => botao.addEventListener('click', () => {
    filtros.forEach((item) => {
      const ativo = item === botao;
      item.classList.toggle('ativo', ativo);
      item.setAttribute('aria-pressed', String(ativo));
    });
    renderizarHistoricoAlertas(botao.dataset.filtroAlerta);
  }));
  renderizarHistoricoAlertas();
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
  inicializarHistoricoAlertas();
  window.addEventListener('infratech:limites-alerta-alterados', atualizarCoresMetricas);
  window.addEventListener('infratech:limites-alerta-alterados', () => {
    const filtroAtivo = document.querySelector('[data-filtro-alerta].ativo')?.dataset.filtroAlerta || 'todos';
    renderizarHistoricoAlertas(filtroAtivo);
  });
  window.addEventListener('storage', () => window.InfraTechAlertas.sincronizarBackend().finally(atualizarCoresMetricas));
});
