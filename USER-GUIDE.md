# Guia do Usuário - Twitch Giveaway Monitor

Este guia explica como utilizar o Twitch Giveaway Monitor através da interface TUI (Text User Interface).

## Iniciando o Programa

1. Abra um terminal na pasta do projeto
2. Execute o comando: `node twgiveaways.js`

## Menu Principal

O programa apresenta as seguintes opções:

1. **Adicionar conta**
   - Gera URL de autorização para nova conta
   - Guia você pelo processo de autorização
   - Salva automaticamente no contas.json

2. **Gerar Tokens**
   - Use após autorizar uma conta
   - Requer a URL de redirecionamento
   - Gera e salva os tokens necessários

3. **Renovar Tokens**
   - Verifica e renova tokens expirados
   - Execução automática antes do monitoramento
   - Pode ser executado manualmente

4. **Setar Canais**
   - Define o jogo a ser monitorado
   - Busca canais ativos do jogo
   - Filtra canais relevantes
   - Salva lista em canais.json

5. **Scanear Canais**
   - Atualiza lista de canais
   - Mantém o jogo atual
   - Útil para refresh rápido

6. **Monitorar Canais**
   - Inicia o monitoramento
   - Atualiza canais a cada 30 minutos
   - Mostra eventos em tempo real
   - Registra whispers e participações

## Configurações Avançadas

### Pattern Detection (config.ini)
[PATTERN_DETECTION] \
THRESHOLD=5        # Mínimo de mensagens similares \
TIME_WINDOW=30000  # Janela de tempo (ms) \
CLEANUP_INTERVAL=60000  # Limpeza de histórico (ms) \
MIN_MESSAGE_LENGTH=3    # Tamanho mínimo da mensagem

### Palavras-chave Monitoradas
- !ticket
- !join
- winner
- giveaway
- key
- !raffle
- !sorteio
- !sorteo
- !claim

## Monitoramento em Tempo Real

Durante o monitoramento, você verá:
- Mensagens relevantes destacadas
- Whispers recebidos
- Padrões detectados
- Status de atualização de canais
- Erros e eventos importantes

### Formato das Mensagens
👉 👉 👉 👉 [14:30:45] NomeDoCanal | Usuário: Mensagem com palavra-chave destacada

### Formato de Whispers
💌 💌 💌 💌 💌 [14:30:45] Sussurro de streamer123 para suaConta:
Mensagem recebida

⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ATENÇÃO! Mensagem privada recebida!

## Encerrando o Programa

- Pressione `Ctrl+C` durante o monitoramento
- Selecione "Sair" no menu principal
- O programa desconectará adequadamente os bots

## Solução de Problemas

1. **Tokens Inválidos**
   - Use "Renovar Tokens"
   - Se persistir, reautorize a conta

2. **Erro de Conexão**
   - Verifique sua internet
   - Verifique os tokens
   - Consulte log/error.log

3. **Nenhum Canal Encontrado**
   - Verifique o nome do jogo
   - Use "Scanear Canais"
   - Tente em outro horário

4. **Erros de Autorização**
   - Verifique config.ini
   - Reautorize as contas
   - Verifique os scopes

## Boas Práticas

1. **Manutenção**
   - Renove tokens regularmente
   - Monitore os logs
   - Atualize a lista de canais

2. **Performance**
   - Evite muitas contas simultâneas
   - Limpe logs periodicamente
   - Mantenha tokens atualizados

3. **Segurança**
   - Use contas secundárias
   - Não compartilhe tokens
   - Mantenha backups