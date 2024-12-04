# Auto Responder Plugin

Plugin para gerenciar respostas automáticas para diferentes eventos.

## Funcionalidades

- 🏆 Respostas automáticas para vitórias
- 💌 Respostas automáticas para whispers
- 🌍 Suporte a múltiplos idiomas
- ⏱️ Delays aleatórios
- 📊 Logs de respostas

## Integrações

### Smart Keywords
Se disponível, usa para:
- Detecção automática de idioma
- Seleção inteligente de respostas

### Discord Notifier
Se disponível, notifica sobre:
- Respostas enviadas
- Erros de envio
- Estatísticas de uso

## Configuração

```json
{
    "features": {
        "winResponses": {
            "enabled": true,
            "templates": {
                "pt": ["Obrigado {streamer}!"],
                "en": ["Thanks {streamer}!"]
            }
        }
    }
}
```

## Templates

Variáveis disponíveis:
- `{streamer}`: Nome do streamer
- `{prize}`: Prêmio ganho (quando disponível) 