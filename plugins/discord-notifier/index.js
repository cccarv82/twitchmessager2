/**
 * Plugin de Exemplo: Discord Notifier
 * 
 * Este plugin demonstra como criar uma integração com Discord para o Twitch Giveaway Monitor.
 * Serve como exemplo de implementação e documentação para desenvolvedores criarem seus próprios plugins.
 * 
 * Recursos demonstrados:
 * - Extensão da classe base de plugins
 * - Configuração via arquivo JSON
 * - Integração com serviço externo (Discord)
 * - Tratamento de eventos do monitor
 * - Uso de webhooks
 */

// Importa a classe base que todo plugin deve estender
const PluginBase = require('../../src/plugins/PluginBase');

// Importa dependências específicas deste plugin
const { Client, GatewayIntentBits, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Classe principal do plugin
 * Todo plugin deve estender PluginBase e implementar seus métodos conforme necessário
 */
class DiscordNotifierPlugin extends PluginBase {
    /**
     * Construtor do plugin
     * Aqui definimos as informações básicas que todo plugin deve ter
     */
    constructor() {
        super(); // Sempre chame o construtor da classe pai primeiro

        // Propriedades obrigatórias
        this.name = 'Discord Notifier';          // Nome único do plugin
        this.description = 'Envia notificações para um canal do Discord'; // Descrição clara
        this.version = '1.0.0';                  // Versão semântica

        // Propriedades específicas deste plugin
        this.webhook = null;                     // Instância do webhook do Discord
        this.lastNotification = 0; // Para controle de cooldown
        this.errorLog = path.join(process.cwd(), 'log', 'error.log');
    }

    /**
     * Método de inicialização do plugin
     * Chamado quando o plugin é carregado
     * Use para inicializar recursos, conexões, etc.
     * 
     * this.config contém as configurações do config.json
     */
    async onLoad() {
        // Verifica se temos a URL do webhook nas configurações
        if (this.config.webhookUrl) {
            try {
                this.webhook = new WebhookClient({ url: this.config.webhookUrl });
                
                // Notifica carregamento se configurado
                if (this.config.features?.lifecycleEvents?.enabled && 
                    this.config.features.lifecycleEvents.notifyOnLoad) {
                    
                    const notification = this.config.formatting?.useEmbed ? {
                        embeds: [{
                            title: '🔌 Plugin Carregado',
                            description: [
                                `Nome: ${this.name}`,
                                `Versão: ${this.version}`,
                                `Descrição: ${this.description}`
                            ].join('\n'),
                            color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                            timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                        }],
                        username: 'Twitch Giveaway Monitor'
                    } : {
                        content: [
                            '🔌 **Plugin Carregado**',
                            `Nome: ${this.name}`,
                            `Versão: ${this.version}`,
                            `Descrição: ${this.description}`
                        ].join('\n'),
                        username: 'Twitch Giveaway Monitor'
                    };

                    await this.webhook.send(notification);
                }
            } catch (error) {
                throw new Error(`Falha ao inicializar webhook: ${error.message}`);
            }
        } else {
            console.warn('Discord Notifier: webhookUrl não configurada');
        }
    }

    /**
     * Evento: Detecção de Giveaway
     * Chamado quando um possível giveaway é detectado em um canal
     * 
     * @param {string} channel - Nome do canal onde o giveaway foi detectado
     * @param {string} message - Mensagem que triggou a detecção
     * @param {object} pattern - Objeto com informações do padrão detectado
     */
    async onGiveawayDetected(channel, message, pattern) {
        // Verifica se a feature está ativada
        if (!this.webhook || !this.config.features?.giveawayDetection?.enabled) return;

        // Verifica cooldown
        const now = Date.now();
        const cooldown = (this.config.features.giveawayDetection.cooldown || 30) * 1000;
        if (now - this.lastNotification < cooldown) return;
        this.lastNotification = now;

        try {
            const notification = this.config.formatting?.useEmbed ? {
                embeds: [{
                    title: '🎉 Novo Giveaway Detectado!',
                    description: [
                        `Canal: ${channel}`,
                        `Mensagem: ${message}`,
                        this.config.features.giveawayDetection.includePattern ? `Padrão: ${pattern}` : null
                    ].filter(Boolean).join('\n'),
                    color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                    timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                }],
                username: 'Twitch Giveaway Monitor',
                content: this.config.features.giveawayDetection.mentionRole ? 
                    `<@&${this.config.features.giveawayDetection.mentionRole}>` : ''
            } : {
                content: [
                    this.config.features.giveawayDetection.mentionRole ? 
                        `<@&${this.config.features.giveawayDetection.mentionRole}>` : '',
                    '🎉 **Novo Giveaway Detectado!**',
                    `Canal: ${channel}`,
                    `Mensagem: ${message}`,
                    this.config.features.giveawayDetection.includePattern ? `Padrão: ${pattern}` : null
                ].filter(Boolean).join('\n'),
                username: 'Twitch Giveaway Monitor'
            };

            await this.webhook.send(notification);
        } catch (error) {
            if (this.config.features?.errorReporting?.enabled) {
                console.error('Discord Notifier: Erro ao enviar notificação:', 
                    this.config.features.errorReporting.detailLevel === 'full' ? error : error.message);
                this.emit('error', error);
            }
        }
    }

    /**
     * Evento: Vitória Detectada
     * Chamado quando uma vitória é detectada para alguma conta monitorada
     * 
     * @param {string} channel - Canal onde ocorreu a vitória
     * @param {string} prize - Informação sobre o prêmio (se disponível)
     */
    async onWin(channel, prize) {
        if (!this.webhook || !this.config.features?.winNotification?.enabled) return;

        try {
            const notification = this.config.formatting?.useEmbed ? {
                embeds: [{
                    title: '🏆 GANHAMOS!',
                    description: [
                        `Canal: ${channel}`,
                        prize ? `Prêmio: ${prize}` : 'Prêmio não especificado',
                        this.config.features.winNotification.includeStats ? 
                            `Total de vitórias: ${await this.getWinStats()}` : null
                    ].filter(Boolean).join('\n'),
                    color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                    timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                }],
                username: 'Twitch Giveaway Monitor',
                content: this.config.features.winNotification.mentionEveryone ? '@everyone' : ''
            } : {
                content: [
                    this.config.features.winNotification.mentionEveryone ? '@everyone' : '',
                    '🏆 **GANHAMOS!**',
                    `Canal: ${channel}`,
                    prize ? `Prêmio: ${prize}` : 'Prêmio não especificado',
                    this.config.features.winNotification.includeStats ? 
                        `Total de vitórias: ${await this.getWinStats()}` : null
                ].filter(Boolean).join('\n'),
                username: 'Twitch Giveaway Monitor'
            };

            await this.webhook.send(notification);
        } catch (error) {
            if (this.config.features?.errorReporting?.enabled) {
                console.error('Discord Notifier: Erro ao enviar notificação de vitória:', 
                    this.config.features.errorReporting.detailLevel === 'full' ? error : error.message);
                this.emit('error', error);
            }
        }
    }

    // Métodos auxiliares
    async getWinStats() {
        try {
            const wins = JSON.parse(await fs.readFile('wins.json', 'utf8'));
            return wins.length;
        } catch {
            return 0;
        }
    }

    /**
     * Evento: Whisper Recebido
     * Chamado quando um whisper é recebido por qualquer conta monitorada
     * 
     * @param {string} from - Usuário que enviou o whisper
     * @param {string} message - Conteúdo do whisper
     */
    async onWhisperReceived(from, message) {
        if (!this.webhook || !this.config.features?.whisperNotification?.enabled) return;

        // Se configurado para apenas keywords, verifica se a mensagem contém alguma
        if (this.config.features.whisperNotification.onlyKeywords) {
            const hasKeyword = WHISPER_PATTERNS.some(pattern => 
                message.toLowerCase().includes(pattern.toLowerCase())
            );
            if (!hasKeyword) return;
        }

        try {
            const notification = this.config.formatting?.useEmbed ? {
                embeds: [{
                    title: '💌 Whisper Recebido',
                    description: [
                        `De: ${from}`,
                        `Mensagem: ${message}`
                    ].join('\n'),
                    color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                    timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                }],
                username: 'Twitch Giveaway Monitor'
            } : {
                content: [
                    '💌 **Whisper Recebido**',
                    `De: ${from}`,
                    `Mensagem: ${message}`
                ].join('\n'),
                username: 'Twitch Giveaway Monitor'
            };

            await this.webhook.send(notification);
        } catch (error) {
            if (this.config.features?.errorReporting?.enabled) {
                console.error('Discord Notifier: Erro ao enviar notificação de whisper:', 
                    this.config.features.errorReporting.detailLevel === 'full' ? error : error.message);
                this.emit('error', error);
            }
        }
    }

    /**
     * Evento: Entrada em Canal
     * Chamado quando um bot entra em um canal
     * 
     * @param {string} channel - Canal que entrou
     */
    async onChannelJoin(channel) {
        if (!this.webhook || 
            !this.config.features?.channelUpdates?.enabled ||
            (this.config.features.channelUpdates.onlyListener && !this.isListener)) return;

        try {
            const notification = this.config.formatting?.useEmbed ? {
                embeds: [{
                    title: '📥 Novo Canal Adicionado',
                    description: `Entrou no canal: ${channel}`,
                    color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                    timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                }],
                username: 'Twitch Giveaway Monitor'
            } : {
                content: `📥 **Novo Canal Adicionado**\nEntrou no canal: ${channel}`,
                username: 'Twitch Giveaway Monitor'
            };

            await this.webhook.send(notification);
        } catch (error) {
            if (this.config.features?.errorReporting?.enabled) {
                console.error('Discord Notifier: Erro ao enviar notificação de entrada:', 
                    this.config.features.errorReporting.detailLevel === 'full' ? error : error.message);
                this.emit('error', error);
            }
        }
    }

    /**
     * Evento: Saída de Canal
     * Chamado quando um bot sai de um canal
     * 
     * @param {string} channel - Canal que saiu
     */
    async onChannelPart(channel) {
        if (!this.webhook || 
            !this.config.features?.channelUpdates?.enabled ||
            (this.config.features.channelUpdates.onlyListener && !this.isListener)) return;

        try {
            const notification = this.config.formatting?.useEmbed ? {
                embeds: [{
                    title: '📤 Canal Removido',
                    description: `Saiu do canal: ${channel}`,
                    color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                    timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                }],
                username: 'Twitch Giveaway Monitor'
            } : {
                content: `📤 **Canal Removido**\nSaiu do canal: ${channel}`,
                username: 'Twitch Giveaway Monitor'
            };

            await this.webhook.send(notification);
        } catch (error) {
            await this.logError(`Erro ao sair do canal ${channel}`, error);
        }
    }

    /**
     * Evento: Erro
     * Chamado quando ocorre um erro no plugin
     * 
     * @param {Error} error - Objeto de erro
     */
    async onError(error) {
        if (!this.webhook || !this.config.features?.errorReporting?.enabled) return;

        try {
            const notification = this.config.formatting?.useEmbed ? {
                embeds: [{
                    title: '⚠️ Erro no Plugin',
                    description: this.config.features.errorReporting.detailLevel === 'full' ? 
                        error.stack || error.message : 
                        error.message,
                    color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                    timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                }],
                username: 'Twitch Giveaway Monitor'
            } : {
                content: [
                    '⚠️ **Erro no Plugin**',
                    this.config.features.errorReporting.detailLevel === 'full' ? 
                        error.stack || error.message : 
                        error.message
                ].join('\n'),
                username: 'Twitch Giveaway Monitor'
            };

            await this.webhook.send(notification);
        } catch (err) {
            // Aqui não usamos o errorReporting para evitar loop infinito
            console.error('Discord Notifier: Erro ao enviar notificação de erro:', err);
        }
    }

    /**
     * Evento: Descarregamento do Plugin
     * Chamado quando o plugin está sendo descarregado
     * Usado para limpeza de recursos
     */
    async onUnload() {
        if (this.webhook && 
            this.config.features?.lifecycleEvents?.enabled && 
            this.config.features.lifecycleEvents.notifyOnUnload) {
            
            try {
                const notification = this.config.formatting?.useEmbed ? {
                    embeds: [{
                        title: '🔌 Plugin Descarregado',
                        description: `O plugin ${this.name} v${this.version} foi descarregado`,
                        color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                        timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                    }],
                    username: 'Twitch Giveaway Monitor'
                } : {
                    content: `🔌 **Plugin Descarregado**\nO plugin ${this.name} v${this.version} foi descarregado`,
                    username: 'Twitch Giveaway Monitor'
                };

                await this.webhook.send(notification);
            } catch (error) {
                console.error('Erro ao enviar notificação de descarregamento:', error);
            }
        }

        // Limpa recursos
        if (this.webhook) {
            this.webhook = null;
        }
    }

    /**
     * Evento: Ativação do Plugin
     * Chamado quando o plugin é ativado
     * Diferente do onLoad, isso acontece quando o plugin é explicitamente ativado
     */
    async onEnable() {
        await super.onEnable(); // Importante: chama o método da classe pai

        if (this.webhook && 
            this.config.features?.lifecycleEvents?.enabled && 
            this.config.features.lifecycleEvents.notifyOnEnable) {
            
            try {
                const notification = this.config.formatting?.useEmbed ? {
                    embeds: [{
                        title: '✅ Plugin Ativado',
                        description: `O plugin ${this.name} v${this.version} foi ativado`,
                        color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                        timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                    }],
                    username: 'Twitch Giveaway Monitor'
                } : {
                    content: `✅ **Plugin Ativado**\nO plugin ${this.name} v${this.version} foi ativado`,
                    username: 'Twitch Giveaway Monitor'
                };

                await this.webhook.send(notification);
            } catch (error) {
                console.error('Erro ao enviar notificação de ativação:', error);
            }
        }
    }

    /**
     * Evento: Desativação do Plugin
     * Chamado quando o plugin é desativado
     * Diferente do onUnload, isso acontece quando o plugin é explicitamente desativado
     */
    async onDisable() {
        if (this.webhook && 
            this.config.features?.lifecycleEvents?.enabled && 
            this.config.features.lifecycleEvents.notifyOnDisable) {
            
            try {
                const notification = this.config.formatting?.useEmbed ? {
                    embeds: [{
                        title: '⭕ Plugin Desativado',
                        description: `O plugin ${this.name} v${this.version} foi desativado`,
                        color: parseInt((this.config.formatting.color || '#FF0000').replace('#', ''), 16),
                        timestamp: this.config.formatting.includeTimestamp ? new Date() : null
                    }],
                    username: 'Twitch Giveaway Monitor'
                } : {
                    content: `⭕ **Plugin Desativado**\nO plugin ${this.name} v${this.version} foi desativado`,
                    username: 'Twitch Giveaway Monitor'
                };

                await this.webhook.send(notification);
            } catch (error) {
                console.error('Erro ao enviar notificação de desativação:', error);
            }
        }

        await super.onDisable(); // Importante: chama o método da classe pai
    }

    /**
     * Método auxiliar para registrar erros no arquivo de log
     * @param {string} message - Mensagem de erro
     * @param {Error|null} error - Objeto de erro opcional
     */
    async logError(message, error = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}${error ? `: ${error.message}` : ''}\n`;
        
        try {
            // Garante que o diretório log existe
            const logDir = path.dirname(this.errorLog);
            await fs.promises.mkdir(logDir, { recursive: true });
            
            // Append no arquivo de log
            await fs.promises.appendFile(this.errorLog, logMessage);

            // Se errorReporting estiver ativado, envia para o Discord também
            if (this.webhook && this.config.features?.errorReporting?.enabled) {
                await this.onError(new Error(message));
            }
        } catch (logError) {
            // Se falhar ao escrever no log, mostra no console como fallback
            console.error('Erro ao escrever no arquivo de log:', logError);
        }
    }

}

// Exporta a classe do plugin
module.exports = DiscordNotifierPlugin; 