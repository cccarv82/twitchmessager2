const chalk = require('chalk');
const boxen = require('boxen');
const { logger } = require('../logger');

class DisplayManager {
    constructor() {
        this.lastCommand = null;
        this.lastCommandTime = null;
        this.headerShown = false;
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

    logPatternDetection(data) {
        const { channel, message, count, uniqueUsers, timeWindow, type } = data;
        const now = new Date();
        const timestamp = now.toLocaleTimeString();

        if (this.lastCommand === message && (now - this.lastCommandTime) < 2000) return;

        this.lastCommand = message;
        this.lastCommandTime = now;

        const icon = type === 'participation' ? '🎯' : '🔍';
        const messageLines = this.wrapText(message, 70);

        const channelUrl = `\u001b]8;;https://twitch.tv/${channel}\u0007${chalk.cyan.bold(channel)}\u001b]8;;\u0007`;

        console.log('\n' + chalk.gray('─'.repeat(80)));
        console.log(`${icon} ${channelUrl} ${chalk.gray(`at ${timestamp}`)}`);
        console.log(`${chalk.yellow.bold(type === 'participation' ? 'Command' : 'Pattern')}: ${chalk.green(messageLines[0])}`);
        messageLines.slice(1).forEach(line => {
            console.log(`${' '.repeat(type === 'participation' ? 9 : 8)}${chalk.green(line)}`);
        });
        console.log(chalk.gray(`${uniqueUsers} usuários diferentes enviaram ${count} mensagens em ${timeWindow}s`));
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
            if (message.includes('error:') || 
                message.includes('warn:') || 
                message.includes('info:') ||
                message.includes('saiu do canal') ||
                message.includes('Erro ao')) {
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
}

module.exports = new DisplayManager(); 