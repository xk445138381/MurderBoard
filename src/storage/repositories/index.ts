export type { CaseBoardRepository } from "./case-board-repository";
export type {
  ArchivedCaseListOptions,
  CaseImportConflict,
  CaseImportInput,
  CaseImportPreview,
  CopyCaseInput,
  CaseListOptions,
  CreateBoardRelationInput,
  CreateCaseInput,
  CreateCharacterInput,
  CreateClueInput,
  CreateEventInput,
  CreateHypothesisInput,
  CreateWorkspaceInput,
  MoveCaseInput,
  MurderBoardRepository,
  RestoreArchivedCaseInput,
  SaveBoardNodePositionInput,
  TrashEntry,
  TrashResourceType,
  UpdateBoardRelationInput,
  UpdateCaseInput,
  UpdateCharacterInput,
  UpdateClueInput,
  UpdateEventInput,
  UpdateHypothesisInput,
  UpdateWorkspaceInput,
} from "./murder-board-repository";

// ---- New configurable storage ----
export type { TemplateRepository } from "../template-repository";
export { IndexedDbTemplateRepository } from "../template-repository";
export type { GameRepository } from "../game-repository";
export { IndexedDbGameRepository, buildGameFromTemplates } from "../game-repository";
export type { ContentItemRepository } from "../content-item-repository";
export { IndexedDbContentItemRepository } from "../content-item-repository";
export type { BoardRepository } from "../board-repository";
export { IndexedDbBoardRepository } from "../board-repository";
export type { RelationRepository } from "../relation-repository";
export { IndexedDbRelationRepository } from "../relation-repository";
