import {
  DuplicateCaseNameError,
  DuplicateWorkspaceNameError,
  StorageInitializationError,
  StorageValidationError,
} from './storage-error';

describe('StorageInitializationError', () => {
  it('keeps the database name and cause', () => {
    const cause = new Error('open failed');
    const error = new StorageInitializationError('murderboard-test', cause);

    expect(error.name).toBe('StorageInitializationError');
    expect(error.databaseName).toBe('murderboard-test');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('murderboard-test');
  });

  it('uses stable codes for duplicate workspace names', () => {
    const error = new DuplicateWorkspaceNameError('红楼谜案');

    expect(error.name).toBe('DuplicateWorkspaceNameError');
    expect(error.code).toBe('DUPLICATE_WORKSPACE_NAME');
    expect(error.details).toEqual({ workspaceName: '红楼谜案' });
  });

  it('uses stable codes for duplicate case names', () => {
    const error = new DuplicateCaseNameError('workspace-1', '第一夜');

    expect(error.name).toBe('DuplicateCaseNameError');
    expect(error.code).toBe('DUPLICATE_CASE_NAME');
    expect(error.details).toEqual({
      workspaceId: 'workspace-1',
      caseName: '第一夜',
    });
  });

  it('uses stable codes for validation failures', () => {
    const error = new StorageValidationError('Name is required.', {
      fieldName: 'workspaceName',
    });

    expect(error.name).toBe('StorageValidationError');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details).toEqual({ fieldName: 'workspaceName' });
  });
});
