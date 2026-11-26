/*
 * Agregação Jira para a Dashboard Geral.
 *
 * Uma única busca do projeto é compartilhada por /dash-geral e
 * /dash-geral/incidentes (cache do cliente Jira + cache por empresa/servidores
 * visíveis aqui). Toda agregação é feita em memória, filtrando apenas a empresa
 * da sessão e os servidores que aquela sessão pode ver. Falha Jira devolve o
 * mesmo stub vazio usado antes da integração, sem derrubar a rota.
 */

var jira = require('../integrations/jira');

var FUSO = 'America/Sao_Paulo';
var TTL_CACHE_MS = 5 * 60 * 1000;
var MAX_DIAS = 30;
var JANELAS = { '7d': 7, '30d': 30 };
var MAX_CANDIDATOS_CHANGELOG = 50;
var LOTE_CHANGELOG = 10;

var formatadorBRT = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
});
var cacheEmpresa = new Map();

function stub() {
    return {
        abertos: [],
        por_dia: {
            '7d': { rotulos: [], valores: [] },
            '30d': { rotulos: [], valores: [] }
        },
        mttr: { minutos: null, periodo: '(últimos 30d)', anterior_minutos: null },
        ranking_problematicos: []
    };
}

function normalizarTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function partesBRT(data) {
    var partes = {};
    formatadorBRT.formatToParts(data).forEach(function (parte) {
        if (parte.type !== 'literal') partes[parte.type] = parte.value;
    });
    return { ano: Number(partes.year), mes: Number(partes.month), dia: Number(partes.day) };
}

function chaveDia(ano, mes, dia) {
    return String(ano).padStart(4, '0') + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

function chaveDiaBRT(data) {
    if (!data) return null;
    var partes = partesBRT(data);
    return chaveDia(partes.ano, partes.mes, partes.dia);
}

// Calendário corrido em BRT, terminando no dia de hoje (inclusive). Aritmética
// em UTC só para trocar de dia sem depender do fuso do servidor.
function diasBRT(quantidade) {
    var hoje = partesBRT(new Date());
    var dias = [];
    for (var i = quantidade - 1; i >= 0; i -= 1) {
        var data = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia - i));
        var ano = data.getUTCFullYear();
        var mes = data.getUTCMonth() + 1;
        var dia = data.getUTCDate();
        dias.push({
            chave: chaveDia(ano, mes, dia),
            rotulo: String(dia).padStart(2, '0') + '/' + String(mes).padStart(2, '0')
        });
    }
    return dias;
}

function chaveCache(idEmpresa, servidores) {
    var ids = servidores.map(function (servidor) { return Number(servidor.id_servidor); })
        .filter(function (id) { return Number.isInteger(id) && id > 0; })
        .sort(function (a, b) { return a - b; });
    return idEmpresa + '|' + ids.join(',');
}

/* `null` sinaliza falha Jira (não confundir com "empresa sem issues", que é
 * um array vazio e pode ser cacheado normalmente).
 */
async function issuesDaEmpresa(idEmpresa, servidores) {
    var chave = chaveCache(idEmpresa, servidores);
    var entradas = cacheEmpresa.get(chave);
    if (entradas && Date.now() < entradas.expiraEm) return entradas.issues;

    var busca = await jira.buscarIssuesProjeto();
    if (!busca.sucesso) return null;

    var visiveis = new Set(servidores.map(function (servidor) { return Number(servidor.id_servidor); }));
    var issues = (busca.issues || []).filter(function (issue) {
        return issue.empresaId === idEmpresa && visiveis.has(issue.servidorId);
    });

    // Enriquece antes de cachear: as duas rotas (/dash-geral e /incidentes)
    // reaproveitam o mesmo dataset com concluidoEm já preenchido.
    await enriquecerConclusao(issues);

    cacheEmpresa.set(chave, { issues: issues, expiraEm: Date.now() + TTL_CACHE_MS });
    return issues;
}

/* A lista de status concluídos é compartilhada com o parser do changelog
 * (src/integrations/jira.js). Categoria `done` vale antes dos nomes.
 */
function estaConcluida(issue) {
    if (normalizarTexto(issue.statusCategoriaChave) === 'done') return true;
    return jira.ehStatusConcluido(issue.statusNome) || jira.ehStatusConcluido(issue.statusCategoriaNome);
}

function estaAberta(issue) {
    return !estaConcluida(issue);
}

/* Fallback de MTTR: só issues ainda sem resolutiondate, com created válido e
 * concluídas hoje. `concluidoEm` é a última transição para done no changelog.
 * Limites evitam N+1 descontrolado e o cache por issue evita repetição.
 */
async function enriquecerConclusao(issues) {
    var candidatos = issues.filter(function (issue) {
        return issue.criadoEm && !issue.resolvidoEm && estaConcluida(issue);
    });

    if (candidatos.length > MAX_CANDIDATOS_CHANGELOG) {
        console.warn('[jira] ' + candidatos.length + ' issues elegíveis ao changelog; limitando a ' + MAX_CANDIDATOS_CHANGELOG);
    }

    var selecionados = candidatos.slice(0, MAX_CANDIDATOS_CHANGELOG);
    for (var i = 0; i < selecionados.length; i += LOTE_CHANGELOG) {
        var lote = selecionados.slice(i, i + LOTE_CHANGELOG);
        await Promise.all(lote.map(function (issue) {
            return jira.buscarConclusaoIssue(issue.key).then(function (data) {
                issue.concluidoEm = data;
            }).catch(function (erro) {
                console.warn('[jira] changelog indisponível para ' + issue.key + '; mantendo sem conclusão', erro && erro.name);
                issue.concluidoEm = null;
            });
        }));
    }
}

function prioridadeFront(nome) {
    var prioridade = normalizarTexto(nome);
    if (prioridade === 'highest' || prioridade === 'high') return 'critico';
    if (prioridade === 'medium') return 'atencao';
    return 'normal';
}

function nomeServidor(issue, nomesPorId) {
    if (nomesPorId.has(issue.servidorId)) return nomesPorId.get(issue.servidorId);
    if (issue.nomeFallback) return issue.nomeFallback;
    return 'Servidor ' + issue.servidorId;
}

function montarAbertos(issues, nomesPorId) {
    var agora = Date.now();
    return issues.filter(function (issue) { return issue.criadoEm && estaAberta(issue); })
        .sort(function (a, b) {
            return a.criadoEm.getTime() - b.criadoEm.getTime() || a.key.localeCompare(b.key);
        })
        .map(function (issue) {
            return {
                id: issue.key,
                id_servidor: issue.servidorId,
                // Nome do MySQL tem preferência; fallback vem do summary/descrição.
                servidor: nomeServidor(issue, nomesPorId),
                prioridade: prioridadeFront(issue.prioridadeNome),
                minutos: Math.max(0, Math.round((agora - issue.criadoEm.getTime()) / 60000)),
                responsavel: issue.responsavel || null,
                url_jira: jira.urlIssue(issue.key)
            };
        });
}

function montarPorDia(issues, todosOsDias) {
    var contadores = {};
    todosOsDias.forEach(function (dia) { contadores[dia.chave] = 0; });
    issues.forEach(function (issue) {
        var chave = chaveDiaBRT(issue.criadoEm);
        if (chave && Object.prototype.hasOwnProperty.call(contadores, chave)) contadores[chave] += 1;
    });

    var series = {};
    Object.keys(JANELAS).forEach(function (janela) {
        var dias = todosOsDias.slice(-JANELAS[janela]);
        series[janela] = {
            rotulos: dias.map(function (dia) { return dia.rotulo; }),
            valores: dias.map(function (dia) { return contadores[dia.chave]; })
        };
    });
    return series;
}

function mediaMinutos(issues, inicio, fim) {
    // resolutiondate continua prioritário; concluidoEm vem do changelog apenas
    // quando o Jira não preencheu a resolução ao concluir a issue.
    function dataConclusao(issue) {
        return issue.resolvidoEm || issue.concluidoEm || null;
    }

    var valores = issues.filter(function (issue) {
        var conclusao = dataConclusao(issue);
        if (!issue.criadoEm || !conclusao) return false;
        var concluido = conclusao.getTime();
        return concluido >= inicio && concluido <= fim;
    }).map(function (issue) {
        return (dataConclusao(issue).getTime() - issue.criadoEm.getTime()) / 60000;
    }).filter(function (minutos) { return Number.isFinite(minutos) && minutos >= 0; });

    if (!valores.length) return null;
    return Math.round(valores.reduce(function (total, valor) { return total + valor; }, 0) / valores.length);
}

function montarMttr(issues) {
    var agora = Date.now();
    var trintaDias = 30 * 24 * 60 * 60 * 1000;
    return {
        minutos: mediaMinutos(issues, agora - trintaDias, agora),
        periodo: '(últimos 30d)',
        anterior_minutos: mediaMinutos(issues, agora - 2 * trintaDias, agora - trintaDias)
    };
}

/* Intencionalmente usa issues CRIADAS nos últimos 30d (não abertas hoje): é a
 * contagem de incidentes do período, exibida no card "Mais Problemáticos".
 * nome/situação vêm do cálculo já existente em dashGeralModel.
 */
function montarRanking(issues, servidores, chaves30d) {
    var contagem = Object.create(null);
    issues.forEach(function (issue) {
        var chave = chaveDiaBRT(issue.criadoEm);
        if (!chave || !chaves30d.has(chave)) return;
        contagem[issue.servidorId] = (contagem[issue.servidorId] || 0) + 1;
    });

    return servidores.map(function (servidor) {
        var id = Number(servidor.id_servidor);
        return {
            id_servidor: id,
            nome: String(servidor.nome || ('Servidor ' + id)),
            situacao: String(servidor.situacao || 'normal'),
            incidentes: contagem[id] || 0
        };
    }).filter(function (servidor) { return servidor.incidentes > 0; })
        .sort(function (a, b) {
            return b.incidentes - a.incidentes || a.nome.localeCompare(b.nome, 'pt-BR');
        })
        .slice(0, 3);
}

async function obterDadosJiraEmpresa(opcoes) {
    var configuracao = opcoes || {};
    var idEmpresa = Number(configuracao.idEmpresa);
    var servidores = Array.isArray(configuracao.servidoresVisiveis) ? configuracao.servidoresVisiveis : [];

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0 || !servidores.length) return stub();

    var issues = await issuesDaEmpresa(idEmpresa, servidores);
    if (!issues) return stub();

    var nomesPorId = new Map();
    servidores.forEach(function (servidor) {
        var id = Number(servidor.id_servidor);
        if (Number.isInteger(id) && servidor.nome) nomesPorId.set(id, servidor.nome);
    });

    var todosOsDias = diasBRT(MAX_DIAS);
    var chaves30d = new Set(todosOsDias.map(function (dia) { return dia.chave; }));

    return {
        abertos: montarAbertos(issues, nomesPorId),
        por_dia: montarPorDia(issues, todosOsDias),
        mttr: montarMttr(issues),
        ranking_problematicos: montarRanking(issues, servidores, chaves30d)
    };
}

module.exports = { obterDadosJiraEmpresa, stub };
