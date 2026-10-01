import { describe, expect, it } from 'vitest';
import * as engine from './index';

describe('point d\'entrée du moteur', () => {
  it('exporte les fonctions du moteur', () => {
    expect(typeof engine.judge).toBe('function');
    expect(typeof engine.applyAnswer).toBe('function');
    expect(typeof engine.replayEvents).toBe('function');
    expect(typeof engine.pickSessionCards).toBe('function');
    expect(typeof engine.proposeRemediation).toBe('function');
    expect(typeof engine.buildWheel).toBe('function');
  });

  it('n\'embarque pas l\'importeur', () => {
    expect('readWorkbook' in engine).toBe(false);
  });
});
