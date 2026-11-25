var sdk = require("@aws-sdk/client-s3");
var s3 = require("../database/s3Config");
var RAIZ = "03-gold/";
var ARQUIVO = "perfeito-sarah.json";

function prefixo(idEmpresa, idServidor, data) {
    return RAIZ + "metricas"+ "/empresa_id=" + idEmpresa + "/servidor_id=" + idServidor + "/data=" + data + "/";
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

function capturas(documento, idServidor) {
    var lista = Array.isArray(documento.capturas) ? documento.capturas : [];
    return lista.map(function (captura) {
        return Object.assign({}, captura, {
            idServidor: Number(documento.id_servidor || idServidor)
        });
    });
}

async function lerServidor(idEmpresa, idServidor, inicio, fim) {
    var chaves = [];
    for (var data of dias(inicio, fim)) {
        var encontradas = await listar(prefixo(idEmpresa, idServidor, data));
        encontradas.forEach(function (chave) {
            if (chave.endsWith("/" + ARQUIVO)) chaves.push(chave);
        });
    }
    if (!chaves.length) return [];
    var documentos = await Promise.all(chaves.sort().map(lerObjeto));
    return documentos.reduce(function (todas, documento) {
        return todas.concat(capturas(documento, idServidor));
    }, []).sort(function (a, b) {
        return String(a.dataHora).localeCompare(String(b.dataHora));
    });
}

async function ultimaLeitura(idEmpresa, idServidor) {
    var pastas = await listar(RAIZ + "metricas/empresa_id=" + idEmpresa + "/servidor_id=" + idServidor + "/", "/");
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
    return Object.assign({}, ultima, {
        nomeServidor: documento.nome_servidor || null,
        medias: documento.medias || null,
        lote: documento.lote || null
    });
}

module.exports = { lerServidor, ultimaLeitura };
