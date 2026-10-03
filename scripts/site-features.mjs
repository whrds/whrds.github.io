const escape = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const icon = (name) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name === 'rss' ? '<circle cx="5" cy="19" r="1" fill="currentColor"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>' : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'}</svg>`;

export function subscribeButton(lang) {
  return `<a class="subscribe-button" href="/${lang}/feed.xml" data-subscribe-open>${icon('rss')}<span>${lang === 'ko' ? '구독' : 'Subscribe'}</span></a>`;
}

export function viewCount(lang, kind = 'page') {
  const ko = lang === 'ko';
  const label = kind === 'site' ? (ko ? '누적 조회' : 'Total views') : (ko ? '조회' : 'Views');
  return `<span class="view-count" data-view-kind="${kind}" title="${ko ? '조회수 기능 적용 이후 집계 · 한영 합산' : 'Counted since this feature launched · Korean and English combined'}">${icon('eye')}<span>${label}</span><span class="view-count-value" data-view-value aria-live="polite">—</span></span>`;
}

export function subscribeCard(lang) {
  const ko = lang === 'ko';
  return `<aside class="subscribe-card" aria-label="${ko ? '새 글 구독' : 'Follow new posts'}"><div><p class="subscribe-kicker">STAY CURIOUS</p><h2>${ko ? '다음 기록도 함께 읽어요.' : 'Keep up with the next field note.'}</h2><p>${ko ? 'RSS 앱에서 새 글을 받아보세요.' : 'Get new posts in your RSS reader.'}</p></div>${subscribeButton(lang)}</aside>`;
}

export function siteDialogs(lang, siteUrl) {
  const ko = lang === 'ko';
  const feed = `${siteUrl}/${lang}/feed.xml`;
  return `<dialog class="site-dialog subscribe-dialog" id="subscribe-dialog" aria-labelledby="subscribe-title" aria-describedby="subscribe-description">
    <div class="dialog-heading"><div><p class="subscribe-kicker">RSS / WHRDS.LOG</p><h2 id="subscribe-title">${ko ? '새 글 구독' : 'Subscribe to new posts'}</h2></div><button class="dialog-close" type="button" data-dialog-close aria-label="${ko ? '닫기' : 'Close'}">×</button></div>
    <p id="subscribe-description">${ko ? 'RSS 앱에 피드를 추가하면 새 글을 모아볼 수 있어요. 원하는 언어를 선택하세요.' : 'Add this feed to your RSS reader to follow new posts. Choose your preferred language.'}</p>
    <div class="feed-languages" role="group" aria-label="${ko ? '구독 언어' : 'Feed language'}"><button type="button" data-feed-language="ko" aria-pressed="${ko}">한국어</button><button type="button" data-feed-language="en" aria-pressed="${!ko}">English</button></div>
    <label class="feed-label" for="feed-url">${ko ? 'RSS 주소' : 'Feed URL'}</label>
    <div class="feed-copy-row"><input id="feed-url" type="url" readonly spellcheck="false" value="${escape(feed)}" data-feed-origin="${escape(siteUrl)}"><button class="tool-button" type="button" data-copy-feed>${ko ? '주소 복사' : 'Copy URL'}</button></div>
    <p class="feed-status" data-feed-status role="status" aria-live="polite"></p>
    <div class="feed-actions"><a class="tool-button" data-reader-link href="https://www.inoreader.com/?add_feed=${encodeURIComponent(feed)}" target="_blank" rel="noopener noreferrer">${ko ? 'Inoreader에서 구독 ↗' : 'Subscribe in Inoreader ↗'}</a><a class="feed-raw-link" data-feed-link href="${escape(feed)}">${ko ? 'RSS 피드 열기' : 'Open RSS feed'} ↗</a></div>
    <p class="dialog-note">${ko ? 'RSS 주소는 다른 구독 앱에서도 사용할 수 있어요.' : 'This feed URL works with other RSS readers too.'}</p>
  </dialog>
  <dialog class="site-dialog image-lightbox" id="image-lightbox" aria-labelledby="image-lightbox-title">
    <div class="image-toolbar"><h2 id="image-lightbox-title">${ko ? '이미지 확대' : 'Image viewer'}</h2><div><button class="tool-button" type="button" data-image-scale aria-pressed="false">${ko ? '더 확대' : 'Zoom in'}</button><button class="dialog-close" type="button" data-dialog-close aria-label="${ko ? '닫기' : 'Close'}">×</button></div></div>
    <div class="image-viewport" tabindex="0" aria-label="${ko ? '확대 이미지, 방향키로 스크롤' : 'Enlarged image, use arrow keys to scroll'}"><img data-lightbox-image alt="" draggable="false" hidden></div>
    <p class="image-caption" data-image-caption></p>
  </dialog>`;
}
