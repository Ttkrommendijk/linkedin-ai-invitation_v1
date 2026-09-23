"""Executable-only pacing. Counters belong to the persistent launcher journal."""
from datetime import datetime, timedelta, timezone
import time
import re

SAO_PAULO = timezone(timedelta(hours=-3), 'Sao Paulo')
DEFAULTS = dict(invites=10, gap_minutes=30, profiles=30, companies=10, window_hours=24,
                start='09:00', end='17:00', days=[0,1,2,3,4])

class ScheduleWait(RuntimeError):
    def __init__(self, reason, until):
        super().__init__(reason)
        self.until = until

class Scheduler:
    def __init__(self, ledger, clock=time.time):
        self.ledger, self.clock = ledger, clock
        self.db = ledger.db
        self.db.execute('CREATE TABLE IF NOT EXISTS activity_budget(id INTEGER PRIMARY KEY, kind TEXT NOT NULL, at REAL NOT NULL, url TEXT NOT NULL)')
        if not ledger.meta('activity_budget_imported'):
            # Import historical intent, not only successful sends. Never reset on upgrade.
            from datetime import datetime
            with self.db:
                for row in self.db.execute("SELECT p.url, COALESCE(MIN(e.at), p.updated_at) at FROM profiles p LEFT JOIN events e ON e.url=p.url AND e.step='connect_intent' WHERE p.send_attempted=1 GROUP BY p.url").fetchall():
                    self.db.execute('INSERT INTO activity_budget(kind,at,url) VALUES (?,?,?)', ('invite',datetime.fromisoformat(row['at']).timestamp(),row['url']))
            ledger.meta('activity_budget_imported', True)
        self.settings = {**DEFAULTS, **(ledger.meta('execution_schedule') or {})}

    def save(self, value):
        result = {}
        hours = value.get('window_hours', self.settings['window_hours'])
        if type(hours) is not int or hours not in (12, 24):
            raise ValueError('Activity window must be 12 or 24 hours')
        result['window_hours'] = hours
        for key, low, high in [('invites',1,100),('gap_minutes',30,1440),('profiles',1,500),('companies',1,200)]:
            n = value.get(key)
            if type(n) is not int or not low <= n <= high:
                raise ValueError(f'{key} must be between {low} and {high}')
            result[key] = n
        for key in ('start','end'):
            s = value.get(key,'')
            if not isinstance(s,str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',s):
                raise ValueError('Use valid start and end times')
            result[key] = s
        if result['start'] >= result['end']: raise ValueError('Working hours must start before they end')
        days = value.get('days')
        if not isinstance(days,list) or not days or any(type(d) is not int or d not in range(7) for d in days):
            raise ValueError('Select at least one working day')
        result['days'] = sorted(set(days))
        self.ledger.meta('execution_schedule',result)
        self.settings = result

    def window(self, now):
        local = datetime.fromtimestamp(now,SAO_PAULO)
        for offset in range(8):
            day = local + timedelta(days=offset)
            if day.weekday() not in self.settings['days']: continue
            def stamp(key):
                h,m = map(int,self.settings[key].split(':'))
                return day.replace(hour=h,minute=m,second=0,microsecond=0).timestamp()
            start,end = stamp('start'),stamp('end')
            if now < end: return max(now,start),end
        raise RuntimeError('No working window configured')

    def usage(self, kind, now=None):
        now = self.clock() if now is None else now
        return [r[0] for r in self.db.execute('SELECT at FROM activity_budget WHERE kind=? AND at>? ORDER BY at',(kind,now-self.settings['window_hours']*3600))]

    def due(self, kind, spacing=False):
        now = self.clock()
        if self.ledger.meta('execution_hold'):
            raise RuntimeError('LinkedIn warning stop: review the visible browser, then acknowledge it in executable Settings.')
        due,_ = self.window(now)
        reason = 'Outside working hours'
        key = {'invite':'invites','profile':'profiles','company':'companies'}.get(kind)
        if key:
            used = self.usage(kind,now)
            cap = self.settings[key]
            seconds = self.settings['window_hours'] * 3600
            if len(used) >= cap and used[-cap]+seconds > due:
                due,reason = used[-cap]+seconds, f"{kind.title()} rolling {self.settings['window_hours']}-hour limit reached"
        if spacing:
            kinds = ('invite', 'person_start') if kind == 'profile' else ('invite', 'invite')
            last = self.db.execute('SELECT MAX(at) FROM activity_budget WHERE kind IN (?,?)', kinds).fetchone()[0]
            if last is not None and last+self.settings['gap_minutes']*60 > due:
                due,reason = last+self.settings['gap_minutes']*60, 'Spacing between people/invitations'
        due,_ = self.window(due)
        if due > now: raise ScheduleWait(reason,due)
        return due

    def record(self, kind, url):
        with self.db:
            self.db.execute('INSERT INTO activity_budget(kind,at,url) VALUES (?,?,?)',(kind,self.clock(),url))

    def visit(self, url):
        from urllib.parse import urlsplit
        path = urlsplit(url).path
        kind = 'company' if path.startswith('/company/') else 'profile'
        self.due(kind)
        self.record(kind,url) # Reserve before navigation, including failed loads.

    def approval_end(self):
        start,end = self.window(self.clock())
        # Approval is for today's window; do not carry it over nights or weekends.
        now = self.clock()
        if datetime.fromtimestamp(start,SAO_PAULO).date() != datetime.fromtimestamp(now,SAO_PAULO).date():
            raise ScheduleWait('Approve during the next working day',start)
        return end

    def state(self):
        now = self.clock()
        return {'settings':self.settings, 'pace':self.review_pace(), 'used':{k:len(self.usage(k,now)) for k in ('invite','profile','company')},
                'hold':self.ledger.meta('execution_hold') or '',
                'start_estimate':{'live':self.start_estimate(False), 'dry':self.start_estimate(True)}}

    def start_estimate(self, dry):
        due, reason = self.clock(), 'Ready now'
        for kind in (('profile',) if dry else ('profile', 'invite')):
            try:
                self.due(kind, spacing=True)
            except ScheduleWait as exc:
                if exc.until >= due: due, reason = exc.until, str(exc)
            except RuntimeError as exc:
                return {'at':None, 'reason':str(exc)}
        return {'at':due, 'reason':reason}

    def review_pace(self):
        def minutes(key):
            h, m = map(int, self.settings[key].split(':'))
            return h * 60 + m
        slot = max(self.settings['gap_minutes'] * 60,
                   (minutes('end') - minutes('start')) * 60 / self.settings['invites'])
        return {'profile_seconds': min(180, max(45, slot * .05)),
                'step_seconds': min(5, max(1.5, slot / 600)),
                'company_seconds': min(30, max(8, slot / 120))}
