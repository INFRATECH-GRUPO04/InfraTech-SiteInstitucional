/* carrega os servidores e o histórico da empresa */
(function () {
    // define as faixas visuais de cobertura
    var FAIXAS_COBERTURA = Object.freeze({ normal: 95, atencao: 80 });
    var filtroPeriodo = document.getElementById('filtroPeriodoHistorico');
    var conteudoInvestigacao = document.getElementById('conteudoInvestigacao');
    var indicadorOrigemGold = document.getElementById('indicadorOrigemGold');
    var dataInicial = document.getElementById('dataInicioHistorico');
    var dataFinal = document.getElementById('dataFimHistorico');
    var botaoAplicarPeriodo = document.getElementById('aplicarPeriodoHistorico');
    // conecta o aviso aos metadados da gold
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
    // guarda o evento selecionado no gráfico
    var eventoTemporalSelecionado = null;

    /* converte datas do histórico para o calendário local, sem criar um limite
     * de dias ou meses que não esteja presente nos metadados recebidos
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

    /* mostra datas no padrão brasileiro, mantendo o valor ISO nos campos e no evento */
    function formatarData(valor) {
        if (!valor) return '—';
        var partes = valor.split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    // mostra a origem informada pelo servidor
    function atualizarIndicadorOrigem(origem, resultado) {
        if (!indicadorOrigemGold) return;
        if (!origem || origem.provedor !== 'Amazon S3' || origem.camada !== 'Gold') {
            indicadorOrigemGold.dataset.estado = 'erro';
            indicadorOrigemGold.textContent = 'Fonte indisponível';
            indicadorOrigemGold.title = 'A API não retornou a identificação da origem consultada.';
            return;
        }

        var objeto = origem.bucket ? `s3://${origem.bucket}/${origem.objetoMetadados}` : origem.objetoMetadados;
        indicadorOrigemGold.dataset.estado = origem.metadadosEncontrados === false ? 'ausente' : 'confirmada';
        if (resultado && Number.isFinite(Number(resultado.particoesLidas))) {
            indicadorOrigemGold.textContent = origem.metadadosEncontrados === false ? 'Fonte indisponível' : 'Fonte conectada';
            indicadorOrigemGold.title = `Metadados consultados em ${objeto}. Partições históricas efetivamente lidas para esta análise: ${resultado.particoesLidas} de ${resultado.particoesListadas}.`;
        } else if (origem.metadadosEncontrados === false) {
            indicadorOrigemGold.textContent = 'Fonte indisponível';
            indicadorOrigemGold.title = `A API consultou ${objeto}, mas o objeto não foi encontrado.`;
        } else {
            indicadorOrigemGold.textContent = 'Fonte conectada';
            indicadorOrigemGold.title = `Metadados históricos recebidos de ${objeto}.`;
        }
    }

    /* habilita o calendário apenas depois que a API de metadados fornecer os
     * limites reais do histórico da empresa
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

    /* registra as datas extremas conhecidas para um servidor elas não indicam
     * que existam capturas em todos os instantes entre esses limites
     */
    function configurarLimitesServidor(idServidor, primeiraCaptura, ultimaCaptura) {
        var id = String(idServidor || '').trim();
        var inicio = normalizarData(primeiraCaptura);
        var fim = normalizarData(ultimaCaptura);
        if (!id || !inicio || !fim || inicio > fim) return false;

        historicoServidores.set(id, { inicio: inicio, fim: fim });
        return true;
    }

    /* retorna os servidores atualmente marcados no filtro, usando os ids vindos
     * do banco em vez de nomes fixos escritos no HTML
     */
    function obterSelecionados() {
        return Array.from(opcoesServidores.querySelectorAll('input[name="servidores"]:checked'))
            .map(function (item) {
                return { id: item.value, nome: item.dataset.nome || item.value };
            });
    }

    /* mantém o contador, a validação de seleção e a persistência local dos ids */
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

    /* cria as opções com o inventário retornado pela empresa autenticada uma
     * nova inclusão aparece desmarcada para não ampliar a análise sem escolha
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

    /* atualiza o inventário a partir do servidor, cuja consulta é limitada à
     * empresa da sessão e inclui os servidores cadastrados desde a última busca
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
                indicadorOrigemGold.textContent = 'Fonte indisponível';
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

    /* usa a empresa já carregada pela sessão se ainda não estiver no navegador,
     * consulta a mesma sessão autenticada validada pelo restante da aplicação
     */
    async function iniciarListaServidores() {
        await atualizarListaServidores();
        temporizadorAtualizacao = window.setInterval(atualizarListaServidores, 30000);
    }

    /* valida datas, seleção de servidores e limites recebidos para só liberar
     * a aplicação de um intervalo possível dentro do histórico da empresa
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

    /* consulta a gold pelo servidor; a empresa vem da sessão e não do navegador */
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
                indicadorOrigemGold.textContent = 'Fonte indisponível';
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

    function formatarNumero(valor, casas) {
        if (valor == null || !Number.isFinite(Number(valor))) return '—';
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas == null ? 2 : casas }).format(Number(valor));
    }

    // converte os dias dos filtros para instantes no fuso usado nos rótulos do histórico
    function converterDataFiltroParaTimestamp(valor, fimDoDia) {
        var correspondencia = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!correspondencia) return null;
        var horario = fimDoDia ? [23, 59, 59, 999] : [0, 0, 0, 0];
        var instanteLocalComoUtc = Date.UTC(
            Number(correspondencia[1]), Number(correspondencia[2]) - 1, Number(correspondencia[3]),
            horario[0], horario[1], horario[2], horario[3]
        );
        var instante = instanteLocalComoUtc;
        var formatador = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        });
        for (var tentativa = 0; tentativa < 2; tentativa += 1) {
            var partes = Object.fromEntries(formatador.formatToParts(new Date(instante))
                .map(function (parte) { return [parte.type, parte.value]; }));
            var milissegundos = new Date(instante).getUTCMilliseconds();
            var horarioRepresentadoComoUtc = Date.UTC(
                Number(partes.year), Number(partes.month) - 1, Number(partes.day),
                Number(partes.hour), Number(partes.minute), Number(partes.second), milissegundos
            );
            instante = instanteLocalComoUtc - (horarioRepresentadoComoUtc - instante);
        }
        return instante;
    }


    function rotuloMetrica(metrica) {
        var unidades = { cpu: 'CPU (%)', ram: 'RAM (%)', disco: 'Disco (%)', rede: 'Rede (Mbps)' };
        return unidades[metrica] || String(metrica || '').toUpperCase();
    }

    // classifica eventos pelos limites do servidor
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
        return ['cpu', 'ram', 'disco'].includes(metrica) ? '%' : 'Mbps';
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
        var telaGrafico = document.getElementById('graficoRegressao');
        telaGrafico.setAttribute('aria-label', relacao && relacao.status === 'ok'
            ? `Dispersão da relação representativa entre ${rotuloMetrica(documento.regressao.metricaX)} e ${rotuloMetrica(documento.regressao.metricaY)}.`
            : 'Não há uma relação representativa com amostras suficientes para regressão.');
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
                backgroundColor: '#b879f5', borderColor: '#b879f5', pointRadius: 2.4, pointHoverRadius: 5
            });
            if (relacao.reta && relacao.reta.length) {
                datasets.push({
                    label: 'Reta de regressão',
                    data: relacao.reta, showLine: true, pointRadius: 0,
                    borderColor: '#16d9e5', borderWidth: 2.25
                });
            }
            if (relacao.maiorDesvio) {
                var ponto = (relacao.pontos || []).find(function (item) {
                    return item.timestamp === relacao.maiorDesvio.timestamp;
                });
                if (ponto) datasets.push({
                    label: 'Maior desvio',
                    data: [{ x: ponto.x, y: ponto.observado }],
                    backgroundColor: '#ffd166', borderColor: '#ffd166', pointRadius: 6, pointStyle: 'triangle'
                });
            }
        var eixoX = documento.regressao.metricaX;
        var eixoY = documento.regressao.metricaY;
        graficosInvestigacao.regressao = new Chart(telaGrafico, {
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
                    x: { type: 'linear', title: { display: true, text: rotuloMetrica(eixoX), color: '#d7e0e8', font: { size: 11, weight: '600' } }, ticks: { color: '#d7e0e8', font: { size: 11 }, maxTicksLimit: 7 }, grid: { color: '#354656' } },
                    y: { title: { display: true, text: rotuloMetrica(eixoY), color: '#d7e0e8', font: { size: 11, weight: '600' } }, ticks: { color: '#d7e0e8', font: { size: 11 }, maxTicksLimit: 7 }, grid: { color: '#354656' } }
                }
            }
        });
        } else {
            datasets = [];
        }
    }


    function renderizarResumoRegressao(documento) {
        var regressao = documento.regressao;
        var relacao = regressao.representativa;
        var resumo = regressao.resumo || {};
        var nomeX = rotuloMetrica(regressao.metricaX);
        var nomeY = rotuloMetrica(regressao.metricaY);
        document.getElementById('descricaoRegressao').textContent = `Relação entre ${nomeX} e ${nomeY}`;
        document.getElementById('tituloGraficoRegressao').textContent = 'Regressão representativa';
        var r2Saida = document.getElementById('r2Regressao');
        var r2Mediana = resumo.medianaR2 == null ? null : Number(resumo.medianaR2);
        r2Saida.textContent = Number.isFinite(r2Mediana) ? `${formatarNumero(r2Mediana * 100, 1)}%` : '—';
        var quantidadeValidas = Number(resumo.quantidadeRelacoesValidas) || 0;
        var crescentes = Number(resumo.inclinacoesPositivas) || 0;
        var decrescentes = Number(resumo.inclinacoesNegativas) || 0;

        // resume a tendência e a variação explicada com os resultados já calculados pelo servidor
        var fraseTendencia;
        if (!quantidadeValidas) {
            fraseTendencia = 'Não há dados suficientes para resumir a tendência entre as métricas.';
        } else if (document.getElementById('classificacaoPearson').textContent === 'Praticamente nula') {
            fraseTendencia = `A relação entre ${nomeX.replace(/\s*\([^)]*\)$/, '')} e ${nomeY.replace(/\s*\([^)]*\)$/, '')} é praticamente nula.`;
        } else if (crescentes > decrescentes) {
            fraseTendencia = `Predominam relações crescentes entre ${nomeX.replace(/\s*\([^)]*\)$/, '')} e ${nomeY.replace(/\s*\([^)]*\)$/, '')}.`;
        } else if (decrescentes > crescentes) {
            fraseTendencia = `Predominam relações decrescentes entre ${nomeX.replace(/\s*\([^)]*\)$/, '')} e ${nomeY.replace(/\s*\([^)]*\)$/, '')}.`;
        } else {
            fraseTendencia = `Não há predominância de tendência entre ${nomeX.replace(/\s*\([^)]*\)$/, '')} e ${nomeY.replace(/\s*\([^)]*\)$/, '')}.`;
        }
        var r2Percentual = Number.isFinite(r2Mediana) ? r2Mediana * 100 : null;
        var r2Arredondado = Number.isFinite(r2Percentual) ? formatarNumero(r2Percentual, 1) : '—';
        var r2ArredondadoParaZero = Number.isFinite(r2Percentual)
            && Math.round(Math.abs(r2Percentual) * 10) === 0;
        var r2VisualmenteZero = r2ArredondadoParaZero && r2Mediana !== 0;
        r2Saida.textContent = Number.isFinite(r2Percentual)
            ? `${r2VisualmenteZero ? '≈ ' : ''}${r2Arredondado}%` : '—';
        var metricaYSimples = nomeY.replace(/\s*\([^)]*\)$/, '');
        var descricaoMetricaY = { cpu: 'na CPU', ram: 'na RAM', disco: 'no disco', rede: 'na rede' }[regressao.metricaY]
            || `em ${metricaYSimples}`;
        var interpretacao;
        if (!quantidadeValidas) {
            interpretacao = 'Não há dados suficientes para resumir a tendência. A variação explicada não está disponível neste período.';
        } else if (r2ArredondadoParaZero) {
            var percentualProximoDeZero = r2VisualmenteZero ? 'aproximadamente 0%' : '0%';
            interpretacao = `Os modelos lineares explicam ${percentualProximoDeZero} da variação observada ${descricaoMetricaY}. Recomenda-se investigar outros fatores associados ao seu comportamento.`;
        } else if (!Number.isFinite(r2Percentual)) {
            interpretacao = `${fraseTendencia} A variação explicada não está disponível neste período.`;
        } else {
            var percentualInterpretacao = formatarNumero(r2Percentual, 1);
            interpretacao = `${fraseTendencia} A mediana do R² indica que os modelos explicam ${percentualInterpretacao}% da variação observada ${descricaoMetricaY}.`;
        }
        document.getElementById('interpretacaoRegressao').textContent = interpretacao;

        var detalheTecnico;
        if (relacao && relacao.status === 'ok') {
            var equacao = `y = ${formatarNumero(relacao.angular, 4)}x ${relacao.intercepto < 0 ? '−' : '+'} ${formatarNumero(Math.abs(relacao.intercepto), 4)}`;
            detalheTecnico = `Relação representativa: ${relacao.rotulo || `${relacao.nomeOrigem} → ${relacao.nomeDestino}`}. Critério: R² mais próximo da mediana do conjunto; desempate por quantidade de amostras e IDs. X: ${nomeX}; Y: ${nomeY}. Inclinação: ${formatarNumero(relacao.angular, 4)}; intercepto: ${formatarNumero(relacao.intercepto, 4)}; equação: ${equacao}; R² desta relação: ${formatarNumero(Number(relacao.r2) * 100, 1)}%; amostras: ${formatarNumero(relacao.quantidade, 0)}. A reta representa somente este par, não um ajuste conjunto nem causalidade.`;
        } else {
            detalheTecnico = 'Não há uma relação representativa com amostras suficientes para ajustar uma reta.';
        }
        document.getElementById('graficoRegressao').title = `${detalheTecnico} Relações válidas: ${quantidadeValidas}; tendências crescentes: ${crescentes}; decrescentes: ${decrescentes}.`;
        var maiorDesvio = documento.kpis.maiorDesvioRegressao;
        var unidade = unidadeDesvio(regressao.metricaY);
        document.getElementById('kpiMaiorDesvio').textContent = maiorDesvio ? `${formatarNumero(maiorDesvio.valor)}${unidade === '%' ? '' : ' '}${unidade}` : '—';
        document.getElementById('escopoMaiorDesvio').textContent = maiorDesvio ? maiorDesvio.relacao : 'Sem regressão válida';
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
        var inicioEixoX = converterDataFiltroParaTimestamp(dataInicial.value, false);
        var fimEixoX = converterDataFiltroParaTimestamp(dataFinal.value, true);
        var timestampsCaptura = seriesAgregadas.flatMap(function (serie) {
            return (serie.pontos || []).map(function (ponto) { return Date.parse(ponto.timestamp); })
                .filter(Number.isFinite);
        });
        if (!Number.isFinite(inicioEixoX) && timestampsCaptura.length) inicioEixoX = Math.min.apply(null, timestampsCaptura);
        if (!Number.isFinite(fimEixoX) && timestampsCaptura.length) fimEixoX = Math.max.apply(null, timestampsCaptura);
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
                    { x: Number.isFinite(inicioEixoX) ? inicioEixoX : Date.parse(serieCoorte.pontos[0].timestamp), y: limiteCoorte },
                    { x: Number.isFinite(fimEixoX) ? fimEixoX : Date.parse(serieCoorte.pontos[serieCoorte.pontos.length - 1].timestamp), y: limiteCoorte }
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
                    idServidor: evento.idServidor, metrica: evento.metrica,
                    selecionado: Boolean(selecionado), serieAgregada: true
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
                        valorIndividual: evento.valor, zScore: evento.zScore, idServidor: evento.idServidor,
                        metrica: evento.metrica, timestamp: evento.timestamp, simultaneo: true
                    } : null;
                }).filter(Boolean),
                showLine: false, backgroundColor: '#a855f7', borderColor: '#f5f7fa',
                pointRadius: 6, pointStyle: 'rectRot', yAxisID: chaveEixo
            });
        });
        var escalaTemporal = {
            type: 'linear', bounds: 'data',
            ticks: { color: '#d7e0e8', font: { size: 12 }, maxTicksLimit: 5, maxRotation: 0, autoSkip: true, includeBounds: true, callback: function (valor) {
                return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(valor));
            } }, grid: { color: '#354656' }
        };
        if (Number.isFinite(inicioEixoX) && Number.isFinite(fimEixoX) && fimEixoX > inicioEixoX) {
            escalaTemporal.min = inicioEixoX;
            escalaTemporal.max = fimEixoX;
        }
        var escalas = {
            x: escalaTemporal,
            y: { position: 'left', title: { display: true, text: rotuloMetrica(eixoX), color: '#d7e0e8', font: { size: 12, weight: '600' } }, ticks: { color: '#d7e0e8', font: { size: 12 } }, grid: { color: '#354656' } }
        };
        if (eixoX !== eixoY) escalas.y1 = { position: 'right', title: { display: true, text: rotuloMetrica(eixoY), color: '#d7e0e8', font: { size: 12, weight: '600' } }, ticks: { color: '#d7e0e8', font: { size: 12 } }, grid: { drawOnChartArea: false } };
        // marca o horário selecionado no gráfico
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
                        if (!ponto.nomeServidor) return `${contexto.dataset.label}: ${formatarNumero(contexto.parsed.y)}`;
                        var severidade = obterSeveridadeOperacional(documento, {
                            idServidor: ponto.idServidor, metrica: ponto.metrica, valor: ponto.valorIndividual
                        });
                        var rotulosSeveridade = {
                            'sem-limite': 'sem limite operacional', normal: 'abaixo dos limites',
                            atencao: 'atenção', critico: 'crítico'
                        };
                        return [
                            `Média do conjunto: ${formatarNumero(contexto.parsed.y)}`,
                            `${ponto.nomeServidor}: ${formatarNumero(ponto.valorIndividual)} · Z-score ${formatarNumero(ponto.zScore)}`,
                            `Limite operacional: ${rotulosSeveridade[severidade]}`,
                            ponto.simultaneo ? 'Evento em grupo simultâneo' : 'Anomalia individual'
                        ];
                    }
                } } }, scales: escalas }
        });
    }

    // mostra os quartis e os detalhes por servidor
    function montarGraficoBoxplot(documento) {
        if (!window.Chart) return;
        destruirGrafico('boxplot');
        var itens = (documento.boxplot.porServidor || []).slice()
            .sort(function (a, b) { return Number(a.idServidor) - Number(b.idServidor); });
        var nomes = itens.map(function (item) { return item.nomeServidor; });
        var nomesEixo = nomes.length > 0 && nomes.length <= 3 ? [' ', ...nomes, ' '] : nomes;
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
        // resume a mediana, o IQR e os valores atípicos
        var validos = itens.filter(function (item) {
            return item.status === 'ok' && Number.isFinite(item.mediana) && Number.isFinite(item.iqr);
        });
        var interpretacaoBoxplot = document.getElementById('interpretacaoBoxplot');
        if (!validos.length) {
            interpretacaoBoxplot.textContent = `Não há dados suficientes para resumir a distribuição de ${nomeMetrica}.`;
        } else {
            var maiorIqr = Math.max.apply(null, validos.map(function (item) { return item.iqr; }));
            var maiorMediana = Math.max.apply(null, validos.map(function (item) { return item.mediana; }));
            var nomesIqr = validos.filter(function (item) { return item.iqr === maiorIqr; }).map(function (item) { return item.nomeServidor; });
            var nomesMediana = validos.filter(function (item) { return item.mediana === maiorMediana; }).map(function (item) { return item.nomeServidor; });
            var fraseBoxplot = validos.length === 1
                ? `${validos[0].nomeServidor}: mediana de ${formatarNumero(maiorMediana)}${unidade} e IQR de ${formatarNumero(maiorIqr)}${unidade} em ${nomeMetrica}.`
                : `${nomesIqr.length > 1 ? 'Empate na maior variabilidade central' : 'Maior variabilidade central'}: ${nomesIqr.join(', ')}; ${nomesMediana.length > 1 ? 'empate na maior mediana' : 'maior mediana'}: ${nomesMediana.join(', ')}.`;
            var dadosOutliers = validos.filter(function (item) { return Number.isFinite(item.outliersTotal); });
            var fraseOutliers = dadosOutliers.some(function (item) { return item.outliersTotal > 0; })
                ? `Há valores atípicos de ${nomeMetrica}.`
                : dadosOutliers.length === itens.length ? `Não há valores atípicos de ${nomeMetrica}.` : '';
            interpretacaoBoxplot.textContent = `${fraseBoxplot}${fraseOutliers ? ` ${fraseOutliers}` : ''}`;
        }
        var pluginBoxplot = {
            id: 'infratechBoxplot',
            afterDatasetsDraw: function (grafico, args, opcoes) {
                var ctx = grafico.ctx, escalaX = grafico.scales.x, escalaY = grafico.scales.y;
                var alturaCategoria = escalaY.height / Math.max(1, (opcoes.itens || []).length);
                var alturaCaixa = Math.min(32, Math.max(16, alturaCategoria * 0.76));
                var corCaixa = '#00CFFF';
                ctx.save();
                (opcoes.itens || []).forEach(function (item) {
                    if (item.status !== 'ok') return;
                    var y = escalaY.getPixelForValue(item.nomeServidor);
                    var xMin = escalaX.getPixelForValue(item.bigodeInferior);
                    var xQ1 = escalaX.getPixelForValue(item.q1);
                    var xMediana = escalaX.getPixelForValue(item.mediana);
                    var xQ3 = escalaX.getPixelForValue(item.q3);
                    var xMax = escalaX.getPixelForValue(item.bigodeSuperior);
                    ctx.strokeStyle = corCaixa; ctx.fillStyle = 'rgba(0, 207, 255, 0.24)'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(xMin, y); ctx.lineTo(xMax, y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(xMin, y - alturaCaixa / 2); ctx.lineTo(xMin, y + alturaCaixa / 2); ctx.moveTo(xMax, y - alturaCaixa / 2); ctx.lineTo(xMax, y + alturaCaixa / 2); ctx.stroke();
                    ctx.fillRect(xQ1, y - alturaCaixa / 2, Math.max(1, xQ3 - xQ1), alturaCaixa);
                    ctx.strokeRect(xQ1, y - alturaCaixa / 2, Math.max(1, xQ3 - xQ1), alturaCaixa);
                    ctx.strokeStyle = '#EAFBFF'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(xMediana, y - alturaCaixa / 2); ctx.lineTo(xMediana, y + alturaCaixa / 2); ctx.stroke();
                    ctx.fillStyle = '#00CFFF';
                    (item.outliers || []).forEach(function (valor) {
                        ctx.beginPath(); ctx.arc(escalaX.getPixelForValue(valor), y, 3.5, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = '#EAFBFF'; ctx.lineWidth = 1; ctx.stroke();
                    });
                });
                ctx.restore();
            }
        };
        graficosInvestigacao.boxplot = new Chart(document.getElementById('graficoBoxplot'), {
            type: 'scatter', data: { datasets: [{ data: pontosTooltip, pointRadius: 0, pointHitRadius: 12, pointHoverRadius: 0 }] }, plugins: [pluginBoxplot],
            options: { responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 7, bottom: 18 } },
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
                    x: { type: 'linear', min: minimo, max: maximo, title: { display: true, text: rotuloMetrica(metrica) }, ticks: { color: '#c3d0da', padding: 8, maxTicksLimit: 7, callback: function (valor) { return `${formatarNumero(valor)}${unidade}`; } }, grid: { color: '#293746' } },
                    y: { type: 'category', labels: nomesEixo, reverse: false, ticks: { color: '#e0e8ee', font: { size: 11, weight: '600' }, padding: 9 }, grid: { display: false } }
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
        var medianaPearson = document.getElementById('medianaPearson');
        var coeficienteSaida = document.getElementById('coeficientePearson');
        var classificacao = document.getElementById('classificacaoPearson');
        // identifica as métricas dos filtros no resumo visual de pearson
        var metricasCurtas = { cpu: 'CPU', ram: 'RAM', disco: 'Disco', rede: 'Rede' };
        var metricaX = documento.metricas && documento.metricas.x;
        var metricaY = documento.metricas && documento.metricas.y;
        var nomeMetricaCurta = function (metrica) { return metricasCurtas[metrica] || (metrica ? String(metrica).toUpperCase() : 'métrica'); };
        document.getElementById('descricaoPearson').textContent = `Relação entre ${nomeMetricaCurta(metricaX)} e ${nomeMetricaCurta(metricaY)}`;
        var intensidade = valorPearson == null ? 0 : Math.abs(Number(valorPearson));
        var sinal = valorPearson == null || Number(valorPearson) === 0 ? 'neutro' : Number(valorPearson) > 0 ? 'positivo' : 'negativo';
        var faixa = valorPearson == null ? 'sem-dados'
            : intensidade >= 0.7 ? 'forte' : intensidade >= 0.3 ? 'moderada' : intensidade < 0.1 ? 'nula' : 'fraca';
        var rotulosFaixa = { forte: 'Forte', moderada: 'Moderada', fraca: 'Fraca', nula: 'Praticamente nula', 'sem-dados': 'Dados insuficientes' };
        coeficienteSaida.textContent = valorPearson == null ? 'N/D' : formatarNumero(valorPearson, 3);
        anelPearson.style.setProperty('--pearson-arco', `${intensidade * 360}deg`);
        anelPearson.dataset.faixa = faixa;
        anelPearson.dataset.sinal = sinal;
        medianaPearson.dataset.faixa = faixa;
        anelPearson.setAttribute('aria-label', valorPearson == null
            ? 'Correlação mediana: dados insuficientes' : `Correlação mediana ${formatarNumero(valorPearson, 3)}, força ${rotulosFaixa[faixa]}, direção ${sinal}`);
        classificacao.textContent = rotulosFaixa[faixa];
        var totalRelacoes = relacoes.length;
        // mostra as contagens por intensidade
        var contagensForca = {
            fracasNulas: Number(distribuicao.fracas || 0) + Number(distribuicao.nulas || 0),
            moderadas: Number(distribuicao.moderadas || 0),
            fortes: Number(distribuicao.fortes || 0)
        };
        var totalClassificadas = contagensForca.fracasNulas + contagensForca.moderadas + contagensForca.fortes;
        document.getElementById('amostrasPearson').textContent = `${totalRelacoes} relações analisadas`;
        document.getElementById('pearsonPositivas').textContent = distribuicao.positivas || 0;
        document.getElementById('pearsonNegativas').textContent = distribuicao.negativas || 0;
        document.getElementById('pearsonFortes').textContent = contagensForca.fortes;
        document.getElementById('pearsonModeradas').textContent = contagensForca.moderadas;
        document.getElementById('pearsonOutras').textContent = contagensForca.fracasNulas;
        [
            ['pearsonBarOutras', contagensForca.fracasNulas],
            ['pearsonBarModeradas', contagensForca.moderadas],
            ['pearsonBarFortes', contagensForca.fortes]
        ].forEach(function (barra) {
            var elemento = document.getElementById(barra[0]);
            var proporcao = totalClassificadas > 0 ? (barra[1] / totalClassificadas) * 100 : 0;
            elemento.style.width = `${proporcao}%`;
        });
        var interpretacaoPearson = document.getElementById('interpretacaoPearson');
        var maioresContagens = [
            { nome: 'fracas ou nulas', quantidade: contagensForca.fracasNulas },
            { nome: 'moderadas', quantidade: contagensForca.moderadas },
            { nome: 'fortes', quantidade: contagensForca.fortes }
        ].sort(function (a, b) { return b.quantidade - a.quantidade; });
        var textoForca = !totalClassificadas
            ? 'Não há relações válidas suficientes para resumir a intensidade.'
            : maioresContagens[0].quantidade === maioresContagens[1].quantidade
                ? `As intensidades se distribuem sem predominância entre ${nomeMetricaCurta(metricaX)} e ${nomeMetricaCurta(metricaY)}.`
                : `Predominam relações ${maioresContagens[0].nome} entre ${nomeMetricaCurta(metricaX)} e ${nomeMetricaCurta(metricaY)}.`;
        interpretacaoPearson.textContent = textoForca;
        document.querySelector('.investigacao-pearson__segmentos').setAttribute('aria-label',
            `${totalClassificadas} relações válidas: ${contagensForca.fracasNulas} fracas ou nulas, ${contagensForca.moderadas} moderadas e ${contagensForca.fortes} fortes.`);
        var lista = document.getElementById('listaAnomalias');
        var rolagemTabela = document.getElementById('rolagemTabelaAnomalias');
        var detalhesEventos = document.getElementById('detalhesEventosAnomalia');
        var avisoVazio = document.getElementById('anomaliasVazio');
        lista.replaceChildren();
        var anomalias = documento.anomalias.eventosIndividuais || [];
        var simultaneas = documento.anomalias.gruposSimultaneos || [];
        avisoVazio.hidden = anomalias.length > 0 || simultaneas.length > 0;
        var semCapturas = (documento.disponibilidade || []).every(function (item) { return item.semDados; });
        avisoVazio.textContent = anomalias.length || simultaneas.length ? '' : semCapturas
            ? 'Não há capturas dos servidores selecionados no intervalo.'
            : 'Nenhuma anomalia estatística encontrada no intervalo.';
        // ordena os eventos individuais e simultâneos
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
        detalhesEventos.hidden = registrosAnomalia.length === 0;
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
        var tempoCritico = documento.kpis.tempoCritico;
        var servidoresDisponibilidade = documento.disponibilidade || [];
        var dadosDisponiveis = Number(cobertura.capturasValidas) > 0
            && servidoresDisponibilidade.length > 0
            && servidoresDisponibilidade.every(function (servidor) { return !servidor.semDados; });
        var limitesCompletos = Number(tempoCritico.servidoresAnalisados) > 0
            && Number(tempoCritico.limitesDisponiveis) === Number(tempoCritico.servidoresAnalisados)
            && !tempoCritico.limitesIncompletos;
        var duracaoCritica = tempoCritico.segundos == null ? null : Number(tempoCritico.segundos);
        var estadoTempoCritico = duracaoCritica > 0 ? 'critico'
            : duracaoCritica === 0 && dadosDisponiveis && limitesCompletos ? 'normal' : 'atencao';
        var cardTempoCritico = document.querySelector('.investigacao-kpi--critico');
        if (cardTempoCritico) cardTempoCritico.dataset.estado = estadoTempoCritico;
        document.getElementById('metricaTempoCritico').textContent = tempoCritico.metrica.toUpperCase();
        document.getElementById('kpiTempoCritico').textContent = tempoCritico.segundos == null
            ? '—' : `${formatarNumero(documento.kpis.tempoCritico.segundos / 60, 1)} min-servidor`;
        var textoCritico = document.querySelector('.investigacao-kpi--critico p');
        if (textoCritico) {
            var critico = tempoCritico;
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

    // destaca o horário do evento selecionado
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

    /* abre e fecha o menu, mantendo o estado acessível para teclado e leitor de tela */
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

    /* revalida o período quando os campos mudam e atualiza o inventário ao
     * retornar à aba; a consulta periódica também detecta inclusões e remoções
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

    /* expõe os limites históricos já carregados para componentes compatíveis da página */
    window.InfraTechInvestigacaoDatas = {
        configurarLimitesEmpresa: configurarLimitesEmpresa,
        configurarLimitesServidor: configurarLimitesServidor
    };

    iniciarListaServidores();
})();
