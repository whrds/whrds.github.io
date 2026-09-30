(() => {
  const root = document.documentElement;
  let savedTheme;
  try { savedTheme = localStorage.getItem('theme'); } catch {}
  const initialTheme = savedTheme === 'light' ? 'light' : 'dark';

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101215' : '#edf0f3');
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const ko = root.lang === 'ko';
      button.setAttribute('aria-label', ko ? (theme === 'dark' ? '밝은 테마로 전환' : '어두운 테마로 전환') : (theme === 'dark' ? 'Use light theme' : 'Use dark theme'));
      button.textContent = theme === 'dark' ? '☀' : '◐';
    }
  };

  applyTheme(initialTheme);

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    applyTheme(next);
  });
})();

// The 3D bundle is loaded only on the homepage, never on article pages.
(() => {
  const host = document.querySelector('[data-hardware]');
  if (!host) return;
  const ko = document.documentElement.lang === 'ko';
  const button = host.querySelector('[data-load-three]');
  const hint = host.querySelector('[data-three-hint]');
  const version = new URL(document.currentScript?.src || location.href).searchParams.get('v');
  const modelUrl = '/assets/hero3d.js' + (version ? '?v=' + encodeURIComponent(version) : '');
  let loading = false;
  let mounted = false;
  async function load() {
    if (loading || mounted) return;
    loading = true;
    host.dataset.state = 'loading';
    button.disabled = true;
    button.textContent = ko ? '3D 준비 중…' : 'Preparing 3D…';
    try {
      const { mountHardware } = await import(modelUrl);
      await mountHardware(host);
      mounted = true;
    } catch (error) {
      host.dataset.state = 'fallback';
      hint.textContent = ko ? '3D를 표시할 수 없어 미리보기 이미지를 보여드립니다.' : 'Showing a preview because 3D is unavailable.';
      button.textContent = ko ? '3D 다시 시도' : 'Retry 3D';
      button.disabled = false;
      console.warn('Hardware preview unavailable:', error.message);
    } finally { loading = false; }
  }
  button.addEventListener('click', load);
  const saveData = navigator.connection?.saveData;
  if (!saveData && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: '100px' });
    observer.observe(host);
  }
})();
