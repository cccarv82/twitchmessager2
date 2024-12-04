const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginsDir = path.join(__dirname, '../../plugins');
        this.hooks = new Map();
        this.debugMode = false;
        this.loadOrder = [
            'Discord Notifier',  // Carrega primeiro por ser provider principal
            'Smart Keywords',    // Segundo por ser provider de análise
            'Blacklist',        // Depende do Smart Keywords
            'Auto Responder'    // Depende de ambos providers
        ];
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    // Sistema de Hooks
    registerHook(hookName, pluginName, callback) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, new Map());
        }
        this.hooks.get(hookName).set(pluginName, callback);
        if (this.debugMode) {
            console.log(chalk.gray(`Hook '${hookName}' registrado por ${pluginName}`));
        }
    }

    async executeHook(hookName, ...args) {
        if (!this.hooks.has(hookName)) return [];
        
        const results = [];
        for (const [pluginName, callback] of this.hooks.get(hookName)) {
            try {
                const result = await callback(...args);
                if (result) results.push({ pluginName, result });
            } catch (error) {
                console.error(chalk.red(`Erro ao executar hook ${hookName} do plugin ${pluginName}:`, error));
            }
        }
        return results;
    }

    // Carregamento de Plugins
    async loadPlugins(silent = false) {
        try {
            if (!silent) {
                console.log(chalk.cyan('Carregando plugins...'));
            }

            try {
                await fs.access(this.pluginsDir);
                if (!silent) {
                    console.log('Diretório de plugins:', this.pluginsDir);
                }
            } catch {
                await fs.mkdir(this.pluginsDir);
                console.log(chalk.yellow('Diretório de plugins criado'));
                return;
            }

            const pluginDirs = await fs.readdir(this.pluginsDir);
            if (!silent) {
                console.log('Plugins encontrados:', pluginDirs);
            }

            // Carrega plugins na ordem definida
            for (const pluginName of this.loadOrder) {
                const pluginDir = pluginDirs.find(dir => {
                    try {
                        const configPath = path.join(this.pluginsDir, dir, 'config.json');
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        const Plugin = require(path.join(this.pluginsDir, dir, 'index.js'));
                        const plugin = new Plugin(this);
                        return plugin.name === pluginName;
                    } catch {
                        return false;
                    }
                });

                if (pluginDir) {
                    await this.loadPlugin(pluginDir, silent);
                }
            }

            // Carrega plugins que não estão na ordem definida
            for (const dir of pluginDirs) {
                if (!this.plugins.has(dir)) {
                    await this.loadPlugin(dir, silent);
                }
            }

            await this.checkDependencies(silent);

            // Lista plugins carregados com suas features
            if (!silent) {
                for (const [name, plugin] of this.plugins) {
                    const status = plugin.config?.enabled ? chalk.green('✓') : chalk.red('✗');
                    console.log(`${status} ${chalk.cyan(name)} v${plugin.version}`);
                    console.log(chalk.gray(`   ${plugin.description}`));
                    
                    if (plugin.config?.features) {
                        console.log(chalk.gray('   Features:'));
                        for (const [feature, config] of Object.entries(plugin.config.features)) {
                            const featureStatus = config.enabled ? chalk.green('✓') : chalk.red('✗');
                            console.log(`   ${featureStatus} ${feature}`);
                        }
                    }
                    console.log(); // Linha em branco entre plugins
                }
            }
        } catch (error) {
            if (!silent) {
                console.error(chalk.red('Erro ao carregar plugins:', error));
            }
        }
    }

    async checkDependencies(silent = false) {
        for (const [name, plugin] of this.plugins) {
            if (plugin.config.providers) {
                for (const [providerName, requirements] of Object.entries(plugin.config.providers)) {
                    const provider = this.plugins.get(providerName);
                    if (!provider) {
                        if (requirements.required) {
                            throw new Error(`Plugin ${name} requer ${providerName} que não está instalado`);
                        }
                        if (!silent) {
                            console.warn(chalk.yellow(`Aviso: Plugin ${name} funcionalidade reduzida - ${providerName} não encontrado`));
                        }
                    }
                }
            }
        }
    }

    async loadPlugin(pluginDir, silent = false) {
        try {
            const pluginPath = path.join(this.pluginsDir, pluginDir);
            const configPath = path.join(pluginPath, 'config.json');
            
            let plugin;
            const Plugin = require(path.join(pluginPath, 'index.js'));
            plugin = new Plugin(this);

            // Verifica se já existe um plugin com este nome
            if (this.plugins.has(plugin.name)) {
                if (!silent) {
                    console.warn(chalk.yellow(`Plugin ${plugin.name} já está carregado. Ignorando...`));
                }
                return;
            }

            try {
                const config = await fs.readFile(configPath, 'utf8');
                plugin.config = JSON.parse(config);
            } catch (error) {
                plugin.config = {};
            }

            plugin.silent = true;
            await plugin.onLoad();
            if (plugin.config.enabled !== false) {
                await plugin.onEnable();
            }
            plugin.silent = false;

            this.plugins.set(plugin.name, plugin);
        } catch (error) {
            if (!silent) {
                console.error(`Erro ao carregar plugin ${pluginDir}:`, error);
            }
        }
    }

    // Método para emitir eventos para todos os plugins ativos
    async emit(event, ...args) {
        if (this.debugMode) {
            console.log(chalk.gray(`Emitindo evento ${event} para ${this.plugins.size} plugins`));
        }

        for (const [name, plugin] of this.plugins) {
            if (plugin.enabled && typeof plugin[event] === 'function') {
                try {
                    await plugin[event](...args);
                } catch (error) {
                    console.error(chalk.red(`Erro no plugin ${name} durante ${event}:`, error));
                }
            }
        }
    }
}

module.exports = PluginManager; 