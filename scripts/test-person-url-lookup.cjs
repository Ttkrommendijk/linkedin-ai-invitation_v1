const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
let storedUrl;
let requests = 0;
const context = {
  URL, console, setTimeout, clearTimeout,
  LEFSupabaseService: {
    getSupabaseRequestContext: async () => ({
      supabaseUrl: "https://example.test", supabaseAnonKey: "test-key", accessToken: "test-token",
    }),
  },
  LEFOpenAIService: {
    fetchWithTimeout: async (url, options) => {
      requests++;
      assert.equal(options.method, "GET");
      assert.equal(options.headers.Authorization, "Bearer test-token");
      const filter = new URL(url).searchParams.get("or");
      const candidates = filter.slice(1, -1).split(",").map(part => {
        assert.ok(part.startsWith("linkedin_url.eq."));
        return part.slice("linkedin_url.eq.".length);
      });
      return {
        ok: true,
        json: async () => candidates.includes(storedUrl)
          ? [{ id: "existing-person", linkedin_url: storedUrl }] : [],
      };
    },
  },
};
vm.createContext(context);
for (const file of ["src/shared/utils.js", "src/background/supabase-invitations.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}

async function main() {
  const lookup = context.LEFSupabaseInvitations.supabaseGetInvitationByLinkedinUrl;
  const slugs = ["ant%c3%b4niocerqueira", "ant%C3%B4niocerqueira", "plain-profile"];
  for (const storedSlug of slugs) {
    for (const host of ["www", "br"]) {
      for (const trailing of ["", "/"]) {
        storedUrl = `https://${host}.linkedin.com/in/${storedSlug}${trailing}`;
        const inputSlug = storedSlug === "plain-profile" ? storedSlug : "ant%C3%B4niocerqueira";
        for (const inputTrailing of ["", "/"]) {
          const row = await lookup(`https://www.linkedin.com/in/${inputSlug}${inputTrailing}`);
          assert.equal(row?.id, "existing-person", `Did not match ${storedUrl}`);
        }
      }
    }
  }
  storedUrl = "https://www.linkedin.com/in/ant%C3%B4niocerqueira";
  assert.equal((await lookup("https://www.linkedin.com/in/ant%c3%b4niocerqueira/"))?.id, "existing-person");
  assert.equal((await lookup("https://www.linkedin.com/in/antôniocerqueira/"))?.id, "existing-person");
  assert.equal(await lookup("https://www.linkedin.com/in/another-person/"), null);
  const beforeEmpty = requests;
  assert.equal(await lookup(""), null);
  assert.equal(requests, beforeEmpty);
  console.log("PASS: encoded accent case, both slash forms, regional hosts, Unicode input, absent person, authenticated GET");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
