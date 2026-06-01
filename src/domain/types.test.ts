import { CORE_ENTITY_TYPES, isCoreEntityType } from './types';

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
});
