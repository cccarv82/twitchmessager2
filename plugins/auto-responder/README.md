# Auto Responder Plugin

Gerencia respostas automáticas para whispers e vitórias na Twitch.

## Características
- Respostas automáticas para whispers
- Respostas automáticas para vitórias
- Detecção automática de idioma
- Suporte para Português, Inglês e Espanhol
- Rate limiting para evitar spam
- Integração com Discord para logs

## Configuração
```json
{
    "enabled": true,
    "features": {
        "whisperResponses": {
            "enabled": true,
            "delay": {
                "min": 1000,
                "max": 3000
            }
        },
        "winResponses": {
            "enabled": true,
            "delay": {
                "min": 2000,
                "max": 5000
            }
        }
    }
}
```

## Dependências
- Smart Keywords (opcional): Para detecção de idioma
- Discord Notifier (opcional): Para logs no Discord

## Uso
O plugin funciona automaticamente após instalado e configurado. Ele irá:
1. Responder whispers recebidos no idioma detectado
2. Responder quando ganhar algum sorteio
3. Enviar logs para o Discord (se configurado)

## Rate Limiting
- 1 resposta a cada 5 minutos por usuário
- Delays aleatórios entre respostas