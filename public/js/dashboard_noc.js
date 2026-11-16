(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const fetchJson = (url) => fetch(url, { credentials: 'same-origin' }).then((r) => (r.status === 200 ? r.json() : null)).catch(() => null);

  const LIMITES_PADRAO = {
    cpu: { atencao: 75, critico: 90 },
    ram: { atencao: 75, critico: 90 },
    disco: { atencao: 80, critico: 90 },
    rede: { atencao: 75, critico: 90 }
  };

  const state = {
    servidores: [],
    limitesGlobais: clone(LIMITES_PADRAO),
    filtroStatus: 'all',
    filtroBusca: '',
    servidorId: null,
    encolhida: false,
    janela: '3h',
    lotes: '5m'
  };

  /* =====================================================================
   * MOCK S3 (JSON GOLD) + FALLBACK DE SERVIDORES
   * ===================================================================== */
  const MOCK_HOSTS = [
    { id_servidor: 101, nome: 'SRV-BR-04', localizacao: 'São Paulo · Zona A' },
    { id_servidor: 102, nome: 'SRV-BR-03', localizacao: 'São Paulo · Zona B' },
    { id_servidor: 103, nome: 'SRV-BR-02', localizacao: 'Campinas · Edge' },
    { id_servidor: 104, nome: 'SRV-BR-05', localizacao: 'Rio de Janeiro · Zona A' },
    { id_servidor: 105, nome: 'SRV-BR-01', localizacao: 'São Paulo · Core' },
    { id_servidor: 106, nome: 'SRV-BR-06', localizacao: 'Curitiba · Backup' }
  ];

  const PERFIS_S3 = {
    'SRV-BR-04': { semTelemetria: true, ultimoEnvio: '21:30', lotesAusentes: 3, duracao: '15 min', chamado: 'IFT-139', responsavel: 'Bianca', ticketStatus: 'Aberto', down: 0, up: 0, processos: [] },
    'SRV-BR-03': { ultimoEnvio: '21:45', duracao: '15 min', chamado: 'IFT-142', responsavel: 'Júlio', ticketStatus: 'Em atendimento', cpu: 92, ram: 84, disco: 71, down: 110, up: 95, processos: [{ pid: 4812, nome: 'game-server', user: 'ubuntu' }, { pid: 1464, nome: 'redis-server', user: 'redis' }, { pid: 9021, nome: 'match_logger', user: 'ubuntu' }] },
    'SRV-BR-02': { ultimoEnvio: '21:45', duracao: '10 min', chamado: 'Em triagem', responsavel: 'Júlio', ticketStatus: 'Em observação', cpu: 64, ram: 81, disco: 58, down: 48, up: 32, processos: [{ pid: 2210, nome: 'postgres', user: 'postgres' }, { pid: 3104, nome: 'node-api', user: 'app' }, { pid: 1180, nome: 'nginx', user: 'www-data' }] },
    'SRV-BR-05': { ultimoEnvio: '21:45', duracao: '5 min', chamado: 'Em triagem', responsavel: 'Não atribuído', ticketStatus: 'Pendente', cpu: 52, ram: 61, disco: 83, down: 24, up: 18, processos: [{ pid: 5512, nome: 'backup-agent', user: 'root' }, { pid: 1922, nome: 'minio', user: 'minio' }] },
    'SRV-BR-01': { ultimoEnvio: '21:45', duracao: '—', chamado: '—', responsavel: '—', ticketStatus: 'Normalizado', cpu: 38, ram: 49, disco: 44, down: 16, up: 12, processos: [{ pid: 1044, nome: 'haproxy', user: 'haproxy' }, { pid: 2890, nome: 'auth-service', user: 'app' }] },
    'SRV-BR-06': { ultimoEnvio: '21:45', duracao: '—', chamado: '—', responsavel: '—', ticketStatus: 'Normalizado', cpu: 29, ram: 41, disco: 39, down: 7, up: 5, processos: [{ pid: 812, nome: 'systemd-journald', user: 'root' }, { pid: 2041, nome: 'prometheus-node', user: 'nobody' }] }
  };

  const JANELAS = { '1h': [8, 60], '3h': [12, 180], '6h': [14, 360], '24h': [16, 1440] };
  const LOTES_DELTA = { '1m': 4, '5m': 0, '15m': -3 };

  const hash = (str) => Math.abs([...str].reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0));

  // Substituir por fetch('/telemetria/s3/...') quando a camada S3 Gold estiver pronta
  function obterTelemetriaS3Mock(srv, janela, lotes) {
    const nome = String(srv.nome || 'SRV');
    let p = PERFIS_S3[nome];
    if (!p) {
      const s = hash(nome);
      const semTel = s % 11 === 0;
      const cpu = 32 + (s % 63);
      const ram = 40 + ((s >> 3) % 48);
      p = {
        semTelemetria: semTel,
        ultimoEnvio: semTel ? '21:25' : '21:45',
        lotesAusentes: semTel ? 4 : 0,
        duracao: cpu >= 90 ? '10 min' : ram >= 75 ? '5 min' : '—',
        chamado: cpu >= 90 ? `IFT-${140 + (s % 50)}` : '—',
        responsavel: cpu >= 90 ? 'Júlio' : '—',
        ticketStatus: cpu >= 90 ? 'Em atendimento' : 'Normalizado',
        cpu: semTel ? null : cpu,
        ram: semTel ? null : ram,
        disco: semTel ? null : 35 + ((s >> 5) % 52),
        down: semTel ? 0 : 15 + (s % 85),
        up: semTel ? 0 : 10 + (s % 65),
        processos: semTel ? [] : [
          { pid: 1200 + (s % 900), nome: 'game-worker', user: 'app' },
          { pid: 3200 + (s % 500), nome: 'telemetry-agent', user: 'root' }
        ]
      };
    }

    const [basePts, mins] = JANELAS[janela] || JANELAS['3h'];
    const qtd = Math.max(6, basePts + (LOTES_DELTA[lotes] || 0));
    const fim = 21 * 60 + 45;
    const series = [];

    if (!p.semTelemetria) {
      const s = hash(nome + janela + lotes);
      for (let i = 0; i < qtd; i++) {
        const frac = i / (qtd - 1);
        const t = ((Math.round(fim - mins + frac * mins) % 1440) + 1440) % 1440;
        const hora = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        const onda = Math.sin(i * 0.75 + (s % 5)) * 9 + Math.cos(i * 0.4) * 5;
        const tend = (frac - 0.5) * 18;
        const ultimo = i === qtd - 1;

        series.push({
          hora,
          cpu: ultimo ? p.cpu : Math.max(8, Math.min(99, Math.round(p.cpu - 14 + tend + onda))),
          ram: ultimo ? p.ram : Math.max(15, Math.min(97, Math.round(p.ram - 9 + tend * 0.6 + onda * 0.5))),
          down: ultimo ? p.down : Math.max(2, Math.round(p.down * (0.6 + 0.4 * Math.sin(i * 0.6 + 1) + frac * 0.25))),
          up: ultimo ? p.up : Math.max(1, Math.round(p.up * (0.6 + 0.35 * Math.cos(i * 0.5) + frac * 0.2)))
        });
      }
    }

    return { ...p, series };
  }

  /* =====================================================================
   * CARREGAMENTO DO BANCO (NODE API) + CLASSIFICAÇÃO
   * ===================================================================== */
  const aplicarLimites = (destino, itens) => {
    (itens || []).forEach((item) => {
      if (item.tipo && destino[item.tipo] && item.limite_atencao != null && item.limite_critico != null) {
        destino[item.tipo] = { atencao: Number(item.limite_atencao), critico: Number(item.limite_critico) };
      }
    });
  };

  async function carregarDados() {
    let lista = [];
    let usouBanco = false;

    const usuario = typeof carregarSessaoConfiavel === 'function' ? await carregarSessaoConfiavel() : null;
    if (usuario?.idEmpresa) {
      if (typeof validarSessao === 'function') await validarSessao().catch(() => {});
      const [servs, globais] = await Promise.all([
        fetchJson(`/servidor/listar/${usuario.idEmpresa}`),
        fetchJson(`/servidor/alertas/globais/${usuario.idEmpresa}`)
      ]);
      aplicarLimites(state.limitesGlobais, globais);

      if (Array.isArray(servs) && servs.length) {
        lista = await Promise.all(servs.map(async (srv) => {
          const limites = clone(state.limitesGlobais);
          aplicarLimites(limites, await fetchJson(`/servidor/listarComponentes/${srv.id_servidor}`));
          return { ...srv, limites };
        }));
        usouBanco = true;
      }
    }

    if (!usouBanco) {
      lista = MOCK_HOSTS.map((srv) => ({ ...srv, limites: clone(state.limitesGlobais) }));
    }

    $('data-source-badge').textContent = usouBanco ? 'BANCO (LIMITES/HOSTS) + JSON S3 (MOCK)' : 'MODO DEMONSTRAÇÃO · DADOS SIMULADOS';
    state.servidores = lista.map((srv) => {
      const telemetria = obterTelemetriaS3Mock(srv, state.janela, state.lotes);
      return { ...srv, telemetria, ...classificarServidor(srv, telemetria) };
    }).sort((a, b) => a.peso - b.peso || String(a.nome).localeCompare(String(b.nome)))
      .map((srv, i) => ({ ...srv, prioridade: i + 1 }));

    renderizarTudo();
  }

  function classificarServidor(srv, tel) {
    if (tel.semTelemetria) {
      return { estado: 'neutral', rotuloEstado: 'Sem telemetria', motivo: `${tel.lotesAusentes || 3} lotes ausentes`, peso: 1 };
    }
    const lim = srv.limites || state.limitesGlobais;
    const labels = { cpu: 'CPU', ram: 'RAM', disco: 'Disco' };
    const violacoes = Object.entries(labels).flatMap(([k, nome]) => {
      if (tel[k] >= lim[k].critico) return [{ nivel: 2, texto: `${nome} ${tel[k]}% > ${lim[k].critico}%` }];
      if (tel[k] >= lim[k].atencao) return [{ nivel: 1, texto: `${nome} ${tel[k]}% > ${lim[k].atencao}%` }];
      return [];
    }).sort((a, b) => b.nivel - a.nivel);

    if (violacoes[0]?.nivel === 2) return { estado: 'critical', rotuloEstado: 'Crítico', motivo: violacoes[0].texto, peso: 2 };
    if (violacoes[0]?.nivel === 1) return { estado: 'warning', rotuloEstado: 'Atenção', motivo: violacoes[0].texto, peso: 3 };
    return { estado: 'healthy', rotuloEstado: 'Saudável', motivo: 'Sem alerta ativo', peso: 4 };
  }

  /* =====================================================================
   * RENDERIZAÇÃO
   * ===================================================================== */
  function renderizarKPIs() {
    const srvs = state.servidores;
    const total = srvs.length;
    const count = (e) => srvs.filter((s) => s.estado === e).length;
    const criticos = count('critical');
    const atencao = count('warning');
    const semTel = count('neutral');
    const emAlerta = criticos + atencao;
    const down = srvs.reduce((acc, s) => acc + (s.telemetria.down || 0), 0);
    const up = srvs.reduce((acc, s) => acc + (s.telemetria.up || 0), 0);

    $('kpi-alerta-val').textContent = `${emAlerta} de ${total}`;
    $('kpi-alerta-sub').textContent = `${criticos} crítico(s) · ${atencao} em atenção`;
    $('kpi-alerta-card').className = `noc-panel kpi-card ${criticos ? 'kpi-card--critical' : emAlerta ? 'kpi-card--warning' : 'kpi-card--healthy'}`;

    $('kpi-telemetria-val').textContent = `${semTel} de ${total}`;
    $('kpi-telemetria-sub').textContent = semTel ? 'Ausência de lotes; verificar agente' : 'Coleta S3 operacional';

    $('kpi-trafego-val').textContent = `${down + up} Mbps`;
    $('kpi-trafego-sub').textContent = `Download ${down} · Upload ${up} Mbps`;

    $('kpi-critico-val').textContent = criticos ? '15 min' : atencao ? '10 min' : '0 min';
    $('kpi-critico-sub').textContent = criticos ? 'Acima do limite crítico' : 'Nenhum servidor em criticidade';
    $('kpi-critico-card').className = `noc-panel kpi-card ${criticos ? 'kpi-card--critical' : 'kpi-card--healthy'}`;
  }

  function renderizarListaServidores() {
    const counts = { all: state.servidores.length, critical: 0, warning: 0, neutral: 0, healthy: 0 };
    state.servidores.forEach((s) => { counts[s.estado]++; });
    Object.entries(counts).forEach(([k, v]) => { if ($(`cnt-${k}`)) $(`cnt-${k}`).textContent = v; });

    const termo = state.filtroBusca.trim().toLowerCase();
    const filtrados = state.servidores.filter((s) =>
      (state.filtroStatus === 'all' || s.estado === state.filtroStatus) &&
      (!termo || [s.nome, s.localizacao, s.telemetria.chamado].some((v) => String(v || '').toLowerCase().includes(termo)))
    );

    $('servers-count-badge').textContent = `${filtrados.length} de ${state.servidores.length} servidores`;
    $('btn-clear-server-filters').hidden = state.filtroStatus === 'all' && !termo;

    const tbody = $('servers-table-body');
    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--noc-muted);padding:20px;">Nenhum servidor corresponde aos filtros atuais.</td></tr>';
    } else {
      tbody.innerHTML = filtrados.map((s) => `
        <tr class="server-row${s.id_servidor === state.servidorId ? ' is-selected' : ''}" tabindex="0" data-id="${s.id_servidor}">
          <td><strong>#${s.prioridade}</strong></td>
          <td><div class="server-name-cell"><strong>${esc(s.nome)}</strong><small>${esc(s.localizacao || 'Região padrão')}</small></div></td>
          <td><span class="badge-status ${s.estado}"><span class="badge-dot"></span>${s.rotuloEstado}</span></td>
          <td>${esc(s.motivo)}</td>
          <td>${esc(s.telemetria.duracao)}</td>
          <td>${esc(s.telemetria.ultimoEnvio)}</td>
          <td>${esc(s.telemetria.chamado)}</td>
          <td><span class="inspect-pill">Inspecionar →</span></td>
        </tr>`).join('');

      tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
        const abrir = () => {
          state.servidorId = Number(tr.dataset.id);
          state.encolhida = true;
          renderizarTudo();
        };
        tr.addEventListener('click', abrir);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
      });
    }

    const srv = obterSelecionado();
    const encolhida = Boolean(state.encolhida && srv);
    $('server-list-panel').classList.toggle('is-collapsed', encolhida);
    $('select-prompt').hidden = Boolean(srv);
    $('noc-detail-section').hidden = !srv;

    if (encolhida) {
      $('collapsed-name').textContent = srv.nome;
      $('collapsed-location').textContent = srv.localizacao || 'Região padrão';
      const badge = $('collapsed-status-badge');
      badge.className = `badge-status ${srv.estado}`;
      badge.innerHTML = `<span class="badge-dot"></span>${srv.rotuloEstado}`;
      $('collapsed-reason').textContent = srv.motivo;
      $('collapsed-duration').textContent = srv.telemetria.duracao;
      $('collapsed-last').textContent = srv.telemetria.ultimoEnvio;
      $('collapsed-ticket').textContent = srv.telemetria.chamado;
    }
  }

  const obterSelecionado = () => state.servidores.find((s) => s.id_servidor === state.servidorId) || null;

  function renderizarDetalhesServidor() {
    const srv = obterSelecionado();
    if (!srv) return;
    const tel = obterTelemetriaS3Mock(srv, state.janela, state.lotes);
    const lim = srv.limites || state.limitesGlobais;

    $('ctx-server-name').textContent = srv.nome;
    $('ctx-last-batch').textContent = tel.ultimoEnvio;
    $('resource-chart-title').textContent = `Histórico de recursos — ${srv.nome}`;
    $('resource-chart-sub').textContent = `Janela ${state.janela} · Lotes de ${state.lotes} · Limite CPU ${lim.cpu.critico}%`;
    $('network-chart-title').textContent = `Rede — ${srv.nome}`;
    $('incidents-title').textContent = `Incidentes — ${srv.nome}`;
    $('resources-title').textContent = `Recursos e processos — ${srv.nome}`;

    // Gráfico 1: Recursos (CPU e RAM)
    if (tel.semTelemetria || !tel.series.length) {
      $('resource-chart-container').innerHTML = `<div class="telemetry-empty"><strong>Sem telemetria na janela selecionada</strong><p style="margin:6px 0 0;font-size:13px;">Último envio às ${tel.ultimoEnvio}. Verifique o agente em ${esc(srv.nome)}.</p></div>`;
    } else {
      const ult = tel.series.at(-1);
      renderizarGraficoSVG({
        containerId: 'resource-chart-container',
        tooltipId: 'res-tooltip',
        series: tel.series,
        maxVal: 100,
        unit: '%',
        padL: 62,
        padR: 65,
        seriesCfg: [
          { key: 'cpu', color: 'var(--noc-cyan)', endYOffset: 4 },
          { key: 'ram', color: 'var(--noc-purple)', endYOffset: 14 }
        ],
        extras: (yFor, w, padL, padR) => `
          <line class="warn-line" x1="${padL}" y1="${yFor(lim.cpu.atencao)}" x2="${w - padR}" y2="${yFor(lim.cpu.atencao)}"/>
          <line class="limit-line" x1="${padL}" y1="${yFor(lim.cpu.critico)}" x2="${w - padR}" y2="${yFor(lim.cpu.critico)}"/>
          <text class="limit-label" x="${padL + 8}" y="${yFor(lim.cpu.critico) - 6}">Limite crítico CPU ${lim.cpu.critico}%</text>`,
        endLabels: (yFor, w, padR) => `
          <text class="end-value" fill="var(--noc-cyan)" x="${w - padR + 8}" y="${yFor(ult.cpu) + 4}">${ult.cpu}%</text>
          <text class="end-value" fill="var(--noc-purple)" x="${w - padR + 8}" y="${yFor(ult.ram) + 14}">${ult.ram}%</text>`,
        formatTooltip: (pt) => `<strong>${pt.hora}</strong><br>CPU: ${pt.cpu}% · RAM: ${pt.ram}%`
      });
    }

    // Gráfico 2: Rede (Download e Upload)
    if (tel.semTelemetria || !tel.series.length) {
      $('network-legend').innerHTML = '<span class="legend-item">Sem leitura de interface</span>';
      $('network-chart-container').innerHTML = '<div class="telemetry-empty"><strong>Tráfego de rede indisponível</strong><p style="margin:6px 0 0;font-size:13px;">Aguardando restabelecimento da coleta S3.</p></div>';
    } else {
      const ult = tel.series.at(-1);
      const maxNet = Math.max(60, Math.ceil(Math.max(...tel.series.map((p) => Math.max(p.down, p.up))) / 30) * 30);
      $('network-legend').innerHTML = `
        <span class="legend-item"><i class="legend-dot" style="background:var(--noc-cyan)"></i>Download ${ult.down} Mbps</span>
        <span class="legend-item"><i class="legend-dot" style="background:var(--noc-purple)"></i>Upload ${ult.up} Mbps</span>`;

      renderizarGraficoSVG({
        containerId: 'network-chart-container',
        tooltipId: 'net-tooltip',
        series: tel.series,
        maxVal: maxNet,
        unit: ' Mbps',
        padL: 72,
        padR: 40,
        areaFill: true,
        seriesCfg: [
          { key: 'down', color: 'var(--noc-cyan)', grad: 'dlFill' },
          { key: 'up', color: 'var(--noc-purple)', grad: 'ulFill' }
        ],
        defs: `
          <defs>
            <linearGradient id="dlFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e2ef" stop-opacity=".22"/><stop offset="1" stop-color="#00e2ef" stop-opacity=".02"/></linearGradient>
            <linearGradient id="ulFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bc5ce5" stop-opacity=".26"/><stop offset="1" stop-color="#bc5ce5" stop-opacity=".03"/></linearGradient>
          </defs>`,
        formatTooltip: (pt) => `<strong>${pt.hora}</strong><br>Download: ${pt.down} Mbps · Upload: ${pt.up} Mbps`
      });
    }

    // Incidentes
    $('incidents-tbody').innerHTML = srv.estado === 'healthy'
      ? `<tr><td colspan="5" style="text-align:center;color:var(--noc-muted);padding:18px;">Nenhum incidente ativo para ${esc(srv.nome)}.</td></tr>`
      : `<tr>
          <td><strong>${esc(tel.chamado)}</strong></td>
          <td>${esc(srv.motivo)}</td>
          <td><span class="badge-status ${srv.estado}"><span class="badge-dot"></span>${esc(tel.ticketStatus)}</span></td>
          <td>${esc(tel.responsavel)}</td>
          <td>${srv.estado === 'critical' ? 'Slack enviado' : 'Em monitoramento'}</td>
        </tr>`;
    $('incident-note').textContent = srv.estado === 'healthy'
      ? 'Operação dentro dos limites configurados'
      : srv.estado === 'neutral' ? 'Verificar coleta do agente e conectividade S3' : `Persistência monitorada na janela de ${state.janela}`;

    // Barras de recursos e processos
    if (tel.semTelemetria) {
      $('resource-bars').innerHTML = '<div style="color:var(--noc-muted);font-size:14px;">Barras indisponíveis: servidor sem telemetria recente.</div>';
      $('processes-list').innerHTML = '<li><span class="proc-name"><span class="proc-dot" style="background:var(--noc-purple)"></span>Nenhum snapshot de processo recebido</span></li>';
    } else {
      $('resource-bars').innerHTML = [['CPU', tel.cpu, lim.cpu], ['RAM', tel.ram, lim.ram], ['Disco ocupado', tel.disco, lim.disco]]
        .map(([nome, val, faixa]) => {
          const cor = val >= faixa.critico ? 'var(--noc-red)' : val >= faixa.atencao ? 'var(--noc-yellow)' : 'var(--noc-cyan)';
          return `<div class="resource-row">
            <span>${nome}</span>
            <div class="track" role="meter" aria-label="${nome}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${val}">
              <div class="fill" style="--value:${val}%;background:${cor}"></div>
            </div>
            <strong style="color:${cor};text-align:right;">${val}%</strong>
          </div>`;
        }).join('');

      $('processes-list').innerHTML = (tel.processos || []).map((p) =>
        `<li><span class="proc-name"><span class="proc-dot"></span>${esc(p.nome)}</span><span class="proc-pid">PID ${p.pid} · ${esc(p.user)}</span></li>`
      ).join('');
    }
  }

  function renderizarGraficoSVG({ containerId, tooltipId, series, maxVal, unit, padL, padR, seriesCfg, areaFill, defs = '', extras, endLabels, formatTooltip }) {
    const container = $(containerId);
    const w = 1200, h = 230, padT = 20, padB = 34;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xFor = (i) => padL + (plotW * i) / (series.length - 1);
    const yFor = (v) => Number((padT + plotH * (1 - v / maxVal)).toFixed(1));

    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const val = Math.round(maxVal * f), y = yFor(val);
      return `<line class="grid" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}"/><text x="${padL - 10}" y="${y + 4}" text-anchor="end">${val}${unit}</text>`;
    }).join('');

    const step = Math.max(1, Math.floor(series.length / 6));
    const xLabels = series.map((pt, i) => (i % step && i !== series.length - 1) ? '' :
      `<line class="grid" x1="${xFor(i).toFixed(1)}" y1="${padT}" x2="${xFor(i).toFixed(1)}" y2="${padT + plotH}"/><text x="${xFor(i).toFixed(1)}" y="${h - 8}" text-anchor="middle">${pt.hora}</text>`
    ).join('');

    const shapes = seriesCfg.map((cfg) => {
      const pts = series.map((pt, i) => `${xFor(i).toFixed(1)},${yFor(pt[cfg.key])}`).join(' ');
      const area = areaFill ? `<polygon points="${padL},${padT + plotH} ${pts} ${w - padR},${padT + plotH}" fill="url(#${cfg.grad})"/>` : '';
      const dots = series.map((pt, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(pt[cfg.key])}" r="4" fill="${cfg.color}" data-idx="${i}"/>`).join('');
      return `${area}<polyline class="series" stroke="${cfg.color}" points="${pts}"/>${dots}`;
    }).join('');

    container.innerHTML = `
      <svg class="noc-svg-chart" viewBox="0 0 ${w} ${h}" role="img">
        ${defs}${grid}${xLabels}
        <path class="axis" fill="none" d="M${padL} ${padT}V${padT + plotH}H${w - padR}"/>
        ${extras ? extras(yFor, w, padL, padR) : ''}
        ${shapes}
        ${endLabels ? endLabels(yFor, w, padR) : ''}
      </svg>
      <div class="chart-tooltip" id="${tooltipId}"></div>`;

    const tooltip = $(tooltipId);
    container.querySelectorAll('circle[data-idx]').forEach((circle) => {
      circle.style.cursor = 'pointer';
      circle.addEventListener('mouseenter', (e) => {
        const pt = series[Number(circle.dataset.idx)];
        if (!pt) return;
        tooltip.innerHTML = formatTooltip(pt);
        tooltip.style.display = 'block';
        const rect = container.getBoundingClientRect();
        tooltip.style.left = `${Math.min(rect.width - 170, Math.max(8, e.clientX - rect.left + 12))}px`;
        tooltip.style.top = `${Math.max(8, e.clientY - rect.top - 36)}px`;
      });
      circle.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  }

  function renderizarTudo() {
    renderizarKPIs();
    renderizarListaServidores();
    renderizarDetalhesServidor();
  }

  /* =====================================================================
   * EVENTOS E MODAIS
   * ===================================================================== */
  function vincularGrupo(seletor, attr, onSelect) {
    const btns = document.querySelectorAll(seletor);
    btns.forEach((btn) => btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      onSelect(btn.getAttribute(attr));
    }));
  }

  function marcarAtivo(seletor, attr, valor) {
    document.querySelectorAll(seletor).forEach((b) => b.classList.toggle('is-active', b.getAttribute(attr) === valor));
  }

  function abrirModal(titulo, html) {
    $('noc-modal-title').textContent = titulo;
    $('noc-modal-body').innerHTML = html;
    $('noc-modal').classList.add('is-open');
  }

  const fecharModal = () => $('noc-modal').classList.remove('is-open');

  vincularGrupo('#status-filter-pills .filter-pill', 'data-status', (v) => { state.filtroStatus = v; renderizarListaServidores(); });
  vincularGrupo('#window-filter .seg-btn', 'data-window', (v) => { state.janela = v; renderizarDetalhesServidor(); });
  vincularGrupo('#batch-filter .seg-btn', 'data-batch', (v) => { state.lotes = v; renderizarDetalhesServidor(); });

  $('server-search-input').addEventListener('input', (e) => { state.filtroBusca = e.target.value; renderizarListaServidores(); });
  $('btn-expand-servers').addEventListener('click', () => { state.encolhida = false; renderizarListaServidores(); });

  $('btn-clear-server-filters').addEventListener('click', () => {
    state.filtroStatus = 'all';
    state.filtroBusca = '';
    $('server-search-input').value = '';
    marcarAtivo('#status-filter-pills .filter-pill', 'data-status', 'all');
    renderizarListaServidores();
  });

  $('btn-reset-detail-filters').addEventListener('click', () => {
    state.janela = '3h';
    state.lotes = '5m';
    marcarAtivo('#window-filter .seg-btn', 'data-window', '3h');
    marcarAtivo('#batch-filter .seg-btn', 'data-batch', '5m');
    renderizarDetalhesServidor();
  });

  $('btn-open-jira').addEventListener('click', () => {
    const srv = obterSelecionado();
    if (!srv) return;
    abrirModal(`Chamado ${srv.telemetria.chamado} — ${srv.nome}`, `
      <p><strong>Motivo:</strong> ${esc(srv.motivo)}</p>
      <p><strong>Status:</strong> ${esc(srv.telemetria.ticketStatus)} · <strong>Responsável:</strong> ${esc(srv.telemetria.responsavel)}</p>
      <p>Integração demonstrativa com Jira. Os alertas utilizam os limites reais do banco e telemetria simulada (S3 mock).</p>`);
  });

  $('btn-open-procedure').addEventListener('click', () => {
    const srv = obterSelecionado();
    if (!srv) return;
    abrirModal(`Procedimento de triagem — ${srv.nome}`, `
      <ol>
        <li>Confirme o horário do último lote (<strong>${esc(srv.telemetria.ultimoEnvio)}</strong>) e verifique lacunas na coleta.</li>
        <li>Compare os picos de CPU, RAM e tráfego de rede na janela selecionada (${state.janela}).</li>
        <li>Inspecione os processos identificados no snapshot S3 e registre as evidências no chamado.</li>
      </ol>`);
  });

  $('btn-close-modal').addEventListener('click', fecharModal);
  $('noc-modal').addEventListener('click', (e) => { if (e.target.id === 'noc-modal') fecharModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

  carregarDados();
})();
