const tmi = require("tmi.js");
const fs = require("fs");
const chalk = require("chalk");
const axios = require("axios");
const { ApiClient } = require("twitch");
const { RefreshableAuthProvider, StaticAuthProvider } = require("twitch-auth");
const ini = require("ini");

function getConfig() {
  const config = ini.parse(fs.readFileSync("./config.ini", "utf-8"));
  return {
    clientId: config.CLIENT.ID,
    clientSecret: config.CLIENT.SECRET,
  };
}

// Defina os canais e a mensagem aqui
const canais = ["cometenno"];
const mensagem = "!ticket";

const mensagensDestacadas = {};

fs.readFile("contas.json", "utf8", async (err, data) => {
  if (err) {
    console.error("Erro ao ler o arquivo 'contas.json':", err);
    return;
  }

  const contas = JSON.parse(data);
  processAccount(contas, 0);
});

async function processAccount(contas, index) {
  if (index >= contas.length) {
    console.log("Todas as contas foram processadas.");
    return;
  }

  const config = getConfig();
  const conta = contas[index];
  const nome = conta.nome;
  const token = conta.token;
  const accessToken = conta.access_token;
  const refreshToken = conta.refresh_token;
  const expiry = conta.expiry ? new Date(conta.expiry) : null;

  const bot = new tmi.Client({
    options: { debug: false },
    connection: {
      secure: true,
      reconnect: true,
    },
    identity: {
      username: nome,
      password: token,
    },
    channels: canais,
  });

  bot
    .connect()
    .then(async () => {
      console.log(`Conectado com a conta ${nome}`);

      const authProvider = new RefreshableAuthProvider(
        new StaticAuthProvider(config.clientId, accessToken),
        {
          clientSecret: config.clientSecret,
          refreshToken,
          expiry,
          onRefresh: async ({ accessToken, refreshToken, expiresIn }) => {
            conta.access_token = accessToken;
            conta.refresh_token = refreshToken;
            conta.expiry = new Date(
              Date.now() + expiresIn * 1000
            ).toISOString();
            fs.writeFileSync("contas.json", JSON.stringify(contas, null, 2));
          },
        }
      );

      setTimeout(() => {
        sendMessageWithBot(bot, canais, mensagem, nome, contas, index);
      }, 1000);
    })
    .catch(console.error);
}

function sendMessageWithBot(bot, canais, mensagem, nome, contas, index) {
  console.log(`Enviando mensagem com a conta ${nome}`);
  canais.forEach((canal) => {
    bot
      .say(canal, mensagem)
      .then(() => {
        console.log(`Mensagem enviada para ${canal} com a conta ${nome}`);
      })
      .catch(console.error);
  });
  setTimeout(() => {
    disconnectBot(bot, nome, contas, index);
  }, 1000);
}

function disconnectBot(bot, nome, contas, index) {
  bot.disconnect().then(() => {
    console.log(`Desconectado da conta ${nome}`);
    setTimeout(() => {
      processAccount(contas, index + 1);
    }, 1000);
  });
}
