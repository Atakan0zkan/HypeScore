import { test, expect } from "../browser/unpacked-extension.mjs";

const API="https://api.atakanozkan.com";
const headers={Accept:"application/json",Origin:"chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa","User-Agent":"HypeScore-HealthMonitor/1.0"};

test("candidate popup reads real leagues, standings, details, settings and only World Cup 2030",async({app},info)=>{
  // Exercise the real extension request shape, including the live WAF/CORS
  // boundary. Do not alter headers or intercept/fulfill any API response.
  // These few functional browser requests can appear in product traffic;
  // the separate HTTP/coverage probes are labeled monitoring and excluded.
  const initial=app.page.waitForResponse(response=>new URL(response.url()).pathname==="/live-matches"&&response.url().startsWith(API));
  await app.page.goto(app.url,{waitUntil:"domcontentloaded"});
  const response=await initial;expect(response.status()).toBe(200);
  const payload=await response.json();expect(payload.freshness?.stale).not.toBe(true);
  await expect(app.page.locator(".league-pick-card")).toHaveCount(32);
  await expect(app.page.locator("#errorState")).toBeHidden();
  await app.page.locator("#settingsToggle").click();
  await expect(app.page.locator("#settingsVersion")).toHaveText(await app.page.evaluate(()=>chrome.runtime.getManifest().version));
  await expect(app.page.locator("#feedbackEmail")).toHaveAttribute("href","mailto:atakanozkanapps@gmail.com");
  await app.page.locator("#settingsClose").click();
  const match=["tur.1","eng.1","esp.1","ger.1","ita.1","fra.1"].map(code=>payload.matches.find(match=>match.leagueCode===code)).find(Boolean);
  let detailObserved=false;
  if(match){
    const league=payload.leagues.find(league=>league.code===match.leagueCode);
    const standings=app.page.waitForResponse(response=>new URL(response.url()).pathname==="/league-standings"&&new URL(response.url()).searchParams.get("leagueCode")===match.leagueCode);
    await app.page.locator(".league-pick-card",{hasText:league.name}).click();
    expect((await standings).status()).toBe(200);
    const details=app.page.waitForResponse(response=>new URL(response.url()).pathname==="/match-detail"&&new URL(response.url()).searchParams.get("eventId")===match.id);
    await app.page.locator(".match-card").filter({hasText:match.homeTeam}).filter({hasText:match.awayTeam}).first().click();
    expect((await details).status()).toBe(200);
    await expect(app.page.locator(".detail-team-name")).toHaveText([match.homeTeam,match.awayTeam]);
    await app.page.screenshot({path:info.outputPath("live-match.png")});
    await app.page.locator("#backBtn").click();await app.page.locator("#backBtn").click();detailObserved=true;
  }
  const bracket=app.page.waitForResponse(response=>new URL(response.url()).pathname==="/tournament-bracket");
  await app.page.getByRole("button",{name:"FIFA World Cup 2030",exact:true}).click();
  const world=await bracket;expect(world.status()).toBe(200);
  const tournament=await world.json();expect(tournament.seasonYear).toBe(2030);expect(tournament.dates).toBe("2030");
  await expect(app.page.locator(".bracket-message--error")).toHaveCount(0);
  await info.attach("live-observations",{body:JSON.stringify({revision:response.headers()["x-worker-revision"],matches:payload.matches.length,leagues:payload.leagues.length,detailObserved,worldCupYear:tournament.seasonYear},null,2),contentType:"application/json"});
});

test("real API keeps restrictive headers, fresh data and a bounded warm-response latency",async({app},info)=>{
  const samples=[];
  for(let i=0;i<4;i++){
    const start=performance.now();
    const response=await app.context.request.get(`${API}/live-matches?client=monitor&allowStale=1`,{headers,timeout:12000});
    expect(response.status()).toBe(200);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["content-security-policy"]).toContain("default-src 'none'");
    expect((await response.json()).freshness?.stale).not.toBe(true);
    if(i>0)samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  await info.attach("live-latency",{body:JSON.stringify({samplesMs:samples,p95Ms:samples.at(-1),budgetMs:3000,scope:"This runner and network; not a global SLA"},null,2),contentType:"application/json"});
  expect(samples.at(-1)).toBeLessThan(3000);
});
