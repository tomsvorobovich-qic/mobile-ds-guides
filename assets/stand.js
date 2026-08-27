/* ------------------------------------------------------------------
   Стенд живой только в одном: экраны реально скроллятся. Никаких
   регуляторов геометрии — скругление 32pt и высоты блоков это
   константы системы, а не параметры экрана.
   ------------------------------------------------------------------ */

const board = document.querySelector('.board');

/* блоки фида: 260pt с зазором 4pt */
document.querySelectorAll('[data-blocks]').forEach((node) => {
  const n = Number(node.dataset.blocks) || 6;
  node.innerHTML = '<div class="block"></div>'.repeat(n);
});

const syncToggle = document.querySelector('[data-toggle="sync"]');
const debugToggle = document.querySelector('[data-toggle="debug"]');

if (debugToggle) {
  const apply = () => board.classList.toggle('board--debug', debugToggle.checked);
  debugToggle.addEventListener('change', apply);
  apply();
}

const frames = [];
let echoing = false;

document.querySelectorAll('.device').forEach((device) => {
  const scroll = device.querySelector('.screen__scroll');
  const readout = device.closest('.sample').querySelector('.sample__readout');

  /* Единственная механика, которой нужен скролл, — придержанный ряд
     фильтров в ленте: `pin = max(0, min(scrollY, 68))`, ровно как в
     `ListingsFeedView`. Клампы с двух сторон обязательны: без нижнего
     bounce-overscroll даёт отрицательный оффсет и ряд прыгает вниз.
     Остальные экраны скриптовать нечем — там обычный поток. */
  const num = (name) => parseFloat(getComputedStyle(device).getPropertyValue(name)) || 0;

  const pinned = device.querySelector('[data-pin]');
  const photo = device.querySelector('[data-photo]');
  const pattern = device.dataset.pattern;

  const update = () => {
    const y = scroll.scrollTop;
    const parts = [`скролл ${Math.round(y)}`];

    /* Лента: `pin = max(0, min(scrollY, 68))`, ровно как в ListingsFeedView.
       Клампы с двух сторон обязательны — без нижнего bounce-overscroll даёт
       отрицательный оффсет и ряд прыгает вниз. */
    if (pinned) {
      const overlap = num('--filter-overlap');
      const pin = Math.max(0, Math.min(y, overlap));
      pinned.style.transform = `translateY(${pin}px)`;
      parts.push(`придержано ${Math.round(pin)} из ${overlap}`);
    }

    /* Карточка объявления: фото приколото к верху слота и сжимается —
       `.frame(height: base + minY).offset(y: -minY)`. Слот высоту не меняет,
       поэтому контент под ним скроллится с обычной скоростью. */
    if (photo) {
      const base = num('--photo-h') + num('--status-h');
      photo.style.transform = `translateY(${Math.max(0, y)}px)`;
      photo.style.height = `${Math.max(0, base - Math.max(0, y))}px`;
    }

    /* Заливка навбара — булев флип, а не интерполяция: порог там, где
       `(scrollY - 130) / 50` переваливает за 0.5. Плавность даёт CSS-переход
       0.2s, как `.animation(.easeInOut(duration: 0.2))`. */
    if (pattern === 'paint') {
      const progress = Math.min(1, Math.max(0, (y - 130) / 50));
      device.classList.toggle('is-scrolled', progress > 0.5);
      parts.push(`порог ${progress > 0.5 ? 'пройден' : 'нет'}`);
    }

    /* Промо: hero остаётся стики — он лежит отдельным слоем вне скролла и
       не двигается. Контент наслаивается поверх, а hero параллельно
       осветляется, так что к концу наезда в полосе навбара уже фон
       страницы. Диапазон — путь карточки до нижней кромки навбара. */
    if (pattern === 'promo') {
      const space = device.querySelector('.promo-space');
      const span = space ? space.offsetHeight : 0;
      const progress = span > 0 ? Math.min(1, Math.max(0, y / span)) : 0;
      device.style.setProperty('--progress', progress.toFixed(3));
      device.classList.toggle('is-scrolled', progress > 0.5);
      parts.push(`осветление ${progress.toFixed(2)}`);
    }

    /* Collapse: сам коллапс скрипта не требует — заголовок уезжает как
       обычный элемент, подхедер `sticky`. Порог нужен только заголовку в
       навбаре: он появляется, когда крупный ушёл под полосу. */
    if (pattern === 'collapse') {
      const title = device.querySelector('.pagetitle');
      const limit = title ? title.offsetTop + title.offsetHeight : 0;
      device.classList.toggle('is-scrolled', limit > 0 && y >= limit);
      parts.push(`заголовок ${Math.round(Math.min(y, limit))} из ${limit}`);
    }

    if (readout) readout.textContent = parts.join(' · ');
  };

  scroll.addEventListener('scroll', () => {
    update();
    if (!syncToggle?.checked || echoing) return;
    echoing = true;
    frames.forEach((f) => f.scroll !== scroll && f.set(scroll.scrollTop));
    echoing = false;
  }, { passive: true });

  frames.push({ scroll, update, set: (t) => { scroll.scrollTop = t; update(); } });
  update();
});
