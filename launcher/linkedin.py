"""Read DOM evidence; act only with browser mouse input, never DOM click() or send APIs."""
import re
import random
import unicodedata
from ledger import canonical

class CompanyUnavailable(RuntimeError):
    """Profile evidence provides no usable primary company to link."""

# Deliberately scoped to the profile header, not recommendations or page-wide text.
INSPECT = r'''() => {
 const visible=e=>!!e && !!e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
 const text=e=>(e?.innerText||'').replace(/\s+/g,' ').trim();
 const main=document.querySelector('main');
 // The observed 2026 top card uses h2 and a self-profile photo anchor.
 const card=main?.querySelector('[componentkey="topcard-logo-image-referencekey"]')?.closest('section');
 const h=card?.querySelector('h1,h2') || main?.querySelector('h1');
 const header=h?.closest('section');
 if(!visible(h)||!header) return {state:'unknown',reason:'Profile header not found'};
 const controls=[...header.querySelectorAll('button,[role="button"],a')].filter(visible);
 const labels=controls.map(e=>text(e));
 const body=text(document.body);
 if(/security verification|verifica[çc][aã]o de seguran[çc]a|weekly invitation limit|limite semanal de convites|temporarily restricted|conta restrita/i.test(body))
   return {state:'blocked',reason:'LinkedIn challenge, restriction or invitation limit'};
 const pending=labels.some(s=>/^(Pendente|Pending)$/i.test(s));
 const degree=[...header.querySelectorAll('.dist-value,[class*="distance-badge"]')].filter(visible).map(text);
 // Walk name-only wrappers to the degree row: verified profiles can add wrappers.
 // Stop at other visible text or the header boundary, never scan the whole card.
 const degreeToken=/^(?:[\u00b7\u2022]\s*)?(?:1st|2nd|3rd\+?|[123][\u00ba\u00b0oa]\+?)$/i;
 for(let row=h.parentElement; row && row!==header; row=row.parentElement){
   const siblings=[...row.children].filter(e=>e!==h && !e.contains(h) && visible(e)).map(text).filter(Boolean);
   const tokens=siblings.filter(s=>degreeToken.test(s));
   if(tokens.length){degree.push(...tokens.map(s=>s.replace(/^[\u00b7\u2022]\s*/,'')));break;}
   if(siblings.length) break;
 }
 const connected=degree.some(s=>/^(1st|1[º°oa])(?:\s|$)/i.test(s)) || labels.some(s=>/^(Remover conex[aã]o|Remove connection)$/i.test(s));
 const connect=controls.filter(e=>/^(Conectar|Connect)$/i.test(text(e)));
 const more=controls.filter(e=>/^(Mais|More|\.\.\.)$/i.test(text(e)) || /^(Mais|More)(?: a[çc][oõ]es| actions)?$/i.test(e.getAttribute('aria-label')||''));
 const companies=[...header.querySelectorAll('a[href*="/company/"]')].filter(visible).map(e=>({url:e.href,name:text(e)}));
 const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(visible);
 const state=pending?'pending':connected?'connected':connect.length===1?'connect':more.length===1?'more':'unknown';
 return {state,name:text(h),labels,companies,dialog:dialogs.length>0,
   reason:state==='unknown'?'No unique Connect or More action in profile header':''};
}'''


def oldest_active_employer(links):
    def normalized(value):
        return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(c))

    def role_rank(title, metadata):
        title, metadata = normalized(title), normalized(metadata)
        if re.search(r'\b(advisor|adviser|advisory|board|conselheiro|conselheira|conselho|volunteer|voluntario|voluntaria|membro|member)\b', title):
            return None, 'advisory, board, membership or volunteer role'
        if re.search(r'\b(freelance|self-employed|autonomo|autonoma|part-time|tempo parcial|meio periodo|volunteer|voluntario|voluntaria)\b', metadata):
            return None, 'freelance, self-employed or part-time role'
        if re.search(r'\b(full-time|tempo integral)\b', metadata):
            return 0, 'current full-time employment'
        return 1, 'current role with unspecified employment type'

    months = {name: i for i, names in enumerate([
        ('jan',), ('feb','fev'), ('mar',), ('apr','abr'), ('may','mai'),
        ('jun',), ('jul',), ('aug','ago'), ('sep','set','sept'), ('oct','out'),
        ('nov',), ('dec','dez')], 1) for name in names}
    active = re.compile(r'^(\w+)\.?\s+(?:de\s+)?(\d{4})\s*[-\u2013\u2014]\s*(?:o momento|atual|presente|present)(?:\s|$)', re.I)
    current = re.compile(r'[-\u2013\u2014]\s*(?:o momento|atual|presente|present)(?:\s|$)', re.I)
    employment = {'tempo integral','tempo parcial','meio per\u00edodo','tempor\u00e1rio','aut\u00f4nomo','aut\u00f4noma','full-time','part-time','contract','freelance','self-employed','temporary','aprendiz','est\u00e1gio','volunteer','volunt\u00e1rio','volunt\u00e1ria'}
    groups = {}
    group_types = {}
    for link in links:
        lines = [x.strip() for x in link['text'].splitlines() if x.strip()]
        if lines and not any(re.search(r'\b\d{4}\s*[-\u2013\u2014]', x) for x in lines):
            groups.setdefault(link['url'], lines[0])
            group_types.setdefault(link['url'], '\n'.join(lines[1:]))
    candidates = []
    excluded = []
    for link in links:
        lines = [x.strip() for x in link['text'].splitlines() if x.strip()]
        for i,line in enumerate(lines):
            if not current.search(line): continue
            match = active.match(line)
            if i < 1:
                raise RuntimeError('An active Experience role has an unreadable start date; review required')
            name = re.split(r'[\u00b7\u2022]', lines[i-1])[0].strip()
            grouped = i == 1 or name.casefold() in employment
            if grouped:
                name = groups.get(link['url'], '')
            if not name:
                raise RuntimeError('An active Experience role has no identifiable employer')
            title = lines[0] if i == 1 else lines[i-2]
            # Explicit role type wins over a grouped employer's inherited type.
            metadata = lines[i-1] if i > 1 else ''
            if grouped and (i == 1 or not any(t in metadata.casefold() for t in employment)):
                metadata = group_types.get(link['url'], '')
            rank, reason = role_rank(title, metadata)
            if rank is None:
                excluded.append(f'{name}: {reason}')
                continue
            if not match or match[1].lower() not in months:
                raise RuntimeError('An active Experience role has an unreadable start date; review required')
            candidates.append({'name':name,'url':canonical(link['url'],'company'), 'rank':rank, 'reason':reason,
                               'start':(int(match[2]),months[match[1].lower()])})
    if not candidates and excluded:
        raise RuntimeError('Only secondary Experience roles found; choose a primary employer in LEF. Excluded: ' + '; '.join(dict.fromkeys(excluded)))
    if not candidates: return None
    # min is stable: an equal date keeps the first/topmost Experience entry.
    selected = min(candidates, key=lambda c:(c['rank'],c['start']))
    selected['reason'] += '; then oldest start date and topmost entry'
    if excluded:
        selected['reason'] += '. Secondary roles excluded: ' + '; '.join(dict.fromkeys(excluded))
    return selected


class LinkedIn:
    def __init__(self, page, before_navigation=None, after_navigation=None, relax=None, step_seconds=0):
        self.page = page
        self.before_navigation = before_navigation or (lambda url: None)
        self.after_navigation = after_navigation or (lambda page: None)
        self.relax = relax or (lambda seconds, label: None)
        self.step_seconds = step_seconds

    def load_state(self, expected):
        if self.page.is_closed():
            raise RuntimeError('The LinkedIn profile tab was closed. No invitation was attempted. Use Retry pre-send errors to revisit it.')
        from urllib.parse import urlsplit
        path = urlsplit(self.page.url).path.lower()
        if any(part in path for part in ('/login', '/uas/', '/authwall', '/checkpoint', '/challenge')):
            raise RuntimeError('LinkedIn requires login or a security check. Complete it in the visible LinkedIn tab, then use Retry pre-send errors and Start. No invitation was attempted.')
        try:
            matches = canonical(self.page.url) == expected
        except ValueError:
            matches = False
        if not matches:
            raise RuntimeError('LinkedIn opened a different page. Review the visible tab before retrying. No invitation was attempted.')
        headings = self.profile_heading()
        if headings.count() == 1 and headings.is_visible():
            return 'ready'
        return 'loading'

    def inspect(self, expected):
        if canonical(self.page.url) != expected:
            raise RuntimeError('LinkedIn redirected or profile changed; review required')
        result = self.page.evaluate(INSPECT)
        if result.get('dialog'):
            raise RuntimeError('An existing LinkedIn dialog is open; review it manually')
        return result

    def profile_heading(self):
        modern = self.page.locator('main [componentkey="topcard-logo-image-referencekey"]').locator('xpath=ancestor::section[1]').locator('h2')
        if modern.count() == 1:
            return modern
        return self.page.locator('main h1')

    def header(self):
        return self.profile_heading().locator('xpath=ancestor::section[1]')

    @staticmethod
    def review_plan(seconds=None):
        down = [random.randint(140, 320) for _ in range(random.randint(2, 4))]
        plan = ([('header', 0, random.uniform(2, 4))]
                + [('scroll', d, random.uniform(1, 2.5)) for d in down]
                + [('scroll', -d, random.uniform(.6, 1.4)) for d in reversed(down)]
                + [('header', 0, random.uniform(1, 2))])
        if seconds is not None:
            total = sum(action[2] for action in plan)
            plan = [(kind, delta, delay * seconds / total) for kind, delta, delay in plan]
        return plan

    def review_step(self, action):
        kind, delta, delay = action
        self.page.bring_to_front()
        size = self.page.evaluate('() => ({width:innerWidth,height:innerHeight})')
        self.page.mouse.move(size['width'] * random.uniform(.25, .50),
                             size['height'] * random.uniform(.30, .65),
                             steps=random.randint(8, 22))
        if kind == 'scroll':
            self.page.mouse.wheel(0, delta)
        else:
            self.header().scroll_into_view_if_needed(timeout=3000)
        return delay

    def browse_profile(self):
        self.page.bring_to_front()
        self.page.mouse.move(450, 350, steps=12)
        for delta in (160, 160, -160, -160):
            self.page.mouse.wheel(0, delta)
            self.page.wait_for_timeout(120)
        self.header().scroll_into_view_if_needed(timeout=3000)

    def unique(self, scope, pattern):
        loc = scope.locator('button,[role="button"],a[href]')
        visible = [loc.nth(i) for i in range(loc.count()) if loc.nth(i).is_visible()
                   and (re.fullmatch(pattern, loc.nth(i).inner_text().strip(), re.I)
                        or re.fullmatch(pattern, loc.nth(i).get_attribute('aria-label') or '', re.I))]
        if len(visible) != 1:
            raise RuntimeError('Expected exactly one visible LinkedIn action; review required')
        return visible[0]

    def mouse(self, locator):
        self.relax(self.step_seconds, 'Reading before clicking')
        self.page.bring_to_front()
        locator.scroll_into_view_if_needed(timeout=3000)
        if not locator.is_enabled():
            raise RuntimeError('LinkedIn action is disabled')
        box = locator.bounding_box()
        if not box:
            raise RuntimeError('LinkedIn action disappeared')
        x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
        # Verify hit target immediately before dispatch; do not force through overlays.
        if not locator.evaluate('''(e,p)=>{
          let t=document.elementFromPoint(p.x,p.y);
          while(t?.shadowRoot){
            const inner=t.shadowRoot.elementFromPoint(p.x,p.y);
            if(!inner||inner===t) break;
            t=inner;
          }
          return e===t||e.contains(t);
        }''', {'x':x,'y':y}):
            raise RuntimeError('LinkedIn action is covered by another element')
        self.page.mouse.move(x, y, steps=random.randint(10, 22))
        self.page.mouse.click(x, y, delay=random.randint(70, 140))

    def more(self):
        self.mouse(self.unique(self.header(), r'^(More|Mais)(?: actions| a[çc][oõ]es)?$'))

    def connect_button(self, in_menu=False):
        if not in_menu:
            return self.unique(self.header(), r'^(Connect|Conectar)$')
        # LinkedIn uses either role=menu or its artdeco dropdown content.
        menus = self.page.locator('[role="menu"],.artdeco-dropdown__content--is-open')
        candidates = []
        for i in range(menus.count()):
            menu = menus.nth(i)
            if not menu.is_visible(): continue
            loc = menu.locator('[role="menuitem"],button,[role="button"]')
            for j in range(loc.count()):
                item = loc.nth(j)
                if item.is_visible() and re.fullmatch(r'Connect|Conectar', item.inner_text().strip(), re.I):
                    candidates.append(item)
        if len(candidates) != 1:
            raise RuntimeError('No unique Connect action under More')
        return candidates[0]

    def send_button(self, expected_name):
        dialogs = self.page.get_by_role('dialog')
        visible = [dialogs.nth(i) for i in range(dialogs.count()) if dialogs.nth(i).is_visible()]
        if len(visible) != 1:
            raise RuntimeError('No unique invitation confirmation dialog')
        dialog = visible[0]
        text = dialog.inner_text()
        # Require the full scraped profile name, not a possibly ambiguous first name.
        if expected_name.casefold() not in ' '.join(text.split()).casefold():
            raise RuntimeError('Invitation dialog recipient does not match the profile full name')
        if dialog.locator('input[type="email"],input[name*="email"]').count():
            raise RuntimeError('LinkedIn requires an email address; manual review required')
        for item in dialog.locator('textarea,[contenteditable="true"]').all():
            if (item.input_value() if item.evaluate('e=>e.tagName') == 'TEXTAREA' else item.inner_text()).strip():
                raise RuntimeError('Unexpected invitation note; only no-note sending was approved')
        return self.unique(dialog, r'^(Send without a note|Enviar sem nota|Enviar sem uma nota|Send|Enviar)$')

    def confirmed(self, expected, expected_name):
        if canonical(self.page.url) != expected:
            return False
        result = self.page.evaluate(INSPECT)
        return (result.get('state') == 'pending' and not result.get('dialog')
                and result.get('name') == expected_name)

    def experience_employer(self, evidence, preferred_names=()):
        heading = self.page.get_by_role('heading', name=re.compile(r'^(Experience|Experi\u00eancia)$', re.I))
        for _ in range(12):
            if heading.count(): break
            self.page.mouse.wheel(0, random.randint(350,550))
            if self.step_seconds:
                self.relax(self.step_seconds, 'Reading Experience while scrolling')
            else:
                self.page.wait_for_timeout(200)
        original = self.page.url
        navigated = False
        if heading.count()!=1:
            # The top card can render while the Experience preview is absent.
            # Read the same profile's normal full Experience page in the browser.
            self.before_navigation(canonical(original) + 'details/experience/')
            self.page.goto(canonical(original) + 'details/experience/', wait_until='domcontentloaded', timeout=30000)
            self.after_navigation(self.page)
            self.page.locator('main a[href*="/company/"]').first.wait_for(timeout=10000)
            section = self.page.locator('main')
            navigated = True
        else:
            section = heading.locator('xpath=ancestor::section[1]')
        section.scroll_into_view_if_needed(timeout=3000)
        details = section.locator('a[href*="/details/experience"]')
        source = section
        try:
            if details.count()==1 and not navigated:
                self.before_navigation(details.get_attribute('href'))
                navigated = True
                self.mouse(details)
                self.page.wait_for_url('**/details/experience/**',timeout=10000)
                self.after_navigation(self.page)
                self.page.locator('main a[href*="/company/"]').first.wait_for(timeout=10000)
                source = self.page.locator('main')
                navigated = True
            links = source.evaluate("e=>[...e.querySelectorAll('a[href*=\"/company/\"]')].filter(a=>a.getClientRects().length).map(a=>({url:a.href,text:a.innerText}))")
            self.relax(self.step_seconds * 2, 'Reading Experience entries')
            # Resolve top-card navigation labels against Experience company links,
            # not Education or recommendations. The header takes precedence over dates.
            for name in preferred_names:
                normalized = ' '.join(name.split()).casefold()
                for link in links:
                    lines = [' '.join(re.split(r'[\u00b7\u2022]', line)[0].split()).casefold()
                             for line in link['text'].splitlines()]
                    if normalized and normalized in lines:
                        employer = {'name':name, 'url':canonical(link['url'], 'company')}
                        evidence.update(employer_name=name, employer_source='Profile header',
                                        companies=[{'url':employer['url'], 'name':name}])
                        return employer
            active_line = re.compile(r'^.*\d{4}\s*[-\u2013\u2014]\s*(?:o momento|atual|presente|present)(?:\s|$)', re.I)
            visible_dates = [line.strip() for line in source.inner_text().splitlines() if active_line.match(line.strip())]
            linked_dates = [line.strip() for link in links for line in link['text'].splitlines() if active_line.match(line.strip())]
            from collections import Counter
            if Counter(visible_dates) - Counter(linked_dates):
                raise CompanyUnavailable('An active Experience role has no company-page link; continuing without company')
            employer = oldest_active_employer(links)
            if not employer and any(re.search(r'\d{4}\s*[-\u2013\u2014]', link['text']) for link in links):
                raise CompanyUnavailable('No active Experience role was identified')
            if employer:
                evidence['employer_name'] = employer['name']
                evidence['employer_start'] = '%04d-%02d' % employer['start']
                evidence['employer_source'] = 'Experience: ' + employer['reason']
                evidence['companies'] = [{'url':employer['url'],'name':employer['name']}]
            return employer
        finally:
            if navigated:
                self.before_navigation(original)
                self.page.goto(original,wait_until='domcontentloaded',timeout=30000)
                self.after_navigation(self.page)
                self.page.wait_for_timeout(500)
            self.header().scroll_into_view_if_needed(timeout=5000)

    def company_url(self, evidence):
        # Direct employer links in the top card precede any Experience ranking.
        # School links use /school/ and never enter this list.
        for item in evidence.get('companies', []):
            try:
                url = canonical(item['url'], 'company')
            except ValueError:
                continue
            evidence['employer_name'] = item.get('name', '')
            evidence['employer_source'] = 'Profile header'
            return url
        controls = self.header().locator('div[role="button"]')
        names = [' '.join(control.inner_text().split()) for control in controls.all()
                 if control.is_visible() and control.inner_text().strip() and control.locator('img,svg').count()]
        if names:
            original = canonical(self.page.url)
            navigation = next(control for control in controls.all()
                              if control.is_visible() and ' '.join(control.inner_text().split()) == names[0]
                              and control.locator('img,svg').count())
            self.mouse(navigation)
            if canonical(self.page.url) != original:
                raise RuntimeError('Employer navigation left the profile; review required')
        employer = self.experience_employer(evidence, names)
        if employer:
            return employer['url']
        raise CompanyUnavailable('Experience has no unique company-page link matching a header employer and no active employer to use as fallback')
