#!/usr/bin/env node
// Copies the shared nav (shared/nav.template.html) into every migrated page,
// between the marker comments
//     <!-- clx-nav:start -->
//     <!-- clx-nav:end -->
// Only that region is rewritten. Each file keeps its own line endings (several
// pages are CRLF) and the start marker's indentation. Every page in PAGES is
// migrated, so a listed page that is missing or has no markers is an error
// (restore its markers, or take it out of PAGES on purpose).
//
//   node scripts/sync-nav.mjs            write the region into every migrated page
//   node scripts/sync-nav.mjs --check    change nothing; exit 1 if any page drifted
//                                        from the template or breaks a nav rule
//   node scripts/sync-nav.mjs --root <site folder>   run against a snapshot
//
// Per page (PAGES below):
//   current    data-nav key that gets aria-current="page" (and marks the More
//              button whose panel holds that item: data-has-current, plus a
//              visually hidden " (current page: <label>)" inside that button)
//   omit       names of <!-- opt:NAME --> ... <!-- /opt:NAME --> blocks to drop
//   showAdmin  render the Admin item without its hidden attribute (admin page)
//
// --check also fails a migrated page that still has the old sidebar or mobile
// nav markup, lacks <body class="... clx-has-botnav">, lacks id="main" on its
// <main>, or does not use the ids installPwaBtn / apaMenuLink exactly once.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const rootIdx = args.indexOf('--root');
const ROOT = path.resolve(rootIdx > -1 ? args[rootIdx + 1] : path.join(HERE, '..'));
const TEMPLATE = path.join(ROOT, 'shared', 'nav.template.html');

const PAGES = [
    { file: 'home/index.html', current: 'home' },
    { file: 'app/index.html', current: 'app' },
    { file: 'sbar/index.html', current: 'sbar' },
    { file: 'careplan/index.html', current: 'careplan' },
    { file: 'clinical/index.html', current: 'clinical' },
    { file: 'resources/index.html', current: 'resources' },
    { file: 'rotationlog/index.html', current: 'rotationlog' },
    { file: 'apa/index.html', current: 'apa' },
    { file: 'profile/index.html', current: 'profile' },
    { file: 'admin/index.html', current: 'admin', showAdmin: true }
];

const START = '<!-- clx-nav:start -->';
const END = '<!-- clx-nav:end -->';
const TEMPLATE_LINE = /<!--\s*clx-nav:template\b[^>]*-->/;

function fail(msg) { console.error('sync-nav: ' + msg); process.exit(2); }

// ---- template ----
const tplRaw = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
const tplLines = tplRaw.split('\n');
const tplAt = tplLines.findIndex((l) => TEMPLATE_LINE.test(l));
if (tplAt < 0) fail('no "clx-nav:template" line in ' + TEMPLATE);
const FRAGMENT = tplLines.slice(tplAt + 1).join('\n').replace(/\n+$/, '');
if (FRAGMENT.includes(START) || FRAGMENT.includes(END)) fail('the template fragment must not contain the page markers');

// Which data-nav keys live in the More panel, per breakpoint: items marked
// clx-more-mobile show only in the phone/tablet sheet; the rest show in both.
const panel = /<div id="clxMore"[\s\S]*?<\/div>\s*\n(?=\s*<a class="clx-profile")/.exec(FRAGMENT);
if (!panel) fail('could not find the #clxMore panel (it must end right before the .clx-profile link)');
const MORE_DESKTOP = new Set(), MORE_MOBILE = new Set();
for (const m of panel[0].matchAll(/<(?:a|button)\b[^>]*>/g)) {
    const key = /\bdata-nav="([\w-]+)"/.exec(m[0]);
    if (!key) continue;
    MORE_MOBILE.add(key[1]);
    if (!/class="[^"]*\bclx-more-mobile\b/.test(m[0])) MORE_DESKTOP.add(key[1]);
}
if (!MORE_DESKTOP.size || !MORE_MOBILE.size) fail('found no data-nav items in the #clxMore panel');
const KEYS = new Set([...FRAGMENT.matchAll(/\bdata-nav="([\w-]+)"/g)].map((m) => m[1]));
// The label of a More-panel item: the text of its <span>.
function moreLabel(key) {
    const m = new RegExp('<a\\b[^>]*\\bdata-nav="' + key + '"[^>]*>[\\s\\S]*?<span>([^<]+)</span>').exec(panel[0]);
    if (!m) fail('no label <span> for the More item "' + key + '"');
    return m[1];
}

function render(page) {
    if (!KEYS.has(page.current)) fail(page.file + ': current "' + page.current + '" is not a data-nav key in the template');
    const omit = new Set(page.omit || []);
    let out = FRAGMENT.replace(/^[ \t]*<!-- opt:([\w-]+) -->\n([\s\S]*?)^[ \t]*<!-- \/opt:\1 -->\n/gm,
        (all, name, body) => (omit.has(name) ? '' : body));
    if (/<!-- \/?opt:/.test(out)) fail('unbalanced opt: block in the template');
    out = out.replace(/(<(?:a|button)\b[^>]*?\bdata-nav="([\w-]+)")/g,
        (all, open, key) => (key === page.current ? open + ' aria-current="page"' : open));
    const sr = (inMore) => (inMore ? '<span class="clx-vh"> (current page: ' + moreLabel(page.current) + ')</span>' : '');
    out = out.replace('{{more-top}}', MORE_DESKTOP.has(page.current) ? ' data-has-current' : '');
    out = out.replace('{{more-bot}}', MORE_MOBILE.has(page.current) ? ' data-has-current' : '');
    out = out.replace('{{more-top-sr}}', sr(MORE_DESKTOP.has(page.current)));
    out = out.replace('{{more-bot-sr}}', sr(MORE_MOBILE.has(page.current)));
    if (/\{\{[\w-]+\}\}/.test(out)) fail('unknown {{placeholder}} left in the template');
    if (page.showAdmin) out = out.replace(/(\bdata-admin) hidden\b/, '$1');
    return out;
}

// Rules every migrated page must meet (the old nav is gone, the new nav's
// hooks are present and unique).
function pageProblems(text) {
    const p = [];
    if (/<aside\b[^>]*\bclx-sidebar\b/.test(text)) p.push('old sidebar <aside class="clx-sidebar"> still present');
    if (/<nav\b[^>]*\bclx-mobile-nav\b/.test(text)) p.push('old <nav class="clx-mobile-nav"> still present');
    if (!/<body\b[^>]*\bclass="[^"]*\bclx-has-botnav\b/.test(text)) p.push('<body> lacks class "clx-has-botnav"');
    if (!/<main\b[^>]*\bid="main"/.test(text)) p.push('<main> lacks id="main" (skip-link target)');
    for (const id of ['installPwaBtn', 'apaMenuLink', 'clxMore', 'main']) {
        const n = (text.match(new RegExp('\\bid="' + id + '"', 'g')) || []).length;
        if (n !== 1 && !(id === 'installPwaBtn' && n === 0)) p.push('id="' + id + '" appears ' + n + ' times (want 1)');
    }
    return p;
}

let drift = 0, problems = 0, written = 0, migrated = 0;
for (const page of PAGES) {
    const file = path.join(ROOT, page.file);
    if (!fs.existsSync(file)) { console.log('  ERROR    ' + page.file + ': file missing'); problems++; continue; }
    const raw = fs.readFileSync(file, 'utf8');
    const s = raw.indexOf(START), e = raw.indexOf(END);
    const nStart = raw.split(START).length - 1, nEnd = raw.split(END).length - 1;
    if (nStart === 0 && nEnd === 0) { console.log('  ERROR    ' + page.file + ': no clx-nav markers (the nav is missing)'); problems++; continue; }
    if (nStart !== 1 || nEnd !== 1 || e < s) { console.log('  ERROR    ' + page.file + ': want exactly one start marker before one end marker'); problems++; continue; }
    migrated++;
    const crlf = (raw.match(/\r\n/g) || []).length, lfOnly = (raw.match(/(?<!\r)\n/g) || []).length;
    const EOL = crlf > lfOnly ? '\r\n' : '\n';
    // Region = from the end of the start marker's line to the start of the end marker's line.
    const lineStart = raw.lastIndexOf('\n', s) + 1;
    const indent = raw.slice(lineStart, s);
    if (/\S/.test(indent)) { console.log('  ERROR    ' + page.file + ': the start marker must be alone on its line'); problems++; continue; }
    const startEol = raw.indexOf('\n', s);
    const endLineStart = raw.lastIndexOf('\n', e) + 1;
    if (startEol < 0 || startEol >= endLineStart) { console.log('  ERROR    ' + page.file + ': the markers must be on separate lines'); problems++; continue; }
    const regionFrom = startEol + 1, regionTo = endLineStart;
    const body = render(page).split('\n').map((l) => (l.length ? indent + l : l)).join(EOL) + EOL;
    const next = raw.slice(0, regionFrom) + body + raw.slice(regionTo);
    const probs = pageProblems(next);
    const changed = next !== raw;
    if (changed) drift++;
    if (probs.length) problems += probs.length;
    const tag = changed ? (CHECK ? 'DRIFT   ' : 'written ') : 'ok      ';
    console.log('  ' + tag + ' ' + page.file + ' (' + (EOL === '\r\n' ? 'CRLF' : 'LF') + ', current=' + page.current + ')' +
        (probs.length ? '\n             ' + probs.map((x) => 'PROBLEM: ' + x).join('\n             ') : ''));
    if (changed && !CHECK) { fs.writeFileSync(file, next); written++; }
}

console.log((CHECK ? 'check: ' : 'sync: ') + migrated + ' migrated page(s), ' +
    (CHECK ? drift + ' drifted' : written + ' written') + ', ' + problems + ' problem(s)');
if (problems || (CHECK && drift)) process.exit(1);
