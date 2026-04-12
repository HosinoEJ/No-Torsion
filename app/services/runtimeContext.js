const { AsyncLocalStorage } = require('async_hooks');

const runtimeContextStorage = new AsyncLocalStorage();

function runWithRuntimeContext(context, callback) {
  return runtimeContextStorage.run(context || {}, callback);
}

function getRuntimeContext() {
  return runtimeContextStorage.getStore() || {};
}

function getRuntimeBinding(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return null;
  }

  const { env } = getRuntimeContext();
  if (!env || typeof env !== 'object') {
    return null;
  }

  return env[name] || null;
}

module.exports = {
  getRuntimeBinding,
  getRuntimeContext,
  runWithRuntimeContext
};
