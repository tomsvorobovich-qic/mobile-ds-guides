/* ------------------------------------------------------------------
   Stand behaviour. Three things happen here:

   1. The panel writes custom properties onto :root, so every frame
      re-lays-out from one source of truth.
   2. Each frame gets a scroll listener that implements exactly one
      pattern — and nothing else. If a pattern needs no script, it has
      no script (that is the point of pattern A).
   3. Filler content is generated, so the markup stays readable.
   ------------------------------------------------------------------ */

const root = document.documentElement;
const stand = document.querySelector('.stand');

const frames = [];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const cssNumber = (name, el = root) =>
  parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

/* ---------- filler content ---------- */

const CARS = [
  ['Toyota Land Cruiser VXR', '2021 · 48 000 km'],
  ['Nissan Patrol Platinum', '2020 · 61 200 km'],
  ['Porsche 911 Carrera', '2019 · 22 400 km'],
  ['Lexus LX 570', '2022 · 15 900 km'],
  ['Mercedes-Benz G 63', '2021 · 33 100 km'],
  ['Range Rover Vogue', '2020 · 57 000 km'],
  ['BMW X7 xDrive40i', '2022 · 19 800 km'],
  ['Audi Q8 55 TFSI', '2021 · 41 500 km'],
];

const SPECS = [
  ['Year', '2021'],
  ['Mileage', '48 000 km'],
  ['Body', 'SUV'],
  ['Engine', '4.0 V6'],
  ['Transmission', 'Automatic'],
  ['Regional specs', 'GCC'],
  ['Doors', '5'],
  ['Seats', '7'],
];

function fillCards(node) {
  node.innerHTML = CARS.map(([title, meta]) => `
    <div class="card">
      <div class="card__thumb"></div>
      <div>
        <div class="card__title">${title}</div>
        <div class="card__meta">${meta}</div>
      </div>
    </div>`).join('');
}

function fillRows(node) {
  node.innerHTML = SPECS.map(([k, v]) => `
    <div class="detail__row"><span>${k}</span><span>${v}</span></div>`).join('');
}

document.querySelectorAll('[data-fill="cards"]').forEach(fillCards);
document.querySelectorAll('[data-fill="rows"]').forEach(fillRows);

/* ---------- the panel ---------- */

/* Surface stacks, straight off the three reference frames.
   page = the screen behind everything, scroll = the scrolling container,
   block = the content blocks inside it. */
const STACKS = {
  'tertiary-primary': {
    page: 'var(--surface-tertiary)',
    scroll: 'var(--surface-primary)',
    block: 'var(--surface-primary)',
  },
  'tertiary-secondary': {
    page: 'var(--surface-tertiary)',
    scroll: 'var(--surface-secondary)',
    block: 'var(--surface-primary)',
  },
  'accent-primary': {
    page: 'var(--surface-accent)',
    scroll: 'var(--surface-primary)',
    block: 'var(--surface-primary)',
  },
};

function applyStack(key) {
  const stack = STACKS[key];
  if (!stack) return;
  root.style.setProperty('--level-page', stack.page);
  root.style.setProperty('--level-scroll', stack.scroll);
  root.style.setProperty('--level-block', stack.block);
}

document.querySelectorAll('[data-var]').forEach((input) => {
  const name = input.dataset.var;
  const unit = input.dataset.unit || '';
  const out = document.querySelector(`[data-out="${name}"]`);

  const sync = () => {
    root.style.setProperty(name, input.value + unit);
    if (out) out.textContent = input.value + unit;
    frames.forEach((f) => f.update());
  };

  input.addEventListener('input', sync);
  sync();
});

document.querySelectorAll('[name="stack"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) applyStack(radio.value);
  });
  if (radio.checked) applyStack(radio.value);
});

const debugToggle = document.querySelector('[data-toggle="debug"]');
if (debugToggle) {
  const sync = () => stand.classList.toggle('stand--debug', debugToggle.checked);
  debugToggle.addEventListener('change', sync);
  sync();
}

/* ---------- per-frame patterns ---------- */

document.querySelectorAll('.phone').forEach((phone) => {
  const scroll = phone.querySelector('.phone__scroll');
  const readout = phone.parentElement.querySelector('.stand__readout');
  const pattern = phone.dataset.pattern;

  /* Pattern-specific hooks. Each returns a short readout string so the
     debug mode can show what the frame currently believes. */
  const behaviours = {
    /* A — nothing to script. The title is an ordinary element in flow and
       the sub-header is `position: sticky`. Listed here only to prove the
       point: if you find yourself writing scroll maths for pattern A,
       you have built it wrong. */
    A: () => `scrollTop ${Math.round(scroll.scrollTop)}\nno script needed`,

    /* B1 — the nav bar owns a real fill, interpolated over a window that
       starts at --paint-start and lasts --paint-distance. The icon scrim
       fades on the same window, inverted. */
    B1: () => {
      const start = cssNumber('--paint-start');
      const distance = cssNumber('--paint-distance');
      const paint = clamp01((scroll.scrollTop - start) / distance);
      phone.style.setProperty('--paint', paint.toFixed(3));
      phone.style.setProperty('--scrim', (1 - paint).toFixed(3));
      phone.classList.toggle('is-painted', paint > 0.5);
      return `scrollTop ${Math.round(scroll.scrollTop)}\npaint ${paint.toFixed(2)}`;
    },

    /* B2 — the row above the surface is held in place for the first
       --overlap px, so the surface (with its top radius) climbs over it.
       Past that point the two move together. This is the same compensating
       -offset maths the native implementation uses. */
    B2: () => {
      const overlap = cssNumber('--overlap', phone);
      const row = phone.querySelector('[data-pin]');
      const held = Math.min(scroll.scrollTop, overlap);
      if (row) row.style.transform = `translateY(${held}px)`;
      return `scrollTop ${Math.round(scroll.scrollTop)}\nheld ${Math.round(held)} / ${overlap}`;
    },
  };

  const run = behaviours[pattern] || behaviours.A;

  const update = () => {
    const text = run();
    if (readout) readout.textContent = text;
  };

  scroll.addEventListener('scroll', update, { passive: true });
  frames.push({ update });
  update();

  /* Debug threshold lines, positioned from the same numbers the pattern
     uses — so a wrong line means a wrong implementation, not a wrong
     overlay. */
  const marks = phone.querySelectorAll('.threshold[data-at]');
  frames.push({
    update: () => {
      marks.forEach((mark) => {
        const at = mark.dataset.at;
        const px = at.startsWith('--') ? cssNumber(at) : parseFloat(at);
        mark.style.top = `${px}px`;
      });
    },
  });
});

frames.forEach((f) => f.update());
