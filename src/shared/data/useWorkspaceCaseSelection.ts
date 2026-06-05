import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Case, Workspace } from '../../domain/types';
import { StorageDomainError } from '../../storage/storage-error';
import { useMurderBoardRepository } from './MurderBoardDataProvider';

export function useWorkspaceCaseSelection() {
  const repository = useMurderBoardRepository();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isLoadingScope, setIsLoadingScope] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );
  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.id === selectedCaseId) ?? null,
    [selectedCaseId, cases],
  );

  const refreshScope = useCallback(
    async (preferredWorkspaceId?: string | null, preferredCaseId?: string | null) => {
      setIsLoadingScope(true);
      setScopeError(null);

      try {
        const nextWorkspaces = await repository.listWorkspaces();
        const nextWorkspaceId =
          preferredWorkspaceId &&
          nextWorkspaces.some((workspace) => workspace.id === preferredWorkspaceId)
            ? preferredWorkspaceId
            : (nextWorkspaces[0]?.id ?? null);
        const nextCases = nextWorkspaceId ? await repository.listCases(nextWorkspaceId) : [];
        const nextCaseId =
          preferredCaseId && nextCases.some((caseRecord) => caseRecord.id === preferredCaseId)
            ? preferredCaseId
            : (nextCases[0]?.id ?? null);

        setWorkspaces(nextWorkspaces);
        setCases(nextCases);
        setSelectedWorkspaceId(nextWorkspaceId);
        setSelectedCaseId(nextCaseId);
      } catch (error) {
        setScopeError(formatActionError(error));
      } finally {
        setIsLoadingScope(false);
      }
    },
    [repository],
  );

  useEffect(() => {
    void refreshScope();
  }, [refreshScope]);

  async function selectWorkspace(workspaceId: string) {
    await refreshScope(workspaceId, null);
  }

  return {
    cases,
    isLoadingScope,
    refreshScope,
    repository,
    scopeError,
    selectWorkspace,
    selectedCase,
    selectedCaseId,
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedCaseId,
    workspaces,
  };
}

export function formatActionError(error: unknown) {
  if (error instanceof StorageDomainError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown storage error.';
}
