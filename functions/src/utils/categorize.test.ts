import { describe, it, expect } from 'vitest';
import { categorizeTransaction, classifyTransactionType } from './categorize';

describe('categorizeTransaction', () => {
  describe('Layer 1: Plaid category mapping', () => {
    it('maps FOOD_AND_DRINK to Meals & Entertainment', () => {
      expect(categorizeTransaction('FOOD_AND_DRINK', 'CHIPOTLE MEXICAN GRILL')).toBe('Meals & Entertainment');
    });
    it('maps TRAVEL to Travel', () => {
      expect(categorizeTransaction('TRAVEL', 'DELTA AIRLINES')).toBe('Travel');
    });
    it('maps UTILITIES to Utilities & Telecom', () => {
      expect(categorizeTransaction('UTILITIES', 'CONEDISON')).toBe('Utilities & Telecom');
    });
    it('maps EDUCATION to Education & Training', () => {
      expect(categorizeTransaction('EDUCATION', 'UDEMY')).toBe('Education & Training');
    });
    it('skips unmapped Plaid categories and falls through to keywords', () => {
      // TRANSFER maps to Uncategorized in Plaid map, so it falls through
      expect(categorizeTransaction('TRANSFER', 'ADOBE CREATIVE CLOUD')).toBe('Software & Subscriptions');
    });
  });

  describe('Layer 2: Keyword matching', () => {
    it('matches Adobe to Software & Subscriptions', () => {
      expect(categorizeTransaction(null, 'ADOBE CREATIVE CLOUD')).toBe('Software & Subscriptions');
    });
    it('matches GitHub to Software & Subscriptions', () => {
      expect(categorizeTransaction(null, 'GITHUB INC')).toBe('Software & Subscriptions');
    });
    it('matches Home Depot to Materials & Supplies', () => {
      expect(categorizeTransaction(null, 'HOME DEPOT #1234')).toBe('Materials & Supplies');
    });
    it('matches Starbucks to Meals & Entertainment', () => {
      expect(categorizeTransaction(null, 'STARBUCKS STORE 12345')).toBe('Meals & Entertainment');
    });
    it('matches Shell to Vehicle & Fuel', () => {
      expect(categorizeTransaction(null, 'SHELL OIL 12345')).toBe('Vehicle & Fuel');
    });
    it('matches attorney to Professional Services', () => {
      expect(categorizeTransaction(null, 'LAW OFFICE OF SMITH attorney')).toBe('Professional Services');
    });
    it('matches Udemy to Education & Training', () => {
      expect(categorizeTransaction(null, 'UDEMY ONLINE COURSE')).toBe('Education & Training');
    });
    it('matches Google Ads to Advertising & Marketing', () => {
      expect(categorizeTransaction(null, 'GOOGLE ADS 123456')).toBe('Advertising & Marketing');
    });
  });

  describe('Layer 3: Fallback', () => {
    it('returns Uncategorized for unknown transactions', () => {
      expect(categorizeTransaction(null, 'RANDOM MERCHANT XYZ')).toBe('Uncategorized');
    });
    it('returns Uncategorized for empty description', () => {
      expect(categorizeTransaction(null, '')).toBe('Uncategorized');
    });
  });

  describe('Priority: Plaid category wins over keywords', () => {
    it('uses Plaid category even if keywords would match differently', () => {
      // Description says "starbucks" (Meals) but Plaid says GENERAL_MERCHANDISE (Equipment)
      expect(categorizeTransaction('GENERAL_MERCHANDISE', 'STARBUCKS STORE')).toBe('Equipment & Tools');
    });
  });
});

describe('classifyTransactionType', () => {
  it('classifies positive amounts as income', () => {
    expect(classifyTransactionType(1500)).toBe('income');
  });
  it('classifies negative amounts as expense', () => {
    expect(classifyTransactionType(-54.99)).toBe('expense');
  });
  it('classifies zero as uncategorized', () => {
    expect(classifyTransactionType(0)).toBe('uncategorized');
  });
  it('classifies TRANSFER category as transfer regardless of amount', () => {
    expect(classifyTransactionType(-500, 'TRANSFER')).toBe('transfer');
    expect(classifyTransactionType(500, 'TRANSFER')).toBe('transfer');
  });
  it('classifies LOAN_PAYMENTS as transfer', () => {
    expect(classifyTransactionType(-1200, 'LOAN_PAYMENTS')).toBe('transfer');
  });
});
