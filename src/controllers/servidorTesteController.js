/*
- Este arquivo: Controla a listagem, definição e remoção de servidores de teste,
- além de cruzar os servidores de teste e seus limites do banco com o JSON da camada Gold no S3.
 */
var servidorTesteModel = require("../models/servidorTesteModel");
var s3DashboardModel = require("../models/s3DashboardTestesModel");

function listarServidores(req, res) {
    var idEmpresa = req.usuario.empresa;

    servidorTesteModel.listarServidores(idEmpresa)
        .then((resultado) => {
            res.status(200).json(resultado);
        })
        .catch((erro) => {
            console.log(erro);
            res.status(500).json({ erro: erro.sqlMessage || "Erro ao listar servidores." });
        });
}

function listarServidoresTeste(req, res) {
    var idEmpresa = req.usuario.empresa;

    servidorTesteModel.listarServidoresTeste(idEmpresa)
        .then((resultado) => {
            res.status(200).json(resultado);
        })
        .catch((erro) => {
            console.log(erro);
            res.status(500).json({ erro: erro.sqlMessage || "Erro ao listar servidores de teste." });
        });
}

function definirServidorTeste(req, res) {
    var idServidor = Number(req.params.id);
    var idEmpresa = req.usuario.empresa;
    var novoNome = typeof req.body.novoNome === "string" ? req.body.novoNome.trim() : "";

    if (!Number.isInteger(idServidor) || idServidor <= 0) {
        return res.status(400).json({ erro: "Servidor inválido." });
    }

    if (!novoNome) {
        return res.status(400).json({ erro: "Informe o novo nome para o servidor de teste." });
    }

    servidorTesteModel.definirServidorTeste(idServidor, idEmpresa, novoNome)
        .then((resultado) => {
            if (!resultado.affectedRows) {
                return res.status(404).json({ erro: "Servidor não encontrado nesta empresa." });
            }
            res.status(200).json({ mensagem: "Concluído! Servidor definido como teste com sucesso." });
        })
        .catch((erro) => {
            console.log(erro);
            res.status(500).json({ erro: erro.sqlMessage || "Não foi possível definir o servidor de teste." });
        });
}

function removerServidorTeste(req, res) {
    var idServidor = Number(req.params.id);
    var idEmpresa = req.usuario.empresa;
    var novoNome = typeof req.body.novoNome === "string" ? req.body.novoNome.trim() : "";

    if (!Number.isInteger(idServidor) || idServidor <= 0) {
        return res.status(400).json({ erro: "Servidor de teste inválido." });
    }

    if (!novoNome) {
        return res.status(400).json({ erro: "Informe o novo nome do servidor após remover de teste." });
    }

    servidorTesteModel.removerServidorTeste(idServidor, idEmpresa, novoNome)
        .then((resultado) => {
            if (!resultado.affectedRows) {
                return res.status(404).json({ erro: "Servidor de teste não encontrado nesta empresa." });
            }
            res.status(200).json({ mensagem: "Concluído! Servidor removido de teste e renomeado com sucesso." });
        })
        .catch((erro) => {
            console.log(erro);
            res.status(500).json({ erro: erro.sqlMessage || "Não foi possível remover o servidor de teste." });
        });
}

/* Converte o limite cadastrado no banco para a unidade exibida no gráfico de consumo */
function converterLimiteParaUnidadeGrafico(tipo, linha) {
    var raw = linha.limite_critico !== null ? Number(linha.limite_critico) : Number(linha.limite_atencao);
    if (Number.isNaN(raw)) return null;

    var unidadeMetrica = (linha.unidade_metrica || "").toLowerCase();
    var unidadeCap = (linha.unidade_capacidade || "").toLowerCase();
    var cap = linha.capacidade_total !== null ? Number(linha.capacidade_total) : null;

    if (tipo === "cpu") {
        if (unidadeMetrica === "%") return +raw.toFixed(2);
        return null;
    }

    if (tipo === "ram") {
        // Gráfico de RAM está em GB
        if (unidadeMetrica === "gb") return +raw.toFixed(2);
        if (unidadeMetrica === "mb") return +(raw / 1024).toFixed(2);
        if (unidadeMetrica === "tb") return +(raw * 1024).toFixed(2);
        if (unidadeMetrica === "%" && cap && cap > 0) {
            var capGb = unidadeCap === "mb" ? cap / 1024 : (unidadeCap === "tb" ? cap * 1024 : cap);
            return +(capGb * (raw / 100)).toFixed(2);
        }
        return null;
    }

    if (tipo === "disco") {
        // Gráfico de Disco está em MB
        if (unidadeMetrica === "mb") return +raw.toFixed(1);
        if (unidadeMetrica === "gb") return +(raw * 1024).toFixed(1);
        if (unidadeMetrica === "tb") return +(raw * 1024 * 1024).toFixed(1);
        if (unidadeMetrica === "%" && cap && cap > 0) {
            var capMb = unidadeCap === "gb" ? cap * 1024 : (unidadeCap === "tb" ? cap * 1024 * 1024 : cap);
            return +(capMb * (raw / 100)).toFixed(1);
        }
        return null;
    }

    if (tipo === "rede") {
        // Gráfico de Rede está em Mbps
        if (unidadeMetrica === "mbps") return +raw.toFixed(2);
        if (unidadeMetrica === "kbps") return +(raw / 1000).toFixed(2);
        if (unidadeMetrica === "gbps") return +(raw * 1000).toFixed(2);
        if (unidadeMetrica === "%" && cap && cap > 0) {
            var capMbps = unidadeCap === "gbps" ? cap * 1000 : (unidadeCap === "kbps" ? cap / 1000 : cap);
            return +(capMbps * (raw / 100)).toFixed(2);
        }
        return null;
    }

    return null;
}

/* Converte os limites de atenção/crítico para percentual (0-100%) para o gráfico de Radar */
function converterLimitesParaRadar(tipo, linha) {
    var atencao = linha.limite_atencao !== null ? Number(linha.limite_atencao) : null;
    var critico = linha.limite_critico !== null ? Number(linha.limite_critico) : null;
    var unidadeMetrica = (linha.unidade_metrica || "").toLowerCase();
    var cap = linha.capacidade_total !== null ? Number(linha.capacidade_total) : null;

    if (tipo === "temperatura") {
        if (atencao === null || critico === null) return null;

        // Caso 1: Já cadastrado como eficiência térmica (% decrescente, ex: atenção 80%, crítico 60%)
        if (atencao > critico) {
            return {
                saudavel_pct: Math.round(atencao),
                alerta_pct: Math.round(critico)
            };
        }

        // Caso 2: Cadastrado em °C ou % crescente de temperatura -> converte para eficiência térmica (100 - %)
        var base = unidadeMetrica === "%" ? 100 : (cap && cap > 0 ? cap : 100);
        return {
            saudavel_pct: Math.max(0, Math.min(100, Math.round(100 - (atencao / base) * 100))),
            alerta_pct: Math.max(0, Math.min(100, Math.round(100 - (critico / base) * 100)))
        };
    }

    var atencaoPct = null;
    var criticoPct = null;

    if (unidadeMetrica === "%") {
        atencaoPct = atencao;
        criticoPct = critico;
    } else if (cap && cap > 0) {
        if (atencao !== null) atencaoPct = (atencao / cap) * 100;
        if (critico !== null) criticoPct = (critico / cap) * 100;
    }

    if (atencaoPct === null && criticoPct === null) return null;

    return {
        atencao_pct: atencaoPct !== null ? Math.round(atencaoPct) : Math.round(criticoPct),
        critico_pct: criticoPct !== null ? Math.round(criticoPct) : Math.round(atencaoPct)
    };
}

/* Agrupa e normaliza os limites vindos do MySQL por id_servidor */
function montarMapaLimitesPorServidor(linhasBanco) {
    var mapa = {};

    (linhasBanco || []).forEach((linha) => {
        var idSrv = Number(linha.id_servidor);
        if (!mapa[idSrv]) {
            mapa[idSrv] = {
                consumo: { CPU: null, RAM: null, DISCO: null, REDE: null },
                radar: {
                    RAM: null,
                    CPU: null,
                    Disco: null,
                    Rede: null,
                    "Eficiência térmica": null
                }
            };
        }

        var tipo = linha.tipo_componente;
        var nomeMetrica = linha.nome_metrica || "";
        var unidadeMetrica = (linha.unidade_metrica || "").toLowerCase();

        // Ignora métricas auxiliares de rede como perda_pacotes (%) ou latencia (ms) na linha de tráfego
        var ehMetricaPrincipal =
            nomeMetrica === "uso_percentual" ||
            nomeMetrica === "temperatura_graus" ||
            nomeMetrica === "eficiencia_termica" ||
            (tipo === "rede" && (unidadeMetrica === "mbps" || unidadeMetrica === "gbps" || unidadeMetrica === "kbps")) ||
            ((tipo === "ram" || tipo === "disco") && (unidadeMetrica === "gb" || unidadeMetrica === "mb" || unidadeMetrica === "tb"));

        if (!ehMetricaPrincipal) return;

        var chaveConsumo = tipo.toUpperCase();
        if (mapa[idSrv].consumo.hasOwnProperty(chaveConsumo)) {
            var valGrafico = converterLimiteParaUnidadeGrafico(tipo, linha);
            if (valGrafico !== null && (mapa[idSrv].consumo[chaveConsumo] === null || nomeMetrica === "uso_percentual")) {
                mapa[idSrv].consumo[chaveConsumo] = valGrafico;
            }
        }

        var mapaChaveRadar = {
            ram: "RAM",
            cpu: "CPU",
            disco: "Disco",
            rede: "Rede",
            temperatura: "Eficiência térmica"
        };

        var chaveRadar = mapaChaveRadar[tipo];
        if (chaveRadar) {
            var valRadar = converterLimitesParaRadar(tipo, linha);
            if (valRadar !== null && (mapa[idSrv].radar[chaveRadar] === null || nomeMetrica === "uso_percentual")) {
                mapa[idSrv].radar[chaveRadar] = valRadar;
            }
        }
    });

    return mapa;
}

/* Cruza os servidores de teste e limites do Banco com as métricas do S3 */
function obterDadosDashboard(req, res) {
    var idEmpresa = (req.usuario && req.usuario.empresa) || 2;

    Promise.all([
        servidorTesteModel.listarServidoresTeste(idEmpresa),
        servidorTesteModel.listarLimitesServidoresTeste(idEmpresa),
        s3DashboardModel.buscarDashboardGeral()
    ])
        .then(([servidoresBanco, linhasLimites, dadosS3]) => {
            var mapaLimites = montarMapaLimitesPorServidor(linhasLimites);

            var empresaS3 = (dadosS3 && Array.isArray(dadosS3.empresas))
                ? dadosS3.empresas.find((emp) => Number(emp.id_empresa) === Number(idEmpresa))
                : null;

            var mapaServidoresS3 = {};
            if (empresaS3 && Array.isArray(empresaS3.servidores)) {
                empresaS3.servidores.forEach((srv) => {
                    mapaServidoresS3[srv.id_servidor] = srv;
                });
            }

            var servidoresFiltrados = servidoresBanco.map((srvBanco) => {
                var dadosMetricas = mapaServidoresS3[srvBanco.id_servidor];
                var limitesServidor = mapaLimites[srvBanco.id_servidor] || {
                    consumo: { CPU: null, RAM: null, DISCO: null, REDE: null },
                    radar: { RAM: null, CPU: null, Disco: null, Rede: null, "Eficiência térmica": null }
                };

                if (dadosMetricas) {
                    return {
                        ...dadosMetricas,
                        nome: srvBanco.nome,
                        localizacao: srvBanco.localizacao,
                        limites: limitesServidor
                    };
                }

                return {
                    id_servidor: srvBanco.id_servidor,
                    nome: srvBanco.nome,
                    localizacao: srvBanco.localizacao,
                    status: "aguardando_dados",
                    ultima_coleta: null,
                    jogadores_atuais: 0,
                    kpis: null,
                    graficos: null,
                    limites: limitesServidor
                };
            });

            res.status(200).json({
                id_empresa: Number(idEmpresa),
                gerado_em: dadosS3 ? dadosS3.gerado_em : null,
                servidores: servidoresFiltrados
            });
        })
        .catch((erro) => {
            console.error("Erro ao obter dados da dashboard QA:", erro);
            res.status(500).json({ erro: erro.sqlMessage || "Erro ao carregar dados da dashboard de QA." });
        });
}

module.exports = {
    listarServidores,
    listarServidoresTeste,
    definirServidorTeste,
    removerServidorTeste,
    obterDadosDashboard
};