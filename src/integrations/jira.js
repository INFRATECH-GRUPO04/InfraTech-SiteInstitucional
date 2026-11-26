/*
 * Cliente Jira Cloud (somente leitura) usado pelos cards da Dashboard Geral.
 *
 * Não há dependência nova: usa o fetch nativo do Node. Toda falha de rede,
 * timeout, credencial ausente ou resposta inesperada vira `{ sucesso: false }`
 * com aviso em console — a rota HTTP continua respondendo 200 com stub vazio.
 * Nenhuma credencial é escrita em log.
 */

var CAMPOS = [
    'key', 'summary', 'description', 'created', 'resolutiondate',
    'status', 'statusCategory', 'priority', 'assignee'
].join(',');
var API_PATH_PADRAO = '/rest/api/3/search/jql';
var TIMEOUT_PADRAO_MS = 5000;
var MAX_RESULTADOS = 100;
var MAX_ISSUES = 1000;
var MAX_PAGINAS = 50;
var TTL_SUCESSO_MS = 5 * 60 * 1000;
// Falha fica em cache só por pouco tempo: evita duas chamadas no mesmo ciclo
// do front (/dash-geral + /dash-geral/incidentes) sem impedir nova tentativa.
var TTL_FALHA_MS = 30 * 1000;
var CHANGELOG_MAX_PAGINAS = 10;

// Status de destino considerados "concluído" no changelog e no fallback de
// status da issue. Normalizados (sem acento/caixa) antes da comparação.
var STATUS_CONCLUIDOS = [
    'done', 'closed', 'fechado', 'concluido', 'resolvido', 'cancelado', 'canceled', 'feito'
];

var cacheBusca = { chave: null, valor: null, expiraEm: 0 };
var cacheChangelog = new Map();
var avisoConfigEmitido = false;

function texto(valor) {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'string') return valor.trim();
    // Descrição da API v3 pode vir em ADF (documento estruturado). Achata os nós de texto.
    if (typeof valor === 'object' && Array.isArray(valor.content)) {
        return valor.content.map(texto).filter(Boolean).join('\n').trim();
    }
    if (typeof valor === 'object' && typeof valor.text === 'string') return valor.text.trim();
    return String(valor).trim();
}

function paraData(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor === 'number') {
        var dataNumero = new Date(valor);
        return Number.isNaN(dataNumero.getTime()) ? null : dataNumero;
    }
    // Jira pode devolver "+0000" em vez de "+00:00".
    var bruto = String(valor).trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    var data = new Date(bruto);
    return Number.isNaN(data.getTime()) ? null : data;
}

function primeiroId(regex, textoFonte) {
    var encontrado = regex.exec(String(textoFonte || ''));
    if (!encontrado) return null;
    var numero = Number(encontrado[1]);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function nomeFallback(summary, descricao) {
    var partes = String(summary || '').split(/\s+-\s+/);
    if (partes.length > 1) {
        var ultima = partes[partes.length - 1].trim();
        if (ultima) return ultima;
    }
    var encontrado = /Servidor:\s*([^\n(]+)\s*\(id\s*\d+\)/i.exec(String(descricao || ''));
    return encontrado ? encontrado[1].trim() : null;
}

function normalizarIssue(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var key = String(raw.key || '').trim();
    if (!key) return null;

    var fields = raw.fields && typeof raw.fields === 'object' ? raw.fields : {};
    var status = fields.status && typeof fields.status === 'object' ? fields.status : {};
    var categoria = status.statusCategory || fields.statusCategory || {};
    var priority = fields.priority && typeof fields.priority === 'object' ? fields.priority : {};
    var assignee = fields.assignee && typeof fields.assignee === 'object' ? fields.assignee : null;

    var summary = texto(fields.summary);
    var descricao = texto(fields.description);
    var empresaId = primeiroId(/\[EMP-(\d+)\]/i, summary) || primeiroId(/Empresa:\s*id\s*(\d+)/i, descricao);
    var servidorId = primeiroId(/\[SRV-(\d+)\]/i, summary) || primeiroId(/Servidor:[^\n]*?\(id\s*(\d+)\)/i, descricao);

    return {
        key: key,
        summary: summary,
        descricao: descricao,
        criadoEm: paraData(fields.created),
        resolvidoEm: paraData(fields.resolutiondate),
        statusNome: texto(status.name),
        statusCategoriaChave: texto(categoria.key),
        statusCategoriaNome: texto(categoria.name),
        prioridadeNome: texto(priority.name),
        responsavel: assignee && texto(assignee.displayName) ? texto(assignee.displayName) : null,
        empresaId: empresaId,
        servidorId: servidorId,
        nomeFallback: nomeFallback(summary, descricao)
    };
}

function numeroValido(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    var numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function normalizarNomeStatus(nome) {
    return String(nome || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/* Usado pelo service para decidir se a issue está concluída e pelo parser do
 * changelog para reconhecer o status de destino de uma transição.
 */
function ehStatusConcluido(nome) {
    var normalizado = normalizarNomeStatus(nome);
    if (!normalizado) return false;
    return STATUS_CONCLUIDOS.some(function (palavra) { return normalizado.indexOf(palavra) !== -1; });
}

function configuracao() {
    var baseUrl = String(process.env.JIRA_BASE_URL || '').trim().replace(/\/+$/, '');
    var email = String(process.env.JIRA_EMAIL || '').trim();
    var token = String(process.env.JIRA_TOKEN || '').trim();
    var projeto = String(process.env.JIRA_PROJECT || '').trim();

    if (!baseUrl || !email || !token || !projeto) return null;

    var apiPath = String(process.env.JIRA_API_PATH || API_PATH_PADRAO).trim();
    if (!apiPath) apiPath = API_PATH_PADRAO;
    if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;

    var timeout = numeroValido(process.env.JIRA_TIMEOUT_MS);
    if (timeout == null || timeout <= 0) timeout = TIMEOUT_PADRAO_MS;

    // Escapa aspas para não quebrar a JQL se o projeto vier de env externo.
    var projetoEscapado = projeto.replace(/[\\"]/g, '\\$&');
    var jql = 'project = "' + projetoEscapado + '" AND (created >= -60d OR statusCategory != Done) ORDER BY created DESC';

    return {
        baseUrl: baseUrl,
        url: baseUrl + apiPath,
        jql: jql,
        timeoutMs: timeout,
        autorizacao: 'Basic ' + Buffer.from(email + ':' + token).toString('base64'),
        chave: [baseUrl, apiPath, projeto, CAMPOS, jql].join('|')
    };
}

function avisarConfiguracaoIncompleta() {
    if (avisoConfigEmitido) return;
    avisoConfigEmitido = true;
    console.warn('[jira] credenciais/configuração incompletas; retornando stub vazio');
}

function detalheSeguro(erro) {
    if (erro && numeroValido(erro.status) != null) return 'status=' + erro.status;
    if (erro && erro.name) return String(erro.name);
    return '';
}

function cacheValido(chave) {
    if (!cacheBusca.valor || !cacheBusca.chave) return null;
    if (cacheBusca.chave !== chave) return null;
    if (Date.now() >= cacheBusca.expiraEm) return null;
    return cacheBusca.valor;
}

function guardarCache(chave, valor, ttl) {
    cacheBusca.chave = chave;
    cacheBusca.valor = valor;
    cacheBusca.expiraEm = Date.now() + ttl;
}

async function buscarComPaginacao(cfg) {
    var controlador = new AbortController();
    var temporizador = setTimeout(function () { controlador.abort(); }, cfg.timeoutMs);

    try {
        var issues = [];
        var proximoToken = null;
        var startAt = 0;
        var tokensVistos = new Set();

        for (var pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
            var query = new URLSearchParams();
            query.set('jql', cfg.jql);
            query.set('fields', CAMPOS);
            query.set('maxResults', String(MAX_RESULTADOS));
            if (proximoToken) query.set('nextPageToken', proximoToken);
            else if (pagina > 0 && startAt > 0) query.set('startAt', String(startAt));

            var resposta = await fetch(cfg.url + '?' + query.toString(), {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: cfg.autorizacao
                },
                signal: controlador.signal
            });

            if (!resposta.ok) {
                var erro = new Error('falha na API Jira');
                erro.status = resposta.status;
                throw erro;
            }

            var corpo = await resposta.json();
            if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
                throw new Error('resposta inesperada da API Jira');
            }
            var lote = Array.isArray(corpo.issues) ? corpo.issues : [];
            lote.forEach(function (raw) {
                var issue = normalizarIssue(raw);
                if (issue) issues.push(issue);
            });

            if (issues.length >= MAX_ISSUES) {
                console.warn('[jira] limite de ' + MAX_ISSUES + ' issues atingido; resultado truncado');
                break;
            }

            var token = typeof corpo.nextPageToken === 'string' && corpo.nextPageToken ? corpo.nextPageToken : null;
            if (token) {
                if (corpo.isLast === true) break;
                if (tokensVistos.has(token)) {
                    console.warn('[jira] nextPageToken repetido; paginação interrompida');
                    break;
                }
                tokensVistos.add(token);
                proximoToken = token;
                startAt = 0;
                continue;
            }

            var inicio = numeroValido(corpo.startAt);
            var total = numeroValido(corpo.total);
            if (inicio != null && total != null) {
                var proximo = inicio + Math.max(lote.length, 1);
                if (!lote.length || proximo >= total) break;
                startAt = proximo;
                continue;
            }

            // Sem token e sem startAt/total: não há como avançar com segurança.
            break;
        }

        return { issues: issues, sucesso: true };
    } finally {
        clearTimeout(temporizador);
    }
}

/* Busca única do projeto, com cache de 5 min em sucesso e 30 s em falha.
 * O filtro por empresa é feito depois, no serviço (ver src/services/jiraDashGeral).
 */
async function buscarIssuesProjeto() {
    var cfg = configuracao();
    if (!cfg) {
        avisarConfiguracaoIncompleta();
        return { issues: [], sucesso: false };
    }

    var emCache = cacheValido(cfg.chave);
    if (emCache) return emCache;

    var valor;
    try {
        valor = await buscarComPaginacao(cfg);
    } catch (erro) {
        console.warn('[jira] falha na busca; retornando stub vazio', detalheSeguro(erro));
        valor = { issues: [], sucesso: false };
    }

    guardarCache(cfg.chave, valor, valor.sucesso ? TTL_SUCESSO_MS : TTL_FALHA_MS);
    return valor;
}

/* Link de navegação (fora da API REST) usado na seta da tabela de incidentes. */
function urlIssue(key) {
    var cfg = configuracao();
    var chave = String(key || '').trim();
    if (!cfg || !chave) return null;
    return cfg.baseUrl + '/browse/' + encodeURIComponent(chave);
}

/* Changelog: usado só como fallback de MTTR quando resolutiondate veio vazio.
 * Considera a ÚLTIMA transição para um status concluído; isso cobre o caso de
 * reabertura seguida de nova conclusão.
 */
async function buscarConclusaoComPaginacao(issueKey, cfg) {
    var controlador = new AbortController();
    var temporizador = setTimeout(function () { controlador.abort(); }, cfg.timeoutMs);
    var urlBase = cfg.baseUrl + '/rest/api/3/issue/' + encodeURIComponent(issueKey) + '/changelog';

    try {
        var conclusao = null;
        var startAt = 0;

        for (var pagina = 0; pagina < CHANGELOG_MAX_PAGINAS; pagina += 1) {
            var query = new URLSearchParams();
            query.set('maxResults', String(MAX_RESULTADOS));
            query.set('startAt', String(startAt));

            var resposta = await fetch(urlBase + '?' + query.toString(), {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: cfg.autorizacao
                },
                signal: controlador.signal
            });

            if (!resposta.ok) {
                var erro = new Error('falha no changelog do Jira');
                erro.status = resposta.status;
                throw erro;
            }

            var corpo = await resposta.json();
            if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
                throw new Error('resposta inesperada do changelog');
            }

            // Jira Cloud devolve `values`; outras instâncias/versões usam
            // `histories`. Aceitar os dois evita perder a transição.
            var historias = Array.isArray(corpo.values) ? corpo.values
                : Array.isArray(corpo.histories) ? corpo.histories
                : [];
            historias.forEach(function (historia) {
                var criadoEm = paraData(historia && historia.created);
                if (!criadoEm) return;
                var itens = historia && Array.isArray(historia.items) ? historia.items : [];
                itens.forEach(function (item) {
                    if (!item || String(item.field || '').toLowerCase() !== 'status') return;
                    if (!ehStatusConcluido(texto(item.toString))) return;
                    if (!conclusao || criadoEm.getTime() > conclusao.getTime()) conclusao = criadoEm;
                });
            });

            if (corpo.isLast === true) break;

            var inicio = numeroValido(corpo.startAt);
            var total = numeroValido(corpo.total);
            if (inicio != null && total != null) {
                var proximo = inicio + Math.max(historias.length, 1);
                if (!historias.length || proximo >= total) break;
                startAt = proximo;
                continue;
            }

            // Sem isLast/startAt/total, não há como avançar com segurança.
            break;
        }

        return conclusao;
    } finally {
        clearTimeout(temporizador);
    }
}

async function buscarConclusaoIssue(key) {
    var issueKey = String(key || '').trim();
    if (!issueKey) return null;

    var cfg = configuracao();
    if (!cfg) {
        avisarConfiguracaoIncompleta();
        return null;
    }

    // Inclui a configuração na chave para não reaproveitar dados de outra
    // instância/projeto se o processo trocar de ambiente em runtime.
    var chave = cfg.chave + '|' + issueKey;
    var entrada = cacheChangelog.get(chave);
    if (entrada && Date.now() < entrada.expiraEm) return entrada.valor;

    var valor = null;
    var sucesso = false;
    try {
        valor = await buscarConclusaoComPaginacao(issueKey, cfg);
        sucesso = true;
    } catch (erro) {
        console.warn('[jira] falha ao ler changelog de ' + issueKey + '; retornando sem conclusão', detalheSeguro(erro));
        valor = null;
    }

    cacheChangelog.set(chave, {
        valor: valor,
        expiraEm: Date.now() + (sucesso ? TTL_SUCESSO_MS : TTL_FALHA_MS)
    });
    return valor;
}

module.exports = {
    buscarIssuesProjeto,
    normalizarIssue,
    ehStatusConcluido,
    urlIssue,
    buscarConclusaoIssue
};
