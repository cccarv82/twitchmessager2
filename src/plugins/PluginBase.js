const EventEmitter = require('events');

class PluginBase extends EventEmitter {
    constructor(manager) {
        super();
        this.name = 'Plugin Base';
        this.description = 'Base class for plugins';
        this.version = '1.0.0';
        this.enabled = true;
        this.config = {};
        this.silent = false;
        this.manager = manager;
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