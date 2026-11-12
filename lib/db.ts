import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL?.trim() ?? ''

type GlobalDb = typeof globalThis & {
  __ancrumBingoPgPool?: pg.Pool
  __ancrumBingoPglite?: Promise<PGlite>
}

const g = globalThis as GlobalDb

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== '') {
    g.__ancrumBingoPgPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 })
    return (await g.__ancrumBingoPgPool.query(text, params)).rows as T[]
  }
  // globalThis so Next.js route bundles share one in-memory DB in dev
  g.__ancrumBingoPglite ??= startLocal().catch((error: unknown) => {
    g.__ancrumBingoPglite = undefined
    throw error
  })
  return (await (await g.__ancrumBingoPglite).query<T>(text, params)).rows
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite()
  const files = (await readdir('migrations').catch(() => []))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, 'utf8'))
  }
  return db
}
