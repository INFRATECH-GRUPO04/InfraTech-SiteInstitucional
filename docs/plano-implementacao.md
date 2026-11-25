# Plano de implementação — Dashboard Geral v2 revisada (25/11/2026)

**Status:** decisões fechadas, pronto para execução em modo Build.  
**Regra desta entrega:** **não dar commit, não dar push**. Todas as alterações devem ficar no working tree para revisão do usuário.

## 0. Como usar este documento

Este arquivo é **autossuficiente**: uma sessão nova, sem histórico de conversa, consegue executar a entrega lendo apenas este plano. Não é necessário recuperar a conversa anterior.

- A execução altera **dois repositórios**:
  - Site: `/home/luiz/Documentos/repositories/InfraTech-SiteInstitucional`
  - ETL: `/home/luiz/Documentos/repositories/etl`
- Antes de começar, rode `git status --short --branch` nos dois. Se houver alteração não commitada além deste próprio arquivo, **pare e pergunte**.
- Trabalhe nas branches atuais (`feat/dash-luiz` nos dois, conferir no `git status`). Não crie branch nova.
- Ordem: **Site (backend/docs/front) → ETL → validação manual**.
- Não há testes automatizados, lint ou CI. Valide manualmente conforme a seção 11.
- Em caso de divergência entre este plano e o código atual, **o código atual vale mais**. Se algo faltar ou parecer ambíguo, pergunte antes de assumir.
- Este plano é a única fonte desta rodada. **Não crie outro arquivo de plano.**

---

## 1. Contexto mínimo do projeto

- Projeto acadêmico InfraTech (SPTech, 2026.2): monitoramento de **servidores físicos** de jogos online. Personas: **gestor**, **analista de dados** e **analista NOC**. A tela tratada aqui é a **dash-geral do gestor**.
- Fluxo de dados:

  ```
  script Python local → POST /agente/enviar → 01-bronze/
  → bronze2silver.py → 02-silver/metricas/empresa_id=…/servidor_id=…/data=AAAA-MM-DD/
  → silver2gold.py → 03-gold/empresa-{id}/dash-geral.json
  → GET /dash-geral (Node/Express) → public/js/dash-geral.js
  ```

- **Não existe `latest.json` em nenhum prefixo.** Não crie.
- O agente coleta 1 vez por minuto e envia lotes de 10 capturas. `data_hora` no CSV é **hora local de Brasília, sem sufixo** (ex.: `2026-11-25 14:29:00`). O `Z` no nome do lote é enganoso: **não use esse `Z` para interpretar data**.
- Um lote que cruza meia-noite gera dois arquivos na silver com o mesmo `lote`, em partições `data=` diferentes. Isso é esperado.
- Isolamento por empresa: toda consulta usa `fk_empresa` da sessão. **Nunca confie em ID de empresa vindo do front/URL.**
- Gestor vê todos os servidores da empresa. Demais cargos veem os vinculados em `servidor_funcionario`; sem vínculo, veem todos. `status_sistema = 0` nunca aparece.
- `ADMIN` e `INFRATECH` são equipe interna e **não acessam dashboards de clientes**.
- Tema escuro, destaque ciano `#00CFFF`, fontes Inter e JetBrains Mono. Cada tela tem CSS próprio; **não refatore `global.css`**.
- Fora de escopo nesta entrega: Jira real, Relatório de IA real, `script_python/`, `logs/` (Java de alertas), `bronze2silver.py`, schema SQL, `app.js`, microtransações, nuvem/containers, correção automática, app mobile, Slack/Jira por cliente, hardening de segurança, SSO, exportação, ML, tempo real < 1 min.
- Não instalar dependências novas. Chart.js já vem por CDN no HTML; `@aws-sdk/client-s3`, `mysql2`, `dotenv` e `boto3` já existem.

---

## 2. Estado atual conferido

### Site

- Branch `feat/dash-luiz`, HEAD local `dde9ca7` (`feat: contrato v2 da dash-geral com saude agregada`). `origin/feat/dash-luiz` está em `68cb18d`; local está **à frente 1, sem push**.
- Neste momento, o único arquivo modificado esperado é **este plano** (`docs/plano-implementacao.md`).
- Já existem e funcionam:
  - `src/routes/dashGeral.js` com `GET /`, `GET /incidentes`, `GET /relatorio-ia`.
  - `src/controllers/dashGeralController.js` com 401 via middleware, 403 para internos, 404 sem gold, 503 genérico.
  - `src/models/dashComplementosModel.js` e `src/controllers/dashComplementosController.js` devolvendo estruturas vazias.
  - `app.use("/dash-geral", autorizacao.autenticar, dashGeralRouter)` em `app.js`. **Não mexer no `app.js`.**
  - `src/models/servidorModel.js` deriva limites globais de `metrica`/`componente`/`servidor`. **Não mexer.**
- `src/models/dashGeralModel.js` hoje devolve `ambiente: 'Produção'` e `meta_sla`, além do contrato agregado. É aqui que esses dois campos saem.
- `public/html/dash-geral.html`, `public/css/dash-geral.css` e `public/js/dash-geral.js` ainda têm: botão “Produção”, relógio ao vivo, “SLA / Disponibilidade”, “Meta 99,0%”, linha tracejada da meta, donut de 3 fatias e 3 contadores no topo.
- `app.js` fixa `ambiente_processo = 'desenvolvimento'` e carrega `.env.dev`. Porta local: **3333**. Banco local: container `infratech-mysql` (MySQL 8, root/root, porta 3306, banco `infratech`).
- Schema/seed: `src/database/infratech-atualizado.sql`. Empresa 2 (`GameCloud`) tem servidores ativos `3` e `4` e o inativo `5`.
- Logins de teste:
  - `alexandre@gamecloud.com` / `senha123` — GESTOR da empresa 2.
  - `felipe@infratech.com` / `123456` — ADMIN (deve receber 403).
  - `luana@techplay.com` / `senhaLp1` — empresa sem fixture (deve receber 404).
- `.env.dev` já tem `DASH_GOLD_LOCAL=1`. `03-gold/` é ignorado pelo Git.

### ETL

- Branch `feat/dash-luiz`, HEAD local `e1f51ed` (`feat: filtro de 40 dias e contrato v2 do gold`). `origin/feat/dash-luiz` está em `550f236`; local está **à frente 1, sem push**.
- Working tree limpo.
- `silver2gold.py` é script de topo (sem `lambda_handler`), usa `boto3.client('s3')` com cadeia padrão de credenciais.
- Já filtra 40 dias pela chave `data=` antes do `GetObject` e já grava `versao: 2` com `servidores[]` e `disponibilidade_frota`.
- Ainda calcula janelas **móveis de 24h** (não dias de calendário), rótulos `Seg/Ter/...` no `7d`, e faz média simples dos percentuais por servidor. É isso que muda nesta entrega.
- `.env.example` já declara `TIMEZONE=America/Sao_Paulo`, `OFFLINE_TIMEOUT_SECONDS=900` e `FREQUENCIA_ESPERADA_SEGUNDOS=60`.

---

## 3. Decisões fechadas

1. Remover **“Produção” somente da dash-geral** (botão no HTML e campo `ambiente` na API). Não mexer em `dash-especifica.html`, `dashboard.html` nem `index.html`.
2. Remover a **meta de SLA somente da dash-geral** (título, texto “Meta 99,0%”, linha tracejada, tooltip e campo `meta_sla`). Não mexer em textos institucionais nem no dashboard antigo.
3. Substituir o relógio ao vivo por **“Dados gerados em DD/MM/AAAA HH:mm”**, usando `gerado_em` do gold, formatado no fuso `America/Sao_Paulo` no navegador. Sem segundos. Se inválido: “Dados gerados em —”.
4. Gráfico de disponibilidade: **dias de calendário**, incluindo hoje proporcional até `gerado_em`; 7 pontos em `7d` e 30 em `30d`; rótulos sempre `dd/mm`.
5. Dias sem captura: `null` antes da primeira captura do servidor; `0%` depois que ele já era monitorado e não enviou nada.
6. Disponibilidade da frota por dia: **ponderada por capturas recebidas ÷ esperadas**. Não é média simples de percentuais.
7. Visibilidade do gráfico: aceitar a limitação atual (mostra a frota que tem dados na empresa; a saúde já filtra ativo/vínculo). Não acrescentar série por servidor.
8. Eixo Y sem meta: **adaptativo**, começando em múltiplo de 5 estritamente abaixo do menor valor, com máximo 100.
9. `pct_saudavel = normais / total` (já implementado; manter).
10. Donut de saúde com **4 fatias**: normal (verde), atenção (amarelo), crítico (vermelho), offline (cinza).
11. Topo com **4 contadores**: normais, atenção, crítico, offline.
12. Atualização automática a cada **5 minutos**, silenciosa, sem chamadas sobrepostas e pausada com a aba oculta.
13. Cards de Jira/IA continuam **visíveis e vazios**. Botão “Atualizar análise” continua buscando só `/dash-geral/relatorio-ia`.
14. Manter `versao: 2` no gold e na API (não bumpar).

---

## 4. Contratos de JSON

### 4.1 Saída da ETL — `03-gold/empresa-{id}/dash-geral.json`

É o **input do backend**, não o que o navegador consome. Formato final:

```json
{
  "versao": 2,
  "id_empresa": 2,
  "gerado_em": "2026-11-25T14:30:00-03:00",
  "servidores": [
    {
      "id_servidor": 3,
      "conexao": "online",
      "ultima_leitura": "2026-11-25T14:29:00-03:00",
      "atual": { "cpu": 93.4, "ram": 88.2, "disco": 71.5 }
    },
    {
      "id_servidor": 4,
      "conexao": "offline",
      "ultima_leitura": "2026-11-25T13:50:00-03:00",
      "atual": { "cpu": 41.2, "ram": 55.8, "disco": 63.1 }
    }
  ],
  "disponibilidade_frota": {
    "7d": {
      "rotulos": ["19/11", "20/11", "21/11", "22/11", "23/11", "24/11", "25/11"],
      "valores": [99.8, 99.9, 99.8, 99.8, 100.0, 99.8, 97.3]
    },
    "30d": {
      "rotulos": [
        "27/10", "28/10", "29/10", "30/10", "31/10",
        "01/11", "02/11", "03/11", "04/11", "05/11",
        "06/11", "07/11", "08/11", "09/11", "10/11",
        "11/11", "12/11", "13/11", "14/11", "15/11",
        "16/11", "17/11", "18/11", "19/11", "20/11",
        "21/11", "22/11", "23/11", "24/11", "25/11"
      ],
      "valores": [
        99.8, 99.9, 99.9, 99.9, 100.0, 99.8, 99.9, 99.9, 99.8, 99.9,
        99.8, 100.0, 99.9, 100.0, 99.8, 99.9, 99.9, 99.9, 99.7, 100.0,
        99.8, 99.9, 99.9, 99.8, 99.9, 99.8, 99.8, 100.0, 99.8, 97.3
      ]
    }
  }
}
```

Regras do gold:

- `gerado_em` é o instante em que o `silver2gold.py` iniciou, em ISO com offset de Brasília.
- `servidores[]` só contém servidores com pelo menos uma captura dentro dos 40 dias.
- `conexao` usa `OFFLINE_TIMEOUT_SECONDS` (padrão 900) comparando `agora` com a última leitura.
- `atual` são as últimas leituras de `cpu`, `ram` e `disco`.
- **Não entram no gold:** `situacao`, `saude_frota`, `ambiente`, `meta_sla`, `incidentes`, `relatorio_ia`, `24h`, `media`, `anterior`, `tempo_min`.
- O `7d` é exatamente o recorte dos últimos 7 pontos do `30d`.

### 4.2 Resposta de `GET /dash-geral` — consumida pelo front

```json
{
  "versao": 2,
  "id_empresa": 2,
  "gerado_em": "2026-11-25T14:30:00-03:00",
  "saude_frota": {
    "total": 2,
    "normais": 0,
    "atencao": 0,
    "critico": 1,
    "offline": 1,
    "pct_saudavel": 0
  },
  "disponibilidade_frota": {
    "7d": {
      "rotulos": ["19/11", "20/11", "21/11", "22/11", "23/11", "24/11", "25/11"],
      "valores": [99.8, 99.9, 99.8, 99.8, 100.0, 99.8, 97.3]
    },
    "30d": {
      "rotulos": [
        "27/10", "28/10", "29/10", "30/10", "31/10",
        "01/11", "02/11", "03/11", "04/11", "05/11",
        "06/11", "07/11", "08/11", "09/11", "10/11",
        "11/11", "12/11", "13/11", "14/11", "15/11",
        "16/11", "17/11", "18/11", "19/11", "20/11",
        "21/11", "22/11", "23/11", "24/11", "25/11"
      ],
      "valores": [
        99.8, 99.9, 99.9, 99.9, 100.0, 99.8, 99.9, 99.9, 99.8, 99.9,
        99.8, 100.0, 99.9, 100.0, 99.8, 99.9, 99.9, 99.9, 99.7, 100.0,
        99.8, 99.9, 99.9, 99.8, 99.9, 99.8, 99.8, 100.0, 99.8, 97.3
      ]
    }
  },
  "ranking_problematicos": []
}
```

Regras da API:

- **Sem `ambiente`, sem `meta_sla`, sem `servidores[]`, sem `incidentes`, sem `relatorio_ia`.**
- `total` = todos os servidores ativos e visíveis da sessão. Ativo sem entrada no gold conta como `offline`.
- `critico` no exemplo vem da CPU 93,4 do servidor 3 (limite crítico padrão 85). O servidor 4 está `offline` no gold.
- `pct_saudavel = normais / total`; `total = 0` ⇒ `null`.
- `ranking_problematicos`: formato futuro `{ id_servidor, nome, situacao, incidentes }`; hoje `[]`.
- Empresa sempre vem de `req.usuario.empresa`.

### 4.3 Rotas complementares (inalteradas, stubs vazios)

`GET /dash-geral/incidentes`:

```json
{
  "abertos": [],
  "por_dia": {
    "7d": { "rotulos": [], "valores": [] },
    "30d": { "rotulos": [], "valores": [] }
  },
  "mttr": { "minutos": null, "periodo": "(últimos 30d)", "anterior_minutos": null }
}
```

`GET /dash-geral/relatorio-ia`:

```json
{ "gerado_em": null, "resumo": "", "recomendacoes": [] }
```

Mesma autenticação e permissão `monitorar` do prefixo `/dash-geral`. Falha nesses complementos não pode quebrar a dash principal: `console.warn`, nunca mensagem de erro na tela.

### 4.4 Origem dos campos

| Campo | Responsável | Origem |
| --- | --- | --- |
| `versao`, `id_empresa`, `gerado_em`, `conexao`, `ultima_leitura`, `atual`, `disponibilidade_frota` | ETL | capturas da silver |
| `saude_frota` | Backend | `metrica`/`componente`/`servidor` + gold; ausência no gold ⇒ offline |
| `ranking_problematicos` | Backend | `[]` por enquanto |
| `ambiente`, `meta_sla` | — | **removidos** |
| `incidentes.*`, `relatorio_ia.*` | Rotas complementares | stubs vazios por enquanto |

---

## 5. Regra de disponibilidade na ETL (corrigida)

### 5.1 Leitura e filtro da silver

- Manter o paginator em `02-silver/metricas/` e o filtro de 40 dias **pela chave, antes do `GetObject`**, com regex `(?:^|/)data=(\d{4}-\d{2}-\d{2})(?:/|$)`.
- `limite = hoje_local - timedelta(days=40)`; ignorar `data_particao < limite`. Manter essa fronteira.
- Ler só `_dados.csv` com `csv.DictReader`.
- `data_hora` ingênuo ⇒ anexar `FUSO_LOCAL` (`America/Sao_Paulo`). Se vier com `Z`, manter a conversão UTC atual. Guardar tudo em UTC.
- Deduplicar por timestamp, como hoje: `servidores[(empresa, servidor)][data] = linha`.
- Ordenar as amostras de cada servidor por `_data`.

### 5.2 Cálculo por servidor e por dia

Para cada servidor e cada dia da série:

1. `inicio = 00:00` do dia em `FUSO_LOCAL`, convertido para UTC.
2. `fim = 00:00` do dia seguinte em `FUSO_LOCAL`. **No dia de hoje, `fim = agora`** (instante do início do script, em UTC).
3. `primeira = primeira amostra do servidor dentro da janela de 40 dias`.
4. Se `fim <= primeira`, o ponto do servidor é `None` (“sem dados”).
5. Senão, `inicio_efetivo = max(inicio, primeira)` — o primeiro dia conta só a partir da primeira captura.
6. `esperadas = (fim - inicio_efetivo).total_seconds() / FREQUENCIA_ESPERADA_SEGUNDOS`.
7. `recebidas = quantidade de amostras com inicio_efetivo <= data < fim`.
8. `valor = min(100, recebidas / esperadas * 100)` se `esperadas > 0`, senão `None`.
9. Arredondar com `round(valor, 1)`.

Consequências:

- Dia inteiro: 86400 s ÷ 60 = **1440 capturas esperadas** (respeita DST via `ZoneInfo`, se houver).
- Hoje até 14:30: 52200 s ÷ 60 = **870 capturas esperadas**.
- Dia antes de o servidor existir: `null`, nunca `0`.
- Dia em que o servidor já era monitorado e não enviou nada: `0.0`.

### 5.3 Agregação da frota

Por dia:

- Considere apenas servidores cujo ponto não é `None`.
- Some `recebidas` e some `esperadas` desses servidores.
- `valor_frota = min(100, soma_recebidas / soma_esperadas * 100)`, arredondado a 1 decimal.
- Se nenhum servidor tiver ponto no dia ⇒ `null`.

**Não fazer média simples dos percentuais.** Exemplo: hoje, servidor 3 entregou 865/870 e servidor 4 entregou 828/870 ⇒ `(865+828)/(870+870) = 97,2989% ⇒ 97,3%`. A média simples daria 96,9% e estaria errada.

### 5.4 Simulação numérica usada no JSON acima

Cenário: `gerado_em = 2026-11-25T14:30:00-03:00`; servidor 3 começou em `27/10 09:15` (885 esperadas no primeiro dia); servidor 4 começou em `27/10 00:00` (1440 esperadas no primeiro dia); hoje ambos têm 870 esperadas.

| Dia | Servidor 3 | Servidor 4 | Frota |
| --- | --- | --- | --- |
| 27/10 | 882/885 | 1438/1440 | 99.8 |
| 28/10 | 1439/1440 | 1439/1440 | 99.9 |
| 29/10 | 1440/1440 | 1437/1440 | 99.9 |
| 30/10 | 1438/1440 | 1438/1440 | 99.9 |
| 31/10 | 1440/1440 | 1440/1440 | 100.0 |
| 01/11 | 1439/1440 | 1436/1440 | 99.8 |
| 02/11 | 1440/1440 | 1438/1440 | 99.9 |
| 03/11 | 1437/1440 | 1439/1440 | 99.9 |
| 04/11 | 1440/1440 | 1435/1440 | 99.8 |
| 05/11 | 1438/1440 | 1440/1440 | 99.9 |
| 06/11 | 1436/1440 | 1438/1440 | 99.8 |
| 07/11 | 1439/1440 | 1440/1440 | 100.0 |
| 08/11 | 1439/1440 | 1437/1440 | 99.9 |
| 09/11 | 1440/1440 | 1440/1440 | 100.0 |
| 10/11 | 1435/1440 | 1439/1440 | 99.8 |
| 11/11 | 1438/1440 | 1438/1440 | 99.9 |
| 12/11 | 1440/1440 | 1436/1440 | 99.9 |
| 13/11 | 1439/1440 | 1439/1440 | 99.9 |
| 14/11 | 1437/1440 | 1435/1440 | 99.7 |
| 15/11 | 1440/1440 | 1440/1440 | 100.0 |
| 16/11 | 1438/1440 | 1437/1440 | 99.8 |
| 17/11 | 1439/1440 | 1438/1440 | 99.9 |
| 18/11 | 1440/1440 | 1436/1440 | 99.9 |
| 19/11 | 1436/1440 | 1439/1440 | 99.8 |
| 20/11 | 1440/1440 | 1438/1440 | 99.9 |
| 21/11 | 1438/1440 | 1437/1440 | 99.8 |
| 22/11 | 1439/1440 | 1435/1440 | 99.8 |
| 23/11 | 1440/1440 | 1440/1440 | 100.0 |
| 24/11 | 1437/1440 | 1438/1440 | 99.8 |
| 25/11 | 865/870 | 828/870 | 97.3 |

O número grande do card continua sendo a **média simples dos pontos não nulos exibidos** (`99,5%` no `7d`, `99,8%` no `30d` com este exemplo). A ponderação acontece **dentro de cada ponto**, na ETL.

---

## 6. Alterações no Site

### 6.1 `src/models/dashGeralModel.js`

- Manter: `lerGold`, `buscarServidoresPermitidos`, `buscarLimitesPorServidor`, `classificarValor`, `classificarServidor`, `normalizarDisponibilidade`, limites padrão (70/85 CPU, 75/90 RAM, 80/90 disco) e `servidorModel.listarLimitesGlobais`.
- No retorno de `montar()`, **remover** `ambiente` e `meta_sla`.
- Manter `gerado_em: gold.gerado_em || null` como string ISO; **não formatar no backend**.
- Manter `saude_frota`, `disponibilidade_frota` e `ranking_problematicos: []`.
- Garantir que **não** existam `servidores`, `incidentes` nem `relatorio_ia` no retorno.

### 6.2 Complementos

- `src/models/dashComplementosModel.js`, `src/controllers/dashComplementosController.js`, `src/routes/dashGeral.js`: **nenhuma alteração**. Apenas conferir que continuam como na seção 4.3.
- `src/controllers/dashGeralController.js`: **nenhuma alteração**. Status 401/403/404/503 permanecem iguais.

### 6.3 `public/html/dash-geral.html`

Alterar somente esta página:

1. Comentário do topo: “Topo: título, data de geração e resumo da frota”.
2. Remover por completo o botão:

   ```html
   <button type="button" class="fr-ambiente" aria-label="Selecionar ambiente">…</button>
   ```

   incluindo `id="ambiente-nome"` e o ponto verde.
3. Substituir:

   ```html
   <time class="fr-relogio" id="relogio">--/--/---- --:--</time>
   ```

   por:

   ```html
   <time class="fr-gerado-em" id="dados-gerados">Dados gerados em —</time>
   ```

4. Resumo do topo passa a ter 4 itens:

   ```html
   <li class="fr-resumo-topo__item fr-resumo-topo__item--ok" id="topo-normais">— normais</li>
   <li class="fr-resumo-topo__item fr-resumo-topo__item--atencao" id="topo-atencao">— atenção</li>
   <li class="fr-resumo-topo__item fr-resumo-topo__item--critico" id="topo-critico">— crítico</li>
   <li class="fr-resumo-topo__item fr-resumo-topo__item--offline" id="topo-offline">— offline</li>
   ```

   (remover o antigo `topo-online`.)

5. Donut: `aria-label` vira “Distribuição dos servidores entre normal, atenção, crítico e offline”; texto central vira `Normais` (id `donut-numero` continua).
6. Legenda do donut passa a ter 4 itens com novos ids:

   ```html
   <li class="fr-legenda fr-legenda--ok" id="leg-normais">— Normais</li>
   <li class="fr-legenda fr-legenda--atencao" id="leg-atencao">— Atenção</li>
   <li class="fr-legenda fr-legenda--critico" id="leg-critico">— Crítico</li>
   <li class="fr-legenda fr-legenda--offline" id="leg-offline">— Offline</li>
   ```

7. Card de disponibilidade:
   - título inicial `Disponibilidade (7d)` (o JS atualiza para 30d);
   - remover `<p class="fr-sla__meta" id="disp-meta">Meta —</p>`;
   - `aria-label` do canvas vira “Disponibilidade média da frota no período” (sem menção a meta).
8. Comentário “Indicadores: saúde, SLA, incidentes...” vira “Indicadores: saúde, disponibilidade, incidentes...”.

Não alterar cards de Jira, IA, tabela, filtros ou sidebar.

### 6.4 `public/css/dash-geral.css`

- Remover `.fr-ambiente`, `.fr-ambiente:hover`, `.fr-ambiente__ponto` e `.fr-ambiente:focus-visible` da lista de `:focus-visible`.
- Renomear `.fr-relogio` para `.fr-gerado-em` (mesmo estilo: texto suave, tamanho 0.82rem, tabular, `white-space: nowrap`).
- `.fr-resumo-topo__item--critico { color: var(--fr-critico); }`.
- Trocar `.fr-resumo-topo__item--offline` de `var(--fr-critico)` para `var(--fr-offline)` (já existe `--fr-offline: #8b98a5` no topo do arquivo).
- Adicionar `.fr-legenda--offline { --cor: var(--fr-offline); }`.
- Remover `.fr-sla__meta` e `.fr-sla__meta::before` (a faixa tracejada da meta some).
- Não mexer em `global.css` nem em outro CSS.

### 6.5 `public/js/dash-geral.js`

- Atualizar o comentário do topo: remover `ambiente` e `meta_sla` da lista de campos; manter `gerado_em`, `saude_frota`, `disponibilidade_frota`, `ranking_problematicos` e os complementos.
- Remover `META_SLA_PADRAO`, a função `metaSla()`, `atualizarRelogio()`, o `setInterval(atualizarRelogio, 30000)` e toda referência a `disp-meta` / dataset “Meta de SLA”.
- Adicionar `const CINZA = '#8b98a5';` ao lado das outras cores.

Formatar a data de geração no navegador (fixo em Brasília, independente do fuso da máquina):

```js
const fmtGerado = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false
});

function formatarGeradoEm(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  const partes = Object.fromEntries(fmtGerado.formatToParts(data).map((p) => [p.type, p.value]));
  const hora = partes.hour === '24' ? '00' : partes.hour;
  return `${partes.day}/${partes.month}/${partes.year} ${hora}:${partes.minute}`;
}

function renderizarGeradoEm() {
  const no = document.getElementById('dados-gerados');
  if (!no) return;
  no.textContent = 'Dados gerados em ' + formatarGeradoEm(dados && dados.gerado_em);
  const data = dados && dados.gerado_em ? new Date(dados.gerado_em) : null;
  if (data && !Number.isNaN(data.getTime())) no.dateTime = data.toISOString();
  else no.removeAttribute('datetime');
}
```

Chamar `renderizarGeradoEm()` dentro de `renderizarTudo()`.

Saúde:

- `renderizarSaude()` lê `normais`, `atencao`, `critico` e `offline` separadamente.
- Topo: `topo-normais`, `topo-atencao`, `topo-critico`, `topo-offline` (remover `topo-online`).
- Legenda: `leg-normais`, `leg-atencao`, `leg-critico`, `leg-offline`.
- Donut: `labels = ['Normais', 'Atenção', 'Crítico', 'Offline']`; `data = [normais, atencao, critico, offline]`; `backgroundColor = [VERDE, AMARELO, VERMELHO, CINZA]`. Com `total = 0`, usar `[1, 0, 0, 0]` e cor cinza-clara, como hoje.
- `donut-numero` continua mostrando `normais/total`.
- `pct_saudavel` e os limiares de cor do card (70/40) permanecem.

Disponibilidade:

- `criarGraficoDisp()` mantém **um único dataset** (“Disponibilidade”, ciano, `spanGaps: false`). Tooltip só mostra “Sem dados” ou “Disponibilidade: X%”.
- `atualizarDisponibilidade()` usa `definirTexto('titulo-disp', 'Disponibilidade (' + periodo.disp + ')')` e não toca em `disp-meta`.
- Eixo Y adaptativo:

```js
function ajustarEixoDisp(validos) {
  const menor = validos.length ? Math.min(...validos) : null;
  const min = menor == null ? 90 : Math.max(0, Math.floor((menor - 0.001) / 5) * 5);
  graficos.disp.options.scales.y.min = min;
  graficos.disp.options.scales.y.max = 100;
}
```

Chamar após trocar `labels`/`data`. Exemplos: menor 97,3 ⇒ eixo 95–100; menor 100 ⇒ 95–100; menor 71 ⇒ 70–100; sem dados ⇒ 90–100.

Auto-refresh silencioso:

```js
const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000;
let carregando = false;

async function carregarDados(silent = false) {
  if (carregando) return;
  carregando = true;
  if (!silent) mostrarCarregando();
  try {
    dados = await buscarJSON(URL_DADOS);
    await carregarComplementos();
    renderizarTudo();
  } catch (erro) {
    console.error('[dash-geral] falha ao carregar dados:', erro);
    if (!silent) mostrarErro(erro.message || 'Não foi possível carregar os dados.');
  } finally {
    carregando = false;
  }
}
```

- `carregarComplementos()` continua com `Promise.allSettled` e `console.warn` — não lança.
- Em `DOMContentLoaded`: remover relógio; manter criação dos gráficos, filtros e botão de IA; trocar `carregarDados();` por `carregarDados();` (normal) e acrescentar:

```js
setInterval(() => {
  if (!document.hidden) carregarDados(true);
}, INTERVALO_ATUALIZACAO_MS);
```

- Não mostrar “…”, não limpar a tela e não atualizar quando `document.hidden` for `true`. `carregando` evita chamadas sobrepostas.

### 6.6 Config e docs do Site

- `.env.example`: remover as linhas `META_SLA=99` e o comentário “Meta de disponibilidade…”. Manter os comentários `JIRA_*` (rota futura).
- `.env.dev` local: remover também `META_SLA=99` (arquivo local, não versionado). `DASH_GOLD_LOCAL=1` permanece.
- `docs/roteiro-prompt.md`: **ajustar apenas o bloco de atualização do topo** (linhas 6–10) para citar a revisão de 25/11: sem “Produção”, sem meta, `gerado_em` no topo, séries `dd/mm` com 7/30 pontos e disponibilidade ponderada. Não reescrever os prompts históricos.
- `docs/plano-implementacao.md`: já está atualizado; não editar durante a implementação salvo pedido explícito.

**Não mexer:** `app.js`, `dashboard-data.js`, `servidorModel.js`, rotas/controllers dos complementos, schema SQL, `package.json`, outras páginas HTML, outros CSS.

---

## 7. Alterações na ETL (repo `etl`)

### 7.1 `silver2gold.py`

Manter a estrutura atual de leitura/filtro/parse e substituir `disponibilidade()` + `serie_frota()` pela regra da seção 5.

Esqueleto de referência (adaptar ao estilo existente, sem novas dependências):

```python
from datetime import datetime, timedelta, timezone, time
from zoneinfo import ZoneInfo

def ponto_servidor(lista, dia, agora):
    inicio = datetime.combine(dia, time.min, tzinfo=FUSO_LOCAL).astimezone(timezone.utc)
    fim = agora if dia == agora.astimezone(FUSO_LOCAL).date() else \
        datetime.combine(dia + timedelta(days=1), time.min, tzinfo=FUSO_LOCAL).astimezone(timezone.utc)

    if not lista or fim <= lista[0]['_data']:
        return None

    inicio_efetivo = max(inicio, lista[0]['_data'])
    esperadas = (fim - inicio_efetivo).total_seconds() / FREQUENCIA
    if esperadas <= 0:
        return None
    recebidas = sum(1 for a in lista if inicio_efetivo <= a['_data'] < fim)
    return min(100, recebidas / esperadas * 100), recebidas, esperadas


def serie_frota(listas, dias, agora):
    hoje = agora.astimezone(FUSO_LOCAL).date()
    rotulos, valores = [], []
    for passo in range(dias - 1, -1, -1):
        dia = hoje - timedelta(days=passo)
        soma_r = soma_e = 0
        for lista in listas:
            ponto = ponto_servidor(lista, dia, agora)
            if ponto is None:
                continue
            _, recebidas, esperadas = ponto
            soma_r += recebidas
            soma_e += esperadas
        valor = min(100, soma_r / soma_e * 100) if soma_e else None
        rotulos.append(dia.strftime('%d/%m'))
        valores.append(round(valor, 1) if valor is not None else None)
    return {'rotulos': rotulos, 'valores': valores}
```

- `agora` continua sendo `datetime.now(timezone.utc)` calculado **antes** da listagem.
- `servidores_empresa`, `conexao`, `ultima_leitura`, `atual`, `gerado_em` e a chave `03-gold/empresa-{id}/dash-geral.json` permanecem como hoje.
- Documento final: **somente** as chaves da seção 4.1.
- Remover `DIAS_SEMANA` e os lambdas de rótulo por dia da semana.
- Manter log `Objetos silver: X processados, Y ignorados...`.

### 7.2 `.env.example` e `README.md`

- `.env.example`: não precisa mudar (já tem `TIMEZONE`, `OFFLINE_TIMEOUT_SECONDS`, `FREQUENCIA_ESPERADA_SEGUNDOS`). Conferir apenas.
- `README.md`: atualizar o exemplo de JSON para o da seção 4.1 e descrever:
  - filtro de 40 dias pela partição `data=` antes do download;
  - dias de calendário, com hoje proporcional até `gerado_em`;
  - `null` antes da primeira captura, `0` depois;
  - frota ponderada por `recebidas/esperadas`;
  - rótulos `dd/mm`, 7 e 30 pontos;
  - nenhum `latest.json`.

**Não mexer:** `bronze2silver.py`, forma de execução, cabeçalhos do CSV, `script_python/`, `logs/`.

---

## 8. Execução da ETL e acesso ao S3

- Credenciais: cadeia padrão do `boto3`. Local: `AWS_PROFILE=...`. Na EC2/Lambda: IAM Role. **Nunca colocar chaves no `.env` nem no código.**
- IAM mínimo da Lambda:
  - `s3:ListBucket` no bucket (necessário para o paginator em `02-silver/metricas/`);
  - `s3:GetObject` em `02-silver/metricas/*`;
  - `s3:PutObject` em `03-gold/*` (e em `<S3_GOLD_BUCKET>/03-gold/*` se bucket diferente).
- Site (EC2) precisa só de `s3:GetObject` em `03-gold/*`. `DASH_GOLD_LOCAL=1` dispensa S3 no teste.
- Não conceder `PutObject` na silver nem `GetObject` no gold à Lambda de gold.
- Execução local:

  ```bash
  cd /home/luiz/Documentos/repositories/etl
  cp .env.example .env          # se ainda não existir; preencher S3_BUCKET
  AWS_PROFILE=seu-perfil python3 silver2gold.py
  ```

---

## 9. O que NÃO fazer

- Não dar commit nem push.
- Não implementar Jira real, chamados, notificações Slack/Jira nem serviço de IA.
- Não reintroduzir `ambiente`, `meta_sla`, `servidores[]`, `incidentes` ou `relatorio_ia` no JSON principal.
- Não esconder os cards de Jira/IA.
- Não alterar HTML/CSS de outras páginas, `app.js`, `global.css`, `dashboard-data.js`, `servidorModel.js`, schema, `bronze2silver.py`, `script_python/` ou `logs/`.
- Não criar `latest.json`, não instalar dependências novas, não refatorar paleta de cores.
- Não usar rótulos de dia da semana no gráfico de disponibilidade da dash-geral.
- Não calcular disponibilidade por média simples de percentuais na ETL.

---

## 10. Ordem de execução

1. Site: `dashGeralModel.js` (remover `ambiente`/`meta_sla`).
2. Site: `.env.example`, `.env.dev`, `docs/roteiro-prompt.md`.
3. Site: `dash-geral.html`, `dash-geral.css`, `dash-geral.js`.
4. ETL: `silver2gold.py`, `README.md` (conferir `.env.example`).
5. Subir MySQL, ajustar fixture `03-gold/empresa-2/dash-geral.json`, subir o site e validar seção 11.
6. Validar ETL com S3 de teste ou harness simulado.
7. `git status --short --branch` nos dois repos. **Encerrar sem commit.**

---

## 11. Validação manual

### 11.1 Banco e fixture

```bash
docker start infratech-mysql
docker exec -e MYSQL_PWD=root infratech-mysql mysql -uroot -e "SHOW DATABASES;"
```

Se `infratech` não existir:

```bash
cd /home/luiz/Documentos/repositories/InfraTech-SiteInstitucional
docker exec -i -e MYSQL_PWD=root infratech-mysql mysql -uroot < src/database/infratech-atualizado.sql
```

Conferir os IDs reais:

```bash
docker exec -e MYSQL_PWD=root infratech-mysql mysql -uroot -e \
"SELECT id_servidor, nome FROM infratech.servidor WHERE fk_empresa = 2 AND status_sistema = 1;"
```

Coloque o JSON da seção 4.1 em `03-gold/empresa-2/dash-geral.json`. Se o banco local tiver outros IDs, troque `3`/`4` no fixture. `03-gold/` é ignorado pelo Git.

### 11.2 Site

```bash
cd /home/luiz/Documentos/repositories/InfraTech-SiteInstitucional
npm install        # só se node_modules não existir
npm start          # .env.dev já tem DASH_GOLD_LOCAL=1 e APP_PORT=3333
```

Abra `http://localhost:3333/login.html`, entre com `alexandre@gamecloud.com` / `senha123` e vá em `http://localhost:3333/dashboard/dash-geral.html` (ou `/dash-geral` pela API).

Resultado esperado com o fixture:

- Topo: **sem “Produção”**; mostra `Dados gerados em 25/11/2026 14:30`; contadores `0 normais`, `0 atenção`, `1 crítico`, `1 offline`.
- Card Saúde: `0%`, donut `[0, 0, 1, 1]` com verde/amarelo/vermelho/cinza, legenda com 4 itens, centro `0/2`.
- Card Disponibilidade: título `Disponibilidade (7d)`/`(30d)`, **sem “Meta” e sem linha tracejada**; eixo começa em 95; `99,5%` no 7d e `99,8%` no 30d; rótulos `19/11 … 25/11` e `27/10 … 25/11`; pontos=null aparecem como “Sem dados”.
- Incidentes: `0`, tabela “Nenhum incidente aberto no momento.”, gráfico “Sem incidentes no período.”, ranking vazio, MTTR `—`.
- IA: “Sem dados para análise.” e “Sem recomendações.”.
- Console do navegador sem erros.

API:

```bash
curl -i http://localhost:3333/dash-geral
# 401

curl -c /tmp/infratech-cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"emailServer":"alexandre@gamecloud.com","senhaServer":"senha123"}' \
  http://localhost:3333/login_cadastro/autenticar

curl -b /tmp/infratech-cookie.txt http://localhost:3333/dash-geral | python3 -m json.tool
curl -b /tmp/infratech-cookie.txt http://localhost:3333/dash-geral/incidentes | python3 -m json.tool
curl -b /tmp/infratech-cookie.txt http://localhost:3333/dash-geral/relatorio-ia | python3 -m json.tool
```

Conferir no body: **nenhum** dos campos `ambiente`, `meta_sla`, `servidores`, `incidentes`, `relatorio_ia`.

```bash
# ADMIN -> 403
curl -c /tmp/infratech-admin.txt \
  -H 'Content-Type: application/json' \
  -d '{"emailServer":"felipe@infratech.com","senhaServer":"123456"}' \
  http://localhost:3333/login_cadastro/autenticar
curl -i -b /tmp/infratech-admin.txt http://localhost:3333/dash-geral

# Empresa sem gold -> 404
curl -c /tmp/infratech-sem-gold.txt \
  -H 'Content-Type: application/json' \
  -d '{"emailServer":"luana@techplay.com","senhaServer":"senhaLp1"}' \
  http://localhost:3333/login_cadastro/autenticar
curl -i -b /tmp/infratech-sem-gold.txt http://localhost:3333/dash-geral
```

Auto-refresh: para não esperar 5 min, altere temporariamente `INTERVALO_ATUALIZACAO_MS` para `5000`, mude o fixture, observe a página atualizar sem “…” e com aba oculta sem novas requisições em Network; **restaure `5 * 60 * 1000`** antes de terminar.

### 11.3 ETL

- Rodar contra bucket de teste e conferir `03-gold/empresa-{id}/dash-geral.json`: chaves exatamente da seção 4.1, 7 e 30 rótulos `dd/mm`, sem `24h`/`incidentes`/`relatorio_ia`, sem `latest.json`.
- Conferir que um objeto silver com `data=` mais antiga que 40 dias foi ignorado (contador do log), sem `GetObject`.
- Se não houver AWS disponível, usar harness local com `boto3` falsificado: criar `/tmp/opencode/etl-test/validar_etl.py` que injeta `sys.modules['boto3']` com `client('s3')` implementando `get_paginator`, `get_object` e `put_object` sobre um dicionário em memória, define `S3_BUCKET`, `FREQUENCIA_ESPERADA_SEGUNDOS=60`, `TIMEZONE=America/Sao_Paulo`, importa `silver2gold` e imprime o JSON gravado. Inclua um CSV antigo e um recente para validar o filtro e o dia parcial.
- Conferir manualmente o último ponto: com 865/870 e 828/870, o valor impresso deve ser `97.3`.

---

## 12. Definition of done

- Site e ETL com as alterações das seções 6 e 7 aplicadas e **não commitadas**.
- `GET /dash-geral` devolvendo exatamente o contrato 4.2, sem `ambiente`, `meta_sla`, `servidores`, `incidentes` ou `relatorio_ia`.
- Topo sem “Produção” e com `Dados gerados em DD/MM/AAAA HH:mm`.
- Gráfico com 7/30 pontos, rótulos `dd/mm`, eixo adaptativo e sem linha/meta de SLA.
- Donut de 4 fatias e 4 contadores no topo.
- Auto-refresh silencioso de 5 min, pausado com aba oculta.
- Cards de Jira/IA visíveis e vazios; botão de IA continua funcionando.
- ETL gravando o contrato 4.1 com dias de calendário, hoje proporcional, `null` antes da primeira captura e frota ponderada.
- Nenhum arquivo de `script_python/`, `logs/`, `bronze2silver.py`, schema, `app.js` ou `global.css` alterado.
- Validação da seção 11 executada manualmente.
- `git status` final conferido nos dois repos, **sem commit e sem push**.
