(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      button.setAttribute('aria-label', theme === 'dark' ? 'Use light theme' : 'Use dark theme');
      button.textContent = theme === 'dark' ? '☀' : '◐';
    }
  };

  applyTheme(initialTheme);

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
})();
