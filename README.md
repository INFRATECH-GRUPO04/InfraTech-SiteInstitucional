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

## Docker / EC2

Os três serviços (site, alertas e MySQL) sobem com o mesmo compose em
`deploy/docker-compose.yml`. O arquivo de ambiente fica **fora do git** e não é
copiado para dentro das imagens.

### 1. Build das imagens no dev

```bash
# no repositório do site
docker build -t seuusuario/infratech-site:1.0 .

# no repositório logs
docker build -t seuusuario/infratech-alertas:1.0 .
```

Troque `seuusuario` pelo seu namespace e ajuste o `image:` no compose se
publicar em outro registry. O MySQL é puxado direto (`mysql:8.4`).

### 2. Arquivo de ambiente

No dev: crie `deploy/infratech.env` (já no `.gitignore`) com o conteúdo abaixo.
Na EC2: crie `/opt/infratech/infratech.env` com o **mesmo** conteúdo e rode
`sudo chmod 600 /opt/infratech/infratech.env`.

```env
AMBIENTE_PROCESSO=producao

MYSQL_DATABASE=infratech
MYSQL_USER=infratech_app
MYSQL_PASSWORD=troque-esta-senha
MYSQL_ROOT_PASSWORD=troque-esta-senha-root

DB_HOST=mysql
DB_DATABASE=infratech
DB_USER=infratech_app
DB_PASSWORD=troque-esta-senha
DB_PORT=3306

APP_PORT=8080
APP_HOST=0.0.0.0
DASH_GOLD_LOCAL=0

S3_BUCKET=nome-do-bucket
S3_BRONZE_PREFIX=01-bronze/
S3_SILVER_PREFIX=02-silver/
S3_GOLD_PREFIX=03-gold/
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1

# Credenciais AWS opcionais. Na EC2 com IAM Role, deixe comentado.
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_SESSION_TOKEN=
# AWS_PROFILE=
# AWS_SHARED_CREDENTIALS_FILE=
# AWS_CONFIG_FILE=

JIRA_PROJECT=IFT
JIRA_BASE_URL=https://sptech-infratech.atlassian.net
JIRA_EMAIL=usuario@sptech.school
JIRA_TOKEN=token-da-api
SLACK_WEBHOOK=https://hooks.slack.com/services/xxx/yyy/zzz

ALERTA_INTERVALO_SEGUNDOS=300
ALERTA_JANELA_MINUTOS=10
ALERTA_MIN_AMOSTRAS=7
ALERTA_MAX_IDADE_MINUTOS=15
```

As variáveis AWS são opcionais: se estiverem comentadas, os SDKs usam o perfil
local ou a IAM Role da EC2. Se preenchidas, use o par completo
(`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, com `AWS_SESSION_TOKEN` quando
vier de STS) **ou** `AWS_PROFILE` com os arquivos compartilhados — nunca só uma
das chaves.

### 3. Subir

```bash
# local, no diretório deploy/
docker compose up -d --build

# EC2, uma única vez
ssh ubuntu@<ec2> 'mkdir -p /opt/infratech/src/database'
scp deploy/docker-compose.yml ubuntu@<ec2>:/opt/infratech/
scp src/database/infratech-init.sql ubuntu@<ec2>:/opt/infratech/src/database/

# EC2, deployments
ssh ubuntu@<ec2> 'cd /opt/infratech && docker compose pull && docker compose up -d --force-recreate'
```

O entrypoint oficial do MySQL executa `src/database/infratech-init.sql` apenas
no primeiro start com o volume `mysql_data` vazio: cria as tabelas e faz os
inserts. Recriar o container não roda de novo. Para re-seedar **em dev**,
`docker compose down -v` (isso apaga o volume). Na EC2, não use `-v`.

