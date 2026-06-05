export type StorageErrorCode =
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_WORKSPACE_NAME'
  | 'DUPLICATE_CASE_NAME'
  | 'NOT_FOUND'
  | 'ALREADY_DELETED'
  | 'NOT_DELETED'
  | 'CONFLICT';

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

export class StorageDomainError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    public readonly details: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'StorageDomainError';
  }
}

export class StorageValidationError extends StorageDomainError {
  constructor(message: string, details: Record<string, string> = {}) {
    super('VALIDATION_FAILED', message, details);
    this.name = 'StorageValidationError';
  }
}

export class DuplicateWorkspaceNameError extends StorageDomainError {
  constructor(public readonly workspaceName: string) {
    super('DUPLICATE_WORKSPACE_NAME', `Workspace name "${workspaceName}" already exists.`, {
      workspaceName,
    });
    this.name = 'DuplicateWorkspaceNameError';
  }
}

export class DuplicateCaseNameError extends StorageDomainError {
  constructor(
    public readonly workspaceId: string,
    public readonly caseName: string,
  ) {
    super(
      'DUPLICATE_CASE_NAME',
      `Case name "${caseName}" already exists in workspace "${workspaceId}".`,
      { workspaceId, caseName },
    );
    this.name = 'DuplicateCaseNameError';
  }
}

export class StorageNotFoundError extends StorageDomainError {
  constructor(resourceType: string, resourceId: string) {
    super('NOT_FOUND', `${resourceType} "${resourceId}" was not found.`, {
      resourceType,
      resourceId,
    });
    this.name = 'StorageNotFoundError';
  }
}

export class StorageStateError extends StorageDomainError {
  constructor(code: Extract<StorageErrorCode, 'ALREADY_DELETED' | 'NOT_DELETED' | 'CONFLICT'>, message: string) {
    super(code, message);
    this.name = 'StorageStateError';
  }
}
