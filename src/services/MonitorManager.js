const { logger } = require('../logger');
const ConfigManager = require('./ConfigManager');
const grabber = require('../../grabber');

class MonitorManager {
    constructor() {
        this.updateInterval = 30 * 60 * 1000; // 30 minutos
        this.updateTimer = null;
        this.isMonitoring = false;
    }

    async startMonitoring() {
        try {
            if (this.isMonitoring) {
                logger.warn('Monitoramento já está ativo');
                return;
            }

            // Carrega jogo configurado
            const gameName = await ConfigManager.getGame();
            if (!gameName) {
                throw new Error('Nenhum jogo configurado para monitoramento');
            }

            logger.info(`Iniciando monitoramento para ${gameName}`);

            // Faz scan inicial
            await this.updateChannels();

            // Configura atualização periódica
            this.updateTimer = setInterval(() => {
                this.updateChannels().catch(error => {
                    logger.error('Erro na atualização automática:', error);
                });
            }, this.updateInterval);

            this.isMonitoring = true;
            
            const nextUpdate = new Date(Date.now() + this.updateInterval);
            logger.info(`Próxima atualização em ${nextUpdate.toLocaleTimeString()}`);

            // Notifica plugins sobre início do monitoramento
            const pluginManager = global.pluginManager;
            if (pluginManager) {
                await pluginManager.emit('onMonitoringStart', { 
                    gameName,
                    updateInterval: this.updateInterval,
                    nextUpdate
                });
            }

        } catch (error) {
            logger.error('Erro ao iniciar monitoramento:', error);
            this.stopMonitoring();
            throw error;
        }
    }

    async updateChannels() {
        try {
            const gameName = await ConfigManager.getGame();
            logger.info(`Atualizando canais para ${gameName}`);

            const result = await grabber.main(gameName);
            
            logger.info(`Canais atualizados: ${result.canaisSelecionados} de ${result.totalCanais}`);
            
            // Notifica plugins sobre atualização
            const pluginManager = global.pluginManager;
            if (pluginManager) {
                await pluginManager.emit('onChannelsUpdate', result);
            }

            // Se temos Discord Notifier, envia atualização
            const discordPlugin = pluginManager?.plugins.get('Discord Notifier');
            if (discordPlugin) {
                await discordPlugin.sendChannelUpdateNotification(result);
            }

            return result;
        } catch (error) {
            logger.error('Erro ao atualizar canais:', error);
            throw error;
        }
    }

    stopMonitoring() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            this.isMonitoring = false;
            logger.info('Monitoramento interrompido');

            // Notifica plugins sobre parada
            const pluginManager = global.pluginManager;
            if (pluginManager) {
                pluginManager.emit('onMonitoringStop').catch(error => {
                    logger.error('Erro ao notificar parada:', error);
                });
            }
        }
    }

    isActive() {
        return this.isMonitoring;
    }
}

module.exports = new MonitorManager(); 