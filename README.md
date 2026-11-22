<img src="./public/assets/icon/logo.png">
# Sistema Inteligente de Monitoramento de Infraestrutura de Jogos Online e Microtransações 

> **Projeto do 2º Semestre (2026.2)** — Desenvolvimento de uma aplicação *client* e *web* voltada ao monitoramento em tempo real de hardware/sistemas operacionais, alinhada às melhores práticas de ITIL (Gestão de Incidentes, Problemas e Monitoramento de Serviços).

---


### **Integrantes:**

* Maria Eduarda Nogueiro
* Jefferson Palma
* Isaac Azevedo
* Arthur Martins
* Amanda Tavares
* Guilherme Lima
 
---

## Sobre

O objetivo principal desta aplicação é capturar, processar e exibir métricas de desempenho de sistemas operacionais (CPU, Memória RAM, Disco e Rede) em uma dashboard interativa.

A solução visa apoiar equipes de TI no diagnóstico preventivo de falhas e na otimização da infraestrutura. 

---

##  Funcionalidades Principais 

* Captura de dados do sistema operacional (persistência contínua a cada * segundos)
* Dashboard web: Exibição de gráficos e indicadores úteis para análise de desempenho
* Gestão de Componentes (CRUD): 3 telas de cadastro/gestão web para seleção dos componentes a serem monitorados
* Alertas e Notificações: Integração com plataformas como Slack para envio de alertas instantâneos
* Integração ITIL & Chamados:
  * Abertura automatizada de incidentes via Jira
  * Geração e exportação de logs detalhados da aplicação para compor os chamados
* Site Institucional Responsivo

---

## Fundamentos Aplicados

O projeto utiliza conceitos da área de Operações de TI e Observabilidade
* ITIL v4:Monitoramento de Serviços, Gestão de Incidentes e Gestão de Problemas
* NOC & SOC: Operações de rede e segurança da informação
* Observability & APM / ITOM: Monitoramento e análise de performance de infraestrutura e aplicações

---

##  Tecnologias

* (Client): Python / Java / Node.js

---

## Dashboard de Investigação: Gold no S3

A dashboard da Cláudia lê exclusivamente os metadados e as partições históricas
publicadas na Gold do S3. O serviço não usa arquivos locais nem troca para uma
fixture quando o bucket está vazio ou indisponível. Sem metadados para a empresa,
a API informa que ainda não há histórico; falhas de acesso ao S3 são respondidas
como erro de serviço.

Configure no `.env.dev`:

```env
AWS_REGION=us-east-1
S3_BUCKET=homologacao-infratech
S3_GOLD_PREFIX=03-gold/
INVESTIGACAO_GOLD_SOURCE=s3
```

O SDK AWS do Node.js usa a cadeia padrão de credenciais do ambiente, incluindo
credenciais temporárias e perfis disponíveis no AWS CLI. Não coloque chaves no
código ou no arquivo `.env.dev`. Se o CLI utiliza um perfil diferente do padrão,
inicie o backend com `AWS_PROFILE` apontando para esse perfil.

Inicie com `npm run dev`, entre com a conta da Cláudia e abra
**Investigação e Diagnóstico**. Para validar a leitura sem gravar no bucket,
consulte `03-gold/empresa-<id-da-empresa>/historico/metadados.json` usando o
endpoint `/investigacao/metadados`; uma empresa sem histórico retorna a lista de
servidores sem limites históricos. O endpoint `/investigacao/analisar` retorna
`404` quando a Gold ainda não publicou metadados e `503` quando a consulta ao
S3 falha.
