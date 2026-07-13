/**
 * Mailgun diagnostic script.
 *
 * Usage (from the backend/ folder):
 *   node scripts/test-mailgun.js you@example.com
 *
 * It loads your .env, prints the (masked) config it will use, sends one test
 * message, and — crucially — prints the REAL Mailgun error if it fails.
 */
require('dotenv').config();
const formData = require('form-data');
const Mailgun = require('mailgun.js');

const recipient = process.argv[2] || process.env.MAILGUN_FROM_EMAIL;

function mask(value) {
    if (!value) return '(not set)';
    if (value.length <= 12) return value;
    return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

const domain = process.env.MAILGUN_DOMAIN;
const apiUrl = process.env.MAILGUN_API_URL || 'https://api.mailgun.net';

console.log('--- Mailgun config ---');
console.log('MAILGUN_API_URL  :', apiUrl);
console.log('MAILGUN_DOMAIN   :', domain || '(not set)');
console.log('MAILGUN_FROM_EMAIL:', process.env.MAILGUN_FROM_EMAIL || '(not set)');
console.log('MAILGUN_FROM_NAME:', process.env.MAILGUN_FROM_NAME || '(not set)');
console.log('MAILGUN_API_KEY  :', mask(process.env.MAILGUN_API_KEY));
console.log('Sending test to  :', recipient);
console.log('----------------------\n');

if (!process.env.MAILGUN_API_KEY || !domain) {
    console.error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set. Aborting.');
    process.exit(1);
}

if (domain.startsWith('sandbox')) {
    console.warn(
        '⚠️  You are using a SANDBOX domain. It can ONLY send to Authorized Recipients.\n' +
        '   Either add the recipient under Sending → Domains → sandbox → Authorized Recipients,\n' +
        '   or switch MAILGUN_DOMAIN to your verified domain (e.g. mg.scribonotes.tech).\n'
    );
}

async function trySend(label, url) {
    console.log(`\n>>> Trying ${label} endpoint: ${url}`);
    const mg = new Mailgun(formData).client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY,
        url,
    });
    try {
        const res = await mg.messages.create(domain, {
            from: `${process.env.MAILGUN_FROM_NAME || 'Scribo Notes'} <${process.env.MAILGUN_FROM_EMAIL || `postmaster@${domain}`}>`,
            to: [recipient],
            subject: 'Scribo Mailgun test',
            text: 'If you can read this, Mailgun is working. 🎉',
        });
        console.log(`✅ SUCCESS via ${label}. Mailgun accepted the message:`);
        console.log(res);
        return true;
    } catch (error) {
        console.error(`❌ FAILED via ${label}. status=${error?.status} details=${error?.details}`);
        return false;
    }
}

async function tryAuth(label, url) {
    console.log(`\n>>> Auth check (list domains) via ${label}: ${url}`);
    const mg = new Mailgun(formData).client({ username: 'api', key: process.env.MAILGUN_API_KEY, url });
    try {
        const res = await mg.domains.list();
        const names = (res.items || res || []).map((d) => d.name).filter(Boolean);
        console.log(`✅ Key AUTHENTICATES via ${label}. Domains visible to this key:`, names.length ? names : '(none)');
        return true;
    } catch (error) {
        console.error(`❌ Auth FAILED via ${label}. status=${error?.status} details=${error?.details}`);
        return false;
    }
}

(async () => {
    // Step 0: does the key authenticate at ALL (independent of sending)?
    const authUS = await tryAuth('US', 'https://api.mailgun.net');
    const authEU = authUS ? false : await tryAuth('EU', 'https://api.eu.mailgun.net');
    if (!authUS && !authEU) {
        console.error('\n❌ The key does not authenticate on either region.');
        console.error('   The key value in MAILGUN_API_KEY is invalid/inactive (rotated, wrong key,');
        console.error('   or the account is still restricted). Regenerate it in Mailgun → Settings → API keys.');
        process.exit(1);
    }

    // Try the configured/US endpoint first, then fall back to EU so a region
    // mismatch (the usual cause of a 401 on a verified domain) is obvious.
    if (await trySend('configured', apiUrl)) return;
    if (apiUrl.includes('api.mailgun.net')) {
        if (await trySend('EU', 'https://api.eu.mailgun.net')) {
            console.log('\n👉 Your account is EU-region. Set MAILGUN_API_URL=https://api.eu.mailgun.net in .env and Render.');
            return;
        }
    }
    console.error('\n❌ Sending failed, but the key AUTHENTICATED and can list your domains.');
    console.error('   => This is an ACCOUNT-LEVEL SENDING RESTRICTION, not a code/key/domain/region issue.');
    console.error('   Mailgun lets you manage the account but is blocking outbound messages (401 Forbidden).');
    console.error('   Fix (Mailgun dashboard, not code):');
    console.error('     1. Look for a banner: "Add payment method" / "Verify account" / "Action required".');
    console.error('     2. Add a payment method — trial/free accounts cannot send from a custom domain until they do.');
    console.error('     3. Tell Mailgun support: "GET /v3/domains works with my key, but');
    console.error('        POST /v3/mg.scribonotes.tech/messages returns 401 Forbidden — please enable sending."');
    process.exit(1);
})();
