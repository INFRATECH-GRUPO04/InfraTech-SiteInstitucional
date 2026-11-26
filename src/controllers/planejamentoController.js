/*
 * Valida operações de planejamento financeiro, converte tipos, gera análise
 * executiva (Google Gemini com fallback analítico) e prepara respostas para as
 * rotas GET/PUT /planejamento e POST /planejamento/relatorio.
 */
var planejamentoModel = require("../models/planejamentoModel");

var USOS_REFERENCIA = [
    { uso: 78, pico: 96 },
    { uso: 58, pico: 58 },
    { uso: 52, pico: 52 },
    { uso: 44, pico: 44 },
    { uso: 41, pico: 41 },
    { uso: 18, pico: 18 }
];

var CENARIOS_BASE = [
    { nome: 'Manter frota', detalhe: 'Sem expansão', adicionais: 0, capacidadeExtra: 0, prazoFixo: '—' },
    { nome: 'Otimizar frota', detalhe: 'Realocar carga, sem comprar', adicionais: 0, capacidadeExtra: 500, prazoFixo: 'Imediato' },
    { nome: 'Crescimento esperado', detalhe: 'Adicionar 2 servidores físicos', adicionais: 2, capacidadeExtra: 0 },
    { nome: 'Expansão agressiva', detalhe: 'Adicionar 5 servidores físicos', adicionais: 5, capacidadeExtra: 0 }
];

var ESQUEMA_RELATORIO_IA = {
    type: "object",
    properties: {
        tituloExecutivo: { type: "string" },
        vereditoSituacao: { type: "string" },
        resumoExecutivo: { type: "string" },
        analiseFinanceira: { type: "string" },
        analiseFrotaGargalos: { type: "string" },
        previsoesFuturas: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    horizonte: { type: "string" },
                    previsao: { type: "string" },
                    impactoNegocio: { type: "string" }
                },
                required: ["horizonte", "previsao", "impactoNegocio"]
            }
        },
        insightsEstrategicos: {
            type: "array",
            items: { type: "string" }
        },
        cenarioRecomendado: { type: "string" },
        justificativaRecomendacao: { type: "string" },
        planoAcaoImediato: {
            type: "array",
            items: { type: "string" }
        }
    },
    required: [
        "tituloExecutivo",
        "vereditoSituacao",
        "resumoExecutivo",
        "analiseFinanceira",
        "analiseFrotaGargalos",
        "previsoesFuturas",
        "insightsEstrategicos",
        "cenarioRecomendado",
        "justificativaRecomendacao",
        "planoAcaoImediato"
    ]
};

/* Formata uma data DATE/DATETIME do MySQL para dd/mm/aaaa. */
function formatarData(data) {
    if (!data) return '';
    var d = new Date(data);
    var dia = String(d.getUTCDate()).padStart(2, '0');
    var mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    var ano = String(d.getUTCFullYear());
    return dia + '/' + mes + '/' + ano;
}

/* Formata uma data de referência DATE para Jun/26. */
function formatarMes(data) {
    if (!data) return '';
    var d = new Date(data);
    var nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    var ano = String(d.getUTCFullYear()).slice(-2);
    return nomes[d.getUTCMonth()] + '/' + ano;
}

/* Monta o objeto de resposta usado pelo frontend, a partir dos dados do banco e do Gold S3. */
function montarResposta(plano, servidores, historico, gestor, telemetriaGold) {
    var primeiro = (plano && plano[0]) || {};
    var listaServidores = servidores || [];
    var nomeGestor = 'Gestor';
    if (primeiro.nome_gestor) {
        nomeGestor = primeiro.nome_gestor;
    } else if (gestor && gestor[0] && gestor[0].nome) {
        nomeGestor = gestor[0].nome;
    }
    var custoInfraTech = listaServidores
        .reduce(function (soma, servidor) {
            return soma + (Number(servidor.custo_mensal) || 0);
        }, 0);

    var historicoFormatado = (historico || []).map(function (h) {
        return {
            mes: formatarMes(h.mes_referencia),
            valor: Number(h.valor) || 0
        };
    });
    if (historicoFormatado.length > 0) {
        historicoFormatado[historicoFormatado.length - 1].valor = custoInfraTech;
    } else if (custoInfraTech > 0) {
        historicoFormatado.push({
            mes: formatarMes(new Date()),
            valor: custoInfraTech
        });
    }

    var temGold = Boolean(telemetriaGold && Array.isArray(telemetriaGold.servidores));
    var mapaGold = {};
    if (temGold) {
        telemetriaGold.servidores.forEach(function (item) {
            if (item && item.id_servidor != null) {
                mapaGold[Number(item.id_servidor)] = item;
            }
        });
    }

    var origemTelemetria = 'simulado';
    var telemetriaGeradaEm = null;
    if (temGold) {
        origemTelemetria = 's3_gold';
        telemetriaGeradaEm = telemetriaGold.gerado_em || null;
    }

    return {
        gestor: nomeGestor,
        data: formatarData(primeiro.dt_atualizacao) || formatarData(new Date()),
        plano: primeiro.plano || 'Padrão',
        jogadores: primeiro.jogadores || 0,
        ticketMedio: Number(primeiro.ticket_medio) || 0,
        custoInfraTech: custoInfraTech,
        economiaInfraPropria: Number(primeiro.economia_infra_propria) || 0,
        orcamento: Number(primeiro.orcamento_mensal) || custoInfraTech,
        metaUso: Number(primeiro.meta_uso) || 75,
        limiteSubutilizado: Number(primeiro.limite_subutilizado) || 40,
        crescimento: primeiro.crescimento_mensal || 0,
        provisionamento: primeiro.meses_provisionamento || 0,
        capacidadeAtual: primeiro.capacidade_por_servidor || 2000,
        capacidadeNova: primeiro.capacidade_novo_servidor || 1250,
        custoNovoServidor: Number(primeiro.custo_novo_servidor) || 0,
        custoImplantacao: Number(primeiro.custo_implantacao) || 0,
        origemTelemetria: origemTelemetria,
        telemetriaGeradaEm: telemetriaGeradaEm,
        servidores: listaServidores.map(function (s, indice) {
            var idServidor = Number(s.id_servidor);
            var uso = null;
            var pico = null;
            var ramMedia = null;
            var discoMedio = null;
            var conexao = 'simulado';
            var semTelemetria = false;

            if (temGold) {
                var itemGold = mapaGold[idServidor];
                if (itemGold && itemGold.uso_medio_30d != null) {
                    uso = Number(itemGold.uso_medio_30d);
                    pico = uso;
                    if (itemGold.pico_30d != null) {
                        pico = Number(itemGold.pico_30d);
                    }
                    if (itemGold.ram_media_30d != null) {
                        ramMedia = Number(itemGold.ram_media_30d);
                    }
                    if (itemGold.disco_medio_30d != null) {
                        discoMedio = Number(itemGold.disco_medio_30d);
                    }
                    conexao = itemGold.conexao || 'online';
                } else {
                    semTelemetria = true;
                    conexao = 'sem_dados';
                    if (itemGold && itemGold.conexao) {
                        conexao = itemGold.conexao;
                    }
                }
            } else {
                var ref = USOS_REFERENCIA[indice] || { uso: 0, pico: 0 };
                uso = ref.uso;
                pico = ref.pico;
            }

            return {
                idServidor: idServidor,
                nome: s.nome,
                local: s.localizacao || '-',
                custo: Number(s.custo_mensal) || 0,
                uso: uso,
                pico: pico,
                ramMedia: ramMedia,
                discoMedio: discoMedio,
                conexao: conexao,
                semTelemetria: semTelemetria
            };
        }),
        historico: historicoFormatado
    };
}

/* Valida os 9 campos aceitos no PUT. Retorna o primeiro erro encontrado. */
function validarPremissas(dados) {
    var campos = [
        { nome: 'capacidadeAtual', min: 1, inteiro: true },
        { nome: 'capacidadeNova', min: 1, inteiro: true },
        { nome: 'crescimento', min: 0, inteiro: true },
        { nome: 'provisionamento', min: 0, inteiro: true },
        { nome: 'orcamento', min: 1, inteiro: false },
        { nome: 'metaUso', min: 1, max: 100, inteiro: false },
        { nome: 'limiteSubutilizado', min: 1, max: 100, inteiro: false },
        { nome: 'custoNovoServidor', min: 0, inteiro: false },
        { nome: 'custoImplantacao', min: 0, inteiro: false }
    ];

    for (var i = 0; i < campos.length; i++) {
        var campo = campos[i];
        var valor = dados[campo.nome];
        if (valor === undefined || valor === null || valor === '') {
            return 'O campo ' + campo.nome + ' é obrigatório.';
        }
        var numero = Number(valor);
        if (!Number.isFinite(numero)) {
            return 'O campo ' + campo.nome + ' deve ser numérico.';
        }
        if (campo.inteiro && !Number.isInteger(numero)) {
            return 'O campo ' + campo.nome + ' deve ser um número inteiro.';
        }
        if (campo.min !== undefined && numero < campo.min) {
            return 'O campo ' + campo.nome + ' deve ser maior ou igual a ' + campo.min + '.';
        }
        if (campo.max !== undefined && numero > campo.max) {
            return 'O campo ' + campo.nome + ' deve ser menor ou igual a ' + campo.max + '.';
        }
    }
    if (Number(dados.limiteSubutilizado) >= Number(dados.metaUso)) {
        return 'O limite subutilizado deve ser menor que a meta de uso.';
    }
    return null;
}

/* Carrega em paralelo todas as informações do planejamento e da telemetria Gold de uma empresa. */
function carregarPlanejamento(idEmpresa) {
    return Promise.all([
        planejamentoModel.buscarPlanejamento(idEmpresa),
        planejamentoModel.listarServidoresAtivos(idEmpresa),
        planejamentoModel.listarHistorico(idEmpresa),
        planejamentoModel.buscarGestor(idEmpresa),
        planejamentoModel.lerTelemetriaGold(idEmpresa)
    ]).then(function (resultados) {
        return montarResposta(resultados[0], resultados[1], resultados[2], resultados[3], resultados[4]);
    });
}

/* Lê as premissas da empresa da sessão e devolve o JSON do dashboard. */
function obter(req, res) {
    var idEmpresa = req.usuario && req.usuario.empresa;
    if (!idEmpresa) {
        return res.status(400).json({ erro: 'Empresa da sessão não identificada.' });
    }

    carregarPlanejamento(idEmpresa)
        .then(function (dados) {
            return res.status(200).json(dados);
        })
        .catch(function (erro) {
            console.log(erro);
            res.status(500).json({ erro: 'Não foi possível carregar o planejamento.' });
        });
}

/* Atualiza as premissas da empresa da sessão e devolve o JSON atualizado. */
function atualizar(req, res) {
    var idEmpresa = req.usuario && req.usuario.empresa;
    if (!idEmpresa) {
        return res.status(400).json({ erro: 'Empresa da sessão não identificada.' });
    }

    var erro = validarPremissas(req.body);
    if (erro) {
        return res.status(400).json({ erro: erro });
    }

    planejamentoModel.atualizarPremissas(idEmpresa, req.body, req.usuario.id)
        .then(function () {
            return carregarPlanejamento(idEmpresa);
        })
        .then(function (dados) {
            return res.status(200).json(dados);
        })
        .catch(function (erro) {
            console.log(erro);
            res.status(500).json({ erro: 'Não foi possível atualizar as premissas.' });
        });
}

/* Formata número em reais (R$) sem depender de locale do SO. */
function formatarReais(valor) {
    var numero = Number(valor) || 0;
    return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Consolida métricas financeiras, de capacidade e de ociosidade da frota. */
function calcularMetricasRelatorio(dados, corpoRequisicao) {
    var listaRecebida = [];
    if (corpoRequisicao && Array.isArray(corpoRequisicao.servidores)) {
        listaRecebida = corpoRequisicao.servidores;
    }

    var servidoresDetalhados = dados.servidores.map(function (srv, indice) {
        var correspondente = listaRecebida.find(function (item) {
            if (!item) return false;
            if (srv.idServidor && item.idServidor) {
                return Number(item.idServidor) === Number(srv.idServidor);
            }
            return item.nome === srv.nome;
        });

        var uso = null;
        var pico = null;
        var semTelemetria = Boolean(srv.semTelemetria);

        if (dados.origemTelemetria === 's3_gold') {
            if (!semTelemetria && srv.uso != null) {
                uso = Number(srv.uso);
                pico = uso;
                if (srv.pico != null) {
                    pico = Number(srv.pico);
                }
            } else {
                semTelemetria = true;
            }
        } else if (srv.uso != null) {
            uso = Number(srv.uso);
            pico = uso;
            if (srv.pico != null) {
                pico = Number(srv.pico);
            }
        } else if (!semTelemetria) {
            var ref = USOS_REFERENCIA[indice] || { uso: 0, pico: 0 };
            uso = ref.uso;
            pico = ref.pico;
            if (correspondente && correspondente.uso != null) {
                uso = Number(correspondente.uso) || 0;
            }
            if (correspondente && correspondente.pico != null) {
                pico = Number(correspondente.pico) || uso;
            }
        }

        var custoOcioso = 0;
        var situacao = 'Sem dados';

        if (!semTelemetria && uso != null) {
            if (uso < dados.metaUso) {
                custoOcioso = srv.custo * (dados.metaUso - uso) / 100;
            }

            situacao = 'Normal';
            if (uso >= dados.metaUso) {
                situacao = 'Saturado';
            } else if (uso < dados.limiteSubutilizado) {
                situacao = 'Subutilizado';
            }
        }

        var ramMedia = null;
        if (srv.ramMedia != null) {
            ramMedia = Number(srv.ramMedia);
        }
        var discoMedio = null;
        if (srv.discoMedio != null) {
            discoMedio = Number(srv.discoMedio);
        }

        return {
            idServidor: srv.idServidor || null,
            nome: srv.nome,
            local: srv.local,
            custo: srv.custo,
            uso: uso,
            pico: pico,
            ramMedia: ramMedia,
            discoMedio: discoMedio,
            conexao: srv.conexao || 'simulado',
            semTelemetria: semTelemetria,
            custoOcioso: Number(custoOcioso.toFixed(2)),
            situacao: situacao
        };
    });

    var receita = dados.jogadores * dados.ticketMedio;
    var lucro = receita - dados.custoInfraTech;
    var margem = 0;
    if (receita > 0) {
        margem = (lucro / receita) * 100;
    }
    var roi = 0;
    if (dados.custoInfraTech > 0) {
        roi = (lucro / dados.custoInfraTech) * 100;
    }
    var breakeven = 0;
    if (dados.ticketMedio > 0) {
        breakeven = Math.ceil(dados.custoInfraTech / dados.ticketMedio);
    }

    var capacidadeTotal = servidoresDetalhados.length * dados.capacidadeAtual;
    var percentualCapacidade = 0;
    if (capacidadeTotal > 0) {
        percentualCapacidade = (dados.jogadores / capacidadeTotal) * 100;
    }

    var runwayMeses = null;
    var prazoDecisaoMeses = null;
    if (dados.crescimento > 0) {
        runwayMeses = Math.max(0, (capacidadeTotal - dados.jogadores) / dados.crescimento);
        prazoDecisaoMeses = Math.max(0, runwayMeses - dados.provisionamento);
    }

    var custoOciosoTotal = 0;
    var somaUso = 0;
    var qtdComTelemetria = 0;
    var servidorGargalo = null;
    var servidoresSaturados = [];
    var servidoresSubutilizados = [];

    servidoresDetalhados.forEach(function (srv) {
        custoOciosoTotal += srv.custoOcioso;
        if (!srv.semTelemetria && srv.uso != null) {
            somaUso += srv.uso;
            qtdComTelemetria += 1;
            if (!servidorGargalo || srv.uso > servidorGargalo.uso) {
                servidorGargalo = srv;
            }
        }
        if (srv.situacao === 'Saturado') {
            servidoresSaturados.push(srv.nome);
        }
        if (srv.situacao === 'Subutilizado') {
            servidoresSubutilizados.push(srv.nome);
        }
    });

    var usoMedioFrota = null;
    var custoOciosoConsolidado = null;
    var temTelemetria = qtdComTelemetria > 0;
    if (temTelemetria) {
        usoMedioFrota = Number((somaUso / qtdComTelemetria).toFixed(1));
        custoOciosoConsolidado = Number(custoOciosoTotal.toFixed(2));
    }

    var projecoes = [1, 3, 6].map(function (meses) {
        var previstos = dados.jogadores + dados.crescimento * meses;
        var ocupacaoPrevista = 0;
        if (capacidadeTotal > 0) {
            ocupacaoPrevista = (previstos / capacidadeTotal) * 100;
        }
        var excedenteCapacidade = Math.max(0, previstos - capacidadeTotal);
        return {
            meses: meses,
            jogadoresPrevistos: previstos,
            ocupacaoPrevista: Number(ocupacaoPrevista.toFixed(1)),
            excedenteCapacidade: excedenteCapacidade
        };
    });

    var baseServidores = servidoresDetalhados.length;
    var cenarios = CENARIOS_BASE.map(function (c) {
        var capacidadeAdicional = c.adicionais * dados.capacidadeNova + c.capacidadeExtra;
        var capacidadeCenario = baseServidores * dados.capacidadeAtual + capacidadeAdicional;
        var prazoEntrega = c.prazoFixo || 'Imediato';
        if (c.adicionais > 0) {
            if (dados.provisionamento > 0) {
                var unidadePrazo = ' meses';
                if (dados.provisionamento === 1) unidadePrazo = ' mês';
                prazoEntrega = dados.provisionamento + unidadePrazo;
            } else {
                prazoEntrega = 'Imediato';
            }
        }
        var runwayCenario = null;
        if (dados.crescimento > 0) {
            runwayCenario = Number(Math.max(0, (capacidadeCenario - dados.jogadores) / dados.crescimento).toFixed(1));
        }
        return {
            nome: c.nome,
            detalhe: c.detalhe,
            adicionais: c.adicionais,
            servidoresTotais: baseServidores + c.adicionais,
            capacidadeTotal: capacidadeCenario,
            capacidadeAdicional: capacidadeAdicional,
            custoMensalAdicional: Number((c.adicionais * dados.custoNovoServidor).toFixed(2)),
            custoImplantacao: Number((c.adicionais * dados.custoImplantacao).toFixed(2)),
            prazoEntrega: prazoEntrega,
            runwayMeses: runwayCenario
        };
    });

    return {
        receita: Number(receita.toFixed(2)),
        lucro: Number(lucro.toFixed(2)),
        margem: Number(margem.toFixed(2)),
        roi: Number(roi.toFixed(2)),
        breakeven: breakeven,
        capacidadeTotal: capacidadeTotal,
        percentualCapacidade: Number(percentualCapacidade.toFixed(1)),
        runwayMeses: runwayMeses,
        prazoDecisaoMeses: prazoDecisaoMeses,
        temTelemetria: temTelemetria,
        custoOciosoTotal: custoOciosoConsolidado,
        usoMedioFrota: usoMedioFrota,
        servidorGargalo: servidorGargalo,
        servidoresSaturados: servidoresSaturados,
        servidoresSubutilizados: servidoresSubutilizados,
        servidoresDetalhados: servidoresDetalhados,
        projecoes: projecoes,
        cenarios: cenarios
    };
}

/* Gera uma análise executiva realista caso a chave do Gemini não esteja configurada. */
function gerarAnaliseFallback(dados, metricas) {
    var nomeGargalo = 'Nenhum servidor ativo';
    var usoGargalo = 0;
    var picoGargalo = 0;
    if (metricas.servidorGargalo) {
        nomeGargalo = metricas.servidorGargalo.nome;
        usoGargalo = metricas.servidorGargalo.uso;
        picoGargalo = metricas.servidorGargalo.pico;
    }

    var veredito = 'Operação Financeiramente Saudável com Alerta de Capacidade';
    if (metricas.lucro < 0) {
        veredito = 'Operação Deficitária — Revisão Imediata de Custos e Receita';
    } else if (metricas.servidoresSaturados.length > 0) {
        veredito = 'Operação Lucrativa sob Risco de Gargalo Local (' + nomeGargalo + ')';
    }

    var textoRunway = 'sem previsão de saturação no ritmo atual';
    if (metricas.runwayMeses !== null) {
        textoRunway = metricas.runwayMeses.toFixed(1) + ' meses até o limite global';
    }

    var projecao6m = metricas.projecoes[2];
    var cenarioRecomendado = 'Crescimento esperado (+2 servidores físicos)';
    var justificativa = 'Com crescimento de ' + dados.crescimento + ' jogadores/mês e provisionamento físico de ' +
        dados.provisionamento + ' meses, aguardar até o teto global leva a ocupação prevista a ' +
        projecao6m.ocupacaoPrevista + '% no 6º mês.';

    if (metricas.servidoresSubutilizados.length > 0 && dados.crescimento === 0) {
        cenarioRecomendado = 'Otimizar frota (realocar carga sem compra imediata)';
        justificativa = 'Não há crescimento mensal cadastrado e existem servidores subutilizados (' +
            metricas.servidoresSubutilizados.join(', ') + ') absorvendo custo ocioso.';
    } else if (metricas.runwayMeses !== null && metricas.runwayMeses <= dados.provisionamento) {
        cenarioRecomendado = 'Expansão imediata / Expansão agressiva';
        justificativa = 'O runway atual (' + metricas.runwayMeses.toFixed(1) +
            ' meses) já é menor ou igual ao tempo de entrega de hardware (' + dados.provisionamento + ' meses).';
    }

    var analiseFrota = 'Ainda não há leituras de telemetria nos últimos 30 dias para calcular o uso médio e o custo ocioso da frota.';
    if (metricas.usoMedioFrota !== null) {
        analiseFrota = 'A frota opera com uso médio de ' + metricas.usoMedioFrota +
            '%, acumulando ' + formatarReais(metricas.custoOciosoTotal) +
            '/mês de custo ocioso em relação à meta de ' + dados.metaUso + '%. ';
        if (metricas.servidorGargalo) {
            analiseFrota += 'O principal ponto de atenção é ' + nomeGargalo + ' (' + usoGargalo +
                '% médio e pico de ' + picoGargalo + '%), que pode gerar fila antes do limite global.';
        }
    }

    var insights = [
        'Validar o envio do agente de coleta nos servidores sem telemetria para consolidar o histórico de 30 dias na camada Gold.',
        'Acompanhar a evolução da base de jogadores frente à janela de provisionamento de ' + dados.provisionamento + ' meses.'
    ];
    var planoAcao = [
        'Conferir a chave e o envio periódico do agente nos servidores sem leituras recentes.',
        'Aprovar reserva orçamentária para expansão física antes do prazo crítico de decisão.'
    ];
    if (metricas.usoMedioFrota !== null) {
        insights = [
            'Realocar parte da carga de ' + nomeGargalo + ' para servidores com folga antes de atingir fila de conexão.',
            'Reduzir os ' + formatarReais(metricas.custoOciosoTotal) + '/mês de ociosidade aproximando a frota da meta de ' + dados.metaUso + '%.',
            'Iniciar cotação de expansão respeitando a janela de provisionamento de ' + dados.provisionamento + ' meses.'
        ];
        planoAcao = [
            'Auditar balanceamento de carga no servidor ' + nomeGargalo + ' nesta semana.',
            'Avaliar realocação nos servidores abaixo de ' + dados.limiteSubutilizado + '% de uso.',
            'Aprovar reserva orçamentária para expansão física antes do prazo crítico de decisão.'
        ];
    }

    return {
        tituloExecutivo: 'Relatório Executivo de Infraestrutura e FinOps — Plano ' + dados.plano,
        vereditoSituacao: veredito,
        resumoExecutivo: 'A operação conta com ' + metricas.servidoresDetalhados.length +
            ' servidores físicos ativos suportando ' + dados.jogadores.toLocaleString('pt-BR') +
            ' jogadores simultâneos (' + metricas.percentualCapacidade + '% da capacidade total de ' +
            metricas.capacidadeTotal.toLocaleString('pt-BR') + '). A receita estimada é de ' +
            formatarReais(metricas.receita) + ' contra um custo de infraestrutura de ' +
            formatarReais(dados.custoInfraTech) + ', resultando em lucro líquido de ' +
            formatarReais(metricas.lucro) + ' (' + textoRunway + ').',
        analiseFinanceira: 'A margem operacional estimada está em ' + metricas.margem +
            '% com ROI de infraestrutura de ' + metricas.roi + '%. O ponto de equilíbrio (break-even) exige ' +
            metricas.breakeven.toLocaleString('pt-BR') + ' jogadores ativos. O custo atual representa ' +
            ((dados.custoInfraTech / Math.max(1, dados.orcamento)) * 100).toFixed(1) +
            '% do orçamento mensal de ' + formatarReais(dados.orcamento) +
            ', além da economia estimada de ' + formatarReais(dados.economiaInfraPropria) + '/mês frente a equipe e datacenters próprios.',
        analiseFrotaGargalos: analiseFrota,
        previsoesFuturas: metricas.projecoes.map(function (p) {
            var textoPrev = 'Demanda estimada em ' + p.jogadoresPrevistos.toLocaleString('pt-BR') + ' jogadores simultâneos.';
            var textoImp = 'Capacidade global suficiente, acompanhando a evolução da carga da frota.';
            if (metricas.servidorGargalo) {
                textoImp = 'Capacidade global suficiente, monitorando picos locais em ' + nomeGargalo + '.';
            }
            if (p.excedenteCapacidade > 0) {
                textoImp = 'Demanda prevista supera a capacidade atual em ' +
                    p.excedenteCapacidade.toLocaleString('pt-BR') +
                    ' jogadores (' + p.ocupacaoPrevista + '% de ocupação), exigindo expansão prévia.';
            }
            var unidade = ' meses';
            if (p.meses === 1) unidade = ' mês';
            return {
                horizonte: p.meses + unidade,
                previsao: textoPrev,
                impactoNegocio: textoImp
            };
        }),
        insightsEstrategicos: insights,
        cenarioRecomendado: cenarioRecomendado,
        justificativaRecomendacao: justificativa,
        planoAcaoImediato: planoAcao
    };
}

/* Extrai o texto JSON da resposta da Interactions API do Google Gemini. */
function extrairTextoGemini(resposta) {
    if (!resposta) return '';
    if (typeof resposta.output_text === 'string' && resposta.output_text.trim()) {
        return resposta.output_text;
    }
    if (Array.isArray(resposta.steps)) {
        for (var i = resposta.steps.length - 1; i >= 0; i--) {
            var passo = resposta.steps[i];
            if (passo && passo.type === 'model_output' && Array.isArray(passo.content)) {
                var textos = passo.content
                    .filter(function (parte) { return parte && typeof parte.text === 'string'; })
                    .map(function (parte) { return parte.text; });
                if (textos.length > 0) return textos.join('');
            }
        }
    }
    if (Array.isArray(resposta.outputs) && resposta.outputs.length > 0) {
        var ultimo = resposta.outputs[resposta.outputs.length - 1];
        if (ultimo && typeof ultimo.text === 'string') return ultimo.text;
    }
    return '';
}

/* Envia uma requisição para um modelo específico do Google Gemini via Interactions API. */
function chamarModeloGemini(chave, modelo, dados, metricas) {
    var instrucaoSistema = [
        'Você é um consultor executivo sênior de FinOps e infraestrutura física de servidores de jogos online (InfraTech).',
        'Escreva em português do Brasil, de forma realista, direta, transparente e acionável para o gestor.',
        'Baseie-se exclusivamente nos números reais fornecidos no JSON de entrada. Não invente servidores nem métricas.',
        'Aponte riscos reais de gargalos locais, desperdício com ociosidade, pressão sobre a capacidade global e compare os cenários de investimento de metricasCalculadas.cenarios ao justificar o cenarioRecomendado considerando o prazo de provisionamento.'
    ].join(' ');

    var payload = JSON.stringify({
        model: modelo,
        system_instruction: instrucaoSistema,
        input: JSON.stringify({
            empresaDados: dados,
            metricasCalculadas: metricas
        }),
        generation_config: {
            max_output_tokens: 1800
        },
        response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: ESQUEMA_RELATORIO_IA
        }
    });

    return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': chave,
            'Api-Revision': '2026-05-20'
        },
        body: payload,
        signal: AbortSignal.timeout(45000)
    }).then(function (resposta) {
        if (!resposta.ok) {
            return resposta.text().then(function (corpo) {
                var errHttp = new Error('Gemini HTTP ' + resposta.status + ': ' + corpo);
                errHttp.statusCode = resposta.status;
                throw errHttp;
            });
        }
        return resposta.json();
    }).then(function (respostaJson) {
        var analise = JSON.parse(extrairTextoGemini(respostaJson));
        return { modelo: modelo, analise: analise };
    });
}

/* Consulta o Google AI Studio (tenta gemini-3.8-flash e, em pico 503/429, tenta gemini-3.5-flash-lite). */
function consultarGeminiRelatorio(dados, metricas) {
    var chave = String(process.env.GEMINI_API_KEY || '').trim();
    if (!chave || chave === 'sua_chave_google_ai_studio') {
        return Promise.reject(new Error('GEMINI_API_KEY não configurada'));
    }

    return chamarModeloGemini(chave, 'gemini-3.8-flash', dados, metricas)
        .catch(function (erroPrincipal) {
            if (erroPrincipal && (erroPrincipal.statusCode === 503 || erroPrincipal.statusCode === 429)) {
                console.log('Modelo gemini-3.8-flash indisponível (' + erroPrincipal.statusCode + '), tentando gemini-3.5-flash-lite...');
                return chamarModeloGemini(chave, 'gemini-3.5-flash-lite', dados, metricas);
            }
            throw erroPrincipal;
        });
}

/* Reconstrói os dados do planejamento a partir do corpo enviado pelo front quando o banco não possuir registro. */
function normalizarDadosFallback(corpoRequisicao) {
    var base = {};
    if (corpoRequisicao && corpoRequisicao.dados && typeof corpoRequisicao.dados === 'object') {
        base = corpoRequisicao.dados;
    }

    var listaServidores = [];
    if (Array.isArray(base.servidores)) {
        listaServidores = base.servidores;
    } else if (corpoRequisicao && Array.isArray(corpoRequisicao.servidores)) {
        listaServidores = corpoRequisicao.servidores;
    }

    var servidores = listaServidores.map(function (s) {
        var uso = null;
        if (s && s.uso != null) {
            uso = Number(s.uso);
        }
        var pico = uso;
        if (s && s.pico != null) {
            pico = Number(s.pico);
        }
        return {
            idServidor: (s && s.idServidor) || null,
            nome: (s && s.nome) || 'SRV',
            local: (s && s.local) || '-',
            custo: Number(s && s.custo) || 0,
            uso: uso,
            pico: pico,
            conexao: (s && s.conexao) || 'simulado',
            semTelemetria: Boolean(s && s.semTelemetria)
        };
    });

    var historico = [];
    if (Array.isArray(base.historico)) {
        historico = base.historico;
    }

    return {
        gestor: base.gestor || 'Gestor',
        data: base.data || formatarData(new Date()),
        plano: base.plano || 'Profissional',
        jogadores: Number(base.jogadores) || 0,
        ticketMedio: Number(base.ticketMedio) || 0,
        custoInfraTech: Number(base.custoInfraTech) || 0,
        economiaInfraPropria: Number(base.economiaInfraPropria) || 0,
        orcamento: Number(base.orcamento) || 0,
        metaUso: Number(base.metaUso) || 75,
        limiteSubutilizado: Number(base.limiteSubutilizado) || 40,
        crescimento: Number(base.crescimento) || 0,
        provisionamento: Number(base.provisionamento) || 0,
        capacidadeAtual: Number(base.capacidadeAtual) || 1,
        capacidadeNova: Number(base.capacidadeNova) || 1,
        custoNovoServidor: Number(base.custoNovoServidor) || 0,
        custoImplantacao: Number(base.custoImplantacao) || 0,
        origemTelemetria: base.origemTelemetria || 'simulado',
        servidores: servidores,
        historico: historico
    };
}

/* Gera o relatório executivo consolidado com análise da IA (ou fallback). */
function gerarRelatorio(req, res) {
    var idEmpresa = req.usuario && req.usuario.empresa;
    if (!idEmpresa) {
        return res.status(400).json({ erro: 'Empresa da sessão não identificada.' });
    }

    var corpo = req.body || {};

    carregarPlanejamento(idEmpresa)
        .catch(function (erroBanco) {
            console.log('Banco indisponível ao gerar relatório, usando dados da tela:', erroBanco.message);
            return null;
        })
        .then(function (dadosBanco) {
            var dados = dadosBanco;
            if (!dados) {
                dados = normalizarDadosFallback(corpo);
            }

            var metricas = calcularMetricasRelatorio(dados, corpo);
            var emitidoEm = new Date().toLocaleString('pt-BR');

            return consultarGeminiRelatorio(dados, metricas)
                .then(function (resultadoIA) {
                    return res.status(200).json({
                        origem: 'ia',
                        modelo: resultadoIA.modelo,
                        emitidoEm: emitidoEm,
                        dados: dados,
                        metricas: metricas,
                        analise: resultadoIA.analise
                    });
                })
                .catch(function (erroIA) {
                    console.log('Fallback analítico acionado no relatório:', erroIA.message);
                    return res.status(200).json({
                        origem: 'analitico_local',
                        modelo: 'motor-analitico-infratech',
                        avisoIA: erroIA.message,
                        emitidoEm: emitidoEm,
                        dados: dados,
                        metricas: metricas,
                        analise: gerarAnaliseFallback(dados, metricas)
                    });
                });
        })
        .catch(function (erro) {
            console.log(erro);
            res.status(500).json({ erro: 'Não foi possível gerar o relatório executivo.' });
        });
}

module.exports = {
    obter,
    atualizar,
    gerarRelatorio
};
