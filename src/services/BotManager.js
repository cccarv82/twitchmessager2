const tmi = require('tmi.js');
const { logger } = require('../logger');
const fs = require('fs');
const ini = require('ini');

class BotManager {
    constructor() {
        this.listeners = new Map();
        this.participants = new Map();
        this.participationHistory = new Map();
        this.recentGiveaways = new Map();
        this.commandDetections = new Map(); // Para controlar detecções de comandos
        
        this.config = {
            participationTimeout: 10 * 60 * 1000,  // 10 minutos
            cleanupInterval: 60 * 60 * 1000,       // 1 hora
            maxRetries: 3,
            retryDelay: 2000,
            detectionCooldown: 5 * 60 * 1000,      // 5 minutos
            reconnectInterval: 5 * 60 * 1000       // Tenta reconectar a cada 5 minutos
        };

        // Inicializa com valores padrão
        this.commandsConfig = {
            known: {
                commands: [],
                minUsers: 3,
                timeWindow: 30000,
                memoryCleanup: 300000 // 5 minutos
            },
            unknown: {
                minUsers: 5,
                minMessages: 5,
                timeWindow: 30000,
                memoryCleanup: 300000 // 5 minutos
            }
        };

        this.loadConfig();

        // Inicia monitoramento de conexões
        setInterval(() => this.checkConnections(), this.config.reconnectInterval);

        // Adiciona limpeza periódica usando as configurações
        setInterval(() => {
            const now = Date.now();
            for (const [key, timestamp] of this.recentGiveaways) {
                const [channel, command] = key.split(':');
                const isKnown = this.isKnownCommand(command);
                const config = this.getCommandConfig(isKnown);
                
                if (now - timestamp > config.memoryCleanup) {
                    this.recentGiveaways.delete(key);
                    logger.debug(`Limpando memória para ${key}`);
                }
            }
        }, 60000); // Verifica a cada minuto
    }

    async loadConfig() {
        try {
            const configData = await fs.promises.readFile('./config.ini', 'utf8');
            const config = ini.parse(configData);

            // Carrega configurações de comandos conhecidos
            if (config.KNOWN_COMMANDS) {
                this.commandsConfig.known = {
                    commands: config.KNOWN_COMMANDS.COMMANDS?.split(',').map(cmd => cmd.trim()) || [],
                    minUsers: parseInt(config.KNOWN_COMMANDS.MIN_USERS) || 3,
                    timeWindow: parseInt(config.KNOWN_COMMANDS.TIME_WINDOW) || 30000,
                    memoryCleanup: parseInt(config.KNOWN_COMMANDS.MEMORY_CLEANUP) || 300000
                };
            }

            // Carrega configurações de comandos desconhecidos
            if (config.UNKNOWN_COMMANDS) {
                this.commandsConfig.unknown = {
                    minUsers: parseInt(config.UNKNOWN_COMMANDS.MIN_USERS) || 8,
                    minMessages: parseInt(config.UNKNOWN_COMMANDS.MIN_MESSAGES) || 8,
                    timeWindow: parseInt(config.UNKNOWN_COMMANDS.TIME_WINDOW) || 30000,
                    memoryCleanup: parseInt(config.UNKNOWN_COMMANDS.MEMORY_CLEANUP) || 300000
                };
            }

            logger.info('Configurações carregadas:', {
                known: this.commandsConfig.known,
                unknown: this.commandsConfig.unknown
            });
        } catch (error) {
            logger.error('Erro ao carregar configurações:', error);
        }
    }

    isKnownCommand(command) {
        const isKnown = this.commandsConfig.known.commands.includes(command.toLowerCase());
        logger.debug(`Verificando comando "${command}": ${isKnown ? 'conhecido' : 'desconhecido'}`);
        return isKnown;
    }

    getCommandConfig(isKnown) {
        return isKnown ? this.commandsConfig.known : this.commandsConfig.unknown;
    }

    hasParticipated(channel, command, botName) {
        const channelHistory = this.participationHistory.get(channel);
        if (!channelHistory) return false;

        const commandParticipants = channelHistory.get(command);
        if (!commandParticipants) return false;

        return commandParticipants.has(botName);
    }

    registerParticipation(channel, command, botName) {
        if (!this.participationHistory.has(channel)) {
            this.participationHistory.set(channel, new Map());
        }
        
        const channelHistory = this.participationHistory.get(channel);
        if (!channelHistory.has(command)) {
            channelHistory.set(command, new Set());
        }

        channelHistory.get(command).add(botName);

        setTimeout(() => {
            const cmdParticipants = channelHistory.get(command);
            if (cmdParticipants) {
                cmdParticipants.delete(botName);
                if (cmdParticipants.size === 0) {
                    channelHistory.delete(command);
                }
            }
        }, this.config.participationTimeout);
    }

    async checkConnections() {
        logger.info('Verificando conexões dos bots...');
        
        for (const [name, { bot, conta }] of this.listeners) {
            try {
                const connectedChannels = bot.getChannels();
                logger.info(`Bot ${name} está em ${connectedChannels.length} canais`);

                // Se não está em nenhum canal, tenta reconectar
                if (connectedChannels.length === 0) {
                    logger.warn(`Bot ${name} não está em nenhum canal, reconectando...`);
                    await this.reconnectBot(name, bot, conta);
                }
            } catch (error) {
                logger.error(`Erro ao verificar conexão do bot ${name}:`, error);
                await this.reconnectBot(name, bot, conta);
            }
        }
    }

    async reconnectBot(name, bot, conta) {
        try {
            await bot.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000));
            await bot.connect();
            logger.info(`Bot ${name} reconectado com sucesso`);
        } catch (error) {
            logger.error(`Erro ao reconectar bot ${name}:`, error);
        }
    }

    async connectBot(conta, canais) {
        try {
            // Valida token
            let token = conta.token;
            if (!token.startsWith('oauth:')) {
                token = `oauth:${token}`;
            }

            // Filtra canais blacklistados
            const blacklistPlugin = global.pluginManager.plugins.get('Blacklist');
            let canaisPermitidos = canais;
            
            if (blacklistPlugin) {
                canaisPermitidos = canais.filter(channel => !blacklistPlugin.isChannelBlacklisted(channel));
                logger.info(`${canais.length - canaisPermitidos.length} canais na blacklist foram ignorados`);
            }

            const bot = new tmi.Client({
                options: { 
                    debug: false,  // Desativa debug
                    skipMembership: true,
                    skipUpdatingEmotesets: true
                },
                connection: {
                    secure: true,
                    reconnect: true,
                },
                identity: {
                    username: conta.nome,
                    password: token
                },
                channels: conta.isListener ? canaisPermitidos : [],
                logger: {
                    info: () => {},  // Suprime logs info
                    warn: () => {},  // Suprime logs warn
                    error: (message) => {
                        if (!message.includes('No response from Twitch')) {
                            logger.error(message);
                        }
                    }
                }
            });

            // Configura eventos de conexão
            bot.on('connecting', () => {
                logger.info(`Bot ${conta.nome} conectando...`);
            });

            bot.on('connected', async () => {
                logger.info(`Bot ${conta.nome} conectado!`);
                
                // Se for listener, verifica se está em todos os canais
                if (conta.isListener) {
                    const currentChannels = bot.getChannels();
                    const missingChannels = canaisPermitidos.filter(c => !currentChannels.includes(c));
                    
                    for (const channel of missingChannels) {
                        try {
                            await bot.join(channel);
                            logger.info(`Bot ${conta.nome} entrou no canal: ${channel}`);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            logger.error(`Erro ao entrar no canal ${channel}:`, error);
                        }
                    }
                }
            });

            await bot.connect();

            if (conta.isListener) {
                this.listeners.set(conta.nome, { bot, conta });
                logger.info(`Listener ${conta.nome} conectado a ${canaisPermitidos.length} canais`);
                
                // Emite evento para plugins
                global.pluginManager.emit('onBotConnected', {
                    bot: conta.nome,
                    type: 'listener',
                    channels: canaisPermitidos.length
                });
            } else {
                this.participants.set(conta.nome, { bot, conta });
                logger.info(`Participante ${conta.nome} pronto`);
                
                // Emite evento para plugins
                global.pluginManager.emit('onBotConnected', {
                    bot: conta.nome,
                    type: 'participant'
                });
            }

            return bot;
        } catch (error) {
            logger.error(`Erro ao conectar bot ${conta.nome}:`, error);
            return null;
        }
    }

    shouldShowDetection(channel, command) {
        const key = `${channel}:${command}`;
        const lastDetection = this.commandDetections.get(key);
        const now = Date.now();

        // Verifica se já mostrou nos últimos 5 minutos
        if (lastDetection && (now - lastDetection) < this.config.detectionCooldown) {
            return false;
        }

        this.commandDetections.set(key, now);
        return true;
    }

    async participateInGiveaway(channel, command, detectedBy) {
        const channelName = channel.replace('#', '');
        const normalizedCommand = command.toLowerCase().trim();
        
        if (normalizedCommand.includes(' ')) return;

        const isKnownCommand = this.isKnownCommand(normalizedCommand);
        const config = this.getCommandConfig(isKnownCommand);
        const key = `${channelName}:${normalizedCommand}`;

        // Verifica se já participou recentemente
        if (!isKnownCommand) {
            const lastParticipation = this.recentGiveaways.get(key);
            if (lastParticipation && (Date.now() - lastParticipation) < config.memoryCleanup) {
                return;
            }
        }

        // Registra participação
        this.recentGiveaways.set(key, Date.now());

        // Log no console com informações mais detalhadas
        const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;
        logger.info(`
            Participando de sorteio:
            Canal: ${channelName}
            Comando: ${normalizedCommand}
            Tipo: ${isKnownCommand ? 'Conhecido' : 'Desconhecido'}
            Config: ${JSON.stringify(config)}
        `);

        // Participa com todos os bots
        const allBots = [
            ...Array.from(this.listeners.entries()).map(([name, data]) => ({...data, name, isListener: true})),
            ...Array.from(this.participants.entries()).map(([name, data]) => ({...data, name, isListener: false}))
        ];

        logger.info(`Participando com ${allBots.length} bots em ${channelName}`);

        // Tenta com cada bot
        for (const botData of allBots) {
            if (this.hasParticipated(channelName, normalizedCommand, botData.name)) {
                continue;
            }

            // Tenta até 3 vezes, com delay menor
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await this.tryParticipate(botData.bot, channel, normalizedCommand, botData.name, botData.isListener);
                    logger.info(`Bot ${botData.name} participou em ${channelName}`);
                    break;
                } catch (error) {
                    logger.error(`Tentativa ${attempt}/3 falhou para ${botData.name} em ${channelName}`);
                    if (attempt < 3) await new Promise(r => setTimeout(r, 500)); // Reduzido para 500ms
                }
            }
        }

        // Notifica plugins
        global.pluginManager.emit('onGiveawayParticipation', {
            channel: channelName,
            command: normalizedCommand,
            isKnownCommand
        });
    }

    getParticipatedBots(channel, command) {
        const channelHistory = this.participationHistory.get(channel);
        if (!channelHistory) return [];

        const commandParticipants = channelHistory.get(command);
        if (!commandParticipants) return [];

        return Array.from(commandParticipants);
    }

    async tryParticipate(bot, channel, command, botName, isListener) {
        const channelName = channel.replace('#', '');
        
        try {
            if (!isListener) {
                if (!bot.getChannels().includes(channel)) {
                    await bot.join(channel);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await new Promise(resolve => 
                setTimeout(resolve, Math.random() * 2000 + 1000)
            );

            this.registerParticipation(channelName, command, botName);

            await bot.say(channel, command);
            logger.info(`Bot ${botName} participou em ${channelName}`);

            if (!isListener) {
                setTimeout(async () => {
                    try {
                        await bot.part(channel);
                        logger.info(`Bot ${botName} saiu de ${channelName}`);
                    } catch (error) {
                        logger.error(`Erro ao sair do canal ${channelName}:`, error);
                    }
                }, 5000 + Math.random() * 2000);
            }

        } catch (error) {
            const channelHistory = this.participationHistory.get(channelName);
            if (channelHistory?.get(command)?.has(botName)) {
                channelHistory.get(command).delete(botName);
            }
            
            throw {
                error,
                data: { bot, channel, command, name: botName, isListener }
            };
        }
    }

    checkWinner(channel, message) {
        const channelName = channel.replace('#', '');
        const participatedBots = this.getParticipatedBots(channelName, message);
        
        const winner = participatedBots.find(botName => 
            message.toLowerCase().includes(botName.toLowerCase())
        );

        if (winner) {
            logger.info(`Bot ${winner} ganhou em ${channelName}!`);
            if (global.pluginManager) {
                global.pluginManager.emit('onGiveawayWin', {
                    channel: channelName,
                    winner,
                    message
                });
            }
        }
    }

    cleanup() {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);

        // Limpa detecç��es antigas (após 5 minutos)
        for (const [key, timestamp] of this.commandDetections) {
            if (timestamp < fiveMinutesAgo) {
                this.commandDetections.delete(key);
            }
        }

        for (const [channel, commandMap] of this.participationHistory) {
            for (const [command, participants] of commandMap) {
                if (participants.size === 0) {
                    commandMap.delete(command);
                }
            }
            if (commandMap.size === 0) {
                this.participationHistory.delete(channel);
            }
        }

        for (const [channel, data] of this.activeChannels) {
            if (now - data.timestamp > this.config.cleanupInterval) {
                this.activeChannels.delete(channel);
            }
        }
    }
}

module.exports = new BotManager(); 