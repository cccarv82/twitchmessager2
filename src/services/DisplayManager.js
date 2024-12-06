const chalk = require('chalk');
const boxen = require('boxen');
const { logger } = require('../logger');
const BotManager = require('./BotManager');

class DisplayManager {
    constructor() {
        this.lastCommand = null;
        this.lastCommandTime = null;
        this.headerShown = false;
        this.detectionHistory = new Map(); // Novo: histórico de detecções
        this.detectionCooldown = 5 * 60 * 1000; // 5 minutos em ms
        this.activeParticipations = new Map();
        this.participationHistory = new Map();
        this.lastCleanup = Date.now();
    }

    showHeader() {
        if (!this.headerShown) {
            const title = [
                '╔════════════════════════════════════════════════════════╗',
                '║                   TWITCH GIVEAWAY                      ║',
                '║                      MONITOR                           ║',
                '╚════════════════════════════════════════════════════════╝'
            ].map(line => chalk.cyan(line)).join('\n');

            const subtitle = [
                '',
                `${chalk.gray('Developed by')} ${chalk.yellow('Carlos Carvalho')}`,
                `${chalk.gray('Version')} ${chalk.yellow('1.1.9')}`,
                ''
            ].join('\n');

            console.log('\n' + title + subtitle + '\n');
            this.headerShown = true;
        }
    }

    showStatus(data) {
        const {
            startTime,
            pluginsCount,
            channelsCount,
            nextUpdate,
            gameName
        } = data;

        const status = [
            '',
            chalk.yellow('✨ Monitor Status ✨'),
            chalk.green('✓') + chalk.bold(' Status: ') + chalk.green.bold('ACTIVE'),
            chalk.cyan('🎮') + chalk.bold(' Game: ') + chalk.yellow.bold(gameName),
            chalk.cyan('🕒') + chalk.bold(' Started: ') + chalk.yellow(startTime.toLocaleTimeString()),
            chalk.cyan('📺') + chalk.bold(' Channels: ') + chalk.yellow.bold(channelsCount),
            chalk.cyan('🔌') + chalk.bold(' Plugins: ') + chalk.yellow.bold(pluginsCount),
            chalk.cyan('⏰') + chalk.bold(' Next Update: ') + chalk.yellow(nextUpdate.toLocaleTimeString()),
            chalk.gray('Press Ctrl+C to exit'),
            '',
            chalk.yellow('════════════════ SORTEIOS MONITORADOS ════════════════'),
            ''
        ].join('\n');

        console.log(status);
    }

    // Função para normalizar mensagens (remove caracteres invisíveis e espaços extras)
    normalizeMessage(message) {
        return message
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '') // Remove caracteres invisíveis
            .replace(/[^\x20-\x7E]/g, '') // Remove todos os caracteres não imprimíveis
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim()
            .toLowerCase();
    }

    logPatternDetection(data) {
        const { channel, message, count, uniqueUsers, timeWindow, type, isKnownCommand } = data;
        const now = new Date();
        const timestamp = now.toLocaleTimeString();

        // Normaliza a mensagem antes de criar a chave
        const normalizedMessage = this.normalizeMessage(message);
        const patternKey = `${channel}:${normalizedMessage}`;
        
        // Verifica se já mostrou recentemente
        const lastDetection = this.detectionHistory.get(patternKey);
        if (lastDetection && (now - lastDetection) < this.detectionCooldown) {
            return;
        }
        
        // Registra/atualiza o timestamp da detecção
        this.detectionHistory.set(patternKey, now.getTime());

        const icon = type === 'participation' ? '🎯' : '🔍';
        const messageLines = this.wrapText(message, 70);
        const channelUrl = `\u001b]8;;https://twitch.tv/${channel}\u0007${chalk.cyan.bold(channel)}\u001b]8;;\u0007`;

        // Obtém configurações do BotManager
        const config = BotManager.getCommandConfig(isKnownCommand);
        const requiredUsers = config.minUsers;
        const requiredMessages = isKnownCommand ? config.minUsers : config.minMessages;

        // Monta a mensagem de status
        const statusMessage = [
            '\n' + chalk.gray('─'.repeat(80)),
            `${icon} ${channelUrl} ${chalk.gray(`at ${timestamp}`)}`,
            `${chalk.yellow.bold(type === 'participation' ? 'Command' : 'Pattern')}: ${chalk.green(messageLines[0])}`,
            ...messageLines.slice(1).map(line => 
                `${' '.repeat(type === 'participation' ? 9 : 8)}${chalk.green(line)}`
            ),
            chalk.gray(
                `${uniqueUsers}/${requiredUsers} usuários diferentes enviaram ` +
                `${count}/${requiredMessages} mensagens em ${timeWindow}s`
            ),
            isKnownCommand ? 
                chalk.cyan('✓ Comando conhecido') : 
                chalk.yellow(`ℹ Padrão detectado (requer ${requiredUsers} usuários e ${requiredMessages} mensagens)`)
        ].join('\n');

        console.log(statusMessage);
    }

    logParticipation(data) {
        const { channel, bot, command } = data;
        const channelName = channel.replace('#', '');
        const timestamp = new Date().toLocaleTimeString();

        const channelUrl = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan.bold(channelName)}\u001b]8;;\u0007`;

        console.log('\n' + chalk.gray('─'.repeat(80)));
        console.log(`🎮 ${channelUrl} ${chalk.gray(`at ${timestamp}`)}`);
        console.log(`${chalk.yellow.bold(bot)} participated with: ${chalk.green.bold(command)}`);
    }

    logBotAction(data) {
        const { bot, action, channels } = data;
        console.log('\n' + chalk.gray('─'.repeat(80)));
        console.log(`✨ ${chalk.yellow.bold(bot)} ${chalk.green.bold(action)} to ${chalk.cyan.bold(channels)} channels`);
    }

    // Método auxiliar para quebrar texto em linhas
    wrapText(text, maxLength) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    // Sobrescreve console.warn para suprimir warnings indesejados
    setupConsole() {
        const originalLog = console.log;
        
        global.console.log = (...args) => {
            const message = args.join(' ');
            
            // Filtra mensagens do curl e outros outputs indesejados
            if (message.includes('% Total') || 
                message.includes('Dload') || 
                message.includes('Speed') ||
                message.includes('Erro no listener:') ||
                message.includes('error: No response from Twitch.')) {
                return;
            }

            // Se a mensagem contiver certos padrões, envia para log
            if ((message.includes('error:') || 
                 message.includes('warn:') || 
                 message.includes('info:') ||
                 message.includes('saiu do canal') ||
                 message.includes('Erro ao')) && 
                !message.includes('✓') && // Não filtra mensagens de sucesso
                !message.includes('🤖') && // Não filtra início de participação
                !message.includes('✅')) { // Não filtra fim de participação
                logger.info(message);
                return;
            }

            // Caso contrário, mostra no console
            originalLog.apply(console, args);
        };

        // Mantém os outros redirecionamentos
        global.console.info = (...args) => {
            logger.info(args.join(' '));
        };

        global.console.warn = (...args) => {
            logger.warn(args.join(' '));
        };

        global.console.error = (...args) => {
            logger.error(args.join(' '));
        };
    }

    clearScreen() {
        process.stdout.write('\x1Bc');
        this.headerShown = false; // Reset o estado do header
    }

    // Adiciona método para limpar histórico antigo
    cleanupDetectionHistory() {
        const now = Date.now();
        for (const [key, timestamp] of this.detectionHistory) {
            if (now - timestamp > this.detectionCooldown) {
                this.detectionHistory.delete(key);
            }
        }
    }

    static logParticipation(data) {
        const timestamp = new Date().toLocaleTimeString();
        
        switch(data.type) {
            case 'start':
                console.log(`
────────────────────────────────────────────────────────────────────────────────
🤖 Participando em ${chalk.cyan(data.channel)}
Comando: ${chalk.green(data.command)}
Total de bots: ${chalk.yellow(data.totalBots)}
                `);
                break;

            case 'success':
                console.log(`✓ ${chalk.green(data.bot)} participou em ${chalk.cyan(data.channel)}`);
                break;

            case 'error':
                console.log(`❌ ${chalk.red(data.bot)} falhou em ${chalk.cyan(data.channel)}: ${data.error}`);
                break;

            case 'complete':
                console.log(`
✅ Participação concluída em ${chalk.cyan(data.channel)}
────────────────────────────────────────────────────────────────────────────────
                `);
                break;
        }
    }

    showParticipationStatus() {
        const now = Date.now();
        
        // Cleanup old participations every 5 minutes
        if (now - this.lastCleanup > 300000) {
            this.cleanupParticipations();
            this.lastCleanup = now;
        }

        // Força limpeza da tela antes de mostrar o status
        console.log('\n');
        
        if (this.activeParticipations.size > 0) {
            console.log(chalk.cyan('═══════════════ PARTICIPAÇÕES ATIVAS ═══════════════'));
            
            for (const [key, participation] of this.activeParticipations) {
                const [channel, command] = key.split(':');
                const progress = `${participation.completed}/${participation.total}`;
                const timeElapsed = Math.floor((now - participation.startTime) / 1000);
                
                // Monta a mensagem de status
                const statusLines = [
                    '',
                    `${chalk.cyan('Canal:')} ${chalk.yellow(channel)}`,
                    `${chalk.cyan('Comando:')} ${chalk.green(command)}`,
                    `${chalk.cyan('Progresso:')} ${chalk.blue(progress)} bots`,
                    `${chalk.cyan('Tempo:')} ${chalk.gray(`${timeElapsed}s`)}`,
                    `${chalk.cyan('Status:')} ${this.getStatusIcon(participation.status)} ${participation.status}`,
                ];

                // Se houver erros, adiciona à mensagem
                if (participation.errors.length > 0) {
                    statusLines.push(chalk.red('Erros:'));
                    participation.errors.forEach(({ bot, error }) => {
                        statusLines.push(chalk.red(`  • ${bot}: ${error}`));
                    });
                }

                console.log(statusLines.join('\n'));
                console.log(chalk.gray('─'.repeat(60)));
            }
        }
    }

    getStatusIcon(status) {
        switch(status) {
            case 'in_progress': return '🔄';
            case 'completed': return '✅';
            case 'error': return '❌';
            default: return '⏳';
        }
    }

    // Modifica o método trackParticipation para ser mais robusto
    trackParticipation(data) {
        try {
            const { channel, command, type, bot, error, totalBots } = data;
            const key = `${channel}:${command}`;

            logger.debug(`[DisplayManager] Tracking participation: ${JSON.stringify(data)}`);

            if (!this.activeParticipations) {
                this.activeParticipations = new Map();
            }

            switch(type) {
                case 'start':
                    logger.debug(`[DisplayManager] Starting participation in ${channel} with ${totalBots} bots`);
                    this.activeParticipations.set(key, {
                        startTime: Date.now(),
                        total: totalBots,
                        completed: 0,
                        status: 'in_progress',
                        errors: []
                    });
                    break;

                case 'success':
                    logger.debug(`[DisplayManager] Bot ${bot} succeeded in ${channel}`);
                    if (this.activeParticipations.has(key)) {
                        const participation = this.activeParticipations.get(key);
                        participation.completed++;
                        
                        if (participation.completed >= participation.total) {
                            participation.status = 'completed';
                            setTimeout(() => {
                                if (this.activeParticipations.has(key)) {
                                    const finalData = this.activeParticipations.get(key);
                                    this.participationHistory.set(key, {
                                        ...finalData,
                                        endTime: Date.now()
                                    });
                                    this.activeParticipations.delete(key);
                                }
                            }, 30000);
                        }
                    }
                    break;

                case 'error':
                    logger.debug(`[DisplayManager] Bot ${bot} failed in ${channel}: ${error}`);
                    if (this.activeParticipations.has(key)) {
                        const participation = this.activeParticipations.get(key);
                        participation.errors.push({ bot, error });
                        participation.status = participation.errors.length >= participation.total ? 'error' : 'in_progress';
                    }
                    break;
            }

            // Força atualização do display
            this.showParticipationStatus();
        } catch (error) {
            logger.error(`[DisplayManager] Error tracking participation: ${error.message}`);
        }
    }

    cleanupParticipations() {
        const now = Date.now();
        for (const [key, participation] of this.activeParticipations) {
            // Remove participations older than 10 minutes
            if (now - participation.startTime > 600000) {
                this.activeParticipations.delete(key);
            }
        }
        
        // Keep only last 100 historical participations
        if (this.participationHistory.size > 100) {
            const entries = Array.from(this.participationHistory.entries());
            const sortedEntries = entries.sort((a, b) => b[1].endTime - a[1].endTime);
            this.participationHistory = new Map(sortedEntries.slice(0, 100));
        }
    }
}

// Adiciona limpeza periódica do histórico
setInterval(() => {
    DisplayManager.cleanupDetectionHistory();
}, 60000); // Limpa a cada minuto

module.exports = new DisplayManager(); 