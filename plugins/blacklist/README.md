# Blacklist Plugin

Plugin para gerenciamento de palavras e canais bloqueados.

## Hooks Fornecidos

### isChannelBlacklisted
Verifica se um canal está na blacklist.

**Parâmetros:**
- `channel` (string) - Nome do canal

**Retorno:**
- `boolean` - true se o canal estiver bloqueado

### isWordBlacklisted
Verifica se uma palavra está na blacklist.

**Parâmetros:**
- `word` (string) - Palavra para verificar

**Retorno:**
- `boolean` - true se a palavra estiver bloqueada

## Eventos Escutados
- `onMessage` - Verifica mensagens contra a blacklist

## Configuração
```json
{
    "enabled": true,
    "features": {
        "wordBlacklist": { "enabled": true },
        "channelBlacklist": { "enabled": true },
        "reporting": { "enabled": true }
    },
    "blacklist": {
        "words": [],
        "channels": []
    }
}
``` 