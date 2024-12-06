const fs = require('fs').promises;
const ini = require('ini');
const { logger } = require('../logger');

class ConfigManager {
    constructor() {
        this.configPath = './config.ini';
        this.config = null;
    }

    async load() {
        try {
            const configFile = await fs.readFile(this.configPath, 'utf-8');
            this.config = ini.parse(configFile);
            return this.config;
        } catch (error) {
            logger.error('Erro ao carregar configurações:', error);
            throw error;
        }
    }

    async save() {
        try {
            const configString = ini.stringify(this.config);
            await fs.writeFile(this.configPath, configString);
            logger.info('Configurações salvas com sucesso');
        } catch (error) {
            logger.error('Erro ao salvar configurações:', error);
            throw error;
        }
    }

    async setGame(gameName) {
        try {
            await this.load();
            this.config.GAME = this.config.GAME || {};
            this.config.GAME.NAME = gameName;
            await this.save();
            logger.info(`Jogo configurado: ${gameName}`);
            
            // Notifica plugins sobre mudança de jogo
            const pluginManager = global.pluginManager;
            if (pluginManager) {
                await pluginManager.emit('onGameChange', { gameName });
            }
        } catch (error) {
            logger.error('Erro ao configurar jogo:', error);
            throw error;
        }
    }

    async getGame() {
        await this.load();
        return this.config.GAME?.NAME || '';
    }
}

module.exports = new ConfigManager(); 