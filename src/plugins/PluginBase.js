const EventEmitter = require('events');

class PluginBase extends EventEmitter {
    constructor() {
        super();
        this.name = '';
        this.version = '1.0.0';
        this.description = '';
        this.enabled = false;
        this.config = {};
    }

    // Métodos do ciclo de vida
    async onLoad() {}
    async onUnload() {}
    async onEnable() {
        this.enabled = true;
    }
    async onDisable() {
        this.enabled = false;
    }

    // Eventos principais
    async onGiveawayDetected(channel, message, pattern) {}
    async onWin(channel, prize) {}
    async onWhisperReceived(from, message) {}
    async onChannelJoin(channel) {}
    async onChannelPart(channel) {}
    async onError(error) {}
}

module.exports = PluginBase; 