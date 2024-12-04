# Changelog
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2024-03-05
### Adicionado
- Sistema de plugins com suporte a hooks e dependências
- Plugin Discord Notifier para integração com Discord
- Plugin Smart Keywords para detecção inteligente de padrões
- Plugin Blacklist para gerenciamento de palavras e canais bloqueados
- Plugin Auto Responder para respostas automáticas
- Sistema de rate limiting por canal e global
- Análise de contexto para detecção de giveaways
- Aprendizado automático de comandos
- Suporte a múltiplos idiomas
- Sistema de logs e estatísticas por plugin
- Auto Responder Plugin v1.0.0
  - Respostas automáticas multilíngues
  - Detecção de idioma
  - Rate limiting
  - Integração com Discord

### Modificado
- Refatoração do sistema de detecção de padrões
- Melhorias na interface de linha de comando
- Otimização no gerenciamento de memória

### Corrigido
- Problema com tokens expirados
- Melhor tratamento de erros na conexão com Twitch
- Redução de falsos positivos na detecção

## [1.0.0] - 2024-02-20
### Adicionado
- Primeira versão pública
- Suporte básico a monitoramento de canais
- Sistema de renovação de tokens
- Detecção simples de padrões
- Interface de linha de comando básica 