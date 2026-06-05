import { createContext, useContext, type ReactNode } from 'react';
import { defaultMurderBoardRepository } from '../../storage/default-repository';
import type { MurderBoardRepository } from '../../storage/repositories';

const MurderBoardRepositoryContext = createContext<MurderBoardRepository | null>(null);

interface MurderBoardDataProviderProps {
  children: ReactNode;
  repository?: MurderBoardRepository;
}

export function MurderBoardDataProvider({
  children,
  repository = defaultMurderBoardRepository,
}: MurderBoardDataProviderProps) {
  return (
    <MurderBoardRepositoryContext.Provider value={repository}>
      {children}
    </MurderBoardRepositoryContext.Provider>
  );
}

export function useMurderBoardRepository() {
  return useContext(MurderBoardRepositoryContext) ?? defaultMurderBoardRepository;
}
