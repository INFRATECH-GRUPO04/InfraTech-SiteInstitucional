/* Fonte única das leituras compartilhadas pelas dashboards. */
window.InfraTechDashboardData = {
  dataLeitura: '2026-10-25T11:35:00',
  servidores: [
    { id: 'SRV-BR-01', cidade: 'São Paulo', status: 'online', cpu: 42, ram: 67, disco: 54, disponibilidade: 99.8, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-02', cidade: 'Rio de Janeiro', status: 'online', cpu: 28, ram: 51, disco: 38, disponibilidade: 99.5, memoriaTotalGb: 32, discoTotalGb: 400 },
    { id: 'SRV-BR-03', cidade: 'Curitiba', status: 'online', cpu: 78, ram: 83, disco: 71, disponibilidade: 96.2, memoriaTotalGb: 32, discoTotalGb: 400 },
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
    picoMbps: 88,
    capacidadeMbps: null
  },
  prioridade: ['SRV-BR-03', 'SRV-BR-04', 'SRV-BR-01', 'SRV-BR-02', 'SRV-BR-06', 'SRV-BR-05']
};

/* Regras compartilhadas pelas três dashboards. A persistência é local até existir
   endpoint de preferências no backend; as páginas sempre leem esta mesma fonte. */
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
      const resposta = await fetch(`/servidor/editar/componente/${idComponente}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacidadeServer: componente.capacidade_total || componente.capacidade, idMetricaServer: componente.id_metrica || componente.idMetrica, limiteAtencaoServer: limites[recurso].atencao, limiteCriticoServer: limites[recurso].critico })
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
    const trecho = validas.filter(condicao);
    const spansValidos = trecho.length > 1 && trecho[trecho.length - 1].instante - trecho[0].instante >= 60000
      && trecho.every((amostra, indice) => indice === 0 || amostra.instante - trecho[indice - 1].instante <= 60000);
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
