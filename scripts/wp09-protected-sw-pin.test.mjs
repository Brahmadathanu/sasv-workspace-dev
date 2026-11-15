import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rejectedProtectedPaths, REVIEWED_WP09_G2_PINS } from './lib/pec-protected-path-guard.mjs';
const sw = fs.readFileSync('public/sw.js', 'utf8');
const head = 'claude/wp09-g2-launcher-families';
const ctx = (text=sw, branch=head) => ({ headBranch:branch, readText:()=>text });
const reject = (paths, context) => rejectedProtectedPaths(paths, false, context);
const cases = [
 ['exact reviewed SW allowed on named head', () => assert.deepEqual(reject(['public/sw.js'],ctx()),[])],
 ['mutated SW rejected', () => assert.deepEqual(reject(['public/sw.js'],ctx(sw+'x')),['public/sw.js'])],
 ['wrong head rejected', () => assert.deepEqual(reject(['public/sw.js'],ctx(sw,'other')),['public/sw.js'])],
 ['no context rejected', () => assert.deepEqual(reject(['public/sw.js'],null),['public/sw.js'])],
 ['unreadable rejected', () => assert.deepEqual(reject(['public/sw.js'],{headBranch:head,readText(){throw Error('unreadable');}}),['public/sw.js'])],
 ['new SQL never exempted', () => assert.deepEqual(reject(['supabase/migrations/20990000000000.sql'],ctx()),['supabase/migrations/20990000000000.sql'])],
 ['CRLF same reviewed bytes allowed', () => assert.deepEqual(reject(['public/sw.js'],ctx(sw.replace(/\r?\n/g,'\r\n'))),[])],
 ['only SW is pinned', () => assert.deepEqual(Object.keys(REVIEWED_WP09_G2_PINS),['public/sw.js'])],
 ['other approved branches do not gain this hash', () => assert.deepEqual(reject(['public/sw.js'],ctx(sw,'claude/blissful-thompson-lv1ekb')),['public/sw.js'])],
];
for(const [name,run] of cases){run();console.log('PASS '+name);}
console.log(cases.length+'/'+cases.length+' PASS');
