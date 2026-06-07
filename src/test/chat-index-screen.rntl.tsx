import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { AiThread } from '@/types/ai';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

const threads: AiThread[] = [
  {
    id: 'thread-1',
    title: 'Storm plan',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_060_000,
    messageCount: 3,
    lastMessage: 'Pack water, radio, and printed route cards.',
  },
  {
    id: 'thread-2',
    title: 'Medical kit',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_030_000,
    messageCount: 1,
    lastMessage: 'Check sterile dressings.',
  },
];

const listThreads = mock(async () => threads);
const clearThread = mock(async (_threadId: string) => undefined);
const routerPush = mock((href: unknown) => href);

mock.module('@/services/ai/ai.service', () => ({
  AIService: {
    clearThread,
    listThreads,
  },
}));

mock.module('expo-router', () => ({
  router: { push: routerPush },
  useFocusEffect: (effect: () => void | (() => void)) => {
    React.useEffect(effect, [effect]);
  },
}));

describe('ChatIndexScreen', () => {
  beforeEach(() => {
    clearThread.mockClear();
    listThreads.mockClear();
    routerPush.mockClear();
  });

  test('opens the selected thread and deletes a long-pressed thread locally', async () => {
    const { default: ChatIndexScreen } = await import('@/app/(tabs)/chat/index');

    const view = await render(<ChatIndexScreen />);

    expect(await view.findByText('Storm plan')).toBeTruthy();
    expect(view.getByText('Pack water, radio, and printed route cards.')).toBeTruthy();
    expect(view.getByText('3 messages')).toBeTruthy();

    await fireEvent.press(view.getByText('Storm plan'));
    expect(routerPush).toHaveBeenCalledWith('/chat/thread-1');

    await fireEvent(view.getByText('Storm plan'), 'longPress');
    await fireEvent.press(await view.findByText('Delete'));
    await fireEvent.press(await view.findByText('Delete'));

    await waitFor(() => {
      expect(clearThread).toHaveBeenCalledWith('thread-1');
    });
    expect(listThreads).toHaveBeenCalledTimes(3);
  });
});
