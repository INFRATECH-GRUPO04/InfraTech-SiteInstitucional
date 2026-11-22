# Plano de implementação — Formulário de contato com EmailJS

## 1. Contexto e decisões

- O formulário `#form-contato-home` em `public/html/index.html` chama `enviarMensagemContato()`, definida em `public/js/index.js`. Hoje o envio é **mock**: `setTimeout` de 400 ms, mensagem de sucesso falsa e limpeza dos campos.
- O envio real será feito via **EmailJS direto do navegador**, sem backend novo:
  - **Remetente:** e-mail da InfraTech, conectado como Service do EmailJS (`infratech.sptech@outlook.com`).
  - **Destinatário:** o e-mail preenchido pelo cliente (`To Email = {{email}}`).
  - **BCC:** `infratech.sptech@outlook.com`, para registrarmos os dados do contato sem o cliente ver.
- Não haverá e-mail de "notificação interna" separado: a própria confirmação enviada ao cliente já traz nome, e-mail, assunto, data e mensagem, e a cópia oculta fica na nossa caixa.
- Escopo restrito ao **site institucional público**. Os e-mails `@infratech.com` presentes nos seeds SQL são exemplificação e **não** devem ser alterados.

## 2. Dados do EmailJS

| Item | Valor | Uso no código |
| --- | --- | --- |
| Public Key (`user_id`) | `D9fz0v6QW3lOWXZS5` | `emailjs.init({ publicKey: "D9fz0v6QW3lOWXZS5" })` |
| Service ID | `service_7t4b4j4` | 1º argumento de `emailjs.send()` |
| Template ID | `template_ss6qs7s` | 2º argumento de `emailjs.send()` |

A Public Key é pública por design e pode ficar no front-end. A **Private Key / access token da REST API não deve ser usada nem exposta no site**.

## 3. Configuração do EmailJS (já preparada no painel)

- **Email Service:** Outlook 365 conectada com `infratech.sptech@outlook.com`.
- **Template:** `template_ss6qs7s`.
- **Subject:** `Recebemos seu contato — InfraTech | {{assunto}}`.

Campos laterais do template:

| Campo | Valor |
| --- | --- |
| To Email | `{{email}}` |
| From Name | `InfraTech` |
| From Email | padrão da Service conectada (manter "use default email address") |
| Reply-To | `infratech.sptech@outlook.com` — não usar `{{email}}`, senão o cliente responderia para ele mesmo |
| BCC | `infratech.sptech@outlook.com` |
| CC | vazio |
| Settings → Email Service | Service conectada ao Outlook (`service_7t4b4j4`) |

Contrato de variáveis enviadas pelo `emailjs.send()` (nomes exatos, sem prefixo):

| Parâmetro | Origem |
| --- | --- |
| `nome` | `#contato_nome` |
| `email` | `#contato_email` |
| `assunto` | `#contato_assunto` |
| `mensagem` | `#contato_mensagem` |
| `data_envio` | `new Date().toLocaleString("pt-BR")` no `index.js` |

Usar `{{variavel}}` (escapamento automático). Não usar `{{{variavel}}}`, que injeta HTML sem escape.

### Corpo do e-mail (HTML do template)

```html
<div style="background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;">
    <tr>
      <td style="padding:20px 24px;background:#111827;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;color:#00CFFF;">INFRA<span style="color:#ffffff;">TECH</span></h1>
        <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Confirmação de contato · InfraTech</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 8px;font-size:15px;">Olá, <strong>{{nome}}</strong>!</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">
          Recebemos seu contato, entraremos em contato posteriormente para fecharmos parceria!
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
          Confira as suas informações enviadas por e-mail:
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e7eb;border-radius:6px;font-size:14px;">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:120px;">Nome</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">{{nome}}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">E-mail</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">{{email}}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Assunto</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">{{assunto}}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Data</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">{{data_envio}}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#6b7280;vertical-align:top;">Mensagem</td>
            <td style="padding:12px 16px;white-space:pre-wrap;line-height:1.6;">{{mensagem}}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background:#f9fafb;border-radius:0 0 8px 8px;color:#6b7280;font-size:11px;">
        Se precisar responder, entre em contato pelo e-mail informado acima.
      </td>
    </tr>
  </table>
</div>
```

## 4. Alterações aplicadas no repositório

1. `public/html/index.html:315` — `mailto:contato@infratech.com` e o texto exibido substituídos por `infratech.sptech@outlook.com`. `public/` foi varrido: não havia outras ocorrências do e-mail antigo no site.
2. `public/html/index.html` — SDK do EmailJS carregado via CDN (`https://cdn.jsdelivr.net/npm/@emailjs/browser@5/dist/email.min.js`), antes de `/js/index.js`.
3. `public/js/index.js`:
   - Constantes no topo com Public Key, Service ID e Template ID; `emailjs.init({ publicKey })`.
   - Validação de nome/e-mail/assunto/mensagem (o assunto também é `required` no HTML).
   - `setTimeout` mock substituído por `emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams)`, com os cinco parâmetros do contrato acima.
   - Botão desabilitado durante o envio; mensagem clara de sucesso ou erro no `#feedback_contato`; campos limpos somente após sucesso; em erro, botão reabilitado para nova tentativa. Texto do feedback montado com `textContent` para não interpretar HTML vindo do form.
4. `public/css/global.css` não foi editado; `#feedback_contato` e as classes existentes foram reaproveitados.
5. Schema/SQL, dashboards, alertas e e-mails dos seeds não foram alterados.

## 5. Validação manual

- Subir o site conforme o repo (`npm install`, `npm start` / `npm run dev`, com `.env.dev`). Não há testes/lint/CI automatizados.
- Enviar o formulário com dados de teste e conferir:
  - destinatário do e-mail é o endereço preenchido;
  - remetente aparece como InfraTech;
  - assunto e corpo chegam preenchidos, sem `{{variaveis}}` literais;
  - cópia BCC chega em `infratech.sptech@outlook.com` com os mesmos dados;
  - feedback de sucesso aparece na tela, campos são limpos e o botão volta ao normal.
- Simular falha no envio e verificar mensagem de erro no `#feedback_contato` com o botão reabilitado.
- Verificar caixa de spam/lixeira do destinatário de teste e o histórico do EmailJS.

## 6. Fora de escopo

- E-mails dos seeds SQL (`@infratech.com`, `@infratech.demo`).
- Notificações Slack/Jira, mudanças de schema, dashboards, alertas, autenticação ou qualquer funcionalidade além do envio do formulário de contato do site público.
