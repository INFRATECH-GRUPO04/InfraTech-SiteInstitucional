var sdk = require("@aws-sdk/client-s3");
var s3 = require("../database/s3Config");
var RAIZ = "03-gold/metricas/";
var ARQUIVO = "dashboard_sarah.json";

function prefixo(idEmpresa, idServidor, data) {
    return RAIZ + "empresa_id=" + idEmpresa + "/servidor_id=" + idServidor + "/data=" + data + "/";
}

async function listar(prefix, delimiter) {
    var token;
    var chaves = [];
    do {
        var pagina = await s3.send(new sdk.ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET,
            Prefix: prefix,
            Delimiter: delimiter,
            ContinuationToken: token
        }));
        (pagina.Contents || []).forEach(function (objeto) { chaves.push(objeto.Key); });
        (pagina.CommonPrefixes || []).forEach(function (pasta) { chaves.push(pasta.Prefix); });
        token = pagina.IsTruncated ? pagina.NextContinuationToken : null;
    } while (token);
    return chaves;
}

function dias(inicio, fim) {
    var atual = new Date(inicio + "T00:00:00Z");
    var ultimo = new Date(fim + "T00:00:00Z");
    var saida = [];
    while (atual <= ultimo) {
        saida.push(atual.toISOString().slice(0, 10));
        atual.setUTCDate(atual.getUTCDate() + 1);
    }
    return saida;
}

async function lerObjeto(chave) {
    var objeto = await s3.send(new sdk.GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: chave
    }));
    return JSON.parse(await objeto.Body.transformToString());
}

function horarios(documento) {
    if (Array.isArray(documento.horarios)) return documento.horarios;
    if (Array.isArray(documento.capturas)) {
        return [{ lote: documento.lote || null, medias: documento.medias || null, capturas: documento.capturas }];
    }
    return [];
}

function capturas(documento, idServidor) {
    var lista = [];
    horarios(documento).forEach(function (h) {
        (h.capturas || []).forEach(function (c) {
            lista.push(Object.assign({}, c, { idServidor: Number(idServidor), lote: h.lote || null }));
        });
    });
    return lista;
}

function mediasDe(lista) {
    var saida = {};
    ['cpu', 'ram', 'disco', 'rede'].forEach(function (campo) {
        var v = lista.map(function (x) { return x[campo]; })
            .filter(function (x) { return x !== null && x !== undefined; })
            .map(Number);
        saida[campo] = v.length
            ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10
            : null;
    });
    return saida;
}

async function lerServidor(idEmpresa, idServidor, inicio, fim) {
    var chaves = [];
    for (var data of dias(inicio, fim)) {
        var encontradas = await listar(prefixo(idEmpresa, idServidor, data));
        encontradas.forEach(function (chave) {
            if (chave.endsWith("/" + ARQUIVO)) chaves.push(chave);
        });
    }
    if (!chaves.length) return null;
    chaves.sort();

    var documentos = await Promise.all(chaves.map(lerObjeto));

    var listaDias = documentos.map(function (doc, i) {
        var m = chaves[i].match(/data=(\d{4}-\d{2}-\d{2})\//);
        return {
            data: doc.data || (m ? m[1] : null),
            nomeServidor: doc.nome_servidor || null,
            geradoEm: doc.gerado_em || null,
            medias: doc.medias || null,
            horarios: horarios(doc)
        };
    });

    var todas = documentos.reduce(function (acc, doc) {
        return acc.concat(capturas(doc, idServidor));
    }, []).sort(function (a, b) {
        return String(a.dataHora).localeCompare(String(b.dataHora));
    });

    return {
        idServidor: Number(idServidor),
        nomeServidor: listaDias.length ? listaDias[listaDias.length - 1].nomeServidor : null,
        medias: mediasDe(todas),   // média do período inteiro
        dias: listaDias,           // cada dia com seus horários e médias
        capturas: todas            // lista plana, para o gráfico
    };
}

async function ultimaLeitura(idEmpresa, idServidor) {
    var pastas = await listar(RAIZ + "empresa_id=" + idEmpresa + "/servidor_id=" + idServidor + "/", "/");
    var data = pastas.map(function (pasta) {
        var parte = pasta.match(/data=(\d{4}-\d{2}-\d{2})\//);
        return parte ? parte[1] : null;
    }).filter(Boolean).sort().pop();
    if (!data) return null;
    var chaves = (await listar(prefixo(idEmpresa, idServidor, data))).filter(function (chave) {
        return chave.endsWith("/" + ARQUIVO);
    }).sort();
    if (!chaves.length) return null;
    var documento = await lerObjeto(chaves[chaves.length - 1]);
    var lista = capturas(documento, idServidor);
    var ultima = lista[lista.length - 1];
    if (!ultima) return null;
        var hs = horarios(documento);
    var ultimoHorario = hs[hs.length - 1] || {};
    return Object.assign({}, ultima, {
        nomeServidor: documento.nome_servidor || null,
        medias: ultimoHorario.medias || documento.medias || null,
        mediasDia: documento.medias || null,
        lote: ultimoHorario.lote || documento.lote || null
    });
}

module.exports = { lerServidor, ultimaLeitura };
