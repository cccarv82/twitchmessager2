// JavaScript - client.js
const io = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Conectado ao servidor");
});

socket.on("message", (data) => {
  console.log(data);
});

socket.on("disconnect", () => {
  console.log("Desconectado do servidor");
});
