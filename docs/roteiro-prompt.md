# Roteiro de prompts — InfraTech

Registro dos pedidos feitos no OpenCode, separados por **feat** e por **modo** (Plan / Build).
Este arquivo acompanha a implementação da Dashboard Geral concluída em 22/11/2026.

> **Atualização de 25/11/2026:** o contrato da Dashboard Geral foi revisado (ver
> `docs/plano-implementacao.md`). O JSON principal não traz `servidores[]`,
> `incidentes` nem `relatorio_ia`: o backend devolve `saude_frota` e
> `ranking_problematicos`, e incidentes/IA vêm de rotas complementares hoje
> vazias. As seções abaixo registram o histórico da versão anterior.

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

> deixa esses pontos fechados no plano: rota `GET /dash-geral` sem ID na URL; ADMIN/INFRATECH fora das dashboards de cliente; Jira só leitura, com fetch nativo e sem credencial continua funcionando; relatório de IA é template mesmo, não serviço externo; sem tabela `limite_alerta_global`, usa `metrica`/`componente`/`servidor`; S3 por padrão com `DASH_GOLD_LOCAL=1` pra testar o JSON local. o exemplo da empresa 2 é esse @docs/dash-geral.json. no final me mostra o checklist de validação.

### Modo Build

#### B1 — Implementação do plano [REAL]

> implemente o plano de "@docs/plano-implementacao.md", já rodei a ETL e consegui gerar o json da dashgeral para os servidores, um exemplo de como ficou esse json para os servidores da empresa id-2 está em "@docs/dash-geral.json"

**Como foi executado:**
- Criados `src/models/dashGeralModel.js`, `src/controllers/dashGeralController.js` e `src/routes/dashGeral.js`.
- Rota montada em `app.js` com autenticação + `exigirPermissao('monitorar')`.
- Filtro por `req.usuario.empresa`, bloqueio explícito de `ADMIN`/`INFRATECH`, filtro de `status_sistema = 1` e regra de vínculo em `servidor_funcionario`.
- `situacao`, `tempo_min`, `inc7d`, Jira e IA template preenchidos no backend; `nome`/`cidade` vindos do MySQL.
- `public/js/dash-geral.js` trocado: um `fetch`, sem mock, sem relógio duplicado e sem IA simulada por `setTimeout`.
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

> no repo de ETL, ajusta o `silver2gold.py` pra gravar `03-gold/empresa-{id}/dash-geral.json` no formato do plano do site. sem `kpis`, sem rede, sem `serie_24h` e sem janelas 7d/30d por servidor. disponibilidade tem que ficar `null` quando não tem captura, nunca `0` falso. incidente e IA ficam vazios: quem preenche é o back do site. mantém o cabeçalho do CSV igual, que o script de captura depende disso.

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

## Padrão observado nos prompts

- Referências a arquivos com `@caminho` e aspas quando o caminho tem espaço ou é argumento direto.
- Pedidos diretos e curtos: “implemente”, “agora valida”, “coloca”, “não mexe”, “se der erro ajusta”.
- Contexto de negócio vem primeiro: sessão define empresa, isolamento por `fk_empresa`, exclusão lógica e “sem dados” em vez de zero falso.
- Escopo explícito para evitar invenções: fora de escopo não entra sem pedido; Jira somente leitura; IA é template; ETL e site se encontram só no JSON gold.
- Validação sempre manual: login, curl com cookie, perfis diferentes, estados 401/403/404 e conferência visual da dash.
