// ສ້າງໄຟລ໌ສຳຮອງເປັນ .sql (INSERT ຢ່າງດຽວ — ບໍ່ມີໂຄງສ້າງຕາຕະລາງ)
//
// ຫຼັກການ: ໃຫ້ Postgres ເປັນຄົນ escape ຄ່າເອງດ້ວຍ quote_nullable(col::text)
// ຈຶ່ງບໍ່ຕ້ອງຂຽນຕົວ escape ເອງ ແລະ ຖືກຕ້ອງທຸກຊະນິດຂໍ້ມູນ (jsonb, ວັນທີ, ຂໍ້ຄວາມລາວ,
// ຄ່າທີ່ມີ quote ຫຼື ຂຶ້ນແຖວໃໝ່). ຕອນ restore ໃສ່ Postgres ຈະແປງ text ກັບຄືນເອງ.
//
// ຕາຕະລາງຖືກລຽງຕາມ FK (ພໍ່ກ່ອນລູກ) ຈຶ່ງແລ່ນໄຟລ໌ໄດ້ຕັ້ງແຕ່ຕົ້ນຫາທ້າຍ.

import { EXPORTABLE_TABLES } from './backupTables.js';

const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name) {
  if (!SAFE_IDENT.test(name)) throw new Error(`ຊື່ຖັນ/ຕາຕະລາງບໍ່ປອດໄພ: ${name}`);
  return `"${name}"`;
}

/** ຊື່ຖັນຂອງ query ໜຶ່ງ — ດຶງດ້ວຍ LIMIT 0 ຈຶ່ງບໍ່ໜັກ */
async function columnsOf(pool, sql) {
  const probe = await pool.query(`SELECT * FROM (${sql}) AS _t LIMIT 0`);
  return probe.fields.map(f => f.name);
}

/**
 * ລຽງຕາຕະລາງຕາມການອ້າງອີງ FK (topological) — ພໍ່ຕ້ອງມາກ່ອນລູກ
 * ຖ້າມີວົງຈອນ (ອ້າງອີງກັນໄປມາ) ຈະຄືນລຳດັບເດີມຂອງອັນທີ່ເຫຼືອ
 */
export async function sortTablesByDependency(pool, names) {
  const wanted = new Set(names);
  const deps = new Map(names.map(n => [n, new Set()]));

  const res = await pool.query(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
       FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`
  );
  for (const { child, parent } of res.rows) {
    if (child === parent) continue;                       // ອ້າງອີງຕົນເອງ — ບໍ່ນັບ
    if (wanted.has(child) && wanted.has(parent)) deps.get(child).add(parent);
  }

  const out = [];
  const done = new Set();
  let progress = true;
  while (out.length < names.length && progress) {
    progress = false;
    for (const name of names) {
      if (done.has(name)) continue;
      if ([...deps.get(name)].every(d => done.has(d))) {
        out.push(name);
        done.add(name);
        progress = true;
      }
    }
  }
  // ເຫຼືອຈາກວົງຈອນ — ໃສ່ທ້າຍໄວ້ ດີກວ່າຕັດຖິ້ມ
  for (const name of names) if (!done.has(name)) out.push(name);
  return out;
}

/** ຄຳສັ່ງ INSERT ຂອງຕາຕະລາງດຽວ (ບໍ່ມີ header) */
export async function dumpTableStatements(pool, table) {
  const sql = EXPORTABLE_TABLES[table];
  if (!sql) throw new Error(`ບໍ່ຮູ້ຈັກຕາຕະລາງ: ${table}`);

  const cols = await columnsOf(pool, sql);
  if (cols.length === 0) return { rows: 0, statements: [] };

  const colList = cols.map(quoteIdent).join(', ');
  const valueList = cols.map(c => `quote_nullable(${quoteIdent(c)}::text)`).join(", ', ', ");

  const gen = await pool.query(
    `SELECT 'INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (' ||
            concat(${valueList}) || ');' AS stmt
       FROM (${sql}) AS _t`
  );

  const statements = gen.rows.map(r => r.stmt);

  // ດັນ sequence ຂອງ id ໃຫ້ເລີຍ MAX(id) — ບໍ່ດັ່ງນັ້ນການເພີ່ມແຖວໃໝ່ຫຼັງກູ້ຄືນຈະຊົນກັນ
  if (cols.includes('id')) {
    statements.push(
      `SELECT CASE WHEN pg_get_serial_sequence('${table}', 'id') IS NOT NULL` +
      ` THEN setval(pg_get_serial_sequence('${table}', 'id'),` +
      ` GREATEST(COALESCE((SELECT MAX(id) FROM ${quoteIdent(table)}), 0), 1),` +
      ` COALESCE((SELECT MAX(id) FROM ${quoteIdent(table)}), 0) > 0) END;`
    );
  }

  return { rows: gen.rows.length, statements };
}

// ── ໂຄງສ້າງຕາຕະລາງ (DDL) ─────────────────────────────────────────────────
// ສ້າງຈາກ catalog ຂອງ Postgres ໂດຍກົງ ຈຶ່ງບໍ່ຕ້ອງເອີ້ນ pg_dump ຈາກເຄື່ອງ
// ຄຳສັ່ງທັງໝົດແລ່ນຊ້ຳໄດ້ (IF NOT EXISTS / ດັກ duplicate_object)

const SEQ_FROM_DEFAULT = /nextval\('"?(?:[\w]+\.)?([\w]+)"?'::regclass\)/;

async function tableColumns(pool, table) {
  const res = await pool.query(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS notnull,
            pg_get_expr(d.adbin, d.adrelid) AS default_expr,
            a.attidentity AS identity
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [table]
  );
  return res.rows;
}

async function tableConstraints(pool, table) {
  const res = await pool.query(
    `SELECT conname AS name, contype AS kind, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY contype, conname`,
    [table]
  );
  return res.rows;
}

async function tableIndexes(pool, table) {
  // ຂ້າມ index ທີ່ເປັນຂອງ constraint ຢູ່ແລ້ວ (PK / UNIQUE) — ບໍ່ດັ່ງນັ້ນຈະສ້າງຊ້ຳ
  const res = await pool.query(
    `SELECT i.indexname AS name, i.indexdef AS def
       FROM pg_indexes i
      WHERE i.schemaname = 'public' AND i.tablename = $1
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c
           WHERE c.conrelid = $1::regclass AND c.conname = i.indexname)
      ORDER BY i.indexname`,
    [table]
  );
  return res.rows;
}

/** ຫຸ້ມຄຳສັ່ງທີ່ອາດມີຢູ່ແລ້ວ ດ້ວຍ DO block ເພື່ອໃຫ້ແລ່ນຊ້ຳໄດ້ */
function ifNotExists(statement) {
  return [
    'DO $$ BEGIN',
    `  ${statement}`,
    'EXCEPTION',
    '  WHEN duplicate_object THEN NULL;',
    '  WHEN duplicate_table THEN NULL;',
    '  WHEN invalid_table_definition THEN NULL;',
    'END $$;',
  ].join('\n');
}

/**
 * DDL ຂອງຕາຕະລາງດຽວ
 * @returns {{ pre: string[], post: string[] }}
 *   pre  = sequence + CREATE TABLE + PK/UNIQUE/CHECK  (ຕ້ອງມາກ່ອນ INSERT)
 *   post = FOREIGN KEY + index                        (ໃສ່ຫຼັງ INSERT ຈຶ່ງບໍ່ຕິດລຳດັບ)
 */
export async function tableSchemaSql(pool, table) {
  const [cols, cons, idxs] = await Promise.all([
    tableColumns(pool, table),
    tableConstraints(pool, table),
    tableIndexes(pool, table),
  ]);
  if (cols.length === 0) return { pre: [], post: [] };

  const pre = [];
  const post = [];

  // sequence ຂອງຖັນ serial — ຕ້ອງມີກ່ອນຕາຕະລາງ ເພາະ default ອ້າງເຖິງມັນ
  const owned = [];
  for (const c of cols) {
    const m = c.default_expr && c.default_expr.match(SEQ_FROM_DEFAULT);
    if (!m) continue;
    const seq = m[1];
    const asType = /^(smallint|integer|bigint)$/.test(c.type) ? ` AS ${c.type}` : '';
    pre.push(`CREATE SEQUENCE IF NOT EXISTS ${quoteIdent(seq)}${asType};`);
    owned.push(`ALTER SEQUENCE ${quoteIdent(seq)} OWNED BY ${quoteIdent(table)}.${quoteIdent(c.name)};`);
  }

  const colLines = cols.map(c => {
    let line = `  ${quoteIdent(c.name)} ${c.type}`;
    if (c.identity === 'a') line += ' GENERATED ALWAYS AS IDENTITY';
    else if (c.identity === 'd') line += ' GENERATED BY DEFAULT AS IDENTITY';
    else if (c.default_expr) line += ` DEFAULT ${c.default_expr}`;
    if (c.notnull) line += ' NOT NULL';
    return line;
  });
  pre.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (\n${colLines.join(',\n')}\n);`);
  pre.push(...owned);

  for (const c of cons) {
    const stmt = `ALTER TABLE ${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(c.name)} ${c.def};`;
    // FK ໄວ້ຫຼັງໃສ່ຂໍ້ມູນ ຈຶ່ງບໍ່ຕ້ອງກັງວົນລຳດັບຕາຕະລາງ
    (c.kind === 'f' ? post : pre).push(ifNotExists(stmt));
  }

  for (const i of idxs) {
    // pg_get_indexdef ໃສ່ "public." ມານຳ — ຕັດອອກເພື່ອໃຫ້ກູ້ໃສ່ schema ໃດກໍໄດ້
    const def = i.def.replace(/ ON public\./, ' ON ')
      .replace(/^CREATE (UNIQUE )?INDEX /, (_, u) => `CREATE ${u || ''}INDEX IF NOT EXISTS `);
    post.push(`${def};`);
  }

  return { pre, post };
}

export const SQL_MODES = ['data', 'schema', 'all'];

export function normalizeSqlMode(mode) {
  const m = String(mode || '').toLowerCase();
  return SQL_MODES.includes(m) ? m : 'data';
}

const MODE_TITLE = {
  data: 'ຂໍ້ມູນຢ່າງດຽວ (ບໍ່ມີໂຄງສ້າງຕາຕະລາງ)',
  schema: 'ໂຄງສ້າງຕາຕະລາງຢ່າງດຽວ (ບໍ່ມີຂໍ້ມູນ)',
  all: 'ໂຄງສ້າງຕາຕະລາງ + ຂໍ້ມູນ',
};

function header(lines, mode = 'data') {
  const notes = mode === 'data'
    ? ['-- ຕ້ອງມີໂຄງສ້າງຕາຕະລາງຢູ່ກ່ອນ ແລະ ຄວນເປັນຖານຂໍ້ມູນຫວ່າງ',
       '-- (ຖ້າມີຂໍ້ມູນຢູ່ແລ້ວ INSERT ຈະຊົນກັນ — ລ້າງກ່ອນ ຫຼື ກູ້ໃສ່ຖານຂໍ້ມູນໃໝ່)']
    : mode === 'schema'
      ? ['-- ສ້າງແຕ່ຕາຕະລາງ / index / constraint — ບໍ່ມີແຖວຂໍ້ມູນ',
         '-- ແລ່ນຊ້ຳໄດ້ (IF NOT EXISTS) ຈຶ່ງບໍ່ທຳລາຍຂອງເກົ່າ']
      : ['-- ສ້າງຕາຕະລາງໃຫ້ເອງ ຈຶ່ງກູ້ໃສ່ຖານຂໍ້ມູນຫວ່າງໆໄດ້ເລີຍ',
         '-- ໂຄງສ້າງແລ່ນຊ້ຳໄດ້ ແຕ່ຂໍ້ມູນຈະຊົນຖ້າຕາຕະລາງມີແຖວຢູ່ແລ້ວ'];
  return [
    `-- ສຳຮອງ POS · ${MODE_TITLE[mode]}`,
    `-- ສ້າງເມື່ອ: ${new Date().toISOString()}`,
    '-- ບໍ່ມີ users / sessions (ລະຫັດຜ່ານ) ຢູ່ໃນໄຟລ໌ນີ້',
    '--',
    '-- ວິທີກູ້ຄືນ:  psql -d <ຖານຂໍ້ມູນ> -f <ໄຟລ໌ນີ້>',
    ...notes,
    ...lines,
    '',
    'SET client_encoding = \'UTF8\';',
    'SET standard_conforming_strings = on;',
    '',
    'BEGIN;',
    '',
  ].join('\n');
}

/** ໄຟລ໌ .sql ຂອງຕາຕະລາງດຽວ · mode = data | schema | all */
export async function dumpTableSql(pool, table, mode = 'data') {
  const m = normalizeSqlMode(mode);
  const wantSchema = m === 'schema' || m === 'all';
  const wantData = m === 'data' || m === 'all';

  const schema = wantSchema ? await tableSchemaSql(pool, table) : { pre: [], post: [] };
  const data = wantData ? await dumpTableStatements(pool, table) : { rows: 0, statements: [] };

  const body = [];
  if (wantSchema) {
    body.push(`-- ── ໂຄງສ້າງ: ${table} ──`, ...schema.pre, '');
  }
  if (wantData) {
    body.push(`-- ── ຂໍ້ມູນ: ${table} · ${data.rows} ແຖວ ──`);
    body.push(data.statements.length ? data.statements.join('\n') : '-- (ບໍ່ມີຂໍ້ມູນ)');
    body.push('');
  }
  if (wantSchema && schema.post.length) {
    body.push(`-- ── FK / index: ${table} ──`, ...schema.post, '');
  }

  return [
    header([`-- ຕາຕະລາງ: ${table}${wantData ? ` (${data.rows} ແຖວ)` : ''}`], m),
    ...body,
    'COMMIT;',
    '',
  ].join('\n');
}

/** ໄຟລ໌ .sql ຂອງທຸກຕາຕະລາງ ລຽງຕາມ FK · mode = data | schema | all */
export async function dumpAllSql(pool, mode = 'data') {
  const m = normalizeSqlMode(mode);
  const wantSchema = m === 'schema' || m === 'all';
  const wantData = m === 'data' || m === 'all';

  const names = Object.keys(EXPORTABLE_TABLES);
  const ordered = await sortTablesByDependency(pool, names);

  const pre = [];
  const body = [];
  const post = [];
  let totalRows = 0;

  for (const table of ordered) {
    if (wantSchema) {
      const schema = await tableSchemaSql(pool, table);
      pre.push(`-- ── ໂຄງສ້າງ: ${table} ──`, ...schema.pre, '');
      if (schema.post.length) post.push(`-- ── FK / index: ${table} ──`, ...schema.post, '');
    }
    if (wantData) {
      const data = await dumpTableStatements(pool, table);
      totalRows += data.rows;
      body.push(`-- ── ຂໍ້ມູນ: ${table} · ${data.rows} ແຖວ ──`);
      body.push(data.statements.length ? data.statements.join('\n') : '-- (ບໍ່ມີຂໍ້ມູນ)');
      body.push('');
    }
  }

  const summary = wantData
    ? `-- ${ordered.length} ຕາຕະລາງ · ${totalRows} ແຖວ (ລຽງຕາມການອ້າງອີງ FK)`
    : `-- ${ordered.length} ຕາຕະລາງ`;

  return [
    header([summary], m),
    ...(pre.length ? ['-- ═══ ໂຄງສ້າງຕາຕະລາງ ═══', ''] : []), ...pre,
    ...(body.length ? ['-- ═══ ຂໍ້ມູນ ═══', ''] : []), ...body,
    ...(post.length ? ['-- ═══ FOREIGN KEY / INDEX ═══', ''] : []), ...post,
    'COMMIT;',
    '',
  ].join('\n');
}
