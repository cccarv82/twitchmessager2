# Desenvolvimento de Plugins

## Visão Geral
O sistema de plugins permite estender as funcionalidades do bot de forma modular através de eventos e hooks.

## Estrutura Básica de um Plugin
```javascript
const PluginBase = require('../../src/plugins/PluginBase');

class MeuPlugin extends PluginBase {
    constructor(manager) {
        super(manager);
        this.name = 'Meu Plugin';
        this.description = 'Descrição do meu plugin';
        this.version = '1.0.0';
    }

    async onLoad() {
        // Inicialização do plugin
    }
}
```

## Eventos Disponíveis
Todos os plugins podem escutar os seguintes eventos:

| Evento | Parâmetros | Descrição |
|--------|------------|-----------|
| `onMessage` | `(channel, message)` | Quando uma mensagem é recebida em um canal |
| `onWhisperReceived` | `(from, message, recipientUsername)` | Quando um whisper é recebido |
| `onWin` | `(channel, prize)` | Quando uma vitória é detectada |
| `onGiveawayDetected` | `(channel, message, pattern)` | Quando um giveaway é detectado |
| `onChannelJoin` | `(channel)` | Quando entra em um canal |
| `onChannelPart` | `(channel)` | Quando sai de um canal |
| `onError` | `(error)` | Quando ocorre um erro |

## Sistema de Hooks
Hooks permitem que plugins forneçam funcionalidades para outros plugins.

### Usando Hooks
```javascript
// No seu plugin
async minhaFuncao() {
    // Verifica se tem acesso ao plugin
    if (this.hasProvider('Nome do Plugin')) {
        // Usa o hook
        const result = await this.useHook('nomeDoHook', param1, param2);
    }
}
```

### Registrando Hooks
```javascript
// No construtor do seu plugin
constructor(manager) {
    super(manager);
    
    // Registra o hook
    this.registerHook('meuHook', async (param1, param2) => {
        // Sua implementação
        return result;
    });
}
```

## Configuração do Plugin
Cada plugin deve ter um arquivo `config.json`:

```json
{
    "enabled": true,
    "features": {
        "minhaFeature": {
            "enabled": true,
            "config": "valor"
        }
    },
    "providers": {
        "Plugin Necessário": {
            "required": true,
            "hooks": ["hookNecessario"]
        }
    }
}
```

## Plugins Disponíveis
- [Auto Responder](../plugins/auto-responder/README.md)
- [Blacklist](../plugins/blacklist/README.md)
- [Discord Notifier](../plugins/discord-notifier/README.md)
- [Smart Keywords](../plugins/smart-keywords/README.md) 