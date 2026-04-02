(function progressivelyTranslateBlogArticle() {
    if (window.APP_LANG !== 'en') {
        return;
    }

    const translationNodes = Array.from(document.querySelectorAll('[data-blog-translation-source]'));

    if (translationNodes.length === 0) {
        return;
    }

    function getCacheKey(targetLanguage, text) {
        return `blog-translation:${targetLanguage}:${text}`;
    }

    function readTranslationCache(targetLanguage, text) {
        try {
            return window.sessionStorage.getItem(getCacheKey(targetLanguage, text));
        } catch (error) {
            console.warn('读取博客翻译缓存失败:', error);
            return null;
        }
    }

    function writeTranslationCache(targetLanguage, text, translatedText) {
        try {
            window.sessionStorage.setItem(getCacheKey(targetLanguage, text), translatedText);
        } catch (error) {
            console.warn('写入博客翻译缓存失败:', error);
        }
    }

    function revealTranslation(node, translatedText) {
        if (!node || !translatedText) {
            return;
        }

        node.textContent = translatedText;
        node.hidden = false;
        node.classList.add('is-visible');
        node.dataset.translationState = 'loaded';
    }

    async function requestTranslation(sourceText, fieldKey) {
        const response = await window.fetch('/api/translate-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetLanguage: window.APP_LANG,
                items: [{
                    fieldKey,
                    text: sourceText
                }]
            })
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || 'Translation unavailable');
        }

        const [translation] = Array.isArray(payload.translations) ? payload.translations : [];
        return translation && typeof translation.translatedText === 'string'
            ? translation.translatedText.trim()
            : '';
    }

    async function hydrateTranslationNode(node, index) {
        const sourceText = String(node.dataset.blogTranslationSource || '').trim();

        if (!sourceText) {
            return;
        }

        const cachedTranslation = readTranslationCache(window.APP_LANG, sourceText);

        if (cachedTranslation) {
            revealTranslation(node, cachedTranslation);
            return;
        }

        node.dataset.translationState = 'loading';

        try {
            const translatedText = await requestTranslation(sourceText, String(index));

            if (!translatedText) {
                node.dataset.translationState = 'empty';
                return;
            }

            writeTranslationCache(window.APP_LANG, sourceText, translatedText);
            revealTranslation(node, translatedText);
        } catch (error) {
            console.error('博客段落翻译失败:', error);
            node.dataset.translationState = 'error';
        }
    }

    (async () => {
        for (const [index, node] of translationNodes.entries()) {
            await hydrateTranslationNode(node, index);
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
    })();
})();
