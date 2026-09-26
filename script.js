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
    error: false
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
      return (neg ? '-' : '') + fi.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + f;
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
    exprEl.textContent = message || '';
    render();
  }

  /* ---------- отрисовка ---------- */

  function render() {
    valueEl.textContent = state.error ? state.entry : formatEntry(state.entry);
    valueEl.classList.toggle('is-error', state.error);

    if (state.op && state.acc !== null) {
      exprEl.textContent = format(state.acc) + ' ' + OP_SYMBOL[state.op];
    } else {
      exprEl.textContent = ' ';
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

  // быстрый ввод: одна кнопка вводит сразу несколько цифр (например «67»)
  function inputSequence(seq) {
    if (state.error) return;
    for (const ch of String(seq)) pushDigit(ch);
    render();
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

  render();
})();
