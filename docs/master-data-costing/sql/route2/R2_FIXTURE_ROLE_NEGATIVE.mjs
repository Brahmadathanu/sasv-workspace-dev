// Synthetic-fixture only. Logs in AS sasv_archive_ro and proves it cannot write, create,
// read outside its grant, call dangerous functions, or escape read-only mode via grants.
// Usage: R2_ROLE_DSN=postgresql://sasv_archive_ro:...@host:port/db node R2_FIXTURE_ROLE_NEGATIVE.mjs
// The DSN is read from the environment only and never printed.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../../package.json', import.meta.url));
const pg = require('pg');
const c = new pg.Client({ connectionString: process.env.R2_ROLE_DSN });
await c.connect();
let failures = 0;
const reject = async (name, sql) => {
  try { await c.query(sql); console.log('FAIL (allowed):', name); failures++; }
  catch (e) { console.log('R2 rejected:', name); }
};
const allow = async (name, sql) => {
  try { await c.query(sql); console.log('R2 allowed:', name); }
  catch (e) { console.log('FAIL (denied):', name, '-', e.message.slice(0, 80)); failures++; }
};
// Allowed: the archiver's own reads.
await allow('read run header', 'SELECT count(*) FROM costing.costing_refresh_run');
await reject('read definer-rights status view (not granted)', 'SELECT count(*) FROM costing.v_costing_period_run_status');
await allow('read archived relation', 'SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=87');
// Denied while read-only default is in force.
await reject('delete (read-only default)', 'DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=-1');
await reject('create table', 'CREATE TABLE costing.zz_x(a int)');
// Denied by GRANTS even when the role switches the read-only default off.
await c.query('SET default_transaction_read_only = off');
await reject('delete (grants)', 'DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=-1');
await reject('update header (grants)', 'UPDATE costing.costing_refresh_run SET overall_status = overall_status WHERE id=-1');
await reject('insert (grants)', "INSERT INTO costing.s3n_pk_07(refresh_run_id,parent_evidence_id,placeholder) VALUES (87,1,'x')");
await reject('truncate (grants)', 'TRUNCATE costing.marketing_regional_sales_evidence_snapshot');
await reject('create table in costing (grants)', 'CREATE TABLE costing.zz_y(a int)');
await reject('create table in public (grants)', 'CREATE TABLE public.zz_z(a int)');
await reject('create schema (grants)', 'CREATE SCHEMA zz_s');
await reject('read ungranted table', 'SELECT 1 FROM costing.material_review_acceptance_register');
await reject('disable trigger', 'ALTER TABLE costing.marketing_signed_billed_sales_evidence_snapshot DISABLE TRIGGER ALL');
// PostgreSQL only WARNS (no error) when a role without grant option tries to GRANT; the acceptance
// script re-runs R2_03 afterwards to prove no privilege changed.
await allow('grant-to-self is a no-op (re-audited by R2_03)', 'GRANT ALL ON costing.costing_refresh_run TO sasv_archive_ro');
await reject('create role', 'CREATE ROLE zz_r');
await reject('set role postgres', 'SET ROLE postgres');
await reject('pg_read_file', "SELECT pg_read_file('postgresql.conf')");
await reject('copy to program', "COPY (SELECT 1) TO PROGRAM 'echo x'");
await reject('large object import', "SELECT lo_import('postgresql.conf')");
await c.end();
console.log(failures ? `R2_ROLE_NEGATIVE_FAIL ${failures}` : 'R2_ROLE_NEGATIVE_PASS');
process.exitCode = failures ? 1 : 0;
