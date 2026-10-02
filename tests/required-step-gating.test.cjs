const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// Minimal DOM fixture: exercise the production event handlers without dependencies.
// Native browser/file-picker behavior still needs a browser smoke test.
function fixture() {
  function element(classes = []) {
    const values = new Set(classes);
    const listeners = {};
    return {
      value: '', files: [], dataset: {}, textContent: '',
      classList: {
        add: value => values.add(value),
        remove: value => values.delete(value),
        contains: value => values.has(value),
        toggle(value, force) {
          if (force) values.add(value);
          else values.delete(value);
        }
      },
      focus() { this.focused = true; },
      addEventListener(type, handler) { listeners[type] = handler; },
      fire(type) { listeners[type]({ preventDefault() {} }); }
    };
  }

  const names = [
    ['fullName', 'businessName', 'address'],
    ['requestType', 'equipmentType'],
    ['operatingStatus', 'reason', 'exactFit'],
    [],
    ['photos'],
    ['goal'],
    []
  ];
  const fields = Object.fromEntries(
    [...names.flat(), 'phone', 'email'].map(name => [name, element()])
  );
  const sections = names.map((required, index) => ({
    ...element(),
    dataset: { step: String(index + 1) },
    querySelectorAll: () => required.map(name => fields[name])
  }));
  const buttons = sections.map(section => ({
    ...element(), dataset: section.dataset
  }));
  const ids = Object.fromEntries([
    'prevBtn', 'nextBtn', 'submitBtn', 'quote-form', 'confirmation',
    'form-error', 'dynamic-questions', 'toggleInternalBtn', 'technician-panel'
  ].map(id => [id, element()]));
  ids.confirmation.classList.add('hidden');
  ids['form-error'].classList.add('hidden');
  ids.equipmentType = fields.equipmentType;
  ids['quote-form'].querySelector = selector => {
    if (selector === '#photos') return fields.photos;
    return fields[selector.match(/name="([^"]+)"/)[1]];
  };
  vm.runInNewContext(source, {
    document: {
      querySelectorAll: selector => selector === '.form-step' ? sections : buttons,
      getElementById: id => ids[id]
    }
  });
  return {
    fields, ids,
    click: step => buttons[step - 1].fire('click'),
    next: () => ids.nextBtn.fire('click'),
    back: () => ids.prevBtn.fire('click'),
    submit: () => ids['quote-form'].fire('submit'),
    active: () => sections.findIndex(s => s.classList.contains('is-active')) + 1,
    fillThrough(step) {
      names.slice(0, step).flat().forEach(name => {
        fields[name].value = name === 'photos' ? 'C:\\fakepath\\photo.jpg' : 'valid';
      });
      fields.phone.value = '555-123-4567';
      if (step >= 5) fields.photos.files = [{}];
    }
  };
}

function blocked(f, step) {
  assert.equal(f.active(), step);
  assert.equal(f.ids['form-error'].classList.contains('hidden'), false);
  assert.equal(f.ids.confirmation.classList.contains('hidden'), true);
  assert.equal(f.ids['quote-form'].classList.contains('hidden'), false);
}

test('contact-only 1 -> 7 jump stops at Equipment', () => {
  const f = fixture();
  f.fillThrough(1);
  f.click(7);
  blocked(f, 2);
  assert.equal(f.fields.requestType.focused, true);
});

for (const [step, names] of [
  [2, ['requestType', 'equipmentType']],
  [3, ['operatingStatus', 'reason', 'exactFit']],
  [6, ['goal']]
]) {
  for (const name of names) {
    test('forward jump rejects missing ' + name, () => {
      const f = fixture();
      f.fillThrough(7);
      f.fields[name].value = '';
      f.click(7);
      blocked(f, step);
      assert.equal(f.fields[name].focused, true);
    });
  }
}

test('missing photo blocks a jump; real file list is required', () => {
  const f = fixture();
  f.fillThrough(7);
  f.fields.photos.files = [];
  f.click(7);
  blocked(f, 5);
});

test('Next cannot leave Photos without a photo', () => {
  const f = fixture();
  f.fillThrough(4);
  f.click(5);
  f.next();
  blocked(f, 5);
});

test('both contact methods missing blocks navigation', () => {
  const f = fixture();
  f.fillThrough(1);
  f.fields.phone.value = '  ';
  f.click(7);
  blocked(f, 1);
});

test('email alone satisfies the contact-method requirement', () => {
  const f = fixture();
  f.fillThrough(1);
  f.fields.phone.value = '';
  f.fields.email.value = 'customer@example.com';
  f.next();
  assert.equal(f.active(), 2);
});

test('optional Utilities fields do not block a valid forward jump', () => {
  const f = fixture();
  f.fillThrough(7);
  f.click(7);
  assert.equal(f.active(), 7);
});

test('Back and earlier step clicks remain unrestricted', () => {
  const f = fixture();
  f.fillThrough(7);
  f.click(7);
  f.fields.goal.value = '';
  f.back();
  assert.equal(f.active(), 6);
  f.click(2);
  assert.equal(f.active(), 2);
});

for (const name of ['equipmentType', 'photos']) {
  test('cleared prerequisite is revalidated by Next: ' + name, () => {
    const f = fixture();
    f.fillThrough(7);
    f.click(7);
    f.back();
    f.fields[name].value = '';
    if (name === 'photos') f.fields.photos.files = [];
    f.next();
    blocked(f, name === 'photos' ? 5 : 2);
  });

  test('submission rejects cleared prerequisite: ' + name, () => {
    const f = fixture();
    f.fillThrough(7);
    f.click(7);
    f.fields[name].value = '';
    if (name === 'photos') f.fields.photos.files = [];
    f.submit();
    blocked(f, name === 'photos' ? 5 : 2);
  });
}

test('direct submit cannot bypass intermediate requirements', () => {
  const f = fixture();
  f.fillThrough(1);
  f.submit();
  blocked(f, 2);
});

test('complete replacement intake submits successfully', () => {
  const f = fixture();
  f.fillThrough(7);
  f.click(7);
  f.submit();
  assert.equal(f.ids['quote-form'].classList.contains('hidden'), true);
  assert.equal(f.ids.confirmation.classList.contains('hidden'), false);
  assert.equal(f.ids['form-error'].classList.contains('hidden'), true);
});
