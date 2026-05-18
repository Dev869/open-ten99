import { describe, it, expect } from 'vitest';
import { slug, BRAND, BRAND_FROM_ADDRESS } from '../brand';
import { uint8ToBase64 } from '../utils';
import { buildChangeOrderPdf, buildChangeOrderPdfBytes } from '../buildPdf';
import type { WorkItem, Client } from '../types';

describe('slug', () => {
  it('lowercases and hyphenates', () => {
    expect(slug('Acme Corp Website Redesign')).toBe('acme-corp-website-redesign');
  });

  it('strips leading/trailing/duplicate separators', () => {
    expect(slug('  **Hello, World!!**  ')).toBe('hello-world');
  });

  it('caps length and never ends with a hyphen', () => {
    const out = slug('a'.repeat(80), 10);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.endsWith('-')).toBe(false);
  });

  it('falls back to "invoice" when empty', () => {
    expect(slug('!!!')).toBe('invoice');
  });
});

describe('uint8ToBase64', () => {
  it('round-trips through atob', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128, 64, 65, 66]);
    const b64 = uint8ToBase64(bytes);
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it('handles large buffers without throwing', () => {
    const big = new Uint8Array(100_000).fill(7);
    expect(() => uint8ToBase64(big)).not.toThrow();
  });
});

describe('brand defaults', () => {
  it('uses the DW Tailored Systems verified sender', () => {
    expect(BRAND.fromEmail).toBe('devin@dwtailored.com');
    expect(BRAND.company).toBe('DW Tailored Systems');
  });

  it('builds a multi-line from-address block', () => {
    expect(BRAND_FROM_ADDRESS.split('\n')).toEqual([
      'Devin Wilson',
      'DW Tailored Systems',
      'devin@dwtailored.com',
      '+1 (530) 753-5503',
    ]);
  });
});

describe('buildChangeOrderPdf', () => {
  const client: Client = {
    name: 'Acme Co',
    email: 'ap@acme.test',
    createdAt: new Date('2026-01-01'),
  };

  const workItem: WorkItem = {
    type: 'featureRequest',
    status: 'completed',
    clientId: 'c1',
    sourceEmail: 'in@dwtailored.com',
    subject: 'API integration',
    lineItems: [{ id: 'li1', description: 'Build endpoint', hours: 4, cost: 600 }],
    totalHours: 4,
    totalCost: 600,
    isBillable: true,
    createdAt: new Date('2026-05-18'),
    updatedAt: new Date('2026-05-18'),
  };

  const settings = { companyName: 'Your Company', hourlyRate: 150 };

  it('returns a non-empty PDF byte stream', async () => {
    const bytes = await buildChangeOrderPdfBytes(workItem, client, settings);
    expect(bytes.byteLength).toBeGreaterThan(0);
    // PDF magic header "%PDF"
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('blob-URL wrapper still resolves to a string', async () => {
    const url = await buildChangeOrderPdf(workItem, client, settings);
    expect(typeof url).toBe('string');
  });
});
