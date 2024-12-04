# Blacklist Plugin

Plugin para gerenciamento de blacklists de palavras e canais no Twitch Giveaway Monitor.

## Funcionalidades

- 🚫 Bloqueio de palavras específicas
- 🔒 Bloqueio de canais
- 📝 Log de detecções
- 💾 Backup automático
- 🔄 Sincronização automática

## Instalação

1. Coloque os arquivos na pasta `plugins/blacklist/`
2. Configure o `config.json` conforme necessário
3. Reinicie o monitor

## Arquivos de Blacklist

- `data/palavras-bl.json`: Lista de palavras bloqueadas
- `data/canais-bl.json`: Lista de canais bloqueados
- `data/blacklist.log`: Log de detecções e alterações

## Configuração

```json
{
    "features": {
        "wordBlacklist": {
            "enabled": true,
            "caseSensitive": false,
            "autoBackup": true
        },
        "channelBlacklist": {
            "enabled": true,
            "autoSync": true
        }
    }
}
```

## Uso

O plugin automaticamente:
1. Bloqueia mensagens com palavras proibidas
2. Impede entrada em canais bloqueados
3. Mantém logs de todas as detecções
4. Faz backup periódico das listas

## Gerenciamento

Use os métodos do plugin para gerenciar as listas:
```javascript
const blacklist = pluginManager.plugins.get('Blacklist');

// Adicionar
await blacklist.addWord('palavraProibida');
await blacklist.addChannel('canalBloqueado');

// Remover
await blacklist.removeWord('palavraProibida');
await blacklist.removeChannel('canalBloqueado');

// Verificar
blacklist.isWordBlacklisted('palavra');
blacklist.isChannelBlacklisted('canal');
``` 