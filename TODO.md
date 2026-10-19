# Shyna — resultados

- [ ] **Interface original, responsiva e sem login**
  - Entregar uma interface em português do Brasil chamada Shyna, sem aparência, identidade ou logotipo do ChatGPT.
  - Permitir navegação clara entre conversa, imagem e vídeo, com estados vazios, carregamento, erro e resultado.
  - Manter a experiência sem login ou cadastro e sem coleta agressiva de dados.

- [ ] **Integração segura com Pollinations**
  - Usar a documentação atual da Pollinations e os modelos escolhidos para Lite, Pro, imagem e vídeo.
  - Manter uma chave secreta no proxy/serverless da Vercel, sem expor segredos no cliente ou no repositório.
  - Permitir configuração por variáveis de ambiente e explicar o modo de desenvolvimento quando o proxy não estiver configurado.

- [ ] **Limites diários por IP e navegador**
  - Aplicar 30 mensagens por dia no Shyna Lite e 15 mensagens por dia no Shyna Pro.
  - Aplicar 4 imagens por dia e 1 vídeo por dia.
  - Exibir contadores, bloquear novas gerações ao atingir a cota, renovar no dia seguinte e combinar no servidor o IP com um identificador anônimo persistido neste navegador; explicar que a proteção não é antifraude forte.

- [ ] **Termos, privacidade e cookies**
  - Incluir modais acessíveis para termos de uso, privacidade/cookies e aviso de conteúdo gerado por IA.
  - Usar apenas armazenamento local para preferências e cotas, solicitando escolha de cookies sem criar rastreamento desnecessário.
  - Incluir links externos com navegação segura e textos claros em português do Brasil.

- [ ] **Proteção média para uso público**
  - Validar e limitar prompts, restringir modelos no servidor, tratar erros sem revelar segredos, evitar duplicação durante carregamento e aplicar cabeçalhos de segurança/CSP quando suportados.
  - Documentar que as cotas do navegador são uma proteção de produto, não uma barreira antifraude, e que limites fortes exigem persistência/rate limiting no servidor.

- [ ] **GitHub, Vercel e documentação de operação**
  - Salvar o código em um repositório GitHub privado chamado `shyna`.
  - Preparar build e funções serverless para Vercel.
  - Documentar credenciais e variáveis realmente necessárias, sem incluir valores secretos.
