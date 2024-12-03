const axios = require("axios");
const fs = require("fs");
const ini = require("ini");

function getConfig(gameName) {
  const config = ini.parse(fs.readFileSync("./config.ini", "utf-8"));
  return {
    clientId: config.CLIENT.ID,
    clientSecret: config.CLIENT.SECRET,
    nomeDoJogo: gameName || config.GAME.NAME,
    palavrasChave: [
      "Giveaway",
      "key",
      "!Giveaway",
      "!pirate",
      "!key",
      "sorteio",
      "LaDDy",
    ],
  };
}

function filterChannels(stream, palavrasChave) {
  const titulo = stream.title.toLowerCase();
  return palavrasChave.some((palavraChave) =>
    titulo.includes(palavraChave.toLowerCase())
  );
}

async function getAccessToken(gameName) {
  const config = getConfig(gameName);
  const response = await axios({
    method: "POST",
    url: `https://id.twitch.tv/oauth2/token?client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials`,
  });

  return response.data.access_token;
}

async function getGameId(accessToken, gameName) {
  const config = getConfig(gameName);
  const gameResponse = await axios({
    method: "GET",
    url: `https://api.twitch.tv/helix/games?name=${config.nomeDoJogo}`,
    headers: {
      "Client-ID": config.clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return gameResponse.data.data[0].id;
}

async function getStreams(
  gameId,
  accessToken,
  gameName,
  cursor,
  totalCanais = 0
) {
  const config = getConfig(gameName);
  let url = `https://api.twitch.tv/helix/streams?game_id=${gameId}`;
  if (cursor) {
    url += `&after=${cursor}`;
  }

  const response = await axios({
    method: "GET",
    url: url,
    headers: {
      "Client-ID": config.clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  totalCanais += response.data.data.length;
  const canais = [];

  response.data.data.forEach((stream) => {
    if (filterChannels(stream, config.palavrasChave)) {
      canais.push(stream.user_name);
    }
  });

  if (response.data.pagination && response.data.pagination.cursor) {
    const nextPageResult = await getStreams(
      gameId,
      accessToken,
      gameName,
      response.data.pagination.cursor,
      totalCanais
    );
    return {
      totalCanais: nextPageResult.totalCanais,
      canais: canais.concat(nextPageResult.canais),
    };
  } else {
    return {
      totalCanais,
      canais,
    };
  }
}

function writeChannelsToFile(canais) {
  fs.writeFileSync("canais.json", JSON.stringify(canais, null, 2));
}

async function main(gameName) {
  try {
    const accessToken = await getAccessToken(gameName);
    const gameId = await getGameId(accessToken, gameName);
    const { canais, totalCanais } = await getStreams(
      gameId,
      accessToken,
      gameName
    );

    writeChannelsToFile(canais);

    return {
      nomeDoJogo: getConfig(gameName).nomeDoJogo,
      totalCanais,
      canais,
    };
  } catch (error) {
    console.error("Erro ao obter o token de acesso ou o ID do jogo:", error);
    throw error;
  }
}

module.exports = { getAccessToken, getGameId, getStreams, main };
