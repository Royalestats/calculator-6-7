(function () {
  'use strict';

  const exprEl = document.getElementById('expr');
  const valueEl = document.getElementById('value');
  const historyEl = document.getElementById('history');
  const keysEl = document.getElementById('keys');

  const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  const state = {
    entry: '0',      // цифры, которые вводит пользователь (строка)
    acc: null,       // накопленный результат
    op: null,        // отложенная операция
    fresh: true,     // следующая цифра начинает новое число
    error: false,
    errorText: ''
  };

  /* ---------- форматирование ---------- */

  function tidy(n) {
    if (!isFinite(n)) return NaN;
    // убираем ошибки точности: 0.1 + 0.2 -> 0.30000000000000004
    return parseFloat(n.toPrecision(12));
  }

  function format(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '∞';
    n = tidy(n);
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(6).replace('.', ',');
    let s = n.toFixed(10);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    const [int, frac] = s.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return frac ? grouped + ',' + frac : grouped;
  }

  function formatEntry(str) {
    if (str === 'ERR') return 'Деление на ноль';
    const neg = str.startsWith('-');
    let s = neg ? str.slice(1) : str;
    if (s === '.') s = '0.';
    if (s.includes('.')) {
      const [i, f] = s.split('.');
      const fi = i === '' ? '0' : i;
      return (neg ? '-' : '') + fi.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + f;
    }
    if (s.length > 1) s = s.replace(/^0+(?=\d)/, '');
    return (neg ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  const entryValue = () => parseFloat(state.entry.replace(',', '.')) || 0;

  /* ---------- вычисления ---------- */

  function calculate(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  function showError(message) {
    state.error = true;
    state.entry = 'ERR';
    state.acc = null;
    state.op = null;
    state.fresh = true;
    state.errorText = message || 'Деление на ноль';
    render();
  }

  /* ---------- отрисовка ---------- */

  function render() {
    valueEl.textContent = state.error ? state.entry : formatEntry(state.entry);
    valueEl.classList.toggle('is-error', state.error);

    if (state.error) {
      exprEl.textContent = state.errorText;
    } else if (state.op && state.acc !== null) {
      exprEl.textContent = format(state.acc) + ' ' + OP_SYMBOL[state.op];
    } else {
      exprEl.textContent = ' ';
    }

    updateFx();
  }

  /* ---------- эффекты при вводе 67 ---------- */

  const flyersEl = document.getElementById('flyers');
  const has67 = () => !state.error && state.entry.indexOf('67') !== -1;
  let fxOn = null;

  function setFx(on) {
    if (fxOn === on) return;
    fxOn = on;
    document.body.classList.toggle('fx-on', on);
  }

  function updateFx() {
    setFx(has67());
  }

  // Пары «6» и «7». У 7 сдвиг на полпериода — это и даёт противофазе.
  if (flyersEl) {
    const COUNT = 7;
    for (let i = 0; i < COUNT; i++) {
      const pair = document.createElement('div');
      pair.className = 'flyer';

      const six = document.createElement('span');
      six.className = 'flyer__n flyer__n--6';
      six.textContent = '6';

      const seven = document.createElement('span');
      seven.className = 'flyer__n flyer__n--7';
      seven.textContent = '7';

      pair.append(six, seven);
      pair.style.left = (7 + i * (86 / (COUNT - 1))).toFixed(2) + '%';
      pair.style.setProperty('--dur', (5.2 + (i % 4) * 1.1).toFixed(2) + 's');
      pair.style.setProperty('--delay', (-(i * 0.91)).toFixed(2) + 's');
      pair.style.setProperty('--size', (38 + (i % 3) * 16) + 'px');
      flyersEl.appendChild(pair);
    }
  }

  function addHistory(a, op, b, result) {
    const item = document.createElement('div');
    item.className = 'history__item';
    item.innerHTML = '<span>' + format(a) + ' ' + OP_SYMBOL[op] + ' ' + format(b) + '</span><b>=</b>';

    item.addEventListener('click', function () {
      state.entry = String(tidy(result));
      state.acc = null;
      state.op = null;
      state.fresh = true;
      state.error = false;
      render();
    });

    historyEl.prepend(item);
    while (historyEl.children.length > 20) historyEl.lastElementChild.remove();
  }

  /* ---------- действия ---------- */

  const digitsLength = (s) => s.replace('-', '').replace('.', '').length;

  function pushDigit(d) {
    if (state.fresh) {
      state.entry = d === '.' ? '0.' : d;
      state.fresh = false;
    } else {
      if (state.entry === '0') state.entry = d;
      else if (state.entry === '-0') state.entry = '-' + d;
      else if (digitsLength(state.entry) < 15) state.entry += d;
    }
  }

  function inputDigit(d) {
    if (state.error) return;
    pushDigit(d);
    render();
  }

  // назначается блоком звука ниже, чтобы inputSequence не зависел от DOM-звука
  let onSequence = null;

  // быстрый ввод: одна кнопка вводит сразу несколько цифр (например «67»)
  function inputSequence(seq) {
    if (state.error) return;
    for (const ch of String(seq)) pushDigit(ch);
    render();
    if (onSequence) onSequence(String(seq));
  }

  function inputDot() {
    if (state.error) return;
    if (state.fresh) {
      state.entry = '0.';
      state.fresh = false;
    } else if (!state.entry.includes('.')) {
      state.entry += '.';
    }
    render();
  }

  function setOperator(op) {
    if (state.error) return;

    if (state.op !== null && !state.fresh) {
      const result = calculate(state.acc, state.op, entryValue());
      if (!isFinite(result)) return showError('Деление на ноль');
      addHistory(state.acc, state.op, entryValue(), result);
      state.acc = tidy(result);
      state.entry = String(state.acc);
    } else if (state.acc === null || !state.fresh) {
      state.acc = tidy(entryValue());
    }

    state.op = op;
    state.fresh = true;
    render();
  }

  function equals() {
    if (state.error) return;
    if (state.op === null || state.acc === null) {
      exprEl.textContent = ' ';
      return;
    }

    const b = entryValue();
    const a = state.acc;
    const result = calculate(a, state.op, b);

    if (!isFinite(result)) return showError('Деление на ноль');

    addHistory(a, state.op, b, result);
    state.entry = String(tidy(result));
    state.acc = null;
    state.op = null;
    state.fresh = true;
    render();
  }

  function toggleSign() {
    if (state.error) return;
    if (state.entry === '0' || state.entry === '0.') return;
    state.entry = state.entry.startsWith('-') ? state.entry.slice(1) : '-' + state.entry;
    render();
  }

  function percent() {
    if (state.error) return;
    const value = entryValue();
    // если есть отложенная операция — считаем процент от накопленного значения
    const base = (state.op && state.acc !== null) ? state.acc : 1;
    state.entry = String(tidy(value / 100 * base));
    state.fresh = false;
    render();
  }

  function clearAll() {
    state.entry = '0';
    state.acc = null;
    state.op = null;
    state.fresh = true;
    state.error = false;
    historyEl.innerHTML = '';
    render();
  }

  function backspace() {
    if (state.error) return;
    if (state.fresh) return;
    state.entry = state.entry.slice(0, -1);
    if (state.entry === '' || state.entry === '-') state.entry = '0';
    if (state.entry === '-0') state.entry = '0';
    render();
  }

  /* ---------- события мыши ---------- */

  function flash(btn) {
    if (!btn) return;
    btn.classList.add('is-active');
    setTimeout(function () { btn.classList.remove('is-active'); }, 110);
  }

  keysEl.addEventListener('click', function (e) {
    const btn = e.target.closest('.key');
    if (!btn) return;
    flash(btn);
    countPress();

    if (btn.dataset.num !== undefined) return inputDigit(btn.dataset.num);
    if (btn.dataset.seq) return inputSequence(btn.dataset.seq);
    if (btn.dataset.op) return setOperator(btn.dataset.op);

    switch (btn.dataset.action) {
      case 'dot': inputDot(); break;
      case 'equals': equals(); break;
      case 'sign': toggleSign(); break;
      case 'percent': percent(); break;
      case 'clear': clearAll(); break;
    }
  });

  /* ---------- клавиатура ---------- */

  const KEY_TO_BUTTON = {
    '/': '[data-op="/"]',
    '*': '[data-op="*"]',
    '-': '[data-op="-"]',
    '+': '[data-op="+"]',
    '=': '[data-action="equals"]',
    'Enter': '[data-action="equals"]',
    '.': '[data-action="dot"]',
    ',': '[data-action="dot"]',
    '%': '[data-action="percent"]',
    'Backspace': '[data-action="clear"]',
    'Escape': '[data-action="clear"]',
    'Delete': '[data-action="clear"]',
    'c': '[data-action="clear"]',
    'C': '[data-action="clear"]'
  };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;

    // Настоящий ввод с клавиатуры, не служебные клавиши
    if (/^[0-9]$/.test(key) || /^[+\-*/.=]$/.test(key) || key === ',') countPress();

    if (/^[0-9]$/.test(key)) {
      flash(keysEl.querySelector('[data-num="' + key + '"]'));
      return inputDigit(key);
    }

    if (KEY_TO_BUTTON[key]) {
      e.preventDefault();
      flash(keysEl.querySelector(KEY_TO_BUTTON[key]));
      if (key === 'Backspace') return backspace();
      if (key === 'Escape' || key === 'Delete' || key === 'c' || key === 'C') return clearAll();
      if (key === '=' || key === 'Enter') return equals();
      if (key === '%') return percent();
      if (key === '.' || key === ',') return inputDot();
      return setOperator(key);
    }
  });

  /* ---------- звук 67 GAZAN ---------- */

  const sfx = document.getElementById('sfx');

  sfx.volume = 0.85;

  // Браузеры не дают играть звуку без жеста пользователя, поэтому «включение»
  // происходит на первом нажатии любой кнопки. muted — пользователь сам
  // выключил звук, после этого автостарт больше не срабатывает.
  let soundMuted = false;
  let unlocked = false;

  function playSfx() {
    sfx.currentTime = 0;   // каждое нажатие начинает звук с начала
    const p = sfx.play();
    if (p && p.catch) p.catch(() => {});  // автоблокировка не должна сыпать ошибками
  }

  // Первое нажатие любой кнопки включает звук и сразу его проигрывает.
  function unlockSound() {
    if (unlocked || soundMuted) return;
    unlocked = true;
    playSfx();
  }

  // мем проигрывается по кнопке «67»
  onSequence = function (seq) {
    if (seq === '67' && !soundMuted) playSfx();
  };

  // «любая кнопка» = клик по сетке клавиш и любая клавиша калькулятора
  keysEl.addEventListener('click', unlockSound, true);
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key) || KEY_TO_BUTTON[e.key]) unlockSound();
  }, true);

  // выключить/включить звук — клавишей M
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'm' && e.key !== 'M' && e.key !== 'ь' && e.key !== 'Ь') return;
    e.preventDefault();
    if (soundMuted) {
      soundMuted = false;
      unlocked = true;
      playSfx();
    } else {
      soundMuted = true;
      sfx.pause();
    }
  });

  /* ---------- тема ---------- */

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const saved = localStorage.getItem('calc-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const startLight = saved ? saved === 'light' : prefersLight;

  function applyTheme(light) {
    document.body.classList.toggle('theme-light', light);
    themeIcon.textContent = light ? '☀️' : '🌙';
    localStorage.setItem('calc-theme', light ? 'light' : 'dark');
  }

  applyTheme(startLight);
  themeToggle.addEventListener('click', function () {
    applyTheme(!document.body.classList.contains('theme-light'));
  });

  /* ---------- окно оплаты после 5 нажатий ---------- */

  const payModal = document.getElementById('payModal');
  const pressLimit = 5;
  let presses = 0;
  let lastFocus = null;

  function openPay() {
    if (!payModal || !payModal.hidden) return;
    lastFocus = document.activeElement;
    payModal.hidden = false;
    document.body.classList.add('modal-open');
    const pay = document.getElementById('payBtn');
    if (pay) pay.focus();
  }

  function closePay() {
    if (!payModal || payModal.hidden) return;
    payModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  // Считаем и мышь, и клавиатуру — иначе счётчик обходится одной рукой.
  function countPress() {
    presses++;
    if (presses === pressLimit) openPay();
  }

  if (payModal) {
    payModal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closePay();
    });

    const payBtn = document.getElementById('payBtn');
    if (payBtn) {
      payBtn.addEventListener('click', function () {
        payBtn.textContent = 'Оплачено (демо)';
        setTimeout(closePay, 900);
      });
    }

    // Esc закрывает; Tab не должен уводить фокус за пределы окна
    payModal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        return closePay();
      }
      if (e.key !== 'Tab') return;

      const focusable = payModal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  render();
})();
