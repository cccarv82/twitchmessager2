const PluginBase = require('../../src/plugins/PluginBase');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ini = require('ini');

class AutoResponderPlugin extends PluginBase {
    constructor(manager) {
        super(manager);
        this.name = 'Auto Responder';
        this.description = 'Gerencia respostas automáticas para eventos';
        this.version = '1.0.0';
        
        // Cache de respostas recentes
        this.recentResponses = new Map();
        
        // Providers disponíveis
        this.hasSmartKeywords = false;
        this.hasDiscordNotifier = false;
    }

    async onLoad() {
        if (!this.silent) {
            console.log(chalk.cyan(`Inicializando ${this.name}...`));
        }

        // Carrega configurações do Twitch
        const configFile = await fs.readFile('./config.ini', 'utf-8');
        const config = ini.parse(configFile);
        this.clientId = config.CLIENT.ID;

        // Verifica providers usando o manager ao invés de global
        this.hasSmartKeywords = this.manager.plugins.has('Smart Keywords');
        this.hasDiscordNotifier = this.manager.plugins.has('Discord Notifier');

        if (!this.silent) {
            console.log(chalk.green(`✓ ${this.name} inicializado com sucesso`));
            if (this.hasSmartKeywords) {
                console.log(chalk.gray(`   ✓ Usando Smart Keywords para detecção de idioma`));
            }
            if (this.hasDiscordNotifier) {
                console.log(chalk.gray(`   ✓ Usando Discord para logs`));
            }
        }
    }

    async ensureOwnChannel(recipientBot) {
        const ownChannel = `#${recipientBot.getUsername()}`;
        
        if (!recipientBot.getChannels().includes(ownChannel)) {
            try {
                await recipientBot.join(ownChannel);
                console.log(chalk.gray(`   ✓ Bot entrou em seu próprio canal para whispers`));
                // Pequeno delay para garantir que entrou no canal
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error('Erro ao entrar no próprio canal:', error);
                return false;
            }
        }
        return true;
    }

    async validateScopes(bot) {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${bot.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to validate token: ${response.status}`);
            }

            const data = await response.json();

            if (!data.scopes.includes('user:manage:whispers')) {
                console.error(chalk.red(`[Auto Responder] Bot ${bot.getUsername()} não tem o scope necessário para whispers`));
                console.error(chalk.yellow('Por favor, reautorize a conta com os scopes corretos'));
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro ao validar scopes:', error);
            return false;
        }
    }

    async sendWhisper(bot, toUsername, message) {
        // Primeiro valida os scopes
        if (!await this.validateScopes(bot)) {
            return false;
        }

        try {
            // Primeiro precisamos obter o user_id do destinatário
            const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${toUsername}`, {
                headers: {
                    'Authorization': `Bearer ${bot.access_token}`,
                    'Client-Id': this.clientId
                }
            });

            if (!userResponse.ok) {
                throw new Error(`Failed to get user info: ${userResponse.status} - ${await userResponse.text()}`);
            }

            const userData = await userResponse.json();
            const toUserId = userData.data[0].id;

            // Também precisamos do ID do bot
            const fromUserResponse = await fetch(`https://api.twitch.tv/helix/users?login=${bot.getUsername()}`, {
                headers: {
                    'Authorization': `Bearer ${bot.access_token}`,
                    'Client-Id': this.clientId
                }
            });

            if (!fromUserResponse.ok) {
                throw new Error(`Failed to get bot info: ${fromUserResponse.status} - ${await fromUserResponse.text()}`);
            }

            const fromUserData = await fromUserResponse.json();
            const fromUserId = fromUserData.data[0].id;

            // Agora podemos enviar o whisper
            const response = await fetch(`https://api.twitch.tv/helix/whispers?from_user_id=${fromUserId}&to_user_id=${toUserId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${bot.access_token}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`Failed to send whisper: ${response.status} - ${await response.text()}`);
            }

            return true;
        } catch (error) {
            console.error('Error sending whisper:', error);
            return false;
        }
    }

    async onWhisperReceived(from, message, recipientUsername) {
        if (!this.config.features.whisperResponses.enabled) return;

        const fromUser = from.replace('#', '');
        const lastResponse = this.recentResponses.get(fromUser);
        if (lastResponse && Date.now() - lastResponse < 300000) return;

        try {
            const delay = Math.floor(
                Math.random() * 
                (this.config.features.whisperResponses.delay.max - this.config.features.whisperResponses.delay.min) +
                this.config.features.whisperResponses.delay.min
            );

            // Detecção de idioma melhorada
            let language = 'en'; // Mantém inglês como padrão
            if (this.hasSmartKeywords) {
                try {
                    const results = await this.useHook('detectLanguage', message);
                    if (results && results.length > 0) {
                        // Primeiro tenta detectar por palavras-chave comuns
                        const text = message.toLowerCase();
                        if (text.match(/\b(oi|olá|obrigad|valeu|beleza|eae|blz|falou)\b/)) {
                            language = 'pt';
                        } else if (text.match(/\b(hola|gracias|vale|perfecto|buenos|adios)\b/)) {
                            language = 'es';
                        } else {
                            // Se não encontrou palavras-chave, usa a detecção do Smart Keywords
                            const detections = results.sort((a, b) => b.confidence - a.confidence);
                            const bestMatch = detections[0];

                            if (bestMatch.confidence > 0.7) {
                                language = bestMatch.result;
                                if (!this.silent) {
                                    console.log(chalk.gray(`[Auto Responder] Idioma detectado: ${language} (${Math.round(bestMatch.confidence * 100)}% confiança)`));
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao detectar idioma:', error);
                }
            }

            // Seleciona template baseado no idioma (com fallback para português)
            const templates = this.config.features.whisperResponses.templates[language] || 
                            this.config.features.whisperResponses.templates.pt;

            // Seleciona resposta aleatória
            const response = templates[Math.floor(Math.random() * templates.length)];

            await new Promise(resolve => setTimeout(resolve, delay));

            // Encontra o bot que recebeu o whisper
            const recipientBot = global?.activeBots?.find(bot => 
                bot.getUsername().toLowerCase() === recipientUsername.toLowerCase()
            );

            if (recipientBot) {
                // Pega o token da conta do arquivo contas.json
                const contasData = await fs.readFile('contas.json', 'utf8');
                const contas = JSON.parse(contasData);
                const botConta = contas.find(c => c.nome.toLowerCase() === recipientUsername.toLowerCase());

                if (botConta) {
                    recipientBot.access_token = botConta.access_token;
                    const success = await this.sendWhisper(recipientBot, fromUser, response);
                    
                    if (success) {
                        console.log(chalk.green(`[Auto Responder] Whisper enviado de ${recipientUsername} para ${fromUser}: ${response}`));
                        this.recentResponses.set(fromUser, Date.now());

                        if (this.hasDiscordNotifier) {
                            await this.useHook('sendDiscordNotification',
                                '🤖 Resposta Automática (Whisper)',
                                `De: ${recipientUsername}\nPara: ${fromUser}\nResposta: ${response}`,
                                { color: 0x00FF00 }
                            );
                        }
                    }
                } else {
                    console.error(`[Auto Responder] Não foi possível encontrar as credenciais do bot ${recipientUsername}`);
                }
            } else {
                console.error(`[Auto Responder] Bot ${recipientUsername} não encontrado para responder whisper de ${fromUser}`);
            }
        } catch (error) {
            console.error('Erro ao responder whisper:', error);
        }
    }
}

module.exports = AutoResponderPlugin; 