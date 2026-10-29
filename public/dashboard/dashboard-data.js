/* Fonte única das leituras compartilhadas pelas dashboards. */
window.InfraTechDashboardData = {
  origem: 'mock',
  dataLeitura: '2026-10-25T23:35:00',
  servidores: [
    { id: 'SRV-BR-01', cidade: 'São Paulo', status: 'online', cpu: 42, ram: 67, disco: 54, disponibilidade: 99.8, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-02', cidade: 'Rio de Janeiro', status: 'online', cpu: 28, ram: 51, disco: 38, disponibilidade: 99.5, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-03', cidade: 'Curitiba', status: 'online', cpu: 78, ram: 83, disco: 71, disponibilidade: 96.2, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-04', cidade: 'Brasília', status: 'offline', cpu: null, ram: null, disco: null, disponibilidade: 97.8, offlineDesde: '22h', memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-05', cidade: 'Recife', status: 'online', cpu: 35, ram: 44, disco: 29, disponibilidade: 98.7, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-06', cidade: 'Salvador', status: 'online', cpu: 21, ram: 38, disco: 45, disponibilidade: 99.1, memoriaTotalGb: 32, discoTotalGb: 400 }
  ],
  historicoServidor: {
    'SRV-BR-01': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [32, 30, 30, 37, 65, 40, 38, 42, 46, 50, 94, 72, 42],
      ram: [77, 33, 49, 52, 60, 56, 55, 61, 86, 76, 70, 78, 67],
      disco: [43, 37, 40, 43, 51, 47, 46, 52, 58, 64, 97, 74, 54]
    },
    'SRV-BR-02': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [20, 22, 24, 23, 27, 31, 34, 30, 29, 26, 32, 30, 28],
      ram: [46, 47, 48, 49, 51, 54, 55, 53, 52, 50, 52, 53, 51],
      disco: [33, 34, 34, 35, 36, 37, 38, 38, 39, 39, 38, 38, 38]
    },
    'SRV-BR-03': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [65, 62, 60, 58, 70, 72, 68, 75, 82, 78, 88, 84, 78],
      ram: [74, 75, 77, 76, 80, 82, 79, 85, 88, 86, 91, 87, 83],
      disco: [61, 63, 65, 64, 66, 67, 68, 71, 75, 78, 82, 77, 71]
    },
    'SRV-BR-04': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [22, 24, 26, 25, 29, 31, 33, 35, 38, 42, 54, null, null],
      ram: [40, 41, 43, 45, 47, 50, 52, 55, 58, 61, 64, null, null],
      disco: [48, 48, 49, 50, 51, 52, 54, 56, 59, 62, 64, null, null]
    },
    'SRV-BR-05': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [29, 30, 32, 35, 38, 41, 43, 39, 37, 36, 40, 38, 35],
      ram: [40, 41, 42, 44, 46, 47, 49, 48, 46, 45, 46, 45, 44],
      disco: [24, 25, 26, 27, 28, 29, 31, 32, 33, 32, 31, 30, 29]
    },
    'SRV-BR-06': {
      horas: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
      cpu: [18, 20, 22, 21, 24, 27, 29, 31, 28, 25, 24, 22, 21],
      ram: [35, 36, 37, 38, 40, 42, 44, 43, 42, 40, 39, 38, 38],
      disco: [40, 41, 41, 42, 43, 44, 46, 48, 50, 49, 47, 46, 45]
    }
  },
  historicoRedeServidor: {
    'SRV-BR-01': {
      horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
      uploadMbps: [12, 20, 42, 52, 48, 25, 16, 18],
      downloadMbps: [6, 15, 28, 36, 32, 17, 10, 12]
    },
    'SRV-BR-02': {
      horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
      uploadMbps: [15, 20, 26, 34, 39, 32, 24, 18],
      downloadMbps: [10, 18, 28, 34, 38, 34, 24, 18]
    },
    'SRV-BR-03': {
      horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
      uploadMbps: [35, 42, 65, 84, 96, 82, 70, 52],
      downloadMbps: [28, 36, 59, 78, 109, 80, 65, 48]
    },
    'SRV-BR-04': {
      horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
      uploadMbps: [6, 9, 12, 14, 16, 19, 17, null],
      downloadMbps: [4, 8, 10, 12, 15, 18, 16, null]
    },
    'SRV-BR-05': {
      horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
      uploadMbps: [18, 25, 34, 42, 48, 39, 30, 22],
      downloadMbps: [14, 24, 35, 46, 48, 38, 29, 21]
    },
    'SRV-BR-06': {
      horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
      uploadMbps: [12, 20, 29, 35, 42, 34, 24, 17],
      downloadMbps: [10, 18, 28, 34, 38, 32, 23, 17]
    }
  },
  picoSemanalFrota: [
    { dia: 'Segunda · 19/10', picos: [56, 68, 84, 48] },
    { dia: 'Terça · 20/10', picos: [58, 72, 88, 51] },
    { dia: 'Quarta · 21/10', picos: [61, 76, 91, 55] },
    { dia: 'Quinta · 22/10', picos: [60, 79, 92, 57] },
    { dia: 'Sexta · 23/10', picos: [64, 85, 96, 68] },
    { dia: 'Sábado · 24/10', picos: [69, 93, 99, 82] },
    { dia: 'Domingo · 25/10', picos: [65, 86, 97, 77] }
  ],
  rede: {
    horas: ['00h', '04h', '08h', '09h', '12h', '16h', '20h', '24h'],
    mbps: [18, 35, 70, 88, 80, 42, 26, 30],
    picoMbps: 88,
    capacidadeMbps: null,
    escopo: 'SRV-BR-01',
    uploadMbps: [12, 20, 42, 52, 48, 25, 16, 18],
    downloadMbps: [6, 15, 28, 36, 32, 17, 10, 12]
  }
};

/* Rede por servidor e agregado da frota usam as mesmas amostras e capacidades. */
window.InfraTechDashboardData.capacidadesRedePorServidor = Object.fromEntries(
  window.InfraTechDashboardData.servidores.map((servidor) => [servidor.id, 250])
);
{
  const dados = window.InfraTechDashboardData;
  const historicos = Object.values(dados.historicoRedeServidor);
  const horas = historicos[0].horas;
  const uploadMbps = horas.map((_, indice) => historicos.reduce((soma, item) => soma + (Number(item.uploadMbps[indice]) || 0), 0));
  const downloadMbps = horas.map((_, indice) => historicos.reduce((soma, item) => soma + (Number(item.downloadMbps[indice]) || 0), 0));
  const mbps = horas.map((_, indice) => uploadMbps[indice] + downloadMbps[indice]);
  dados.rede = {
    horas, mbps, uploadMbps, downloadMbps,
    picoMbps: Math.max(...mbps),
    capacidadeMbps: dados.capacidadesRedePorServidor ? Object.values(dados.capacidadesRedePorServidor).reduce((soma, capacidade) => soma + capacidade, 0) : 1500,
    escopo: 'frota'
  };
}

/* Pequena API de leitura para manter páginas consumidoras desacopladas do formato do mock. */
window.InfraTechDashboardData.obterServidores = function () {
  return this.servidores;
};
window.InfraTechDashboardData.obterServidorPorId = function (id) {
  return this.servidores.find((servidor) => servidor.id === id) || null;
};
window.InfraTechDashboardData.obterHistoricoServidor = function (id) {
  return this.historicoServidor[id] || null;
};
window.InfraTechDashboardData.obterHistoricoRedeServidor = function (id) {
  return this.historicoRedeServidor[id] || null;
};
window.InfraTechDashboardData.obterResumoFrota = function () {
  const servidores = this.servidores;
  const offline = servidores.filter((servidor) => servidor.status === 'offline');
  const online = servidores.filter((servidor) => servidor.status === 'online');
  const atencao = online.filter((servidor) => ['cpu', 'ram', 'disco'].some((recurso) =>
    window.InfraTechAlertas.classificar(recurso, servidor[recurso], servidor.id) === 'atencao'));
  const criticos = online.filter((servidor) => ['cpu', 'ram', 'disco'].some((recurso) =>
    window.InfraTechAlertas.classificar(recurso, servidor[recurso], servidor.id) === 'critico'));
  return { total: servidores.length, online, offline, atencao, criticos };
};
window.InfraTechDashboardData.picoSemanalFrota = window.InfraTechDashboardData.picoSemanalFrota.map((dia, diaIndex) => ({
  ...dia,
  picosPorRecurso: dia.picos.map((pico, faixaIndex) => {
    const responsavel = (diaIndex + faixaIndex) % 3;
    const reducoes = [6 + ((diaIndex + faixaIndex) % 3), 12 + ((diaIndex * 2 + faixaIndex) % 4)];
    const valores = [Math.max(0, pico - reducoes[0]), Math.max(0, pico - reducoes[1])];
    const metrica = {};
    let cursor = 0;
    ['cpu', 'ram', 'disco'].forEach((recurso, indice) => {
      metrica[recurso] = indice === responsavel ? pico : valores[cursor++];
    });
    return metrica;
  })
}));

/* Regras compartilhadas pelas três dashboards; sincronização usa backend autenticado e
   armazenamento local como alternativa para os acessos diretos sem sessão. */
window.InfraTechAlertas = (() => {
  const CHAVE_GLOBAL = 'infratech.alertas.global.v2';
  const CHAVE_SERVIDORES = 'infratech.alertas.servidores.v2';
  const PADRAO = Object.freeze({
    cpu: { atencao: 70, critico: 85 },
    ram: { atencao: 75, critico: 90 },
    disco: { atencao: 80, critico: 90 },
    rede: { atencao: 70, critico: 90 }
  });
  const RECURSOS = Object.keys(PADRAO);
  let limitesGlobaisBackend = null;
  let limitesIndividuaisBackend = {};
  let servidoresBackend = [];
  const capacidadesRedePorServidor = {};
  let limitesGlobaisLocais = PADRAO;
  let limitesIndividuaisLocais = {};

  function validar(limites) {
    const resultado = {};
    for (const recurso of RECURSOS) {
      const faixa = limites && limites[recurso];
      const atencao = Number(faixa && faixa.atencao);
      const critico = Number(faixa && faixa.critico);
      if (!Number.isInteger(atencao) || !Number.isInteger(critico) || atencao < 0 || critico > 100 || atencao >= critico) return null;
      resultado[recurso] = { atencao, critico };
    }
    return resultado;
  }
  function ler(chave, fallback) {
    try { return JSON.parse(localStorage.getItem(chave) || 'null') || fallback; }
    catch (_) { return fallback; }
  }
  function obter(serverId) {
    const globalLocal = validar(ler(CHAVE_GLOBAL, limitesGlobaisLocais)) || limitesGlobaisLocais;
    const individuaisLocal = ler(CHAVE_SERVIDORES, limitesIndividuaisLocais);
    return validar(serverId && individuaisLocal[serverId])
      || validar(serverId && limitesIndividuaisBackend[serverId])
      || limitesGlobaisBackend || globalLocal;
  }
  async function sincronizarBackend() {
    const empresa = Number(sessionStorage.ID_EMPRESA);
    if (!Number.isInteger(empresa) || empresa <= 0) return false;
    try {
      const [resGlobal, resServidores] = await Promise.all([
        fetch(`/servidor/alertas/globais/${empresa}`, { cache: 'no-store' }),
        fetch(`/servidor/listar/${empresa}`, { cache: 'no-store' })
      ]);
      if (resGlobal.ok) {
        const registros = await resGlobal.json();
        const globais = {};
        (registros || []).forEach((row) => { globais[String(row.tipo).toLowerCase()] = { atencao: Number(row.limite_atencao), critico: Number(row.limite_critico) }; });
        limitesGlobaisBackend = validar(globais);
      }
      if (resServidores.ok) {
        servidoresBackend = await resServidores.json();
        const conjuntos = await Promise.all(servidoresBackend.map(async (servidor) => {
          const id = servidor.id_servidor || servidor.idServidor;
          const nome = servidor.nome || servidor.nomeServidor;
          const resposta = await fetch(`/servidor/listarComponentes/${id}`, { cache: 'no-store' });
          if (!resposta.ok) return [nome, null];
          const componentes = resposta.status === 204 ? [] : await resposta.json();
          const limites = {};
          componentes.forEach((componente) => {
            const tipo = String(componente.tipo || '').toLowerCase();
            if (PADRAO[tipo] && componente.limite_atencao != null && componente.limite_critico != null) {
              limites[tipo] = { atencao: Number(componente.limite_atencao), critico: Number(componente.limite_critico) };
            }
            if (tipo === 'rede' && Number(componente.capacidade_total) > 0) capacidadesRedePorServidor[nome] = Number(componente.capacidade_total);
          });
          return [nome, validar({ ...(limitesGlobaisBackend || PADRAO), ...limites })];
        }));
        limitesIndividuaisBackend = Object.fromEntries(conjuntos.filter(([, value]) => value));
        window.InfraTechDashboardData.capacidadesRedePorServidor = { ...capacidadesRedePorServidor };
      }
      window.dispatchEvent(new CustomEvent('infratech:limites-alerta-alterados', { detail: { sincronizado: true } }));
      return true;
    } catch (_) { return false; }
  }
  function salvar(escopo, serverId, limites, substituirIndividuais = false) {
    const validos = validar(limites);
    if (!validos) throw new Error('Os limites devem ser inteiros de 0 a 100, com atenção abaixo de crítico.');
    if (escopo === 'servidor') {
      if (!serverId) throw new Error('Servidor não identificado.');
      const individuais = ler(CHAVE_SERVIDORES, limitesIndividuaisLocais);
      individuais[serverId] = validos;
      limitesIndividuaisLocais = individuais;
      try { localStorage.setItem(CHAVE_SERVIDORES, JSON.stringify(individuais)); } catch (_) { /* memória da aba mantém o ajuste atual */ }
    } else {
      limitesGlobaisLocais = validos;
      limitesGlobaisBackend = null;
      try { localStorage.setItem(CHAVE_GLOBAL, JSON.stringify(validos)); } catch (_) { /* memória da aba mantém o ajuste atual */ }
      if (substituirIndividuais) {
        const idsServidores = new Set([
          ...window.InfraTechDashboardData.servidores.map((servidor) => servidor.id),
          ...servidoresBackend.map((servidor) => servidor.nome || servidor.nomeServidor)
        ]);
        limitesIndividuaisLocais = Object.fromEntries([...idsServidores].map((id) => [id, validos]));
        try { localStorage.setItem(CHAVE_SERVIDORES, JSON.stringify(limitesIndividuaisLocais)); } catch (_) { /* sem persistência local */ }
        limitesIndividuaisBackend = {};
      }
    }
    window.dispatchEvent(new CustomEvent('infratech:limites-alerta-alterados', { detail: { escopo, serverId } }));
    return validos;
  }
  async function salvarBackend(escopo, serverId, limites, substituirIndividuais = false) {
    const empresa = Number(sessionStorage.ID_EMPRESA);
    if (!Number.isInteger(empresa) || empresa <= 0) return false;
    if (escopo === 'global') {
      const resposta = await fetch(`/servidor/alertas/globais/${empresa}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limites: validar(limites), substituirIndividuais })
      });
      if (!resposta.ok) throw new Error((await resposta.json()).erro || 'Falha ao salvar padrão global no servidor.');
      limitesGlobaisBackend = validar(limites);
      if (substituirIndividuais) limitesIndividuaisBackend = {};
      return true;
    }
    if (!servidoresBackend.length) await sincronizarBackend();
    const servidor = servidoresBackend.find((item) => (item.nome || item.nomeServidor) === serverId);
    if (!servidor) throw new Error(`Não foi encontrado ${serverId} nesta empresa no backend.`);
    const respostaComponentes = await fetch(`/servidor/listarComponentes/${servidor.id_servidor || servidor.idServidor}`, { cache: 'no-store' });
    const componentes = respostaComponentes.status === 204 ? [] : await respostaComponentes.json();
    const atualizacoes = RECURSOS.map(async (recurso) => {
      const componente = componentes.find((item) => String(item.tipo).toLowerCase() === recurso);
      if (!componente) throw new Error(`O servidor não possui componente ${recurso.toUpperCase()} configurado para gravar o limite.`);
      const idComponente = componente.id_componente || componente.idComponente;
      const resposta = await fetch(`/servidor/alertas/componentes/${idComponente}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idMetricaServer: componente.id_metrica || componente.idMetrica, limiteAtencaoServer: limites[recurso].atencao, limiteCriticoServer: limites[recurso].critico })
      });
      if (!resposta.ok) throw new Error(`Falha ao salvar o limite de ${recurso.toUpperCase()} no backend.`);
    });
    await Promise.all(atualizacoes);
    limitesIndividuaisBackend[serverId] = validar(limites);
    return true;
  }
  function classificar(recurso, valor, serverId) {
    if (valor == null || valor === '' || !Number.isFinite(Number(valor))) return 'sem-dados';
    const faixa = obter(serverId)[recurso];
    if (!faixa) return 'sem-dados';
    const numero = Number(valor);
    if (numero >= faixa.critico) return 'critico';
    if (numero >= faixa.atencao) return 'atencao';
    return 'saudavel';
  }
  function classificarRede(mbps, capacidadeMbps) {
    if (mbps == null || mbps === '') return { estado: 'sem-dados', percentual: null };
    const trafego = Number(mbps), capacidade = Number(capacidadeMbps);
    if (!Number.isFinite(trafego)) return { estado: 'sem-dados', percentual: null };
    if (!Number.isFinite(capacidade) || capacidade <= 0) return { estado: 'sem-capacidade', percentual: null };
    const percentual = trafego / capacidade * 100;
    return { estado: classificar('rede', percentual), percentual };
  }
  function avaliarPersistencia(recurso, amostras, estadoAtivo = 'saudavel', agora = Date.now(), serverId) {
    const validas = (Array.isArray(amostras) ? amostras : []).map((amostra) => ({
      valor: Number(amostra.valor), instante: new Date(amostra.timestamp).getTime()
    })).filter((amostra) => Number.isFinite(amostra.valor) && Number.isFinite(amostra.instante)
      && amostra.instante <= agora && agora - amostra.instante <= 300000)
      .sort((a, b) => a.instante - b.instante);
    if (!validas.length || agora - validas[validas.length - 1].instante > 60000) return { estado: 'sem-dados', media5min: null, confirmado: false };
    const media5min = validas.reduce((soma, amostra) => soma + amostra.valor, 0) / validas.length;
    const limites = obter(serverId)[recurso];
    const atual = classificar(recurso, media5min, serverId);
    const ordem = { saudavel: 0, atencao: 1, critico: 2 };
    const alvo = ordem[atual] > ordem[estadoAtivo] ? atual : estadoAtivo;
    const limiteRecuperacao = alvo === 'critico' ? limites.critico - 5 : limites.atencao - 5;
    const precisaRecuperar = ordem[atual] < ordem[estadoAtivo] && media5min < limiteRecuperacao;
    if (ordem[atual] < ordem[estadoAtivo] && !precisaRecuperar) {
      return { estado: estadoAtivo, media5min, confirmado: true };
    }
    const condicao = precisaRecuperar ? (amostra) => amostra.valor < limiteRecuperacao
      : (amostra) => ordem[classificar(recurso, amostra.valor, serverId)] >= ordem[alvo];
    // Uma amostra que sai da condição ou um intervalo sem coleta quebra a sequência.
    let trecho = [];
    let spansValidos = false;
    for (const amostra of validas) {
      const anterior = trecho[trecho.length - 1];
      if (!condicao(amostra) || (anterior && amostra.instante - anterior.instante > 60000)) {
        if (trecho.length > 1 && trecho[trecho.length - 1].instante - trecho[0].instante >= 60000) spansValidos = true;
        trecho = [];
      }
      if (condicao(amostra)) trecho.push(amostra);
    }
    if (trecho.length > 1 && trecho[trecho.length - 1].instante - trecho[0].instante >= 60000) spansValidos = true;
    if (!spansValidos) return { estado: `${alvo}-pendente`, media5min, confirmado: false };
    return { estado: precisaRecuperar ? atual : alvo, media5min, confirmado: true };
  }
  return { padrao: PADRAO, validar, obter, salvar, salvarBackend, sincronizarBackend, classificar, classificarRede, avaliarPersistencia };
})();

window.InfraTechAlertas.sincronizarBackend();

function formatarCargoDashboard(tipoAcesso) {
  var cargos = {
    ADMIN: 'ADMINISTRADOR',
    INFRATECH: 'ADMINISTRADOR',
    GESTOR: 'GESTOR',
    ANALISTA_DADOS: 'ENGENHEIRO DE TELEMETRIA',
    ANALISTA_NOC: 'ANALISTA DE NOC',
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
