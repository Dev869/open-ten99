import { describe, it, expect } from 'vitest';
import { scoreAmount, scoreDate, scoreName, computeMatchScore } from './matching';

describe('scoreAmount', () => {
  it('returns 1.0 for exact match', () => {
    expect(scoreAmount(1500, 1500)).toBe(1.0);
  });
  it('returns 0.8 for within 2%', () => {
    expect(scoreAmount(1500, 1520)).toBe(0.8);
  });
  it('returns 0.5 for within 5%', () => {
    expect(scoreAmount(1500, 1560)).toBe(0.5);
  });
  it('returns 0 for >5% difference', () => {
    expect(scoreAmount(1500, 1700)).toBe(0);
  });
  it('handles negative amounts (absolute comparison)', () => {
    expect(scoreAmount(1500, -1500)).toBe(1.0);
  });
});

describe('scoreDate', () => {
  it('returns 1.0 for same day', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-15'))).toBe(1.0);
  });
  it('returns 0.8 for within 3 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-17'))).toBe(0.8);
  });
  it('returns 0.5 for within 7 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-21'))).toBe(0.5);
  });
  it('returns 0.2 for within 14 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-03-28'))).toBe(0.2);
  });
  it('returns 0 for >14 days', () => {
    expect(scoreDate(new Date('2026-03-15'), new Date('2026-04-15'))).toBe(0);
  });
});

describe('scoreName', () => {
  it('returns 1.0 for exact substring match', () => {
    expect(scoreName('ACH DEPOSIT ACME CORP', 'Acme Corp')).toBe(1.0);
  });
  it('returns 0.7 for high similarity', () => {
    const score = scoreName('ACME CORPORATION', 'Acme Corp');
    expect(score).toBeGreaterThanOrEqual(0.7);
  });
  it('returns 0 for no match', () => {
    expect(scoreName('WALMART GROCERY', 'Acme Corp')).toBe(0);
  });
});

describe('computeMatchScore', () => {
  it('returns >0.7 for strong match', () => {
    const score = computeMatchScore(
      { amount: 2400, date: new Date('2026-03-15'), description: 'ACH DEPOSIT ACME CORP' },
      { totalCost: 2400, invoiceSentDate: new Date('2026-03-10'), clientName: 'Acme Corp' }
    );
    expect(score).toBeGreaterThan(0.7);
  });
  it('returns <0.7 for weak match', () => {
    const score = computeMatchScore(
      { amount: 500, date: new Date('2026-03-15'), description: 'WALMART' },
      { totalCost: 2400, invoiceSentDate: new Date('2026-01-01'), clientName: 'Acme Corp' }
    );
    expect(score).toBeLessThan(0.7);
  });
});
