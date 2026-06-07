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
  // ---- new configurable types ----
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  NODE_SHAPES,
  ACQUISITION_STATUSES,
  BOARD_KINDS,
  isFieldType,
  isAcquisitionStatus,
  isBoardKind,
  isNodeShape,
  fieldsMatch,
  instantiateContentType,
  computeUnlockRelations,
  type FieldType,
  type FieldDefinition,
  type ContentTypeTemplate,
  type ContentType,
  type AcquisitionStatus,
  type UnlockBlock,
  type ContentItem,
  type BoardKind,
  type Board,
  type NodeShape,
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

describe("configurable content type system", () => {
  it("provides exactly 9 field types", () => {
    expect(FIELD_TYPES).toHaveLength(9);
    expect(FIELD_TYPES).toEqual([
      "single-line-text",
      "multi-line-text",
      "datetime",
      "date-range",
      "number",
      "enum",
      "boolean",
      "reference",
      "unlock-block",
    ]);
  });

  it("checks whether a value is a valid field type", () => {
    expect(isFieldType("single-line-text")).toBe(true);
    expect(isFieldType("enum")).toBe(true);
    expect(isFieldType("unlock-block")).toBe(true);
    expect(isFieldType("unknown-type")).toBe(false);
  });

  it("provides Chinese labels for every field type", () => {
    for (const ft of FIELD_TYPES) {
      expect(FIELD_TYPE_LABELS[ft]).toEqual(expect.any(String));
    }
  });

  it("lists acquisition statuses", () => {
    expect(ACQUISITION_STATUSES).toEqual(["locked", "unlocked", "acquired"]);
  });

  it("checks whether a value is an acquisition status", () => {
    expect(isAcquisitionStatus("locked")).toBe(true);
    expect(isAcquisitionStatus("acquired")).toBe(true);
    expect(isAcquisitionStatus("deleted")).toBe(false);
  });

  it("lists board kinds", () => {
    expect(BOARD_KINDS).toEqual(["sub", "master"]);
    expect(isBoardKind("sub")).toBe(true);
    expect(isBoardKind("master")).toBe(true);
    expect(isBoardKind("archive")).toBe(false);
  });

  it("lists node shapes", () => {
    expect(NODE_SHAPES).toEqual(["circle", "square", "diamond", "hexagon"]);
    expect(isNodeShape("circle")).toBe(true);
    expect(isNodeShape("hexagon")).toBe(true);
    expect(isNodeShape("triangle")).toBe(false);
  });

  describe("fieldsMatch", () => {
    const base: FieldDefinition[] = [
      { name: "title", type: "single-line-text", required: true },
      { name: "content", type: "multi-line-text", required: false },
    ];

    it("matches when name+type sets are identical", () => {
      const same: FieldDefinition[] = [
        { name: "content", type: "multi-line-text", required: true },
        { name: "title", type: "single-line-text", required: false },
      ];
      expect(fieldsMatch(base, same)).toBe(true);
    });

    it("rejects when length differs", () => {
      const shorter: FieldDefinition[] = [
        { name: "title", type: "single-line-text", required: true },
      ];
      expect(fieldsMatch(base, shorter)).toBe(false);
    });

    it("rejects when a field type differs", () => {
      const diff: FieldDefinition[] = [
        { name: "title", type: "single-line-text", required: true },
        { name: "content", type: "number", required: false },
      ];
      expect(fieldsMatch(base, diff)).toBe(false);
    });

    it("ignores required and enumOptions in comparison", () => {
      const extra: FieldDefinition[] = [
        { name: "title", type: "single-line-text", required: false },
        { name: "content", type: "multi-line-text", required: true, enumOptions: ["a"] },
      ];
      expect(fieldsMatch(base, extra)).toBe(true);
    });
  });

  describe("instantiateContentType", () => {
    it("deep-copies a template into a ContentType with game binding", () => {
      const template: ContentTypeTemplate = {
        id: "tpl-1",
        name: "validator",
        fields: [{ name: "x", type: "boolean", required: true }],
        visual: { color: "#ff0000", shape: "circle" },
        unlockEnabled: false,
        createdAt: "2026-06-07T00:00:00.000Z",
      };
      let idCounter = 0;
      const ct = instantiateContentType(template, "game-1", () => `ct-${++idCounter}`);

      expect(ct.id).toBe("ct-1");
      expect(ct.gameId).toBe("game-1");
      expect(ct.templateId).toBe("tpl-1");
      expect(ct.name).toBe("validator");
      expect(ct.fields).toEqual([{ name: "x", type: "boolean", required: true }]);
      expect(ct.visual).toEqual({ color: "#ff0000", shape: "circle" });
      expect(ct.unlockEnabled).toBe(false);
    });

    it("does not mutate the original template when the copy is modified", () => {
      const template: ContentTypeTemplate = {
        id: "tpl-2",
        name: "immutable-check",
        fields: [{ name: "note", type: "multi-line-text", required: false }],
        visual: { color: "#000000", shape: "square" },
        unlockEnabled: true,
        createdAt: "2026-06-07T00:00:00.000Z",
      };
      const copy = instantiateContentType(template, "game-2", () => "ct-immutable");
      copy.name = "mutated";
      copy.fields[0].required = true;
      copy.visual.color = "#ffffff";

      expect(template.name).toBe("immutable-check");
      expect(template.fields[0].required).toBe(false);
      expect(template.visual.color).toBe("#000000");
    });
  });

  describe("computeUnlockRelations", () => {
    const baseItem = (
      id: string,
      title: string,
      unlockBlocks: UnlockBlock[],
      status: AcquisitionStatus = "acquired",
    ): ContentItem => ({
      id,
      gameId: "g",
      contentTypeId: "ct",
      title,
      fieldValues: {},
      unlockBlocks,
      acquisitionStatus: status,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });

    it("returns empty when no unlock blocks exist", () => {
      const items = [baseItem("a", "Alpha", [])];
      expect(computeUnlockRelations(items)).toEqual([]);
    });

    it("creates a relation when a block matches a target title", () => {
      const block: UnlockBlock = {
        id: "b-1",
        targetName: "Beta",
        requiredPerson: null,
        requiredLocation: null,
        status: "unlocked",
      };
      const items = [
        baseItem("a", "Alpha", [block]),
        baseItem("b", "Beta", []),
      ];
      const relations = computeUnlockRelations(items);
      expect(relations).toEqual([
        {
          fromContentItemId: "a",
          toContentItemId: "b",
          unlockBlockId: "b-1",
        },
      ]);
    });

    it("skips locked blocks", () => {
      const block: UnlockBlock = {
        id: "b-locked",
        targetName: "Beta",
        requiredPerson: null,
        requiredLocation: null,
        status: "locked",
      };
      const items = [
        baseItem("a", "Alpha", [block]),
        baseItem("b", "Beta", []),
      ];
      expect(computeUnlockRelations(items)).toEqual([]);
    });

    it("creates relation when block is acquired", () => {
      const block: UnlockBlock = {
        id: "b-acq",
        targetName: "Beta",
        requiredPerson: null,
        requiredLocation: null,
        status: "acquired",
      };
      const items = [
        baseItem("a", "Alpha", [block]),
        baseItem("b", "Beta", [], "acquired"),
      ];
      expect(computeUnlockRelations(items)).toHaveLength(1);
    });

    it("skips blocks whose target does not exist", () => {
      const block: UnlockBlock = {
        id: "b-orphan",
        targetName: "Ghost",
        requiredPerson: null,
        requiredLocation: null,
        status: "unlocked",
      };
      const items = [baseItem("a", "Alpha", [block])];
      expect(computeUnlockRelations(items)).toEqual([]);
    });

    it("handles multiple blocks and partial matches", () => {
      const block1: UnlockBlock = {
        id: "b1",
        targetName: "Beta",
        requiredPerson: null,
        requiredLocation: null,
        status: "unlocked",
      };
      const block2: UnlockBlock = {
        id: "b2",
        targetName: "Gamma",
        requiredPerson: null,
        requiredLocation: null,
        status: "acquired",
      };
      const block3: UnlockBlock = {
        id: "b3",
        targetName: "Ghost",
        requiredPerson: null,
        requiredLocation: null,
        status: "unlocked",
      };
      const items = [
        baseItem("a", "Alpha", [block1, block2, block3]),
        baseItem("b", "Beta", []),
        baseItem("c", "Gamma", []),
      ];
      const relations = computeUnlockRelations(items);
      expect(relations).toHaveLength(2);
      expect(relations.map((r) => r.toContentItemId).sort()).toEqual(["b", "c"]);
    });
  });
});
