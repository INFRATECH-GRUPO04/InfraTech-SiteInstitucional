/* (Claudia - M): Carrega os servidores da sessão e os limites do histórico publicado na Gold.
 */
(function () {
    // (Cláudia - M) Centraliza os cortes visuais da cobertura para facilitar ajustes sem alterar o cálculo do backend.
    var FAIXAS_COBERTURA = Object.freeze({ normal: 95, atencao: 80 });
    var filtroPeriodo = document.getElementById('filtroPeriodoHistorico');
    var conteudoInvestigacao = document.getElementById('conteudoInvestigacao');
    var indicadorOrigemGold = document.getElementById('indicadorOrigemGold');
    var dataInicial = document.getElementById('dataInicioHistorico');
    var dataFinal = document.getElementById('dataFimHistorico');
    var botaoAplicarPeriodo = document.getElementById('aplicarPeriodoHistorico');
    // (Cláudia - M) Conecta o aviso de período aos metadados históricos carregados da Gold.
    var estadoPeriodo = document.getElementById('estadoHistoricoGold');
    var botaoServidores = document.getElementById('alternarServidores');
    var listaServidores = document.getElementById('listaServidores');
    var opcoesServidores = document.getElementById('opcoesServidores');
    var estadoListaServidores = document.getElementById('estadoListaServidores');
    var resumoServidores = document.getElementById('resumoServidores');
    var chipsServidores = document.getElementById('chipsServidores');
    var botaoSelecionarTodos = document.getElementById('selecionarTodosServidores');
    var botaoLimparSelecao = document.getElementById('limparServidores');
    var botaoConcluirSelecao = document.getElementById('concluirSelecaoServidores');
    var avisoSemServidor = document.getElementById('avisoSemServidor');
    var metricaPrimaria = document.getElementById('metricaPrimaria');
    var metricaComparada = document.getElementById('metricaComparada');
    var seletorRelacaoRegressao = document.getElementById('seletorRelacaoRegressao');

    if (!filtroPeriodo || !dataInicial || !dataFinal || !botaoAplicarPeriodo || !estadoPeriodo
        || !botaoServidores || !listaServidores || !opcoesServidores) return;
    estadoPeriodo.textContent = 'Carregando os limites do histórico publicado na Gold.';

    var limitesEmpresa = null;
    var historicoServidores = new Map();
    var servidoresEmpresa = [];
    var idEmpresaAtual = null;
    var primeiraListaCarregada = false;
    var chaveSelecaoServidores = '';
    var temporizadorAtualizacao = null;
    var graficosInvestigacao = {};
    var documentoAnaliseAtual = null;
    // (Cláudia - M) Guarda a ocorrência escolhida para realçá-la na média temporal, sem trocar o valor agregado pelo individual.
    var eventoTemporalSelecionado = null;

    /* Converte datas do histórico para o calendário local, sem criar um limite
     * de dias ou meses que não esteja presente nos metadados recebidos.
     */
    function normalizarData(valor) {
        var texto = valor instanceof Date ? '' : String(valor || '').trim();
        var data = valor instanceof Date ? valor : null;
        var dataSemHorario = texto.match(/^(\d{4}-\d{2}-\d{2})$/);

        if (dataSemHorario) return dataSemHorario[1];
        if (!data && texto) data = new Date(texto);
        if (!data || !Number.isFinite(data.getTime())) return '';

        var partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(data);
        var valores = Object.fromEntries(partes.map(function (parte) { return [parte.type, parte.value]; }));
        return `${valores.year}-${valores.month}-${valores.day}`;
    }

    /* Mostra datas no padrão brasileiro, mantendo o valor ISO nos campos e no evento. */
    function formatarData(valor) {
        if (!valor) return '—';
        var partes = valor.split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    // (Cláudia - M) Mostra somente a origem e a quantidade informadas após uma resposta real do backend.
    function atualizarIndicadorOrigem(origem, resultado) {
        if (!indicadorOrigemGold) return;
        if (!origem || origem.provedor !== 'Amazon S3' || origem.camada !== 'Gold') {
            indicadorOrigemGold.dataset.estado = 'erro';
            indicadorOrigemGold.textContent = 'Origem Gold/S3 não confirmada';
            indicadorOrigemGold.title = 'A API não retornou a identificação da origem consultada.';
            return;
        }

        var objeto = origem.bucket ? `s3://${origem.bucket}/${origem.objetoMetadados}` : origem.objetoMetadados;
        indicadorOrigemGold.dataset.estado = origem.metadadosEncontrados === false ? 'ausente' : 'confirmada';
        if (resultado && Number.isFinite(Number(resultado.particoesLidas))) {
            indicadorOrigemGold.textContent = `Gold/S3 · ${resultado.particoesLidas}/${resultado.particoesListadas} partições · ${formatarNumero(resultado.capturasNoPeriodo || 0, 0)} capturas`;
            indicadorOrigemGold.title = `Metadados consultados em ${objeto}. Partições históricas efetivamente lidas para esta análise: ${resultado.particoesLidas} de ${resultado.particoesListadas}.`;
        } else if (origem.metadadosEncontrados === false) {
            indicadorOrigemGold.textContent = 'Gold/S3 consultada · metadados não encontrados';
            indicadorOrigemGold.title = `A API consultou ${objeto}, mas o objeto não foi encontrado.`;
        } else {
            indicadorOrigemGold.textContent = 'Fonte confirmada · Gold no Amazon S3';
            indicadorOrigemGold.title = `Metadados históricos recebidos de ${objeto}.`;
        }
    }

    /* Habilita o calendário apenas depois que a API de metadados fornecer os
     * limites reais do histórico da empresa.
     */
    function configurarLimitesEmpresa(primeiraCaptura, ultimaCaptura) {
        var inicio = normalizarData(primeiraCaptura);
        var fim = normalizarData(ultimaCaptura);

        if (!inicio || !fim || inicio > fim) {
            limitesEmpresa = null;
            dataInicial.disabled = true;
            dataFinal.disabled = true;
            botaoAplicarPeriodo.disabled = true;
            filtroPeriodo.dataset.estadoHistorico = 'metadados-invalidos';
            estadoPeriodo.textContent = 'Não foi possível definir os limites do calendário com as datas recebidas.';
            return false;
        }

        limitesEmpresa = { inicio: inicio, fim: fim };
        dataInicial.min = inicio;
        dataInicial.max = fim;
        dataFinal.min = inicio;
        dataFinal.max = fim;
        dataInicial.disabled = false;
        dataFinal.disabled = false;
        if (!dataInicial.value || dataInicial.value < inicio || dataInicial.value > fim) dataInicial.value = inicio;
        if (!dataFinal.value || dataFinal.value < inicio || dataFinal.value > fim) dataFinal.value = fim;
        filtroPeriodo.dataset.estadoHistorico = 'pronto';
        estadoPeriodo.textContent = `Histórico da empresa: ${formatarData(inicio)} a ${formatarData(fim)}.`;
        atualizarEstadoAplicacao();
        return true;
    }

    /* Registra as datas extremas conhecidas para um servidor. Elas não indicam
     * que existam capturas em todos os instantes entre esses limites.
     */
    function configurarLimitesServidor(idServidor, primeiraCaptura, ultimaCaptura) {
        var id = String(idServidor || '').trim();
        var inicio = normalizarData(primeiraCaptura);
        var fim = normalizarData(ultimaCaptura);
        if (!id || !inicio || !fim || inicio > fim) return false;

        historicoServidores.set(id, { inicio: inicio, fim: fim });
        return true;
    }

    /* Retorna os servidores atualmente marcados no filtro, usando os IDs vindos
     * do banco em vez de nomes fixos escritos no HTML.
     */
    function obterSelecionados() {
        return Array.from(opcoesServidores.querySelectorAll('input[name="servidores"]:checked'))
            .map(function (item) {
                return { id: item.value, nome: item.dataset.nome || item.value };
            });
    }

    /* Mantém o contador, a validação de seleção e a persistência local dos IDs. */
    function atualizarResumoSelecao(persistir) {
        var selecionados = obterSelecionados();
        resumoServidores.textContent = selecionados.length
            ? `${selecionados.length} de ${servidoresEmpresa.length} selecionados`
            : `0 de ${servidoresEmpresa.length} selecionados`;
        if (chipsServidores) {
            chipsServidores.replaceChildren();
            if (!selecionados.length) {
                var vazio = document.createElement('span');
                vazio.className = 'investigacao-seletor-servidores__vazio';
                vazio.textContent = servidoresEmpresa.length ? 'Nenhum servidor selecionado' : 'Nenhum servidor disponível';
                chipsServidores.appendChild(vazio);
            } else {
                selecionados.forEach(function (servidor) {
                    var chip = document.createElement('span');
                    var nome = document.createElement('span');
                    var remover = document.createElement('button');
                    chip.className = 'investigacao-servidor-chip';
                    nome.className = 'investigacao-servidor-chip__nome';
                    nome.textContent = servidor.nome;
                    remover.className = 'investigacao-servidor-chip__remover';
                    remover.type = 'button';
                    remover.dataset.servidorId = servidor.id;
                    remover.setAttribute('aria-label', `Remover ${servidor.nome} da seleção`);
                    remover.textContent = '×';
                    chip.append(nome, remover);
                    chipsServidores.appendChild(chip);
                });
            }
            chipsServidores.scrollLeft = 0;
        }
        opcoesServidores.querySelectorAll('input[name="servidores"]').forEach(function (entrada) {
            entrada.closest('label')?.classList.toggle('selecionado', entrada.checked);
        });
        if (avisoSemServidor) avisoSemServidor.hidden = selecionados.length > 0;

        if (persistir && chaveSelecaoServidores) {
            try {
                sessionStorage.setItem(chaveSelecaoServidores, JSON.stringify(selecionados.map(function (item) { return item.id; })));
            } catch (_) {
                estadoListaServidores.textContent = 'A seleção será mantida apenas enquanto esta página estiver aberta.';
            }
        }

        atualizarEstadoAplicacao();
        if (persistir) {
            document.dispatchEvent(new CustomEvent('infratech:servidores-investigacao-alterados', {
                detail: { servidores: servidoresEmpresa.slice(), selecionados: selecionados }
            }));
        }
        return selecionados;
    }

    /* Cria as opções com o inventário retornado pela empresa autenticada. Uma
     * nova inclusão aparece desmarcada para não ampliar a análise sem escolha.
     */
    function renderizarServidores(lista) {
        var selecionadosAntes = new Set(obterSelecionados().map(function (item) { return item.id; }));
        var selecaoSalva = null;

        if (!primeiraListaCarregada && chaveSelecaoServidores) {
            try {
                var valorSalvo = sessionStorage.getItem(chaveSelecaoServidores);
                if (valorSalvo !== null) selecaoSalva = new Set(JSON.parse(valorSalvo).map(String));
            } catch (_) {
                selecaoSalva = null;
            }
        }

        servidoresEmpresa = (lista || []).map(function (servidor) {
            return {
                id: String(servidor.idServidor || servidor.id_servidor || ''),
                nome: String(servidor.nome || servidor.nomeServidor || '').trim()
            };
        }).filter(function (servidor) { return servidor.id && servidor.nome; })
            .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }); });

        opcoesServidores.replaceChildren();
        if (!servidoresEmpresa.length) {
            var vazio = document.createElement('p');
            vazio.className = 'investigacao-lista-servidores__estado';
            vazio.textContent = 'Sua empresa ainda não possui servidores cadastrados.';
            opcoesServidores.appendChild(vazio);
            primeiraListaCarregada = true;
            atualizarResumoSelecao(true);
            return;
        }

        servidoresEmpresa.forEach(function (servidor) {
            var rotulo = document.createElement('label');
            var entrada = document.createElement('input');
            var selecionado = primeiraListaCarregada
                ? selecionadosAntes.has(servidor.id)
                : selecaoSalva
                    ? selecaoSalva.has(servidor.id)
                    : true;

            entrada.type = 'checkbox';
            entrada.name = 'servidores';
            entrada.value = servidor.id;
            entrada.dataset.nome = servidor.nome;
            entrada.checked = selecionado;
            rotulo.classList.toggle('selecionado', selecionado);
            entrada.addEventListener('change', function () {
                rotulo.classList.toggle('selecionado', entrada.checked);
                atualizarResumoSelecao(true);
            });
            rotulo.append(entrada, document.createTextNode(` ${servidor.nome}`));
            opcoesServidores.appendChild(rotulo);
        });

        primeiraListaCarregada = true;
        if (estadoListaServidores) estadoListaServidores.remove();
        atualizarResumoSelecao(true);
    }

    /* Atualiza o inventário a partir do backend, cuja consulta é limitada à
     * empresa da sessão e inclui os servidores cadastrados desde a última busca.
     */
    async function atualizarListaServidores() {
        if (document.visibilityState === 'hidden') return;

        try {
            var resposta = await fetch('/investigacao/metadados', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            if (!resposta.ok) {
                var mensagem = resposta.status === 401
                    ? 'Sua sessão expirou. Entre novamente para carregar o histórico.'
                    : resposta.status === 403
                        ? 'Seu cargo não tem permissão para consultar esta dashboard.'
                        : resposta.status === 404
                            ? 'A API de investigação não foi encontrada. Reinicie o backend e atualize esta página.'
                            : `A API de investigação respondeu com erro (${resposta.status}).`;
                throw new Error(mensagem);
            }

            var tipoResposta = resposta.headers.get('content-type') || '';
            if (!tipoResposta.includes('application/json')) {
                throw new Error('A API não retornou os metadados históricos. Reinicie o backend e atualize esta página.');
            }

            var metadados = await resposta.json();
            atualizarIndicadorOrigem(metadados.origemDados);
            idEmpresaAtual = Number(metadados.idEmpresa);
            chaveSelecaoServidores = `infratech.investigacao.servidores.${idEmpresaAtual}`;
            if (metadados.historicoDisponivel) {
                configurarLimitesEmpresa(metadados.primeiraCaptura, metadados.ultimaCaptura);
                (metadados.servidores || []).forEach(function (servidor) {
                    configurarLimitesServidor(servidor.idServidor, servidor.primeiraCaptura, servidor.ultimaCaptura);
                });
            } else {
                limitesEmpresa = null;
                dataInicial.disabled = true;
                dataFinal.disabled = true;
                botaoAplicarPeriodo.disabled = true;
                filtroPeriodo.dataset.estadoHistorico = 'sem-historico';
                estadoPeriodo.textContent = 'Ainda não há histórico publicado na Gold para esta empresa.';
                if (conteudoInvestigacao) {
                    conteudoInvestigacao.dataset.estado = 'sem-dados';
                    conteudoInvestigacao.setAttribute('aria-busy', 'false');
                }
            }
            renderizarServidores(Array.isArray(metadados.servidores) ? metadados.servidores : []);
        } catch (erro) {
            if (indicadorOrigemGold) {
                indicadorOrigemGold.dataset.estado = 'erro';
                indicadorOrigemGold.textContent = 'Origem Gold/S3 não confirmada';
                indicadorOrigemGold.title = erro && erro.message ? erro.message : 'Falha ao consultar a API.';
            }
            if (conteudoInvestigacao) {
                conteudoInvestigacao.dataset.estado = 'erro';
                conteudoInvestigacao.setAttribute('aria-busy', 'false');
            }
            if (estadoListaServidores) {
                estadoListaServidores.textContent = erro && erro.message
                    ? erro.message
                    : 'Não foi possível conectar à API de servidores. Verifique se o backend está ativo.';
            }
        }
    }

    /* Usa a empresa já carregada pela sessão. Se ainda não estiver no navegador,
     * consulta a mesma sessão autenticada validada pelo restante da aplicação.
     */
    async function iniciarListaServidores() {
        await atualizarListaServidores();
        temporizadorAtualizacao = window.setInterval(atualizarListaServidores, 30000);
    }

    /* Valida datas, seleção de servidores e limites recebidos para só liberar
     * a aplicação de um intervalo possível dentro do histórico da empresa.
     */
    function atualizarEstadoAplicacao() {
        if (!limitesEmpresa) {
            botaoAplicarPeriodo.disabled = true;
            return;
        }

        dataInicial.max = dataFinal.value || limitesEmpresa.fim;
        dataFinal.min = dataInicial.value || limitesEmpresa.inicio;
        botaoAplicarPeriodo.disabled = !obterSelecionados().length
            || !dataInicial.value || !dataFinal.value
            || !dataInicial.validity.valid || !dataFinal.validity.valid
            || dataInicial.value > dataFinal.value;
    }

    /* (Claudia - M): Consulta a Gold pelo backend; a empresa vem da sessão e não do navegador. */
    async function aplicarAnalise() {
        atualizarEstadoAplicacao();
        if (botaoAplicarPeriodo.disabled) return;

        if (metricaPrimaria.value === metricaComparada.value) {
            estadoPeriodo.textContent = 'Escolha duas métricas diferentes para comparar.';
            return;
        }

        var solicitacao = {
            servidores: obterSelecionados().map(function (servidor) { return Number(servidor.id); }),
            metricas: {
                x: metricaPrimaria.value,
                y: metricaComparada.value,
                boxplot: metricaPrimaria.value
            },
            periodo: { inicio: dataInicial.value, fim: dataFinal.value }
        };
        documentoAnaliseAtual = null;
        eventoTemporalSelecionado = null;

        botaoAplicarPeriodo.disabled = true;
        botaoAplicarPeriodo.textContent = 'Consultando…';
        if (conteudoInvestigacao) {
            conteudoInvestigacao.dataset.estado = 'carregando';
            conteudoInvestigacao.setAttribute('aria-busy', 'true');
        }
        filtroPeriodo.dataset.estadoHistorico = 'consultando';
        estadoPeriodo.textContent = 'Consultando os dados históricos e calculando as análises…';
        try {
            var resposta = await fetch('/investigacao/analisar', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(solicitacao)
            });
            var documento = await resposta.json();
            if (!resposta.ok) throw new Error(documento.erro || `A API respondeu com erro (${resposta.status}).`);
            documentoAnaliseAtual = documento;
            atualizarIndicadorOrigem(documento.origemDados, documento.origemDados);
            renderizarAnalise(documento);
            if (conteudoInvestigacao) {
                var semDadosSelecionados = (documento.disponibilidade || []).every(function (item) { return item.semDados; });
                conteudoInvestigacao.dataset.estado = semDadosSelecionados ? 'sem-dados' : 'pronto';
            }
            filtroPeriodo.dataset.estadoHistorico = 'periodo-selecionado';
            var semDados = (documento.disponibilidade || []).filter(function (item) { return item.semDados; });
            var avisoDados = semDados.length
                ? ` Sem capturas no período para: ${semDados.map(function (item) { return item.nomeServidor; }).join(', ')}.`
                : '';
            estadoPeriodo.textContent = `Análise atualizada para ${formatarData(solicitacao.periodo.inicio)} a ${formatarData(solicitacao.periodo.fim)}.${avisoDados}`;
        } catch (erro) {
            filtroPeriodo.dataset.estadoHistorico = 'erro-consulta';
            if (conteudoInvestigacao) conteudoInvestigacao.dataset.estado = 'erro';
            if (indicadorOrigemGold) {
                indicadorOrigemGold.dataset.estado = 'erro';
                indicadorOrigemGold.textContent = 'Consulta Gold/S3 não concluída';
                indicadorOrigemGold.title = erro && erro.message ? erro.message : 'Falha ao consultar os dados históricos.';
            }
            estadoPeriodo.textContent = erro && erro.message ? erro.message : 'Não foi possível consultar as análises.';
        } finally {
            if (conteudoInvestigacao) conteudoInvestigacao.setAttribute('aria-busy', 'false');
            botaoAplicarPeriodo.textContent = 'Aplicar';
            atualizarEstadoAplicacao();
        }
    }

    botaoAplicarPeriodo.addEventListener('click', aplicarAnalise);

    async function carregarRelacaoSelecionada() {
        if (!documentoAnaliseAtual || !seletorRelacaoRegressao || !seletorRelacaoRegressao.value) return;
        var partes = seletorRelacaoRegressao.value.split(':').map(Number);
        var solicitacao = {
            servidores: obterSelecionados().map(function (servidor) { return Number(servidor.id); }),
            metricas: { x: metricaPrimaria.value, y: metricaComparada.value, boxplot: metricaPrimaria.value },
            periodo: { inicio: dataInicial.value, fim: dataFinal.value },
            relacao: { origem: partes[0], destino: partes[1] }
        };
        seletorRelacaoRegressao.disabled = true;
        try {
            var resposta = await fetch('/investigacao/analisar', {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(solicitacao)
            });
            var detalhe = await resposta.json();
            if (!resposta.ok) throw new Error(detalhe.erro || `A API respondeu com erro (${resposta.status}).`);
            atualizarIndicadorOrigem(detalhe.origemDados, detalhe.origemDados);
            documentoAnaliseAtual.regressao.representativa = detalhe.relacao;
            documentoAnaliseAtual.kpis.maiorDesvioRegressao = detalhe.kpis.maiorDesvioRegressao;
            renderizarResumoRegressao(documentoAnaliseAtual);
            montarGraficoRegressao(documentoAnaliseAtual);
        } catch (erro) {
            estadoPeriodo.textContent = erro.message || 'Não foi possível abrir esta relação.';
        } finally {
            seletorRelacaoRegressao.disabled = false;
        }
    }

    if (seletorRelacaoRegressao) seletorRelacaoRegressao.addEventListener('change', carregarRelacaoSelecionada);

    function formatarNumero(valor, casas) {
        if (valor == null || !Number.isFinite(Number(valor))) return '—';
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas == null ? 2 : casas }).format(Number(valor));
    }

    function rotuloMetrica(metrica) {
        var unidades = { cpu: 'CPU (%)', ram: 'RAM (%)', disco: 'Disco (%)', rede: 'Rede (Mbps)' };
        return unidades[metrica] || String(metrica || '').toUpperCase();
    }

    // (Cláudia - M) Classifica eventos somente pelos limites operacionais válidos do próprio servidor e da métrica.
    function obterSeveridadeOperacional(documento, evento) {
        var limites = documento.limitesOperacionais || {};
        var servidor = limites[String(evento.idServidor)] || {};
        var metrica = servidor[evento.metrica] || {};
        var atencao = Number(metrica.atencao);
        var critico = Number(metrica.critico);
        var temAtencao = metrica.atencao != null && Number.isFinite(atencao);
        var temCritico = metrica.critico != null && Number.isFinite(critico);
        if (!temAtencao && !temCritico) return 'sem-limite';
        if (temCritico && Number(evento.valor) >= critico) return 'critico';
        if (temAtencao && Number(evento.valor) >= atencao) return 'atencao';
        return 'normal';
    }

    function unidadeDesvio(metrica) {
        return ['cpu', 'ram', 'disco'].includes(metrica) ? 'p.p.' : 'Mbps';
    }

    function destruirGrafico(nome) {
        if (graficosInvestigacao[nome]) {
            graficosInvestigacao[nome].destroy();
            delete graficosInvestigacao[nome];
        }
    }

    function montarGraficoRegressao(documento) {
        if (!window.Chart) return;
        destruirGrafico('regressao');
        var relacao = documento.regressao.representativa;
        var datasets = [];
        if (relacao && relacao.status === 'ok') {
            datasets.push({
                label: `${relacao.nomeOrigem} → ${relacao.nomeDestino} · observações`,
                data: (relacao.pontos || []).map(function (ponto) { return {
                    x: ponto.x, y: ponto.observado, timestamp: ponto.timestamp,
                    nomeOrigem: ponto.nomeServidorX, nomeDestino: ponto.nomeServidorY,
                    timestampX: ponto.timestampX, timestampY: ponto.timestampY,
                    estimado: ponto.estimado, residuo: ponto.residuo
                }; }),
                backgroundColor: '#a855f7', borderColor: '#a855f7', pointRadius: 2.2, pointHoverRadius: 5
            });
            if (relacao.reta && relacao.reta.length) {
                datasets.push({
                    label: 'Reta de regressão',
                    data: relacao.reta, showLine: true, pointRadius: 0,
                    borderColor: '#00d2df', borderWidth: 2
                });
            }
            if (relacao.maiorDesvio) {
                var ponto = (relacao.pontos || []).find(function (item) {
                    return item.timestamp === relacao.maiorDesvio.timestamp;
                });
                if (ponto) datasets.push({
                    label: 'Maior desvio',
                    data: [{ x: ponto.x, y: ponto.observado }],
                    backgroundColor: '#fbbf24', borderColor: '#fbbf24', pointRadius: 6, pointStyle: 'triangle'
                });
            }
        var eixoX = documento.regressao.metricaX;
        var eixoY = documento.regressao.metricaY;
        graficosInvestigacao.regressao = new Chart(document.getElementById('graficoRegressao'), {
            type: 'scatter', data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: {
                    label: function (contexto) {
                        var ponto = contexto.raw || {};
                        var servidores = ponto.nomeOrigem && ponto.nomeDestino
                            ? `${ponto.nomeOrigem} → ${ponto.nomeDestino} · ` : '';
                        var horario = ponto.timestamp ? ` · ${new Date(ponto.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : '';
                        var alinhamento = ponto.timestampX && ponto.timestampY
                            ? ` · amostras ${new Date(ponto.timestampX).toLocaleTimeString('pt-BR')} / ${new Date(ponto.timestampY).toLocaleTimeString('pt-BR')}` : '';
                        var residuo = ponto.residuo == null ? '' : ` · estimado ${formatarNumero(ponto.estimado)} · resíduo ${formatarNumero(ponto.residuo)}`;
                        return `${servidores}${contexto.dataset.label}: ${formatarNumero(contexto.parsed.x)} × ${formatarNumero(contexto.parsed.y)}${residuo}${horario}${alinhamento}`;
                    }
                } } },
                scales: {
                    x: { type: 'linear', title: { display: true, text: rotuloMetrica(eixoX), color: '#c3d0da', font: { size: 11, weight: '600' } }, ticks: { color: '#c3d0da', font: { size: 11 }, maxTicksLimit: 7 }, grid: { color: '#293746' } },
                    y: { title: { display: true, text: rotuloMetrica(eixoY), color: '#c3d0da', font: { size: 11, weight: '600' } }, ticks: { color: '#c3d0da', font: { size: 11 }, maxTicksLimit: 7 }, grid: { color: '#293746' } }
                }
            }
        });
        } else {
            datasets = [];
            document.getElementById('graficoRegressao').setAttribute('aria-label', 'Não há uma relação cruzada com amostras suficientes para regressão.');
        }
    }

    function renderizarResumoRegressao(documento) {
        var regressao = documento.regressao;
        var relacao = regressao.representativa;
        var resumo = regressao.resumo || {};
        var seletor = seletorRelacaoRegressao;
        if (seletor) {
            var valorAnterior = seletor.value;
            seletor.replaceChildren();
            (regressao.relacoes || []).forEach(function (item) {
                var opcao = document.createElement('option');
                opcao.value = `${item.idOrigem}:${item.idDestino}`;
                opcao.textContent = `${item.nomeOrigem} → ${item.nomeDestino} · ${item.amostrasAlinhadas} pares`;
                seletor.appendChild(opcao);
            });
            if (valorAnterior && Array.from(seletor.options).some(function (opcao) { return opcao.value === valorAnterior; })) {
                seletor.value = valorAnterior;
            } else if (resumo.idRelacaoRepresentativa) seletor.value = resumo.idRelacaoRepresentativa;
            seletor.disabled = (regressao.relacoes || []).length === 0;
        }
        document.getElementById('regressaoMetricaX').textContent = regressao.metricaX.toUpperCase();
        document.getElementById('regressaoMetricaY').textContent = regressao.metricaY.toUpperCase();
        document.getElementById('tituloGraficoRegressao').textContent = relacao
            ? `Regressão: ${relacao.nomeOrigem} → ${relacao.nomeDestino}`
            : `Regressão cruzada: ${regressao.metricaX.toUpperCase()} × ${regressao.metricaY.toUpperCase()}`;
        var equacao = document.getElementById('equacaoRegressao');
        var r2Saida = document.getElementById('r2Regressao');
        var amostrasSaida = document.getElementById('amostrasRegressao');
        var angular = document.getElementById('coeficienteAngular');
        var intercepto = document.getElementById('interceptoRegressao');
        var desvioDetalhe = document.getElementById('desvioRegressaoDetalhe');
        if (relacao && relacao.status === 'ok') {
            equacao.textContent = `y = ${formatarNumero(relacao.angular, 4)}x ${relacao.intercepto < 0 ? '−' : '+'} ${formatarNumero(Math.abs(relacao.intercepto), 4)}`;
            r2Saida.textContent = formatarNumero(relacao.r2);
            amostrasSaida.textContent = formatarNumero(relacao.quantidade, 0);
            angular.textContent = formatarNumero(relacao.angular, 4);
            intercepto.textContent = formatarNumero(relacao.intercepto, 4);
            var desvioRelacao = relacao.maiorDesvio;
            var unidadeRelacao = unidadeDesvio(regressao.metricaY);
            desvioDetalhe.textContent = desvioRelacao
                ? `${formatarNumero(desvioRelacao.valor)} ${unidadeRelacao}` : '—';
        } else {
            equacao.textContent = relacao ? 'Amostras insuficientes para ajustar uma reta.' : 'Não há pares de servidores diferentes selecionados.';
            r2Saida.textContent = '—';
            amostrasSaida.textContent = relacao ? formatarNumero(relacao.quantidade, 0) : '—';
            angular.textContent = '—';
            intercepto.textContent = '—';
            desvioDetalhe.textContent = '—';
        }
        var maiorDesvio = documento.kpis.maiorDesvioRegressao;
        var unidade = unidadeDesvio(regressao.metricaY);
        document.getElementById('kpiMaiorDesvio').textContent = maiorDesvio ? `${formatarNumero(maiorDesvio.valor)} ${unidade}` : '—';
        document.getElementById('escopoMaiorDesvio').textContent = maiorDesvio ? maiorDesvio.relacao : 'Sem regressão válida';
        var legendaDesvio = document.getElementById('legendaMaiorDesvio');
        if (legendaDesvio) legendaDesvio.textContent = maiorDesvio ? `(${formatarNumero(maiorDesvio.valor)} ${unidade})` : '(—)';
    }

    function montarGraficoAnomalias(documento) {
        if (!window.Chart) return;
        destruirGrafico('anomalias');
        var coresMetricas = { cpu: '#00d2df', ram: '#a855f7', disco: '#22d3a6', rede: '#60a5fa' };
        var eixoX = documento.metricas.x;
        var eixoY = documento.metricas.y;
        var datasets = [];
        var seriesAgregadas = documento.anomalias.serie || [];
        var serieCoorte = seriesAgregadas[0];
        (documento.anomalias.serie || []).forEach(function (servidor) {
            [
                { metrica: eixoX, chave: 'x', idEixo: 'y' },
                { metrica: eixoY, chave: 'y', idEixo: eixoX === eixoY ? 'y' : 'y1' }
            ].forEach(function (definicao, indiceMetrica) {
                var pontos = servidor.pontos || [];
                var dados = [];
                pontos.forEach(function (ponto, indicePonto) {
                    if (indicePonto && ponto.quebraAntes) {
                        dados.push({ x: Date.parse(pontos[indicePonto - 1].timestamp) + 1, y: null });
                    }
                    dados.push({ x: Date.parse(ponto.timestamp), y: ponto[definicao.chave] });
                });
                datasets.push({
                    label: `${definicao.metrica.toUpperCase()} · ${servidor.nomeServidor || 'média do conjunto'}`,
                    data: dados, showLine: true, spanGaps: false,
                    borderColor: coresMetricas[definicao.metrica] || '#00d2df',
                    backgroundColor: coresMetricas[definicao.metrica] || '#00d2df',
                    borderDash: indiceMetrica ? [4, 3] : [],
                    borderWidth: 1.5, pointRadius: 0, yAxisID: definicao.idEixo
                });
            });
        });
        var limiteCoorte = documento.kpis.tempoCritico.limiteUnico;
        var legendaLimite = document.getElementById('legendaLimiteCritico');
        if (legendaLimite) legendaLimite.hidden = limiteCoorte == null;
        if (limiteCoorte != null && serieCoorte && serieCoorte.pontos.length > 1) {
            datasets.push({
                label: `Limite crítico · ${eixoX.toUpperCase()}`,
                data: [
                    { x: Date.parse(serieCoorte.pontos[0].timestamp), y: limiteCoorte },
                    { x: Date.parse(serieCoorte.pontos[serieCoorte.pontos.length - 1].timestamp), y: limiteCoorte }
                ],
                showLine: true, pointRadius: 0, borderColor: '#fb5360', borderDash: [6, 4],
                borderWidth: 1.5, yAxisID: 'y'
            });
        }
        var eventosVisiveis = (documento.anomalias.eventosIndividuais || []).slice(0, 60);
        [eixoX, eixoY].forEach(function (metrica) {
            var eventosMetrica = eventosVisiveis.filter(function (evento) { return evento.metrica === metrica; });
            if (!eventosMetrica.length) return;
            var chaveSerie = metrica === eixoX ? 'x' : 'y';
            var chaveEixo = metrica === eixoX ? 'y' : (eixoX === eixoY ? 'y' : 'y1');
            var valoresAgregados = serieCoorte ? serieCoorte.pontos : [];
            var marcadores = eventosMetrica.map(function (evento) {
                var timestampEvento = Date.parse(evento.timestamp);
                var pontoAgregado = valoresAgregados.find(function (ponto) {
                    return Date.parse(ponto.timestamp) === timestampEvento;
                });
                if (!pontoAgregado || pontoAgregado[chaveSerie] == null) return null;
                var selecionado = eventoTemporalSelecionado
                    && String(eventoTemporalSelecionado.idServidor) === String(evento.idServidor)
                    && eventoTemporalSelecionado.timestamp === evento.timestamp
                    && eventoTemporalSelecionado.metrica === evento.metrica;
                return {
                    x: timestampEvento, y: pontoAgregado[chaveSerie], valorIndividual: evento.valor,
                    nomeServidor: evento.nomeServidor, zScore: evento.zScore, timestamp: evento.timestamp,
                    idServidor: evento.idServidor, selecionado: Boolean(selecionado), serieAgregada: true
                };
            }).filter(Boolean);
            if (!marcadores.length) return;
            datasets.push({
                label: `Anomalias individuais · ${metrica.toUpperCase()}`,
                data: marcadores,
                showLine: false,
                backgroundColor: function (contexto) {
                    var severidade = obterSeveridadeOperacional(documento, contexto.raw || {});
                    return { critico: '#F05262', atencao: '#F5B82E', normal: '#20C997', 'sem-limite': '#77A9C7' }[severidade];
                },
                borderColor: function (contexto) {
                    var severidade = obterSeveridadeOperacional(documento, contexto.raw || {});
                    return { critico: '#F05262', atencao: '#F5B82E', normal: '#20C997', 'sem-limite': '#77A9C7' }[severidade];
                },
                pointRadius: function (contexto) { return contexto.raw && contexto.raw.selecionado ? 8 : 4; },
                pointBorderWidth: function (contexto) { return contexto.raw && contexto.raw.selecionado ? 3 : 1; },
                pointStyle: function (contexto) { return contexto.raw && contexto.raw.selecionado ? 'rectRot' : 'triangle'; },
                yAxisID: chaveEixo
            });
        });
        var gruposSimultaneos = documento.anomalias.gruposSimultaneos || [];
        [eixoX, eixoY].forEach(function (metrica) {
            var membrosSimultaneos = eventosVisiveis.filter(function (evento) {
                return evento.metrica === metrica && gruposSimultaneos.some(function (grupo) {
                    return grupo.metrica === metrica && grupo.membros.some(function (membro) {
                        return membro.idServidor === evento.idServidor && membro.timestamp === evento.timestamp;
                    });
                });
            });
            if (!membrosSimultaneos.length) return;
            var chaveSerie = metrica === eixoX ? 'x' : 'y';
            var chaveEixo = metrica === eixoX ? 'y' : (eixoX === eixoY ? 'y' : 'y1');
            datasets.push({
                label: `Evento simultâneo · ${metrica.toUpperCase()}`,
                data: membrosSimultaneos.map(function (evento) {
                    var agregado = (serieCoorte ? serieCoorte.pontos : []).find(function (ponto) {
                        return Date.parse(ponto.timestamp) === Date.parse(evento.timestamp);
                    });
                    return agregado && agregado[chaveSerie] != null ? {
                        x: Date.parse(evento.timestamp), y: agregado[chaveSerie], nomeServidor: evento.nomeServidor,
                        valorIndividual: evento.valor, zScore: evento.zScore, simultaneo: true
                    } : null;
                }).filter(Boolean),
                showLine: false, backgroundColor: '#a855f7', borderColor: '#f5f7fa',
                pointRadius: 6, pointStyle: 'rectRot', yAxisID: chaveEixo
            });
        });
        var escalas = {
            x: { type: 'linear', ticks: { color: '#c3d0da', font: { size: 11 }, maxTicksLimit: 6, callback: function (valor) {
                return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(valor));
            } }, grid: { color: '#293746' } },
            y: { position: 'left', title: { display: true, text: rotuloMetrica(eixoX), color: '#c3d0da', font: { size: 11, weight: '600' } }, ticks: { color: '#c3d0da', font: { size: 11 } }, grid: { color: '#293746' } }
        };
        if (eixoX !== eixoY) escalas.y1 = { position: 'right', title: { display: true, text: rotuloMetrica(eixoY), color: '#c3d0da', font: { size: 11, weight: '600' } }, ticks: { color: '#c3d0da', font: { size: 11 } }, grid: { drawOnChartArea: false } };
        // (Cláudia - M) Marca o horário selecionado no gráfico agregado sem atribuir ao conjunto o valor individual do evento.
        var pluginEventoSelecionado = {
            id: 'infratechEventoTemporalSelecionado',
            afterDatasetsDraw: function (grafico) {
                if (!eventoTemporalSelecionado) return;
                var horario = Date.parse(eventoTemporalSelecionado.timestamp);
                var pixelX = grafico.scales.x.getPixelForValue(horario);
                var area = grafico.chartArea;
                if (!Number.isFinite(pixelX) || pixelX < area.left || pixelX > area.right) return;
                var contexto = grafico.ctx;
                contexto.save();
                contexto.strokeStyle = '#fbbf24';
                contexto.lineWidth = 2;
                contexto.setLineDash([4, 3]);
                contexto.beginPath();
                contexto.moveTo(pixelX, area.top);
                contexto.lineTo(pixelX, area.bottom);
                contexto.stroke();
                contexto.restore();
            }
        };
        graficosInvestigacao.anomalias = new Chart(document.getElementById('graficoAnomalias'), {
            type: 'scatter', data: { datasets: datasets },
            plugins: [pluginEventoSelecionado],
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: {
                    title: function (itens) { return itens.length ? new Date(itens[0].parsed.x).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''; },
                    label: function (contexto) {
                        var ponto = contexto.raw || {};
                        return ponto.nomeServidor
                            ? `${contexto.dataset.label}: média ${formatarNumero(contexto.parsed.y)} · evento individual ${ponto.nomeServidor} (${formatarNumero(ponto.valorIndividual)}) · Z ${formatarNumero(ponto.zScore)}${ponto.simultaneo ? ' · ocorrência simultânea' : ''}`
                            : `${contexto.dataset.label}: ${formatarNumero(contexto.parsed.y)}`;
                    }
                } } }, scales: escalas }
        });
    }

    // (Cláudia - M) Apresenta os quartis já calculados pelo backend e mantém tooltips estatísticos por servidor.
    function montarGraficoBoxplot(documento) {
        if (!window.Chart) return;
        destruirGrafico('boxplot');
        var itens = (documento.boxplot.porServidor || []).slice()
            .sort(function (a, b) { return Number(a.idServidor) - Number(b.idServidor); });
        var nomes = itens.map(function (item) { return item.nomeServidor; });
        var metricasPercentuais = ['cpu', 'ram', 'disco'];
        var metrica = documento.boxplot.metrica;
        var unidade = metricasPercentuais.includes(metrica) ? '%' : ' Mbps';
        var valores = itens.filter(function (item) { return item.status === 'ok'; })
            .flatMap(function (item) { return [item.bigodeInferior, item.bigodeSuperior].concat(item.outliers || []); });
        var minimo = valores.length ? valores.reduce(function (menor, valor) { return Math.min(menor, valor); }, Infinity) : 0;
        var maximo = valores.length ? valores.reduce(function (maior, valor) { return Math.max(maior, valor); }, -Infinity) : 100;
        if (metricasPercentuais.includes(metrica)) {
            minimo = 0;
            maximo = 100;
        } else {
            minimo = Math.min(0, minimo);
            if (maximo <= 0) maximo = 1;
            else maximo *= 1.08;
        }
        var pontosTooltip = itens.filter(function (item) { return item.status === 'ok'; })
            .map(function (item) { return { x: item.mediana, y: item.nomeServidor, item: item }; });
        var nomeMetrica = { cpu: 'CPU', ram: 'RAM', disco: 'Disco', rede: 'Rede' }[metrica] || String(metrica || '').toUpperCase();
        var tituloBoxplot = document.getElementById('tituloBoxplot');
        if (tituloBoxplot) tituloBoxplot.textContent = `Distribuição de ${nomeMetrica} por servidor`;
        var espacoVertical = Math.max(6, (6 - Math.min(itens.length, 6)) * 9);
        var pluginBoxplot = {
            id: 'infratechBoxplot',
            afterDatasetsDraw: function (grafico, args, opcoes) {
                var ctx = grafico.ctx, escalaX = grafico.scales.x, escalaY = grafico.scales.y;
                var alturaCategoria = escalaY.height / Math.max(1, (opcoes.itens || []).length);
                var alturaCaixa = Math.min(28, Math.max(14, alturaCategoria * 0.62));
                var corCaixa = '#91A3B0';
                ctx.save();
                (opcoes.itens || []).forEach(function (item) {
                    if (item.status !== 'ok') return;
                    var y = escalaY.getPixelForValue(item.nomeServidor);
                    var xMin = escalaX.getPixelForValue(item.bigodeInferior);
                    var xQ1 = escalaX.getPixelForValue(item.q1);
                    var xMediana = escalaX.getPixelForValue(item.mediana);
                    var xQ3 = escalaX.getPixelForValue(item.q3);
                    var xMax = escalaX.getPixelForValue(item.bigodeSuperior);
                    ctx.strokeStyle = corCaixa; ctx.fillStyle = 'rgba(145, 163, 176, 0.24)'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(xMin, y); ctx.lineTo(xMax, y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(xMin, y - alturaCaixa / 2); ctx.lineTo(xMin, y + alturaCaixa / 2); ctx.moveTo(xMax, y - alturaCaixa / 2); ctx.lineTo(xMax, y + alturaCaixa / 2); ctx.stroke();
                    ctx.fillRect(xQ1, y - alturaCaixa / 2, Math.max(1, xQ3 - xQ1), alturaCaixa);
                    ctx.strokeRect(xQ1, y - alturaCaixa / 2, Math.max(1, xQ3 - xQ1), alturaCaixa);
                    ctx.strokeStyle = '#E5EDF2'; ctx.lineWidth = 2.2;
                    ctx.beginPath(); ctx.moveTo(xMediana, y - alturaCaixa / 2); ctx.lineTo(xMediana, y + alturaCaixa / 2); ctx.stroke();
                    ctx.fillStyle = '#C3D0D8';
                    (item.outliers || []).forEach(function (valor) {
                        ctx.beginPath(); ctx.arc(escalaX.getPixelForValue(valor), y, 3, 0, Math.PI * 2); ctx.fill();
                    });
                });
                ctx.restore();
            }
        };
        graficosInvestigacao.boxplot = new Chart(document.getElementById('graficoBoxplot'), {
            type: 'scatter', data: { datasets: [{ data: pontosTooltip, pointRadius: 0, pointHitRadius: 12, pointHoverRadius: 0 }] }, plugins: [pluginBoxplot],
            options: { responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: espacoVertical, bottom: espacoVertical } },
                plugins: { legend: { display: false }, infratechBoxplot: { itens: itens }, tooltip: { callbacks: {
                    title: function (contextos) { return contextos[0] && contextos[0].raw.item.nomeServidor; },
                    label: function (contexto) {
                        var item = contexto.raw.item;
                        return [
                            `Bigode inferior: ${formatarNumero(item.bigodeInferior)}${unidade}`,
                            `Q1: ${formatarNumero(item.q1)}${unidade}`,
                            `Mediana: ${formatarNumero(item.mediana)}${unidade}`,
                            `Q3: ${formatarNumero(item.q3)}${unidade}`,
                            `Bigode superior: ${formatarNumero(item.bigodeSuperior)}${unidade}`,
                            `Outliers: ${item.outliersTotal == null ? (item.outliers || []).length : item.outliersTotal}`
                        ];
                    }
                } } },
                scales: {
                    x: { type: 'linear', min: minimo, max: maximo, title: { display: true, text: rotuloMetrica(metrica) }, ticks: { color: '#c3d0da', callback: function (valor) { return `${formatarNumero(valor)}${unidade}`; } }, grid: { color: '#293746' } },
                    y: { type: 'category', labels: nomes, reverse: true, ticks: { color: '#e0e8ee', font: { size: 11, weight: '600' }, padding: 9 }, grid: { display: false } }
                }
            }
        });
    }

    function renderizarAnalise(documento) {
        var resumo = documento.pearson.resumo || {};
        var distribuicao = resumo.distribuicao || {};
        var relacoes = documento.pearson.porRelacao || [];
        var valorPearson = resumo.medianaCoeficiente;
        var anelPearson = document.getElementById('anelPearson');
        var coeficienteSaida = document.getElementById('coeficientePearson');
        var classificacao = document.getElementById('classificacaoPearson');
        var sinalSaida = document.getElementById('sinalPearson');
        var intensidade = valorPearson == null ? 0 : Math.abs(Number(valorPearson));
        var sinal = valorPearson == null || Number(valorPearson) === 0 ? 'neutro' : Number(valorPearson) > 0 ? 'positivo' : 'negativo';
        var faixa = valorPearson == null ? 'sem-dados'
            : intensidade >= 0.7 ? 'forte' : intensidade >= 0.3 ? 'moderada' : intensidade < 0.1 ? 'nula' : 'fraca';
        var rotulosFaixa = { forte: 'Forte', moderada: 'Moderada', fraca: 'Fraca', nula: 'Praticamente nula', 'sem-dados': 'Sem pares suficientes' };
        coeficienteSaida.textContent = valorPearson == null ? '—' : formatarNumero(valorPearson, 3);
        anelPearson.style.setProperty('--pearson-arco', `${intensidade * 360}deg`);
        anelPearson.dataset.sinal = sinal;
        anelPearson.dataset.faixa = faixa;
        anelPearson.setAttribute('aria-label', valorPearson == null
            ? 'Correlação mediana indisponível' : `Correlação mediana ${formatarNumero(valorPearson, 3)}, força ${rotulosFaixa[faixa]}, direção ${sinal}`);
        classificacao.textContent = rotulosFaixa[faixa];
        sinalSaida.textContent = valorPearson == null ? 'Sinal indisponível' : `Sinal ${sinal}`;
        document.getElementById('amostrasPearson').textContent = `${relacoes.length} relações consideradas · alinhamento 1:1, tolerância 30 s`;
        document.getElementById('pearsonPositivas').textContent = distribuicao.positivas || 0;
        document.getElementById('pearsonNegativas').textContent = distribuicao.negativas || 0;
        document.getElementById('pearsonFortes').textContent = distribuicao.fortes || 0;
        document.getElementById('pearsonModeradas').textContent = distribuicao.moderadas || 0;
        document.getElementById('pearsonOutras').textContent = (distribuicao.fracas || 0) + (distribuicao.nulas || 0);
        var listaRelacoes = document.getElementById('listaRelacoesPearson');
        listaRelacoes.replaceChildren();
        relacoes.forEach(function (item) {
            var linha = document.createElement('li');
            linha.textContent = `${item.rotulo}: ${item.coeficiente == null ? 'dados insuficientes' : `r = ${formatarNumero(item.coeficiente, 3)} (${item.sinal}, ${item.intensidade})`} · ${item.amostrasAlinhadas} amostras`;
            listaRelacoes.appendChild(linha);
        });
        var lista = document.getElementById('listaAnomalias');
        var rolagemTabela = document.getElementById('rolagemTabelaAnomalias');
        var avisoVazio = document.getElementById('anomaliasVazio');
        lista.replaceChildren();
        var anomalias = documento.anomalias.eventosIndividuais || [];
        var simultaneas = documento.anomalias.gruposSimultaneos || [];
        avisoVazio.hidden = anomalias.length > 0 || simultaneas.length > 0;
        var semCapturas = (documento.disponibilidade || []).every(function (item) { return item.semDados; });
        avisoVazio.textContent = anomalias.length || simultaneas.length ? '' : semCapturas
            ? 'Não há capturas dos servidores selecionados no intervalo.'
            : 'Nenhuma anomalia estatística encontrada no intervalo.';
        // (Cláudia - M) Mantém eventos individuais e grupos simultâneos em linhas distintas, ordenados pelo horário real.
        var registrosAnomalia = anomalias.map(function (evento) {
            return { tipo: 'individual', timestamp: evento.timestamp, evento: evento };
        }).concat(simultaneas.map(function (grupo) {
            return { tipo: 'grupo', timestamp: grupo.timestamp, grupo: grupo };
        })).sort(function (a, b) {
            return Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.tipo.localeCompare(b.tipo);
        });
        registrosAnomalia.forEach(function (registro) {
            var linha = document.createElement('tr');
            var evento = registro.tipo === 'individual' ? registro.evento : (registro.grupo.membros || [])[0];
            if (!evento) return;
            var horario = new Date(registro.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            var servidor = document.createElement('td');
            var metrica = document.createElement('td');
            var valor = document.createElement('td');
            var zScore = document.createElement('td');
            var marcadorSeveridade = document.createElement('span');
            var acao = document.createElement('button');
            acao.type = 'button';
            acao.className = 'investigacao-anomalia__selecionar';
            acao.textContent = horario;
            acao.setAttribute('aria-label', `Destacar ${registro.tipo === 'grupo' ? 'grupo simultâneo' : 'evento'} de ${horario}`);
            linha.appendChild(document.createElement('td')).appendChild(acao);
            if (registro.tipo === 'grupo') {
                var grupo = registro.grupo;
                servidor.textContent = Array.from(new Set(grupo.servidores || [])).join(', ');
                servidor.title = `Grupo simultâneo em ${grupo.quantidadeServidores} servidores`;
                metrica.textContent = grupo.metrica.toUpperCase();
                valor.textContent = `${grupo.quantidadeServidores} servidores`;
                zScore.textContent = formatarNumero(grupo.maiorZ, 2);
                linha.dataset.evento = JSON.stringify({ idServidor: evento.idServidor, timestamp: evento.timestamp, metrica: evento.metrica });
                var etiquetaSimultanea = document.createElement('small');
                etiquetaSimultanea.className = 'investigacao-evento__simultaneo';
                etiquetaSimultanea.textContent = 'Grupo simultâneo';
                servidor.appendChild(etiquetaSimultanea);
                marcadorSeveridade.className = 'investigacao-severidade investigacao-severidade--grupo';
                marcadorSeveridade.setAttribute('aria-label', 'Agrupamento temporal, não classificação operacional');
                marcadorSeveridade.title = 'Agrupamento temporal, não classificação operacional';
                valor.appendChild(marcadorSeveridade);
                linha.dataset.tipoRegistro = 'grupo';
            } else {
                servidor.textContent = evento.nomeServidor;
                servidor.title = evento.nomeServidor;
                metrica.textContent = evento.metrica.toUpperCase();
                zScore.textContent = formatarNumero(evento.zScore, 2);
                linha.dataset.evento = JSON.stringify({ idServidor: evento.idServidor, timestamp: evento.timestamp, metrica: evento.metrica });
                var estadoSeveridade = obterSeveridadeOperacional(documento, evento);
                var descricoesSeveridade = {
                    'sem-limite': 'Sem limite operacional configurado',
                    normal: 'Abaixo dos limites operacionais',
                    atencao: 'Acima do limite de atenção',
                    critico: 'No limite crítico ou acima dele'
                };
                marcadorSeveridade.className = `investigacao-severidade investigacao-severidade--${estadoSeveridade}`;
                marcadorSeveridade.setAttribute('aria-label', descricoesSeveridade[estadoSeveridade]);
                marcadorSeveridade.title = descricoesSeveridade[estadoSeveridade];
                valor.appendChild(document.createTextNode(formatarNumero(evento.valor)));
                valor.appendChild(marcadorSeveridade);
                linha.dataset.severidade = estadoSeveridade;
                linha.dataset.tipoRegistro = 'individual';
            }
            linha.append(servidor, metrica, valor, zScore);
            linha.classList.toggle('selecionada', Boolean(eventoTemporalSelecionado && linha.dataset.evento
                && linha.dataset.evento === JSON.stringify(eventoTemporalSelecionado)));
            lista.appendChild(linha);
        });
        rolagemTabela.hidden = registrosAnomalia.length === 0;
        var resumoServidores = document.getElementById('resumoAnomaliasServidor');
        if (resumoServidores) {
            var contagens = documento.anomalias.contagemPorServidor || [];
            var servidoresComEventos = contagens.filter(function (item) { return item.quantidade > 0; });
            resumoServidores.textContent = servidoresComEventos.length
                ? `Mais eventos: ${servidoresComEventos.slice(0, 3).map(function (item) { return `${item.nomeServidor} (${item.quantidade})`; }).join(' · ')}`
                : 'Nenhuma anomalia no período.';
            resumoServidores.title = contagens.map(function (item) { return `${item.nomeServidor}: ${item.quantidade}`; }).join('\n');
        }
        var tituloAnomalias = document.getElementById('tituloGraficoAnomalias');
        if (tituloAnomalias) {
            var serie = (documento.anomalias.serie || [])[0];
            var selecaoAtual = obterSelecionados();
            tituloAnomalias.textContent = selecaoAtual.length > 1
                ? `Média temporal do conjunto · ${selecaoAtual.length} servidores`
                : `Série temporal · ${serie && serie.nomeServidor ? serie.nomeServidor : 'servidor selecionado'}`;
        }
        document.getElementById('kpiAnomalias').textContent = String(documento.kpis.anomalias.individuais);
        document.getElementById('descricaoAnomalias').textContent = `${documento.kpis.anomalias.simultaneas} grupos simultâneos · conjunto selecionado`;
        var cobertura = documento.kpis.cobertura;
        document.getElementById('kpiCobertura').textContent = cobertura.percentual == null ? '—' : `${formatarNumero(cobertura.percentual, 1)}%`;
        var cardCobertura = document.getElementById('cardCobertura');
        var estadoCobertura = cobertura.percentual == null ? 'sem-dados'
            : cobertura.percentual >= FAIXAS_COBERTURA.normal ? 'normal'
                : cobertura.percentual >= FAIXAS_COBERTURA.atencao ? 'atencao' : 'critico';
        if (cardCobertura) cardCobertura.dataset.estado = estadoCobertura;
        document.getElementById('descricaoCobertura').textContent = cobertura.capturasEsperadas
            ? `${formatarNumero(cobertura.capturasValidas, 0)} de ${formatarNumero(cobertura.capturasEsperadas, 0)} capturas esperadas`
            : 'Sem janela suficiente para estimar a cobertura';
        var estadoCoberturaLabel = document.getElementById('estadoCoberturaLabel');
        if (estadoCoberturaLabel) estadoCoberturaLabel.textContent = ({ normal: 'Dentro do esperado', atencao: 'Atenção', critico: 'Baixa', 'sem-dados': 'Sem dados' })[estadoCobertura];
        document.getElementById('metricaTempoCritico').textContent = documento.kpis.tempoCritico.metrica.toUpperCase();
        document.getElementById('kpiTempoCritico').textContent = documento.kpis.tempoCritico.segundos == null
            ? '—' : `${formatarNumero(documento.kpis.tempoCritico.segundos / 60, 1)} min-servidor`;
        var textoCritico = document.querySelector('.investigacao-kpi--critico p');
        if (textoCritico) {
            var critico = documento.kpis.tempoCritico;
            textoCritico.textContent = critico.limitesIncompletos
                ? `Soma dos ${critico.limitesDisponiveis}/${critico.servidoresAnalisados} servidores com limite configurado.`
                : critico.limitesDiferentes
                    ? 'Soma por servidor; limites variam e lacunas são excluídas.'
                    : 'Soma por servidor; lacunas de coleta não entram no tempo.';
        }
        var coresMetricas = { cpu: '#00d2df', ram: '#a855f7', disco: '#22d3a6', rede: '#60a5fa' };
        [['legendaMetricaPrimaria', documento.metricas.x], ['legendaMetricaComparada', documento.metricas.y]].forEach(function (par) {
            var rotulo = document.getElementById(par[0]);
            if (!rotulo) return;
            rotulo.textContent = par[1].toUpperCase();
            var marcador = rotulo.parentElement.querySelector('.ponto-legenda');
            if (marcador) marcador.style.backgroundColor = coresMetricas[par[1]] || '#00d2df';
        });
        renderizarResumoRegressao(documento);
        montarGraficoRegressao(documento);
        montarGraficoAnomalias(documento);
        montarGraficoBoxplot(documento);
    }

    // (Cláudia - M) Ao escolher uma linha, destaca no gráfico o ponto médio agregado do mesmo horário, quando ele existe.
    document.getElementById('listaAnomalias').addEventListener('click', function (evento) {
        var linha = evento.target.closest('tr[data-evento]');
        if (!linha || !documentoAnaliseAtual) return;
        try {
            eventoTemporalSelecionado = JSON.parse(linha.dataset.evento);
            document.querySelectorAll('.investigacao-tabela-anomalias tr.selecionada').forEach(function (item) {
                item.classList.remove('selecionada');
            });
            linha.classList.add('selecionada');
            montarGraficoAnomalias(documentoAnaliseAtual);
        } catch (_) {
            eventoTemporalSelecionado = null;
        }
    });

    /* Abre e fecha o menu, mantendo o estado acessível para teclado e leitor de tela. */
    botaoServidores.addEventListener('click', function () {
        var aberto = listaServidores.hidden;
        listaServidores.hidden = !aberto;
        botaoServidores.setAttribute('aria-expanded', String(aberto));
        if (aberto && opcoesServidores) opcoesServidores.scrollTop = 0;
    });

    if (chipsServidores) {
        chipsServidores.addEventListener('click', function (evento) {
            var botaoRemover = evento.target.closest('.investigacao-servidor-chip__remover');
            if (!botaoRemover) return;
            var entrada = Array.from(opcoesServidores.querySelectorAll('input[name="servidores"]'))
                .find(function (item) { return item.value === botaoRemover.dataset.servidorId; });
            if (!entrada) return;
            entrada.checked = false;
            atualizarResumoSelecao(true);
        });
    }

    document.addEventListener('click', function (evento) {
        if (!listaServidores.hidden && !listaServidores.parentElement.contains(evento.target)) {
            listaServidores.hidden = true;
            botaoServidores.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', function (evento) {
        if (evento.key === 'Escape' && !listaServidores.hidden) {
            listaServidores.hidden = true;
            botaoServidores.setAttribute('aria-expanded', 'false');
            botaoServidores.focus();
        }
    });

    if (botaoSelecionarTodos) {
        botaoSelecionarTodos.addEventListener('click', function () {
            opcoesServidores.querySelectorAll('input[name="servidores"]').forEach(function (item) { item.checked = true; });
            atualizarResumoSelecao(true);
        });
    }

    if (botaoLimparSelecao) {
        botaoLimparSelecao.addEventListener('click', function () {
            opcoesServidores.querySelectorAll('input[name="servidores"]').forEach(function (item) { item.checked = false; });
            atualizarResumoSelecao(true);
        });
    }

    if (botaoConcluirSelecao) {
        botaoConcluirSelecao.addEventListener('click', function () {
            listaServidores.hidden = true;
            botaoServidores.setAttribute('aria-expanded', 'false');
            botaoServidores.focus();
        });
    }

    /* Revalida o período quando os campos mudam e atualiza o inventário ao
     * retornar à aba; a consulta periódica também detecta inclusões e remoções.
     */
    dataInicial.addEventListener('change', function () {
        atualizarEstadoAplicacao();
    });
    dataFinal.addEventListener('change', function () {
        atualizarEstadoAplicacao();
    });
    window.addEventListener('focus', atualizarListaServidores);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') atualizarListaServidores();
    });

    /* (Claudia - M): Expõe os limites históricos já carregados para componentes compatíveis da página. */
    window.InfraTechInvestigacaoDatas = {
        configurarLimitesEmpresa: configurarLimitesEmpresa,
        configurarLimitesServidor: configurarLimitesServidor
    };

    iniciarListaServidores();
})();
