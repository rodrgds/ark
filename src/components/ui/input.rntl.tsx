import { describe, expect, mock, test } from 'bun:test';
import { installCommonRntlMocks } from '@/test/rntl-mocks';

installCommonRntlMocks(mock);

const { fireEvent, render } = await import('@testing-library/react-native');
const { Input } = await import('@/components/ui/input');

describe('Input', () => {
  test('does not keep forcing controlled value while native text editing is focused', async () => {
    let latest = 'https://example.com/page';
    const handleChangeText = mock((text: string) => {
      latest = text;
    });

    const view = await render(
      <Input
        accessibilityLabel="Web page URL"
        placeholder="Enter URL"
        value={latest}
        onChangeText={handleChangeText}
      />
    );

    expect(view.getByLabelText('Web page URL')).toHaveProp('value', latest);

    await fireEvent(view.getByLabelText('Web page URL'), 'focus');

    expect(view.getByLabelText('Web page URL')).not.toHaveProp('value');
    expect(view.getByLabelText('Web page URL')).toHaveProp('defaultValue', latest);

    await fireEvent.changeText(
      view.getByLabelText('Web page URL'),
      'https://example.com/saved/page'
    );
    await view.rerender(
      <Input
        accessibilityLabel="Web page URL"
        placeholder="Enter URL"
        value={latest}
        onChangeText={handleChangeText}
      />
    );

    expect(handleChangeText).toHaveBeenCalledWith('https://example.com/saved/page');
    expect(view.getByLabelText('Web page URL')).not.toHaveProp('value');
    expect(view.getByLabelText('Web page URL')).toHaveProp('defaultValue', latest);

    await fireEvent(view.getByLabelText('Web page URL'), 'blur');

    expect(view.getByLabelText('Web page URL')).toHaveProp('value', latest);
  });
});
