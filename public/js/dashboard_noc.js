(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const fetchJson = (url) => fetch(url, { credentials: 'same-origin' }).then((r) => (r.status === 200 ? r.json() : null)).catch(() => null);

  const LIMITES_PADRAO = {
    cpu: { atencao: 75, critico: 90 },
    ram: { atencao: 75, critico: 90 },
    disco: { atencao: 80, critico: 90 }
  };

  const state = {
    servidores: [],
    limitesGlobais: clone(LIMITES_PADRAO),
    filtroStatus: 'all',
    filtroBusca: '',
    servidorId: null,
    encolhida: false,
    janela: '3h',
    lotes: '5m',
    autoRefresh: true,
    tvMode: false,
    usouS3Real: false,
    usouBanco: false
  };

  /* =====================================================================
   * FALLBACK DEMONSTRATIVO (usado só se S3_BUCKET / noc.json indisponível)
   * ===================================================================== */
  const MOCK_HOSTS = [
    { id_servidor: 101, nome: 'SRV-BR-04', localizacao: 'São Paulo · Zona A' },
    { id_servidor: 102, nome: 'SRV-BR-03', localizacao: 'São Paulo · Zona B' },
    { id_servidor: 103, nome: 'SRV-BR-02', localizacao: 'Campinas · Edge' },
    { id_servidor: 104, nome: 'SRV-BR-05', localizacao: 'Rio de Janeiro · Zona A' },
    { id_servidor: 105, nome: 'SRV-BR-01', localizacao: 'São Paulo · Core' },
    { id_servidor: 106, nome: 'SRV-BR-06', localizacao: 'Curitiba · Backup' }
  ];

  const PERFIS_MOCK = {
    'SRV-BR-04': { semTelemetria: true, ultimoEnvio: '21:30', atrasoMin: 15, cpu: null, ram: null, disco: null, down: null, up: null, processos: [] },
    'SRV-BR-03': { ultimoEnvio: '21:45', atrasoMin: 0, cpu: 92, ram: 84, disco: 71, down: 110, up: 95, processos: [{ pid: 4812, nome: 'game-server', user: 'ubuntu' }, { pid: 1464, nome: 'redis-server', user: 'redis' }, { pid: 9021, nome: 'match_logger', user: 'ubuntu' }] },
    'SRV-BR-02': { ultimoEnvio: '21:45', atrasoMin: 0, cpu: 64, ram: 81, disco: 58, down: 48, up: 32, processos: [{ pid: 2210, nome: 'postgres', user: 'postgres' }, { pid: 3104, nome: 'node-api', user: 'app' }, { pid: 1180, nome: 'nginx', user: 'www-data' }] },
    'SRV-BR-05': { ultimoEnvio: '21:45', atrasoMin: 0, cpu: 52, ram: 61, disco: 83, down: 24, up: 18, processos: [{ pid: 5512, nome: 'backup-agent', user: 'root' }, { pid: 1922, nome: 'minio', user: 'minio' }] },
    'SRV-BR-01': { ultimoEnvio: '21:45', atrasoMin: 0, cpu: 38, ram: 49, disco: 44, down: 16, up: 12, processos: [{ pid: 1044, nome: 'haproxy', user: 'haproxy' }, { pid: 2890, nome: 'auth-service', user: 'app' }] },
    'SRV-BR-06': { ultimoEnvio: '21:45', atrasoMin: 0, cpu: 29, ram: 41, disco: 39, down: 7, up: 5, processos: [{ pid: 812, nome: 'systemd-journald', user: 'root' }, { pid: 2041, nome: 'prometheus-node', user: 'nobody' }] }
  };

  const hash = (str) => Math.abs([...str].reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0));

  function gerarMockNocServidor(srv) {
    const nome = String(srv.nome || 'SRV');
    let p = PERFIS_MOCK[nome];
    if (!p) {
      const s = hash(nome);
      const semTel = s % 11 === 0;
      p = {
        semTelemetria: semTel,
        ultimoEnvio: semTel ? '21:25' : '21:45',
        atrasoMin: semTel ? 20 : 0,
        cpu: semTel ? null : 32 + (s % 63),
        ram: semTel ? null : 40 + ((s >> 3) % 48),
        disco: semTel ? null : 35 + ((s >> 5) % 52),
        down: semTel ? null : 15 + (s % 85),
        up: semTel ? null : 10 + (s % 65),
        processos: semTel ? [] : [
          { pid: 1200 + (s % 900), nome: 'game-worker', user: 'app' },
          { pid: 3200 + (s % 500), nome: 'telemetry-agent', user: 'root' }
        ]
      };
    }

    // Gera série de 24h a cada 5 min (288 pontos) no formato exato de noc.json
    const series = [];
    const agora = new Date();
    const s = hash(nome);
    const totalPts = 288;
    for (let i = 0; i < totalPts; i++) {
      const t = new Date(agora.getTime() - (totalPts - 1 - i) * 5 * 60000);
      if (p.semTelemetria && i >= totalPts - 4) continue;
      const frac = i / (totalPts - 1);
      const onda = Math.sin(i * 0.35 + (s % 5)) * 8 + Math.cos(i * 0.2) * 4;
      const ultimo = !p.semTelemetria && i === totalPts - 1;
      const baseCpu = p.cpu ?? 45;
      const baseRam = p.ram ?? 55;
      const baseDisco = p.disco ?? 48;
      const baseDown = p.down ?? 20;
      const baseUp = p.up ?? 14;
      const horario = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

      series.push({
        horario,
        cpu_pct: ultimo ? baseCpu : Math.max(8, Math.min(99, Math.round(baseCpu - 12 + frac * 12 + onda))),
        ram_pct: ultimo ? baseRam : Math.max(15, Math.min(97, Math.round(baseRam - 8 + frac * 8 + onda * 0.5))),
        disco_pct: ultimo ? baseDisco : Math.max(10, Math.min(95, Math.round(baseDisco + onda * 0.15))),
        download_mbps: ultimo ? baseDown : Math.max(2, Math.round(baseDown * (0.6 + 0.4 * Math.sin(i * 0.4 + 1)))),
        upload_mbps: ultimo ? baseUp : Math.max(1, Math.round(baseUp * (0.6 + 0.35 * Math.cos(i * 0.35))))
      });
    }

    return {
      sem_telemetria: p.semTelemetria,
      atraso_segundos: p.atrasoMin * 60,
      ultimo_envio_hhmm: p.ultimoEnvio,
      metricas_atuais: { cpu_pct: p.cpu, ram_pct: p.ram, disco_pct: p.disco, download_mbps: p.down, upload_mbps: p.up },
      series_24h: series,
      processos: p.processos
    };
  }

  /* =====================================================================
   * CARREGAMENTO DO BANCO (MYSQL) + S3 GOLD (/servidor/noc/telemetria)
   * ===================================================================== */
  const aplicarLimites = (destino, itens) => {
    (itens || []).forEach((item) => {
      if (item.tipo && destino[item.tipo] && item.limite_atencao != null && item.limite_critico != null) {
        destino[item.tipo] = { atencao: Number(item.limite_atencao), critico: Number(item.limite_critico) };
      }
    });
  };

  function formatarHoraCurta(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(11, 16) || '—';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function formatarDuracao(minutos) {
    if (!minutos || minutos <= 0) return '—';
    if (minutos < 60) return `${Math.round(minutos)} min`;
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  async function carregarDados() {
    let listaHosts = [];
    let usouBanco = false;
    let nocPorId = new Map();
    let usouS3Real = false;

    const usuario = typeof carregarSessaoConfiavel === 'function' ? await carregarSessaoConfiavel() : null;
    if (usuario?.idEmpresa) {
      if (typeof validarSessao === 'function') await validarSessao().catch(() => {});
      const [servs, globais, nocResp] = await Promise.all([
        fetchJson(`/servidor/listar/${usuario.idEmpresa}`),
        fetchJson(`/servidor/alertas/globais/${usuario.idEmpresa}`),
        fetchJson('/servidor/noc/telemetria')
      ]);
      aplicarLimites(state.limitesGlobais, globais);

      if (nocResp?.disponivel && Array.isArray(nocResp.servidores)) {
        usouS3Real = true;
        nocResp.servidores.forEach((s) => nocPorId.set(Number(s.id_servidor), s));
      }

      if (Array.isArray(servs) && servs.length) {
        listaHosts = await Promise.all(servs.map(async (srv) => {
          const limites = clone(state.limitesGlobais);
          aplicarLimites(limites, await fetchJson(`/servidor/listarComponentes/${srv.id_servidor}`));
          return { ...srv, limites };
        }));
        usouBanco = true;
      }
    }

    if (!usouBanco) {
      listaHosts = MOCK_HOSTS.map((srv) => ({ ...srv, limites: clone(state.limitesGlobais) }));
    }

    state.usouBanco = usouBanco;
    state.usouS3Real = usouS3Real;

    $('data-source-badge').textContent = usouS3Real
      ? 'S3 GOLD + MYSQL'
      : usouBanco ? 'MYSQL + DEMONSTRAÇÃO (S3 NÃO CONFIGURADO)' : 'MODO DEMONSTRAÇÃO · DADOS SIMULADOS';

    state.servidores = listaHosts.map((srv) => {
      let raw = nocPorId.get(Number(srv.id_servidor));
      if (!raw) {
        raw = usouS3Real
          ? { sem_telemetria: true, atraso_segundos: null, ultima_coleta: null, metricas_atuais: {}, series_24h: [], processos: [] }
          : gerarMockNocServidor(srv);
      }

      const met = raw.metricas_atuais || {};
      const ultimoEnvio = raw.ultimo_envio_hhmm || formatarHoraCurta(raw.ultima_coleta);
      const tel = {
        semTelemetria: Boolean(raw.sem_telemetria),
        atrasoSegundos: raw.atraso_segundos ?? null,
        ultimoEnvio,
        cpu: met.cpu_pct != null ? Math.round(met.cpu_pct) : null,
        ram: met.ram_pct != null ? Math.round(met.ram_pct) : null,
        disco: met.disco_pct != null ? Math.round(met.disco_pct) : null,
        down: met.download_mbps != null ? Math.round(met.download_mbps) : null,
        up: met.upload_mbps != null ? Math.round(met.upload_mbps) : null,
        series24h: Array.isArray(raw.series_24h) ? raw.series_24h : [],
        processos: Array.isArray(raw.processos) ? raw.processos : []
      };

      const classif = classificarServidor(srv, tel);
      return { ...srv, telemetria: tel, ...classif };
    }).sort((a, b) => a.peso - b.peso || String(a.nome).localeCompare(String(b.nome)))
      .map((srv, i) => ({ ...srv, prioridade: i + 1 }));

    const agora = new Date();
    $('last-sync-time').textContent = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
    renderizarTudo();
  }

  function classificarPonto(pt, lim) {
    if (!pt || pt.cpu_pct == null) return { estado: 'neutral', motivo: 'Sem coleta' };
    const checks = [
      ['CPU', pt.cpu_pct, lim.cpu],
      ['RAM', pt.ram_pct, lim.ram],
      ['Disco', pt.disco_pct, lim.disco]
    ];
    const violacoes = [];
    checks.forEach(([nome, val, faixa]) => {
      if (val == null || !faixa) return;
      if (val >= faixa.critico) violacoes.push({ nivel: 2, texto: `${nome} ${Math.round(val)}% > ${faixa.critico}%` });
      else if (val >= faixa.atencao) violacoes.push({ nivel: 1, texto: `${nome} ${Math.round(val)}% > ${faixa.atencao}%` });
    });
    violacoes.sort((a, b) => b.nivel - a.nivel);
    if (violacoes[0]?.nivel === 2) return { estado: 'critical', motivo: violacoes[0].texto };
    if (violacoes[0]?.nivel === 1) return { estado: 'warning', motivo: violacoes[0].texto };
    return { estado: 'healthy', motivo: 'Operação normal' };
  }

  function classificarServidor(srv, tel) {
    const lim = srv.limites || state.limitesGlobais;
    if (tel.semTelemetria) {
      const mins = tel.atrasoSegundos != null ? Math.round(tel.atrasoSegundos / 60) : 0;
      return {
        estado: 'neutral',
        rotuloEstado: 'Sem telemetria',
        motivo: tel.ultimoEnvio !== '—' ? `Sem coleta desde ${tel.ultimoEnvio}` : 'Aguardando primeira coleta S3',
        duracao: mins ? formatarDuracao(mins) : '—',
        violacoes: [],
        peso: 2
      };
    }

    const checks = [
      ['CPU', tel.cpu, lim.cpu],
      ['RAM', tel.ram, lim.ram],
      ['Disco', tel.disco, lim.disco]
    ];
    const violacoes = [];
    checks.forEach(([nome, val, faixa]) => {
      if (val == null) return;
      if (val >= faixa.critico) violacoes.push({ componente: nome, nivel: 2, estado: 'critical', rotulo: 'Crítico', texto: `${nome} ${val}% > ${faixa.critico}%` });
      else if (val >= faixa.atencao) violacoes.push({ componente: nome, nivel: 1, estado: 'warning', rotulo: 'Atenção', texto: `${nome} ${val}% > ${faixa.atencao}%` });
    });
    violacoes.sort((a, b) => b.nivel - a.nivel);

    const estado = violacoes[0]?.nivel === 2 ? 'critical' : violacoes[0]?.nivel === 1 ? 'warning' : 'healthy';
    const rotuloEstado = estado === 'critical' ? 'Crítico' : estado === 'warning' ? 'Atenção' : 'Saudável';
    const motivo = violacoes[0]?.texto || 'Sem alerta ativo';

    // Calcula há quantos minutos o servidor permanece continuamente nesse estado na série
    let duracao = '—';
    if (estado !== 'healthy' && tel.series24h.length) {
      let cont = 0;
      for (let i = tel.series24h.length - 1; i >= 0; i--) {
        if (classificarPonto(tel.series24h[i], lim).estado === estado) cont++;
        else break;
      }
      if (cont > 0) {
        const passoMin = Math.max(1, Math.round(24 * 60 / Math.max(tel.series24h.length, 288)) || 5);
        duracao = formatarDuracao(cont * (tel.series24h.length > 350 ? 1 : passoMin));
      }
    }

    const peso = estado === 'critical' ? 1 : estado === 'warning' ? 3 : 4;
    return { estado, rotuloEstado, motivo, duracao, violacoes, peso };
  }

  /* =====================================================================
   * RENDERIZAÇÃO: DESTAQUES ACIONÁVEIS + FLEET WALLBOARD (TV)
   * ===================================================================== */
  function renderizarDestaques() {
    const srvs = state.servidores;
    const criticos = srvs.filter((s) => s.estado === 'critical');
    const semTel = srvs.filter((s) => s.estado === 'neutral');
    const atencao = srvs.filter((s) => s.estado === 'warning');

    const c0 = criticos[0];
    $('hl-critical-val').textContent = c0 ? `${c0.nome} (${c0.motivo})` : 'Nenhum servidor crítico';
    $('hl-critical-sub').textContent = criticos.length
      ? `${criticos.length} crítico(s) · Duração: ${c0.duracao}`
      : 'Todos dentro do limite crítico';
    $('hl-critical-card').className = `noc-panel highlight-card ${criticos.length ? 'highlight-card--critical' : 'highlight-card--healthy'}`;
    $('hl-critical-card').onclick = () => c0 && abrirServidor(c0.id_servidor);

    const o0 = semTel[0];
    $('hl-offline-val').textContent = o0 ? `${semTel.map((s) => s.nome).slice(0, 2).join(' · ')}` : 'Coleta S3 operacional';
    $('hl-offline-sub').textContent = semTel.length
      ? `${semTel.length} sem coleta · Último envio ${o0.telemetria.ultimoEnvio}`
      : 'Todos os agentes enviando';
    $('hl-offline-card').onclick = () => o0 && abrirServidor(o0.id_servidor);

    const w0 = atencao[0];
    $('hl-warning-val').textContent = w0 ? atencao.map((s) => s.nome).slice(0, 3).join(' · ') : 'Nenhum em atenção';
    $('hl-warning-sub').textContent = w0 ? `${atencao.length} em atenção · ${w0.motivo}` : 'Uso estável nos componentes';
    $('hl-warning-card').className = `noc-panel highlight-card ${atencao.length ? 'highlight-card--warning' : 'highlight-card--healthy'}`;
    $('hl-warning-card').onclick = () => w0 && abrirServidor(w0.id_servidor);
  }

  function montarTicksHeartbeat(srv) {
    const qtd = 60;
    const series = srv.telemetria.series24h || [];
    const lim = srv.limites || state.limitesGlobais;

    if (!series.length) {
      return Array.from({ length: qtd }, () => `<span class="hb-tick hb-tick--neutral" title="Sem coleta"></span>`).join('');
    }

    // Pega os últimos 60 pontos (1h com granularidade de 1 min)
    const janela = series.slice(-qtd);
    const ticks = [];
    for (let i = 0; i < qtd - janela.length; i++) {
      ticks.push(`<span class="hb-tick hb-tick--neutral" title="Sem coleta neste intervalo"></span>`);
    }
    janela.forEach((pt, idx) => {
      const ehUltimo = idx === janela.length - 1;
      const cl = (ehUltimo && srv.telemetria.semTelemetria)
        ? { estado: 'neutral', motivo: 'Sem coleta recente' }
        : classificarPonto(pt, lim);
      const hora = String(pt.horario || '').slice(11, 16) || '—';
      const tip = `${hora} · ${cl.motivo} (CPU ${Math.round(pt.cpu_pct ?? 0)}% · RAM ${Math.round(pt.ram_pct ?? 0)}%)`;
      ticks.push(`<span class="hb-tick hb-tick--${cl.estado}" title="${esc(tip)}"></span>`);
    });

    if (srv.telemetria.semTelemetria && janela.length) {
      ticks[ticks.length - 1] = `<span class="hb-tick hb-tick--neutral" title="Sem coleta recente (${esc(srv.telemetria.ultimoEnvio)})"></span>`;
    }
    return ticks.join('');
  }

  function corMetrica(val, faixa) {
    if (val == null || !faixa) return 'var(--noc-cyan)';
    if (val >= faixa.critico) return 'var(--noc-red)';
    if (val >= faixa.atencao) return 'var(--noc-yellow)';
    return 'var(--noc-green)';
  }

  function abrirServidor(id) {
    state.servidorId = Number(id);
    state.encolhida = true;
    renderizarTudo();
  }

  function renderizarListaServidores() {
    const counts = { all: state.servidores.length, critical: 0, warning: 0, neutral: 0, healthy: 0 };
    state.servidores.forEach((s) => { counts[s.estado]++; });
    Object.entries(counts).forEach(([k, v]) => { if ($(`cnt-${k}`)) $(`cnt-${k}`).textContent = v; });

    const termo = state.filtroBusca.trim().toLowerCase();
    const filtrados = state.servidores.filter((s) =>
      (state.filtroStatus === 'all' || s.estado === state.filtroStatus) &&
      (!termo || [s.nome, s.localizacao, s.motivo].some((v) => String(v || '').toLowerCase().includes(termo)))
    );

    $('servers-count-badge').textContent = `${filtrados.length} de ${state.servidores.length} servidores`;
    $('btn-clear-server-filters').hidden = state.filtroStatus === 'all' && !termo;

    const container = $('fleet-rows');
    if (!filtrados.length) {
      container.innerHTML = '<div class="fleet-empty">Nenhum servidor corresponde aos filtros atuais.</div>';
    } else {
      container.innerHTML = filtrados.map((s) => {
        const tel = s.telemetria;
        const lim = s.limites || state.limitesGlobais;
        const badgeText = s.duracao !== '—' ? `${s.rotuloEstado} · ${s.duracao}` : s.rotuloEstado;

        const metricasHtml = tel.semTelemetria
          ? `<div class="fleet-offline-msg">Último envio ${esc(tel.ultimoEnvio)} · ${esc(s.motivo)}</div>`
          : `
            <div class="fleet-metric-box">
              <div class="fleet-metric-top"><span>CPU</span><strong>${tel.cpu ?? '—'}%</strong></div>
              <div class="mini-track"><div class="mini-fill" style="width:${tel.cpu ?? 0}%;background:${corMetrica(tel.cpu, lim.cpu)}"></div></div>
            </div>
            <div class="fleet-metric-box">
              <div class="fleet-metric-top"><span>RAM</span><strong>${tel.ram ?? '—'}%</strong></div>
              <div class="mini-track"><div class="mini-fill" style="width:${tel.ram ?? 0}%;background:${corMetrica(tel.ram, lim.ram)}"></div></div>
            </div>
            <div class="fleet-metric-box">
              <div class="fleet-metric-top"><span>Disco</span><strong>${tel.disco ?? '—'}%</strong></div>
              <div class="mini-track"><div class="mini-fill" style="width:${tel.disco ?? 0}%;background:${corMetrica(tel.disco, lim.disco)}"></div></div>
            </div>
            <div class="fleet-net-box">
              <span>Rede</span>
              <strong>${tel.down != null ? `↓${tel.down} ↑${tel.up} Mbps` : 'Sem leitura'}</strong>
            </div>`;

        return `
          <div class="fleet-row fleet-row--${s.estado}${s.id_servidor === state.servidorId ? ' is-selected' : ''}" tabindex="0" data-id="${s.id_servidor}">
            <div class="fleet-server-info">
              <div class="fleet-server-name">
                <strong>${esc(s.nome)}</strong>
                <small>${esc(s.localizacao || 'Região padrão')}</small>
              </div>
              <span class="badge-status ${s.estado}"><span class="badge-dot"></span>${esc(badgeText)}</span>
            </div>
            <div class="heartbeat-strip" aria-label="Histórico recente de ${esc(s.nome)}">${montarTicksHeartbeat(s)}</div>
            <div class="fleet-metrics">${metricasHtml}</div>
          </div>`;
      }).join('');

      container.querySelectorAll('.fleet-row[data-id]').forEach((row) => {
        const abrir = () => abrirServidor(row.dataset.id);
        row.addEventListener('click', abrir);
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
      });
    }

    const srv = obterSelecionado();
    const encolhida = Boolean(state.encolhida && srv);
    $('server-list-panel').classList.toggle('is-collapsed', encolhida);
    $('noc-detail-section').hidden = !srv;

    if (encolhida) {
      $('collapsed-name').textContent = srv.nome;
      $('collapsed-location').textContent = srv.localizacao || 'Região padrão';
      const badge = $('collapsed-status-badge');
      badge.className = `badge-status ${srv.estado}`;
      badge.innerHTML = `<span class="badge-dot"></span>${esc(srv.rotuloEstado)}`;
      $('collapsed-reason').textContent = srv.motivo;
      $('collapsed-duration').textContent = srv.duracao;
      $('collapsed-last').textContent = srv.telemetria.ultimoEnvio;
    }
  }

  /* =====================================================================
   * RENDERIZAÇÃO: DRILL-DOWN DE INVESTIGAÇÃO (GRAFANA)
   * ===================================================================== */
  const obterSelecionado = () => state.servidores.find((s) => s.id_servidor === state.servidorId) || null;

  function filtrarEAgruparSerie(series24h, janela, lotes) {
    if (!series24h.length) return [];
    const horas = { '1h': 1, '3h': 3, '6h': 6, '24h': 24 }[janela] || 3;
    const passo = { '1m': 1, '5m': 5, '15m': 15 }[lotes] || 5;

    const parseData = (h) => new Date(String(h).replace(' ', 'T'));
    const ultimo = parseData(series24h.at(-1).horario);
    const corte = Number.isNaN(ultimo.getTime()) ? null : new Date(ultimo.getTime() - horas * 3600 * 1000);

    const filtrados = corte
      ? series24h.filter((pt) => { const d = parseData(pt.horario); return !Number.isNaN(d.getTime()) && d >= corte; })
      : series24h;

    if (passo <= 1 || filtrados.length <= 2) {
      return filtrados.map((pt) => ({
        hora: String(pt.horario).slice(11, 16) || '—',
        cpu: Math.round(pt.cpu_pct ?? 0),
        ram: Math.round(pt.ram_pct ?? 0),
        down: Math.round(pt.download_mbps ?? 0),
        up: Math.round(pt.upload_mbps ?? 0)
      }));
    }

    const grupos = new Map();
    filtrados.forEach((pt) => {
      const d = parseData(pt.horario);
      const minDia = Number.isNaN(d.getTime()) ? 0 : d.getHours() * 60 + d.getMinutes();
      const bucket = Math.floor(minDia / passo) * passo;
      const chave = `${String(pt.horario).slice(0, 10)}-${bucket}`;
      if (!grupos.has(chave)) grupos.set(chave, { bucket, pts: [] });
      grupos.get(chave).pts.push(pt);
    });

    const media = (arr, k) => {
      const validos = arr.map((x) => x[k]).filter((v) => v != null);
      return validos.length ? Math.round(validos.reduce((a, b) => a + b, 0) / validos.length) : 0;
    };

    return Array.from(grupos.values()).map(({ bucket, pts }) => ({
      hora: `${String(Math.floor(bucket / 60)).padStart(2, '0')}:${String(bucket % 60).padStart(2, '0')}`,
      cpu: media(pts, 'cpu_pct'),
      ram: media(pts, 'ram_pct'),
      down: media(pts, 'download_mbps'),
      up: media(pts, 'upload_mbps')
    }));
  }

  function renderizarDetalhesServidor() {
    const srv = obterSelecionado();
    if (!srv) return;
    const tel = srv.telemetria;
    const lim = srv.limites || state.limitesGlobais;
    const series = filtrarEAgruparSerie(tel.series24h, state.janela, state.lotes);

    $('ctx-server-name').textContent = srv.nome;
    $('ctx-last-batch').textContent = tel.ultimoEnvio;
    $('resource-chart-title').textContent = `Histórico de recursos — ${srv.nome}`;
    $('resource-chart-sub').textContent = `Janela ${state.janela} · Lotes de ${state.lotes} · Limite CPU ${lim.cpu.critico}%`;
    $('network-chart-title').textContent = `Rede — ${srv.nome}`;
    $('incidents-title').textContent = `Alertas e diagnóstico — ${srv.nome}`;
    $('resources-title').textContent = `Recursos e processos — ${srv.nome}`;
    $('network-source-note').textContent = state.usouS3Real ? 'Leitura real S3 Gold (noc.json)' : 'Modo demonstração (S3 não configurado)';

    // Gráfico 1: Recursos (CPU e RAM)
    if (tel.semTelemetria || series.length < 2) {
      destruirGrafico('resource-chart-container');
      $('resource-chart-container').innerHTML = `<div class="telemetry-empty"><strong>Sem telemetria suficiente na janela selecionada</strong><p style="margin:6px 0 0;font-size:13px;">Último envio às ${esc(tel.ultimoEnvio)}. Verifique o agente em ${esc(srv.nome)}.</p></div>`;
    } else {
      renderizarGraficoChart({
        containerId: 'resource-chart-container',
        series,
        maxVal: 100,
        unit: '%',
        datasets: [
          { label: 'CPU', key: 'cpu', color: '#00d2df', fill: false },
          { label: 'RAM', key: 'ram', color: '#a855f7', fill: false }
        ],
        limitLines: [
          { value: lim.cpu.atencao, color: '#F5B82E', dash: [4, 4], width: 1.4 },
          { value: lim.cpu.critico, color: '#F05262', dash: [7, 5], width: 1.8, label: `Limite crítico CPU ${lim.cpu.critico}%` }
        ]
      });
    }

    // Gráfico 2: Rede
    if (tel.semTelemetria || series.length < 2) {
      destruirGrafico('network-chart-container');
      $('network-legend').innerHTML = '<span class="legend-item">Sem leitura de interface</span>';
      $('network-chart-container').innerHTML = '<div class="telemetry-empty"><strong>Tráfego de rede indisponível</strong><p style="margin:6px 0 0;font-size:13px;">Aguardando restabelecimento da coleta S3.</p></div>';
    } else {
      const ult = series.at(-1);
      const maxNet = Math.max(30, Math.ceil(Math.max(...series.map((p) => Math.max(p.down, p.up))) / 20) * 20);
      $('network-legend').innerHTML = `
        <span class="legend-item"><i class="legend-dot" style="background:var(--noc-cyan)"></i>Download ${ult.down} Mbps</span>
        <span class="legend-item"><i class="legend-dot" style="background:var(--noc-purple)"></i>Upload ${ult.up} Mbps</span>`;

      renderizarGraficoChart({
        containerId: 'network-chart-container',
        series,
        maxVal: maxNet,
        unit: ' Mbps',
        datasets: [
          { label: 'Download', key: 'down', color: '#00d2df', fill: true, gradTop: 'rgba(0, 210, 223, 0.24)', gradBottom: 'rgba(0, 210, 223, 0.02)' },
          { label: 'Upload', key: 'up', color: '#a855f7', fill: true, gradTop: 'rgba(168, 85, 247, 0.26)', gradBottom: 'rgba(168, 85, 247, 0.02)' }
        ]
      });
    }

    // Tabela de Alertas e Diagnóstico (baseada nos limites reais, sem dados fictícios)
    if (srv.estado === 'healthy') {
      $('incidents-tbody').innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--noc-muted);padding:18px;">Nenhum limite violado para ${esc(srv.nome)}.</td></tr>`;
    } else if (srv.estado === 'neutral') {
      $('incidents-tbody').innerHTML = `
        <tr>
          <td><strong>Agente / S3</strong></td>
          <td>${esc(srv.motivo)}</td>
          <td><span class="badge-status neutral"><span class="badge-dot"></span>Sem telemetria</span></td>
          <td>${esc(srv.duracao)}</td>
        </tr>`;
    } else {
      $('incidents-tbody').innerHTML = srv.violacoes.map((v) => `
        <tr>
          <td><strong>${esc(v.componente)}</strong></td>
          <td>${esc(v.texto)}</td>
          <td><span class="badge-status ${v.estado}"><span class="badge-dot"></span>${esc(v.rotulo)}</span></td>
          <td>${esc(srv.duracao)}</td>
        </tr>`).join('');
    }
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
          const disp = val != null ? `${val}%` : 'Sem dados';
          const pct = val != null ? val : 0;
          const cor = val == null ? 'var(--noc-muted)' : val >= faixa.critico ? 'var(--noc-red)' : val >= faixa.atencao ? 'var(--noc-yellow)' : 'var(--noc-cyan)';
          return `<div class="resource-row">
            <span>${nome}</span>
            <div class="track" role="meter" aria-label="${nome}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
              <div class="fill" style="--value:${pct}%;background:${cor}"></div>
            </div>
            <strong style="color:${cor};text-align:right;">${disp}</strong>
          </div>`;
        }).join('');

      $('processes-list').innerHTML = tel.processos.length
        ? tel.processos.map((p) => `<li><span class="proc-name"><span class="proc-dot"></span>${esc(p.nome)}</span><span class="proc-pid">PID ${p.pid} · ${esc(p.user || '—')}</span></li>`).join('')
        : '<li><span class="proc-name"><span class="proc-dot" style="background:var(--noc-purple)"></span>Nenhum snapshot de processo recebido</span></li>';
    }
  }

  const chartInstances = {};

  function destruirGrafico(containerId) {
    if (chartInstances[containerId]) {
      chartInstances[containerId].destroy();
      delete chartInstances[containerId];
    }
  }

  function criarGradiente(ctx, topColor, bottomColor) {
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    return grad;
  }

  const pluginLinhasLimite = {
    id: 'nocLimites',
    afterDatasetsDraw(chart) {
      const linhas = chart.options.plugins?.nocLimites?.lines;
      if (!Array.isArray(linhas) || !linhas.length) return;
      const { ctx, chartArea, scales } = chart;
      const yScale = scales.y;
      if (!chartArea || !yScale) return;

      ctx.save();
      linhas.forEach((ln) => {
        const y = yScale.getPixelForValue(ln.value);
        if (y < chartArea.top || y > chartArea.bottom) return;
        ctx.beginPath();
        ctx.setLineDash(ln.dash || [6, 4]);
        ctx.lineWidth = ln.width || 1.5;
        ctx.strokeStyle = ln.color;
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();

        if (ln.label) {
          ctx.setLineDash([]);
          ctx.fillStyle = ln.color;
          ctx.font = 'bold 12px Inter, Arial, sans-serif';
          ctx.fillText(ln.label, chartArea.left + 8, Math.max(chartArea.top + 12, y - 6));
        }
      });
      ctx.restore();
    }
  };

  function renderizarGraficoChart({ containerId, series, maxVal, unit, datasets, limitLines = [] }) {
    destruirGrafico(containerId);
    const container = $(containerId);
    if (typeof Chart === 'undefined') {
      container.innerHTML = '<div class="telemetry-empty"><strong>Chart.js não carregado</strong><p style="margin:6px 0 0;font-size:13px;">Verifique a conexão ou o script do Chart.js.</p></div>';
      return;
    }

    container.innerHTML = '<div class="noc-chart-wrap"><canvas></canvas></div>';
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    chartInstances[containerId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.map((pt) => pt.hora),
        datasets: datasets.map((ds) => ({
          label: ds.label,
          data: series.map((pt) => pt[ds.key]),
          borderColor: ds.color,
          backgroundColor: ds.fill ? criarGradiente(ctx, ds.gradTop, ds.gradBottom) : ds.color,
          fill: Boolean(ds.fill),
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: ds.color
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(16, 25, 35, 0.96)',
            borderColor: '#00d2df',
            borderWidth: 1,
            titleColor: '#f2f6fa',
            bodyColor: '#f2f6fa',
            padding: 10,
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ${item.parsed.y}${unit}`
            }
          },
          nocLimites: { lines: limitLines }
        },
        scales: {
          x: {
            grid: { color: '#293746' },
            ticks: { color: '#a6b7c7', maxTicksLimit: 7 }
          },
          y: {
            min: 0,
            max: maxVal,
            grid: { color: '#293746' },
            ticks: {
              color: '#a6b7c7',
              stepSize: maxVal / 4,
              callback: (v) => `${Math.round(v)}${unit}`
            }
          }
        }
      },
      plugins: [pluginLinhasLimite]
    });
  }

  function renderizarTudo() {
    renderizarDestaques();
    renderizarListaServidores();
    renderizarDetalhesServidor();
  }

  /* =====================================================================
   * EVENTOS, MODO TV E AUTO-REFRESH (30s)
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
  $('btn-expand-servers').addEventListener('click', () => { state.encolhida = false; state.servidorId = null; renderizarTudo(); });

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

  $('btn-tv-mode').addEventListener('click', () => {
    state.tvMode = !state.tvMode;
    document.body.classList.toggle('is-tv-mode', state.tvMode);
    $('tv-mode-label').textContent = state.tvMode ? 'Sair do Modo TV' : 'Modo TV';
  });

  $('btn-toggle-autorefresh').addEventListener('click', () => {
    state.autoRefresh = !state.autoRefresh;
    $('btn-toggle-autorefresh').classList.toggle('is-paused', !state.autoRefresh);
    $('autorefresh-label').textContent = state.autoRefresh ? 'Atualização automática · 30s' : 'Atualização pausada';
  });

  $('btn-refresh-now').addEventListener('click', () => carregarDados());

  $('btn-open-procedure').addEventListener('click', () => {
    const srv = obterSelecionado();
    if (!srv) return;
    abrirModal(`Procedimento de triagem — ${srv.nome}`, `
      <ol>
        <li>Confirme o horário do último lote (<strong>${esc(srv.telemetria.ultimoEnvio)}</strong>) e verifique lacunas na coleta.</li>
        <li>Compare os picos de CPU, RAM e tráfego de rede na janela selecionada (${state.janela}).</li>
        <li>Inspecione os processos identificados no snapshot S3 para identificar o processo ofensor.</li>
      </ol>`);
  });

  $('btn-close-modal').addEventListener('click', fecharModal);
  $('noc-modal').addEventListener('click', (e) => { if (e.target.id === 'noc-modal') fecharModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

  setInterval(() => { if (state.autoRefresh) carregarDados(); }, 30000);
  carregarDados();
})();
