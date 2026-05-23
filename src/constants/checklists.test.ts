import { describe, expect, test } from 'bun:test';
import { READINESS_CHECKLIST } from '@/constants/checklists';

describe('readiness checklist', () => {
  test('uses stable unique ids for persistence', () => {
    const ids = READINESS_CHECKLIST.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  test('covers practical offline readiness areas', () => {
    const groups = new Set(READINESS_CHECKLIST.map((item) => item.group));
    expect(groups).toContain('water');
    expect(groups).toContain('medical');
    expect(groups).toContain('navigation');
    expect(groups).toContain('power');
    expect(READINESS_CHECKLIST.every((item) => item.title.length > 8)).toBe(true);
    expect(READINESS_CHECKLIST.every((item) => item.detail.length > 24)).toBe(true);
  });
});
