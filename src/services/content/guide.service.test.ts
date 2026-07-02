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

  test('Hesperian First Aid sections target physical PDF pages', () => {
    const pageByTitle = new Map(
      GuideService.getSections('hesperian-first-aid').map((section) => [section.title, section.page])
    );

    expect(pageByTitle.get('Calm and assess')).toBe(1);
    expect(pageByTitle.get('Breathing')).toBe(5);
    expect(pageByTitle.get('Bleeding and shock')).toBe(9);
    expect(pageByTitle.get('Broken bones')).toBe(29);
    expect(pageByTitle.get('Burns')).toBe(38);
    expect(pageByTitle.get('Poisoning')).toBe(45);
    expect(pageByTitle.get('Heat and cold')).toBe(56);
  });

  test('Where There Is No Doctor sections target physical PDF pages', () => {
    const pageByTitle = new Map(
      GuideService.getSections('where-there-is-no-doctor-first-aid').map((section) => [
        section.title,
        section.page,
      ])
    );

    expect(pageByTitle.get('Home Cures and Popular Beliefs')).toBe(48);
    expect(pageByTitle.get('How to Examine a Sick Person')).toBe(76);
    expect(pageByTitle.get('First Aid')).toBe(122);
    expect(pageByTitle.get('Nutrition: What to Eat to Be Healthy')).toBe(154);
    expect(pageByTitle.get('Serious Illnesses That Need Special Attention')).toBe(226);
    expect(pageByTitle.get('Family Planning')).toBe(330);
    expect(pageByTitle.get('The Medicine Kit')).toBe(378);
  });

  test('FM 21-76 sections target physical PDF pages', () => {
    const pageByTitle = new Map(
      GuideService.getSections('us-army-survival-fm-21-76').map((section) => [
        section.title,
        section.page,
      ])
    );

    expect(pageByTitle.get('Introduction and survival actions')).toBe(5);
    expect(pageByTitle.get('Psychology of survival')).toBe(8);
    expect(pageByTitle.get('Poisonous plants')).toBe(109);
    expect(pageByTitle.get('Dangerous animals')).toBe(112);
    expect(pageByTitle.get('Desert survival')).toBe(131);
    expect(pageByTitle.get('Sea survival')).toBe(162);
    expect(pageByTitle.get('Field-expedient direction finding')).toBe(194);
    expect(pageByTitle.get('Signaling')).toBe(200);
  });
});
