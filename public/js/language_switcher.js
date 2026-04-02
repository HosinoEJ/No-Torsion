(() => {
    const languageSwitcher = document.querySelector('[data-language-switcher]');
    const languageButtons = document.querySelectorAll('[data-lang-option]');
    const languageToggle = document.querySelector('[data-language-toggle]');

    if (!languageSwitcher || !languageToggle || languageButtons.length === 0) {
        return;
    }

    function setExpanded(expanded) {
        languageSwitcher.classList.toggle('is-expanded', expanded);
        languageToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    languageToggle.addEventListener('click', () => {
        setExpanded(!languageSwitcher.classList.contains('is-expanded'));
    });

    languageButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextLang = button.dataset.langOption;

            if (!nextLang) {
                return;
            }

            setExpanded(false);

            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('lang', nextLang);
            window.location.href = nextUrl.toString();
        });
    });

    document.addEventListener('click', (event) => {
        if (!languageSwitcher.contains(event.target)) {
            setExpanded(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setExpanded(false);
        }
    });
})();
