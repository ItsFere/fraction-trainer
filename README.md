# Математический Тренажер: Дроби — JavaScript port

A complete JavaScript (browser) port of the Python / CustomTkinter desktop
application `MixedFractionApp`.  Same layout, same colours, same behaviour,
same Russian UI strings — no Python, no Tk, no build step.

## Files

| file           | contents                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `index.html`   | page structure (left panel with the task, entry card, numpad, right draft panel, message box) |
| `style.css`    | dark theme (`#0a1628` / `#122244` / `#1e3a5f` / `#4a90e2`) reproducing the CustomTkinter "dark + blue" look, incl. responsive layout |
| `fractions.js` | exact rational arithmetic — a faithful port of Python's `fractions.Fraction`: `+`, `-`, comparison, `limit_denominator`, float→fraction conversion, `f"{x:.2f}"` formatting, and the input parsers |
| `app.js`       | the application itself (`MixedFractionApp` equivalent): state, `generate_example`, `format_answer`, `parse_user_input`, `check_answer`, `numpad_action`, `on_format_change`, draft handling, message boxes |

## Running

Any static server works (ES modules are *not* used, plain `<script>` tags):

```bash
cd app
python3 -m http.server 3000
# open http://localhost:3000/
```

Opening `index.html` directly from the file system works as well.

## Behaviour preserved from the Python original

* Example = two improper fractions with denominators 2–9 and numerators
  between `den+1` and `den*4`, random `+` / `-`; for `-` the larger fraction is
  shown first so the result is never negative.
* Fractions are rendered as "whole  num/den" with the whole part hidden when it
  is zero and the fractional part hidden when the remainder is zero
  (equivalent of `pack()` / `pack_forget()`).
* Five answer formats: mixed, improper, decimal, common, natural — with the same
  placeholders on the format menu.
* Answer parsing is byte-for-byte compatible with the original (see below),
  including negative mixed numbers, `int()` digit separators (`1_0`), Unicode
  digits (`١٢٣`, `１２３`) and `float()` syntax (`1e3`, `.5`, `Infinity`…).
* Numpad: digits / `- + * / .` append to the *focused* field (answer or draft),
  `CE` clears, `⌫` deletes, `=` checks the answer, `␣` is only meaningful in the
  draft, `x` `y` `z` type letters into the focused field.
* Score counting, the "Верно!" / "Ошибка" / "Неверный формат ответа!" messages
  and the automatic next example after every submission.

## Deliberate improvements

1. `messagebox` became an in-page modal dialog (no native dialogs available).
2. Two inputs that made the Python program **crash** now behave sanely:
   * `1/0`, `-8/0` in *mixed* mode — Python raised an uncaught
     `ZeroDivisionError` (the `except ValueError` did not catch it);
     the port shows "Неверный формат ответа!" and does not count the attempt.
   * `Infinity` / `nan` in *decimal* mode — Python raised `OverflowError`;
     the port reports a format error instead.
3. Accessibility: the coloured numpad keys use darker shades of the original
   colours so white labels reach WCAG AA contrast (4.5:1), and the modal has
   proper `role="dialog"` / labels.  All original hues are preserved.
4. The layout adapts to narrow screens (the desktop window was fixed 1100×550
   and clipped its own numpad).

## Verification performed

The port was checked against the **original Python code running unmodified**
(only `tkinter`/`customtkinter` stubbed for the logic tests, and a real Xvfb
display for the GUI tests):

* 10 310 comparisons of `format_answer()` (8 550) and `parse_user_input()`
  (1 760) over negatives, improper/mixed values, decimal rounding ties
  (`1/8 → 0.12` half-even, `0.135`, `2.675`, …) and ~100 hand-picked malformed
  inputs: **all identical**, apart from the 3 inputs on which the original
  raises an uncaught exception (cases 2 above).
* 25 randomly generated examples captured from the *real tkinter widgets*
  (label texts + `winfo_ismapped()` of whole/fraction parts) replayed in the
  browser: 0 mismatches in rendering, 0 mismatches in all 5 answer formats.
* 10 `check_answer()` runs (correct / wrong / malformed across formats)
  replayed with identical state: 0 mismatches in message text, score, input
  clearing and score label.
