export class StorageInitializationError extends Error {
  constructor(
    public readonly databaseName: string,
    cause: unknown,
  ) {
    super(`Unable to initialize IndexedDB database "${databaseName}".`, {
      cause,
    });
    this.name = 'StorageInitializationError';
  }
}
