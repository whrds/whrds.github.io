// UI-only copy restrictions are a deterrent, not protection against source inspection.
export const VIEW_WINDOW_MS = 30 * 60 * 1000;

export function shouldCountView(previous, now = Date.now()) {
  const timestamp = Number(previous);
  return !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now || now - timestamp >= VIEW_WINDOW_MS;
}

export function feedLinks(origin, language) {
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol) || !['ko', 'en'].includes(language)) throw new Error('Invalid feed');
  const feed = new URL('/' + language + '/feed.xml', base).href;
  return { feed, reader: 'https://www.inoreader.com/?add_feed=' + encodeURIComponent(feed) };
}

// The shipped configuration is disabled. No request is made without an explicitly configured endpoint.
export async function requestViewCounts({ endpoint, pageUrl, increment, signal, fetcher = globalThis.fetch }) {
  const target = new URL(endpoint);
  const page = new URL(pageUrl);
  if (target.protocol !== 'https:' || page.protocol !== 'https:') throw new Error('HTTPS required');
  page.search = '';
  page.hash = '';
  const response = await fetcher(target.href, {
    method: increment ? 'POST' : 'GET',
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    headers: { 'x-bsz-referer': page.href },
    signal
  });
  if (!response.ok) throw new Error('Counter unavailable');
  const payload = await response.json();
  const counts = payload?.data;
  if (payload?.success !== true || !counts || !['page_pv', 'site_pv'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) {
    throw new Error('Invalid counter response');
  }
  return { page: counts.page_pv, site: counts.site_pv };
}

function wireDialog(dialog) {
  if (!dialog || typeof dialog.showModal !== 'function') return null;
  const close = () => dialog.close();
  dialog.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', close));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('modal-open');
  });
  return () => {
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('modal-open');
  };
}

function setupSubscription(ko) {
  const dialog = document.querySelector('#subscribe-dialog');
  const open = wireDialog(dialog);
  if (!open) return;
  const input = dialog.querySelector('#feed-url');
  const status = dialog.querySelector('[data-feed-status]');
  document.querySelectorAll('[data-subscribe-open]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    status.textContent = '';
    open();
  }));
  dialog.querySelectorAll('[data-feed-language]').forEach(button => button.addEventListener('click', () => {
    const links = feedLinks(input.dataset.feedOrigin, button.dataset.feedLanguage);
    input.value = links.feed;
    dialog.querySelector('[data-feed-link]').href = links.feed;
    dialog.querySelector('[data-reader-link]').href = links.reader;
    dialog.querySelectorAll('[data-feed-language]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    status.textContent = '';
  }));
  input.addEventListener('click', () => input.select());
  dialog.querySelector('[data-copy-feed]').addEventListener('click', async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(input.value);
        copied = true;
      }
    } catch {}
    if (!copied) {
      input.focus();
      input.select();
      try { copied = Boolean(document.execCommand?.('copy')); } catch {}
    }
    status.textContent = copied
      ? (ko ? 'RSS 주소를 복사했어요. 구독 앱에 붙여넣어 주세요.' : 'Feed URL copied. Paste it into your RSS reader.')
      : (ko ? '주소를 선택했어요. 직접 복사해서 구독 앱에 붙여넣어 주세요.' : 'The URL is selected. Copy it into your RSS reader.');
  });
}

function setupImageViewer(ko) {
  const dialog = document.querySelector('#image-lightbox');
  const open = wireDialog(dialog);
  if (!open) return;
  const display = dialog.querySelector('[data-lightbox-image]');
  const caption = dialog.querySelector('[data-image-caption]');
  const scaleButton = dialog.querySelector('[data-image-scale]');
  const viewport = dialog.querySelector('.image-viewport');
  const setZoom = enlarged => {
    dialog.dataset.zoomed = String(enlarged);
    display.style.width = enlarged ? Math.max(display.naturalWidth, viewport.clientWidth * 2) + 'px' : '';
    scaleButton.setAttribute('aria-pressed', String(enlarged));
    scaleButton.textContent = ko ? (enlarged ? '화면에 맞춤' : '더 확대') : (enlarged ? 'Fit to screen' : 'Zoom in');
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  };
  document.querySelectorAll('.prose img').forEach(image => {
    image.draggable = false;
    let trigger = image.closest('a');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      image.replaceWith(trigger);
      trigger.append(image);
    } else {
      trigger.setAttribute('role', 'button');
      trigger.addEventListener('keydown', event => {
        if (event.key === ' ') { event.preventDefault(); trigger.click(); }
      });
    }
    trigger.classList.add('image-zoom');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'image-lightbox');
    trigger.setAttribute('aria-label', (ko ? '이미지 확대' : 'Enlarge image') + (image.alt ? ': ' + image.alt : ''));
    trigger.addEventListener('click', event => {
      event.preventDefault();
      display.src = image.currentSrc || image.src;
      display.alt = image.alt;
      display.hidden = false;
      caption.textContent = image.alt;
      open();
      setZoom(false);
    });
  });
  scaleButton.addEventListener('click', () => setZoom(dialog.dataset.zoomed !== 'true'));
  display.addEventListener('load', () => {
    if (dialog.open && dialog.dataset.zoomed === 'true') setZoom(true);
  });
  display.addEventListener('error', () => {
    caption.textContent = ko ? '이미지를 불러올 수 없습니다. 창을 닫고 다시 시도해 주세요.' : 'Unable to load the image. Close the viewer and try again.';
  });
  dialog.addEventListener('close', () => {
    display.hidden = true;
    display.removeAttribute('src');
    display.style.width = '';
    caption.textContent = '';
  });
}

export function isProtectedTarget(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement;
  return Boolean(element?.closest?.('img, .prose pre, .prose code, .image-zoom, .image-lightbox'));
}

function setupCopyRestrictions() {
  document.querySelectorAll('img').forEach(image => { image.draggable = false; });
  document.querySelectorAll('.prose pre').forEach(block => { block.tabIndex = 0; });
  for (const type of ['contextmenu', 'dragstart']) {
    document.addEventListener(type, event => {
      if (isProtectedTarget(event.target)) event.preventDefault();
    });
  }
  const guard = event => {
    if (document.activeElement?.matches('input, textarea, [contenteditable="true"]')) return;
    const selection = window.getSelection();
    let protectedSelection = isProtectedTarget(event.target);
    if (selection && !selection.isCollapsed) {
      const protectedNodes = document.querySelectorAll('.prose pre, .prose code, .prose img');
      protectedSelection ||= [...protectedNodes].some(node => {
        for (let index = 0; index < selection.rangeCount; index++) {
          try { if (selection.getRangeAt(index).intersectsNode(node)) return true; } catch {}
        }
        return false;
      });
    }
    if (protectedSelection) {
      event.preventDefault();
      event.clipboardData?.setData('text/plain', '');
    }
  };
  document.addEventListener('copy', guard);
  document.addEventListener('cut', guard);
}

async function setupViewCounts(ko) {
  const endpoint = document.body.dataset.viewEndpoint;
  const pageUrl = document.body.dataset.viewPage;
  const indicators = [...document.querySelectorAll('[data-view-kind]')];
  if (!endpoint || !pageUrl || !indicators.length) return;
  const updateState = (text, title) => indicators.forEach(node => {
    node.querySelector('[data-view-value]').textContent = text;
    node.title = title;
  });
  if (new URL(pageUrl).origin !== location.origin || location.protocol !== 'https:') {
    updateState('—', ko ? '미리보기에서는 조회수를 집계하지 않습니다.' : 'Views are not counted in previews.');
    return;
  }
  if (document.hidden) await new Promise(resolve => {
    const visible = () => {
      if (!document.hidden) { document.removeEventListener('visibilitychange', visible); resolve(); }
    };
    document.addEventListener('visibilitychange', visible);
  });
  const storageKey = 'whrds:view:' + new URL(pageUrl).pathname;
  let previous;
  try { previous = sessionStorage.getItem(storageKey); } catch {}
  const increment = shouldCountView(previous);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const counts = await requestViewCounts({ endpoint, pageUrl, increment, signal: controller.signal });
    if (increment) {
      try { sessionStorage.setItem(storageKey, String(Date.now())); } catch {}
    }
    const formatter = new Intl.NumberFormat(ko ? 'ko-KR' : 'en-US');
    indicators.forEach(node => {
      node.querySelector('[data-view-value]').textContent = formatter.format(counts[node.dataset.viewKind]);
    });
  } catch {
    updateState('—', ko ? '조회수를 잠시 불러올 수 없습니다.' : 'View count is temporarily unavailable.');
  } finally { clearTimeout(timeout); }
}

if (typeof document !== 'undefined') {
  const ko = document.documentElement.lang === 'ko';
  setupSubscription(ko);
  setupImageViewer(ko);
  setupCopyRestrictions();
  void setupViewCounts(ko);
}
