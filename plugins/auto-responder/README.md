# Auto Responder Plugin

Plugin para respostas automáticas a whispers e vitórias.

## Features
- Respostas automáticas para whispers
- Respostas automáticas para vitórias
- Detecção automática de idioma
- Rate limiting para evitar spam
- Integração com Discord para logs

## Hooks Utilizados

### Smart Keywords
- `detectLanguage(message)` - Detecta o idioma de uma mensagem
  - **Retorno**: `{ result: string, confidence: number }`

### Discord Notifier
- `sendDiscordNotification(title, message, options)` - Envia notificação para o Discord
  - **Parâmetros**:
    - `title` (string) - Título da mensagem
    - `message` (string) - Conteúdo da mensagem
    - `options` (object) - Opções de formatação

## Eventos Escutados
- `onWhisperReceived(from, message, recipientUsername)` - Responde whispers
- `onWin(channel, prize)` - Responde vitórias

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