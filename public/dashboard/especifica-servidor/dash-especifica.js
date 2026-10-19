const ctxrecursos = document.getElementById('graficoRecursos').getContext('2d');

const graficoRecursos = new Chart(ctxrecursos, {
  type: 'line',
  data: {
    labels: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
    datasets: [
      {
        label: 'CPU',
        data: [5, 10, 2, 1, 30, 50, 48, 32, 26, 25, 23, 10, 0],
        borderColor: '#00bcd4',
        backgroundColor: '#00bcd4',
        borderWidth: 2,
        tension: 0.4,      // deixa a linha curvada
        pointRadius: 0,    // esconde os pontinhos
        pointHoverRadius: 5 // tamanho da bolinha que aparece
      },
      {
        label: 'Disco',
        data: [5, 11, 3, 2, 35, 55, 56, 42, 30, 28, 26, 12, 0],
        borderColor: '#10b981', 
        backgroundColor: '#10b981',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: 'RAM',
        data: [10, 12, 5, 3, 45, 68, 65, 50, 42, 38, 30, 15, 0],
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf6',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false, // preenche toda a largura e altura do container
    interaction: {
      intersect: false, // não precisa colocar o mouse exatamente em cima da bolinha para ela aparecer
      mode: 'index' // mostra as 3 bolinhas juntas
    },
    plugins: {
      legend: { // bolinhas da legenda
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      // linha horizontal de limite em 80%
      annotation: {
        annotations: {
          linhaLimite: {
            type: 'line',
            yMin: 80,
            yMax: 80,
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [4, 4],   //tracejado
            label: {
              display: true,
              content: '80',
              position: 'end',
              backgroundColor: 'transparent',
              color: '#ef4444',
              font: { size: 10 },
              yAdjust: -10,
            }
          }
        }
      }
    },
    scales: {
      x: { //eixo x
        grid: {
          display: false // esconde linhas verticais
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      },
      y: { //eixo y
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: '#94a3b8',
          callback: function(val) {
            return val + '%'; // adiciona o '%' no eixo Y
          }
        },
        grid: {
          color: '#f1f5f9'
        }
      }
    }
  }
});

const ctxrede = document.getElementById('graficoBanda').getContext('2d');

const gradientUpload = ctxrede.createLinearGradient(0, 0, 0, 300);
gradientUpload.addColorStop(0, 'rgba(139, 92, 246, 0.25)'); 
gradientUpload.addColorStop(1, 'rgba(139, 92, 246, 0.0)'); 

const gradientDownload = ctxrede.createLinearGradient(0, 0, 0, 300);
gradientDownload.addColorStop(0, 'rgba(6, 182, 212, 0.20)'); 
gradientDownload.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

const graficoBanda = new Chart(ctxrede, {
  type: 'line',
  data: {
    labels: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
    datasets: [
      {
        label: 'Upload (envio)',
        data: [90, 110, 150, 300, 400, 470, 500, 680, 710, 880, 950, 700, 620],
        borderColor: '#8b5cf6',      
        backgroundColor: gradientUpload,
        fill: true,           // preenche da área
        borderWidth: 2,
        tension: 0.4,      
        pointRadius: 0,       
        pointHoverRadius: 6
      },
      {
        label: 'Download (recebimento)',
        data: [60, 80, 100, 180, 220, 200, 200, 290, 320, 380, 400, 310, 260],
        borderColor: '#06b6d4',   
        backgroundColor: gradientDownload,
        fill: true,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end', // alinha a legenda no canto superior direito
        labels: {
          usePointStyle: false,
          boxWidth: 16,
          boxHeight: 2,
          padding: 15,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      // Linha tracejada de limite em 1.000 Mbps
      annotation: {
        annotations: {
          linhaCap: {
            type: 'line',
            yMin: 1000,
            yMax: 1000,
            borderColor: '#ff2b2b', 
            borderWidth: 1.5,
            borderDash: [5, 5],      
            label: {
              display: true,
              content: 'Cap: 1.000 Mbps',
              position: 'end',
              backgroundColor: 'transparent',
              color: '#ff2b2b',
              font: { size: 11, weight: '500' },
              yAdjust: -10,          
            }
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      },
      y: {
        min: 0,
        max: 1100,
        ticks: {
          stepSize: 250,
          color: '#94a3b8',
          font: { size: 11 }
        },
        grid: {
          color: '#f1f5f9'
        }
      }
    }
  }
});