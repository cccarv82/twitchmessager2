const winston = require('winston');
const path = require('path');

// Configuração dos formatos
const formats = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} ${level}: ${message}`;
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
        // Todos os logs vão para combined.log
        new winston.transports.File({ 
            filename: path.join('log', 'combined.log')
        })
    ]
});

// Em desenvolvimento, também logamos no console
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Middleware para Express
const logMiddleware = (req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
};

module.exports = { 
    logger,
    logMiddleware
}; 