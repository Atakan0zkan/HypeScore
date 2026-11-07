import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext, memoryCache, espnEvent, scoreboardResponse } from "./helpers.mjs";

const ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const json = value => new Response(JSON.stringify(value), {headers:{"Content-Type":"application/json"}});
const payload = (events, code) => ({events, ...(code ? {leagues:[{slug:code}]} : {})});

describe("complete and identity-safe scoreboard ingestion", () => {
  it("recognizes Europa and Conference League event IDs independently of their logo IDs", async () => {
    const {run} = await loadWorkerContext();
    const rows = run(`normalizeEspnMatches(${JSON.stringify(payload([espnEvent({id:"401915534",leagueId:"776"}),espnEvent({id:"401915535",leagueId:"20296"})]))})`);
    assert.deepEqual(Array.from(rows,match => match.leagueCode),["uefa.europa","uefa.europa.conf"]);
    assert.equal(run('getLeagueMetadata("2310").code'),null,"logo IDs are not valid competition identities");
    assert.equal(run('getLeagueMetadata("776").logoId'),"2310","keep the existing league logo identity separate");
  });

  it("does not lose a live Süper Lig match beyond ESPN's default first 100 events", async () => {
    const first100 = Array.from({length:100},(_,i) => espnEvent({id:String(100000+i)}));
    const missing = espnEvent({id:"401888371",leagueId:"3946"});
    const calls = [];
    const {run} = await loadWorkerContext({fetch:async input => {
      const url = new URL(input); calls.push(url);
      return scoreboardResponse(url.pathname.includes("/all/") ?
        (Number(url.searchParams.get("limit")) >= 1000 ? [...first100,missing] : first100) : []);
    }});
    const result = await run("getLiveMatches({})");
    assert.equal(result.matches.some(match => match.id === "401888371" && match.leagueCode === "tur.1" && match.state === "live"),true);
    assert.equal(calls.filter(url => url.pathname.includes("/all/")).length,1);
    assert.equal(calls.length,5,"fix the aggregate query, not 32 extra requests on every refresh");
  });

  it("rejects successful but malformed primary scoreboards instead of caching an empty league list", async () => {
    for (const value of [{}, {events:null}, {events:{}}, [], null]) {
      const {run} = await loadWorkerContext({fetch:async url => json(String(url).includes("/all/") ? value : {events:[]})});
      await assert.rejects(run("getLiveMatches({})"),/scoreboard.*events/i);
    }
  });

  it("does not present a saturated aggregate as a complete successful response", async () => {
    const {run} = await loadWorkerContext({fetch:async url => scoreboardResponse(String(url).includes("/all/") ?
      Array.from({length:1000},(_,i) => espnEvent({id:String(100000+i)})) : [])});
    await assert.rejects(run("getLiveMatches({})"),/scoreboard.*(?:limit|truncat)/i);
  });

  it("retains a last-successful snapshot when a malformed 200 arrives", async () => {
    let malformed = false;
    const cache = memoryCache();
    const {run} = await loadWorkerContext({caches:{default:cache},fetch:async url =>
      String(url).includes("/all/") ? json(malformed ? {} : payload([espnEvent()])) : scoreboardResponse([])});
    const request = `handleRequest(new Request("https://api.atakanozkan.com/live-matches?allowStale=1",{headers:{Origin:"${ORIGIN}"}}),{})`;
    assert.equal((await run(request)).status,200);
    // Replace only the short-lived cache with an expired timestamp; keep the
    // last-good snapshot intact, exactly as a cold isolate would observe it.
    await run("caches.default.put(new Request(CACHE_KEY_URL),new Response('expired',{status:502}))");
    malformed = true;
    const result = await run(request);
    const data = await result.json();
    assert.equal(data.freshness?.stale,true);
    assert.equal(data.matches.length,1);
  });

  it("uses a direct league response to update a duplicate stale aggregate event", async () => {
    const {run} = await loadWorkerContext();
    const scheduled = espnEvent({state:"pre"});
    const live = espnEvent({state:"in"});
    const rows = run(`normalizeEspnMatchPayloads(${JSON.stringify([payload([scheduled]),payload([live],"eng.1")])})`);
    assert.equal(rows.length,1);
    assert.equal(rows[0].state,"live");
    const reversed = run(`normalizeEspnMatchPayloads(${JSON.stringify([payload([live],"eng.1"),payload([scheduled])])})`);
    assert.equal(reversed[0].state,"live","aggregate ordering cannot override a direct league snapshot");
  });

  it("does not collapse two distinct league/event identities merely because numeric IDs coincide", async () => {
    const {run} = await loadWorkerContext();
    const rows = run(`normalizeEspnMatchPayloads(${JSON.stringify([payload([espnEvent(),espnEvent({leagueId:"740"})])])})`);
    assert.deepEqual(Array.from(rows,match => match.leagueCode).sort(),["eng.1","esp.1"]);
  });

  it("drops unusable event identifiers rather than issuing broken detail links", async () => {
    const {run} = await loadWorkerContext();
    for (const id of ["", "null", "undefined", "123?x=1", "9".repeat(21)]) {
      assert.equal(run(`normalizeEspnMatches(${JSON.stringify(payload([espnEvent({id})]))}).length`),0,id);
    }
  });
});
