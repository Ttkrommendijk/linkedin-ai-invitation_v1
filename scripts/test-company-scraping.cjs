const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const url = 'https://www.linkedin.com/company/vix-logistica/';
const mainText = 'Vix Logistica\nSoluções Logísticas Customizadas\nTransporte, armazenagem e correio\nVitoria, Espírito Santo\n345 mil seguidores\n+ de 10 mil funcionários\nEnviar mensagem\nSales Navigator\nVisão geral\nEspecializada em soluções logísticas customizadas.';
let loaded = true;
const summaries = ['Transporte, armazenagem e correio', '345 mil seguidores', 'Vitoria, Espírito Santo'];
const dom = {
  title: '(1) Vix Logistica: visão geral | LinkedIn',
  querySelector(selector) {
    if (!loaded) return null;
    if (selector === 'main') return { innerText: mainText };
    if (selector === 'main h1' || selector === 'h1') return { innerText: 'Vix Logistica' };
    if (selector === '.org-top-card-summary-info-list__info-item') return { innerText: summaries[0] };
    return null;
  },
  querySelectorAll() { return loaded ? summaries.map(innerText => ({ innerText })) : []; },
};
const scraper = vm.createContext({ document: dom, window: { location: { href: url } } });
const content = fs.readFileSync('src/content/content.js', 'utf8');
vm.runInContext(content.slice(0, content.indexOf('function isUiNoiseLine')), scraper);
const company = scraper.extractCompanyProfile();
assert.equal(company.city, 'Vitoria, Espírito Santo');
assert.equal(company.sector, summaries[0]);
assert.ok(company.company_page_excerpt.includes('Sales Navigator'));
assert.equal(scraper.textAfterLabel('Sede\nVitoria, Espírito Santo\nSeguidores\n345 mil', ['Sede']), 'Vitoria, Espírito Santo');
loaded = false;
assert.equal(scraper.extractCompanyProfile().company_name, '');

let time = 0, reads = 0, mode = 'loading';
let llmPayload;
const trim = value => String(value ?? '').trim();
const controller = vm.createContext({
  PopupDom: {}, PopupUtils: { safeTrim: trim }, PopupState: {},
  PopupLogger: { debug() {} }, PopupStatusConstants: {},
  safeTrim: trim, canonicalizeLinkedInUrl: value => value,
  normalizeCompanyLinkedinId: profile => profile.linkedin_id,
  isCompanyProfileMode: profile => profile.is_company_profile === true,
  sendRuntimeMessage: async (_type, request) => {
    llmPayload = request.payload.profile;
    return { ok: true, data: { ok: true, company_name: 'Vix Logistica' } };
  },
  getScrapeUrl: value => value?.url || '', getErrorMessage: e => e?.message || '',
  Date: { now: () => time },
  setTimeout: fn => { time += 200; fn(); },
  chrome: { storage: { local: { get: async () => ({ apiKey: 'mock' }) }, sync: { get: async () => ({ model: 'mock' }) } }, tabs: {
    query: async () => [{ id: 1, url }],
    sendMessage: async () => {
      reads++;
      if (mode === 'wrong-url') return { ok: true, company: { ...company, linkedin_id: url + 'wrong/' } };
      return { ok: true, company: mode === 'empty' || reads === 1
        ? { url, linkedin_id: url, company_name: '(1) Vix Logistica: visão geral', company_page_excerpt: '' }
        : company };
    },
  } },
});
vm.runInContext(fs.readFileSync('src/popup/profile-flow/profile-controller.js', 'utf8'), controller);
(async () => {
  const api = controller.PopupProfileController;
  await api.getFreshScrapeForPage({ page_type: 'company', linkedin_id: url }, { force: true });
  assert.equal(reads, 2);
  assert.equal(controller.latestCompanyScrape.city, 'Vitoria, Espírito Santo');
  await api.extractCompanyDetailsFromLlm(controller.latestCompanyScrape);
  assert.ok(llmPayload.company_page_excerpt.includes('Sales Navigator'));
  assert.equal(llmPayload.sector, summaries[0]);
  const previous = reads;
  await api.getFreshScrapeForPage({ page_type: 'company', linkedin_id: url }, { force: true });
  assert.equal(reads, previous + 1);
  mode = 'empty'; time = 0;
  await assert.rejects(api.getFreshScrapeForPage({ page_type: 'company', linkedin_id: url }, { force: true }), /still loading/);
  assert.equal(controller.latestCompanyScrape, null);
  mode = 'wrong-url'; time = 0;
  await assert.rejects(api.getFreshScrapeForPage({ page_type: 'company', linkedin_id: url }, { force: true }), /still loading/);
  console.log('PASS: location vs followers, label boundaries, no title fallback, retry until ready, fresh scrape, incomplete cache rejected, wrong URL rejected. Mocked only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
