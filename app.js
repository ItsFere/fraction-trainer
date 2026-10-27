/*
 * Математический Тренажер: Дроби
 *
 * JavaScript port of the CustomTkinter application
 * (MixedFractionApp).  Program flow, state names, widget layout,
 * keyboard/numpad behaviour and message-box texts are kept identical.
 */
(function () {
  'use strict';

  var Fraction = window.FracMath.Fraction;
  var formatAnswer = window.FracMath.formatAnswer;
  var parseUserInput = window.FracMath.parseUserInput;
  var pyDivMod = window.FracMath.pyDivMod;

  /* ------------------------------------------------------------------ *
   * Application state (mirrors MixedFractionApp attributes)
   * ------------------------------------------------------------------ */
  var state = {
    score: 0,
    total: 0,
    operation: '+',
    activeTarget: 'answer',
    answerFormat: 'mixed',
    fraction1: null,
    fraction2: null,
    correctAnswer: null
  };

  /* ------------------------------------------------------------------ *
   * Element references
   * ------------------------------------------------------------------ */
  var el = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    el.mainFrame = byId('app');
    el.leftPanel = byId('left_panel');
    el.labelTitle = byId('label_title');
    el.canvasCard = byId('canvas_card');
    el.exampleFrame = byId('example_frame');

    el.frac1Frame = byId('frac1_frame');
    el.lbl1Whole = byId('lbl1_whole');
    el.frac1Inner = byId('frac1_inner');
    el.lbl1Num = byId('lbl1_num');
    el.lbl1Den = byId('lbl1_den');

    el.lblOp = byId('lbl_op');

    el.frac2Frame = byId('frac2_frame');
    el.lbl2Whole = byId('lbl2_whole');
    el.frac2Inner = byId('frac2_inner');
    el.lbl2Num = byId('lbl2_num');
    el.lbl2Den = byId('lbl2_den');

    el.lblEq = byId('lbl_eq');
    el.lblQuestion = byId('lbl_question');

    el.entryCard = byId('entry_card');
    el.entryInner = byId('entry_inner');
    el.formatLabel = byId('format_label');
    el.formatMenu = byId('format_menu');
    el.entryAnswer = byId('entry_answer');

    el.btnCheck = byId('btn_check');
    el.scoreCard = byId('score_card');
    el.labelScore = byId('label_score');

    el.rightPanel = byId('right_panel');
    el.labelDraftTitle = byId('label_draft_title');
    el.draftText = byId('draft_text');
    el.btnClearDraft = byId('btn_clear_draft');

    el.numpadFrame = byId('numpad_frame');

    el.modalOverlay = byId('modal_overlay');
    el.modalIcon = byId('modal_icon');
    el.modalTitle = byId('modal_title');
    el.modalText = byId('modal_text');
    el.modalOk = byId('modal_ok');
  }

  /* ------------------------------------------------------------------ *
   * messagebox replacement (showinfo / showerror)
   * ------------------------------------------------------------------ */
  var modalCloseHandler = null;

  function showMessage(kind, title, text) {
    el.modalIcon.className = 'modal-icon ' + (kind === 'error' ? 'error' : 'info');
    el.modalIcon.textContent = kind === 'error' ? '!' : 'i';
    el.modalTitle.textContent = title;
    el.modalText.textContent = text;
    el.modalOverlay.classList.add('is-open');
    el.modalOk.focus();
  }

  function closeMessage() {
    if (!el.modalOverlay.classList.contains('is-open')) return;
    el.modalOverlay.classList.remove('is-open');
    if (typeof modalCloseHandler === 'function') {
      var cb = modalCloseHandler;
      modalCloseHandler = null;
      cb();
    }
  }

  /* ------------------------------------------------------------------ *
   * Fraction rendering helpers
   * ------------------------------------------------------------------ */

  /**
   * Show a (possibly improper) fraction as "whole num/den", hiding the
   * whole part when it is zero and hiding the fraction part when the
   * remainder is zero -- exactly like pack()/pack_forget() did.
   */
  function renderFraction(group, wholeEl, innerEl, numEl, denEl, frac) {
    var dm = pyDivMod(frac.n, frac.d);
    var whole = dm[0];
    var remainder = dm[1];

    if (whole !== 0n) {
      wholeEl.textContent = whole.toString();
      group.classList.remove('no-whole');
    } else {
      wholeEl.textContent = '';
      group.classList.add('no-whole');
    }

    if (remainder !== 0n) {
      numEl.textContent = remainder.toString();
      denEl.textContent = frac.d.toString();
      group.classList.remove('no-frac');
    } else {
      group.classList.add('no-frac');
    }
  }

  /* ------------------------------------------------------------------ *
   * generate_example()
   * ------------------------------------------------------------------ */

  function randInt(minInclusive, maxInclusive) {
    return minInclusive + Math.floor(Math.random() * (maxInclusive - minInclusive + 1));
  }

  function generateExample() {
    var den1 = randInt(2, 9);
    var num1 = randInt(den1 + 1, den1 * 4);
    var frac1 = new Fraction(num1, den1);

    var den2 = randInt(2, 9);
    var num2 = randInt(den2 + 1, den2 * 4);
    var frac2 = new Fraction(num2, den2);

    var op = Math.random() < 0.5 ? '+' : '-';

    var correct;
    if (op === '+') {
      correct = frac1.add(frac2);
    } else {
      if (frac1.lt(frac2)) {
        var tmp = frac1;
        frac1 = frac2;
        frac2 = tmp;
      }
      correct = frac1.sub(frac2);
    }

    renderExample(frac1, frac2, op, correct);
  }

  /**
   * Draw a given example (fractions are always improper, as produced by
   * generate_example). Kept separate so it can be replayed in tests.
   */
  function renderExample(frac1, frac2, operation, correctAnswer) {
    state.operation = operation;
    state.fraction1 = frac1;
    state.fraction2 = frac2;
    state.correctAnswer = correctAnswer;

    el.lblOp.textContent = operation;
    el.lblOp.style.color = '#4a90e2';

    renderFraction(el.frac1Frame, el.lbl1Whole, el.frac1Inner, el.lbl1Num, el.lbl1Den, frac1);
    renderFraction(el.frac2Frame, el.lbl2Whole, el.frac2Inner, el.lbl2Num, el.lbl2Den, frac2);

    updateScoreLabel();
  }

  function updateScoreLabel() {
    el.labelScore.textContent = 'Счёт: ' + state.score + ' / ' + state.total;
  }

  /* ------------------------------------------------------------------ *
   * on_format_change()
   * ------------------------------------------------------------------ */

  var PLACEHOLDERS = {
    mixed: 'Например: 3 1/2',
    improper: 'Например: 7/2',
    decimal: 'Например: 3.5',
    common: 'Например: 1/2',
    natural: 'Например: 5'
  };

  function onFormatChange(choice) {
    state.answerFormat = choice;
    el.entryAnswer.placeholder = PLACEHOLDERS[choice] || 'Введите ответ...';
  }

  /* ------------------------------------------------------------------ *
   * Focus handling
   * ------------------------------------------------------------------ */

  function setActiveField(field) {
    state.activeTarget = field === 'draft' ? 'draft' : 'answer';
  }

  function clearDraft() {
    el.draftText.value = '';
  }

  /* ------------------------------------------------------------------ *
   * numpad_action()
   * ------------------------------------------------------------------ */

  function numpadAction(action) {
    if (state.activeTarget === 'draft') {
      var ta = el.draftText;
      if (action === 'CE') {
        ta.value = '';
      } else if (action === 'back') {
        if (ta.value.length > 0) {
          ta.value = ta.value.slice(0, -1);
        }
      } else if (action === ' ') {
        ta.value += ' ';
      } else {
        ta.value += action;
      }
      ta.focus();
      ta.scrollTop = ta.scrollHeight;
      return;
    }

    var input = el.entryAnswer;
    var current = input.value;

    if (/^[0-9]$/.test(action) || action === '+' || action === '-' ||
        action === '*' || action === '/' || action === '.') {
      input.value = current + action;
    } else if (action === 'CE') {
      input.value = '';
    } else if (action === 'back') {
      if (current.length > 0) {
        input.value = current.slice(0, -1);
      }
    } else if (action === ' ') {
      /* ignored for the answer field, same as the original */
    } else {
      input.value = current + action;
    }
  }

  /* ------------------------------------------------------------------ *
   * check_answer()
   * ------------------------------------------------------------------ */

  function checkAnswer() {
    if (el.modalOverlay.classList.contains('is-open')) return;

    var userText = el.entryAnswer.value;
    var userFraction = parseUserInput(state.answerFormat, userText);

    if (userFraction === null) {
      showMessage('error', 'Ошибка', 'Неверный формат ответа!');
      return;
    }

    state.total += 1;

    if (userFraction.eq(state.correctAnswer)) {
      state.score += 1;
      showMessage('info', 'Верно!', 'Ответ правильный!');
    } else {
      var correctStr = formatAnswer(state.answerFormat, state.correctAnswer);
      showMessage('error', 'Ошибка', 'Неверно. Правильный ответ: ' + correctStr);
    }

    updateScoreLabel();
    el.entryAnswer.value = '';
    generateExample();
    el.entryAnswer.focus();
  }

  /* ------------------------------------------------------------------ *
   * Numpad construction
   * ------------------------------------------------------------------ */

  var NUMPAD_BUTTONS = [
    ['1', '2', '3', '4', '5', '6'],
    ['7', '8', '9', '-', '+', '/'],
    ['0', 'CE', '⌫', '*', '=', ' '],
    ['x', 'y', 'z', '', '', '']
  ];

  function makeNumpadButton(label, char) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.dataset.key = char;
    btn.setAttribute('aria-label', char === ' ' ? 'пробел' : char);

    if (char === 'CE') {
      btn.textContent = 'CE';
      btn.classList.add('btn-ce');
      btn.addEventListener('click', function () { numpadAction('CE'); });
    } else if (char === '⌫') {
      btn.textContent = '⌫';
      btn.classList.add('btn-back');
      btn.addEventListener('click', function () { numpadAction('back'); });
    } else if (char === '=') {
      btn.textContent = '=';
      btn.classList.add('btn-eq');
      btn.addEventListener('click', function () { checkAnswer(); });
    } else if (char === ' ') {
      btn.textContent = '␣';
      btn.classList.add('btn-space');
      btn.addEventListener('click', function () { numpadAction(' '); });
    } else {
      btn.textContent = char;
      btn.addEventListener('click', function () { numpadAction(char); });
    }

    btn.style.gridRow = label.row;
    btn.style.gridColumn = label.col;
    return btn;
  }

  function buildNumpad() {
    var fragment = document.createDocumentFragment();
    for (var r = 0; r < NUMPAD_BUTTONS.length; r++) {
      var row = NUMPAD_BUTTONS[r];
      for (var c = 0; c < row.length; c++) {
        var char = row[c];
        if (char === '') continue;
        fragment.appendChild(makeNumpadButton({ row: r + 1, col: c + 1 }, char));
      }
    }
    el.numpadFrame.appendChild(fragment);
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */

  function bindEvents() {
    el.formatMenu.addEventListener('change', function () {
      onFormatChange(el.formatMenu.value);
    });

    el.entryAnswer.addEventListener('focus', function () { setActiveField('answer'); });
    el.entryAnswer.addEventListener('click', function () { setActiveField('answer'); });
    el.entryAnswer.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        checkAnswer();
      }
    });

    el.draftText.addEventListener('focus', function () { setActiveField('draft'); });
    el.draftText.addEventListener('click', function () { setActiveField('draft'); });

    el.btnCheck.addEventListener('click', checkAnswer);
    el.btnClearDraft.addEventListener('click', clearDraft);

    el.modalOk.addEventListener('click', closeMessage);
    el.modalOverlay.addEventListener('click', function (ev) {
      if (ev.target === el.modalOverlay) closeMessage();
    });
    document.addEventListener('keydown', function (ev) {
      if (el.modalOverlay.classList.contains('is-open') &&
          (ev.key === 'Enter' || ev.key === 'Escape')) {
        ev.preventDefault();
        closeMessage();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Bootstrap
   * ------------------------------------------------------------------ */

  function init() {
    cacheElements();
    bindEvents();
    buildNumpad();
    onFormatChange('mixed');
    el.formatMenu.value = 'mixed';
    state.fraction1 = null;
    state.fraction2 = null;
    state.correctAnswer = null;
    generateExample();
    el.entryAnswer.focus();
  }

  document.addEventListener('DOMContentLoaded', init);

  /* Exposed for automated tests and for embedding the app elsewhere */
  window.MixedFractionApp = {
    state: state,
    generateExample: generateExample,
    renderExample: renderExample,
    checkAnswer: checkAnswer,
    formatAnswer: formatAnswer,
    parseUserInput: parseUserInput,
    numpadAction: numpadAction,
    onFormatChange: onFormatChange,
    showMessage: showMessage
  };
})();
