const {
  defaultLanguage,
  getLanguageOptions,
  getMessages,
  parseCookieHeader,
  resolveLanguage,
  serializeLanguageCookie,
  translate
} = require('../../config/i18n');

function createI18nMiddleware() {
  return function i18nMiddleware(req, res, next) {
    const cookies = parseCookieHeader(req.headers.cookie);
    const queryLanguage = resolveLanguage(req.query.lang);
    const cookieLanguage = resolveLanguage(cookies.lang);
    const language = queryLanguage || cookieLanguage || defaultLanguage;

    if (queryLanguage && queryLanguage !== cookieLanguage) {
      res.append('Set-Cookie', serializeLanguageCookie(queryLanguage));
    }

    req.lang = language;
    req.t = (key, variables) => translate(language, key, variables);

    res.locals.lang = language;
    res.locals.t = req.t;
    res.locals.clientMessages = getMessages(language);
    res.locals.languageOptions = getLanguageOptions(language);

    next();
  };
}

module.exports = {
  createI18nMiddleware
};
