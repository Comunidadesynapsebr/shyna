# Shyna — AI Studio

Shyna é uma interface em português do Brasil para conversa, imagens e vídeo com uma identidade própria, sem login e sem copiar a aparência do ChatGPT. O projeto usa React + Vite no frontend e uma função serverless opcional em `api/pollinations.ts` para manter a chave da Pollinations fora do navegador.

## Limites do produto

O controle diário é local ao navegador: 30 mensagens no Lite, 15 no Pro, 4 imagens e 1 vídeo. A data e os contadores ficam em `localStorage` e renovam no dia seguinte. Isso melhora a experiência e evita consumo acidental, mas não é uma barreira antifraude. Limites fortes por pessoa ou por IP exigem autenticação, armazenamento persistente e rate limiting no servidor.

## Modelos configurados

A configuração atual usa `deepseek/deepseek-v4.1-flash` no Shyna Lite, `openai/gpt-5.4-nano` no Shyna Pro, `openai/gpt-image-1-mini` para imagens e `alibaba/wan-2.2-fast` para vídeo econômico. Os IDs vêm do catálogo atual da Pollinations e podem ser atualizados na allowlist do proxy quando o catálogo mudar.

## Credencial necessária na Vercel

Crie somente uma variável de ambiente secreta no projeto Vercel:

```text
POLLINATIONS_KEY=sk_...
```

O valor deve ser uma chave secreta `sk_` criada em [enter.pollinations.ai/keys](https://enter.pollinations.ai/keys), com orçamento e permissões compatíveis com os modelos. Cadastre-a nos ambientes **Production** e **Preview** se quiser testar ambos. Nunca coloque essa chave em `VITE_*`, no frontend, no GitHub ou em mensagens públicas. Não é necessário criar credencial da OpenAI, DeepSeek, Google ou outro provedor: a Pollinations faz o roteamento.

Ao importar o repositório no dashboard da Vercel, a integração com GitHub é uma autorização da própria Vercel para ler o repositório e criar deploys; ela não é uma variável de ambiente da aplicação. Você também pode conectar o repositório em **Project Settings → Git**.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```

O modo demonstração pode ser ativado pelo painel lateral ou por `VITE_DEMO_MODE=true`. Ele permite revisar a interface sem consumir a API. Para geração real, deixe o modo demonstração desligado e publique a função Vercel com `POLLINATIONS_KEY` configurada.

## Segurança média incluída

O proxy limita tipos e modelos autorizados, valida prompts de até 1.200 caracteres, não devolve mensagens de erro com a chave, usa `safe=true`, aplica `Cache-Control: no-store` e restringe as chamadas ao endpoint da Pollinations. O `vercel.json` adiciona CSP, `nosniff`, política de referência, Permissions Policy e bloqueio de framing externo. O React escapa o texto renderizado por padrão. A aplicação não envia cookies de rastreamento.

A CSP não deve ser ampliada sem necessidade. Se a Vercel ou a Pollinations mudar os domínios de mídia, revise apenas os domínios estritamente necessários. Em produção, configure também proteção de abuso no próprio provedor quando a escala justificar.

## Termos e privacidade

Os modais da interface explicam termos de uso, privacidade local e o aviso de conteúdo gerado por IA. A aplicação não exige conta. Usuários não devem enviar senhas, tokens, documentos de identidade ou dados pessoais sensíveis.

## Referências técnicas

- [Documentação oficial da Pollinations](https://gen.pollinations.ai/docs)
- [Catálogo de modelos da Pollinations](https://gen.pollinations.ai/models)
- [Connect User Wallets / BYOP](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)
- [Deploy de repositórios GitHub na Vercel](https://vercel.com/docs/git/vercel-for-github)
