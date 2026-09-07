/* Local SQL/Jinja highlighting and copying for portable documentation. */
(() => {
  'use strict';
  const keywords = new Set(('select from where as and or not null is in exists between like ilike case when then else end distinct all join inner left right full outer cross on using union intersect except with recursive group by having order asc desc limit offset fetch first rows only over partition qualify window create replace temporary temp table view materialized insert into values update set delete merge matched truncate alter drop database schema cast try_cast interval current_date current_timestamp true false nulls last lateral unnest pivot unpivot return returns begin commit rollback grant revoke').split(' '));
  const word = /[A-Za-z_][A-Za-z_0-9$]*/y;
  const number = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  const dollar = /\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/y;
  let sequence = 0;

  function quotedEnd(text, start, quote) {
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === quote) {
        if (text[i + 1] === quote) { i++; continue; }
        return i + 1;
      }
    }
    return text.length;
  }

  function jinjaEnd(text, start) {
    const close = text[start + 1] === '{' ? '}}' : text[start + 1] === '%' ? '%}' : '#}';
    for (let i = start + 2; i < text.length; i++) {
      if (text.slice(i, i + 2) === close) return i + 2;
      if (close !== '#}' && (text[i] === '"' || text[i] === "'")) i = quotedEnd(text, i, text[i]) - 1;
    }
    return text.length;
  }

  function highlight(value) {
    const text = String(value == null ? '' : value);
    const fragment = document.createDocumentFragment();
    let i = 0, plain = '';
    const flush = () => { if (plain) { fragment.append(document.createTextNode(plain)); plain = ''; } };
    while (i < text.length) {
      const start = i, pair = text.slice(i, i + 2);
      let kind = '', match;
      if (pair === '{{' || pair === '{%' || pair === '{#') { kind = 'jinja'; i = jinjaEnd(text, i); }
      else if (pair === '--') { kind = 'comment'; const end = text.indexOf('\n', i + 2); i = end < 0 ? text.length : end; }
      else if (pair === '/*') { kind = 'comment'; const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; }
      else if (text[i] === "'" || text[i] === '"' || text[i] === '`') { kind = 'string'; i = quotedEnd(text, i, text[i]); }
      else {
        dollar.lastIndex = word.lastIndex = number.lastIndex = i;
        if ((match = dollar.exec(text))) {
          kind = 'string'; const end = text.indexOf(match[0], i + match[0].length); i = end < 0 ? text.length : end + match[0].length;
        } else if ((match = word.exec(text))) {
          i += match[0].length;
          kind = keywords.has(match[0].toLowerCase()) ? 'keyword' : /^\s*\(/.test(text.slice(i)) ? 'function' : '';
        } else if ((match = number.exec(text))) { kind = 'number'; i += match[0].length; }
        else i++;
      }
      const token = text.slice(start, i);
      if (kind) {
        flush(); const span = document.createElement('span'); span.className = 'token-' + kind; span.textContent = token; fragment.append(span);
      } else plain += token;
    }
    flush(); return fragment;
  }

  function fallbackCopy(text) {
    const previous = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text; field.readOnly = true;
    field.setAttribute('aria-label', 'Temporary SQL clipboard selection');
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(field);
    try {
      field.focus({ preventScroll: true }); field.select();
      return typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch { return false; }
    finally { field.remove(); if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true }); }
  }

  function create(source, compiled) {
    const section = document.createElement('section'); section.className = 'doc-code';
    const heading = document.createElement('h3'); heading.textContent = 'SQL';
    const tabs = document.createElement('div'); tabs.className = 'doc-code-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'SQL version');
    const content = document.createElement('div'); content.className = 'doc-code-content';
    const pre = document.createElement('pre'); pre.id = 'doc-code-' + sequence++; pre.setAttribute('role', 'tabpanel'); pre.tabIndex = 0;
    const code = document.createElement('code'); pre.append(code);
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'doc-code-copy'; copy.title = 'Copy SQL'; copy.setAttribute('aria-label', 'Copy SQL');
    const ns = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(ns, 'svg'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('width', '18'); icon.setAttribute('height', '18'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '1.7'); icon.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(ns, 'path'); shape.setAttribute('d', 'M9 9h11v11H9z M15 9V4H4v11h5'); icon.append(shape); copy.append(icon);
    const status = document.createElement('span'); status.className = 'doc-code-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const versions = [['Source', source], ['Compiled', compiled]].filter(([, text]) => text != null && String(text).length).map(([label, text]) => ({ label, text: String(text) }));
    let active = '', revision = 0;
    const controls = [];
    const select = index => {
      active = versions[index].text; revision++;
      code.replaceChildren(highlight(active)); status.textContent = ''; status.removeAttribute('data-state');
      controls.forEach((control, i) => { control.setAttribute('aria-selected', String(i === index)); control.tabIndex = i === index ? 0 : -1; });
      pre.setAttribute('aria-labelledby', controls[index].id);
    };
    versions.forEach((version, index) => {
      const tab = document.createElement('button'); tab.type = 'button'; tab.textContent = version.label;
      tab.id = pre.id + '-tab-' + index; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', pre.id);
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowRight') target = (index + 1) % versions.length;
        else if (event.key === 'ArrowLeft') target = (index + versions.length - 1) % versions.length;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = versions.length - 1;
        else return;
        event.preventDefault(); select(target); controls[target].focus();
      });
      controls.push(tab); tabs.append(tab);
    });
    if (versions.length) select(0);
    copy.disabled = versions.length === 0;
    copy.addEventListener('click', async () => {
      if (copy.disabled) return;
      const value = active, clickedRevision = revision, previousFocus = document.activeElement;
      copy.disabled = true; status.textContent = ''; status.removeAttribute('data-state');
      let copied = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') { await navigator.clipboard.writeText(value); copied = true; }
      } catch { /* Local file and browser permissions may require the fallback. */ }
      if (!copied) copied = fallbackCopy(value);
      if (revision === clickedRevision) {
        status.textContent = copied ? 'Copied' : 'Copy failed. Select the SQL and copy it manually.';
        status.setAttribute('data-state', copied ? 'success' : 'error');
      }
      copy.disabled = false;
      if (previousFocus === copy) copy.focus({ preventScroll: true });
    });
    content.append(copy, pre, status); section.append(heading, tabs, content);
    return section;
  }

  window.BNRDocumentationCode = { create, highlight };
})();
