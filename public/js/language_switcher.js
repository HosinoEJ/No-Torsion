(() => {
    const languageButtons = document.querySelectorAll('[data-lang-option]');

    if (languageButtons.length === 0) {
        return;
    }

    languageButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextLang = button.dataset.langOption;

            if (!nextLang) {
                return;
            }

            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('lang', nextLang);
            window.location.href = nextUrl.toString();
        });
    });
})();
