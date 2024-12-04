# Sistema de Plugins do Twitch Giveaway Monitor

## Estrutura
- `PluginBase`: Classe base para todos os plugins
- `PluginManager`: Gerenciador central de plugins
- Plugins individuais em `/plugins/{nome-do-plugin}/`

## Sistema de Hooks
Permite que plugins forneçam e consumam funcionalidades entre si.

### Registrando Hooks
```javascript
class MeuPlugin extends PluginBase {
    async onLoad() {
        this.registerHook('meuHook', this.minhaFuncao.bind(this));
    }
}
```

### Usando Hooks
```javascript
class OutroPlugin extends PluginBase {
    async algumaFuncao() {
        const resultados = await this.useHook('meuHook', arg1, arg2);
    }
}
```

### Providers
Plugins podem ser marcados como providers, oferecendo funcionalidades para outros plugins:

```json
{
    "isProvider": true,
    "providedHooks": {
        "hookName": "Descrição do hook"
    }
}
```

### Dependências
Plugins podem declarar dependências de providers:

```json
{
    "providers": {
        "Discord Notifier": {
            "required": true,
            "hooks": ["sendDiscordMessage"]
        }
    }
}
```

## Ciclo de Vida
1. Carregamento de providers
2. Carregamento de plugins regulares
3. Verificação de dependências
4. Inicialização (onLoad)
5. Ativação (onEnable)

## Debug Mode
- Ative `logLevel: "debug"` no config.json do plugin
- Veja logs detalhados de hooks e eventos 