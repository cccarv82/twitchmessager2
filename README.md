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

- Node.js (versão recomendada: 14+)
- NPM (Node Package Manager)
- Conta de desenvolvedor na Twitch
- Uma ou mais contas da Twitch para monitoramento

## Instalação

1. Clone o repositório
2. Execute `npm install` para instalar as dependências
3. Configure o arquivo `config.ini` com suas credenciais
4. Configure suas contas no arquivo `contas.json`

## Configuração

### config.ini
[CLIENT]
ID='seu_client_id'
SECRET='seu_client_secret'

[GAME]
NAME='nome_do_jogo'

[PATTERN_DETECTION]
THRESHOLD=5
TIME_WINDOW=30000
CLEANUP_INTERVAL=60000
MIN_MESSAGE_LENGTH=3

### contas.json
[
  {
    "nome": "conta_principal",
    "token": "oauth:xxx",
    "access_token": "xxx",
    "refresh_token": "xxx",
    "expiry": "2024-12-03T23:30:39.375Z",
    "isListener": true
  }
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