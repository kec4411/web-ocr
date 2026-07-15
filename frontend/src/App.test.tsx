/** Regression tests. Each one exists because the bug it guards actually shipped. */

import { ChakraProvider, theme } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { requestOcr } from './api/ocr';

vi.mock('./api/ocr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/ocr')>()),
  requestOcr: vi.fn(),
}));

const mockedRequestOcr = vi.mocked(requestOcr);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom implements neither, and the preview URL needs both.
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

const renderApp = () =>
  render(
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>,
  );

const readButton = () => screen.getByRole('button', { name: '読み取り開始' });

/** Chakra's Editable renders the value into both the preview and the textarea,
 *  so assert against the textarea specifically rather than by text. */
const resultTextarea = () => screen.getByLabelText('読み取り結果');

const dropImage = async (user: ReturnType<typeof userEvent.setup>) => {
  const file = new File(['image-bytes'], 'sample.png', { type: 'image/png' });
  const input = document.querySelector('input[type="file"]');
  await user.upload(input as HTMLInputElement, file);
  await waitFor(() => expect(readButton()).toBeEnabled());
};

describe('App', () => {
  it('disables the button until a file is chosen', () => {
    // Used to send the literal string "undefined" to the backend, because
    // acceptedFiles[0] is undefined on load and nothing guarded it.
    renderApp();
    expect(readButton()).toBeDisabled();
  });

  it('enables the button once a file is dropped', async () => {
    const user = userEvent.setup();
    renderApp();
    await dropImage(user);
    expect(readButton()).toBeEnabled();
  });

  it('shows the recognised text after a successful read', async () => {
    const user = userEvent.setup();
    mockedRequestOcr.mockResolvedValue('これはテスト画像です。');
    renderApp();
    await dropImage(user);
    await user.click(readButton());

    await waitFor(() => expect(resultTextarea()).toHaveValue('これはテスト画像です。'));
    expect(mockedRequestOcr).toHaveBeenCalledOnce();
  });

  it('surfaces backend errors in a toast', async () => {
    // Errors used to be swallowed by console.log: the spinner just stopped and
    // the user could not tell failure from an image with no text.
    const user = userEvent.setup();
    mockedRequestOcr.mockRejectedValue(new Error('boom'));
    renderApp();
    await dropImage(user);
    await user.click(readButton());

    // Chakra renders the toast title twice (visible + screen-reader region).
    expect(await screen.findAllByText('読み取りに失敗しました')).not.toHaveLength(0);
  });

  it('lets the user edit the OCR result', async () => {
    // <Editable value={...}> had no onChange, so keystrokes were discarded on
    // re-render even though an EditableTextarea was rendered.
    const user = userEvent.setup();
    mockedRequestOcr.mockResolvedValue('誤読された文字');
    renderApp();
    await dropImage(user);
    await user.click(readButton());
    await waitFor(() => expect(resultTextarea()).toHaveValue('誤読された文字'));

    const textarea = resultTextarea();
    await user.clear(textarea);
    await user.type(textarea, '修正後の文字');

    expect(textarea).toHaveValue('修正後の文字');
  });
});
