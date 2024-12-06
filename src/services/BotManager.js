const tmi = require('tmi.js');
const { logger } = require('../logger');
const fs = require('fs').promises;
const path = require('path');
const ini = require('ini');
const chalk = require('chalk');
const DisplayManager = require('./DisplayManager');

class BotManager {
    constructor() {
        this.listeners = new Map();
        this.participants = new Map();
        this.participationHistory = new Map();
        this.recentGiveaways = new Map();
        this.commandDetections = new Map(); // Para controlar detecções de comandos
        this.recentParticipations = new Map();
        
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

        this.participationConfig = {
            cooldown: 10 * 60 * 1000, // 10 minutos
            exitDelay: 5000 // 5 segundos
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
            const configData = await fs.readFile('./config.ini', 'utf8');
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

            logger.info('Configurações do BotManager carregadas com sucesso');
        } catch (error) {
            logger.error('Erro ao carregar configurações do BotManager:', error);
            throw error;
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
            await this.debugLog(`Conectando bot ${conta.nome}...`);
            
            const bot = new tmi.Client({
                options: { 
                    debug: false,
                    skipMembership: true,
                    skipUpdatingEmotesets: true
                },
                connection: {
                    secure: true,
                    reconnect: true,
                    timeout: 10000
                },
                identity: {
                    username: conta.nome,
                    password: conta.token.startsWith('oauth:') ? conta.token : `oauth:${conta.token}`
                },
                // Listeners sempre em todos os canais, outros bots só no próprio canal
                channels: conta.isListener ? canais.map(c => `#${c}`) : [`#${conta.nome}`]
            });

            await bot.connect();
            await this.debugLog(`Bot ${conta.nome} conectado com sucesso`);

            // Registra o bot na coleção apropriada
            if (conta.isListener) {
                this.listeners.set(conta.nome, { bot, conta });
                await this.debugLog(`${conta.nome} registrado como listener`);
            } else {
                this.participants.set(conta.nome, { bot, conta });
                await this.debugLog(`${conta.nome} registrado como participante`);
            }

            // Log do estado atual
            await this.debugLog(`Estado atual:
Listeners: ${Array.from(this.listeners.keys()).join(', ')}
Participants: ${Array.from(this.participants.keys()).join(', ')}
            `);

            return bot;
        } catch (error) {
            await this.debugLog(`❌ ERRO ao conectar bot ${conta.nome}: ${error.message}`);
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

    hasRecentParticipation(channel, command) {
        const key = `${channel}:${command}`;
        const lastParticipation = this.recentParticipations.get(key);
        
        if (!lastParticipation) return false;
        
        return (Date.now() - lastParticipation) < this.participationConfig.cooldown;
    }

    registerParticipation(channel, command) {
        const key = `${channel}:${command}`;
        this.recentParticipations.set(key, Date.now());
    }

    isValidCommand(command) {
        // Remove espaços extras e normaliza
        const normalizedCommand = command.trim().toLowerCase();
        
        // Verifica se é uma única palavra
        if (normalizedCommand.includes(' ')) {
            return false;
        }

        // Permite comandos com ou sem ! no início
        // E permite apenas letras, números e alguns caracteres especiais
        const validPattern = /^!?[\w\d\-_]+$/;
        return validPattern.test(normalizedCommand);
    }

    async participateInGiveaway(channel, command, detectedBy) {
        const channelName = channel.replace('#', '');
        const normalizedCommand = command.toLowerCase().trim();
        
        // Adiciona validação do comando
        if (!this.isValidCommand(normalizedCommand)) {
            await this.debugLog(`❌ Comando inválido ignorado: ${normalizedCommand}`);
            return;
        }

        await this.debugLog(`\n=== NOVO SORTEIO DETECTADO ===`);
        await this.debugLog(`Canal: ${channelName}`);
        await this.debugLog(`Comando: ${normalizedCommand}`);
        await this.debugLog(`Detectado por: ${detectedBy}`);

        // Verifica se temos bots disponíveis
        const listeners = Array.from(this.listeners.values());
        const participants = Array.from(this.participants.values());
        
        await this.debugLog(`Listeners disponíveis: ${listeners.length}`);
        await this.debugLog(`Participantes disponíveis: ${participants.length}`);

        if (listeners.length === 0 && participants.length === 0) {
            await this.debugLog(`❌ Nenhum bot disponível para participar`);
            return;
        }

        // Verifica participação recente
        const key = `${channelName}:${normalizedCommand}`;
        if (this.recentParticipations.has(key)) {
            await this.debugLog(`Participação recente encontrada para ${key}, ignorando...`);
            return;
        }

        // Registra participação
        this.recentParticipations.set(key, Date.now());
        await this.debugLog(`Participação registrada para ${key}`);

        const totalBots = listeners.length + participants.length;
        
        try {
            // Registra início da participação
            await this.logParticipation({
                channel: channelName,
                command: normalizedCommand,
                type: 'start',
                totalBots
            });

            // Participa com cada bot
            const allBots = [...listeners, ...participants];
            for (const { bot, conta } of allBots) {
                try {
                    if (!conta.isListener) {
                        await this.debugLog(`Entrando no canal ${channelName} com ${conta.nome}`);
                        await bot.join(`#${channelName}`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    await this.debugLog(`Enviando comando com ${conta.nome}`);
                    await bot.say(`#${channelName}`, normalizedCommand);
                    await this.debugLog(`✓ ${conta.nome} participou com sucesso`);

                    // Registra sucesso da participação
                    await this.logParticipation({
                        channel: channelName,
                        command: normalizedCommand,
                        type: 'success',
                        bot: conta.nome
                    });

                    if (!conta.isListener) {
                        setTimeout(async () => {
                            try {
                                await bot.part(`#${channelName}`);
                                await this.debugLog(`✓ ${conta.nome} saiu do canal`);
                            } catch (error) {
                                await this.debugLog(`❌ Erro ao sair: ${error.message}`);
                            }
                        }, 5000);
                    }
                } catch (error) {
                    await this.debugLog(`❌ Erro com ${conta.nome}: ${error.message}`);
                    
                    // Registra erro da participação
                    await this.logParticipation({
                        channel: channelName,
                        command: normalizedCommand,
                        type: 'error',
                        bot: conta.nome,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error(`Erro ao gerenciar participação: ${error.message}`);
        }

        await this.debugLog(`=== FIM DA PARTICIPAÇÃO ===\n`);
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
        
        // Limpa participações antigas (após 10 minutos)
        for (const [key, timestamp] of this.recentParticipations) {
            if (now - timestamp > 10 * 60 * 1000) {
                this.recentParticipations.delete(key);
            }
        }
    }

    async debugLog(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        
        try {
            // Garante que o diretório existe
            await fs.mkdir('logs', { recursive: true });
            await fs.appendFile('logs/debug.log', logMessage);
        } catch (error) {
            console.error('Erro ao salvar log:', error);
        }
    }

    async logParticipation(data) {
        const { channel, command, type, bot, error } = data;
        
        // Cria timestamp no horário de Brasília (UTC-3)
        const date = new Date();
        const brasiliaTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
        const timestamp = brasiliaTime.toISOString().replace('Z', '-03:00');

        try {
            // Lê o arquivo existente ou cria um novo array
            let participations = [];
            try {
                const content = await fs.readFile('participations.json', 'utf8');
                participations = JSON.parse(content);
            } catch (err) {
                // Arquivo não existe ainda, começará com array vazio
            }

            // Cria o objeto de participação
            const participation = {
                timestamp,
                channel,
                command,
                bot: bot || null,
                success: type === 'success',
                error: error || null
            };

            // Para eventos de início, adiciona informação total de bots
            if (type === 'start') {
                participation.totalBots = data.totalBots;
                participation.type = 'start';
            }

            // Adiciona nova participação ao início do array
            participations.unshift(participation);

            // Mantém apenas as últimas 1000 participações
            if (participations.length > 1000) {
                participations = participations.slice(0, 1000);
            }

            // Salva o arquivo
            await fs.writeFile(
                'participations.json', 
                JSON.stringify(participations, null, 2)
            );

        } catch (error) {
            logger.error('Erro ao salvar participação:', error);
        }
    }
}

module.exports = new BotManager(); 