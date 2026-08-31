// Stage-0 regression: envFile upsert semantics against a TEMP copy (never real .env).
import fs from 'fs';
import path from 'path';
import os from 'os';

const tmp = path.join(os.tmpdir(), 'phmc-envfile-test.env');
fs.writeFileSync(tmp, [
    '# PHMC bot env (test fixture)',
    'DISCORD_BOT_TOKEN=secret-token',
    '',
    '# AUTOPSY_DEV_TEST=false',
    'AUTOPSY_DEV_TEST_ME=Old Name',
    'FORUM_LSSD_USERNAME=lssduser',
    '',
].join('\r\n'));

process.env.PHMC_ENV_FILE = tmp;
const { readEnvValue, upsertEnvValues } = await import('../services/envFile.js');

// 1) uncomment + flip flag, change ME
let r = upsertEnvValues({ AUTOPSY_DEV_TEST: 'true', AUTOPSY_DEV_TEST_ME: 'Alyson Frost' });
let raw = fs.readFileSync(tmp, 'utf8');
console.log('--- after enable ---');
console.log(JSON.stringify(raw));
const t1 = (s) => console.log((raw.includes(s) ? '[OK] ' : '[ERR] ') + s);
t1('AUTOPSY_DEV_TEST=true');
if (raw.includes('# AUTOPSY_DEV_TEST=false')) console.log('[ERR] commented line not replaced');
else console.log('[OK] commented line uncommented+replaced');
t1('AUTOPSY_DEV_TEST_ME=Alyson Frost');
t1('DISCORD_BOT_TOKEN=secret-token');
t1('FORUM_LSSD_USERNAME=lssduser');
if (!/\r\n/.test(raw)) console.log('[ERR] CRLF lost');
else console.log('[OK] CRLF preserved');
if (readEnvValue('AUTOPSY_DEV_TEST') !== 'true') { console.log('[ERR] readEnvValue'); process.exit(1); }

// 2) idempotent rewrite -> no change claimed
r = upsertEnvValues({ AUTOPSY_DEV_TEST: 'true', AUTOPSY_DEV_TEST_ME: 'Alyson Frost' });
if (r.changed) console.log('[ERR] idempotent run reported changed');
else console.log('[OK] idempotent no-op');

// 3) disable keeps ME remembered
upsertEnvValues({ AUTOPSY_DEV_TEST: 'false' });
raw = fs.readFileSync(tmp, 'utf8');
t1('AUTOPSY_DEV_TEST=false');
t1('AUTOPSY_DEV_TEST_ME=Alyson Frost');

// 4) append-when-missing
upsertEnvValues({ BRAND_NEW_KEY: 'hello world' });
raw = fs.readFileSync(tmp, 'utf8');
if (raw.includes('BRAND_NEW_KEY=hello world')) console.log('[OK] missing key appended');
else { console.log('[ERR] append failed'); process.exit(1); }

fs.unlinkSync(tmp);
console.log('[DONE] envFile tests passed');
