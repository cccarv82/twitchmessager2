// JavaScript - server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const grabber = require("./grabber");
const { logger, logMiddleware } = require("./logger"); // Importando o logger e o middleware de log
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Criando uma nova instância do Socket.IO
const port = process.env.PORT || 3000;

let isGrabbing = false; // Variável de bloqueio global

app.use(logMiddleware); // Usando o middleware de log

app.get("/start-grabber/:gameName", async (req, res) => {
  let responseSent = false;
  if (isGrabbing) {
    res.status(429).json({
      code: 429,
      message:
        "A ação já está em andamento. Por favor, tente novamente mais tarde.",
    });
    req.logObject.response.message =
      "A ação já está em andamento. Por favor, tente novamente mais tarde.";
    responseSent = true;
  }

  if (!responseSent) {
    try {
      logger.info("Coleta de canais iniciada");
      isGrabbing = true;
      const result = await grabber.main(req.params.gameName);
      logger.info("Coleta de canais concluída com sucesso");
      res.json({
        code: 200,
        message: 'Arquivo "canais.json" atualizado com sucesso!',
        nomeDoJogo: result.nomeDoJogo,
        totalCanais: result.totalCanais,
        canaisSelecionados: result.canais.length,
        canais: result.canais,
      });
      req.logObject.response.message =
        'Arquivo "canais.json" atualizado com sucesso!';
      req.logObject.response.nomeDoJogo = result.nomeDoJogo;
      req.logObject.response.totalCanais = result.totalCanais;
      req.logObject.response.canaisSelecionados = result.canais.length;
      req.logObject.response.canais = result.canais;
    } catch (error) {
      logger.error("Erro ao obter o token de acesso ou o ID do jogo:", error);
      res.status(500).json({
        code: 500,
        message: "Erro ao obter o token de acesso ou o ID do jogo",
        error: error.message,
      });
      req.logObject.response.message =
        "Erro ao obter o token de acesso ou o ID do jogo";
      req.logObject.response.error = error.message;
    } finally {
      isGrabbing = false;
    }
  }
});

app.get("/start-listener", (req, res) => {
  const listener = spawn("node", ["listener.js"]);

  listener.stdout.on("data", (data) => {
    // console.log(`stdout: ${data}`);
    io.emit("message", data.toString());
  });

  listener.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
  });

  listener.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
  });

  res.send("Listener started");
});

// Quando uma nova conexão WebSocket é estabelecida
io.on("connection", (socket) => {
  console.log("New client connected");

  // Quando a conexão WebSocket é fechada
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });

  // Ouvir eventos personalizados e retransmiti-los para o cliente
  process.on("monitoredMessage", (message) => {
    socket.emit("message", message);
  });
});

server.listen(port, () => {
  logger.info(`App listening at http://localhost:${port}`);
});
