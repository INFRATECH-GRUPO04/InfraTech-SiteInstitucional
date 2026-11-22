const ZONA = process.env.TIMEZONE || 'America/Sao_Paulo';
const NOMES_METRICAS = { cpu: 'CPU', ram: 'RAM', disco: 'Disco', rede: 'Rede' };
const UNIDADES_METRICAS = { cpu: '%', ram: '%', disco: '%', rede: 'Mbps' };
const CAMPOS_METRICAS = { cpu: 'cpu_pct', ram: 'ram_pct', disco: 'disco_pct' };

// (Cláudia - M) Converte as datas escolhidas para UTC antes da consulta ao histórico.
function dataLocalParaUtc(dataTexto, hora) {
    const partes = String(dataTexto || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!partes) return null;
    const desejado = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), hora || 0);
    const dataTeste = new Date(desejado);
    if (dataTeste.getUTCFullYear() !== Number(partes[1])
        || dataTeste.getUTCMonth() !== Number(partes[2]) - 1
        || dataTeste.getUTCDate() !== Number(partes[3])) return null;

    let estimado = desejado;
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
        const valores = new Intl.DateTimeFormat('en-CA', {
            timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date(estimado)).reduce((resultado, parte) => {
            resultado[parte.type] = parte.value;
            return resultado;
        }, {});
        const localComoUtc = Date.UTC(Number(valores.year), Number(valores.month) - 1,
            Number(valores.day), Number(valores.hour), Number(valores.minute), Number(valores.second));
        const diferenca = desejado - localComoUtc;
        estimado += diferenca;
        if (diferenca === 0) break;
    }
    return new Date(estimado);
}

// (Cláudia - M) Lê a métrica selecionada e ignora valores ausentes ou inválidos.
function valorMetrica(captura, metrica) {
    if (!captura || !Object.prototype.hasOwnProperty.call(NOMES_METRICAS, metrica)) return null;
    let valor;
    if (metrica === 'rede') {
        if (captura.rede_mbps !== undefined && captura.rede_mbps !== null && captura.rede_mbps !== '') valor = Number(captura.rede_mbps);
        else if (captura.upload_mbps != null && captura.upload_mbps !== ''
            && captura.download_mbps != null && captura.download_mbps !== '') {
            valor = Number(captura.upload_mbps) + Number(captura.download_mbps);
        } else return null;
    } else {
        const bruto = captura[CAMPOS_METRICAS[metrica]];
        if (bruto === undefined || bruto === null || bruto === '') return null;
        valor = Number(bruto);
    }
    if (!Number.isFinite(valor)) return null;
    if (metrica === 'rede' ? valor < 0 : valor < 0 || valor > 100) return null;
    return valor;
}

function mediaDesvio(valores) {
    const validos = valores.filter(Number.isFinite);
    if (validos.length < 2) return null;
    const media = validos.reduce((soma, valor) => soma + valor, 0) / validos.length;
    const variancia = validos.reduce((soma, valor) => soma + (valor - media) ** 2, 0) / validos.length;
    const desvio = Math.sqrt(variancia);
    return Number.isFinite(desvio) ? { media, desvio } : null;
}

// (Cláudia - M) Calcula Pearson para as capturas que foram alinhadas no tempo.
function correlacao(pares) {
    if (pares.length < 2) return { coeficiente: null, status: 'amostras_insuficientes', quantidade: pares.length };
    const mediaX = pares.reduce((soma, par) => soma + par.x, 0) / pares.length;
    const mediaY = pares.reduce((soma, par) => soma + par.y, 0) / pares.length;
    let xy = 0, xx = 0, yy = 0;
    pares.forEach((par) => {
        const dx = par.x - mediaX, dy = par.y - mediaY;
        xy += dx * dy;
        xx += dx * dx;
        yy += dy * dy;
    });
    if (xx === 0 || yy === 0) return { coeficiente: null, status: 'variancia_zero', quantidade: pares.length };
    const r = xy / Math.sqrt(xx * yy);
    return { coeficiente: Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null, status: 'ok', quantidade: pares.length };
}

// (Cláudia - M) Calcula reta, R² e desvios; limita os pontos enviados ao gráfico.
function regressao(pares, maxPontos = 500) {
    const pearson = correlacao(pares);
    if (pares.length < 2) return { status: 'amostras_insuficientes', ...pearson, pontos: [], maiorDesvio: null };
    const mediaX = pares.reduce((soma, par) => soma + par.x, 0) / pares.length;
    const mediaY = pares.reduce((soma, par) => soma + par.y, 0) / pares.length;
    let somaXX = 0, somaXY = 0;
    pares.forEach((par) => {
        somaXX += (par.x - mediaX) ** 2;
        somaXY += (par.x - mediaX) * (par.y - mediaY);
    });
    if (somaXX === 0) return { status: 'variancia_zero_x', ...pearson, pontos: [], maiorDesvio: null };
    const angular = somaXY / somaXX;
    const intercepto = mediaY - angular * mediaX;
    if (!Number.isFinite(angular) || !Number.isFinite(intercepto)) {
        return { status: 'ajuste_invalido', ...pearson, pontos: [], maiorDesvio: null };
    }
    const r2 = pearson.coeficiente == null ? null : pearson.coeficiente ** 2;
    const limite = Math.max(0, maxPontos);
    const indicesExibidos = new Set();
    const quantidadeExibida = Math.min(limite, pares.length);
    const passo = (pares.length - 1) / Math.max(1, quantidadeExibida - 1);
    for (let indice = 0; indice < quantidadeExibida; indice += 1) {
        indicesExibidos.add(Math.round(indice * passo));
    }
    const exibidos = [];
    let maiorDesvio = null;
    pares.forEach((par, indice) => {
        const estimado = angular * par.x + intercepto;
        const residuo = par.y - estimado;
        const ponto = { timestamp: par.timestamp, idServidor: par.idServidor ?? null,
            nomeServidor: par.nomeServidor ?? null,
            idServidorX: par.idServidorX ?? null, nomeServidorX: par.nomeServidorX ?? null,
            idServidorY: par.idServidorY ?? null, nomeServidorY: par.nomeServidorY ?? null,
            timestampX: par.timestampX ?? par.timestamp, timestampY: par.timestampY ?? par.timestamp,
            x: par.x, observado: par.y, estimado, residuo,
            desvioAbsoluto: Math.abs(residuo) };
        if (!maiorDesvio || ponto.desvioAbsoluto > maiorDesvio.desvioAbsoluto) maiorDesvio = ponto;
        if (indicesExibidos.has(indice)) exibidos.push(ponto);
    });
    if (maxPontos > 0 && maiorDesvio && !exibidos.some((ponto) => ponto.timestamp === maiorDesvio.timestamp
        && ponto.idServidor === maiorDesvio.idServidor)) exibidos.push(maiorDesvio);
    exibidos.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const menorX = pares.reduce((menor, par) => Math.min(menor, par.x), Infinity);
    const maiorX = pares.reduce((maior, par) => Math.max(maior, par.x), -Infinity);
    return {
        status: 'ok', angular, intercepto, r2: Number.isFinite(r2) ? r2 : null,
        quantidade: pares.length, maiorDesvio,
        pontos: exibidos,
        reta: pares.length ? [{ x: menorX, y: angular * menorX + intercepto },
            { x: maiorX, y: angular * maiorX + intercepto }] : []
    };
}

function quantil(ordenados, percentil) {
    if (!ordenados.length) return null;
    const posicao = (ordenados.length - 1) * percentil;
    const base = Math.floor(posicao), fracao = posicao - base;
    const seguinte = ordenados[base + 1];
    return seguinte === undefined ? ordenados[base] : ordenados[base] + fracao * (seguinte - ordenados[base]);
}

// (Cláudia - M) Resume os valores em quartis e identifica possíveis outliers.
function boxplot(valores, limiteOutliers = 120) {
    const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b);
    if (!ordenados.length) return { status: 'sem_dados', quantidade: 0, outliers: [] };
    const q1 = quantil(ordenados, 0.25), mediana = quantil(ordenados, 0.5), q3 = quantil(ordenados, 0.75);
    const iqr = q3 - q1, cercaInferior = q1 - 1.5 * iqr, cercaSuperior = q3 + 1.5 * iqr;
    const dentro = ordenados.filter((valor) => valor >= cercaInferior && valor <= cercaSuperior);
    const outliers = ordenados.filter((valor) => valor < cercaInferior || valor > cercaSuperior);
    const passoOutlier = Math.max(1, Math.ceil(outliers.length / limiteOutliers));
    const outliersExibidos = outliers.filter((_, indice) => indice % passoOutlier === 0);
    return {
        status: 'ok', quantidade: ordenados.length, q1, mediana, q3, iqr,
        bigodeInferior: dentro[0], bigodeSuperior: dentro[dentro.length - 1],
        outliers: outliersExibidos, outliersTotal: outliers.length
    };
}

// (Cláudia - M) Soma o tempo crítico sem contar lacunas longas como tempo monitorado.
function duracaoAcima(linha, limite, frequencia) {
    if (!Number.isFinite(limite) || !Number.isFinite(frequencia) || frequencia <= 0) return null;
    let segundos = 0;
    for (let indice = 1; indice < linha.length; indice += 1) {
        const anterior = linha[indice - 1], atual = linha[indice];
        if (anterior.valor == null || atual.valor == null) continue;
        const intervalo = (Date.parse(atual.timestamp) - Date.parse(anterior.timestamp)) / 1000;
        if (!(intervalo > 0 && intervalo <= frequencia * 1.5)) continue;
        const primeiroAcima = anterior.valor >= limite, segundoAcima = atual.valor >= limite;
        if (primeiroAcima && segundoAcima) segundos += intervalo;
        else if (primeiroAcima !== segundoAcima && atual.valor !== anterior.valor) {
            const fracaoAcima = primeiroAcima
                ? (anterior.valor - limite) / (anterior.valor - atual.valor)
                : (atual.valor - limite) / (atual.valor - anterior.valor);
            segundos += intervalo * Math.max(0, Math.min(1, fracaoAcima));
        }
    }
    return segundos;
}

// (Cláudia - M) Reduz pontos para o gráfico sem reduzir as amostras dos cálculos.
function downsample(amostras, maximo, temposAnomalia) {
    if (amostras.length <= maximo) return amostras.map((amostra, indice) => ({ amostra, indice }));
    const indices = new Set();
    const passo = (amostras.length - 1) / (maximo - 1);
    for (let i = 0; i < maximo; i += 1) indices.add(Math.round(i * passo));
    amostras.forEach((amostra, indice) => {
        if (temposAnomalia.has(amostra.timestamp)) indices.add(indice);
    });
    return [...indices].sort((a, b) => a - b).map((indice) => ({ amostra: amostras[indice], indice }));
}

function alinharCapturas(origem, destino, metricaX, metricaY, toleranciaSegundos = 30) {
    const x = (origem.amostras || []).map((captura) => ({ captura, instante: Date.parse(captura.timestamp) }))
        .filter((item) => Number.isFinite(item.instante) && valorMetrica(item.captura, metricaX) !== null)
        .sort((a, b) => a.instante - b.instante);
    const y = (destino.amostras || []).map((captura) => ({ captura, instante: Date.parse(captura.timestamp) }))
        .filter((item) => Number.isFinite(item.instante) && valorMetrica(item.captura, metricaY) !== null)
        .sort((a, b) => a.instante - b.instante);
    const pares = [];
    let indiceX = 0, indiceY = 0;
    const toleranciaMs = toleranciaSegundos * 1000;

    // (Cláudia - M) Alinha capturas em até 30 segundos sem reutilizar observações.
    while (indiceX < x.length && indiceY < y.length) {
        const diferenca = x[indiceX].instante - y[indiceY].instante;
        if (Math.abs(diferenca) <= toleranciaMs) {
            pares.push({
                timestamp: new Date(Math.max(x[indiceX].instante, y[indiceY].instante)).toISOString(),
                timestampX: x[indiceX].captura.timestamp,
                timestampY: y[indiceY].captura.timestamp,
                idServidorX: origem.idServidor, nomeServidorX: origem.nome,
                idServidorY: destino.idServidor, nomeServidorY: destino.nome,
                x: valorMetrica(x[indiceX].captura, metricaX),
                y: valorMetrica(y[indiceY].captura, metricaY)
            });
            indiceX += 1;
            indiceY += 1;
        } else if (diferenca < 0) indiceX += 1;
        else indiceY += 1;
    }
    return pares;
}

function rotuloRelacao(origem, destino, metricaX, metricaY) {
    return `${metricaX.toUpperCase()} ${origem.nome} × ${metricaY.toUpperCase()} ${destino.nome}`;
}

// (Cláudia - M) Resume os pares com a mediana de Pearson e a distribuição das relações.
function calcularResumoPearson(relacoes) {
    const validas = relacoes.filter((relacao) => Number.isFinite(relacao.coeficiente));
    const ordenados = validas.map((relacao) => relacao.coeficiente).sort((a, b) => a - b);
    const mediana = ordenados.length
        ? ordenados.length % 2 ? ordenados[(ordenados.length - 1) / 2]
            : (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2
        : null;
    const distribuicao = { positivas: 0, negativas: 0, nulas: 0, fortes: 0, moderadas: 0, fracas: 0 };
    validas.forEach((relacao) => {
        if (relacao.coeficiente > 0) distribuicao.positivas += 1;
        else if (relacao.coeficiente < 0) distribuicao.negativas += 1;
        else distribuicao.nulas += 1;
        const intensidade = Math.abs(relacao.coeficiente) >= 0.7 ? 'fortes'
            : Math.abs(relacao.coeficiente) >= 0.3 ? 'moderadas' : 'fracas';
        distribuicao[intensidade] += 1;
    });
    return {
        medianaCoeficiente: mediana,
        quantidadeRelacoesValidas: validas.length,
        quantidadeRelacoesInsuficientes: relacoes.length - validas.length,
        distribuicao,
        metodo: 'Mediana dos coeficientes por par direcionado; não é uma correlação única do conjunto.'
    };
}

// (Cláudia - M) Calcula as estatísticas de uma relação entre dois servidores.
function resumirRelacao(origem, destino, metricas, toleranciaSegundos) {
    const pares = alinharCapturas(origem, destino, metricas.x, metricas.y, toleranciaSegundos);
    const pearson = correlacao(pares);
    const ajuste = regressao(pares, 0);
    return {
        idOrigem: origem.idServidor, nomeOrigem: origem.nome,
        idDestino: destino.idServidor, nomeDestino: destino.nome,
        rotulo: rotuloRelacao(origem, destino, metricas.x, metricas.y),
        coeficiente: pearson.coeficiente, statusPearson: pearson.status,
        intensidade: pearson.coeficiente == null ? 'indisponível'
            : Math.abs(pearson.coeficiente) >= 0.7 ? 'forte'
                : Math.abs(pearson.coeficiente) >= 0.3 ? 'moderada' : 'fraca',
        sinal: pearson.coeficiente == null ? 'indisponível'
            : pearson.coeficiente > 0 ? 'positiva' : pearson.coeficiente < 0 ? 'negativa' : 'nula',
        amostrasAlinhadas: pares.length,
        statusRegressao: ajuste.status,
        angular: ajuste.angular ?? null, intercepto: ajuste.intercepto ?? null, r2: ajuste.r2 ?? null,
        maiorDesvio: ajuste.maiorDesvio ? {
            valor: ajuste.maiorDesvio.desvioAbsoluto, residual: ajuste.maiorDesvio.residuo,
            timestamp: ajuste.maiorDesvio.timestamp, timestampX: ajuste.maiorDesvio.timestampX,
            timestampY: ajuste.maiorDesvio.timestampY
        } : null
    };
}

// (Cláudia - M) Monta os dados da regressão detalhada para o par selecionado.
function montarDetalheRegressao(origem, destino, metricas, toleranciaSegundos, maxPontos = 400) {
    const pares = alinharCapturas(origem, destino, metricas.x, metricas.y, toleranciaSegundos);
    const ajuste = regressao(pares, maxPontos);
    return {
        idOrigem: origem.idServidor, nomeOrigem: origem.nome,
        idDestino: destino.idServidor, nomeDestino: destino.nome,
        rotulo: rotuloRelacao(origem, destino, metricas.x, metricas.y),
        metricaX: metricas.x, metricaY: metricas.y,
        status: ajuste.status, angular: ajuste.angular ?? null, intercepto: ajuste.intercepto ?? null,
        r2: ajuste.r2 ?? null, quantidade: ajuste.quantidade || 0,
        maiorDesvio: ajuste.maiorDesvio ? {
            valor: ajuste.maiorDesvio.desvioAbsoluto, residual: ajuste.maiorDesvio.residuo,
            timestamp: ajuste.maiorDesvio.timestamp, timestampX: ajuste.maiorDesvio.timestampX,
            timestampY: ajuste.maiorDesvio.timestampY
        } : null,
        pontos: ajuste.pontos || [], reta: ajuste.reta || []
    };
}

// (Cláudia - M) Escolhe uma regressão representativa sem fazer média de retas diferentes.
function resumirRegressoes(relacoes) {
    const validas = relacoes.filter((relacao) => relacao.statusRegressao === 'ok' && Number.isFinite(relacao.r2));
    const r2 = validas.map((relacao) => relacao.r2).sort((a, b) => a - b);
    const medianaR2 = r2.length ? r2.length % 2 ? r2[(r2.length - 1) / 2]
        : (r2[r2.length / 2 - 1] + r2[r2.length / 2]) / 2 : null;
    const representantes = validas.slice().sort((a, b) =>
        Math.abs(a.r2 - medianaR2) - Math.abs(b.r2 - medianaR2)
        || b.amostrasAlinhadas - a.amostrasAlinhadas
        || a.idOrigem - b.idOrigem || a.idDestino - b.idDestino);
    return {
        quantidadeRelacoesValidas: validas.length,
        quantidadeRelacoesInsuficientes: relacoes.length - validas.length,
        medianaR2,
        menorR2: r2.length ? r2[0] : null,
        maiorR2: r2.length ? r2[r2.length - 1] : null,
        inclinacoesPositivas: validas.filter((relacao) => relacao.angular > 0).length,
        inclinacoesNegativas: validas.filter((relacao) => relacao.angular < 0).length,
        metodoRepresentativo: 'Relação válida com R² mais próximo da mediana; desempate por amostras e IDs.',
        idRelacaoRepresentativa: representantes[0]
            ? `${representantes[0].idOrigem}:${representantes[0].idDestino}` : null
    };
}

// (Cláudia - M) Agrupa anomalias próximas no tempo para destacar eventos simultâneos.
function agruparSimultaneos(eventos, toleranciaSegundos) {
    const grupos = [];
    const porMetrica = new Map();
    eventos.forEach((evento) => {
        if (!porMetrica.has(evento.metrica)) porMetrica.set(evento.metrica, []);
        porMetrica.get(evento.metrica).push(evento);
    });
    porMetrica.forEach((lista, metrica) => {
        lista.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        for (let indice = 0; indice < lista.length;) {
            const inicio = Date.parse(lista[indice].timestamp);
            const membros = [];
            while (indice < lista.length && Date.parse(lista[indice].timestamp) - inicio <= toleranciaSegundos * 1000) {
                membros.push(lista[indice]);
                indice += 1;
            }
            const servidores = [...new Set(membros.map((evento) => evento.idServidor))];
            if (servidores.length > 1) grupos.push({
                timestamp: membros[0].timestamp, metrica, quantidadeServidores: servidores.length,
                servidores: membros.map((evento) => evento.nomeServidor),
                membros: membros.map((evento) => ({ idServidor: evento.idServidor,
                    nomeServidor: evento.nomeServidor, timestamp: evento.timestamp,
                    zScore: evento.zScore, valor: evento.valor })),
                maiorZ: membros.reduce((maior, evento) => Math.abs(evento.zScore) > Math.abs(maior) ? evento.zScore : maior, 0)
            });
        }
    });
    return grupos.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

// (Cláudia - M) Calcula os indicadores e as quatro análises para os servidores e período escolhidos.
function calcularAnalise({ servidores, inicioUtc, fimUtc, metricas, limitesCriticos, toleranciaSegundos = 30 }) {
    const selecionados = servidores.map((servidor) => ({
        ...servidor,
        amostras: (servidor.amostras || []).filter((amostra) => {
            const instante = Date.parse(amostra.timestamp);
            return Number.isFinite(instante) && instante >= inicioUtc.getTime() && instante < fimUtc.getTime();
        }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    }));
    const relacoes = [];
    for (const origem of selecionados) {
        for (const destino of selecionados) {
            if (origem.idServidor === destino.idServidor) continue;
            relacoes.push(resumirRelacao(origem, destino, metricas, toleranciaSegundos));
        }
    }
    const resumoPearson = calcularResumoPearson(relacoes);
    const resumoRegressao = resumirRegressoes(relacoes);
    const relacaoInicial = resumoRegressao.idRelacaoRepresentativa
        ? relacoes.find((item) => `${item.idOrigem}:${item.idDestino}` === resumoRegressao.idRelacaoRepresentativa)
        : null;
    const servidorOrigem = relacaoInicial && selecionados.find((item) => item.idServidor === relacaoInicial.idOrigem);
    const servidorDestino = relacaoInicial && selecionados.find((item) => item.idServidor === relacaoInicial.idDestino);
    const regressaoRepresentativa = servidorOrigem && servidorDestino
        ? montarDetalheRegressao(servidorOrigem, servidorDestino, metricas, toleranciaSegundos) : null;

    const disponibilidade = [];
    const boxplots = [];
    const eventosIndividuais = [];
    const pontosPorTimestamp = new Map();
    let capturasValidas = 0, capturasEsperadas = 0, segundosCriticos = 0, haTempoCritico = false;
    const limitesCriticosEncontrados = [];

    selecionados.forEach((servidor) => {
        const frequenciaInformada = Number(servidor.metadados?.frequencia_esperada_segundos);
        const frequencia = Number.isFinite(frequenciaInformada) && frequenciaInformada > 0 ? frequenciaInformada : 60;
        const primeira = Date.parse(servidor.metadados?.primeira_captura || '');
        const ultima = Date.parse(servidor.metadados?.ultima_captura || '');
        let esperadas = 0;
        if (Number.isFinite(primeira) && Number.isFinite(ultima) && ultima >= inicioUtc.getTime() && primeira < fimUtc.getTime()) {
            const inicioConhecido = Math.max(primeira, inicioUtc.getTime());
            const fimConhecido = Math.min(ultima, fimUtc.getTime() - 1);
            const primeiroEsperado = primeira + Math.ceil((inicioConhecido - primeira) / (frequencia * 1000)) * frequencia * 1000;
            if (primeiroEsperado <= fimConhecido) esperadas = Math.floor((fimConhecido - primeiroEsperado) / (frequencia * 1000)) + 1;
        }
        const cobertura = esperadas ? Math.min(100, servidor.amostras.length / esperadas * 100) : null;
        capturasValidas += servidor.amostras.length;
        capturasEsperadas += esperadas;
        disponibilidade.push({ idServidor: servidor.idServidor, nomeServidor: servidor.nome,
            semDados: !servidor.amostras.length,
            primeiraCaptura: servidor.metadados?.primeira_captura || null,
            ultimaCaptura: servidor.metadados?.ultima_captura || null,
            frequenciaEsperadaSegundos: frequencia, capturasValidas: servidor.amostras.length,
            capturasEsperadas: esperadas, coberturaPct: cobertura });

        const valoresBoxplot = servidor.amostras.map((amostra) => valorMetrica(amostra, metricas.boxplot))
            .filter((valor) => valor !== null);
        boxplots.push({ idServidor: servidor.idServidor, nomeServidor: servidor.nome,
            metrica: metricas.boxplot, unidade: UNIDADES_METRICAS[metricas.boxplot],
            ...boxplot(valoresBoxplot) });

        [metricas.x, metricas.y].forEach((metrica) => {
            const valores = servidor.amostras.map((amostra) => ({
                timestamp: amostra.timestamp, valor: valorMetrica(amostra, metrica)
            })).filter((amostra) => amostra.valor !== null);
            const estatistica = mediaDesvio(valores.map((item) => item.valor));
            if (!estatistica || estatistica.desvio === 0) return;
            valores.forEach((item) => {
                const zScore = (item.valor - estatistica.media) / estatistica.desvio;
                if (Math.abs(zScore) >= 3) eventosIndividuais.push({
                    idServidor: servidor.idServidor, nomeServidor: servidor.nome,
                    timestamp: item.timestamp, metrica, valor: item.valor, zScore
                });
            });
        });

        servidor.amostras.forEach((amostra) => {
            if (!pontosPorTimestamp.has(amostra.timestamp)) pontosPorTimestamp.set(amostra.timestamp, {
                timestamp: amostra.timestamp, valoresX: [], valoresY: []
            });
            const ponto = pontosPorTimestamp.get(amostra.timestamp);
            const x = valorMetrica(amostra, metricas.x), y = valorMetrica(amostra, metricas.y);
            if (x !== null) ponto.valoresX.push(x);
            if (y !== null) ponto.valoresY.push(y);
        });

        const limiteBruto = limitesCriticos?.[servidor.idServidor]?.[metricas.x];
        const limiteOriginal = limiteBruto === null || limiteBruto === undefined || limiteBruto === ''
            ? null : Number(limiteBruto);
        let limite = Number.isFinite(limiteOriginal) ? limiteOriginal : null;
        if (metricas.x === 'rede' && limite !== null) {
            const capacidade = Number(limitesCriticos?.[servidor.idServidor]?.capacidadeRedeMbps);
            limite = Number.isFinite(capacidade) && capacidade > 0 ? capacidade * limite / 100 : null;
        }
        if (limite !== null) limitesCriticosEncontrados.push(limite);
        const duracao = limite === null ? null : duracaoAcima(
            servidor.amostras.map((amostra) => ({ timestamp: amostra.timestamp, valor: valorMetrica(amostra, metricas.x) })),
            limite, frequencia
        );
        if (duracao !== null) { segundosCriticos += duracao; haTempoCritico = true; }
        disponibilidade[disponibilidade.length - 1].tempoCritico = {
            segundos: duracao, limite, status: duracao === null ? 'limite_indisponivel' : 'calculado'
        };
    });

    const frequenciasSelecionadas = selecionados.map((servidor) => Number(servidor.metadados?.frequencia_esperada_segundos))
        .filter((valor) => Number.isFinite(valor) && valor > 0);
    const frequenciaMedia = frequenciasSelecionadas.length
        ? frequenciasSelecionadas.reduce((soma, valor) => soma + valor, 0) / frequenciasSelecionadas.length : 60;
    const serieCompleta = [...pontosPorTimestamp.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
        .map((ponto, indice, todos) => ({
            timestamp: ponto.timestamp,
            x: ponto.valoresX.length ? ponto.valoresX.reduce((a, b) => a + b, 0) / ponto.valoresX.length : null,
            y: ponto.valoresY.length ? ponto.valoresY.reduce((a, b) => a + b, 0) / ponto.valoresY.length : null,
            servidoresX: ponto.valoresX.length, servidoresY: ponto.valoresY.length,
            quebraAntes: Boolean(indice && Date.parse(ponto.timestamp) - Date.parse(todos[indice - 1].timestamp) > frequenciaMedia * 1500)
        }));
    const gruposSimultaneos = agruparSimultaneos(eventosIndividuais, toleranciaSegundos);
    const eventosOrdenados = eventosIndividuais.slice().sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    const gruposOrdenados = gruposSimultaneos.slice().sort((a, b) => Math.abs(b.maiorZ) - Math.abs(a.maiorZ));
    // (Cláudia - M) Conta todos os eventos individuais por servidor, antes do limite de detalhes enviado à tela.
    const eventosPorServidor = new Map(selecionados.map((servidor) => [servidor.idServidor, 0]));
    eventosIndividuais.forEach((evento) => eventosPorServidor.set(
        evento.idServidor, (eventosPorServidor.get(evento.idServidor) || 0) + 1
    ));
    const contagemPorServidor = selecionados.map((servidor) => ({
        idServidor: servidor.idServidor,
        nomeServidor: servidor.nome,
        quantidade: eventosPorServidor.get(servidor.idServidor) || 0
    })).sort((a, b) => b.quantidade - a.quantidade || a.idServidor - b.idServidor);
    const todosLimitesIguais = limitesCriticosEncontrados.length === selecionados.length && selecionados.length > 0
        && limitesCriticosEncontrados.every((valor) => Math.abs(valor - limitesCriticosEncontrados[0]) < 1e-9);
    const limitesDiferentes = limitesCriticosEncontrados.length > 1
        && !limitesCriticosEncontrados.every((valor) => Math.abs(valor - limitesCriticosEncontrados[0]) < 1e-9);

    return {
        periodo: { inicioUtc: inicioUtc.toISOString(), fimUtcExclusivo: fimUtc.toISOString(), fusoApresentacao: ZONA },
        metricas,
        toleranciaAlinhamentoSegundos: toleranciaSegundos,
        kpis: {
            anomalias: { individuais: eventosIndividuais.length, simultaneas: gruposSimultaneos.length,
                escopo: 'servidores selecionados; anomalias avaliadas por servidor e métrica' },
            maiorDesvioRegressao: regressaoRepresentativa?.maiorDesvio ? {
                ...regressaoRepresentativa.maiorDesvio, unidade: UNIDADES_METRICAS[metricas.y],
                relacao: regressaoRepresentativa.rotulo
            } : null,
            cobertura: { percentual: capturasEsperadas ? Math.min(100, capturasValidas / capturasEsperadas * 100) : null,
                capturasValidas, capturasEsperadas, escopo: 'soma das capturas e expectativas dos servidores selecionados' },
            tempoCritico: { segundos: haTempoCritico ? segundosCriticos : null,
                metrica: metricas.x, unidade: 'segundos-servidor',
                escopo: 'soma por servidor; intervalos acima de 1,5 vezes a frequência são ignorados',
                limiteUnico: todosLimitesIguais ? limitesCriticosEncontrados[0] : null,
                limitesDiferentes,
                limitesIncompletos: limitesCriticosEncontrados.length < selecionados.length,
                limitesDisponiveis: limitesCriticosEncontrados.length,
                servidoresAnalisados: selecionados.length,
                porServidor: disponibilidade.map((item) => ({ idServidor: item.idServidor,
                    nomeServidor: item.nomeServidor, ...item.tempoCritico })) }
        },
        disponibilidade,
        pearson: { resumo: resumoPearson, porRelacao: relacoes },
        regressao: { metricaX: metricas.x, metricaY: metricas.y,
            resumo: resumoRegressao, relacoes, representativa: regressaoRepresentativa },
        anomalias: {
            limiarZ: 3, referencia: 'Z-score por servidor e métrica no intervalo selecionado.',
            toleranciaSimultaneidadeSegundos: toleranciaSegundos,
            totalEventosIndividuais: eventosIndividuais.length,
            totalGruposSimultaneos: gruposSimultaneos.length,
            contagemPorServidor,
            eventosIndividuais: eventosOrdenados.slice(0, 80),
            gruposSimultaneos: gruposOrdenados.slice(0, 40),
            serie: [{ idServidor: null, nomeServidor: servidores.length === 1 ? servidores[0].nome : 'Média temporal do conjunto',
                pontos: downsample(serieCompleta, 600, new Set()).map(({ amostra }) => amostra) }]
        },
        boxplot: { metrica: metricas.boxplot, porServidor: boxplots }
    };
}

module.exports = {
    dataLocalParaUtc, valorMetrica, correlacao, regressao, boxplot, duracaoAcima,
    alinharCapturas, calcularResumoPearson, resumirRegressoes, montarDetalheRegressao, calcularAnalise
};
