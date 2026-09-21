const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.className = '';
    this.value = '';
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  set innerHTML(_) { this.children = []; }
  setAttribute() {}
  addEventListener(name, fn) { this.listeners[name] = fn; }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.className.split(' ').includes(selector.slice(1))) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

async function main() {
  const calls = [];
  let responseRows = [];
  const ctx = vm.createContext({
    LEFSupabaseService: { getSupabaseRequestContext: async () => ({ supabaseUrl: 'https://test.invalid', accessToken: 'test', userId: 'owner' }) },
    LEFOpenAIService: {
      fetchWithTimeout: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => responseRows }; },
      createProviderHttpError: () => new Error('HTTP failure'),
    },
  });
  vm.runInContext(fs.readFileSync('src/shared/utils.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('src/background/supabase-notes.js', 'utf8'), ctx);
  const payload = { note_title: 'Follow up with customer', note_description: 'Discuss proposal', main_person_id: 'person-a' };
  responseRows = [{ note_id: 123, ...payload }];
  assert.equal((await ctx.LEFSupabaseNotes.supabaseCreateNote(payload)).note_title, payload.note_title);
  assert.equal(JSON.parse(calls[0].options.body)[0].note_title, payload.note_title);
  await ctx.LEFSupabaseNotes.supabaseUpdateNote({ note_id: 123, ...payload });
  assert.equal(JSON.parse(calls[1].options.body).note_title, payload.note_title);
  responseRows = [];
  await assert.rejects(ctx.LEFSupabaseNotes.supabaseUpdateNote({ note_id: 123, ...payload }), /not updated/);
  await assert.rejects(ctx.LEFSupabaseNotes.supabaseCreateNote(payload), /Could not confirm/);

  const list = new Element('div');
  const status = new Element('div');
  const ui = vm.createContext({
    document: { createElement: (tag) => new Element(tag), createTextNode: () => new Element('#text') },
    PopupDom: { notesListEl: list, notesStatusEl: status },
    PopupState: { dbInvitationRow: { id: 'person-a', full_name: 'Test Person' } },
    PopupUtils: { sendRuntimeMessage: async () => { throw new Error('Blank note must not be sent'); } },
  });
  // Expose closure state only inside this isolated test, without changing production exports.
  const source = fs.readFileSync('src/popup/notes/notes-controller.js', 'utf8')
    .replace('  const api = {', '  globalObj.testState = localState;\n  const api = {');
  vm.runInContext(source, ui);
  ui.testState.isCreating = true;
  ui.PopupNotesController.renderNotes();
  const editor = list.querySelector('.note-editor');
  const title = list.querySelector('.note-title-input');
  title.value = 'Keep my draft';
  ui.PopupNotesController.renderNotes();
  assert.equal(list.querySelector('.note-editor'), editor);
  assert.equal(list.querySelector('.note-title-input').value, 'Keep my draft');
  title.value = '';
  const buttons = [];
  function collect(node) { if (node.tagName === 'button') buttons.push(node); node.children.forEach(collect); }
  collect(editor);
  await buttons.find((button) => button.textContent === 'Save').listeners.click();
  assert.match(status.textContent, /Enter a title or description/);
  ui.PopupState.dbInvitationRow = { id: 'person-b' };
  ui.PopupNotesController.renderNotes();
  assert.notEqual(list.querySelector('.note-editor'), editor);
  console.log('PASS: note title serialization, empty-response errors, draft preserved on refresh, blank save blocked, person contexts separated. Mocked only.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
