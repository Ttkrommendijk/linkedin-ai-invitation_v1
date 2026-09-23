"""Operational checkpoints only; CRM remains in the extension's existing service."""
import json
import re
import sqlite3
from datetime import datetime, timezone
from urllib.parse import urlsplit


def canonical(url, kind='in'):
    p = urlsplit(str(url).strip())
    if p.scheme != 'https' or p.hostname not in ('www.linkedin.com', 'br.linkedin.com', 'linkedin.com') or p.port or p.username:
        raise ValueError('Expected an HTTPS LinkedIn URL')
    parts = p.path.strip('/').split('/')
    if len(parts) != 2 or parts[0] != kind or not parts[1]:
        raise ValueError(f'Expected a LinkedIn /{kind}/ URL')
    slug = re.sub(r'%[a-fA-F0-9]{2}', lambda m: m[0].upper(), parts[1])
    return f'https://www.linkedin.com/{kind}/{slug}/'


def now():
    return datetime.now(timezone.utc).isoformat()


class Ledger:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS profiles(url TEXT PRIMARY KEY, position INTEGER NOT NULL,
            step TEXT NOT NULL, outcome TEXT NOT NULL, error TEXT NOT NULL DEFAULT '',
            send_attempted INTEGER NOT NULL DEFAULT 0, confirmed INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, url TEXT, step TEXT,
            outcome TEXT, error TEXT, at TEXT NOT NULL);
        ''')
        # Every crash after durable intent is ambiguous, even if no click occurred.
        with self.db:
            self.db.execute("UPDATE profiles SET outcome='ambiguous', error='Interrupted after send intent; manual review required' WHERE send_attempted=1 AND confirmed=0")

    def meta(self, key, value=None):
        if value is not None:
            with self.db:
                self.db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', (key, json.dumps(value)))
        r = self.db.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
        return json.loads(r[0]) if r else None

    def snapshot(self, urls, owner, resume=''):
        urls = list(dict.fromkeys(canonical(u) for u in urls))
        resume = canonical(resume) if resume else ''
        if resume and resume not in urls:
            raise ValueError('Resume URL is absent from the selected Persons result; batch was not changed')
        if self.rows():
            raise ValueError('An existing batch must be resumed, not replaced')
        stop = urls.index(resume) if resume else -1
        with self.db:
            for i, url in enumerate(urls):
                self.db.execute('INSERT INTO profiles(url,position,step,outcome,updated_at) VALUES (?,?,?,?,?)',
                                (url, i, 'queued', 'resume_excluded' if i <= stop else 'queued', now()))
            self.db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', ('owner', json.dumps(owner)))
            self.db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', ('resume_after', json.dumps(resume)))

    def rows(self):
        return [dict(r) for r in self.db.execute('SELECT * FROM profiles ORDER BY position')]

    def get(self, url):
        r = self.db.execute('SELECT * FROM profiles WHERE url=?', (url,)).fetchone()
        return dict(r) if r else None

    def record(self, url, step, outcome, error='', attempted=None, confirmed=None):
        with self.db:
            self.db.execute('UPDATE profiles SET step=?,outcome=?,error=?,updated_at=?,send_attempted=COALESCE(?,send_attempted),confirmed=COALESCE(?,confirmed) WHERE url=?',
                            (step, outcome, error, now(), attempted, confirmed, url))
            self.db.execute('INSERT INTO events(url,step,outcome,error,at) VALUES (?,?,?,?,?)', (url,step,outcome,error,now()))
            if outcome not in ('working', 'queued', 'awaiting_approval'):
                self.db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', ('last_processed_url', json.dumps(url)))

    def next(self):
        return next((r for r in self.rows() if r['outcome'] in ('queued','working','awaiting_approval') and not r['send_attempted']), None)

    def exclude(self, urls, restore=False):
        saved = self.meta('manual_exclusions') or {}
        changed = 0
        with self.db:
            for url in dict.fromkeys(urls):
                row = self.get(url)
                if not row or row['send_attempted'] or row['confirmed']: continue
                if restore:
                    previous = saved.get(url)
                    if row['outcome'] != 'skipped_manual' or not previous: continue
                    step, outcome, error = previous['step'], previous['outcome'], previous['error']
                    del saved[url]
                else:
                    if row['outcome'] not in ('queued','working','awaiting_approval','dry_run','error'): continue
                    saved[url] = {k:row[k] for k in ('step','outcome','error')}
                    step, outcome, error = 'manual_exclusion', 'skipped_manual', ''
                self.db.execute('UPDATE profiles SET step=?,outcome=?,error=?,updated_at=? WHERE url=?', (step,outcome,error,now(),url))
                self.db.execute('INSERT INTO events(url,step,outcome,error,at) VALUES (?,?,?,?,?)', (url,'manual_restore' if restore else step,outcome,error,now()))
                changed += 1
            self.db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', ('manual_exclusions',json.dumps(saved)))
        return changed

    def review_dry(self):
        with self.db:
            self.db.execute("UPDATE profiles SET outcome='queued',step='queued' WHERE outcome='dry_run' AND send_attempted=0")

    def events(self):
        return [f"{r['at']} {r['url'] or ''} | {r['step']}: {r['outcome']} {r['error']}" for r in
                reversed(self.db.execute('SELECT * FROM events ORDER BY id DESC LIMIT 200').fetchall())]
