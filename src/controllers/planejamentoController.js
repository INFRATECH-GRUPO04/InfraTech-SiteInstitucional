/*
 * Valida operações de planejamento financeiro, converte tipos e prepara
 * respostas para as rotas de GET/PUT /planejamento.
 */
var planejamentoModel = require("../models/planejamentoModel");

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
    var nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var mes = nomes[d.getUTCMonth()];
    var ano = String(d.getUTCFullYear()).slice(-2);
    return mes.charAt(0).toUpperCase() + mes.slice(1) + '/' + ano;
}

/* Monta o objeto de resposta usado pelo frontend, a partir dos dados do banco. */
function montarResposta(plano, servidores, historico, gestor) {
    var primeiro = (plano && plano[0]) || {};
    var custoInfraTech = servidores
        .reduce(function (soma, servidor) {
            return soma + (Number(servidor.custo_mensal) || 0);
        }, 0);

    return {
        gestor: gestor && gestor[0] ? gestor[0].nome : '',
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
    return null;
}

/* Lê as premissas da empresa da sessão e devolve o JSON do dashboard. */
function obter(req, res) {
    var idEmpresa = req.usuario && req.usuario.empresa;
    if (!idEmpresa) {
        return res.status(400).json({ erro: 'Empresa da sessão não identificada.' });
    }

    planejamentoModel.buscarPlanejamento(idEmpresa)
        .then(function (plano) {
            if (!plano || plano.length === 0) {
                return res.status(404).json({ erro: 'Planejamento não configurado para esta empresa.' });
            }
            return planejamentoModel.listarServidoresAtivos(idEmpresa)
                .then(function (servidores) {
                    return planejamentoModel.listarHistorico(idEmpresa)
                        .then(function (historico) {
                            return planejamentoModel.buscarGestor(idEmpresa)
                                .then(function (gestor) {
                                    return res.status(200).json(montarResposta(plano, servidores, historico, gestor));
                                });
                        });
                });
        }).catch(function (erro) {
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

    planejamentoModel.buscarPlanejamento(idEmpresa)
        .then(function (plano) {
            if (!plano || plano.length === 0) {
                return res.status(404).json({ erro: 'Planejamento não configurado para esta empresa.' });
            }
            return planejamentoModel.atualizarPremissas(idEmpresa, req.body)
                .then(function () {
                    return planejamentoModel.listarServidoresAtivos(idEmpresa)
                        .then(function (servidores) {
                            return planejamentoModel.listarHistorico(idEmpresa)
                                .then(function (historico) {
                                    return planejamentoModel.buscarGestor(idEmpresa)
                                        .then(function (gestor) {
                                            return res.status(200).json(montarResposta(plano, servidores, historico, gestor));
                                        });
                                });
                        });
                });
        }).catch(function (erro) {
            console.log(erro);
            res.status(500).json({ erro: 'Não foi possível atualizar as premissas.' });
        });
}

module.exports = {
    obter,
    atualizar
};
