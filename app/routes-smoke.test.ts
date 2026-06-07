import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const appDir = join(process.cwd(), 'app');

const ROUTE_FILES = walk(appDir)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !file.endsWith('.test.tsx'))
  .filter((file) => !file.endsWith('.test.ts'))
  .filter((file) => !relative(appDir, file).startsWith('+'));

describe('app route contracts', () => {
  test('every route module has a default export', () => {
    for (const file of ROUTE_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(appDir, file)).toContain('export default');
    }
  });

  test('root layout registers all top-level route groups', () => {
    const source = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
    for (const route of ['index', 'onboarding', '(tabs)', 'tools', 'content', 'documents']) {
      expect(source).toContain(`name="${route}"`);
    }
  });

  test('tab layout registers the primary app sections', () => {
    const source = readFileSync(join(appDir, '(tabs)/_layout.tsx'), 'utf8');
    const chatLayout = readFileSync(join(appDir, '(tabs)/chat/_layout.tsx'), 'utf8');
    const tabConstants = readFileSync(join(process.cwd(), 'src/constants/tabs.ts'), 'utf8');
    const tabPreferences = readFileSync(
      join(process.cwd(), 'src/services/preferences/tab-preferences.service.ts'),
      'utf8'
    );

    for (const route of ['chat', 'map', 'library', 'notes', 'tools', 'settings']) {
      expect(tabConstants).toContain(`routeName: '${route}'`);
    }
    expect(source).toContain("from 'expo-router/unstable-native-tabs'");
    expect(source).toContain('<NativeTabs');
    expect(source).toContain('NativeTabs.Trigger');
    expect(source).toContain('TabPreferencesService.getPreferences');
    expect(source).toContain('visibleTabs.map');
    expect(tabPreferences).toContain("const TAB_ORDER_KEY = 'tabs.order'");
    expect(tabPreferences).toContain("const ENABLED_TABS_KEY = 'tabs.enabled'");
    expect(chatLayout).toContain('name="[threadId]"');
    expect(chatLayout).toContain("router.replace('/(tabs)/chat'");
  });

  test('onboarding flow keeps the expected step order and tab handoff', () => {
    const intro = readFileSync(join(appDir, 'onboarding/index.tsx'), 'utf8');
    const security = readFileSync(join(appDir, 'onboarding/security.tsx'), 'utf8');
    const permissions = readFileSync(join(appDir, 'onboarding/permissions.tsx'), 'utf8');
    const maps = readFileSync(join(appDir, 'onboarding/maps.tsx'), 'utf8');
    const power = readFileSync(join(appDir, 'onboarding/power.tsx'), 'utf8');
    const packs = readFileSync(join(appDir, 'onboarding/packs.tsx'), 'utf8');
    const models = readFileSync(join(appDir, 'onboarding/models.tsx'), 'utf8');
    const finish = readFileSync(join(appDir, 'onboarding/finish.tsx'), 'utf8');

    expect(intro).toContain('nextHref="/onboarding/security"');
    expect(security).toContain('nextHref="/onboarding/permissions"');
    expect(permissions).toContain('/onboarding/maps');
    expect(maps).toContain('nextHref="/onboarding/power"');
    expect(power).toContain('nextHref="/onboarding/packs"');
    expect(packs).toContain('nextHref="/onboarding/models"');
    expect(models).toContain('nextHref="/onboarding/finish"');
    expect(finish).toContain("router.replace('/(tabs)/chat')");
    expect(finish).toContain('completeOnboarding');
  });

  test('settings exposes downloads outside advanced diagnostics', () => {
    const settings = readFileSync(join(appDir, '(tabs)/settings.tsx'), 'utf8');
    const downloadsCard = readFileSync(
      join(process.cwd(), 'src/components/settings/downloads-card.tsx'),
      'utf8'
    );

    expect(settings).toContain("{ value: 'downloads', label: 'Downloads' }");
    expect(settings).toContain("activeTab === 'downloads'");
    expect(downloadsCard).toContain('onRetryDownload');
    expect(downloadsCard).toContain('Wi-Fi only');
    expect(downloadsCard).toContain('Pause all');
    expect(downloadsCard).toContain('Resume all');
    expect(downloadsCard).toContain('Retry failed');
    expect(downloadsCard).toContain('Clean completed');
    expect(settings).toContain('PreferencesService.getWifiOnlyDownloadsEnabled');
    expect(settings).toContain('DownloadManagerService.deleteCompletedWhereSafe');
    expect(settings).toContain("{ value: 'advanced', label: 'Advanced' }");
    expect(settings).toContain("activeTab === 'advanced'");
    expect(settings).not.toContain("label: 'Internals'");
    expect(settings).not.toContain(
      '<DownloadsCard downloads={downloads} mapRegions={mapRegions} />'
    );
  });

  test('library tools and settings skip decorative header blocks', () => {
    const library = readFileSync(join(appDir, '(tabs)/library.tsx'), 'utf8');
    const tools = readFileSync(join(appDir, '(tabs)/tools.tsx'), 'utf8');
    const settings = readFileSync(join(appDir, '(tabs)/settings.tsx'), 'utf8');
    const diagnostics = readFileSync(join(appDir, 'tools/diagnostics.tsx'), 'utf8');
    const functionSearch = readFileSync(
      join(process.cwd(), 'src/components/layout/function-search.tsx'),
      'utf8'
    );

    expect(library).not.toContain("from '@/components/brand/ark-logo'");
    expect(library).not.toContain('variant="h1">Library');
    expect(library.indexOf('placeholder="Search library"')).toBeLessThan(
      library.indexOf('{initialLoading ? (')
    );
    expect(library.indexOf('<Text>Import</Text>')).toBeLessThan(
      library.indexOf('{initialLoading ? (')
    );

    expect(tools).not.toContain("from '@/components/brand/ark-logo'");
    expect(tools).not.toContain('variant="h1">Tools');

    expect(settings).not.toContain("from '@/components/brand/ark-logo'");
    expect(settings).not.toContain('variant="h1">Settings');
    expect(settings).not.toContain('Device, vault, and offline runtime controls.');
    expect(diagnostics).toContain("tab: 'advanced'");
    expect(functionSearch).toContain("title: 'Advanced'");
    expect(functionSearch).toContain("tab: 'advanced'");
  });

  test('settings exposes encrypted backup import and export from advanced', () => {
    const settings = readFileSync(join(appDir, '(tabs)/settings.tsx'), 'utf8');
    const backupSection = readFileSync(
      join(process.cwd(), 'src/components/settings/backup-section.tsx'),
      'utf8'
    );
    const backupService = readFileSync(
      join(process.cwd(), 'src/services/backup/backup.service.ts'),
      'utf8'
    );

    expect(settings).toContain('BackupService.exportToFile');
    expect(settings).toContain('BackupService.importFromPicker');
    expect(backupSection).toContain('Export .arkbackup');
    expect(backupSection).toContain('Import .arkbackup');
    expect(backupSection).toContain('Encrypted Backup');
    expect(settings).toContain("activeTab === 'advanced'");
    expect(backupService).toContain("'models'");
    expect(backupService).toContain("'offline maps'");
    expect(backupService).toContain("'embeddings'");
    expect(backupService).toContain("'download queues'");
  });

  test('settings replaces motion with battery reduce mode', () => {
    const settings = readFileSync(join(appDir, '(tabs)/settings.tsx'), 'utf8');
    const appearanceSection = readFileSync(
      join(process.cwd(), 'src/components/settings/appearance-section.tsx'),
      'utf8'
    );
    const preferences = readFileSync(
      join(process.cwd(), 'src/services/preferences/preferences.service.ts'),
      'utf8'
    );

    expect(appearanceSection).toContain('Battery Reduce Mode');
    expect(settings).toContain('setBatteryReduceModeEnabled');
    expect(settings).toContain("setPreference('oled')");
    expect(settings).not.toContain('toggleMotion');
    expect(preferences).toContain('BATTERY_REDUCE_MODE_KEY');
    expect(preferences).toContain('LEGACY_MOTION_ENABLED_KEY');
  });

  test('notes screen exposes selection and bulk action contracts', () => {
    const notes = readFileSync(join(appDir, '(tabs)/notes.tsx'), 'utf8');
    const grid = readFileSync(
      join(process.cwd(), 'src/components/notes/notes-mosaic-grid.tsx'),
      'utf8'
    );

    expect(notes).toContain("type NotesMode = 'normal' | 'selection' | 'organize'");
    expect(notes).toContain('BackHandler.addEventListener');
    expect(notes).toContain('NotesRepository.updateMany');
    expect(notes).toContain('NotesRepository.softDeleteMany');
    expect(notes).toContain('NotesRepository.applyLabels');
    expect(notes).toContain('NotesRepository.reorder');
    expect(notes).toContain('enterOrganizeMode');
    expect(grid).toContain('selectedIds: ReadonlySet<string>');
  });

  test('note editor persists rich content through the repository contract', () => {
    const editor = readFileSync(join(appDir, 'notes/editor.tsx'), 'utf8');
    const richEditor = readFileSync(
      join(process.cwd(), 'src/components/notes/rich-note-editor.tsx'),
      'utf8'
    );

    expect(editor).toContain('RichNoteEditor');
    expect(editor).toContain('contentHtml');
    expect(editor).toContain('contentJson');
    expect(editor).toContain('contentFormat');
    expect(editor).toContain('NotesRepository.update');
    expect(editor).toContain('NotesRepository.create');
    expect(richEditor).toContain('useEditorBridge');
    expect(richEditor).toContain('toggleBold');
    expect(richEditor).toContain('toggleItalic');
    expect(richEditor).toContain('toggleBulletList');
    expect(richEditor).toContain('toggleOrderedList');
    expect(richEditor).toContain('toggleTaskList');
    expect(richEditor).toContain('new BridgeExtension');
    expect(richEditor).toContain("forceName: 'ark-note-editor'");
    expect(richEditor).toContain("ul[data-type='taskList']");
    expect(richEditor).toContain('label > input:checked');
    expect(richEditor).toContain('-webkit-appearance: none');
    expect(richEditor).toContain('Convert to checklist');
    expect(richEditor).toContain('RICH_NOTE_CONTENT_FORMAT');
    expect(richEditor).not.toContain("editor.focus('end')");
  });

  test('notes list keeps pinned sections stable without per-card pin controls', () => {
    const notes = readFileSync(join(appDir, '(tabs)/notes.tsx'), 'utf8');
    const noteCard = readFileSync(
      join(process.cwd(), 'src/components/notes/note-card.tsx'),
      'utf8'
    );
    const notesList = readFileSync(
      join(process.cwd(), 'src/components/notes/notes-list.tsx'),
      'utf8'
    );

    expect(notes).toContain('loadRequestIdRef');
    expect(notes).toContain('showPinAction');
    expect(notes).toContain('showUnpinAction');
    expect(notes).toContain('moveNoteWithinGroup');
    expect(notes).toContain('renderOrganizeCollection(pinnedNotes, true)');
    expect(notes).toContain('renderOrganizeCollection(unpinnedNotes, false)');
    expect(noteCard).not.toContain('onPinPress');
    expect(notesList).not.toContain('onNotePinPress');
  });

  test('manual note ordering settles without a spring bounce', () => {
    const organizeList = readFileSync(
      join(process.cwd(), 'src/components/notes/notes-organize-list.tsx'),
      'utf8'
    );

    expect(organizeList).toContain('withTiming(0');
    expect(organizeList).not.toContain('withSpring');
  });

  test('screens do not ship obvious placeholder copy', () => {
    const allowed = new Set([
      'app/(tabs)/notes.tsx',
      'app/(tabs)/chat/index.tsx',
      'app/(tabs)/chat/[threadId].tsx',
      'app/chat/[threadId].tsx',
      'app/(tabs)/library.tsx',
      'app/(tabs)/map.tsx',
      'app/(tabs)/settings.tsx',
      'app/onboarding/security.tsx',
      'app/notes/labels.tsx',
      'src/components/ui/input.tsx',
      'app/content/[id].tsx',
    ]);
    const offenders = ROUTE_FILES.filter((file) => {
      const rel = relative(process.cwd(), file);
      const source = readFileSync(file, 'utf8');
      return !allowed.has(rel) && /\bplaceholder\b/i.test(source);
    }).map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}
