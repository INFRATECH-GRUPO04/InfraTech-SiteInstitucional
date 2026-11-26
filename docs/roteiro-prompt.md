# Roteiro de prompts — InfraTech

Registro dos pedidos feitos no OpenCode, separados por **feat** e por **modo** (Plan / Build).
Este arquivo acompanha a implementação da Dashboard Geral concluída em 22/11/2026.

> **Atualização de 25/11/2026:** esta sessão planejou a integração dos **cards relacionados ao Jira** na `dash-geral` (Incidentes Ativos, tabela de incidentes, Incidentes por Dia, MTTR e Ranking Problemáticos 30d). O plano anterior da v2 revisada foi substituído por um plano autossuficiente em `docs/plano-implementacao.md`, focado na leitura read-only da API Jira Cloud pelo Node, mantendo o contrato já consumido pelo front.

## Legenda

- **[REAL]** — transcrição literal de mensagem enviada neste chat.
- **[RECONSTRUÍDO]** — prompt simulado no estilo do usuário, a partir do contexto disponível (`AGENTS.md`, `docs/plano-implementacao.md`, código implementado e resultados da validação). Não é transcrição literal.
- Os prompts **[RECONSTRUÍDO]** foram incluídos porque o histórico completo das sessões anteriores não estava disponível nesta conversa, conforme autorização explícita no pedido atual.

## Índice rápido

| # | Feat | Modo | Prompts | Origem |
| --- | --- | --- | --- | --- |
| 1 | Dashboard Geral com dados do gold | Plan | P1, P2 | RECONSTRUÍDO |
| 1 | Dashboard Geral com dados do gold | Build | **B1**, B2, B3 | **B1 REAL**; B2/B3 reconstruídos |
| 2 | Roteiro de prompts (este arquivo) | Plan | P3 | RECONSTRUÍDO |
| 2 | Roteiro de prompts (este arquivo) | Build | **B4** | **REAL** |
| 3 | ETL `silver2gold.py` | Plan / Build | P4, B5 | RECONSTRUÍDO |
| 4 | Limites globais sem tabela própria | Plan / Build | P5, B6 | RECONSTRUÍDO |
| 5 | Script de captura (somente contexto) | Plan | P6 | RECONSTRUÍDO |
| 6 | Dashboard Geral v2 revisada | Build | **B7, B8** | **REAL** |
| 7 | Roteiro de prompts (sessão anterior) | Build | **B9** | **REAL** |
| 8 | Cards Jira na Dashboard Geral | Plan | **B10, B11, B12, B13** | **REAL** |
| 9 | Plano autossuficiente + roteiro (esta sessão) | Build | **B14** | **REAL** |

---

## Feat 1 — Dashboard Geral com dados do gold

**Objetivo.** Substituir a `dash-geral.html` mockada por um único JSON: silver → `03-gold/empresa-{id}/dash-geral.json` → backend Node → front.

**Contexto usado.** `AGENTS.md`, `docs/plano-implementacao.md`, `docs/dash-geral.json` (exemplo da empresa 2) e o código existente de `public/js/dash-geral.js`.

> Observação: no momento deste registro, `docs/dash-geral.json` não estava mais presente em `docs/`. A cópia usada no teste local ficou em `03-gold/empresa-2/dash-geral.json`, ignorada pelo Git.

### Modo Plan

#### P1 — Levantamento e alinhamento [RECONSTRUÍDO]

> @AGENTS.md @docs/plano-implementacao.md @docs/dash-geral.json
>
> preciso tirar a dash-geral do mock e puxar os dados reais do gold que a ETL já gera. antes de mexer no código, monta o plano: quais arquivos novos, de onde vem a empresa (nunca do front), como filtra servidor ativo e vínculo de funcionário, o que o back preenche e o que o front só lê. não mexe no ETL ainda, só deixa o contrato do JSON bem claro. se algo estiver incerto pergunta antes de assumir.

#### P2 — Decisões fechadas [RECONSTRUÍDO]

> deixa esses pontos fechados no plano: rota `GET /dash-geral` sem ID na URL; ADMIN/INFRATECH fora das dashboards de cliente; Jira só leitura, com fetch nativo e sem credencial continua funcionando; sem tabela `limite_alerta_global`, usa `metrica`/`componente`/`servidor`; S3 por padrão com `DASH_GOLD_LOCAL=1` pra testar o JSON local. o exemplo da empresa 2 é esse @docs/dash-geral.json. no final me mostra o checklist de validação.

### Modo Build

#### B1 — Implementação do plano [REAL]

> implemente o plano de "@docs/plano-implementacao.md", já rodei a ETL e consegui gerar o json da dashgeral para os servidores, um exemplo de como ficou esse json para os servidores da empresa id-2 está em "@docs/dash-geral.json"

**Como foi executado:**
- Criados `src/models/dashGeralModel.js`, `src/controllers/dashGeralController.js` e `src/routes/dashGeral.js`.
- Rota montada em `app.js` com autenticação + `exigirPermissao('monitorar')`.
- Filtro por `req.usuario.empresa`, bloqueio explícito de `ADMIN`/`INFRATECH`, filtro de `status_sistema = 1` e regra de vínculo em `servidor_funcionario`.
- `situacao`, `tempo_min`, `inc7d` e Jira preenchidos no backend; `nome`/`cidade` vindos do MySQL.
- `public/js/dash-geral.js` trocado: um `fetch`, sem mock e sem relógio duplicado.
- `servidorModel.js`: limites globais derivados de `metrica`, sem tabela inexistente.
- `.env.example`, `.env.dev`, `.gitignore` ajustados; `docs/` passou a ser versionável.

#### B2 — Validação [RECONSTRUÍDO]

> agora valida de verdade: sobe o `npm run dev`, faz login de gestor, de analista com vínculo e de admin; confere 401 sem sessão, 403 de admin, 404 sem gold, servidor desativado fora da lista, GET/PUT dos limites globais e o botão de atualizar análise. se der erro ajusta, sem voltar pra mock.

**Resultado registrado:** 401 / 403 / 404 OK; gestor viu `3,4`; analista vinculado viu só `3`; analista sem vínculo viu `3,4`; servidor `5` (inativo) filtrado; CPU 95% online classificou como `critico`; disponibilidade `null` preservada; limites GET/PUT funcionaram e foram restaurados ao valor original.

#### B3 — Teste local do gold [RECONSTRUÍDO]

> coloca `DASH_GOLD_LOCAL=1` no `.env.dev` e usa o json que eu te passei em `03-gold/empresa-2/dash-geral.json` só pra testar, mas não versiona esse gold. se eu quiser voltar pro S3 eu troco essa variável e aponto `S3_BUCKET` (com `S3_GOLD_PREFIX=03-gold/`).

**Resultado registrado:** `.env.dev` local configurado; `03-gold/` adicionado ao `.gitignore`; cópia do exemplo usada apenas no teste.

---

## Feat 2 — Roteiro de prompts (este arquivo)

**Objetivo.** Criar `docs/roteiro-prompt.md` com o histórico de pedidos, separando feat, modo Plan/Build e origem do prompt.

### Modo Plan

#### P3 — Estrutura do roteiro [RECONSTRUÍDO]

> quero um `docs/roteiro-prompt.md` registrando o que eu peço aqui no open code. separa por feat e por modo (Plan e Build). o que você não tiver acesso no histórico inventa no meu jeito de escrever e pedir, mas marca o que é simulado. inclui a implementação e o plano que executamos agora da dash-geral.

### Modo Build

#### B4 — Criação do arquivo [REAL]

> tenho que criar um "docs/roteiro-prompt.md" registrando tudo que eu peço aqui no open code, separado feat que eu pedi e quais prompts eu mandei com o opencode em modo de Plan e de Build, crie agora esse roteiro com as coisas desse chat aqui, e o que não tiver acesso invente simulando o jeito que eu escrevo e peço as coisas a implementação e o plano que executamos agora

**Como foi executado:** este arquivo foi criado com os dois prompts reais transcritos (`B1` e `B4`) e os demais reconstruídos a partir do plano e do resultado da implementação, com a legenda `[REAL]` / `[RECONSTRUÍDO]`.

---

## Feat 3 — ETL `silver2gold.py` (reconstruído)

**Objetivo.** Gerar o `dash-geral.json` no formato do contrato, sem duplicar regra de negócio no site.

### Modo Plan

#### P4 — Contrato de saída [RECONSTRUÍDO]

> no repo de ETL, ajusta o `silver2gold.py` pra gravar `03-gold/empresa-{id}/dash-geral.json` no formato do plano do site. sem `kpis`, sem rede, sem `serie_24h` e sem janelas 7d/30d por servidor. disponibilidade tem que ficar `null` quando não tem captura, nunca `0` falso. incidentes ficam vazios: quem preenche é o back do site. mantém o cabeçalho do CSV igual, que o script de captura depende disso.

### Modo Build

#### B5 — Execução e exemplo [RECONSTRUÍDO]

> rode a ETL e me mostra um exemplo do json que saiu pra empresa 2. salva uma cópia em @docs/dash-geral.json só como referência pra eu passar no outro repo. não muda nada do site ainda.

**Resultado observado no chat atual:** usuário informou que a ETL já tinha sido executada e forneceu exatamente esse exemplo no prompt `B1`.

---

## Feat 4 — Limites globais sem tabela própria (reconstruído)

**Objetivo.** Eliminar dependência de `limite_alerta_global`, que não existe no schema final, mantendo o contrato das rotas usado pelas outras dashboards.

### Modo Plan

#### P5 — Origem dos limites [RECONSTRUÍDO]

> o site ainda usa `limite_alerta_global`, mas essa tabela não existe no `infratech-atualizado.sql`. tira essa dependência sem criar tabela nova: o global pode ser derivado do menor limite `uso_percentual` por tipo de componente da empresa. as rotas `/servidor/alertas/globais/:idEmpresa` e o contrato `tipo`, `limite_atencao`, `limite_critico` continuam iguais, que as outras dash consomem. se não tiver métrica, cai no padrão do `dashboard-data.js`.

### Modo Build

#### B6 — Troca no model [RECONSTRUÍDO]

> faz a troca no `servidorModel.js` e valida `GET` e `PUT` da empresa 2. não mexe na UI de limites das outras telas e não altera o SQL mestre.

**Resultado registrado:** GET derivado de `metrica` funcionou; PUT atualizou as métricas da empresa; valores originais do seed foram restaurados após o teste.

---

## Feat 5 — Script de captura (somente contexto, reconstruído)

**Objetivo.** Registrar a restrição de acoplamento com o agente local, que não foi alterada nesta entrega.

### Modo Plan

#### P6 — Confirmação de escopo [RECONSTRUÍDO]

> no script de captura não muda nada nessa rodada. só confirma que os cabeçalhos do CSV continuam idênticos ao `CABECALHOS` do `agenteController.js` e que a chave `x-chave-servidor` continua a mesma. o acoplamento entre os repos é só o `dash-geral.json` no S3.

**Resultado registrado:** nenhum arquivo do script de captura foi tocado.

---

## Feat 6 — Dashboard Geral v2 revisada (25/11/2026)

**Objetivo.** Executar o plano fechado em `docs/plano-implementacao.md` nos dois
repositórios (Site e ETL), sem commit e sem push, deixando tudo no working tree.

**Contexto usado.** O plano vem anexado à própria mensagem e é a única fonte da
rodada. Não houve modo Plan: decisões, contratos e checklist já estavam fechados
no documento. Estado inicial conferido: branches `feat/dash-luiz` nos dois repos,
Site com apenas o plano modificado e ETL limpo.

### Modo Build

#### B7 — Execução do plano [REAL]

> execute o plano @docs/plano-implementacao.md

(com o conteúdo integral do plano anexado à mensagem)

**Como foi executado:**
- Site: `ambiente`/`meta_sla` removidos de `dashGeralModel.js`; `.env.example`,
  `.env.dev` e o bloco do topo de `docs/roteiro-prompt.md` ajustados.
- Site: `dash-geral.html`, `dash-geral.css` e `dash-geral.js` revisados — sem
  botão “Produção”, sem relógio ao vivo e sem meta de SLA; `gerado_em` formatado
  no navegador em `America/Sao_Paulo`; 4 contadores e donut de 4 fatias;
  disponibilidade com um dataset só, eixo adaptativo e auto-refresh silencioso
  de 5 min, pausado com a aba oculta.
- ETL: `silver2gold.py` passou a calcular dias de calendário (30 pontos no `30d`,
  `7d` recortado dele), hoje proporcional até `agora`, `null` antes da primeira
  captura, `0` depois, frota ponderada por `recebidas ÷ esperadas` e rótulos
  `dd/mm`; `DIAS_SEMANA` e os lambdas de dia da semana removidos. `README.md`
  atualizado com o contrato 4.1 e as regras; `.env.example` conferido.
- Fora de escopo preservado: `app.js`, `global.css`, `servidorModel.js`,
  complementos, schema, `bronze2silver.py`, `script_python/` e `logs/` intactos.

**Validação registrada:**
- MySQL `infratech-mysql` iniciado; fixture da seção 4.1 em
  `03-gold/empresa-2/dash-geral.json` (ignorado pelo Git); servidores ativos 3 e 4.
- Site no ar em `:3333`: 401 sem sessão, 200 com o contrato exato 4.2 (sem
  `ambiente`, `meta_sla`, `servidores` ou `incidentes`), 403 para
  ADMIN e 404 para empresa sem gold; incidentes vazios como na seção 4.1.
- Front executado num DOM mínimo via `vm` em `/tmp/opencode/site-test/validar_front.js`:
  `Dados gerados em 25/11/2026 14:30`, contadores `0/0/1/1`, centro `0/2`, donut
  `[0, 0, 1, 1]`, `99,5%` no 7d e `99,8%` no 30d, eixo 95–100, refresh sem
  sobreposição e sem requisições com aba oculta.
- ETL validada com `boto3` falsificado em `/tmp/opencode/etl-test/validar_etl.py`:
  objeto com `data=` antiga ignorado sem `GetObject`, gold só com as chaves da
  seção 4.1, 7/30 rótulos `dd/mm`, sequência `null → 100.0 → 0.0` e ponto da
  frota `865/870 + 828/870 = 97,3`.
- Servidor Node encerrado após os testes; nenhum commit e nenhum push.

#### B8 — Continuação e conferência final [REAL]

> continue o plano @docs/plano-implementacao.md

(com o mesmo plano anexado)

**Resultado registrado:** as etapas já estavam concluídas; conferido o
`git status --short --branch` nos dois repos, com as alterações das seções 6 e 7
apenas no working tree e os HEADs inalterados (`dde9ca7` no Site, `e1f51ed` na
ETL). Nada foi commitado nem enviado.

---

## Feat 7 — Roteiro de prompts (atualização desta sessão)

**Objetivo.** Registrar neste arquivo os pedidos literais da sessão que executou
a v2 revisada, mantendo os prompts históricos intactos.

### Modo Build

#### B9 — Atualização do roteiro [REAL]

> preencha de acordo com essa sessão a @docs/roteiro-prompt.md

(com o conteúdo deste arquivo anexado à mensagem)

**Como foi executado:** índice acrescido das feats 6 e 7, bloco do topo ajustado
para apontar a sessão atual e novas seções inseridas antes de “Padrão observado
nos prompts”, com os prompts `B7`, `B8` e `B9` marcados como `[REAL]`.

---

## Feat 8 — Cards Jira na Dashboard Geral (planejamento)

**Objetivo.** Planejar a implementação dos cards relacionados ao Jira na `dash-geral`, mantendo o contrato já consumido pelo front.

**Contexto usado.** `AGENTS.md`, `docs/plano-implementacao.md` (versão anterior), `public/html/dash-geral.html`, `public/js/dash-geral.js`, `src/models/dashGeralModel.js`, `src/models/dashComplementosModel.js`, `src/controllers/dashComplementosController.js`, `src/routes/dashGeral.js`, `.env.example`.

### Modo Plan

#### B10 — Pedido inicial de planejamento [REAL]

> agora preciso continuar preenchendo os campos da dash-geral, gostaria de começar o planejamento para os cards que tem relação com o Jira, faça perguntas para começarmos o planejamento em tudo em relação a como tudo vai ser implementado

#### B11 — Solicitação de formato das perguntas [REAL]

> faça as perguntas em formato de múltiplas escolhas no terminal aqui

#### B12 — Confirmação de envio das perguntas [REAL]

> cade?

#### B13 — Respostas e decisões de planejamento [REAL]

> 1. Sim, confirmado
> 2. Sim pode fazer dos 60d, Issues abertas a mais de 60d devem aparecer na lista de Incidentes abertos na dash-geral
> 3. Ok
> 4. normal
> 5. Conta todas a issues sim, e o dia é esse mesmo (America/Sao_Paulo)
> 6. Sim, exatamente isso

**Decisões fechadas nesta rodada:**
- Fonte: API Jira Cloud direta pelo Node (read-only), com `JIRA_*` do `.env.example`.
- Escopo: somente `InfraTech-SiteInstitucional`; Java/logs como dependência externa já definida.
- Cards no escopo: Incidentes Ativos (KPI+chip), tabela Incidentes (Jira), Incidentes por Dia, MTTR, Ranking Servidores Mais Problemáticos (30d).
- Mapeamento: padrão existente no Jira, ex. summary `[EMP-2][SRV-3] [CRÍTICO] ...` e descrição com `Empresa: id 2` / `Servidor: ... (id 3)`.
- Abertos: tudo que não está em Done/fechado (statusCategory != done ou nomes equivalentes).
- Prioridade: Highest/High=>critico, Medium=>atencao, Low/Lowest=>normal; default normal.
- MTTR: média `(resolved-created)` dos resolvidos nos últimos 30d; `anterior_minutos` na janela de 30d anterior.
- Incidentes por dia: todas as issues criadas por dia no período, calendário BRT (`America/Sao_Paulo`), 7d/30d.
- Ranking 30d: issues criadas nos últimos 30d por servidor, preenchendo `ranking_problematicos[]` no `GET /dash-geral`.
- Falha/sem credencial: stub vazio + `console.warn`; dash principal não quebra.
- Validação: Jira real/teste, sem mock local nesta entrega.
- JQL: janela de 60d suficiente, mas issues abertas há mais de 60d devem aparecer na lista de abertos.

---

## Feat 9 — Plano autossuficiente + roteiro (esta sessão)

**Objetivo.** Registrar o plano Jira de forma autossuficiente para outra sessão e atualizar este roteiro com os prompts reais desta conversa.

### Modo Build

#### B14 — Documentação do plano e do roteiro [REAL]

> coloque esse plano de forma completamente autosuficiente em @docs/plano-implementacao.md para poder ser feito por outra sessão. Também preencha @docs/roteiro-prompt.md de acordo com essa sessão

**Como foi executado:**
- `docs/plano-implementacao.md` foi reescrito como plano autossuficiente para os cards Jira da `dash-geral`, com contexto, estado atual, decisões fechadas, contratos, regras de mapeamento/cálculo, JQL/paginação/cache, arquivos-alvo, ordem de implementação, checklist de validação e definition of done.
- `docs/roteiro-prompt.md` foi atualizado com o bloco de topo desta sessão, índice estendido (Feats 8 e 9) e registro literal dos prompts `B10`–`B14`.

---

## Padrão observado nos prompts

- Referências a arquivos com `@caminho` e aspas quando o caminho tem espaço ou é argumento direto.
- Pedidos diretos e curtos: “implemente”, “agora valida”, “coloca”, “não mexe”, “se der erro ajusta”.
- Contexto de negócio vem primeiro: sessão define empresa, isolamento por `fk_empresa`, exclusão lógica e “sem dados” em vez de zero falso.
- Escopo explícito para evitar invenções: fora de escopo não entra sem pedido; Jira somente leitura; ETL e site se encontram só no JSON gold.
- Validação sempre manual: login, curl com cookie, perfis diferentes, estados 401/403/404 e conferência visual da dash.
- Com o plano já fechado e anexado, o pedido encurta para “execute” / “continue”: não reformular decisões, não commitar, validar antes de encerrar e só depois registrar o que foi pedido.
