# Discord Notifier Plugin

Plugin para integração com Discord.

## Hooks Fornecidos

### sendDiscordNotification
Envia uma notificação para o canal configurado no Discord.

**Parâmetros:**
- `title` (string) - Título da mensagem
- `message` (string) - Conteúdo da mensagem
- `options` (object) - Opções de formatação
  - `color` (number) - Cor da mensagem em hexadecimal
  - `fields` (array) - Campos adicionais

**Exemplo:**

```javascript
await plugin.useHook('sendDiscordNotification',
    'Título',
    'Mensagem',
    { color: 0x00FF00 }
);
```

## Eventos Escutados
- `onGiveawayDetected` - Notifica sobre giveaways detectados
- `onWin` - Notifica sobre vitórias
- `onWhisperReceived` - Notifica sobre whispers recebidos
- `onError` - Notifica sobre erros

## Configuração

```json
{
    "enabled": true,
    "features": {
        "giveawayDetection": { "enabled": true },
        "winNotification": { "enabled": true },
        "whisperNotification": { "enabled": true },
        "channelUpdates": { "enabled": false },
        "errorReporting": { "enabled": true },
        "lifecycleEvents": { "enabled": true }
    },
    "discord": {
        "webhook": "URL_DO_WEBHOOK",
        "channel": "ID_DO_CANAL"
    }
}
```