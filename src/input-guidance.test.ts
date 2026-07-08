// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyLang } from './i18n';

class FakeStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  clear(): void {
    this.data.clear();
  }
}

describe('memory input guidance', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: new FakeStorage(),
    });
    localStorage.clear();
  });

  it('renders a visible minimum-length note near the input controls', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('id="input-requirement"');
    expect(html).toContain('data-i18n="inputRequirement"');
    expect(html).toContain('Minimum 30 characters');
  });

  it('localizes the minimum-length note', () => {
    document.body.innerHTML = '<span data-i18n="inputRequirement"></span>';

    applyLang('en');
    expect(document.body.textContent).toContain('Minimum 30 characters');

    applyLang('zh');
    expect(document.body.textContent).toContain('至少写 30 个字符');
  });
});
