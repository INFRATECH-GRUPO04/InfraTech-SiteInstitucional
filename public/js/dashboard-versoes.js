document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#6b8196';

    const COR_V1 = '#4da6ff';
    const COR_V2 = '#a78bfa';
    const COR_CRITICO = '#f06565';
    const COR_ALERTA = '#f0b44c';

    // Conjuntos de dados para as abas CPU, RAM, DISCO e REDE
    const dadosRecursos = {
        DISCO: {
            subtitulo: 'Taxa de I/O de disco · leitura + escrita · 64 jogadores nas duas builds',
            unidadeEixo: 'I/O DE DISCO (MB/S)',
            unidadeCurta: 'MB/s',
            maxY: 175,
            stepY: 40,
            limiteValor: 140,
            limiteTexto: 'Limite proposto · 140 MB/s',
            v1: [32, 35, 38, 42, 40, 48, 70, 38, 36, 40, 37, 36, 37],
            v2: [45, 50, 56, 62, 68, 56, 128, 66, 68, 72, 65, 63, 66]
        },
        CPU: {
            subtitulo: 'Uso médio de processamento · threads principais · 64 jogadores nas duas builds',
            unidadeEixo: 'USO DE CPU (%)',
            unidadeCurta: '%',
            maxY: 100,
            stepY: 25,
            limiteValor: 85,
            limiteTexto: 'Limite proposto · 85%',
            v1: [34, 36, 39, 41, 40, 44, 58, 42, 41, 43, 40, 39, 41],
            v2: [48, 52, 57, 61, 65, 62, 91, 68, 70, 72, 67, 66, 69]
        },
        RAM: {
            subtitulo: 'Alocação de memória residente (RSS) · 64 jogadores nas duas builds',
            unidadeEixo: 'MEMÓRIA ALOCADA (GB)',
            unidadeCurta: 'GB',
            maxY: 16,
            stepY: 4,
            limiteValor: 12,
            limiteTexto: 'Limite proposto · 12 GB',
            v1: [4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 5.1, 4.7, 4.7, 4.8, 4.8, 4.9, 4.9],
            v2: [5.4, 6.1, 6.8, 7.5, 8.2, 8.9, 11.4, 9.8, 10.3, 10.9, 11.4, 11.9, 12.4]
        },
        REDE: {
            subtitulo: 'Vazão de pacotes outbound · tickrate 60Hz · 64 jogadores nas duas builds',
            unidadeEixo: 'TRÁFEGO DE REDE (MBPS)',
            unidadeCurta: 'Mbps',
            maxY: 120,
            stepY: 30,
            limiteValor: 95,
            limiteTexto: 'Limite proposto · 95 Mbps',
            v1: [22, 24, 25, 27, 26, 29, 44, 28, 27, 29, 28, 27, 28],
            v2: [38, 41, 44, 48, 51, 49, 88, 54, 55, 58, 53, 52, 54]
        }
    };

    let recursoAtual = 'DISCO';
    let eventoCustom = {
        indice: 6, // '12:00'
        titulo: '12h · teste da batalha na colina'
    };

    /* 1. GRÁFICO DE LINHA: CONSUMO DE RECURSOS AO LONGO DO TEMPO */
    const ctxConsumo = document.getElementById('graficoConsumoRecursos').getContext('2d');

    const pluginAnotacoesConsumo = {
        id: 'anotacoesConsumo',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return;

            const cfg = dadosRecursos[recursoAtual];
            const yLimite = scales.y.getPixelForValue(cfg.limiteValor);

            ctx.save();

            // Linha horizontal tracejada de limite proposto
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(240, 101, 101, 0.55)';
            ctx.moveTo(chartArea.left, yLimite);
            ctx.lineTo(chartArea.right, yLimite);
            ctx.stroke();

            // Texto "Limite proposto" acima da linha à direita
            ctx.setLineDash([]);
            ctx.font = '500 11px Inter, sans-serif';
            ctx.fillStyle = COR_CRITICO;
            ctx.textAlign = 'right';
            ctx.fillText(cfg.limiteTexto, chartArea.right - 14, yLimite - 6);

            // Linha vertical tracejada do evento (padrão 12:00)
            const idx = eventoCustom.indice;
            const xEvento = scales.x.getPixelForValue(idx);

            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(240, 180, 76, 0.65)';
            ctx.moveTo(xEvento, chartArea.top + 4);
            ctx.lineTo(xEvento, chartArea.bottom);
            ctx.stroke();

            // Caixa de anotação do evento ao lado da linha vertical
            const valV1 = cfg.v1[idx];
            const valV2 = cfg.v2[idx];
            const linha1 = eventoCustom.titulo;
            const linha2 = `v1.1: ${valV1}  |  v1.2: ${valV2} ${cfg.unidadeCurta}`;

            ctx.setLineDash([]);
            ctx.font = '600 11px Inter, sans-serif';
            const largura1 = ctx.measureText(linha1).width;
            ctx.font = '400 10.5px Inter, sans-serif';
            const largura2 = ctx.measureText(linha2).width;

            const boxW = Math.max(largura1, largura2) + 20;
            const boxH = 38;
            const boxX = Math.min(xEvento + 10, chartArea.right - boxW - 6);
            const boxY = chartArea.top + 8;

            ctx.fillStyle = 'rgba(42, 34, 21, 0.92)';
            ctx.strokeStyle = 'rgba(240, 180, 76, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.font = '600 11px Inter, sans-serif';
            ctx.fillStyle = COR_ALERTA;
            ctx.fillText(linha1, boxX + 10, boxY + 15);

            ctx.font = '400 10.5px Inter, sans-serif';
            ctx.fillStyle = '#a6b7c7';
            ctx.fillText(linha2, boxX + 10, boxY + 30);

            ctx.restore();
        }
    };

    const graficoConsumo = new Chart(ctxConsumo, {
        type: 'line',
        data: {
            labels: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'],
            datasets: [
                {
                    label: 'v1.1 · baseline',
                    data: dadosRecursos.DISCO.v1,
                    borderColor: COR_V1,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.15,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'v1.2 · candidata',
                    data: dadosRecursos.DISCO.v2,
                    borderColor: COR_V2,
                    borderWidth: 2.2,
                    tension: 0.15,
                    fill: true,
                    backgroundColor: (context) => {
                        const { ctx, chartArea } = context.chart;
                        if (!chartArea) return 'rgba(167, 139, 250, 0.08)';
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(167, 139, 250, 0.18)');
                        gradient.addColorStop(1, 'rgba(167, 139, 250, 0.0)');
                        return gradient;
                    },
                    pointRadius: (ctx) => (ctx.dataIndex === eventoCustom.indice ? 4 : 0),
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
                    max: dadosRecursos.DISCO.maxY,
                    border: { display: false },
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: {
                        stepSize: dadosRecursos.DISCO.stepY,
                        font: { size: 10.5 },
                        padding: 8
                    }
                }
            }
        },
        plugins: [pluginAnotacoesConsumo]
    });

    // Interatividade das abas CPU / RAM / Disco / REDE
    document.querySelectorAll('.recurso-selecionado').forEach((aba) => {
        aba.addEventListener('click', () => {
            const recurso = aba.dataset.recurso;
            if (!dadosRecursos[recurso]) return;

            document.querySelectorAll('.recurso-selecionado').forEach((el) => el.classList.remove('ativo'));
            aba.classList.add('ativo');

            recursoAtual = recurso;
            const cfg = dadosRecursos[recurso];

            document.getElementById('subtitulo-consumo').textContent = cfg.subtitulo;
            document.getElementById('unidade-consumo').textContent = cfg.unidadeEixo;

            graficoConsumo.data.datasets[0].data = cfg.v1;
            graficoConsumo.data.datasets[1].data = cfg.v2;
            graficoConsumo.options.scales.y.max = cfg.maxY;
            graficoConsumo.options.scales.y.ticks.stepSize = cfg.stepY;
            graficoConsumo.update();
        });
    });

    // Interatividade do botão "+ Adicionar evento"
    const btnEvento = document.getElementById('btn-adicionar-evento');
    if (btnEvento) {
        btnEvento.addEventListener('click', () => {
            const nomeEvento = prompt('Descrição do evento no gráfico (ex: 13h · spawn de chefão):');
            if (!nomeEvento || !nomeEvento.trim()) return;
            eventoCustom.titulo = nomeEvento.trim();
            graficoConsumo.update();
        });
    }

    /* 2. GRÁFICO DE ESCALABILIDADE DE JOGADORES */
    const ctxEscalabilidade = document.getElementById('graficoEscalabilidade').getContext('2d');

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

    new Chart(ctxEscalabilidade, {
        type: 'line',
        data: {
            labels: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
            datasets: [
                {
                    label: 'v1.1 · baseline',
                    data: [4, 9, 15, 21, 28, 35, 42, 49, 56, 63, 70],
                    borderColor: COR_V1,
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'v1.2 · candidata',
                    data: [2, 4, 8, 14, 22, 32, 45, 61, 79, 90, 100],
                    borderColor: COR_V2,
                    borderWidth: 2,
                    borderDash: [4, 4],
                    tension: 0.35,
                    pointRadius: (ctx) => (ctx.dataIndex >= 3 ? 2.5 : 0),
                    pointBackgroundColor: (ctx) => (ctx.dataIndex === 9 ? COR_CRITICO : COR_V2),
                    pointBorderColor: (ctx) => (ctx.dataIndex === 9 ? '#ffffff' : COR_V2),
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
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { color: '#222f3e' },
                    ticks: {
                        autoSkip: false,
                        callback(value, index) {
                            return index % 2 === 0 ? this.getLabelForValue(value) : '';
                        },
                        font: { size: 10.5 }
                    },
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

    /* 3. GRÁFICO RADAR: ASSINATURA DE PERFORMANCE DOS COMPONENTES */
    const ctxPerformance = document.getElementById('graficoPerformance').getContext('2d');

    new Chart(ctxPerformance, {
        type: 'radar',
        data: {
            labels: ['RAM', 'CPU', 'Disco', 'Rede', ['Eficiência', 'térmica']],
            datasets: [
                {
                    label: 'v1.1 · baseline',
                    data: [55, 62, 52, 58, 60],
                    borderColor: COR_V1,
                    backgroundColor: 'rgba(77, 166, 255, 0.14)',
                    borderWidth: 1.8,
                    pointRadius: 2.5,
                    pointBackgroundColor: COR_V1
                },
                {
                    label: 'v1.2 · candidata',
                    data: [72, 94, 64, 88, 82],
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
                    borderWidth: 1
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
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    },
                    angleLines: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    },
                    pointLabels: {
                        color: '#8da1b3',
                        font: { size: 10.5, weight: '500' }
                    }
                }
            }
        }
    });
});