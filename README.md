# Twitch Giveaway Monitor

Este programa monitora canais da Twitch que estão realizando giveaways, identificando mensagens específicas e palavras-chave relacionadas a sorteios.

## Pré-requisitos

- Node.js instalado
- Uma conta de desenvolvedor na Twitch com Client ID e Client Secret
- Uma ou mais contas da Twitch para monitoramento

## Instalação

1. Clone o repositório
2. Execute `npm install` para instalar as dependências
3. Crie os arquivos de configuração necessários (detalhados abaixo)

## Configuração Inicial

### 1. Criar conta de desenvolvedor na Twitch
1. Acesse [dev.twitch.tv](https://dev.twitch.tv)
2. Faça login com sua conta da Twitch
3. Vá em "Console" -> "Applications" -> "Register Your Application"
4. Preencha as informações:
   - Name: Nome do seu aplicativo
   - OAuth Redirect URLs: http://localhost
   - Category: Chat Bot ou Other
5. Anote o Client ID e gere um Client Secret

### 2. Arquivo config.ini
Crie um arquivo `config.ini` na raiz do projeto:

[CLIENT]
ID=seu_client_id_da_twitch
SECRET=seu_client_secret_da_twitch

[GAME]
NAME=nome_do_jogo_a_monitorar

### 3. Arquivo contas.json
Crie um arquivo `contas.json` na raiz do projeto:

[
  {
    "nome": "nome_da_sua_conta_twitch",
    "token": "",
    "access_token": "",
    "refresh_token": "",
    "expiry": null
  }
]

### 4. Processo de Autenticação

#### 4.1. Gerar URL de Autorização
Execute:
node oauth.js

O programa irá gerar uma URL para cada conta no contas.json, similar a:
https://id.twitch.tv/oauth2/authorize?client_id=xxx&redirect_uri=http://localhost&response_type=code&scope=user:edit:follows+chat:edit&force_verify=true&state=nome_da_conta

#### 4.2. Autorizar o Aplicativo
1. Acesse a URL gerada no navegador
2. Faça login com a conta da Twitch correspondente
3. Autorize o aplicativo
4. Você será redirecionado para uma URL como:
http://localhost/?code=abc123xyz&scope=user:edit:follows+chat:edit&state=nome_da_conta

#### 4.3. Gerar Tokens
Execute o generate_tokens.js com a URL de redirecionamento:
node generate_tokens.js "http://localhost/?code=abc123xyz&scope=user:edit:follows+chat:edit&state=nome_da_conta"

Nota: O script aceita a URL com ou sem barras invertidas (\). Exemplo com barras:
node generate_tokens.js "http://localhost/\?code\=abc123xyz\&scope\=user%3Aedit%3Afollows+chat%3Aedit\&state\=nome_da_conta"

O script irá:
- Extrair o código de autorização da URL
- Gerar os tokens necessários
- Atualizar o arquivo contas.json
- Mostrar informações sobre a expiração dos tokens

#### 4.4. Renovação de Tokens
Para verificar e renovar tokens expirados:
node oauth2.js

## Uso do Programa

### 1. Iniciando o Servidor
node server.js

O servidor iniciará na porta 3000 por padrão.

### 2. Buscando Canais
Para buscar canais que estão streamando o jogo configurado, acesse:
http://localhost:3000/start-grabber/nome_do_jogo

Exemplo:
http://localhost:3000/start-grabber/iracing

Isso irá:
- Buscar todos os canais streamando o jogo especificado
- Filtrar canais relevantes baseado nas palavras-chave
- Salvar a lista no arquivo canais.json

### 3. Monitorando Canais
Para iniciar o monitoramento dos canais encontrados:
http://localhost:3000/start-listener

O programa irá:
- Conectar aos canais listados em canais.json
- Monitorar mensagens usando as contas configuradas
- Identificar mensagens relacionadas a giveaways
- Registrar eventos importantes nos logs

### 4. Visualizando Logs em Tempo Real
Para ver as mensagens e eventos em tempo real:
node client.js

## Palavras-chave Monitoradas

O programa monitora as seguintes palavras-chave:
- !ticket
- !join
- winner
- giveaway
- key
- !raffle
- !sorteio
- !sorteo
- !claim

## Estrutura de Arquivos

- `server.js`: Servidor principal e endpoints HTTP
- `grabber.js`: Sistema de busca de canais na Twitch
- `listener.js`: Sistema de monitoramento de mensagens
- `action.js`: Sistema de ações automáticas
- `oauth.js`: Gerador de URLs de autorização
- `oauth2.js`: Sistema de renovação de tokens
- `client.js`: Cliente para visualização de logs
- `logger.js`: Sistema de logging
- `generate_tokens.js`: Gerador de tokens iniciais

## Logs

Os logs são salvos em dois arquivos:
- `log/combined.log`: Todos os eventos
- `log/error.log`: Apenas erros

## Troubleshooting

### Problemas Comuns

1. Tokens Expirados
   - Sintoma: Erros de autenticação
   - Solução: Execute `node oauth2.js`

2. Falha na Conexão
   - Verifique se os tokens estão corretos
   - Verifique se o config.ini está configurado corretamente
   - Verifique os logs de erro em log/error.log

3. Canais Não Encontrados
   - Verifique se o nome do jogo está correto
   - Verifique se há streams ativas do jogo

4. Erro no generate_tokens.js
   - Certifique-se de colocar a URL entre aspas duplas
   - A URL pode estar com ou sem barras invertidas
   - Verifique se o nome da conta (state) corresponde ao nome no contas.json

### Dicas

- Mantenha seus tokens atualizados
- Verifique os logs regularmente
- Use várias contas para melhor cobertura
- Evite usar muitas contas simultaneamente para evitar limitações da Twitch

## Notas Importantes

- O programa respeita os limites de rate da API da Twitch
- As contas usadas devem ter mais de 24h de criação
- Recomenda-se usar contas diferentes das suas principais
- O programa não garante participação em todos os sorteios
- Algumas streams podem ter proteções contra bots

## Suporte

Para problemas e dúvidas:
1. Verifique os logs
2. Verifique as configurações
3. Certifique-se de que todas as dependências estão instaladas
4. Verifique se os tokens estão válidos

## Avisos Legais

- Use este programa de acordo com os Termos de Serviço da Twitch
- O uso excessivo pode resultar em banimento das contas
- O programa é para fins educacionais