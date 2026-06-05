import type { CaseBoard } from '../../domain/types';
import type { MurderBoardRepository } from './murder-board-repository';

export interface CaseBoardRepository {
  listCaseBoards(): Promise<CaseBoard[]>;
  getCaseBoard(id: string): Promise<CaseBoard | null>;
}

export type { MurderBoardRepository };
