# Changelog
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.3.0] - 2024-03-20
### Adicionado
- Sistema de análise de comportamento do chat com Machine Learning
- Detecção de padrões por múltiplos usuários
- Integração com Smart Keywords para aprendizado contínuo
- Sistema de pontuação para redução de falsos positivos
- Análise estatística de padrões de chat

### Melhorado
- Precisão na detecção de sorteios
- Redução de participações em falsos positivos
- Integração com sistema de plugins
- Performance da análise de mensagens

## [1.2.0] - 2024-03-20
### Adicionado
- Novo sistema de gerenciamento de bots
- Melhor controle de participação em sorteios
- Detecção de vencedores
- Limpeza automática de canais inativos

### Melhorado
- Lógica de participação de bots
- Separação clara entre listeners e participantes
- Gestão de conexões e desconexões
- Integração com sistema de plugins

## [1.1.9] - 2024-03-20
### Corrigido
- Compatibilidade do boxen com CommonJS
- Versão do boxen fixada em 5.1.2
- Erros de display no monitoramento

### Melhorado
- Estabilidade do display
- Compatibilidade com Node.js

## [1.1.8] - 2024-03-20
### Adicionado
- Novo sistema de display com interface moderna
- Gerenciador de exibição centralizado
- Boxes estilizados para diferentes tipos de mensagens

### Melhorado
- Visual do painel de monitoramento
- Organização dos logs
- Redução de ruído visual
- Agrupamento de informações relacionadas

## [1.1.7] - 2024-03-20
### Corrigido
- Adicionado import do logger no listener.js
- Corrigidos erros de referência no listener
- Melhorado logging de erros e eventos

### Melhorado
- Consistência no uso do logger em todo o código
- Mensagens de log mais informativas

## [1.1.6] - 2024-03-20
### Melhorado
- Sistema de monitoramento automático
- Integração com plugins durante monitoramento
- Notificações de status do monitoramento
- Logging mais detalhado do processo de scan

### Adicionado
- Status de monitoramento ativo
- Notificações para Discord sobre atualizações
- Eventos para plugins durante ciclo de monitoramento

## [1.1.5] - 2024-03-20
### Corrigido
- Erro de `global.activeBots not iterable`
- Melhor gerenciamento de bots ativos usando Map
- Cleanup adequado de bots ao encerrar

### Melhorado
- Sistema de participação em giveaways
- Logging de ações dos bots
- Gestão de conexões dos bots participantes

## [1.1.4] - 2024-03-20
### Corrigido
- Restaurada funcionalidade de busca de streams
- Corrigido processamento de canais
- Corrigida integração com blacklist

### Melhorado
- Processamento em lotes de 100 streams
- Rate limiting entre requests
- Logging mais detalhado

## [1.1.3] - 2024-03-20
### Corrigido
- Processamento e retorno de canais no StreamScanner
- Tratamento de paginação na API da Twitch
- Contagem correta de canais encontrados

### Melhorado
- Lógica de processamento de streams
- Estrutura de dados de progresso
- Logging durante o scan

## [1.1.2] - 2024-03-20
### Adicionado
- Persistência automática do jogo no config.ini
- Sistema de monitoramento automático
- Atualização periódica de canais
- Gerenciador de configurações centralizado

### Melhorado
- Integração entre módulos
- Sistema de logs
- Notificações para plugins

## [1.1.1] - 2024-03-20
### Corrigido
- Erro no gerenciamento de plugins durante scan de streams
- Melhor integração com sistema de logging
- Singleton para gerenciamento de plugins

### Melhorado
- Performance do scanner de streams
- Integração com plugins existentes
- Documentação inline do código

## [1.1.0] - 2024-03-20
### Adicionado
- Novo sistema de scanning de streams com processamento em lote
- Pool de requisições com limite de concorrência
- Sistema inteligente de rate limiting
- Integração com plugins para monitoramento de progresso
- Eventos de progresso para Discord Notifier

### Melhorado
- Performance geral do scanning de streams
- Gestão de recursos e conexões
- Tratamento de erros e recuperação
- Documentação do sistema de scanning

### Inalterado
- Compatibilidade total com sistema de plugins existente
- Funcionalidades core do sistema
- Formato dos arquivos de configuração

## [1.0.0] - 2024-02-20
### Adicionado
- Primeira versão pública
- Suporte básico a monitoramento de canais
- Sistema de renovação de tokens
- Detecção simples de padrões
- Interface de linha de comando básica 