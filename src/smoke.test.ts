import { describe, expect, it } from 'vitest';
import { SIP_COUNT } from './experience';

describe('six-sip contract', () => {
  it('exports six as the only ritual stage count', () => {
    expect(SIP_COUNT).toBe(6);
  });
});
