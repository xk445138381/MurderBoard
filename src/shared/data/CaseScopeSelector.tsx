import type { Case, Workspace } from '../../domain/types';
import { EmptyState, ErrorState, LoadingState } from '../state';

interface CaseScopeSelectorProps {
  cases: Case[];
  isLoading: boolean;
  onCaseChange: (caseId: string) => void;
  onWorkspaceChange: (workspaceId: string) => void;
  scopeError: string | null;
  selectedCaseId: string | null;
  selectedWorkspaceId: string | null;
  workspaces: Workspace[];
}

export function CaseScopeSelector({
  cases,
  isLoading,
  onCaseChange,
  onWorkspaceChange,
  scopeError,
  selectedCaseId,
  selectedWorkspaceId,
  workspaces,
}: CaseScopeSelectorProps) {
  if (isLoading) {
    return <LoadingState message="Loading workspaces and cases..." />;
  }

  if (scopeError) {
    return <ErrorState title="Unable to load case scope" message={scopeError} />;
  }

  if (workspaces.length === 0) {
    return (
      <EmptyState
        title="No workspaces yet"
        message="Create a workspace and case from the Cases page before recording details."
      />
    );
  }

  if (cases.length === 0) {
    return (
      <div className="panel form-grid">
        <label htmlFor="scope-workspace">Workspace</label>
        <select
          id="scope-workspace"
          onChange={(event) => onWorkspaceChange(event.target.value)}
          value={selectedWorkspaceId ?? ''}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <EmptyState
          title="No cases in selected workspace"
          message="Create a case from the Cases page before adding people, clues, or events."
        />
      </div>
    );
  }

  return (
    <div className="panel scope-selector">
      <div>
        <label htmlFor="scope-workspace">Workspace</label>
        <select
          id="scope-workspace"
          onChange={(event) => onWorkspaceChange(event.target.value)}
          value={selectedWorkspaceId ?? ''}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="scope-case">Case</label>
        <select
          id="scope-case"
          onChange={(event) => onCaseChange(event.target.value)}
          value={selectedCaseId ?? ''}
        >
          {cases.map((caseRecord) => (
            <option key={caseRecord.id} value={caseRecord.id}>
              {caseRecord.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
