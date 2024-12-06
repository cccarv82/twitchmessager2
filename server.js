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
  try {
    const gameName = req.params.gameName;
    const result = await grabber.main(gameName);
    res.json(result);
  } catch (error) {
    logger.error("Erro ao executar grabber:", error);
    res.status(500).json({ error: error.message });
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
