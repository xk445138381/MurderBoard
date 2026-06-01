import { StorageInitializationError } from './storage-error';

describe('StorageInitializationError', () => {
  it('keeps the database name and cause', () => {
    const cause = new Error('open failed');
    const error = new StorageInitializationError('murderboard-test', cause);

    expect(error.name).toBe('StorageInitializationError');
    expect(error.databaseName).toBe('murderboard-test');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('murderboard-test');
  });
});
