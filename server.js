// JavaScript - server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const grabber = require("./grabber");
const { logger } = require("./src/logger");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 3000;

let listenerProcess = null;

app.get("/start-grabber/:gameName", async (req, res) => {
    try {
        logger.info(`Iniciando grabber para ${req.params.gameName}`);
        const result = await grabber.main(req.params.gameName);
        logger.info('Grabber concluído com sucesso');
        res.json(result);
    } catch (error) {
        logger.error("Erro ao executar grabber:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/start-listener", (req, res) => {
    try {
        if (listenerProcess) {
            logger.warn('Listener já está em execução');
            return res.status(400).json({ message: 'Listener já está em execução' });
        }

        logger.info('Iniciando processo do listener...');
        
        listenerProcess = spawn("node", ["listener.js"], {
            stdio: ['inherit', 'pipe', 'pipe']
        });

        // Captura saída padrão
        listenerProcess.stdout.on("data", (data) => {
            const output = data.toString();
            logger.info(`Listener stdout: ${output}`);
            io.emit("message", output);
        });

        // Captura erros
        listenerProcess.stderr.on("data", (data) => {
            const error = data.toString();
            logger.error(`Listener stderr: ${error}`);
            io.emit("error", error);
        });

        // Monitora fechamento
        listenerProcess.on("close", (code) => {
            logger.info(`Listener process exited with code ${code}`);
            listenerProcess = null;
        });

        // Monitora erros
        listenerProcess.on("error", (error) => {
            logger.error(`Listener process error: ${error.message}`);
            listenerProcess = null;
        });

        res.json({ message: 'Listener iniciado com sucesso' });

    } catch (error) {
        logger.error('Erro ao iniciar listener:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para verificar status
app.get("/status", (req, res) => {
    res.json({
        listenerActive: !!listenerProcess,
        serverStatus: 'running'
    });
});

// Gerencia conexões WebSocket
io.on("connection", (socket) => {
    logger.info("Nova conexão WebSocket estabelecida");

    socket.on("disconnect", () => {
        logger.info("Cliente WebSocket desconectado");
    });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise não tratada rejeitada:', reason);
});

// Encerramento gracioso
process.on('SIGINT', async () => {
    logger.info('Iniciando encerramento gracioso...');
    
    if (listenerProcess) {
        logger.info('Encerrando processo do listener...');
        listenerProcess.kill();
    }

    server.close(() => {
        logger.info('Servidor encerrado');
        process.exit(0);
    });
});

server.listen(port, () => {
    logger.info(`Servidor iniciado na porta ${port}`);
});
