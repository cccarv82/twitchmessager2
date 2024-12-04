const PluginBase = require('../../src/plugins/PluginBase');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class BlacklistPlugin extends PluginBase {
    constructor() {
        super();
        this.name = 'Blacklist';
        this.description = 'Sistema de blacklist para palavras e canais';
        this.version = '1.0.0';

        // Caminhos dos arquivos
        this.dataDir = path.join(__dirname, 'data');
        this.wordsFile = path.join(this.dataDir, 'palavras-bl.json');
        this.channelsFile = path.join(this.dataDir, 'canais-bl.json');
        this.logFile = path.join(this.dataDir, 'blacklist.log');

        // Cache das blacklists
        this.blacklistedWords = new Set();
        this.blacklistedChannels = new Set();
    }

    async onLoad() {
        if (!this.silent) {
            console.log(chalk.cyan(`Inicializando ${this.name}...`));
        }

        // Cria diretório de dados se não existir
        await fs.mkdir(this.dataDir, { recursive: true });

        // Carrega as blacklists
        await this.loadBlacklists();

        if (!this.silent) {
            console.log(chalk.green(`✓ ${this.name} inicializado com sucesso`));
            console.log(chalk.gray(`   Palavras bloqueadas: ${this.blacklistedWords.size}`));
            console.log(chalk.gray(`   Canais bloqueados: ${this.blacklistedChannels.size}`));
        }

        // Configura backup automático
        if (this.config.features.wordBlacklist.autoBackup) {
            setInterval(() => this.backupBlacklists(), 
                this.config.features.wordBlacklist.backupInterval);
        }
    }

    async loadBlacklists() {
        try {
            // Carrega palavras
            const wordsData = await fs.readFile(this.wordsFile, 'utf8');
            this.blacklistedWords = new Set(JSON.parse(wordsData));
        } catch {
            // Arquivo não existe, começa com conjunto vazio
            this.blacklistedWords = new Set();
            await this.saveWords();
        }

        try {
            // Carrega canais
            const channelsData = await fs.readFile(this.channelsFile, 'utf8');
            this.blacklistedChannels = new Set(JSON.parse(channelsData));
        } catch {
            // Arquivo não existe, começa com conjunto vazio
            this.blacklistedChannels = new Set();
            await this.saveChannels();
        }
    }

    async saveWords() {
        const data = JSON.stringify([...this.blacklistedWords]);
        await fs.writeFile(this.wordsFile, data);
    }

    async saveChannels() {
        const data = JSON.stringify([...this.blacklistedChannels]);
        await fs.writeFile(this.channelsFile, data);
    }

    async backupBlacklists() {
        const timestamp = Date.now();
        const backupDir = path.join(this.dataDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });

        // Backup palavras
        const wordsBackup = path.join(backupDir, `palavras-bl.${timestamp}.json`);
        await fs.copyFile(this.wordsFile, wordsBackup);

        // Backup canais
        const channelsBackup = path.join(backupDir, `canais-bl.${timestamp}.json`);
        await fs.copyFile(this.channelsFile, channelsBackup);
    }

    async logDetection(type, value, reason = '') {
        if (!this.config.features.reporting.logDetections) return;

        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${type}: ${value}${reason ? ` (${reason})` : ''}\n`;
        
        await fs.appendFile(this.logFile, logMessage);
    }

    // Métodos públicos para gerenciar blacklists
    async addWord(word) {
        if (!this.config.features.wordBlacklist.caseSensitive) {
            word = word.toLowerCase();
        }
        
        this.blacklistedWords.add(word);
        await this.saveWords();
        await this.logDetection('Palavra adicionada', word);
    }

    async removeWord(word) {
        if (!this.config.features.wordBlacklist.caseSensitive) {
            word = word.toLowerCase();
        }
        
        this.blacklistedWords.delete(word);
        await this.saveWords();
        await this.logDetection('Palavra removida', word);
    }

    async addChannel(channel) {
        channel = channel.toLowerCase().replace('#', '');
        this.blacklistedChannels.add(channel);
        await this.saveChannels();
        await this.logDetection('Canal adicionado', channel);
    }

    async removeChannel(channel) {
        channel = channel.toLowerCase().replace('#', '');
        this.blacklistedChannels.delete(channel);
        await this.saveChannels();
        await this.logDetection('Canal removido', channel);
    }

    // Métodos de verificação
    isWordBlacklisted(word) {
        if (!this.config.features.wordBlacklist.enabled) return false;
        
        if (!this.config.features.wordBlacklist.caseSensitive) {
            word = word.toLowerCase();
        }
        
        return this.blacklistedWords.has(word);
    }

    isChannelBlacklisted(channel) {
        if (!this.config.features.channelBlacklist.enabled) return false;
        
        channel = channel.toLowerCase().replace('#', '');
        return this.blacklistedChannels.has(channel);
    }

    // Eventos do sistema
    async onMessage(channel, message) {
        if (!this.config.features.wordBlacklist.enabled) return;

        const words = message.split(/\s+/);
        for (const word of words) {
            if (this.isWordBlacklisted(word)) {
                await this.logDetection('Palavra detectada', word, `em ${channel}`);
                return true; // Indica que a mensagem contém palavra bloqueada
            }
        }
        return false;
    }

    async onChannelJoin(channel) {
        if (!this.config.features.channelBlacklist.enabled) return;

        if (this.isChannelBlacklisted(channel)) {
            await this.logDetection('Tentativa de entrada em canal bloqueado', channel);
            return true; // Indica que o canal está bloqueado
        }
        return false;
    }
}

module.exports = BlacklistPlugin; 