// JavaScript - logger.js
const winston = require("winston");
const fs = require("fs");
const moment = require("moment-timezone");
const logDir = "log";

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: `${logDir}/error.log`,
      level: "error",
    }),
    new winston.transports.File({ filename: `${logDir}/combined.log` }),
  ],
});

function logMiddleware(req, res, next) {
  const start = Date.now();
  req.logObject = {
    source: "request",
    target: req.path,
    method: req.method,
    startTimestamp: moment(start).tz("America/Sao_Paulo").format(),
  };

  const originalSend = res.send;
  res.send = function () {
    const duration = Date.now() - start;
    req.logObject.endTimestamp = moment().tz("America/Sao_Paulo").format();
    req.logObject.interval = `${duration}ms`;
    req.logObject.response = {
      code: res.statusCode,
      // Adicione mais campos conforme necessário
    };
    logger.info(req.logObject);
    originalSend.apply(res, arguments);
  };
  next();
}

module.exports = { logger, logMiddleware };
