const PluginBase = require('../../src/plugins/PluginBase');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

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

    async onWin(channel, prize) {
        if (!this.config.features.winResponses.enabled) return;

        try {
            // Gera delay aleatório
            const delay = Math.floor(
                Math.random() * 
                (this.config.features.winResponses.delay.max - this.config.features.winResponses.delay.min) +
                this.config.features.winResponses.delay.min
            );

            // Detecta idioma se possível
            let language = 'en';
            if (this.hasSmartKeywords) {
                const [{ result }] = await this.useHook('detectLanguage', channel);
                if (result) language = result;
            }

            // Seleciona template
            const templates = this.config.features.winResponses.templates[language] || 
                            this.config.features.winResponses.templates.en;
            const template = templates[Math.floor(Math.random() * templates.length)];

            // Processa template
            const response = template
                .replace('{streamer}', channel.replace('#', ''))
                .replace('{prize}', prize || '');

            // Aguarda delay
            await new Promise(resolve => setTimeout(resolve, delay));

            // Envia resposta usando o bot vencedor
            const winnerBot = global.activeBots.find(bot => 
                bot.getUsername().toLowerCase() === channel.toLowerCase()
            );

            if (winnerBot) {
                await winnerBot.say(channel, response);
                console.log(chalk.green(`[Auto Responder] Resposta enviada em ${channel}: ${response}`));

                // Notifica Discord se disponível
                if (this.hasDiscordNotifier) {
                    await this.useHook('sendDiscordNotification', 
                        '🤖 Resposta Automática',
                        `Canal: ${channel}\nMensagem: ${response}`,
                        { color: 0x00FF00 }
                    );
                }
            } else {
                console.error(`[Auto Responder] Bot vencedor não encontrado para ${channel}`);
            }

        } catch (error) {
            console.error('Erro ao enviar resposta automática:', error);
        }
    }

    async onWhisperReceived(from, message) {
        if (!this.config.features.whisperResponses.enabled) return;

        // Evita responder ao mesmo usuário muito frequentemente
        const lastResponse = this.recentResponses.get(from);
        if (lastResponse && Date.now() - lastResponse < 300000) return; // 5 minutos

        try {
            // Gera delay aleatório
            const delay = Math.floor(
                Math.random() * 
                (this.config.features.whisperResponses.delay.max - this.config.features.whisperResponses.delay.min) +
                this.config.features.whisperResponses.delay.min
            );

            // Detecta idioma se possível
            let language = 'en';
            if (this.hasSmartKeywords) {
                const [{ result }] = await this.useHook('detectLanguage', message);
                if (result) language = result;
            }

            // Seleciona template
            const templates = this.config.features.whisperResponses.templates[language] || 
                            this.config.features.whisperResponses.templates.en;
            const response = templates[Math.floor(Math.random() * templates.length)];

            // Aguarda delay
            await new Promise(resolve => setTimeout(resolve, delay));

            // Envia resposta usando o bot que recebeu o whisper
            const recipientBot = global.activeBots.find(bot => 
                bot.getUsername().toLowerCase() === from.toLowerCase()
            );

            if (recipientBot) {
                await recipientBot.whisper(from, response);
                console.log(chalk.green(`[Auto Responder] Whisper enviado para ${from}: ${response}`));

                // Registra resposta
                this.recentResponses.set(from, Date.now());

                // Notifica Discord se disponível
                if (this.hasDiscordNotifier) {
                    await this.useHook('sendDiscordNotification',
                        '🤖 Resposta Automática (Whisper)',
                        `De: ${from}\nResposta: ${response}`,
                        { color: 0x00FF00 }
                    );
                }
            } else {
                console.error(`[Auto Responder] Bot destinatário não encontrado para ${from}`);
            }

        } catch (error) {
            console.error('Erro ao responder whisper:', error);
        }
    }
}

module.exports = AutoResponderPlugin; 