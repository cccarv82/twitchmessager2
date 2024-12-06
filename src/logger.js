const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Configuração dos formatos
const formats = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Garante que o diretório de logs existe
const logDir = path.join(process.cwd(), 'log');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Adiciona timestamp aos logs
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Criação do logger
const logger = winston.createLogger({
    level: 'info',
    format: formats,
    transports: [
        // Logs de erro vão para error.log
        new winston.transports.File({ 
            filename: path.join('log', 'error.log'), 
            level: 'error'
        }),
        // Logs de info vão para info.log
        new winston.transports.File({ 
            filename: path.join('log', 'info.log'), 
            level: 'info'
        }),
        // Logs de warning vão para warn.log
        new winston.transports.File({ 
            filename: path.join('log', 'warn.log'), 
            level: 'warn'
        }),
        // Todos os logs vão para combined.log
        new winston.transports.File({ 
            filename: path.join('log', 'combined.log')
        })
    ],
    // Não exibe logs no console
    silent: process.env.NODE_ENV !== 'development'
});

// Middleware para Express
const logMiddleware = (req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
};

// Sobrescreve os métodos console padrão
console.log = (...args) => {
    // Mantém apenas logs normais no console
    process.stdout.write(args.join(' ') + '\n');
};

console.info = (...args) => {
    logger.info(args.join(' '));
};

console.warn = (...args) => {
    logger.warn(args.join(' '));
};

console.error = (...args) => {
    logger.error(args.join(' '));
};

module.exports = { 
    logger,
    logMiddleware
}; 