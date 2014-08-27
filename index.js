'use strict';

var bunyan = require('bunyan');

/**
 * Mapping of Sails log levels to Bunyan.
 */
var logLevels = {
  silly: null, // no place for silly around here
  verbose: 'trace',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  crit: 'fatal',
  blank: 'info' // No idea what this is, but it's on sails.log at level info
};

/**
 * Converts a Sails.js log level to a Bunyan log level. Really, it's just
 * `verbose` that gets mapped to `trace.
 *
 * @param {string} sailsLevel Sails.js log level.
 * @returns {string} Bunyan log level.
 */
function toBunyanLevel(sailsLevel) {
  return logLevels[sailsLevel] || sailsLevel;
}

/**
 * A Sails.js custom log factory. This is a bunyan logger that has been
 * customized to be a drop-in replacement for the Winston logger used in Sails.
 * Follows the `log.level` defined in `config/log.js`, or the corresponding
 * value defined by the Sails runtime.
 *
 * @param {object} [sails] The sails global object. Defaults to `global.sails`
 * @returns {object} The newly created bunyan logger
 */
module.exports.injectBunyan = function (sails) {
  var logConfig, bunyanConfig;

  // default to the sails global object
  sails = sails || global.sails;

  // default configuration
  logConfig = sails.config.log || {};
  bunyanConfig = logConfig.bunyan || {};
  // default logger name to sails
  bunyanConfig.name = bunyanConfig.name || 'sails';
  // default to using standard serializers
  bunyanConfig.serializers = bunyanConfig.serializers || bunyan.stdSerializers;
  // default log level to debug
  bunyanConfig.level = bunyanConfig.level || toBunyanLevel(logConfig.level) || 'debug';

  // If log level is silent, remove the log streams
  if (logConfig.level === 'silent') {
    bunyanConfig.streams = [];
  }

  var logger = bunyan.createLogger(bunyanConfig);

  // the main log must be callable, default to debug level
  var log = sails.log = logger.debug.bind(logger);

  // Put log level function on log
  Object.keys(logLevels).forEach(function (sailsLevel) {
    var bunyanLevel = logLevels[sailsLevel];
    if (bunyanLevel) {
      log[sailsLevel] = logger[bunyanLevel].bind(logger);
    } else {
      // no-op
      log[sailsLevel] = function () {};
    }
  });

  // expose the logger as a property
  log.logger = logger;

  // Sails calls this method internally so we better oblige
  log.ship = function () {
    log.info('Sails v' + sails.version + ' successfully lifted!');
  };

  return logger;
};

module.exports.injectRequestLogger = function (req, res, next) {
  var logger;

  if (!global.sails) {
    console.error('Sails middleware has not been injected yet');
    return next();
  }

  if (!global.sails.log.logger) {
    console.error('Bunyan has not been injected into sails yet');
    return next();
  }

  // build a child logger for this request
  req.log = global.sails.log.logger.child({ req: req });
  next();
};