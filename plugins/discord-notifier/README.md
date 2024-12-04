# Discord Notifier Plugin

Plugin para enviar notificações do Twitch Giveaway Monitor para um canal do Discord através de webhook.

## Funcionalidades

- 🎉 Notificação de giveaways detectados
- 🏆 Alertas de vitórias
- 💌 Notificação de whispers
- 📊 Atualizações de canais
- ⚠️ Relatório de erros
- 🔌 Eventos do ciclo de vida do plugin

## Instalação

1. Certifique-se que o diretório `plugins` existe na raiz do projeto
2. Crie uma pasta `discord-notifier` dentro de `plugins`
3. Copie os arquivos do plugin para a pasta:
   - `index.js`
   - `config.json`
   - `README.md`

## Configuração do Webhook

1. No Discord:
   - Abra as configurações do canal onde deseja receber as notificações
   - Vá em "Integrações" > "Webhooks"
   - Clique em "Novo Webhook"
   - Dê um nome (ex: "Twitch Monitor")
   - Copie a URL do webhook

2. No `config.json`:
   - Cole a URL do webhook no campo `webhookUrl`
   ```json
   {
       "webhookUrl": "https://discord.com/api/webhooks/seu-webhook-aqui"
   }
   ```

## Configurações Disponíveis

```json
{
    "enabled": true,
    "webhookUrl": "sua-url-aqui",
    "features": {
        "giveawayDetection": {
            "enabled": true,
            "includePattern": true,    // Mostra detalhes do padrão detectado
            "mentionRole": "",         // ID do cargo para mencionar
            "cooldown": 30             // Tempo entre notificações (segundos)
        },
        "winNotification": {
            "enabled": true,
            "mentionEveryone": false,  // Menciona @everyone nas vitórias
            "includeStats": true       // Mostra estatísticas
        },
        "whisperNotification": {
            "enabled": true,
            "onlyKeywords": false      // Apenas whispers importantes
        },
        "channelUpdates": {
            "enabled": false,          // Notifica mudanças de canais
            "onlyListener": true       // Apenas do bot principal
        },
        "errorReporting": {
            "enabled": true,
            "detailLevel": "full"      // full, basic, none
        },
        "lifecycleEvents": {
            "enabled": true,           // Eventos do plugin
            "notifyOnLoad": true,      // Carregamento
            "notifyOnUnload": true,    // Descarregamento
            "notifyOnEnable": true,    // Ativação
            "notifyOnDisable": true    // Desativação
        }
    },
    "formatting": {
        "useEmbed": true,             // Usa embeds mais bonitos
        "color": "#FF0000",           // Cor dos embeds
        "includeTimestamp": true,     // Adiciona timestamp
        "includePluginVersion": true   // Mostra versão do plugin
    }
}
```

## Exemplos de Notificações

### Detecção de Giveaway
```
🎉 Novo Giveaway Detectado!
Canal: streamer123
Mensagem: Digite !join para participar
Padrão: Mensagem repetida 5 vezes em 30s
```

### Vitória
```
🏆 GANHAMOS!
Canal: streamer123
Prêmio: Key de Jogo AAA
Total de vitórias: 42
```

### Whisper
```
💌 Whisper Recebido
De: streamer123
Mensagem: Parabéns! Você ganhou! Aqui está sua key: XXXX-XXXX
```

## Personalizando Menções

1. Para mencionar um cargo:
   - Clique com botão direito no cargo no Discord
   - "Copiar ID" (modo desenvolvedor deve estar ativado)
   - Cole o ID em `features.giveawayDetection.mentionRole`

2. Para mencionar @everyone:
   - Configure `features.winNotification.mentionEveryone` como `true`

## Solução de Problemas

1. **Webhook não funciona**
   - Verifique se a URL está correta
   - Confirme as permissões do webhook no canal
   - Verifique os logs de erro do plugin

2. **Muitas notificações**
   - Ajuste o `cooldown` em `giveawayDetection`
   - Ative `onlyKeywords` para whispers
   - Desative features não utilizadas

3. **Mensagens não formatadas**
   - Verifique se `useEmbed` está ativado
   - Confirme permissões do webhook para embeds

## Suporte

- Verifique os logs em `error.log`
- Ative `errorReporting` com `detailLevel: "full"`
- Consulte a documentação do plugin base

## Contribuindo

Pull requests são bem-vindos! Por favor:
1. Mantenha o padrão de código
2. Documente novas funcionalidades
3. Atualize o README se necessário 