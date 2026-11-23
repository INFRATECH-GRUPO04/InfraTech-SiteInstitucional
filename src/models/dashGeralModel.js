/*
 * Dashboard Geral: lê o JSON gold, cruza com o MySQL e o Jira e devolve o
 * contrato único consumido por public/js/dash-geral.js.
 */
var fs = require('fs/promises');
var path = require('path');
var database = require('../database/config');
var servidorModel = require('./servidorModel');

var LIMITES_PADRAO = {
    cpu: { atencao: 70, critico: 85 },
    ram: { atencao: 75, critico: 90 },
    disco: { atencao: 80, critico: 90 }
};
var ORDEM_SITUACAO = { critico: 0, offline: 1, atencao: 2, normal: 3 };
var SITUACAO_TEXTO = { normal: 'Normal', atencao: 'Atenção', critico: 'Crítico', offline: 'Offline' };
var DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
var CAMPOS_JIRA = 'key,summary,status,priority,created,resolutiondate,labels';

function numeroOuNull(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    var numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function erroGoldNaoEncontrado(mensagem) {
    var erro = new Error(mensagem);
    erro.codigo = 'GOLD_NAO_ENCONTRADO';
    return erro;
}

/* DASH_GOLD_LOCAL serve para testar sem S3: o arquivo fica em
 * 03-gold/empresa-{id}/dash-geral.json na raiz do projeto.
 */
async function lerGold(idEmpresa) {
    if (process.env.DASH_GOLD_LOCAL === '1') {
        var arquivo = path.join(process.cwd(), '03-gold', 'empresa-' + idEmpresa, 'dash-geral.json');
        try {
            return JSON.parse(await fs.readFile(arquivo, 'utf8'));
        } catch (erro) {
            if (erro.code === 'ENOENT') throw erroGoldNaoEncontrado('JSON gold não encontrado: ' + arquivo);
            throw erro;
        }
    }

    var bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET não configurado.');

    // Caminho final: s3://<S3_BUCKET>/<S3_GOLD_PREFIX>/empresa-{id}/dash-geral.json
    var prefixo = String(process.env.S3_GOLD_PREFIX || '03-gold/').replace(/^\/+/, '');
    if (prefixo && !prefixo.endsWith('/')) prefixo += '/';
    var chave = prefixo + 'empresa-' + idEmpresa + '/dash-geral.json';
    var S3 = require('@aws-sdk/client-s3');
    var cliente = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

    try {
        var resposta = await cliente.send(new S3.GetObjectCommand({ Bucket: bucket, Key: chave }));
        return JSON.parse(await resposta.Body.transformToString());
    } catch (erro) {
        var status = erro.$metadata && erro.$metadata.httpStatusCode;
        if (erro.name === 'NoSuchKey' || erro.name === 'NotFound' || status === 404) {
            throw erroGoldNaoEncontrado('JSON gold não encontrado: s3://' + bucket + '/' + chave);
        }
        throw erro;
    }
}

/* O filtro de visibilidade usa apenas a sessão: gestor vê tudo, os demais
 * cargos veem os servidores vinculados (ou todos, se não houver vínculo).
 */
async function buscarServidoresPermitidos(usuario) {
    var empresa = Number(usuario.empresa);
    var servidores = await database.executar(
        `SELECT s.id_servidor, s.nome, s.localizacao
         FROM servidor s
         WHERE s.fk_empresa = ? AND s.status_sistema = 1
         ORDER BY s.nome`,
        [empresa]
    );
    if (String(usuario.cargo || '').toUpperCase() === 'GESTOR') return servidores;

    var vinculos = await database.executar(
        `SELECT sf.fk_servidor
         FROM servidor_funcionario sf
         JOIN servidor s ON s.id_servidor = sf.fk_servidor
         WHERE sf.fk_funcionario = ? AND s.fk_empresa = ? AND s.status_sistema = 1`,
        [Number(usuario.id), empresa]
    );
    if (!vinculos.length) return servidores;

    var permitidos = new Set(vinculos.map(function (vinculo) { return Number(vinculo.fk_servidor); }));
    return servidores.filter(function (servidor) { return permitidos.has(Number(servidor.id_servidor)); });
}

async function buscarLimitesPorServidor(idEmpresa) {
    var linhas = await database.executar(
        `SELECT c.fk_servidor AS id_servidor, c.tipo,
                m.limite_atencao AS atencao, m.limite_critico AS critico
         FROM metrica m
         JOIN componente c ON c.id_componente = m.fk_componente
         JOIN servidor s ON s.id_servidor = c.fk_servidor
         WHERE s.fk_empresa = ? AND m.nome = 'uso_percentual'
           AND c.tipo IN ('cpu', 'ram', 'disco')`,
        [idEmpresa]
    );
    var limites = {};
    linhas.forEach(function (linha) {
        var tipo = String(linha.tipo || '').toLowerCase();
        if (!LIMITES_PADRAO[tipo]) return;
        var id = Number(linha.id_servidor);
        limites[id] = limites[id] || {};
        if (!limites[id][tipo]) {
            limites[id][tipo] = { atencao: numeroOuNull(linha.atencao), critico: numeroOuNull(linha.critico) };
        }
    });
    return limites;
}

function classificarValor(valor, faixa) {
    var numero = numeroOuNull(valor);
    if (numero == null || !faixa || faixa.atencao == null || faixa.critico == null) return null;
    if (numero >= Number(faixa.critico)) return 'critico';
    if (numero >= Number(faixa.atencao)) return 'atencao';
    return 'normal';
}

function processarServidores(servidoresGold, servidoresBanco, limitesPorServidor, limitesEmpresa, inc7dPorServidor) {
    var agora = Date.now();
    var porId = new Map(servidoresBanco.map(function (servidor) {
        return [Number(servidor.id_servidor), servidor];
    }));

    return (Array.isArray(servidoresGold) ? servidoresGold : []).map(function (servidor) {
        var id = Number(servidor.id_servidor);
        var cadastro = porId.get(id);
        if (!cadastro) return null;

        var atual = servidor.atual || {};
        var limites = Object.assign({}, LIMITES_PADRAO, limitesEmpresa, limitesPorServidor[id] || {});
        var situacao = 'normal';
        var tempoMin = null;

        if (servidor.conexao === 'offline') {
            situacao = 'offline';
            var ultima = new Date(servidor.ultima_leitura).getTime();
            if (Number.isFinite(ultima)) tempoMin = Math.max(0, Math.round((agora - ultima) / 60000));
        } else {
            ['cpu', 'ram', 'disco'].forEach(function (recurso) {
                var estado = classificarValor(atual[recurso], limites[recurso]);
                if (estado && ORDEM_SITUACAO[estado] < ORDEM_SITUACAO[situacao]) situacao = estado;
            });
        }

        return Object.assign({}, servidor, {
            nome: cadastro.nome || servidor.nome || null,
            cidade: cadastro.localizacao || servidor.cidade || null,
            tempo_min: tempoMin,
            situacao: situacao,
            inc7d: Number(inc7dPorServidor[id] || 0),
            atual: {
                cpu: numeroOuNull(atual.cpu),
                ram: numeroOuNull(atual.ram),
                disco: numeroOuNull(atual.disco)
            },
            disponibilidade_pct: Object.assign({}, servidor.disponibilidade_pct || {}, {
                '24h': numeroOuNull(servidor.disponibilidade_pct && servidor.disponibilidade_pct['24h'])
            })
        });
    }).filter(Boolean).sort(function (a, b) {
        return ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
            || String(a.nome || a.id_servidor).localeCompare(String(b.nome || b.id_servidor));
    });
}

/* ---------- Jira (somente leitura) ---------- */

function textoJql(valor) {
    return '"' + String(valor).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function dataIssue(valor) {
    var tempo = new Date(valor).getTime();
    return Number.isFinite(tempo) ? tempo : null;
}

function servidorDaIssue(issue) {
    var labels = (issue.fields && issue.fields.labels) || [];
    var label = labels.find(function (item) { return /^servidor-\d+$/.test(String(item)); });
    return label ? Number(String(label).slice('servidor-'.length)) : null;
}

function chaveDia(data) {
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0')
        + '-' + String(data.getDate()).padStart(2, '0');
}

function janela(dias, deslocamento, agora) {
    var fim = new Date(agora);
    fim.setHours(24, 0, 0, 0);
    fim.setDate(fim.getDate() - deslocamento);
    var inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - dias);
    return { inicio: inicio.getTime(), fim: fim.getTime() };
}

function seriePorDia(issues, dias, deslocamento, agora) {
    var atual = janela(dias, deslocamento, agora);
    var anterior = janela(dias, deslocamento + dias, agora);
    var rotulos = [];
    var chaves = [];
    var valores = [];

    for (var i = dias - 1; i >= 0; i--) {
        var dia = new Date(agora);
        dia.setHours(12, 0, 0, 0);
        dia.setDate(dia.getDate() - i);
        rotulos.push(dias === 7 ? DIAS_SEMANA[dia.getDay()]
            : String(dia.getDate()).padStart(2, '0') + '/' + String(dia.getMonth() + 1).padStart(2, '0'));
        chaves.push(chaveDia(dia));
        valores.push(0);
    }

    var indicePorDia = new Map(chaves.map(function (chave, indice) { return [chave, indice]; }));
    var anteriorTotal = 0;
    issues.forEach(function (issue) {
        var criada = dataIssue(issue.fields && issue.fields.created);
        if (criada == null) return;
        if (criada >= atual.inicio && criada < atual.fim) {
            var indice = indicePorDia.get(chaveDia(new Date(criada)));
            if (indice !== undefined) valores[indice] += 1;
        } else if (criada >= anterior.inicio && criada < anterior.fim) {
            anteriorTotal += 1;
        }
    });

    return { rotulos: rotulos, valores: valores, anterior: anteriorTotal };
}

async function buscarIssues(jql) {
    var base = process.env.JIRA_BASE_URL;
    var email = process.env.JIRA_EMAIL;
    var token = process.env.JIRA_TOKEN;
    if (!base || !email || !token) return [];

    var caminho = String(process.env.JIRA_API_PATH || '/rest/api/3/search/jql').replace(/^\//, '');
    var url = new URL(String(base).replace(/\/+$/, '') + '/' + caminho);
    var parametros = new URLSearchParams({ jql: jql, fields: CAMPOS_JIRA, maxResults: '100' });
    var autorizacao = 'Basic ' + Buffer.from(email + ':' + token).toString('base64');
    var timeout = Number(process.env.JIRA_TIMEOUT_MS) || 5000;
    var issues = [];
    var proximo = null;

    for (var pagina = 0; pagina < 5; pagina++) {
        if (proximo) parametros.set('nextPageToken', proximo);
        try {
            var resposta = await fetch(url.toString() + '?' + parametros.toString(), {
                headers: { Authorization: autorizacao, Accept: 'application/json' },
                signal: AbortSignal.timeout(timeout)
            });
            if (!resposta.ok) {
                console.warn('[dash-geral] Jira respondeu', resposta.status, 'para', jql);
                return [];
            }
            var corpo = await resposta.json();
            if (!Array.isArray(corpo.issues)) return [];
            issues = issues.concat(corpo.issues);
            proximo = corpo.nextPageToken;
            if (!proximo) break;
        } catch (erro) {
            console.warn('[dash-geral] falha ao consultar Jira:', erro.message);
            return [];
        }
    }
    return issues;
}

function prioridadeIssue(issue) {
    var nome = String(((issue.fields || {}).priority || {}).name || '').toLowerCase();
    if (['highest', 'critical', 'blocker'].includes(nome)) return 'critico';
    if (nome === 'high') return 'atencao';
    return 'normal';
}

function incidentesVazios() {
    return {
        abertos: [],
        por_dia: {
            '7d': { rotulos: [], valores: [], anterior: null },
            '30d': { rotulos: [], valores: [], anterior: null }
        },
        mttr: { minutos: null, periodo: '(últimos 30d)' },
        inc7dPorServidor: {}
    };
}

async function buscarIncidentes(idEmpresa, servidoresBanco, agora) {
    var vazio = incidentesVazios();
    var projeto = process.env.JIRA_PROJECT;
    if (!projeto) return vazio;

    var filtro = 'project = ' + textoJql(projeto) + ' AND labels = ' + textoJql('empresa-' + idEmpresa);
    var [abertos, criadas, resolvidas] = await Promise.all([
        buscarIssues(filtro + ' AND statusCategory != Done ORDER BY created DESC'),
        buscarIssues(filtro + ' AND created >= -60d ORDER BY created DESC'),
        buscarIssues(filtro + ' AND statusCategory = Done AND resolutiondate >= -30d ORDER BY resolutiondate DESC')
    ]);

    var nomesPorId = new Map(servidoresBanco.map(function (servidor) {
        return [Number(servidor.id_servidor), servidor.nome || ''];
    }));
    var janela7d = janela(7, 0, agora);
    var inc7dPorServidor = {};

    criadas.forEach(function (issue) {
        var id = servidorDaIssue(issue);
        var criada = dataIssue(issue.fields && issue.fields.created);
        if (!nomesPorId.has(id) || criada == null) return;
        if (criada >= janela7d.inicio && criada < janela7d.fim) {
            inc7dPorServidor[id] = (inc7dPorServidor[id] || 0) + 1;
        }
    });

    var minutosAbertos = abertos.map(function (issue) {
        var criada = dataIssue(issue.fields && issue.fields.created);
        return criada == null ? null : Math.max(0, Math.round((agora.getTime() - criada) / 60000));
    }).filter(function (minutos) { return minutos != null; });
    var tempoMedio = minutosAbertos.length
        ? Math.round(minutosAbertos.reduce(function (soma, minutos) { return soma + minutos; }, 0) / minutosAbertos.length)
        : null;

    var minutosResolucao = resolvidas.map(function (issue) {
        var criada = dataIssue(issue.fields && issue.fields.created);
        var resolvida = dataIssue(issue.fields && issue.fields.resolutiondate);
        return criada != null && resolvida != null && resolvida >= criada ? (resolvida - criada) / 60000 : null;
    }).filter(function (minutos) { return minutos != null; });
    var mttr = minutosResolucao.length
        ? Math.round(minutosResolucao.reduce(function (soma, minutos) { return soma + minutos; }, 0) / minutosResolucao.length)
        : null;

    return {
        abertos: abertos.map(function (issue) {
            var id = servidorDaIssue(issue);
            var criada = dataIssue(issue.fields && issue.fields.created);
            return {
                id: issue.key,
                servidor: nomesPorId.has(id) ? nomesPorId.get(id) : '',
                prioridade: prioridadeIssue(issue),
                minutos: criada == null ? null : Math.max(0, Math.round((agora.getTime() - criada) / 60000))
            };
        }),
        por_dia: {
            '7d': seriePorDia(criadas, 7, 0, agora),
            '30d': seriePorDia(criadas, 30, 0, agora)
        },
        mttr: { minutos: mttr, periodo: '(últimos 30d)' },
        inc7dPorServidor: inc7dPorServidor
    };
}

/* ---------- Relatório template (sem serviço externo) ---------- */

function piorRecurso(servidor) {
    return ['cpu', 'ram', 'disco'].map(function (recurso) {
        return { recurso: recurso, valor: numeroOuNull(servidor.atual && servidor.atual[recurso]) };
    }).filter(function (item) { return item.valor != null; })
        .sort(function (a, b) { return b.valor - a.valor; })[0] || null;
}

function montarIA(servidores, abertos) {
    var relatorio = {
        gerado_em: new Date().toISOString(),
        resumo: '',
        pontos: [],
        recomendacoes: []
    };
    if (!servidores.length) {
        relatorio.resumo = 'Sem dados para análise';
        return relatorio;
    }

    var contar = function (situacao) {
        return servidores.filter(function (servidor) { return servidor.situacao === situacao; }).length;
    };
    var normais = contar('normal');
    var atencao = contar('atencao');
    var criticos = contar('critico');
    var offline = contar('offline');
    relatorio.resumo = 'Frota com ' + servidores.length + ' servidor(es): ' + normais + ' normal(is), '
        + atencao + ' em atenção, ' + criticos + ' crítico(s) e ' + offline + ' offline. '
        + abertos.length + ' incidente(s) aberto(s).';

    var pontos = servidores.filter(function (servidor) { return servidor.situacao !== 'normal'; })
        .sort(function (a, b) {
            return ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
                || (numeroOuNull(a.disponibilidade_pct['24h']) ?? 101) - (numeroOuNull(b.disponibilidade_pct['24h']) ?? 101);
        })
        .slice(0, 3);

    relatorio.pontos = pontos.map(function (servidor) {
        var nome = servidor.nome || ('Servidor ' + servidor.id_servidor);
        var disponibilidade = numeroOuNull(servidor.disponibilidade_pct['24h']);
        var detalhe = SITUACAO_TEXTO[servidor.situacao] || servidor.situacao;
        if (disponibilidade != null) detalhe += ' · disponibilidade ' + disponibilidade.toFixed(1) + '%';
        if (servidor.tempo_min != null) detalhe += ' · ' + servidor.tempo_min + ' min no estado';
        return nome + ' — ' + detalhe;
    });

    relatorio.recomendacoes = pontos.map(function (servidor) {
        var nome = servidor.nome || ('Servidor ' + servidor.id_servidor);
        var pior = piorRecurso(servidor);
        if (pior) return 'Verificar ' + pior.recurso.toUpperCase() + ' de ' + nome + ', em ' + pior.valor.toFixed(1) + '%.';
        return 'Investigar ' + nome + ', classificado como ' + (SITUACAO_TEXTO[servidor.situacao] || servidor.situacao) + '.';
    });

    return relatorio;
}

function seriesVazias() {
    var vazia = function () { return { rotulos: [], valores: [], media: null, anterior: null }; };
    return { '24h': vazia(), '7d': vazia(), '30d': vazia() };
}

/* Monta a resposta final mantendo o formato recebido do gold. */
async function montar(usuario) {
    var idEmpresa = Number(usuario.empresa);
    var gold = await lerGold(idEmpresa);
    var agora = new Date();

    var [servidoresBanco, limitesPorServidor, limitesLinhas] = await Promise.all([
        buscarServidoresPermitidos(usuario),
        buscarLimitesPorServidor(idEmpresa),
        servidorModel.listarLimitesGlobais(idEmpresa)
    ]);

    var limitesEmpresa = {};
    (limitesLinhas || []).forEach(function (linha) {
        var tipo = String(linha.tipo || '').toLowerCase();
        if (!LIMITES_PADRAO[tipo]) return;
        limitesEmpresa[tipo] = {
            atencao: numeroOuNull(linha.limite_atencao),
            critico: numeroOuNull(linha.limite_critico)
        };
    });

    var incidentes = await buscarIncidentes(idEmpresa, servidoresBanco, agora);
    var servidores = processarServidores(
        gold.servidores, servidoresBanco, limitesPorServidor, limitesEmpresa, incidentes.inc7dPorServidor
    );

    return Object.assign({}, gold, {
        versao: 1,
        id_empresa: idEmpresa,
        ambiente: 'Produção',
        servidores: servidores,
        disponibilidade_frota: gold.disponibilidade_frota || seriesVazias(),
        incidentes: {
            abertos: incidentes.abertos,
            por_dia: incidentes.por_dia,
            mttr: incidentes.mttr
        },
        relatorio_ia: montarIA(servidores, incidentes.abertos)
    });
}

module.exports = { montar, lerGold };
