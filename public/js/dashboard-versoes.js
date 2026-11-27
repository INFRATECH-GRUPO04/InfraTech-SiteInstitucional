document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#6b8196';

    const COR_V1 = '#4da6ff';
    const COR_V2 = '#a78bfa';
    const COR_CRITICO = '#f06565';

    // Estado inicial da tela
    let listaServidoresTeste = [];
    let servidorV1 = null;
    let servidorV2 = null;
    let recursoAtual = 'DISCO';

    // configuração das abas dos componentes do gráfico de recursos:

    const configRecursos = {
        DISCO: {
            chaveJson: 'disco_mb',
            subtitulo: 'Espaço utilizado em disco',
            unidadeEixo: 'USO DE DISCO (MB)',
            unidadeCurta: 'MB',
            casasLimite: 0
        },
        CPU: {
            chaveJson: 'cpu_pct',
            subtitulo: 'Uso de processamento',
            unidadeEixo: 'USO DE CPU (%)',
            unidadeCurta: '%',
            casasLimite: 0
        },
        RAM: {
            chaveJson: 'ram_gb',
            subtitulo: 'Uso de memória',
            unidadeEixo: 'MEMÓRIA ALOCADA (GB)',
            unidadeCurta: 'GB',
            casasLimite: 1
        },
        REDE: {
            chaveJson: 'rede_mbps',
            subtitulo: 'Tráfego de rede',
            unidadeEixo: 'TRÁFEGO DE REDE (MBPS)',
            unidadeCurta: 'Mbps',
            casasLimite: 1
        }
    };

    // Fallbacks caso algum servidor de teste ainda não possua limite cadastrado no banco
    const limitesRadarPadrao = {
        RAM: { atencao_pct: 70, critico_pct: 85 },
        CPU: { atencao_pct: 70, critico_pct: 80 },
        Disco: { atencao_pct: 70, critico_pct: 90 },
        Rede: { atencao_pct: 70, critico_pct: 90 },
        'Eficiência térmica': { saudavel_pct: 80, alerta_pct: 60 }
    };

    //lê o limite do componente selecionado no gráfico de recursos:
    function obterLimiteConsumoV2(v2, recurso) {
        if (!v2 || !v2.limites || !v2.limites.consumo) return null;
        const valor = v2.limites.consumo[recurso];
        return valor !== null && valor !== undefined && !Number.isNaN(Number(valor))
            ? Number(valor)
            : null;
    }

    // funções de formatação e cálculos:
    function formatarNumero(valor, casasDecimais = 1) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '--';
        return Number(valor).toLocaleString('pt-BR', {
            minimumFractionDigits: casasDecimais,
            maximumFractionDigits: casasDecimais
        });
    }

    //Formata o número do limite para o rótulo da linha tracejada de limite
    function formatarLimiteCurto(valor, casasMax = 1) {
        const num = Number(valor);
        if (Number.isInteger(num)) return formatarNumero(num, 0);
        return formatarNumero(num, casasMax);
    }

    //Formata diferenças numéricas:
    function formatarSinal(valor, casasDecimais = 1) {
        const num = Number(valor) || 0;
        const prefixo = num > 0 ? '+' : '';
        return prefixo + formatarNumero(num, casasDecimais);
    }

    //Calcula a variação percentual entre V1 e V2, evitando divisão por zero
    function calcularVariacaoPct(v1, v2) {
        if (!v1 || Math.abs(v1) < 0.0001) return null;
        return ((v2 - v1) / Math.abs(v1)) * 100;
    }

    function classificarDivergencia(v1, v2, { pisoValorMax, pisoDiffAbs, limAlinhadoPct, limDivergentePct, limAlinhadoAbs = Infinity, limDivergenteAbs = Infinity }) {
        const diffAbs = Math.abs(v2 - v1);
        const maiorValor = Math.max(Math.abs(v1), Math.abs(v2));

        if (maiorValor < pisoValorMax || diffAbs < pisoDiffAbs) {
            return { classe: 'status-estavel', texto: '● ALINHADO' };
        }

        const varPct = calcularVariacaoPct(v1, v2);
        const pctAbs = varPct !== null ? Math.abs(varPct) : 100;

        if (pctAbs <= limAlinhadoPct && diffAbs <= limAlinhadoAbs) {
            return { classe: 'status-estavel', texto: '● ALINHADO' };
        }
        if (pctAbs <= limDivergentePct && diffAbs <= limDivergenteAbs) {
            return { classe: 'status-alerta', texto: '● DIVERGENTE' };
        }
        return { classe: 'status-critico', texto: '● ALTA DIVERGÊNCIA' };
    }

    //muda a cor conforme o estado da kpi
    function aplicarEstadoBadge(badgeId, textoId, valorId, metricaId, estado) {
        const badge = document.getElementById(badgeId);
        const texto = document.getElementById(textoId);
        const valor = document.getElementById(valorId);
        const metrica = document.getElementById(metricaId);

        if (badge) {
            badge.classList.remove('status-estavel', 'status-alerta', 'status-critico');
            badge.classList.add(estado.classe);
        }
        if (texto) {
            texto.textContent = estado.texto;
        }
        [valor, metrica].forEach((el) => {
            if (!el) return;
            el.classList.remove('status-estavel', 'status-alerta', 'status-critico');
            if (estado.classe === 'status-alerta') el.classList.add('status-alerta');
            if (estado.classe === 'status-estavel') el.classList.add('status-estavel');
        });
    }

    //Calcula dinamicamente o teto (maxY) e o intervalo (stepY)
    //  do eixo Y do gráfico de consumo para acomodar todos os dados no bloco do gráfico
    function calcularEscalaDinamica(valoresV1, valoresV2, limiteOpcional, ehPercentual = false) {
        const todos = [...valoresV1, ...valoresV2].filter((v) => v !== null && v !== undefined);
        if (limiteOpcional !== null && limiteOpcional !== undefined) {
            todos.push(limiteOpcional);
        }
        const maior = todos.length ? Math.max(...todos) : 100;

        if (ehPercentual && maior <= 100) {
            return { maxY: 100, stepY: 25 };
        }

        const alvo = Math.max(maior * 1.15, 1);
        const ordem = Math.pow(10, Math.floor(Math.log10(alvo)));
        const passoBase = alvo / ordem <= 2 ? ordem / 5 : (alvo / ordem <= 5 ? ordem / 2 : ordem);
        const maxY = Math.ceil(alvo / passoBase) * passoBase;
        const stepY = +(maxY / 4).toFixed(2);

        return { maxY, stepY };
    }

    // gráficos:

    const ctxConsumo = document.getElementById('graficoConsumoRecursos').getContext('2d');

    // desenha a linha de limite do gráfico de recursos:
    const pluginAnotacoesConsumo = {
        id: 'anotacoesConsumo',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea || !chart.data.labels || chart.data.labels.length === 0) return;

            const cfg = configRecursos[recursoAtual];
            const limiteV2 = obterLimiteConsumoV2(servidorV2, recursoAtual);

            if (limiteV2 === null || !scales.y) return;

            const yLimite = scales.y.getPixelForValue(limiteV2);
            if (yLimite < chartArea.top || yLimite > chartArea.bottom) return;

            ctx.save();

            // Linha horizontal tracejada do limite proposto do servidor V2
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(240, 101, 101, 0.55)';
            ctx.moveTo(chartArea.left, yLimite);
            ctx.lineTo(chartArea.right, yLimite);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.font = '500 11px Inter, sans-serif';
            ctx.fillStyle = COR_CRITICO;
            ctx.textAlign = 'right';

            const textoValor = formatarLimiteCurto(limiteV2, cfg.casasLimite);
            const posYTexto = (yLimite - 16 < chartArea.top) ? yLimite + 13 : yLimite - 6;
            ctx.fillText(`Limite proposto · ${textoValor} ${cfg.unidadeCurta}`, chartArea.right - 14, posYTexto);

            ctx.restore();
        }
    };

    const graficoConsumo = new Chart(ctxConsumo, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'V1 · baseline',
                    data: [],
                    borderColor: COR_V1,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.15,
                    spanGaps: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'V2 · candidata',
                    data: [],
                    borderColor: COR_V2,
                    borderWidth: 2.2,
                    tension: 0.15,
                    spanGaps: true,
                    fill: true,
                    backgroundColor: (context) => {
                        const { ctx, chartArea } = context.chart;
                        if (!chartArea) return 'rgba(167, 139, 250, 0.08)';
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(167, 139, 250, 0.18)');
                        gradient.addColorStop(1, 'rgba(167, 139, 250, 0.0)');
                        return gradient;
                    },
                    pointRadius: 0,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: COR_V2,
                    pointBorderWidth: 2,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0d141c',
                    borderColor: '#253445',
                    borderWidth: 1,
                    titleColor: '#f2f6fa',
                    bodyColor: '#c7d8e4'
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { color: '#222f3e' },
                    ticks: { font: { size: 10.5 }, padding: 6 }
                },
                y: {
                    min: 0,
                    max: 100,
                    border: { display: false },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: {
                        stepSize: 25,
                        font: { size: 10.5 },
                        padding: 8
                    }
                }
            }
        },
        plugins: [pluginAnotacoesConsumo]
    });

    const ctxEscalabilidade = document.getElementById('graficoEscalabilidade').getContext('2d');

    // desenha a linha de limite no gráfico de escalabilidade
    const pluginLimiteEscalabilidade = {
        id: 'limiteEscalabilidade',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return;

            const yCritico = scales.y.getPixelForValue(90);

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(240, 101, 101, 0.55)';
            ctx.moveTo(chartArea.left, yCritico);
            ctx.lineTo(chartArea.right, yCritico);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.font = '500 10.5px Inter, sans-serif';
            ctx.fillStyle = COR_CRITICO;
            ctx.textAlign = 'right';
            ctx.fillText('Crítico >90%', chartArea.right - 16, yCritico - 5);
            ctx.restore();
        }
    };

    const graficoEscalabilidade = new Chart(ctxEscalabilidade, {
        type: 'line',
        data: {
            labels: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
            datasets: [
                {
                    label: 'V1 · baseline',
                    data: [],
                    borderColor: COR_V1,
                    borderWidth: 2,
                    tension: 0.2,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'V2 · candidata',
                    data: [],
                    borderColor: COR_V2,
                    borderWidth: 2,
                    borderDash: [4, 4],
                    tension: 0.2,
                    pointRadius: 2.5,
                    pointBackgroundColor: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        return val >= 90 ? COR_CRITICO : COR_V2;
                    },
                    pointBorderColor: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        return val >= 90 ? '#ffffff' : COR_V2;
                    },
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0d141c',
                    borderColor: '#253445',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}% CPU`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { color: '#222f3e' },
                    ticks: { autoSkip: false, font: { size: 10.5 } },
                    title: {
                        display: true,
                        text: 'Quantidade de jogadores',
                        color: '#7c92a6',
                        font: { size: 11, weight: '500' },
                        padding: { top: 4 }
                    }
                },
                y: {
                    min: 0,
                    max: 105,
                    border: { display: false },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: {
                        stepSize: 25,
                        callback: (v) => (v <= 100 ? `${v}%` : ''),
                        font: { size: 10.5 }
                    }
                }
            }
        },
        plugins: [pluginLimiteEscalabilidade]
    });

    const ctxPerformance = document.getElementById('graficoPerformance').getContext('2d');

    const graficoPerformance = new Chart(ctxPerformance, {
        type: 'radar',
        data: {
            labels: ['RAM', 'CPU', 'Disco', 'Rede', ['Eficiência', 'térmica']],
            datasets: [
                {
                    label: 'V1 · baseline',
                    data: [0, 0, 0, 0, 0],
                    borderColor: COR_V1,
                    backgroundColor: 'rgba(77, 166, 255, 0.14)',
                    borderWidth: 1.8,
                    pointRadius: 2.5,
                    pointBackgroundColor: COR_V1
                },
                {
                    label: 'V2 · candidata',
                    data: [0, 0, 0, 0, 0],
                    borderColor: COR_V2,
                    backgroundColor: 'rgba(167, 139, 250, 0.22)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: COR_V2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0d141c',
                    borderColor: '#253445',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.r}%`
                    }
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    startAngle: 0,
                    ticks: {
                        stepSize: 25,
                        backdropColor: 'transparent',
                        color: '#6b8196',
                        font: { size: 9 },
                        callback: (v) => `${v}%`
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: {
                        color: '#8da1b3',
                        font: { size: 10.5, weight: '500' }
                    }
                }
            }
        }
    });

    // funções para atualizar os componentes sempre que os valores de V1 e V2 mudarem:

    function atualizarKpis(v1, v2) {
        const semDadosV1 = !v1 || !v1.kpis;
        const semDadosV2 = !v2 || !v2.kpis;

        if (semDadosV2) {
            ['kpi-mem-valor', 'kpi-ctx-valor', 'kpi-disco-valor', 'kpi-payload-valor'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.textContent = '--';
            });
            return;
        }

        // Índice de Crescimento de Memória (MB/h):
        const memV2 = Number(v2.kpis.indice_crescimento_memoria.valor_mb_h) || 0;
        const memV1 = !semDadosV1 ? (Number(v1.kpis.indice_crescimento_memoria.valor_mb_h) || 0) : 0;
        const diffMem = memV2 - memV1;

        document.getElementById('kpi-mem-valor').textContent = formatarNumero(memV2, 1);
        document.getElementById('kpi-mem-v1').textContent = !semDadosV1
            ? `V1: ${formatarNumero(memV1, 1)} MB/h`
            : 'V1: aguardando dados';
        document.getElementById('kpi-mem-v2').textContent = !semDadosV1
            ? `V2: ${formatarSinal(diffMem, 1)} MB/h`
            : `V2: ${formatarNumero(memV2, 1)} MB/h`;

        const estadoMem = classificarDivergencia(memV1, memV2, {
            pisoValorMax: 25,
            pisoDiffAbs: 20,
            limAlinhadoPct: 25,
            limDivergentePct: 75,
            limAlinhadoAbs: 50,
            limDivergenteAbs: 150
        });
        aplicarEstadoBadge('kpi-mem-badge', 'kpi-mem-status', 'kpi-mem-valor', 'kpi-mem-metrica', estadoMem);

        //Taxa de Troca de Contexto (trocas/s):
        const ctxV2 = Number(v2.kpis.taxa_troca_contexto.valor_trocas_s) || 0;
        const ctxV1 = !semDadosV1 ? (Number(v1.kpis.taxa_troca_contexto.valor_trocas_s) || 0) : 0;
        const varCtxPct = !semDadosV1 ? calcularVariacaoPct(ctxV1, ctxV2) : null;

        document.getElementById('kpi-ctx-valor').textContent = formatarNumero(ctxV2, 0);
        document.getElementById('kpi-ctx-v1').textContent = !semDadosV1
            ? `V1: ${formatarNumero(ctxV1, 0)} trocas/s`
            : 'V1: aguardando dados';
        document.getElementById('kpi-ctx-v2').textContent = varCtxPct !== null
            ? `V2: ${formatarSinal(varCtxPct, 1)}%`
            : `V2: ${formatarSinal(ctxV2 - ctxV1, 0)} trocas/s`;

        const estadoCtx = classificarDivergencia(ctxV1, ctxV2, {
            pisoValorMax: 2000,
            pisoDiffAbs: 1500,
            limAlinhadoPct: 20,
            limDivergentePct: 50
        });
        aplicarEstadoBadge('kpi-ctx-badge', 'kpi-ctx-status', 'kpi-ctx-valor', 'kpi-ctx-metrica', estadoCtx);

        //Tempo de Fila de Disco (ms):
        const discoV2 = Number(v2.kpis.tempo_fila_disco.valor_ms) || 0;
        const discoV1 = !semDadosV1 ? (Number(v1.kpis.tempo_fila_disco.valor_ms) || 0) : 0;
        const diffDisco = discoV2 - discoV1;

        document.getElementById('kpi-disco-valor').textContent = formatarNumero(discoV2, 0);
        document.getElementById('kpi-disco-v1').textContent = !semDadosV1
            ? `V1: ${formatarNumero(discoV1, 0)} ms`
            : 'V1: aguardando dados';
        document.getElementById('kpi-disco-v2').textContent = !semDadosV1
            ? `V2: ${formatarSinal(diffDisco, 0)} ms`
            : `V2: ${formatarNumero(discoV2, 0)} ms`;

        const estadoDisco = classificarDivergencia(discoV1, discoV2, {
            pisoValorMax: 50,
            pisoDiffAbs: 40,
            limAlinhadoPct: 25,
            limDivergentePct: 75,
            limAlinhadoAbs: 100,
            limDivergenteAbs: 300
        });
        aplicarEstadoBadge('kpi-disco-badge', 'kpi-disco-status', 'kpi-disco-valor', 'kpi-disco-metrica', estadoDisco);

        //Eficiência de Payload (B/s/jogador):
        const payV2 = Number(v2.kpis.eficiencia_payload.valor_bytes_s_jogador) || 0;
        const payV1 = !semDadosV1 ? (Number(v1.kpis.eficiencia_payload.valor_bytes_s_jogador) || 0) : 0;
        const varPayPct = !semDadosV1 ? calcularVariacaoPct(payV1, payV2) : null;

        document.getElementById('kpi-payload-valor').textContent = formatarNumero(payV2, 1);
        document.getElementById('kpi-payload-v1').textContent = !semDadosV1
            ? `V1: ${formatarNumero(payV1, 1)} B/s/jogador`
            : 'V1: aguardando dados';
        document.getElementById('kpi-payload-v2').textContent = varPayPct !== null
            ? `V2: ${formatarSinal(varPayPct, 1)}%`
            : `V2: ${formatarNumero(payV2, 1)} B/s/jogador`;

        const estadoPay = classificarDivergencia(payV1, payV2, {
            pisoValorMax: 200,
            pisoDiffAbs: 150,
            limAlinhadoPct: 20,
            limDivergentePct: 50
        });
        aplicarEstadoBadge('kpi-payload-badge', 'kpi-payload-status', 'kpi-payload-valor', 'kpi-payload-metrica', estadoPay);
    }

    function atualizarGraficoConsumo(v1, v2) {
        const cfg = configRecursos[recursoAtual];
        const serie1 = (v1 && v1.graficos && v1.graficos.consumo_recursos_24h[cfg.chaveJson]) || [];
        const serie2 = (v2 && v2.graficos && v2.graficos.consumo_recursos_24h[cfg.chaveJson]) || [];

        const mapaV1 = new Map(serie1.map((p) => [p.horario, p.valor]));
        const mapaV2 = new Map(serie2.map((p) => [p.horario, p.valor]));

        const todosHorarios = Array.from(new Set([...mapaV1.keys(), ...mapaV2.keys()])).sort();
        const labelsCurtos = todosHorarios.map((h) => (h.includes(' ') ? h.split(' ')[1] : h));

        const dadosAlinhadosV1 = todosHorarios.map((h) => (mapaV1.has(h) ? mapaV1.get(h) : null));
        const dadosAlinhadosV2 = todosHorarios.map((h) => (mapaV2.has(h) ? mapaV2.get(h) : null));

        const limiteV2 = obterLimiteConsumoV2(v2, recursoAtual);
        const escala = calcularEscalaDinamica(
            dadosAlinhadosV1,
            dadosAlinhadosV2,
            limiteV2,
            cfg.unidadeCurta === '%'
        );

        document.getElementById('subtitulo-consumo').textContent = cfg.subtitulo;
        document.getElementById('unidade-consumo').textContent = cfg.unidadeEixo;

        graficoConsumo.data.labels = labelsCurtos;
        graficoConsumo.data.datasets[0].data = dadosAlinhadosV1;
        graficoConsumo.data.datasets[1].data = dadosAlinhadosV2;
        graficoConsumo.options.scales.y.max = escala.maxY;
        graficoConsumo.options.scales.y.ticks.stepSize = escala.stepY;
        graficoConsumo.update();
    }

    function atualizarGraficoEscalabilidade(v1, v2) {
        const escV1 = v1 && v1.graficos && v1.graficos.escalabilidade_jogadores;
        const escV2 = v2 && v2.graficos && v2.graficos.escalabilidade_jogadores;

        if (!escV2) {
            graficoEscalabilidade.data.datasets[0].data = [];
            graficoEscalabilidade.data.datasets[1].data = [];
            graficoEscalabilidade.update();
            document.getElementById('texto-projecao-escalabilidade').textContent =
                'Aguardando coleta de telemetria da build candidata para projetar capacidade.';
            return;
        }

        const maxJogV1 = escV1 ? Number(escV1.max_jogadores_suportados) : Number(escV2.max_jogadores_suportados);
        const maxJogV2 = Number(escV2.max_jogadores_suportados);

        const custoCpuV1 = escV1 ? Number(escV1.consumo_unitario_por_jogador.cpu_pct) : 0;
        const custoCpuV2 = Number(escV2.consumo_unitario_por_jogador.cpu_pct);

        const maiorMax = Math.max(maxJogV1, maxJogV2, 10);
        const alvo = Math.max(maiorMax * 1.15, 20);
        const magnitude = Math.pow(10, String(Math.floor(alvo)).length - 1);
        const passoBase = alvo / magnitude <= 5 ? magnitude / 2 : magnitude;
        const tetoGrafico = Math.ceil(alvo / passoBase) * passoBase;
        const passo = Math.max(1, Math.floor(tetoGrafico / 10));

        const labelsJogadores = [];
        const pontosV1 = [];
        const pontosV2 = [];

        for (let qtd = 0; qtd <= tetoGrafico; qtd += passo) {
            labelsJogadores.push(String(qtd));
            pontosV1.push(escV1 ? Math.min(100, +(custoCpuV1 * qtd).toFixed(1)) : null);
            pontosV2.push(Math.min(100, +(custoCpuV2 * qtd).toFixed(1)));
        }

        graficoEscalabilidade.data.labels = labelsJogadores;
        graficoEscalabilidade.data.datasets[0].data = pontosV1;
        graficoEscalabilidade.data.datasets[1].data = pontosV2;
        graficoEscalabilidade.update();

        const textoProjecao = escV1
            ? `A build V2 suporta até ${maxJogV2} jogadores simultâneos antes de 90% de CPU.`
            : `A build V2 suporta até ${maxJogV2} jogadores simultâneos antes de atingir 90% de CPU.`;
        document.getElementById('texto-projecao-escalabilidade').textContent = textoProjecao;

        const estadoEsc = escV1
            ? classificarDivergencia(maxJogV1, maxJogV2, {
                pisoValorMax: 10,
                pisoDiffAbs: 5,
                limAlinhadoPct: 15,
                limDivergentePct: 35
            })
            : { classe: 'status-estavel', texto: '● ALINHADO' };

        const badgeEsc = document.getElementById('badge-escalabilidade');
        const textoBadgeEsc = document.getElementById('texto-badge-escalabilidade');
        if (badgeEsc && textoBadgeEsc) {
            badgeEsc.classList.remove('status-estavel', 'status-alerta', 'status-critico');
            badgeEsc.classList.add(estadoEsc.classe);
            textoBadgeEsc.textContent = estadoEsc.texto;
        }
    }

    function atualizarGraficoPerformance(v1, v2) {
        const ordemEixos = ['RAM', 'CPU', 'Disco', 'Rede', 'Eficiência térmica'];

        function extrairValoresRadar(servidor) {
            const eixos = servidor && servidor.graficos && servidor.graficos.assinatura_performance
                ? servidor.graficos.assinatura_performance.eixos
                : [];
            const mapa = new Map(eixos.map((e) => [e.componente, Number(e.valor_pct) || 0]));
            return ordemEixos.map((nome) => (mapa.has(nome) ? mapa.get(nome) : 0));
        }

        const valoresV1 = extrairValoresRadar(v1);
        const valoresV2 = extrairValoresRadar(v2);

        graficoPerformance.data.datasets[0].data = valoresV1;
        graficoPerformance.data.datasets[1].data = valoresV2;
        graficoPerformance.update();

        // Atualiza a lista lateral dos status dos componentes do gráfico de radar:
        const containerLista = document.getElementById('lista-estado-componentes');
        if (!containerLista) return;

        const limitesRadarV2 = (v2 && v2.limites && v2.limites.radar) || {};
        const rotulosCurtos = ['RAM', 'CPU', 'Disco', 'Rede', 'Ef. térmica'];

        let htmlLinhas = `<div class="estado-componente"><h5>COMPONENTE V2 CANDIDATA</h5></div>`;

        ordemEixos.forEach((eixo, idx) => {
            const pct = valoresV2[idx];
            const ehTermica = eixo === 'Eficiência térmica';
            const cfgLimite = limitesRadarV2[eixo] || limitesRadarPadrao[eixo];

            let classeEstado = 'estado-saudavel';
            let rotuloEstado = '● Saudável';
            let subtituloLimite = '';

            if (ehTermica) {
                const saudavelMin = cfgLimite.saudavel_pct;
                const alertaMin = cfgLimite.alerta_pct;
                subtituloLimite = `≥${saudavelMin}% saudável · ≥${alertaMin}% alerta`;

                if (!v2 || !v2.graficos) {
                    rotuloEstado = '● --';
                } else if (pct < alertaMin) {
                    classeEstado = 'estado-critico';
                    rotuloEstado = '● Crítico';
                } else if (pct < saudavelMin) {
                    classeEstado = 'estado-alerta';
                    rotuloEstado = '● Alerta';
                }
            } else {
                const saudavelMax = cfgLimite.atencao_pct;
                const alertaMax = cfgLimite.critico_pct;
                subtituloLimite = `≤${saudavelMax}% saudável · ≤${alertaMax}% alerta`;

                if (!v2 || !v2.graficos) {
                    rotuloEstado = '● --';
                } else if (pct > alertaMax) {
                    classeEstado = 'estado-critico';
                    rotuloEstado = '● Crítico';
                } else if (pct > saudavelMax) {
                    classeEstado = 'estado-alerta';
                    rotuloEstado = '● Alerta';
                }
            }

            htmlLinhas += `
                <div class="estado-componente">
                    <div class="estado-componente-info">
                        <h5>${rotulosCurtos[idx]} ${v2 && v2.graficos ? formatarNumero(pct, 0) + '%' : '--%'}</h5>
                        <span class="subtitulo-limite-componente" style="display: block; font-size: 11px; color: #6b8196; margin-top: 2px;">
                            ${subtituloLimite}
                        </span>
                    </div>
                    <h5 class="${classeEstado}">${rotuloEstado}</h5>
                </div>
            `;
        });

        containerLista.innerHTML = htmlLinhas;
    }

    // comparação atual: feita a partir dos servidores selecinados:

    function renderizarComparacao() {
        const selectV1 = document.getElementById('select-v1');
        const selectV2 = document.getElementById('select-v2');

        const idV1 = Number(selectV1.value);
        const idV2 = Number(selectV2.value);

        Array.from(selectV1.options).forEach((opt) => {
            opt.disabled = Number(opt.value) === idV2 && listaServidoresTeste.length > 1;
        });
        Array.from(selectV2.options).forEach((opt) => {
            opt.disabled = Number(opt.value) === idV1 && listaServidoresTeste.length > 1;
        });

        servidorV1 = listaServidoresTeste.find((s) => Number(s.id_servidor) === idV1) || null;
        servidorV2 = listaServidoresTeste.find((s) => Number(s.id_servidor) === idV2) || null;

        atualizarKpis(servidorV1, servidorV2);
        atualizarGraficoConsumo(servidorV1, servidorV2);
        atualizarGraficoEscalabilidade(servidorV1, servidorV2);
        atualizarGraficoPerformance(servidorV1, servidorV2);
    }

    function popularSeletoresServidores(servidores) {
        const selectV1 = document.getElementById('select-v1');
        const selectV2 = document.getElementById('select-v2');

        selectV1.innerHTML = '';
        selectV2.innerHTML = '';

        if (!servidores || servidores.length === 0) {
            selectV1.innerHTML = '<option value="">Nenhum servidor de teste</option>';
            selectV2.innerHTML = '<option value="">Nenhum servidor de teste</option>';
            return;
        }

        servidores.forEach((srv) => {
            const sufixoStatus = srv.status === 'aguardando_dados' ? ' (aguardando coleta)' : '';
            const textoOpcao = `${srv.nome}${sufixoStatus}`;

            const opt1 = document.createElement('option');
            opt1.value = srv.id_servidor;
            opt1.textContent = textoOpcao;
            opt1.style.background = '#0d141c';
            opt1.style.color = '#f2f6fa';
            selectV1.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = srv.id_servidor;
            opt2.textContent = textoOpcao;
            opt2.style.background = '#0d141c';
            opt2.style.color = '#f2f6fa';
            selectV2.appendChild(opt2);
        });

        selectV1.selectedIndex = 0;
        selectV2.selectedIndex = servidores.length > 1 ? 1 : 0;

        renderizarComparacao();
    }

    // mudança do valores quando o QA troca os servidores de teste:

    document.getElementById('select-v1').addEventListener('change', renderizarComparacao);
    document.getElementById('select-v2').addEventListener('change', renderizarComparacao);

    const btnInverter = document.getElementById('btn-inverter-builds');
    if (btnInverter) {
        btnInverter.addEventListener('click', () => {
            const selectV1 = document.getElementById('select-v1');
            const selectV2 = document.getElementById('select-v2');
            const temp = selectV1.value;
            selectV1.value = selectV2.value;
            selectV2.value = temp;
            renderizarComparacao();
        });
    }

    document.querySelectorAll('.recurso-selecionado').forEach((aba) => {
        aba.addEventListener('click', () => {
            const recurso = aba.dataset.recurso;
            if (!configRecursos[recurso]) return;

            document.querySelectorAll('.recurso-selecionado').forEach((el) => el.classList.remove('ativo'));
            aba.classList.add('ativo');

            recursoAtual = recurso;
            atualizarGraficoConsumo(servidorV1, servidorV2);
        });
    });

    // carregamento inicial da tela:

    function carregarDadosDashboard() {
        const nomeUsuario = sessionStorage.getItem('NOME_USUARIO');
        if (nomeUsuario) {
            const elBoasVindas = document.getElementById('boas-vindas-qa');
            if (elBoasVindas) {
                elBoasVindas.textContent = `BEM-VINDO, ${nomeUsuario.toUpperCase()} (ENGENHEIRO DE QA)`;
            }
        }

        const headers = {};
        const token = sessionStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch('/servidorTeste/dadosDashboard', {
            method: 'GET',
            headers,
            credentials: 'same-origin'
        })
            .then((resposta) => {
                if (!resposta.ok) {
                    throw new Error(`Falha HTTP ${resposta.status}`);
                }
                return resposta.json();
            })
            .then((dados) => {
                listaServidoresTeste = Array.isArray(dados.servidores) ? dados.servidores : [];
                popularSeletoresServidores(listaServidoresTeste);
            })
            .catch((erro) => {
                console.error('Erro ao carregar dados da dashboard de versões:', erro);
            });
    }

    carregarDadosDashboard();
});