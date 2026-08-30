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

/* Переключатели поднимаются раньше сцены, а пересчёт масштаба ей нужен —
   отсюда флаг: до первого select() пересчитывать нечего. */
let ready = false;

const syncToggle = document.querySelector('[data-toggle="sync"]');
const debugToggle = document.querySelector('[data-toggle="debug"]');
const xrayToggle = document.querySelector('[data-toggle="xray"]');

/* Оба режима — просто класс на борде; всё остальное делает CSS. */
[[debugToggle, 'board--debug'], [xrayToggle, 'board--xray']].forEach(([input, cls]) => {
  if (!input) return;
  const apply = () => {
    board.classList.toggle(cls, input.checked);
    if (cls === 'board--xray' && ready) fitScale();
  };
  input.addEventListener('change', apply);
  apply();
});

const refresh = new Map();
const frames = [];
let echoing = false;

/* Замеры показываются плитками: ключ ставится один раз, дальше меняется
   только значение — иначе на каждом кадре скролла пересобирался бы DOM. */
function stat(readout, key, value) {
  let tile = readout.querySelector(`[data-stat="${key}"]`);
  if (!tile) {
    tile = document.createElement('div');
    tile.className = 'stat';
    tile.dataset.stat = key;
    tile.innerHTML = '<div class="stat__k"></div><div class="stat__v"></div>';
    tile.querySelector('.stat__k').textContent = key;
    readout.appendChild(tile);
  }
  tile.querySelector('.stat__v').textContent = value;
}

document.querySelectorAll('.device').forEach((device) => {
  const scroll = device.querySelector('.screen__scroll');
  const sample = device.closest('.sample');
  const readout = sample.querySelector('.sample__readout');

  /* Единственная механика, которой нужен скролл, — придержанный ряд
     фильтров в ленте: `pin = max(0, min(scrollY, 68))`, ровно как в
     `ListingsFeedView`. Клампы с двух сторон обязательны: без нижнего
     bounce-overscroll даёт отрицательный оффсет и ряд прыгает вниз.
     Остальные экраны скриптовать нечем — там обычный поток. */
  const num = (name) => parseFloat(getComputedStyle(device).getPropertyValue(name)) || 0;

  /* ---- слой «что за рамкой» ----
     Строится по тому, что на экране реально есть: кромка клипа рисуется
     только там, где скроллпорт заинсечен, ряд — только там, где его
     придерживают, метка порога — только там, где порог есть. */
  const xray = document.createElement('div');
  xray.className = 'xray';
  const bleed = scroll.classList.contains('screen__scroll--bleed');
  const parts = [
    ['content', 'контент скролла — вся высота'],
    ['chrome', bleed ? 'хром — лежит поверх контента' : 'хром — не скроллится'],
  ];
  if (!bleed) parts.push(['clip', 'клип вьюпорта — режет контент']);
  if (device.querySelector('[data-pin]')) parts.push(['row', 'ряд фильтров — придержан']);
  if (device.querySelector('.surface')) parts.push(['surface', 'полотно — верхняя кромка']);
  parts.forEach(([cls, label]) => {
    const el = document.createElement('i');
    el.className = 'xray__' + cls;
    el.dataset.label = label;
    xray.appendChild(el);
  });
  device.appendChild(xray);

  /* Порог живёт не на экране, а на самом контенте: метка едет вместе с ним,
     и пересечение с кромкой вьюпорта означает, что эффект сработал. */
  const markEl = document.createElement('i');
  markEl.className = 'xray__mark';
  xray.appendChild(markEl);

  const threshold = () => {
    if (device.dataset.pattern === 'paint') return { at: 155, label: 'порог заливки — 155' };
    if (device.dataset.pattern === 'promo') {
      const sp = device.querySelector('.promo-space');
      return sp ? { at: sp.offsetHeight, label: `конец осветления — ${sp.offsetHeight}` } : null;
    }
    if (device.dataset.pattern === 'collapse') {
      const ti = device.querySelector('.pagetitle');
      const at = ti ? Math.round(ti.offsetTop + ti.offsetHeight) : 0;
      return at ? { at, label: `порог заголовка — ${at}` } : null;
    }
    return null;
  };

  /* ---- разбор паттерна ----
     Плашки слоёв и таблица чисел собираются из тех же токенов и переменных,
     которыми покрашен и размечен сам мокап. Списывать их руками нельзя:
     разойдутся при первой же правке. Считается при первом показе, а не при
     загрузке: у спрятанного сэмпла offsetHeight нулевой, и высоты hero и
     заголовка вышли бы нулями. */
  const root = getComputedStyle(document.documentElement);
  let described = false;

  /* Кастомное свойство приходит уже подставленным — `var(--bg-secondary)`
     превращается в hex, — поэтому имя токена ищется обратным поиском по
     палитре файла. Белый есть у двух токенов, роль разводит их. */
  const palette = ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-brand', '--bg-card-primary'];
  const tokenFor = (color, role) => {
    const hits = palette.filter((t) => root.getPropertyValue(t).trim().toLowerCase() === color.toLowerCase());
    if (!hits.length) return color;
    if (role === 'карточка' && hits.includes('--bg-card-primary')) return '--bg-card-primary';
    return hits[0];
  };

  const describe = () => {
    if (described) return;
    described = true;

    const layers = sample.querySelector('[data-layers]');
    if (layers) {
      const roles = [['--level-page', 'страница'], ['--level-scroll', 'полотно'], ['--level-block', 'карточка']];
      const seen = new Set();
      roles.forEach(([prop, role]) => {
        const color = getComputedStyle(sample).getPropertyValue(prop).trim();
        const token = tokenFor(color, role);
        if (seen.has(token)) return;
        seen.add(token);
        const el = document.createElement('span');
        el.className = 'layer';
        el.innerHTML = '<i class="layer__swatch"></i><b></b><span class="layer__role"></span>';
        el.querySelector('.layer__swatch').style.background = color;
        el.querySelector('b').textContent = token.startsWith('--') ? token.slice(2) : token;
        el.querySelector('.layer__role').textContent = role;
        layers.appendChild(el);
      });
    }

    const numbers = sample.querySelector('[data-numbers]');
    if (numbers) {
      /* --chrome-h объявлен через calc() и подставленным не приходит —
         складывается из тех же двух слагаемых. */
      const rows = [
        ['полоса хрома', `${num('--status-h') + num('--nav-h')}pt`],
        ['радиус полотна', `${num('--radius-xl')}pt`],
      ];
      if (device.querySelector('[data-pin]')) rows.push(['наезд полотна', `${num('--filter-overlap')}pt`]);
      if (device.querySelector('.hero-space')) rows.push(['акцентная зона', `${num('--hero-h')}pt`]);
      if (device.dataset.pattern === 'paint') rows.push(['высота фото', `${num('--photo-h')}pt`]);
      if (device.dataset.pattern === 'promo') rows.push(['hero', `${num('--promo-hero-h')}pt`]);

      /* Порог — та же величина, по которой паттерн живёт на экране. */
      const th = threshold();
      if (th) rows.push([th.label.split(' — ')[0], `${Math.round(th.at)}pt`]);

      rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.innerHTML = '<dt></dt><dd></dd>';
        row.querySelector('dt').textContent = k;
        row.querySelector('dd').textContent = v;
        numbers.appendChild(row);
      });
    }
  };

  const pinned = device.querySelector('[data-pin]');
  const photo = device.querySelector('[data-photo]');
  const pattern = device.dataset.pattern;

  const update = () => {
    const y = scroll.scrollTop;
    const parts = [['скролл', `${Math.round(y)}pt`]];

    /* Лента: `pin = max(0, min(scrollY, 68))`, ровно как в ListingsFeedView.
       Клампы с двух сторон обязательны — без нижнего bounce-overscroll даёт
       отрицательный оффсет и ряд прыгает вниз. */
    if (pinned) {
      const overlap = num('--filter-overlap');
      const pin = Math.max(0, Math.min(y, overlap));
      pinned.style.transform = `translateY(${pin}px)`;
      parts.push(['придержано', `${Math.round(pin)} / ${overlap}`]);
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
      parts.push(['заливка навбара', progress > 0.5 ? 'есть' : 'нет']);
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
      parts.push(['осветление', progress.toFixed(2)]);
    }

    /* Collapse: сам коллапс скрипта не требует — заголовок уезжает как
       обычный элемент, подхедер `sticky`. Порог нужен только заголовку в
       навбаре: он появляется, когда крупный ушёл под полосу. */
    if (pattern === 'collapse') {
      const title = device.querySelector('.pagetitle');
      const limit = title ? title.offsetTop + title.offsetHeight : 0;
      device.classList.toggle('is-scrolled', limit > 0 && y >= limit);
      parts.push(['заголовок ушёл', `${Math.round(Math.min(y, limit))} / ${limit}`]);
    }

    /* Силуэт: те же величины, что использует сам паттерн. Расхождение
       контура с картинкой означало бы ошибку в паттерне, а не в разметке. */
    const sur = device.querySelector('.surface');
    device.style.setProperty('--x-scroll', `${y}px`);
    device.style.setProperty('--x-content-h', `${scroll.scrollHeight}px`);
    device.style.setProperty('--x-surface-y', `${sur ? sur.offsetTop : 0}px`);
    if (pinned) {
      device.style.setProperty('--x-pin',
        `${Math.max(0, Math.min(y, num('--filter-overlap')))}px`);
    }
    const th = threshold();
    if (th) {
      device.style.setProperty('--x-mark', `${th.at}px`);
      markEl.dataset.label = th.label;
      markEl.style.display = '';
    } else {
      markEl.style.display = 'none';
    }

    if (readout) parts.forEach(([k, v]) => stat(readout, k, v));
  };

  /* Синхрон ведёт только видимые экраны: в сравнении их несколько, в фокусе
     он ничего не делает. Эхо гасится флагом — иначе кадры зациклятся. */
  scroll.addEventListener('scroll', () => {
    update();
    if (!syncToggle?.checked || echoing) return;
    echoing = true;
    frames.forEach((f) => {
      if (f.scroll === scroll || !f.sample.hasAttribute('data-active')) return;
      f.scroll.scrollTop = scroll.scrollTop;
      f.update();
    });
    echoing = false;
  }, { passive: true });

  frames.push({ sample, scroll, update });
  refresh.set(sample.dataset.sample, () => { describe(); update(); });
  update();
});

/* ---- что показано ----
   Дефолт — вся группа в ряд: стенд отвечает на вопрос «какой из них», а он
   сравнительный. Клик по паттерну открывает его крупно, с правилом выбора и
   замерами. Спрятанный сэмпл ничего не меряет — offsetHeight у него нули, а
   скролл браузер сбрасывает, — поэтому пересчёт идёт в момент показа. */
const picks = [...document.querySelectorAll('[data-pick]')];
const groups = [...document.querySelectorAll('[data-group]')].filter((el) => el.tagName === 'BUTTON');
const samples = [...document.querySelectorAll('[data-sample]')];
const groupIds = new Set(samples.map((s) => s.dataset.group));
const fallback = groups[0].dataset.group;

function select(id) {
  const isGroup = groupIds.has(id);
  const known = isGroup || samples.some((s) => s.dataset.sample === id);
  if (!known) id = fallback;

  const shown = groupIds.has(id)
    ? samples.filter((s) => s.dataset.group === id)
    : samples.filter((s) => s.dataset.sample === id);
  /* Группа из одного паттерна сравнивать не с чем — она открывается крупно. */
  const mode = shown.length > 1 ? 'compare' : 'focus';
  const openGroup = shown[0].dataset.group;

  stage.dataset.mode = mode;
  samples.forEach((s) => s.toggleAttribute('data-active', shown.includes(s)));
  picks.forEach((p) => p.setAttribute('aria-current', String(mode === 'focus' && p.dataset.pick === id)));
  groups.forEach((g) => {
    g.setAttribute('aria-current', String(g.dataset.group === id));
    g.toggleAttribute('data-within', !groupIds.has(id) && g.dataset.group === openGroup);
  });

  fitScale();
  shown.forEach((s) => refresh.get(s.dataset.sample)?.());
  return id;
}

[...picks, ...groups].forEach((el) => el.addEventListener('click', () => {
  const id = select(el.dataset.pick || el.dataset.group);
  history.replaceState(null, '', `#${id}`);
}));

/* ---- мокап целиком в окне ----
   Уменьшение — единственное, что здесь можно трогать: геометрия внутри
   экрана в pt и один к одному со спекой, поэтому подгоняется масштаб рамки,
   а не высоты внутри неё. В фокусе предел ставит высота окна, в сравнении —
   ещё и ширина, поделённая на число мокапов. */
const stage = document.querySelector('.stage');
const deviceH = parseFloat(getComputedStyle(board).getPropertyValue('--device-h')) || 915;
const deviceW = parseFloat(getComputedStyle(board).getPropertyValue('--device-w')) || 452;

function fitScale() {
  const shown = samples.filter((s) => s.hasAttribute('data-active'));
  const n = shown.length || 1;
  const cs = getComputedStyle(stage);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const top = stage.getBoundingClientRect().top + window.scrollY;
  let scale;

  if (stage.dataset.mode === 'focus') {
    scale = Math.max(0.46, Math.min(0.86, (window.innerHeight - top - 56) / deviceH));
  } else {
    /* Ярлыкам рентгена нужна своя колонка справа от каждого экрана, иначе
       они лягут на соседний. */
    const gutter = board.classList.contains('board--xray') ? 180 : 0;
    const gap = 24;
    const perW = (stage.clientWidth - padX - gap * (n - 1)) / n - gutter;
    const byW = perW / deviceW;
    /* Подпись под мокапом от масштаба не зависит — её высоту можно померить
       и вычесть, а не угадывать константой. */
    const infoH = Math.max(...shown.map((s) => s.querySelector('.sample__info').offsetHeight), 0);
    const byH = (window.innerHeight - top - infoH - 92) / deviceH;
    scale = Math.max(0.26, Math.min(0.62, Math.min(byW, byH)));
  }

  stage.style.setProperty('--scale', scale.toFixed(3));
}

ready = true;
select(location.hash.slice(1));

/* Ширину сцены на первом кадре знать неоткуда — она приходит вместе с
   раскладкой, и первый расчёт успевал упереться в нижний предел. Наблюдатель
   пересчитывает по факту; сравнение с прошлой шириной обязательно, иначе
   собственное изменение высоты будит его же. */
let lastWidth = 0;
new ResizeObserver(() => {
  if (stage.clientWidth === lastWidth) return;
  lastWidth = stage.clientWidth;
  fitScale();
}).observe(stage);
window.addEventListener('hashchange', () => select(location.hash.slice(1)));
window.addEventListener('resize', () => { fitScale(); });

