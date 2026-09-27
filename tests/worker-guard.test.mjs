import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext } from "./helpers.mjs";

describe("match detail presentation fields", () => {
  it("prefers match-specific positions and accepts only explicit starters", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run('normalizeRosterPlayer({starter:"false",athlete:{name:"Player"}}).starter'), false);
    assert.equal(run('normalizeRosterPlayer({starter:true,position:{abbreviation:"CD-L"},athlete:{name:"Player",position:{abbreviation:"D"}}}).position'), "CD-L");
    assert.equal(run('normalizeLineups({rosters:[{homeAway:"away",formation:"4-2-3-1",roster:[{starter:true,athlete:{name:"Player"}}]}]})[0].formation'), "4-2-3-1");
    assert.equal(run('normalizeLineups({rosters:[{formation:"<script>",roster:[{athlete:{name:"Player"}}]}]})[0].formation'), "");
  });
  it("preserves late key events instead of truncating after 24 moments", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run('normalizeTimeline(Array.from({length:30}, (_,i)=>({id:i,type:{text:"Goal",type:"goal"}})),[]).length'), 30);
    assert.equal(run('normalizeTimeline([{type:{text:"Yellow Card",type:"yellow-card"}}],[])[0].kind'), "yellow-card");
    assert.equal(run('typeof normalizeCommentary'), "undefined");
  });
});

describe("worker cache/TTL/bound contract", () => {
  it("TTLs, versions, bounds, probes, WC dates", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run("LIVE_CACHE_TTL_SECONDS"), 30);
    assert.equal(run("IDLE_CACHE_TTL_SECONDS"), 120);
    assert.equal(run("STANDINGS_CACHE_TTL_SECONDS"), 1800);
    assert.equal(run("MATCH_DETAIL_CACHE_TTL_SECONDS"), 60);
    assert.equal(run("TOURNAMENT_BRACKET_CACHE_TTL_SECONDS"), 900);
    assert.equal(run("LIVE_MATCHES_CACHE_KEY_VERSION"), "v15");
    assert.equal(run("STANDINGS_CACHE_KEY_VERSION"), "v4");
    assert.equal(run("MATCH_DETAIL_CACHE_KEY_VERSION"), "v6");
    assert.equal(run("TOURNAMENT_BRACKET_CACHE_KEY_VERSION"), "v1");
    assert.equal(run("MAX_EVENT_ID_LENGTH"), 20);
    assert.equal(run("MAX_REMEMBERED_EVENT_KEYS"), 1024);
    assert.equal(run("UPCOMING_MATCH_WINDOW_MS"), 86400000);
    assert.equal(run("FIFA_WORLD_CUP_KNOCKOUT_DATES"), "20260628-20260719");
    const probes = run("EXTRA_ESPN_SCOREBOARD_LEAGUES");
    for (const must of ["uefa.europa.conf", "fifa.world", "uefa.nations", "uefa.euro", "conmebol.america"]) {
      assert.ok(probes.includes(must), `missing probe ${must}`);
    }
  });

  it("Cancun override pinned to official host", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run(`TEAM_LOGO_OVERRIDES_BY_ID.get("20724")`), run("CANCUN_FC_LOGO_URL"));
    assert.ok(String(run("CANCUN_FC_LOGO_URL")).includes("cancunfc.mx"));
  });

  it("normalizers tolerate null rows (ESPN shape drift)", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run("normalizeEspnMatches({events:[null]}).length"), 0);
    assert.equal(run("normalizeTimeline([null], []).length"), 0);
    assert.equal(run("normalizeLineups({rosters: [null]}).length"), 0);
    assert.equal(run("normalizeBroadcasts([{names:{}}]).length"), 0);
  });

  it("league groups carry no standings (hot-path guard)", async () => {
    const { run } = await loadWorkerContext();
    const groups = run(`groupMatchesByLeague([])`);
    assert.ok(Array.isArray(groups) && groups.length > 0, "groups built");
    for (const g of groups.slice(0, 5)) {
      assert.ok(!("standings" in g), `standings leaked in ${g.code}`);
    }
    const codes = groups.map((g) => g.code);
    for (const must of ["fifa.world", "uefa.nations", "uefa.euro", "conmebol.america"]) {
      assert.ok(codes.includes(must), `missing group ${must}`);
    }
  });
});
