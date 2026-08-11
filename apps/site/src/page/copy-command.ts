const resetDelay = 2000;

const setState = (button: HTMLElement, state: string, label: string): void => {
  button.dataset.copyState = state;
  const message = button.querySelector<HTMLElement>('[data-copy-label]');
  if (message) {
    message.textContent = label;
  }
  window.setTimeout(() => {
    delete button.dataset.copyState;
    if (message) {
      message.textContent = 'Copy';
    }
  }, resetDelay);
};

/**
 * Copies the command a button is attached to.
 *
 * The text comes from the rendered `<code>` rather than a duplicate in a data
 * attribute, so what lands on the clipboard is always what the reader can see.
 */
const startCopyCommand = (): void => {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    button.addEventListener('click', () => {
      // Both shapes: a single inline command, and a multi-line block of them.
      // `.command` alone would not match `.command-block`, which is one class
      // token rather than two.
      const source = button.closest('.command, .command-block')?.querySelector('code');
      const command = source?.textContent?.trim();
      if (!command) {
        return;
      }
      navigator.clipboard.writeText(command).then(
        () => {
          setState(button, 'copied', 'Copied');
        },
        () => {
          // Clipboard writes are refused without a secure context or permission.
          // Saying so beats a button that silently does nothing.
          setState(button, 'failed', 'Press to select');
          source?.focus();
          const selection = window.getSelection();
          if (selection && source) {
            const range = document.createRange();
            range.selectNodeContents(source);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        },
      );
    });
  }
};

export { startCopyCommand };
