import {
  BOARD_NODE_TYPES,
  BOARD_RELATION_TYPES,
  CASE_STATUSES,
  CORE_ENTITY_TYPES,
  HYPOTHESIS_STATUSES,
  isBoardNodeType,
  isBoardRelationType,
  isCaseStatus,
  isCoreEntityType,
  isHypothesisStatus,
  isIsoDateString,
  type Case,
  type Event,
  type IsoDateString,
  type TimelineEvent,
  type Workspace,
} from './types';

describe('domain types', () => {
  it('lists the core entity types from the product model', () => {
    expect(CORE_ENTITY_TYPES).toEqual([
      'character',
      'location',
      'object',
      'organization',
      'concept',
    ]);
  });

  it('checks whether a value is a core entity type', () => {
    expect(isCoreEntityType('character')).toBe(true);
    expect(isCoreEntityType('scene')).toBe(false);
  });

  it('requires timeline events to have an occurrence time', () => {
    expectTypeOf<TimelineEvent['occurredAt']>().toEqualTypeOf<IsoDateString>();
  });

  it('lists the case statuses from the storage model', () => {
    expect(CASE_STATUSES).toEqual(['draft', 'active', 'archived', 'deleted']);
  });

  it('checks whether a value is a case status', () => {
    expect(isCaseStatus('active')).toBe(true);
    expect(isCaseStatus('closed')).toBe(false);
  });

  it('checks structured ISO DateTime strings', () => {
    expect(isIsoDateString('2026-06-01T12:30:00.000Z')).toBe(true);
    expect(isIsoDateString('2026-06-01T20:30:00+08:00')).toBe(true);
    expect(isIsoDateString('2026-06-01')).toBe(false);
    expect(isIsoDateString('not a date')).toBe(false);
  });

  it('models soft deletion and separate story event time', () => {
    expectTypeOf<Workspace['deletedAt']>().toEqualTypeOf<IsoDateString | null>();
    expectTypeOf<Case['statusBeforeDelete']>().toEqualTypeOf<
      'draft' | 'active' | 'archived' | null
    >();
    expectTypeOf<Event['occurredAt']>().toEqualTypeOf<IsoDateString>();
  });

  describe('board domain types', () => {
    it('defines the first-version board node types', () => {
      expect(BOARD_NODE_TYPES).toEqual(['person', 'clue', 'event', 'hypothesis']);
      expect(isBoardNodeType('person')).toBe(true);
      expect(isBoardNodeType('clue')).toBe(true);
      expect(isBoardNodeType('event')).toBe(true);
      expect(isBoardNodeType('hypothesis')).toBe(true);
      expect(isBoardNodeType('workspace')).toBe(false);
    });

    it('defines semantic board relation types', () => {
      expect(BOARD_RELATION_TYPES).toEqual([
        'related',
        'supports',
        'refutes',
        'sequence',
        'suspect',
      ]);
      expect(isBoardRelationType('supports')).toBe(true);
      expect(isBoardRelationType('refutes')).toBe(true);
      expect(isBoardRelationType('unknown')).toBe(false);
    });

    it('defines hypothesis statuses as player-owned reasoning states', () => {
      expect(HYPOTHESIS_STATUSES).toEqual(['unverified', 'plausible', 'refuted']);
      expect(isHypothesisStatus('unverified')).toBe(true);
      expect(isHypothesisStatus('solved')).toBe(false);
    });
  });
});
