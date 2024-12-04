# Blacklist Plugin

Plugin para gerenciamento de blacklists de palavras e canais.

## Funcionalidades

- 🚫 Bloqueio de palavras específicas
- 🔒 Bloqueio de canais
- 📝 Log de detecções
- 💾 Sincronização automática

## Integrações

### Smart Keywords
Se disponível, usa análise avançada para:
- Detecção de idioma
- Cálculo de entropia
- Análise de padrões suspeitos

### Discord Notifier
Se disponível, envia notificações de:
- Palavras bloqueadas
- Canais bloqueados
- Detecções suspeitas

## Configuração

```json
{
    "features": {
        "wordBlacklist": {
            "enabled": true,
            "caseSensitive": false
        },
        "channelBlacklist": {
            "enabled": true,
            "autoSync": true
        }
    }
}
```

## Arquivos

- `palavras-bl.json`: Lista de palavras bloqueadas
- `canais-bl.json`: Lista de canais bloqueados
- `blacklist.log`: Log de detecções

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