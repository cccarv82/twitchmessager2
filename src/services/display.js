const chalk = require('chalk');

// Função para exibir mensagens de participação
function logParticipation(data) {
    switch(data.type) {
        case 'start':
            console.log(chalk.cyan(`
────────────────────────────────────────────────────────────────────────────────
🤖 Participando em ${chalk.yellow(data.channel)}
Comando: ${chalk.green(data.command)}
Total de bots: ${chalk.yellow(data.totalBots)}
            `));
            break;

        case 'success':
            console.log(chalk.green(`✓ ${data.bot} participou em ${data.channel}`));
            break;

        case 'error':
            console.log(chalk.red(`❌ ${data.bot} falhou em ${data.channel}: ${data.error}`));
            break;

        case 'complete':
            console.log(chalk.cyan(`
✅ Participação concluída em ${chalk.yellow(data.channel)}
────────────────────────────────────────────────────────────────────────────────
            `));
            break;
    }
}

// Exporta funções individuais
module.exports = {
    logParticipation
}; 