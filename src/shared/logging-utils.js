(function initLEFLoggingUtils(globalObj) {
  const DEBUG = false;

  function debug(...args) {
    if (DEBUG) console.log(...args);
  }

  globalObj.LEFLoggingUtils = Object.freeze({
    DEBUG,
    debug,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
