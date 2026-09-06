/* Admin panel: collapse/expand list items and preview a chosen image. */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-disclose]');
    if (!toggle) return;
    var item = toggle.closest('.item');
    if (!item) return;
    var open = item.classList.toggle('open');
    toggle.textContent = open ? 'Close' : 'Edit';
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Show the picked file straight away rather than after a save.
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (input.type !== 'file' || !input.files || !input.files[0]) return;
    var preview = input.closest('.media-row') && input.closest('.media-row').querySelector('.media-preview');
    if (!preview) return;
    var url = URL.createObjectURL(input.files[0]);
    preview.src = url;
    preview.addEventListener('load', function () { URL.revokeObjectURL(url); }, { once: true });
  });

  // Deletes are irreversible, so make them deliberate.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.hasAttribute('data-confirm')) return;
    if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
  });

  /* ------------------------------------------------------ chip inputs
     Progressive enhancement over a plain textarea: the textarea keeps
     the value (one per line) and stays the thing that submits, so with
     JavaScript off the field still works exactly as before. */

  function initChips(field) {
    var textarea = field.querySelector('textarea');
    if (!textarea) return;

    var box = document.createElement('div');
    box.className = 'chips';

    var entry = document.createElement('input');
    entry.type = 'text';
    entry.className = 'chip-entry';
    entry.placeholder = field.getAttribute('data-chip-placeholder') || 'Type and press Enter';
    entry.setAttribute('aria-label', 'Add an item');

    var values = textarea.value.split(/\r?\n/).map(function (v) { return v.trim(); }).filter(Boolean);

    function sync() {
      textarea.value = values.join('\n');
    }

    function paint() {
      box.querySelectorAll('.chip').forEach(function (el) { el.remove(); });
      values.forEach(function (value, i) {
        var chip = document.createElement('span');
        chip.className = 'chip';

        var text = document.createElement('span');
        text.textContent = value;

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'chip-x';
        remove.innerHTML = '&times;';
        remove.setAttribute('aria-label', 'Remove ' + value);
        remove.addEventListener('click', function () {
          values.splice(i, 1);
          sync();
          paint();
          entry.focus();
        });

        chip.append(text, remove);
        box.insertBefore(chip, entry);
      });
    }

    function add(raw) {
      // A comma-separated paste becomes several chips at once.
      raw.split(',').map(function (v) { return v.trim(); }).filter(Boolean).forEach(function (value) {
        if (values.indexOf(value) === -1) values.push(value);
      });
      entry.value = '';
      sync();
      paint();
    }

    entry.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (entry.value.trim()) add(entry.value);
      } else if (e.key === 'Backspace' && !entry.value && values.length) {
        values.pop();
        sync();
        paint();
      }
    });
    // Losing focus should not silently discard what was typed.
    entry.addEventListener('blur', function () { if (entry.value.trim()) add(entry.value); });

    box.appendChild(entry);
    box.addEventListener('click', function (e) { if (e.target === box) entry.focus(); });

    textarea.hidden = true;
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;
    field.insertBefore(box, textarea);
    paint();
  }

  document.querySelectorAll('[data-chips]').forEach(initChips);

  /* ---------------------------------------------------- add-item forms
     The "add" card stays collapsed until it is needed. */
  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-add-toggle]');
    if (!toggle) return;
    var panel = document.getElementById(toggle.getAttribute('data-add-toggle'));
    if (!panel) return;
    var open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      var first = panel.querySelector('input:not([type=hidden]), textarea');
      if (first) first.focus();
    }
  });
})();
