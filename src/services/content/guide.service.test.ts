import { describe, expect, test } from 'bun:test';
import { GuideService } from '@/services/content/guide.service';

describe('guide sections', () => {
  test('Ready.gov earthquake sections use the source page anchors', () => {
    const sections = GuideService.getSections('disaster-earthquakes');
    const targets = sections.flatMap((section) => section.htmlTargets ?? []);

    expect(sections.map((section) => section.title)).toEqual([
      'Prepare Before an Earthquake',
      'During an Earthquake',
      'Drop, Cover, and Hold On',
      'After an Earthquake',
      'Additional Resources',
    ]);
    expect(targets).toContain('#before');
    expect(targets).toContain('#during');
    expect(targets).toContain('#after');
    expect(targets).toContain('#resources');
  });

  test('Ready.gov extreme heat sections use the source page anchors', () => {
    const sections = GuideService.getSections('disaster-extreme-heat');
    const targets = sections.flatMap((section) => section.htmlTargets ?? []);

    expect(sections.map((section) => section.title)).toEqual([
      'Before Extreme Heat',
      'During Extreme Heat',
      'Heat-Related Illnesses',
      'Summer Break',
      'Additional Resources',
    ]);
    expect(targets).toContain('#prepare');
    expect(targets).toContain('#during');
    expect(targets).toContain('#illness');
    expect(targets).toContain('#break');
    expect(targets).toContain('#content');
  });
});
