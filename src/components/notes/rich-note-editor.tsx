import { Icon } from '@/components/ui/icon';
import {
  DEFAULT_NOTE_CONTENT_FORMAT,
  RICH_NOTE_CONTENT_FORMAT,
  type NoteContentFormat,
} from '@/constants/note-content';
import type { NoteThemeVariant } from '@/constants/note-themes';
import { getNotePlainText } from '@/lib/note-text';
import {
  RichText,
  useBridgeState,
  useEditorBridge,
  type RecursivePartial,
} from '@10play/tentap-editor';
import type { EditorTheme } from '@10play/tentap-editor';
import type { LucideIcon } from 'lucide-react-native';
import { Bold, Italic, List, ListChecks, ListOrdered, Redo2, Undo2 } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export type RichNoteEditorValue = {
  body: string;
  contentHtml: string | null;
  contentJson: string | null;
  contentFormat: NoteContentFormat;
};

type RichNoteEditorProps = RichNoteEditorValue & {
  noteTheme: NoteThemeVariant;
  minHeight: number;
  onChange: (value: RichNoteEditorValue) => void;
};

type ToolbarAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function plainTextToHtml(value: string) {
  if (!value.trim()) return '<p></p>';
  return value
    .split('\n')
    .map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('');
}

function parseContentJson(contentJson: string | null) {
  if (!contentJson) return null;
  try {
    return JSON.parse(contentJson) as object;
  } catch {
    return null;
  }
}

function getInitialContent({ body, contentHtml, contentJson, contentFormat }: RichNoteEditorValue) {
  if (contentFormat === RICH_NOTE_CONTENT_FORMAT) {
    const parsedJson = parseContentJson(contentJson);
    if (parsedJson) return parsedJson;
    if (contentHtml) return contentHtml;
  }
  return plainTextToHtml(body);
}

function serializeContentJson(value: object) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function normalizeEditorText(value: string) {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

function isEmptyEditorPayload(body: string, html: string) {
  return !body.trim() && (!html.trim() || html.trim() === '<p></p>');
}

function getEditorCss(noteTheme: NoteThemeVariant, minHeight: number) {
  return `
    html, body {
      background: ${noteTheme.background};
      color: ${noteTheme.foreground};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 0;
    }
    #root,
    #root > div {
      background: ${noteTheme.background};
      color: ${noteTheme.foreground};
    }
    .ProseMirror {
      background: ${noteTheme.background};
      color: ${noteTheme.foreground} !important;
      caret-color: ${noteTheme.foreground};
      min-height: ${Math.max(180, minHeight - 72)}px;
      outline: none;
      padding: 0;
      font-size: 16px;
      line-height: 1.65;
    }
    .ProseMirror * {
      color: inherit;
    }
    .ProseMirror p {
      margin: 0 0 12px;
    }
    .ProseMirror ul,
    .ProseMirror ol {
      margin: 0 0 12px;
      padding-left: 24px;
    }
    .ProseMirror li {
      margin: 0 0 6px;
    }
    .ProseMirror ul[data-type='taskList'] {
      list-style: none;
      padding-left: 0;
    }
    .ProseMirror ul[data-type='taskList'] li {
      align-items: flex-start;
      display: flex;
      gap: 8px;
    }
    .ProseMirror ul[data-type='taskList'] li > label {
      margin-top: 2px;
    }
    .ProseMirror-focused {
      outline: none;
    }
    .is-editor-empty:first-child::before {
      color: ${noteTheme.mutedForeground};
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }
  `;
}

function ToolbarButton({
  action,
  noteTheme,
}: {
  action: ToolbarAction;
  noteTheme: NoteThemeVariant;
}) {
  const disabled = !!action.disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled, selected: !!action.active }}
      disabled={disabled}
      hitSlop={6}
      onPress={action.onPress}
      className="h-10 w-10 items-center justify-center rounded-md border"
      style={{
        backgroundColor: action.active ? noteTheme.chipBackground : 'transparent',
        borderColor: action.active ? noteTheme.foreground : noteTheme.border,
        opacity: disabled ? 0.35 : 1,
      }}>
      <Icon as={action.icon} className="size-5" color={noteTheme.foreground} />
    </Pressable>
  );
}

export function RichNoteEditor({
  body,
  contentHtml,
  contentJson,
  contentFormat,
  noteTheme,
  minHeight,
  onChange,
}: RichNoteEditorProps) {
  const latestValueRef = React.useRef<RichNoteEditorValue>({
    body,
    contentHtml,
    contentJson,
    contentFormat,
  });
  const contentUpdateIdRef = React.useRef(0);
  const skipInitialUpdateRef = React.useRef(true);
  const userFormatIntentRef = React.useRef(false);
  const [editorCssReady, setEditorCssReady] = React.useState(false);

  React.useEffect(() => {
    latestValueRef.current = { body, contentHtml, contentJson, contentFormat };
  }, [body, contentFormat, contentHtml, contentJson]);

  const initialContent = React.useMemo(
    () => getInitialContent({ body, contentHtml, contentJson, contentFormat }),
    []
  );
  const editorTheme = React.useMemo<RecursivePartial<EditorTheme>>(
    () => ({
      webview: {
        backgroundColor: noteTheme.background,
      },
      webviewContainer: {
        backgroundColor: noteTheme.background,
      },
    }),
    [noteTheme.background]
  );

  const flushEditorContent = React.useCallback(async () => {
    const updateId = contentUpdateIdRef.current + 1;
    contentUpdateIdRef.current = updateId;

    const [rawText, nextHtml, nextJson] = await Promise.all([
      editor.getText(),
      editor.getHTML(),
      editor.getJSON(),
    ]);
    if (contentUpdateIdRef.current !== updateId) return;

    const nextContentJson = serializeContentJson(nextJson);
    const nextBody = getNotePlainText({
      body: rawText,
      contentHtml: nextHtml,
      contentJson: nextContentJson,
    });
    const emptyPayload = isEmptyEditorPayload(nextBody, nextHtml);
    const nextValue: RichNoteEditorValue = {
      body: nextBody,
      contentHtml: emptyPayload ? null : nextHtml,
      contentJson: emptyPayload ? null : nextContentJson,
      contentFormat: emptyPayload ? DEFAULT_NOTE_CONTENT_FORMAT : RICH_NOTE_CONTENT_FORMAT,
    };
    const wasUserFormatIntent = userFormatIntentRef.current;
    userFormatIntentRef.current = false;

    if (
      skipInitialUpdateRef.current &&
      !wasUserFormatIntent &&
      normalizeEditorText(nextValue.body) === normalizeEditorText(latestValueRef.current.body)
    ) {
      skipInitialUpdateRef.current = false;
      return;
    }
    skipInitialUpdateRef.current = false;

    const latestValue = latestValueRef.current;
    if (
      nextValue.body === latestValue.body &&
      nextValue.contentHtml === latestValue.contentHtml &&
      nextValue.contentJson === latestValue.contentJson &&
      nextValue.contentFormat === latestValue.contentFormat
    ) {
      return;
    }

    latestValueRef.current = nextValue;
    onChange(nextValue);
  }, [onChange]);

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    dynamicHeight: false,
    initialContent,
    onChange: () => {
      void flushEditorContent();
    },
    theme: editorTheme,
  });
  const editorState = useBridgeState(editor);

  React.useEffect(() => {
    if (!editorState.isReady) return;
    setEditorCssReady(false);
    editor.injectCSS(getEditorCss(noteTheme, minHeight), 'ark-note-editor');
    editor.setPlaceholder('Write your note...');
    const frame = requestAnimationFrame(() => setEditorCssReady(true));
    return () => cancelAnimationFrame(frame);
  }, [editor, editorState.isReady, minHeight, noteTheme]);

  function runFormatCommand(command: () => void) {
    userFormatIntentRef.current = true;
    command();
    editor.focus('end');
  }

  const editorReady = !!editorState.isReady;
  const actions: ToolbarAction[] = [
    {
      id: 'bold',
      label: 'Bold',
      icon: Bold,
      active: !!editorState.isBoldActive,
      disabled: !editorReady || !editorState.canToggleBold,
      onPress: () => runFormatCommand(editor.toggleBold),
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: Italic,
      active: !!editorState.isItalicActive,
      disabled: !editorReady || !editorState.canToggleItalic,
      onPress: () => runFormatCommand(editor.toggleItalic),
    },
    {
      id: 'bullet-list',
      label: 'Bullet list',
      icon: List,
      active: !!editorState.isBulletListActive,
      disabled: !editorReady || !editorState.canToggleBulletList,
      onPress: () => runFormatCommand(editor.toggleBulletList),
    },
    {
      id: 'ordered-list',
      label: 'Numbered list',
      icon: ListOrdered,
      active: !!editorState.isOrderedListActive,
      disabled: !editorReady || !editorState.canToggleOrderedList,
      onPress: () => runFormatCommand(editor.toggleOrderedList),
    },
    {
      id: 'checklist',
      label: 'Checklist',
      icon: ListChecks,
      active: !!editorState.isTaskListActive,
      disabled: !editorReady || !editorState.canToggleTaskList,
      onPress: () => runFormatCommand(editor.toggleTaskList),
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: Undo2,
      disabled: !editorReady || !editorState.canUndo,
      onPress: () => runFormatCommand(editor.undo),
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: Redo2,
      disabled: !editorReady || !editorState.canRedo,
      onPress: () => runFormatCommand(editor.redo),
    },
  ];

  return (
    <View
      className="mt-4 flex-1"
      style={{
        backgroundColor: noteTheme.background,
        minHeight,
      }}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbarContent}
        style={[styles.toolbar, { borderBottomColor: noteTheme.border }]}>
        {actions.map((action) => (
          <ToolbarButton key={action.id} action={action} noteTheme={noteTheme} />
        ))}
      </ScrollView>

      <View className="flex-1 py-4" style={{ minHeight: Math.max(180, minHeight - 52) }}>
        <RichText
          editor={editor}
          style={{ backgroundColor: noteTheme.background, opacity: editorCssReady ? 1 : 0 }}
          containerStyle={{
            backgroundColor: noteTheme.background,
            minHeight: Math.max(180, minHeight - 84),
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarContent: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
