/**
 * Database provider — opens `devlofy.db`, migrates, seeds on first run.
 * Children only render after `onInit` completes, so every screen can assume a
 * ready database. Identical behavior on Android and web (wasm + OPFS).
 */
import { SQLiteProvider } from 'expo-sqlite';
import type { PropsWithChildren } from 'react';

import { initializeDatabase } from './migrations';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="devlofy.db" onInit={initializeDatabase}>
      {children}
    </SQLiteProvider>
  );
}
