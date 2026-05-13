'use strict';

/**
 * Generic site adapter
 * Works on any standard HTML form via FieldMatcher scoring
 */
const GenericAdapter = {
  name: 'generic',
  priority: 0,

  matches() {
    return true; // fallback — always applies
  },

  _cssEscapeIdent(s) {
    if (s == null || s === '') return s;
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(s));
    return String(s).replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
  },

  /**
   * 以前はページ MAIN の jQuery 同期のためにインライン script を注入していたが、
   * Axol 等の CSP（script-src で unsafe-inline 禁止）によりブロックされコンソールが埋まる。
   * 同一 DOM に対するネイティブ value + dispatch でページ側リスナに届くため注入は行わない。
   */

  /**
   * Fill a single element with a value, dispatching all necessary events
   * so that React/Vue/Angular-based forms recognize the change.
   */
  fillElement(el, value) {
    if (!el) return false;

    const tag = el.tagName.toLowerCase();

    if (tag === 'select') {
      return this._fillSelect(el, value);
    }
    if (el.type === 'radio') {
      return this._fillRadio(el, value);
    }
    if (el.type === 'checkbox') {
      const truthy =
        value === true ||
        value === 1 ||
        String(value).toLowerCase() === 'true' ||
        String(value).toLowerCase() === 'on' ||
        String(value) === '1';
      el.checked = truthy;
      this._dispatchEvents(el, ['change']);
      return true;
    }
    // text / email / tel / textarea
    return this._fillText(el, value);
  },

  _fillText(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set ||
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }
    this._dispatchEvents(el, ['focus', 'input', 'keydown', 'keyup', 'change', 'blur']);
    return true;
  },

  _fillSelect(el, value) {
    const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '');
    const options = Array.from(el.options);
    const normValue = normalize(value);

    // 1. Exact value match
    let opt = options.find((o) => normalize(o.value) === normValue);
    // 2. Exact text match
    if (!opt) opt = options.find((o) => normalize(o.text) === normValue);
    // 3. Partial text match
    if (!opt) opt = options.find((o) => normalize(o.text).includes(normValue) || normValue.includes(normalize(o.text)));
    // 4. Numeric match (for year/month/day)
    if (!opt) {
      const numVal = parseInt(value, 10);
      if (!isNaN(numVal)) {
        opt = options.find((o) => parseInt(o.value, 10) === numVal || parseInt(o.text, 10) === numVal);
      }
    }

    if (opt) {
      el.value = opt.value;
      this._dispatchEvents(el, ['focus', 'input', 'change', 'blur']);
      return true;
    }
    return false;
  },

  _fillRadio(el, value) {
    const name = el.name;
    if (!name) return false;
    const radios = document.querySelectorAll(`input[type=radio][name="${CSS.escape(name)}"]`);
    const normalize = (s) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');

    const normVal = normalize(value);

    const labelForRadio = (radio) => {
      if (radio.id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
        if (byFor) return byFor.textContent || '';
      }
      const wrap = radio.closest('label');
      if (wrap) return wrap.textContent || '';
      return '';
    };

    for (const radio of radios) {
      const labelRaw = labelForRadio(radio);
      const labelText = normalize(labelRaw.replace(/\u3000/g, ' '));
      const radioValue = normalize(radio.value);

      let match =
        (radioValue && radioValue === normVal) ||
        (labelText && labelText === normVal);
      if (!match && normVal) {
        if (
          radioValue &&
          (radioValue.includes(normVal) || normVal.includes(radioValue))
        ) {
          match = true;
        }
        if (
          !match &&
          labelText &&
          (labelText.includes(normVal) || normVal.includes(labelText))
        ) {
          match = true;
        }
      }

      if (match) {
        radio.checked = true;
        this._dispatchEvents(radio, ['focus', 'change', 'blur']);
        return true;
      }
    }
    return false;
  },

  _dispatchEvents(el, types) {
    for (const type of types) {
      el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      // Also dispatch InputEvent for React synthetic events
      if (type === 'input') {
        try {
          el.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertReplacementText',
              data: el.value,
            })
          );
        } catch (_) {}
      }
    }
  },
};

if (typeof window !== 'undefined') {
  window.GenericAdapter = GenericAdapter;
}
