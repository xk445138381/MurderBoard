import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmDestructiveAction } from './confirm';

describe('confirmDestructiveAction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when the user cancels', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    expect(confirmDestructiveAction('Delete this item?')).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith('Delete this item?');
  });

  it('returns true when the user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    expect(confirmDestructiveAction('Delete this item?')).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith('Delete this item?');
  });
});
