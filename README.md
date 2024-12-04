# Twitch Giveaway Monitor

Um programa de monitoramento de giveaways da Twitch com interface TUI (Text User Interface) que identifica e participa automaticamente de sorteios em canais específicos.

## Características

- Interface de texto interativa (TUI)
- Monitoramento em tempo real de múltiplos canais
- Detecção automática de padrões de mensagens
- Sistema de renovação automática de tokens
- Suporte a múltiplas contas
- Atualização automática de canais durante monitoramento
- Log detalhado de whispers e eventos
- Sistema de detecção de padrões configurável

## Pré-requisitos

### Node.js e NPM
- Baixe e instale o Node.js (v14+) em [nodejs.org](https://nodejs.org/)
- NPM (Node Package Manager) é instalado automaticamente com o Node.js
- Verifique a instalação com:
  ```bash
  node --version
  npm --version
  ```

### Conta de Desenvolvedor Twitch
1. Acesse [dev.twitch.tv](https://dev.twitch.tv/)
2. Faça login com sua conta Twitch
3. Vá para o [Console](https://dev.twitch.tv/console)
4. Clique em "Registrar Seu Aplicativo"
5. Preencha:
   - Nome: Escolha um nome único
   - URL de Redirecionamento OAuth: `http://localhost`
   - Categoria: Chat Bot
6. Após registrar, você receberá:
   - Client ID
   - Client Secret
7. Copie essas credenciais para seu `config.ini`

### Contas Twitch para Monitoramento
- Crie contas secundárias em [twitch.tv/signup](https://www.twitch.tv/signup)
- Recomendações:
  - Use contas com mais de 24h de criação
  - Evite usar sua conta principal
  - Mantenha as contas verificadas por email
  - Recomendado: 3-4 contas para início

## Instalação

1. Clone o repositório
2. Execute `npm install` para instalar as dependências
3. Configure o arquivo `config.ini` com suas credenciais
4. Configure suas contas no arquivo `contas.json`

## Configuração

### config.ini
[CLIENT] \
ID='seu_client_id' \
SECRET='seu_client_secret'

[GAME] \
NAME='nome_do_jogo'

[PATTERN_DETECTION] \
THRESHOLD=5 \
TIME_WINDOW=30000 \
CLEANUP_INTERVAL=60000 \
MIN_MESSAGE_LENGTH=3

### contas.json
[ \
  { \
    "nome": "conta_principal", \
    "token": "oauth:xxx", \
    "access_token": "xxx", \
    "refresh_token": "xxx", \
    "expiry": "2024-12-03T23:30:39.375Z", \
    "isListener": true \
  } \
]

## Estrutura do Projeto

- `twgiveaways.js`: Interface principal TUI
- `server.js`: Servidor para gerenciamento de canais
- `listener.js`: Sistema de monitoramento de chat
- `oauth.js`: Gerador de URLs de autorização
- `oauth2.js`: Sistema de renovação de tokens
- `generate_tokens.js`: Gerador de tokens iniciais

## Arquivos de Log

- `whispers.json`: Registro de mensagens privadas
- `log/combined.log`: Log geral de eventos
- `log/error.log`: Log específico de erros

## Contribuindo

Pull requests são bem-vindos. Para mudanças maiores, abra uma issue primeiro para discutir o que você gostaria de mudar.

## Licença

[MIT](https://choosealicense.com/licenses/mit/)

## Plugins

O sistema suporta plugins para estender suas funcionalidades.

### Plugins Oficiais

- **Discord Notifier**: Integração com Discord para notificações
  - Notificações de giveaways detectados
  - Notificações de vitórias
  - Notificações de whispers
  - Logs de erros

- **Smart Keywords**: Detecção inteligente de padrões
  - Aprendizado automático
  - Suporte a múltiplos idiomas
  - Análise de contexto
  - Redução de falsos positivos

- **Blacklist**: Sistema de blacklist
  - Bloqueio de palavras
  - Bloqueio de canais
  - Integração com Smart Keywords
  - Logs de detecções

- **Auto Responder**: Respostas automáticas
  - Respostas a vitórias
  - Respostas a whispers
  - Rate limiting
  - Suporte a múltiplos idiomas

### Instalação de Plugins

1. Instale as dependências:
```bash
npm run setup-plugins
```

2. Configure cada plugin em seu respectivo `config.json`
3. Reinicie o programa

### Desenvolvimento de Plugins

Veja a documentação em `src/plugins/README.md` para criar seus próprios plugins.
