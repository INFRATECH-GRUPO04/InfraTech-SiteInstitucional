# Plano de implementação — Cards Jira na Dashboard Geral (25/11/2026)

**Status:** decisões fechadas, pronto para execução em modo Build.  
**Regra desta entrega:** **não dar commit, não dar push**. Todas as alterações devem ficar no working tree para revisão do usuário.

## 0. Como usar este documento

Este arquivo é **autossuficiente**: uma sessão nova, sem histórico de conversa, consegue executar a entrega lendo apenas este plano.

- A execução altera **apenas este repositório**: `/home/luiz/Documentos/repositories/InfraTech-SiteInstitucional`.
- Antes de começar, rode `git status --short --branch`. Se houver alteração não commitada além deste próprio arquivo ou de `docs/roteiro-prompt.md` (registro desta sessão), **pare e pergunte**.
- Trabalhe na branch atual (`feat/dash-luiz`, conferir no `git status`). Não crie branch nova.
- Ordem sugerida: **integração Jira → serviço/cálculos → models/controllers → config/docs → validação com Jira real/teste**.
- Não há testes automatizados, lint ou CI. Valide manualmente conforme a seção 10.
- Em caso de divergência entre este plano e o código atual, **o código atual vale mais**. Se algo faltar ou parecer ambíguo, pergunte antes de assumir.
- Este plano é a única fonte desta rodada. **Não crie outro arquivo de plano.**

---

## 1. Contexto mínimo do projeto

- Projeto acadêmico InfraTech (SPTech, 2026.2): monitoramento de **servidores físicos** de jogos online. Personas: **gestor**, **analista de dados** e **analista NOC**. A tela tratada aqui é a **dash-geral**.
- Fluxo relevante:
  ```
  Java de alertas (logs) lê 02-silver, cruza com limites no MySQL e notifica Slack/Jira
  → Jira Cloud (projeto interno InfraTech) recebe issues de incidente
  → Node/Express (este repo) consulta Jira Cloud read-only
  → GET /dash-geral e GET /dash-geral/incidentes
  → public/js/dash-geral.js renderiza os cards
  ```
- **Slack/Jira são ferramentas internas da InfraTech**, não por cliente. Ainda assim, a dash de cada cliente só deve exibir issues da sua própria empresa (`EMP-{id}`), preservando isolamento por `fk_empresa` da sessão.
- Isolamento por empresa: toda consulta/filtragem usa `req.usuario.empresa` da sessão. **Nunca confie em ID de empresa vindo do front/URL.**
- `ADMIN` e `INFRATECH` são equipe interna e **não acessam dashboards de clientes**.
- Gestor vê todos os servidores da empresa. Demais cargos veem os vinculados em `servidor_funcionario`; sem vínculo, veem todos. `status_sistema = 0` nunca aparece.
- Front é plano (`public/html|css|js`) com Chart.js via CDN. Cada tela tem CSS próprio; **não refatore `global.css`**.
- Não há testes/lint/CI. Valide manualmente.
- Não instalar dependências novas. Usar `fetch` nativo do Node e módulos padrão.
- Não dar commit nem push.

---

## 2. Estado atual conferido (ponto de partida)

- Branch: `feat/dash-luiz`.
- Já existem e funcionam:
  - `src/routes/dashGeral.js`: `GET /` e `GET /incidentes`, ambos com `autenticar` no `app.js` e `exigirPermissao('monitorar')`.
  - `src/controllers/dashGeralController.js`: 403 para `ADMIN/INFRATECH`, 403 para empresa inválida, 404 quando gold não encontrado, 503 genérico.
  - `src/controllers/dashComplementosController.js`: valida empresa da sessão e delega ao serviço Jira.
  - `src/models/dashComplementosModel.js`: **stub vazio** — `incidentes()` retorna `abertos:[]`, `por_dia` 7d/30d vazios, `mttr` nulo.
  - `src/models/dashGeralModel.js`: lê gold local/S3, cruza limites do MySQL, monta `saude_frota`, `disponibilidade_frota`, `ranking_problematicos: []`. Já tem `buscarServidoresPermitidos` e classificação de situação.
  - `public/html/dash-geral.html`: já tem todos os cards Jira (KPI, tabela, gráfico por dia, MTTR, ranking).
  - `public/js/dash-geral.js`: já consome `/dash-geral` e `/dash-geral/incidentes`; tolera falha de complementos com `console.warn`; renderiza contrato descrito na seção 4.
- `.env.example` já reserva `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT`, `JIRA_API_PATH=/rest/api/3/search/jql`, `JIRA_TIMEOUT_MS=5000`.
- Não existem módulos de integração Jira no código atual.

---

## 3. Decisões fechadas

| Item | Decisão |
|---|---|
| Fonte | **Jira Cloud** via Node, read-only, `fetch` nativo. Basic Auth `JIRA_EMAIL:JIRA_TOKEN` (base64). |
| Env | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT`, `JIRA_API_PATH` (default `/rest/api/3/search/jql`), `JIRA_TIMEOUT_MS` (default `5000`). |
| Escopo | Só `InfraTech-SiteInstitucional`. Mudanças no Java/logs (formato do issue) são dependência externa já definida. |
| Cards | Incidentes Ativos (KPI + chip), Tabela Incidentes (Jira), Incidentes por Dia, MTTR, Ranking Servidores Mais Problemáticos (30d). |
| Fora de escopo | Jira por cliente, escrever no Jira, criar chamados, alterar front/HTML/CSS, alterar schema SQL, alterar Java/ETL/script. |
| Falha Jira / sem credencial | Stub vazio + `console.warn`; dashboard principal não quebra. `GET /dash-geral/incidentes` retorna 200 com stub vazio; `GET /dash-geral` retorna 200 com `ranking_problematicos: []`. |
| Validação | Contra Jira real/teste. Sem modo mock local nesta entrega. |
| Mapeamento | Summary: `[EMP-{id}][SRV-{id}] ...`; fallback descrição `Empresa: id X` / `Servidor: ... (id X)`. Exibir só issues da empresa da sessão. |
| Nome servidor | MySQL pelo `id_servidor` da empresa (fonte confiável); fallback nome extraído do summary/descrição. |
| Status aberto | Tudo que **não** está em Done/fechado. Preferir `statusCategory.key != "done"`; fallback por nome: `done`, `closed`, `fechado`, `resolvido`, `cancelado`, `canceled` (case-insensitive). |
| Prioridade | `Highest/High -> critico`, `Medium -> atencao`, `Low/Lowest -> normal`; sem prioridade ou não mapeável => `normal`. |
| Aberto há | `agora - created`, minutos corridos, arredondado, mínimo 0. |
| MTTR | Média `(resolutiondate - created)` dos resolvidos nos últimos 30d BRT; `anterior_minutos` = 30d anteriores. Sem amostras => `null`. |
| Incidentes por dia | Todas as issues criadas por dia no período (abertas ou resolvidas), da empresa; calendário corrido BRT `America/Sao_Paulo`, rótulos `dd/mm`, 7 e 30 pontos. |
| Ranking 30d | Issues criadas nos últimos 30d por servidor; preenche `ranking_problematicos[]` no `GET /dash-geral`; top 3; só servidores ativos/visíveis; ordenação `incidentes desc, nome asc`; só `incidentes > 0`. |
| Cache | Cache em memória com TTL de 5 min para sucesso; não cachear falha longa. Reutilizar busca para `/dash-geral` e `/dash-geral/incidentes` não duplicarem chamadas. |

---

## 4. Contratos que o front já consome (manter compatível)

### 4.1 `GET /dash-geral/incidentes`

```json
{
  "abertos": [
    {
      "id": "IFT-123",
      "id_servidor": 3,
      "servidor": "SRV-GAMECLOUD-01",
      "prioridade": "critico",
      "minutos": 42,
      "responsavel": "Nome Sobrenome"
    }
  ],
  "por_dia": {
    "7d": { "rotulos": ["19/11", "20/11", "21/11", "22/11", "23/11", "24/11", "25/11"], "valores": [0, 1, 0, 2, 0, 0, 1] },
    "30d": { "rotulos": ["27/10", "...", "25/11"], "valores": [0, 0, 1] }
  },
  "mttr": { "minutos": 120, "periodo": "(últimos 30d)", "anterior_minutos": 150 }
}
```

Regras:
- `abertos[].id`: `issue.key` do Jira.
- `abertos[].id_servidor`: número extraído do padrão `[SRV-{id}]`.
- `abertos[].servidor`: nome do MySQL quando houver; fallback nome do summary/descrição.
- `abertos[].prioridade`: `normal | atencao | critico`.
- `abertos[].minutos`: inteiro >= 0.
- `abertos[].responsavel`: `assignee.displayName` ou `null`. **Sempre incluir o campo**; o front usa sua presença para o chip “sem responsável”.
- `abertos`: ordenar por `created` asc (mais antigo primeiro / maior tempo aberto no topo). Se preferir outro critério, manter consistente e documentar no código.
- `por_dia.*.rotulos`: `dd/mm` em BRT. `valores`: inteiros.
- `mttr.minutos` e `mttr.anterior_minutos`: inteiros ou `null`.

### 4.2 `GET /dash-geral` — impacto

O endpoint principal **mantém o shape atual** da seção 4.2 do plano anterior, com uma mudança de conteúdo:

- `ranking_problematicos` deixa de ser sempre `[]` e passa a ser preenchido com:
  ```json
  [{ "id_servidor": 3, "nome": "SRV-GAMECLOUD-01", "situacao": "critico", "incidentes": 4 }]
  ```
- `nome` e `situacao`: da lógica já existente no `dashGeralModel` (MySQL + gold + limites).
- `incidentes`: contagem de issues Jira **criadas nos últimos 30d BRT** para aquele servidor, pertencentes à empresa da sessão.
- Apenas top 3, `incidentes > 0`, ordenação `incidentes desc, nome asc`.
- Se Jira indisponível/sem credencial/falha: `ranking_problematicos: []`, sem quebrar o endpoint.

---

## 5. Mapeamento do Jira (padrão confirmado)

Exemplo real informado:
- Summary: `[EMP-2][SRV-3] [CRÍTICO] CPU acima do limite - SRV-GAMECLOUD-01`
- Descrição contém: `Empresa: id 2`, `Servidor: SRV-GAMECLOUD-01 (id 3)`, componente, estado, média, limite, leitura, janela.

### 5.1 Extração

- `id_empresa`: regex no summary `/\[EMP-(\d+)\]/i`; fallback descrição `/Empresa:\s*id\s*(\d+)/i`.
- `id_servidor`: regex no summary `/\[SRV-(\d+)\]/i`; fallback descrição `/Servidor:.*\(id\s*(\d+)\)/i`.
- `nome_fallback`: tentar extrair do summary após o último ` - ` ou da descrição `Servidor: NOME (id X)`.
- Se não conseguir `id_empresa` ou `id_servidor`, **ignorar a issue** para os cards (não inventar vínculo).

### 5.2 Isolamento

- Incluir issue somente quando `id_empresa === Number(req.usuario.empresa)`.
- Para `id_servidor`, só vincular a servidores ativos/visíveis carregados do MySQL quando o cálculo depender do cadastro local (ranking/nome/situação). Para lista de abertos, pode exibir mesmo que o servidor não esteja no conjunto visível? **Preferir só servidores visíveis da empresa** para não vazar informação operacional; se invisível, omitir da lista. Documentar essa escolha no código.

---

## 6. Busca Jira, paginação e cache

### 6.1 Configuração

- `JIRA_BASE_URL`: ex. `https://sua-instancia.atlassian.net` (sem barra final obrigatória; normalizar).
- `JIRA_EMAIL`, `JIRA_TOKEN`: Basic Auth.
- `JIRA_PROJECT`: ex. `INFRA`.
- `JIRA_API_PATH`: default `/rest/api/3/search/jql`.
- `JIRA_TIMEOUT_MS`: default `5000`.

Sem configuração completa: `console.warn('[jira] credenciais/configuração incompletas; retornando stub vazio')` e retornar stub/vazio.

### 6.2 JQL

Requisito confirmado: abertos com mais de 60d devem aparecer na lista; MTTR usa 30d atual + 30d anterior.

JQL sugerida:
```jql
project = "<JIRA_PROJECT>" AND (created >= -60d OR statusCategory != Done) ORDER BY created DESC
```

- Buscar no projeto inteiro conforme JQL; filtrar `EMP-{empresa}` no Node.
- Campos: `key,summary,description,created,resolutiondate,status,statusCategory,priority,assignee`.
- Limitar `maxResults` (ex. 100) e paginar.

### 6.3 Paginação

- Priorizar contrato do endpoint configurado (`/rest/api/3/search/jql`) com `nextPageToken`/`isLast` quando presente.
- Tratar fallback para `startAt/total` se a resposta vier nesse formato.
- Acumular issues até concluir ou atingir limite de segurança (ex. 1000 issues) para evitar loop acidental; logar warn se truncar.

### 6.4 Timeout e erros

- Usar `AbortController`/`signal` com `JIRA_TIMEOUT_MS`.
- Erros de rede, timeout, 401/403/429/5xx: `console.warn('[jira] ...', detalheSeguro)` e retornar vazio/stub. **Nunca vazar token/credencial em log.**
- Não propagar erro para quebrar a rota: controller/model devolve stub vazio.

### 6.5 Cache

- Cache em memória por chave de busca do projeto (ex. `project + jql + campos`), pois filtro por empresa é feito em memória e o dataset é interno.
- TTL: 5 minutos para resultado bem-sucedido.
- Não cachear falha longa; falha retorna vazio e próxima requisição pode tentar novamente.
- Expor função única de alto nível, ex. `obterDadosJiraEmpresa({ idEmpresa, servidoresVisiveis })`, usada tanto por complementos quanto por `dashGeralModel`, evitando duas chamadas por carregamento.

---

## 7. Regras de cálculo

### 7.1 Datas e fuso

- Fuso de negócio: `America/Sao_Paulo`.
- `created` e `resolutiondate` do Jira vêm em ISO; converter com `new Date(...)`.
- Buckets por dia devem usar dia civil BRT, não UTC.

### 7.2 Status aberto

- Aberto se `statusCategory.key` existir e for diferente de `done` (case-insensitive).
- Fallback por nome do status: considerar fechado quando nome normalizado contiver/igual a `done`, `closed`, `fechado`, `resolvido`, `cancelado`, `canceled`, `resolvido(a)` conforme razoável; caso contrário, aberto.
- Issues abertas há mais de 60d devem aparecer (garantido pela JQL com `OR statusCategory != Done`).

### 7.3 Prioridade

| Jira | Front |
|---|---|
| Highest, High | `critico` |
| Medium | `atencao` |
| Low, Lowest | `normal` |
| ausente/desconhecida | `normal` |

### 7.4 Abertos

- Campos: `id`, `id_servidor`, `servidor`, `prioridade`, `minutos`, `responsavel`.
- `minutos = Math.max(0, Math.round((Date.now() - created.getTime()) / 60000))`.
- `responsavel = assignee.displayName || null`.
- Ordenar por `created asc`.

### 7.5 Incidentes por dia

- Contar **todas** as issues criadas no período (abertas ou resolvidas) da empresa.
- Janelas fixas: últimos 7 dias e últimos 30 dias, terminando no dia atual BRT, inclusive.
- Gerar rótulos `dd/mm` para todos os dias, valores inteiros, zero quando não houver.

### 7.6 MTTR

- Considerar issues da empresa com `resolutiondate` válida.
- Janela atual: últimos 30 dias BRT até agora (ou até fim do dia atual BRT; escolher uma regra simples e consistente, preferencialmente `now - 30d <= resolutiondate <= now`).
- `minutos = round(avg((resolutiondate - created) / 60000))`.
- `anterior_minutos`: mesma métrica na janela dos 30 dias anteriores à janela atual.
- Sem amostras na janela => `null`.
- `periodo`: `"(últimos 30d)"`.

### 7.7 Ranking problemáticos

- Base: issues criadas nos últimos 30d BRT, por `id_servidor`, da empresa.
- Apenas servidores ativos/visíveis carregados pelo MySQL para a sessão/empresa.
- Para cada servidor no top: `{ id_servidor, nome, situacao, incidentes }`.
- `nome` e `situacao`: reaproveitar dados já calculados por `dashGeralModel`.
- Incluir somente `incidentes > 0`, top 3, ordenar `incidentes desc, nome asc`.

---

## 8. Arquivos a criar/alterar

### 8.1 Criar

- `src/integrations/jira.js` (ou nome equivalente claro) — cliente Jira Cloud: env, auth, timeout, paginação, normalização, extração EMP/SRV.
- `src/services/jiraDashGeral.js` (ou nome equivalente claro) — cache, agregação por empresa, abertos, por_dia, mttr, ranking.

> Se preferir menos arquivos, pode concentrar em um módulo único, desde que responsabilidades fiquem claras e não duplique lógica.

### 8.2 Alterar

- `src/models/dashComplementosModel.js` — trocar stub por chamada real ao serviço Jira, com fallback vazio.
- `src/controllers/dashComplementosController.js` — passar `idEmpresa`/contexto necessário; tratar erro com warn + stub.
- `src/models/dashGeralModel.js` — preencher `ranking_problematicos` usando dados Jira; manter cálculo de saúde/disponibilidade intacto.
- `.env.example` — apenas se precisar esclarecer defaults/comentários; sem segredos.

### 8.3 Não alterar

- `public/html/dash-geral.html` (contrato já compatível).
- `public/js/dash-geral.js` (contrato já compatível).
- `public/css/*`, `app.js`, `src/routes/dashGeral.js`, `src/models/servidorModel.js`, `src/database/*`, SQL, ETL, Java, script Python.

---

## 9. Ordem de implementação sugerida

1. Confirmar branch e `git status`.
2. Criar cliente Jira (`src/integrations/jira.js`): config, fetch com timeout, auth, paginação, normalização.
3. Criar serviço de agregação (`src/services/jiraDashGeral.js`): parse EMP/SRV, filtros, abertos, buckets BRT, MTTR, ranking, cache.
4. Atualizar `dashComplementosModel.js` para usar serviço; manter fallback vazio.
5. Atualizar `dashComplementosController.js` para passar empresa e tratar falha sem 500.
6. Atualizar `dashGeralModel.js` para preencher `ranking_problematicos` via serviço/cache compartilhado; em falha manter `[]`.
7. Revisar `.env.example`/comentários se necessário.
8. Validar com Jira real/teste (seção 10).
9. Rodar `git status --short --branch` e resumir arquivos alterados. **Sem commit/push.**

---

## 10. Checklist de validação (Jira real/teste)

### 10.1 Configuração e segurança

- [ ] `.env.dev`/ambiente local com `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT`, `JIRA_API_PATH=/rest/api/3/search/jql`, `JIRA_TIMEOUT_MS`.
- [ ] Sem credenciais: `GET /dash-geral/incidentes` retorna 200 com stub vazio; `GET /dash-geral` retorna 200 com `ranking_problematicos: []`; logs com `console.warn`, sem segredo.
- [ ] Nenhuma credencial Jira commitada ou escrita em arquivo versionado.

### 10.2 Permissão e isolamento

- [ ] Sem sessão: 401 conforme middleware.
- [ ] `ADMIN/INFRATECH`: 403.
- [ ] Empresa inválida na sessão: 403.
- [ ] Gestor empresa 2 só vê issues `[EMP-2]...`, nunca issues de outra empresa.

### 10.3 Contrato

- [ ] `GET /dash-geral/incidentes` tem shape exato: `abertos`, `por_dia.7d/30d.rotulos/valores`, `mttr.minutos/periodo/anterior_minutos`.
- [ ] `GET /dash-geral` mantém contrato existente e preenche `ranking_problematicos` com `{id_servidor,nome,situacao,incidentes}`.
- [ ] `responsavel` está sempre presente nos abertos (`string` ou `null`).

### 10.4 Regras Jira

- [ ] Issue com summary `[EMP-2][SRV-3] ...` mapeia `id_empresa=2`, `id_servidor=3`.
- [ ] Nome do servidor vem do MySQL quando existir; fallback do summary/descrição quando não existir.
- [ ] Abertos incluem não-Done e excluem Done/Closed/Fechado/Resolvido/Cancelado. Issue aberta há >60d aparece.
- [ ] Prioridade: High/Highest=>`critico`, Medium=>`atencao`, Low/Lowest=>`normal`, ausente=>`normal`.
- [ ] `minutos` = agora - created.
- [ ] Assignee ausente => `responsavel: null`; front mostra “Sem atribuição”.
- [ ] `por_dia`: todas criadas no período, BRT, `dd/mm`, 7 e 30 pontos, zeros corretos.
- [ ] MTTR: média `resolved-created` dos resolvidos em 30d; `anterior_minutos` na janela anterior; sem dados => `null`.
- [ ] Ranking: top 3 por criadas em 30d, apenas servidores ativos/visíveis, `incidentes > 0`, ordem `incidentes desc, nome asc`.

### 10.5 Resiliência e desempenho

- [ ] Jira timeout/5xx/401: rota retorna 200 com stub vazio; `console.warn`; dash principal não quebra.
- [ ] Refresh do front (5 min) não gera estouro de chamadas; cache TTL efetivo.
- [ ] `/dash-geral` e `/dash-geral/incidentes` no mesmo ciclo não duplicam busca desnecessariamente (reuso de cache/serviço).

### 10.6 Regressão

- [ ] Saúde/disponibilidade da frota não foram alteradas.

---

## 11. Riscos e dependências

- **Formato real da API Jira Cloud**: validar `search/jql`, paginação `nextPageToken/isLast` e presença de `statusCategory` na instância de teste. Ajustar parsing de resposta sem quebrar contrato.
- **Volume de issues não-Done antigas**: JQL pode trazer muitas issues abertas antigas; paginação e limite de segurança são obrigatórios.
- **Padrão EMP/SRV**: dependência externa do Java. Issue sem padrão não pode ser vinculada com segurança; ignorar e logar contagem se útil.
- **Sem mock local**: validação depende de acesso Jira real/teste; se ambiente não tiver credencial, validar ao menos caminho de stub vazio e não-regressão.
- **Semântica de ranking**: definida como issues criadas em 30d (não abertas atuais). Isso é intencional e deve ficar claro em comentário curto no código.

---

## 12. Definition of done

- Código implementado apenas no escopo da seção 8, sem commit/push.
- `GET /dash-geral/incidentes` retorna dados reais do Jira quando configurado; stub vazio + warn quando indisponível.
- `GET /dash-geral` preenche `ranking_problematicos` com dados Jira, mantendo saúde/disponibilidade.
- Isolamento por empresa e permissão de dashboard preservados.
- Checklist da seção 10 executado manualmente (ou registrado o que não pôde ser validado por falta de credencial Jira).
- `git status --short --branch` conferido ao final.