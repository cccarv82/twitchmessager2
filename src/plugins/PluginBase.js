const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class PluginBase extends EventEmitter {
    constructor(manager) {
        super();
        this.name = this.constructor.name;
        this.description = '';
        this.version = '1.0.0';
        this.enabled = true;
        this.config = {};
        this.silent = false;
        this.manager = manager;
    }

    async init() {
        await this.loadPackageInfo();
    }

    async loadPackageInfo() {
        try {
            const pluginDir = this.name.toLowerCase().replace(/\s+/g, '-');
            const packagePath = path.join(this.manager.pluginsDir, pluginDir, 'package.json');
            
            const packageData = await fs.readFile(packagePath, 'utf8');
            this.constructor.package = JSON.parse(packageData);
            
            // Atualiza versão do package.json
            if (this.constructor.package.version) {
                this.version = this.constructor.package.version;
            }
        } catch (error) {
            console.error('Erro ao carregar package.json:', error);
        }
    }

    registerHook(hookName, callback) {
        this.manager.registerHook(hookName, this.name, callback);
    }

    async useHook(hookName, ...args) {
        return this.manager.executeHook(hookName, ...args);
    }

    // Métodos do ciclo de vida
    async onLoad() {}
    async onUnload() {}
    async onEnable() { this.enabled = true; }
    async onDisable() { this.enabled = false; }

    // Eventos principais
    async onGiveawayDetected(channel, message, pattern) {}
    async onWin(channel, prize) {}
    async onWhisperReceived(from, message) {}
    async onChannelJoin(channel) {}
    async onChannelPart(channel) {}
    async onError(error) {}
}

module.exports = PluginBase; 