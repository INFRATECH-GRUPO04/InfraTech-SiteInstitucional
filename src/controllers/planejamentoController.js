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

/* Monta o objeto de resposta usado pelo frontend, a partir dos dados do banco. */
function montarResposta(plano, servidores, historico, gestor) {
    var primeiro = (plano && plano[0]) || {};
    var nomeGestor = '';
    if (primeiro.nome_gestor) {
        nomeGestor = primeiro.nome_gestor;
    } else if (gestor && gestor[0]) {
        nomeGestor = gestor[0].nome;
    }
    var custoInfraTech = servidores
        .reduce(function (soma, servidor) {
            return soma + (Number(servidor.custo_mensal) || 0);
        }, 0);

    return {
        gestor: nomeGestor,
        data: formatarData(primeiro.dt_atualizacao),
        plano: primeiro.plano || '',
        jogadores: primeiro.jogadores || 0,
        ticketMedio: Number(primeiro.ticket_medio) || 0,
        custoInfraTech: custoInfraTech,
        economiaInfraPropria: Number(primeiro.economia_infra_propria) || 0,
        orcamento: Number(primeiro.orcamento_mensal) || 0,
        metaUso: Number(primeiro.meta_uso) || 0,
        limiteSubutilizado: Number(primeiro.limite_subutilizado) || 0,
        crescimento: primeiro.crescimento_mensal || 0,
        provisionamento: primeiro.meses_provisionamento || 0,
        capacidadeAtual: primeiro.capacidade_por_servidor || 0,
        capacidadeNova: primeiro.capacidade_novo_servidor || 0,
        custoNovoServidor: Number(primeiro.custo_novo_servidor) || 0,
        custoImplantacao: Number(primeiro.custo_implantacao) || 0,
        servidores: servidores.map(function (s) {
            return {
                nome: s.nome,
                local: s.localizacao || '-',
                custo: Number(s.custo_mensal) || 0
            };
        }),
        historico: historico.map(function (h) {
            return {
                mes: formatarMes(h.mes_referencia),
                valor: Number(h.valor) || 0
            };
        })
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

/* Carrega em paralelo todas as informações do planejamento de uma empresa. */
function carregarPlanejamento(idEmpresa) {
    return Promise.all([
        planejamentoModel.buscarPlanejamento(idEmpresa),
        planejamentoModel.listarServidoresAtivos(idEmpresa),
        planejamentoModel.listarHistorico(idEmpresa),
        planejamentoModel.buscarGestor(idEmpresa)
    ]).then(function (resultados) {
        var plano = resultados[0];
        if (!plano || plano.length === 0) return null;
        return montarResposta(plano, resultados[1], resultados[2], resultados[3]);
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
            if (!dados) {
                return res.status(404).json({ erro: 'Planejamento não configurado para esta empresa.' });
            }
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
        .then(function (resultado) {
            if (resultado && resultado.affectedRows === 0) {
                return null;
            }
            return carregarPlanejamento(idEmpresa);
        })
        .then(function (dados) {
            if (!dados) {
                return res.status(404).json({ erro: 'Planejamento não configurado para esta empresa.' });
            }
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
            return item && item.nome === srv.nome;
        });
        var ref = USOS_REFERENCIA[indice] || { uso: 0, pico: 0 };
        var uso = ref.uso;
        var pico = ref.pico;

        if (correspondente && correspondente.uso != null) {
            uso = Number(correspondente.uso) || 0;
        }
        if (correspondente && correspondente.pico != null) {
            pico = Number(correspondente.pico) || uso;
        }

        var custoOcioso = 0;
        if (uso < dados.metaUso) {
            custoOcioso = srv.custo * (dados.metaUso - uso) / 100;
        }

        var situacao = 'Normal';
        if (uso >= dados.metaUso) {
            situacao = 'Saturado';
        } else if (uso < dados.limiteSubutilizado) {
            situacao = 'Subutilizado';
        }

        return {
            nome: srv.nome,
            local: srv.local,
            custo: srv.custo,
            uso: uso,
            pico: pico,
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
    var servidorGargalo = null;
    var servidoresSaturados = [];
    var servidoresSubutilizados = [];

    servidoresDetalhados.forEach(function (srv) {
        custoOciosoTotal += srv.custoOcioso;
        somaUso += srv.uso;
        if (!servidorGargalo || srv.uso > servidorGargalo.uso) {
            servidorGargalo = srv;
        }
        if (srv.situacao === 'Saturado') {
            servidoresSaturados.push(srv.nome);
        }
        if (srv.situacao === 'Subutilizado') {
            servidoresSubutilizados.push(srv.nome);
        }
    });

    var usoMedioFrota = 0;
    if (servidoresDetalhados.length > 0) {
        usoMedioFrota = somaUso / servidoresDetalhados.length;
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
        custoOciosoTotal: Number(custoOciosoTotal.toFixed(2)),
        usoMedioFrota: Number(usoMedioFrota.toFixed(1)),
        servidorGargalo: servidorGargalo,
        servidoresSaturados: servidoresSaturados,
        servidoresSubutilizados: servidoresSubutilizados,
        servidoresDetalhados: servidoresDetalhados,
        projecoes: projecoes
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

    var analiseFrota = 'A frota opera com uso médio de ' + metricas.usoMedioFrota +
        '%, acumulando ' + formatarReais(metricas.custoOciosoTotal) +
        '/mês de custo ocioso em relação à meta de ' + dados.metaUso + '%. ';
    if (metricas.servidorGargalo) {
        analiseFrota += 'O principal ponto de atenção é ' + nomeGargalo + ' (' + usoGargalo +
            '% médio e pico de ' + picoGargalo + '%), que pode gerar fila antes do limite global.';
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
            var textoImp = 'Capacidade global suficiente, monitorando picos locais em ' + nomeGargalo + '.';
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
        insightsEstrategicos: [
            'Realocar parte da carga de ' + nomeGargalo + ' para servidores com folga antes de atingir fila de conexão.',
            'Reduzir os ' + formatarReais(metricas.custoOciosoTotal) + '/mês de ociosidade aproximando a frota da meta de ' + dados.metaUso + '%.',
            'Iniciar cotação de expansão respeitando a janela de provisionamento de ' + dados.provisionamento + ' meses.'
        ],
        cenarioRecomendado: cenarioRecomendado,
        justificativaRecomendacao: justificativa,
        planoAcaoImediato: [
            'Auditar balanceamento de carga no servidor ' + nomeGargalo + ' nesta semana.',
            'Avaliar realocação nos servidores abaixo de ' + dados.limiteSubutilizado + '% de uso.',
            'Aprovar reserva orçamentária para expansão física antes do prazo crítico de decisão.'
        ]
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
        'Aponte riscos reais de gargalos locais, desperdício com ociosidade, pressão sobre a capacidade global e justifique o cenário de expansão ideal considerando o prazo de provisionamento.'
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
        return {
            nome: (s && s.nome) || 'SRV',
            local: (s && s.local) || '-',
            custo: Number(s && s.custo) || 0
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
