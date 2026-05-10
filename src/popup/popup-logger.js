(function initPopupLogger(globalObj) {
  const DEBUG = false;

  function debug(...args) {
    if (!DEBUG) return;
    console.log(...args);
  }

  function info(...args) {
    if (!DEBUG) return;
    console.info(...args);
  }

  function warn(...args) {
    console.warn(...args);
  }

  function error(...args) {
    console.error(...args);
  }

  globalObj.PopupLogger = Object.freeze({
    debug,
    info,
    warn,
    error,
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
