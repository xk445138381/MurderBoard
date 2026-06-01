import type { CaseBoard } from '../../domain/types';

export interface CaseBoardRepository {
  listCaseBoards(): Promise<CaseBoard[]>;
  getCaseBoard(id: string): Promise<CaseBoard | null>;
}
