const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

async function verifyPlugins() {
    const pluginsDir = path.join(__dirname, '../plugins');
    const requiredFiles = {
        'discord-notifier': ['index.js', 'config.json'],
        'smart-keywords': ['index.js', 'config.json', 'data/patterns.json'],
        'blacklist': ['index.js', 'config.json', 'data/palavras-bl.json', 'data/canais-bl.json'],
        'auto-responder': ['index.js', 'config.json']
    };

    console.log('Verificando plugins...\n');

    for (const [plugin, files] of Object.entries(requiredFiles)) {
        console.log(chalk.cyan(`Verificando ${plugin}:`));
        const pluginDir = path.join(pluginsDir, plugin);
        
        try {
            await fs.access(pluginDir);
            console.log('✓ Diretório existe');
            
            for (const file of files) {
                const filePath = path.join(pluginDir, file);
                try {
                    await fs.access(filePath);
                    console.log(`✓ ${file} encontrado`);
                } catch {
                    console.log(chalk.red(`✗ ${file} não encontrado`));
                }
            }
        } catch {
            console.log(chalk.red(`✗ Diretório ${plugin} não encontrado`));
        }
        console.log();
    }
}

verifyPlugins(); 