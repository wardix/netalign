import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isTopology } from '../shared/types.ts';
import { closeDatabase, resetDatabase, seedTopology } from './db.ts';

const seedPath = resolve(import.meta.dir, 'data/topology-1.json');

closeDatabase();
resetDatabase(':memory:', { migrateFromJson: false });

const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as unknown;
if (isTopology(seed)) {
  seedTopology(seed);
}