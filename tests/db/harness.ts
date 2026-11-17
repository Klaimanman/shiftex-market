/**
 * Database test harness.
 * Runs the real migrations inside PGlite (Postgres compiled to WASM) with a minimal
 * stub of Supabase's `auth` schema and roles, then lets tests act as specific users
 * under the `authenticated` role so RLS and grants are exercised exactly as in production.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');
// Platform-only migration (pg_cron, storage, realtime) is not portable to PGlite.
const SKIP = ['_platform.sql'];

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

export class TestDb {
  private constructor(public pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = new PGlite();
    await pg.exec(SUPABASE_STUB);
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !SKIP.some((s) => f.endsWith(s)))
      .sort();
    for (const f of files) {
      try {
        await pg.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
      } catch (e) {
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
      }
    }
    return new TestDb(pg);
  }

  /** Run as the database owner (like the Supabase SQL editor / cron). */
  async system<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    const r = await this.pg.query<T>(sql, params);
    return r.rows;
  }

  /** Run as an authenticated end-user (RLS applies). */
  async as<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
    try {
      const r = await this.pg.query<T>(sql, params);
      return r.rows;
    } finally {
      await this.pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  /** Execute and return the error message (or null if it succeeded). */
  async asError(userId: string, sql: string, params: unknown[] = []): Promise<string | null> {
    try {
      await this.as(userId, sql, params);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async createAuthUser(id: string, email: string, name: string): Promise<void> {
    await this.system(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id,
      email,
      JSON.stringify({ full_name: name }),
    ]);
  }
}

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
