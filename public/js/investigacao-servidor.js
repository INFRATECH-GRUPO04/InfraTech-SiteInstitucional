/* Conecta o seletor à lista autenticada de servidores da empresa e prepara o
 * intervalo histórico para receber metadados da camada Silver.
 */
(function () {
    var filtroPeriodo = document.getElementById('filtroPeriodoHistorico');
    var dataInicial = document.getElementById('dataInicioHistorico');
    var dataFinal = document.getElementById('dataFimHistorico');
    var botaoAplicarPeriodo = document.getElementById('aplicarPeriodoHistorico');
    var estadoPeriodo = document.getElementById('estadoHistoricoSilver');
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

    if (!filtroPeriodo || !dataInicial || !dataFinal || !botaoAplicarPeriodo || !estadoPeriodo
        || !botaoServidores || !listaServidores || !opcoesServidores) return;

    var limitesEmpresa = null;
    var historicoServidores = new Map();
    var servidoresEmpresa = [];
    var idEmpresaAtual = null;
    var primeiraListaCarregada = false;
    var chaveSelecaoServidores = '';
    var temporizadorAtualizacao = null;

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
                id: String(servidor.id_servidor || servidor.idServidor || ''),
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
        if (!idEmpresaAtual || document.visibilityState === 'hidden') return;

        try {
            var resposta = await fetch(`/servidor/listar/${encodeURIComponent(idEmpresaAtual)}`, {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            if (resposta.status === 204) {
                renderizarServidores([]);
                if (estadoListaServidores) estadoListaServidores.textContent = 'Sua empresa ainda não possui servidores cadastrados.';
                return;
            }
            if (!resposta.ok) {
                var mensagem = resposta.status === 401
                    ? 'Sua sessão expirou. Entre novamente para carregar os servidores.'
                    : resposta.status === 403
                        ? 'Sua conta não tem permissão para consultar os servidores desta empresa.'
                        : resposta.status === 404
                            ? 'A API de servidores não foi encontrada. Reinicie o servidor da aplicação e atualize esta página.'
                            : `A API de servidores respondeu com erro (${resposta.status}).`;
                throw new Error(mensagem);
            }

            var tipoResposta = resposta.headers.get('content-type') || '';
            if (!tipoResposta.includes('application/json')) {
                throw new Error('A API não retornou a lista de servidores. Reinicie o servidor da aplicação e atualize esta página.');
            }

            var servidores = await resposta.json();
            renderizarServidores(Array.isArray(servidores) ? servidores : []);
        } catch (erro) {
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
        var usuario = typeof window.carregarSessaoConfiavel === 'function'
            ? await window.carregarSessaoConfiavel()
            : null;
        var empresa = Number(usuario && (usuario.idEmpresa || usuario.fkEmpresa));
        if (!Number.isInteger(empresa) || empresa <= 0) {
            empresa = Number(sessionStorage.ID_EMPRESA);
        }
        if (!Number.isInteger(empresa) || empresa <= 0) {
            if (estadoListaServidores) estadoListaServidores.textContent = 'Não foi possível identificar a empresa da sessão.';
            return;
        }

        idEmpresaAtual = empresa;
        chaveSelecaoServidores = `infratech.investigacao.servidores.${empresa}`;
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

    /* Comunica a seleção de datas, servidores e métricas à camada de análise
     * sem presumir uma rota ou o formato dos arquivos Silver.
     */
    botaoAplicarPeriodo.addEventListener('click', function () {
        atualizarEstadoAplicacao();
        if (botaoAplicarPeriodo.disabled) return;

        var periodo = {
            inicio: dataInicial.value,
            fim: dataFinal.value,
            servidores: obterSelecionados(),
            metricaPrimaria: document.getElementById('metricaPrimaria')?.value || null,
            metricaComparada: document.getElementById('metricaComparada')?.value || null
        };

        document.dispatchEvent(new CustomEvent('infratech:periodo-investigacao-selecionado', { detail: periodo }));
        filtroPeriodo.dataset.estadoHistorico = 'periodo-selecionado';
        estadoPeriodo.textContent = `Intervalo selecionado: ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}. Pronto para consultar as capturas disponíveis.`;
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

    /* Expõe funções para a futura integração real dos metadados históricos. */
    window.InfraTechInvestigacaoDatas = {
        configurarLimitesEmpresa: configurarLimitesEmpresa,
        configurarLimitesServidor: configurarLimitesServidor
    };

    iniciarListaServidores();
})();
