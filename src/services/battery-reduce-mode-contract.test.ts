import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('battery reduce mode contracts', () => {
  test('suppresses haptics and decorative mascots', () => {
    const haptics = readFileSync(join(root, 'src/services/device/haptics.service.ts'), 'utf8');
    const arky = readFileSync(join(root, 'src/components/brand/ark-logo.tsx'), 'utf8');

    expect(haptics).toContain('getBatteryReduceModeEnabled');
    expect(haptics).toContain('shouldSuppress');
    expect(arky).toContain('useBatteryReduceMode');
    expect(arky).toContain('if (reduceModeEnabled) return null');
  });

  test('slows polling and sensor subscriptions', () => {
    const settings = readFileSync(join(root, 'app/(tabs)/settings.tsx'), 'utf8');
    const tools = readFileSync(join(root, 'app/(tabs)/tools.tsx'), 'utf8');
    const sensorHook = readFileSync(join(root, 'src/hooks/use-sensor-subscription.ts'), 'utf8');
    const compass = readFileSync(join(root, 'src/services/sensors/compass.service.ts'), 'utf8');
    const level = readFileSync(join(root, 'src/services/sensors/level.service.ts'), 'utf8');
    const pedometer = readFileSync(join(root, 'src/services/sensors/pedometer.service.ts'), 'utf8');

    expect(settings).toContain('BATTERY_POLL_INTERVALS_MS.settingsRefresh');
    expect(tools).toContain('BATTERY_POLL_INTERVALS_MS.toolsOverview');
    expect(sensorHook).toContain('reduceModeEnabled');
    expect(compass).toContain("reducedInterval('compass'");
    expect(level).toContain("reducedInterval('level'");
    expect(pedometer).toContain("reducedInterval('pedometerPoll'");
  });

  test('defers automatic OCR/indexing and avoids embedding model preload', () => {
    const documentText = readFileSync(
      join(root, 'src/services/files/document-text.service.ts'),
      'utf8'
    );
    const rag = readFileSync(join(root, 'src/services/ai/rag.service.ts'), 'utf8');
    const embeddings = readFileSync(join(root, 'src/services/ai/embedding.service.ts'), 'utf8');

    expect(documentText).toContain('deferAutomaticWork');
    expect(documentText).toContain('Battery Reduce Mode is on. Run OCR');
    expect(documentText).toContain('indexDocumentIfAllowed');
    expect(rag).toContain('getBatteryReduceModeEnabled');
    expect(embeddings).toContain('getBatteryReduceModeEnabled');
    expect(embeddings).toContain('return null');
  });
});
