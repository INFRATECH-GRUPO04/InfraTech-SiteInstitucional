# Plano de implementação — Dashboard Geral

## 0. Como usar este documento em uma sessão nova

Este arquivo é **autossuficiente**: para implementar, basta ler este plano, o `AGENTS.md` da raiz do repo e os arquivos citados. Não é necessário histórico de conversa. As decisões da seção 2 são finais, sem pendências.

- Plano do repo irmão de ETL: `../etl/docs/plano-implementacao.md` (absoluto: `C:\Users\Luiz\Documents\-- SPTech repositories\etl\docs\plano-implementacao.md`). **Os dois documentos têm o mesmo contrato de JSON; se um mudar, o outro muda junto.**
- Ordem recomendada: backend deste repo → front → ETL. Para testar antes da ETL, coloque `dash-geral.json` manualmente no bucket pessoal e aponte `S3_BUCKET` (com `S3_GOLD_PREFIX=03-gold/`).
- Com `DASH_GOLD_LOCAL=1`, o model lê `03-gold/empresa-{id}/dash-geral.json` a partir da raiz do projeto (cwd do `npm run dev`).

Estado atual do código que este plano altera (conferido em 22/11/2026):

- `public/js/dash-geral.js`: começa com o objeto `MOCK` (linhas ~12–73) e não faz `fetch`. `renderizarTudo()` desenha KPIs, tabela, ranking, incidentes e IA; `criarGraficoDisp()` / `criarGraficoIncidentes()` usam Chart.js via CDN. O relógio é escrito duas vezes: aqui (linha ~138) e em `dashboard-data.js` — remover a duplicação daqui.
- `public/js/dashboard-data.js`: fornece `window.InfraTechAlertas.classificar()` e é o único escritor que deve restar para `#relogio`.
- `src/models/servidorModel.js` (linhas ~157–171): ainda usa `limite_alerta_global`; `src/routes/servidor.js` (linhas ~33–34) mantém `GET/PUT /servidor/alertas/globais/:idEmpresa`, com `var permitir = require("../seguranca/autorizacao").exigirPermissao;` no topo.
- Proteção: `src/seguranca/autorizacao.js` — `autenticar` preenche `req.usuario` com `{ id, empresa, nome, email, cargo, exp }`; `exigirPermissao` verifica `public/js/permissoes.js`. As rotas chamam `exigirPermissao('monitorar')` (alias local `permitir`).
- `app.js` lê `.env.dev` quando `AMBIENTE_PROCESSO=desenvolvimento`, usa `APP_PORT` (3333 no `.env.dev`) e monta routers com `app.use('/...', autorizacao.autenticar, router)`.
- Dependências já no `package.json`: `@aws-sdk/client-s3`, `mysql2`, `dotenv`, `chart.js`. Não instalar nada novo.
- Execução: `npm install` e `npm run dev`. Não há testes, lint ou CI; validação é manual.
- Logins do seed para validação (`src/database/infratech-atualizado.sql`): `alexandre@gamecloud.com` / `senha123` (GESTOR, empresa 2) e `felipe@infratech.com` / `123456` (ADMIN, empresa 1 — deve receber 403 na rota nova).

---

## 1. Objetivo e escopo

Transformar a `dash-geral.html`, hoje 100% mockada, em uma tela alimentada por **um único JSON**, do silver até o navegador:

```
capturas silver
  └─ silver2gold.py (repo de ETL) → 03-gold/empresa-{id}/dash-geral.json
       └─ dashGeralModel (gold + MySQL + Jira) → dashGeralController
            └─ GET /dash-geral → dash-geral.js (um fetch) → renderiza tudo
```

Escopo desta entrega: **apenas `dash-geral.html`**. `dash-especifica`, `dashboardV2`, `dashboard.html` e as páginas "em breve" permanecem como estão.

Regras gerais:

- **Um único contrato de JSON** do gold até a resposta da rota. O backend preenche campos vazios; ele não converte a estrutura.
- **Código curto**: sem ORM, sem nova biblioteca no Node, sem build step, sem camadas extras. `fetch` nativo para Jira, AWS SDK já instalado para S3, MySQL via `mysql2`.
- Nomenclatura: `snake_case` nos dados/JSON/SQL, `camelCase` nas variáveis JavaScript (convenção já usada no repo).

---

## 2. Decisões fechadas

| Ponto | Decisão |
| --- | --- |
| `silver2gold.py` | Fica no repositório de ETL. Aqui está especificado o formato de saída; o script não será criado neste repo. |
| Formato do JSON | O formato proposto para o gold, estendido com os campos que a tela lê. O front se adapta a ele. |
| Jira | `fetch` nativo com `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT`. Sem credenciais, devolve vazio e segue funcionando. |
| Relatório de IA | Template simples montado no backend com os próprios dados da dash. Depois pode ser trocado por um serviço real sem mudar o JSON. |
| Leitura do gold | S3 por padrão: `S3_BUCKET` com `S3_GOLD_PREFIX` (default `03-gold/`), formando `s3://<S3_BUCKET>/<S3_GOLD_PREFIX>/empresa-{id}/dash-geral.json`. `DASH_GOLD_LOCAL=1` força leitura de `03-gold/` no disco. Para testar antes da ETL, basta subir `dash-geral.json` manualmente para um bucket pessoal e apontar `S3_BUCKET` para ele. |
| Rota | `GET /dash-geral` **sem ID na URL**. A empresa vem da sessão (`req.usuario.empresa`), nunca do front. |
| Banco de dados | **Único script válido: `src/database/infratech-atualizado.sql`**. O script `SCRIPT-INFRATECH.sql` foi removido. Tudo que só existe nele (`limite_alerta_global`, `modelo`, `numero_serie`) não faz parte do projeto. |
| Regras do `AGENTS.md` | Empresa isolada pela sessão; só servidores ativos e visíveis ao cargo; **sem dados mostra "sem dados", nunca zero falso**; Jira é somente leitura nesta entrega (não abre chamados nem notifica). |
| Repositórios | Este plano mexe **apenas** em `InfraTech-SiteInstitucional`. A ETL tem plano próprio em `etl/docs/plano-implementacao.md`. Os dois repos se encontram somente no arquivo `03-gold/empresa-{id}/dash-geral.json`; o script de captura não muda. |

---

## 3. Banco de dados — fonte da verdade

`src/database/infratech-atualizado.sql` é o único script de schema e seed. Tabelas usadas por esta entrega:

| Tabela | Uso na dash |
| --- | --- |
| `empresa` | isolamento por empresa (via sessão) |
| `funcionario` (`tipo_acesso`) | diferenciar gestor, analistas e funcionários |
| `servidor` (`id_servidor`, `fk_empresa`, `nome`, `localizacao`, `status_sistema`, `dt_ultimo_envio`) | nome/cidade, frescor e filtro de servidores ativos |
| `servidor_funcionario` (`fk_funcionario`, `fk_servidor`) | regra de visibilidade por vínculo |
| `componente` (`tipo`, `fk_servidor`) | localizar os limites por recursos `cpu`, `ram`, `disco` |
| `metrica` (`nome`, `limite_atencao`, `limite_critico`, `fk_componente`) | classificar a leitura como normal/atenção/crítico |

### Ajuste obrigatório: limites "globais" sem tabela própria

O código atual de `servidorModel.js` usa `limite_alerta_global`, que **não existe no script final**. A tabela e suas colunas não devem ser recriadas. Em vez disso:

- `listarLimitesGlobais(idEmpresa)` passa a derivar os limites de `metrica`:

  ```sql
  SELECT c.tipo AS tipo,
         MIN(m.limite_atencao) AS limite_atencao,
         MIN(m.limite_critico) AS limite_critico
  FROM metrica m
  JOIN componente c ON c.id_componente = m.fk_componente
  JOIN servidor s ON s.id_servidor = c.fk_servidor
  WHERE s.fk_empresa = ? AND m.nome = 'uso_percentual'
  GROUP BY c.tipo;
  ```

- `salvarLimitesGlobais(idEmpresa, limites)` passa a atualizar todas as métricas `uso_percentual` da empresa cujo `componente.tipo` corresponde ao recurso enviado (`UPDATE metrica m JOIN componente c ... JOIN servidor s ... WHERE s.fk_empresa = ? AND c.tipo = ? AND m.nome = 'uso_percentual'`).
- As rotas `GET/PUT /servidor/alertas/globais/:idEmpresa`, os controllers e o `dashboard-data.js` **continuam com o mesmo contrato** (`tipo`, `limite_atencao`, `limite_critico`), apenas a origem muda.
- Se não houver métrica cadastrada, o front já tem o fallback `PADRAO` em `dashboard-data.js` (cpu 70/85, ram 75/90, disco 80/90, rede 70/90) e o backend usa esses mesmos valores.

Isso elimina a dependência da tabela inexistente sem mexer na UI de limites das outras dashes.

---

## 4. Contrato único do JSON

Arquivo: `03-gold/empresa-{id}/dash-geral.json`. A resposta de `GET /dash-geral` tem **exatamente o mesmo formato**, com os campos vazios preenchidos.

```json
{
  "versao": 1,
  "id_empresa": 2,
  "gerado_em": "2026-11-21T13:10:00-03:00",
  "ambiente": "Produção",
  "servidores": [
    {
      "id_servidor": 4,
      "nome": "SRV-GAMECLOUD-01",
      "cidade": "São Paulo",
      "conexao": "online",
      "ultima_leitura": "2026-11-21T13:08:00-03:00",
      "tempo_min": null,
      "situacao": "critico",
      "inc7d": 3,
      "atual": { "cpu": 95, "ram": 87, "disco": 82 },
      "disponibilidade_pct": { "24h": 99.2 }
    }
  ],
  "disponibilidade_frota": {
    "24h": { "rotulos": [], "valores": [], "media": null, "anterior": null },
    "7d":  { "rotulos": [], "valores": [], "media": null, "anterior": null },
    "30d": { "rotulos": [], "valores": [], "media": null, "anterior": null }
  },
  "incidentes": {
    "abertos": [],
    "por_dia": {
      "7d":  { "rotulos": [], "valores": [], "anterior": null },
      "30d": { "rotulos": [], "valores": [], "anterior": null }
    },
    "mttr": { "minutos": null, "periodo": "(últimos 30d)" }
  },
  "relatorio_ia": {
    "gerado_em": null,
    "resumo": "",
    "pontos": [],
    "recomendacoes": []
  }
}
```

Diferença em relação ao rascunho original: `incidentes` e `relatorio_ia` são **objetos com as chaves já presentes** (não `null`) para o front nunca precisar de verificações de existência. No gold, os campos de responsabilidade do backend ficam `null`/`""`/`[]`.

### Origem de cada campo

| Campo | Responsável | Origem |
| --- | --- | --- |
| `versao`, `id_empresa`, `gerado_em` | ETL | constante `1`, empresa do lote, instante da geração |
| `ambiente` | Backend | constante `"Produção"` |
| `id_servidor`, `atual`, `ultima_leitura`, `conexao` | ETL | capturas da silver |
| `nome`, `cidade` | Backend | `servidor.nome`, `servidor.localizacao` |
| `disponibilidade_pct` (somente `24h`), `disponibilidade_frota` | ETL | agregação das capturas |
| `tempo_min`, `situacao` | Backend | frescor da leitura + `metrica` |
| `inc7d`, `incidentes.*` | Backend | Jira |
| `relatorio_ia.*` | Backend | template a partir do próprio JSON |

---

## 5. Regras de cálculo

### 5.1 ETL (`silver2gold.py`, fora deste repo)

Entrada: os CSVs já lidos por `silver2gold.py` em `02-silver/metricas/` (`id_empresa`, `id_servidor`, `data_hora`, `cpu`, `ram`, `disco`). A cadência esperada vem de `FREQUENCIA_ESPERADA_SEGUNDOS` (default `60`).

- `atual`: última captura de cada servidor (`cpu`, `ram`, `disco`).
- `conexao`: `online` se a idade da última captura estiver dentro de `OFFLINE_TIMEOUT_SECONDS` (o script já usa `900` s por padrão); senão `offline`.
- Disponibilidade de um servidor em uma janela: `min(100, amostras_recebidas / amostras_esperadas × 100)`, onde `amostras_esperadas = janela_segundos / FREQUENCIA_ESPERADA_SEGUNDOS`.
- **Sem nenhuma captura na silver, a disponibilidade é `null`** — a dash mostra "sem dados", nunca `0` falso. Se o servidor tem histórico mas não tem amostras dentro da janela, aí sim o valor `0` é legítimo.
- `disponibilidade_pct`: apenas `24h`. As janelas `7d` e `30d` existem só em `disponibilidade_frota`, que é o que os gráficos leem.
- `disponibilidade_frota[periodo]`:
  - `24h` → 24 buckets horários, rótulos `HHh`; `7d` → 7 dias, rótulos `Seg…Dom`; `30d` → 30 dias, rótulos `dd/mm`.
  - Cada `valores[i]` é a média da disponibilidade dos servidores naquele bucket; bucket sem nenhum dado vira `null`.
  - `media` = média dos valores não nulos; `anterior` = mesma média na janela imediatamente anterior. Se tudo for nulo, `media` e `anterior` ficam `null`.
- `incidentes` e `relatorio_ia`: estruturas vazias, exatamente como no contrato.
- Saída: `03-gold/empresa-{id}/dash-geral.json` (S3 ou pasta local), gravado por empresa.

### 5.2 Backend — filtro de empresa e visibilidade

Antes de montar a resposta, aplicar as regras do `AGENTS.md`:

- A empresa é sempre `req.usuario.empresa`. A rota não recebe ID do usuário nem da URL.
- Cargos internos (`ADMIN`, `INFRATECH`) não acessam dashboards de clientes → `403`.
- Só entram servidores com `status_sistema = 1` e `fk_empresa` igual ao da sessão (exclusão é lógica).
- `GESTOR` vê todos os servidores da empresa.
- `ANALISTA_DADOS`, `ANALISTA_NOC` e `FUNCIONARIO`: se houver algum vínculo em `servidor_funcionario`, veem apenas os servidores vinculados; sem nenhum vínculo, veem todos.

O JSON do gold pode conter mais servidores do que a pessoa tem permissão para ver; o filtro acontece no backend, antes de devolver a resposta.

### 5.3 Backend — situação dos servidores

Para cada servidor que passou no filtro:

1. Se `conexao === "offline"`: `situacao = "offline"` e `tempo_min` = diferença em minutos entre `agora` e `ultima_leitura`; senão `tempo_min = null`. A decisão de `offline` já vem da ETL; o backend não refaz essa regra.
2. Online: buscar em `metrica` (via `componente`) os limites de `uso_percentual` para `cpu`, `ram` e `disco` daquele servidor. Se não houver, usar os derivados por empresa e, por fim, os padrões 70/85, 75/90, 80/90.
3. Para cada recurso: `valor >= limite_critico → critico`; `valor >= limite_atencao → atencao`; senão `normal`. `situacao` recebe a pior classificação entre os três recursos.
4. `disp` da tela = `disponibilidade_pct["24h"]`. `inc7d` = quantidade de chamados Jira do servidor criados nos últimos 7 dias.

A coloração das células de CPU/RAM/Disco continua usando `window.InfraTechAlertas.classificar()` no front, alimentada por `/servidor/listarComponentes/:idServidor`. Isso é intencional: a dash usa a `situacao` calculada no backend e mantém o detalhe por métrica no front, sem código novo.

### 5.4 Backend — Jira

Variáveis em `.env.example` / `.env.dev`:

```env
JIRA_BASE_URL=https://sua-instancia.atlassian.net
JIRA_EMAIL=usuario@empresa.com
JIRA_TOKEN=token_da_api
JIRA_PROJECT=INFRA
JIRA_API_PATH=/rest/api/3/search/jql
JIRA_TIMEOUT_MS=5000
```

- Autenticação Basic com `email:token` em base64; `fetch` nativo com `AbortSignal.timeout`.
- Convenção de labels: `empresa-{id_empresa}` e `servidor-{id_servidor}`. Se o servidor não tiver label, o campo `servidor` fica vazio (a tela mostra `—`). Essa convenção deve ser confirmada quando houver credenciais reais.
- Campos buscados: `key`, `summary`, `status`, `priority`, `created`, `resolutiondate`, `labels`.
- Mapeamento:
  - `abertos[]`: `{ id: key, servidor: nome do servidor, prioridade: critico|atencao|normal, minutos: (agora - created)/60000 }`. Prioridades `Highest/Critical/Blocker → critico`, `High → atencao`, demais → `normal`.
  - `por_dia["7d"|"30d"]`: contagem de issues criadas por dia; `anterior` = contagem da janela anterior de mesma largura.
  - `mttr.minutos`: média de `resolutiondate - created` das issues resolvidas nos últimos 30 dias; `null` se não houver.
- Qualquer falha (sem env, 401, timeout, JSON inválido) é logada com `console.warn` e resulta em `abertos: []`, séries vazias e `mttr.minutos: null`. A rota **nunca** devolve erro por causa do Jira.
- **Esta entrega apenas lê o Jira** para popular a dash. Não abre chamados e não envia notificações Slack/Jira — isso continua fora do escopo, conforme `AGENTS.md`.

### 5.5 Backend — relatório de IA

Template curto, sem serviço externo:

- `resumo`: contagens de servidores normais, em atenção, críticos, offline e de incidentes abertos.
- `pontos`: até 3 servidores com pior `situacao` / menor disponibilidade.
- `recomendacoes`: 2 a 3 frases montadas a partir desses pontos (ex.: "Verificar CPU de SRV-GAMECLOUD-01, em 95%.").
- `gerado_em`: `new Date().toISOString()`.
- Sem dados suficientes, `resumo` diz "Sem dados para análise" e as listas ficam vazias — nunca inventar número.

O botão "Atualizar análise" chama novamente a mesma rota e re-renderiza; não há mais `setTimeout` simulado.

---

## 6. Mudanças por arquivo

| Arquivo | Mudança prevista |
|---|---|
| `src/models/dashGeralModel.js` (novo) | ler gold (S3/local), filtrar servidores ativos/visíveis, consultar MySQL e Jira, calcular situação e montar o JSON. ~120 linhas |
| `src/controllers/dashGeralController.js` (novo) | usar `req.usuario.empresa`, bloquear cargos internos, chamar o model, responder 200/403/404/503. ~30 linhas |
| `src/routes/dashGeral.js` (novo) | `GET /` com `exigirPermissao('monitorar')`. ~6 linhas |
| `app.js` | montar `app.use("/dash-geral", autorizacao.autenticar, dashGeralRouter)` |
| `src/models/servidorModel.js` | trocar `limite_alerta_global` por consultas em `metrica`/`componente`/`servidor` (GET derivado e PUT em lote) |
| `.env.example` | adicionar `S3_GOLD_PREFIX`, `DASH_GOLD_LOCAL`, `JIRA_*` (bucket já é `S3_BUCKET`) |
| `public/js/dash-geral.js` | substituir `MOCK` por um `fetch`, adaptar leitura dos campos, remover relógio duplicado, ligar o botão de IA ao refetch. ~50 linhas alteradas |
| `.gitignore` | remover a linha `docs` para o plano versionar |
| `src/database/SCRIPT-INFRATECH.sql` | **removido** (decisão deste plano) |

`dash-geral.html` e `dash-geral.css` não precisam mudar: todos os IDs e classes já existem.

Permissão: `exigirPermissao('monitorar')` é concedida a todo cargo que acessa alguma dash (`public/js/permissoes.js`). O bloqueio de `ADMIN`/`INFRATECH` é explícito no controller, porque a regra "equipe interna não vê dashboards de clientes" não vem dessa permissão.

---

## 7. Adaptação no front (`public/js/dash-geral.js`)

- `DOMContentLoaded` chama `carregarDados()`: `fetch('/dash-geral', { cache: 'no-store' })` → `dados = await resposta.json()` → criar os dois gráficos → `renderizarTudo()`. O ID da empresa não vai na URL; a sessão já resolve isso no backend.
- Substituições de leitura:

| Antes (MOCK) | Depois (JSON único) |
| --- | --- |
| `MOCK.ambiente` | `dados.ambiente` |
| `s.cpu`, `s.ram`, `s.disco` | `s.atual.cpu`, `s.atual.ram`, `s.atual.disco` |
| `s.disp` | `s.disponibilidade_pct['24h']` |
| `s.tempoMin` | `s.tempo_min` |
| `s.id` | `s.id_servidor` |
| `MOCK.incidentesAbertos` | `dados.incidentes.abertos` |
| `MOCK.mttr` | `dados.incidentes.mttr` |
| `MOCK.disponibilidade[periodo]` | `dados.disponibilidade_frota[periodo]` |
| `MOCK.incidentesPorDia[periodo]` | `dados.incidentes.por_dia[periodo]` |
| `MOCK.ia` | `dados.relatorio_ia` (`gerado_em` passa por `new Date(...)`) |

- Filtros de período continuam apenas trocando os dados do Chart.js; não disparam novas requisições.
- Valores `null` em `disponibilidade_pct` ou em `valores` devem aparecer como "sem dados" (o front já trata `disp === null`); ao calcular a média exibida, ignorar posições nulas para não mostrar `NaN`.
- Enquanto carrega, mostrar "Carregando…" nos cards; em erro, mensagem simples e `console.error`. Sem fallback para mock, para esconder falhas.
- `dashboard-data.js` continua carregado: fornece `InfraTechAlertas` e é o único escritor de `#relogio` (remover a função de relógio duplicada em `dash-geral.js`).

---

## 8. Fora de escopo e pendências registradas

- `dash-especifica`, `dashboardV2` e `dashboard.html` seguem mockadas. Os links da dash-geral passam a usar o ID numérico real (`?servidor=4`).
- O relatório de IA é um template, não um modelo de IA real; o formato do JSON já permite trocar depois.
- A convenção de labels do Jira (`empresa-{id}`, `servidor-{id}`) precisa ser confirmada quando as credenciais existirem. Abertura de chamados e notificações Slack/Jira não entram nesta entrega.
- `serie_24h` e `disponibilidade_pct` nas janelas `7d`/`30d` foram removidos do contrato: a dash-geral não lê esses campos. Se a dash-específica precisar depois, eles voltam em uma rodada futura.
- `AGENTS.md` é compartilhado entre os três repositórios; não foi alterado. A nota dele sobre `limite_alerta_global` está desatualizada e foi superada pela decisão deste plano.
- Para o primeiro teste, a ETL pode ser pulada: basta colocar `dash-geral.json` manualmente em `03-gold/` de um bucket pessoal e configurar `S3_BUCKET` (com `S3_GOLD_PREFIX=03-gold/`).
- `infratech-atualizado.sql` usa `CREATE DATABASE infratech;` sem `IF NOT EXISTS` e não é idempotente — manter como está, pois é a fonte da verdade.
- `AWS_REGION` não está declarado nos `.env`; o SDK assume `us-east-1`.
- `dashboard-global.css` ancora regras antigas das KPIs da dash-geral (`.kpi-card--rede`, `.kpi-card--problemas`) sem correspondência no HTML atual; limpeza futura, sem impacto funcional.
- Não há testes automatizados, lint ou CI; validação é manual.

---

## 9. Ordem de execução

1. Confirmar este documento e ajustar `.gitignore` / remover o script SQL antigo (feito nesta etapa).
2. Backend: model → controller → rota → `app.js`, ajuste dos limites em `servidorModel.js`, filtro de visibilidade e variáveis de ambiente.
3. Front: `fetch` único e substituições da seção 7.
4. Teste com `dash-geral.json` manual no bucket pessoal (`S3_BUCKET` + `S3_GOLD_PREFIX=03-gold/`) ou em `03-gold/` local (`DASH_GOLD_LOCAL=1`).
5. ETL: executar o plano do repo `etl` (`etl/docs/plano-implementacao.md`), que ajusta `silver2gold.py` para gerar `03-gold/empresa-{id}/dash-geral.json` conforme a seção 5.1. Nenhum código é compartilhado entre os repos; o acoplamento é só esse JSON no S3.
6. Validação manual final e ajustes.

---

## 10. Checklist de validação

1. `npm run dev` com `S3_BUCKET` apontando para o bucket pessoal e `S3_GOLD_PREFIX=03-gold/` (ou `DASH_GOLD_LOCAL=1` com `03-gold/empresa-2/dash-geral.json`) e um JSON manual de exemplo.
2. `GET /dash-geral` com cookie de sessão devolve o JSON da empresa da sessão; sem sessão retorna 401; cargo `ADMIN`/`INFRATECH` retorna 403; sem gold retorna 404.
3. Abrir `/dashboard/dash-geral.html`: KPIs, gráfico de disponibilidade (24h/7d/30d), gráfico de incidentes (7d/30d), tabela de status, ranking, tabela de incidentes e card de IA preenchidos.
4. Visibilidade: gestor vê todos os servidores ativos da empresa; funcionário com vínculo vê só os vinculados; sem vínculo vê todos; servidor com `status_sistema = 0` não aparece.
5. JSON com disponibilidade `null` mostra "sem dados" na tela, sem `NaN` e sem `0` falso.
6. Sem `JIRA_*`: `incidentes.abertos = []`, `mttr.minutos = null` e a dash continua renderizando.
7. Sem linhas em `metrica`: limites caem para os padrões e a classificação funciona.
8. `GET /servidor/alertas/globais/2` continua respondendo depois da troca para `metrica`, e o PUT de limites atualiza as métricas da empresa.
9. Botão "Atualizar análise" gera novo `gerado_em` sem erro.
