import { describe, expect, it } from 'vitest';

import { getDrivingRequirements } from './enrichment-sources/driving.js';
import { getVisaRequirement } from './enrichment-sources/visa-matrix.js';

describe('getDrivingRequirements', () => {
  it('returns advisory node for known country', () => {
    const node = getDrivingRequirements('JP');
    expect(node).not.toBeNull();
    expect(node!.type).toBe('advisory');
    if (node!.type === 'advisory') {
      expect(node!.title).toBe('Driving Requirements');
      expect(node!.body).toContain('left');
      expect(node!.body).toContain('International Driving Permit');
    }
  });

  it('returns null for unknown country', () => {
    expect(getDrivingRequirements('XX')).toBeNull();
  });

  it('returns right-side driving without IDP for US', () => {
    const node = getDrivingRequirements('US');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.body).toContain('right');
      expect(node.body).toContain('no IDP required');
    }
  });
});

describe('getVisaRequirement', () => {
  it('returns visa-free for US → Japan', () => {
    const node = getVisaRequirement('US', 'JP');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.title).toBe('Visa Not Required');
      expect(node.severity).toBe('info');
    }
  });

  it('returns visa-on-arrival for US → Thailand', () => {
    const node = getVisaRequirement('US', 'TH');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.title).toBe('Visa on Arrival Available');
    }
  });

  it('returns visa-required for US → unknown', () => {
    const node = getVisaRequirement('US', 'CN');
    expect(node).not.toBeNull();
    if (node?.type === 'advisory') {
      expect(node.title).toBe('Visa Requirements — Check Before Travel');
      expect(node.severity).toBe('warning');
    }
  });

  it('returns null for same country', () => {
    expect(getVisaRequirement('US', 'US')).toBeNull();
  });
});
