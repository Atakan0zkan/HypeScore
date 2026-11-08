import { test, expect } from "../browser/unpacked-extension.mjs";
import { scorePayload, servePopup } from "../browser/popup-fixtures.mjs";
import { loadWorkerContext, memoryCache, espnEvent, scoreboardResponse } from "../helpers.mjs";

test("candidate Worker to candidate popup preserves real event identities and lazy caching",async({app})=>{
  const upstream=[];
  const event=espnEvent({id:"401888371",leagueId:"3946"});
  event.competitions[0].competitors[0].team.displayName="Galatasaray";
  event.competitions[0].competitors[1].team.displayName="Amed SFK";
  const {run}=await loadWorkerContext({caches:{default:memoryCache()},fetch:async input=>{
    const url=new URL(input);upstream.push(url.pathname);
    if(url.pathname.endsWith("/all/scoreboard"))return scoreboardResponse([event]);
    if(url.pathname.endsWith("/standings"))return new Response(JSON.stringify({standings:{entries:[{team:{displayName:"Galatasaray"},note:{description:"Champions League"},stats:[{name:"rank",value:1}]}]}}),{headers:{"Content-Type":"application/json"}});
    if(url.pathname.endsWith("/summary"))return new Response(JSON.stringify({news:{articles:[{headline:"Candidate Worker report",links:{web:{href:"https://www.espn.com/soccer/report/_/gameId/401888371"}}}]}}),{headers:{"Content-Type":"application/json"}});
    return scoreboardResponse([]);
  }});
  const calls=[];
  await app.context.route("https://api.atakanozkan.com/**",async route=>{
    calls.push(new URL(route.request().url()).pathname);
    const response=await run(`handleRequest(new Request(${JSON.stringify(route.request().url())},{headers:{Origin:"chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa"}}),{})`);
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  await app.page.goto(app.url);
  await expect(app.page.locator(".league-pick-card")).toHaveCount(32);
  await app.page.locator(".league-pick-card",{hasText:"Turkish Super Lig"}).click();
  await expect(app.page.locator(".standings-position--champions-league").first()).toHaveCount(1);
  await app.page.locator(".match-card",{hasText:"Galatasaray"}).click();
  await expect(app.page.locator(".detail-team-name")).toHaveText(["Galatasaray","Amed SFK"]);
  await expect(app.page.locator("#leagueDetailContent")).toContainText("Candidate Worker report");
  await app.page.locator("#backBtn").click();
  await app.page.locator(".match-card",{hasText:"Galatasaray"}).click();
  expect(calls.filter(path=>path==="/match-detail")).toHaveLength(1);
  expect(upstream.filter(path=>path.endsWith("/summary"))).toHaveLength(1);
});

test("keyboard-only settings, radio selection and Escape preserve focus without extra API calls",async({app})=>{
  const {calls}=await servePopup(app);await app.page.locator(".league-pick-card").first().waitFor();
  const before=calls.length;
  await app.page.locator("#settingsToggle").focus();await app.page.keyboard.press("Enter");
  await expect(app.page.locator('input[name="popupSize"][value="default"]')).toBeFocused();
  await app.page.keyboard.press("ArrowRight");
  await expect(app.page.locator('input[name="popupSize"][value="big"]')).toBeChecked();
  await app.page.keyboard.press("Escape");await expect(app.page.locator("#settingsToggle")).toBeFocused();
  expect(calls.length).toBe(before);
  expect(await app.page.locator("#settingsToggle").evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe("none");
});

test("visible controls have usable names and 24px targets; hidden screens are not keyboard reachable",async({app})=>{
  await servePopup(app);await app.page.locator(".league-pick-card").first().waitFor();
  const inspect=()=>app.page.locator("button:visible,a:visible").evaluateAll(elements=>elements.map(el=>({name:(el.getAttribute("aria-label")||el.innerText||el.title||"").trim(),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})).filter(item=>!item.name||item.width<24||item.height<24));
  expect(await inspect()).toEqual([]);
  await app.page.locator("#settingsToggle").click();
  expect(await inspect()).toEqual([]);
  expect(await app.page.locator("#leaguePickList").evaluate(el=>el.inert)).toBe(true);
  await expect(app.page.locator("#feedbackEmail")).toHaveAttribute("href","mailto:atakanozkanapps@gmail.com");
  await expect(app.page.locator("#settingsVersion")).toHaveText(await app.page.evaluate(()=>chrome.runtime.getManifest().version));
});

test("930-match rendering stays within a performance budget and repeated refreshes do not accumulate DOM",async({app},info)=>{
  const payload=await scorePayload(30);
  const {calls}=await servePopup(app,{payload});await expect(app.page.locator(".league-pick-card")).toHaveCount(32);
  const metrics=await app.page.evaluate(payload=>{
    selectedLeagueKey=null;selectedMatchKey=null;
    const samples=[];const counts=[];
    for(let i=0;i<20;i++){
      lastPayload=payload;const start=performance.now();renderPayload(payload);samples.push(performance.now()-start);counts.push(document.querySelectorAll("*").length);
    }
    samples.sort((a,b)=>a-b);
    selectedLeagueKey=getLeagueKey(payload.leagues.find(league=>league.code==="eng.1"));
    const leagueStart=performance.now();renderPayload(payload);
    return {matches:payload.matches.length,medianMs:samples[10],p95Ms:samples[18],domGrowth:Math.max(...counts)-Math.min(...counts),leagueRenderMs:performance.now()-leagueStart,leagueRows:document.querySelectorAll(".match-card").length};
  },payload);
  await info.attach("performance-budget",{body:JSON.stringify(metrics,null,2),contentType:"application/json"});
  expect(metrics.matches).toBe(930);
  expect(metrics.medianMs).toBeLessThan(300);
  expect(metrics.p95Ms).toBeLessThan(1000);
  expect(metrics.domGrowth).toBeLessThanOrEqual(20);
  expect(metrics.leagueRenderMs).toBeLessThan(750);
  expect(metrics.leagueRows).toBe(30);
  expect(calls.filter(path=>path==="/live-matches")).toHaveLength(1);
});

test("ten concurrent refresh callers share one functional request",async({app})=>{
  const {calls}=await servePopup(app);await app.page.locator(".league-pick-card").first().waitFor();
  const before=calls.length;
  await app.page.evaluate(()=>Promise.all(Array.from({length:10},()=>loadMatches({force:true}))));
  expect(calls.length-before).toBe(1);
});

test("broadcasts, head-to-head, combined media, safe links and incomplete-lineup fallbacks remain usable",async({app})=>{
  const payload=await scorePayload();
  const match=payload.matches.find(match=>match.leagueCode==="eng.1");
  await servePopup(app,{payload});await app.page.locator(".league-pick-card").first().waitFor();
  await app.page.route("**/match-detail?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({
    id:match.id,leagueCode:match.leagueCode,teams:{home:{name:match.homeTeam},away:{name:match.awayTeam}},
    broadcasts:["Test Sport 1"],stats:[],timeline:[],
    headToHead:[{date:"2026-01-01T12:00:00Z",homeTeam:"Earlier Home",awayTeam:"Earlier Away",homeScore:2,awayScore:1}],
    lineups:[{team:match.homeTeam,homeAway:"home",players:[{name:"Named Starter",jersey:"1",position:"G",starter:true},{name:"Named Substitute",jersey:"12",position:"M",starter:false}]}],
    news:[{title:"Match report",url:"https://www.espn.com/soccer/report/_/gameId/123456"}],
    videos:[{title:"Highlighted video",url:"https://www.espn.com/video/clip/_/id/123456"}],
    links:[{title:"Official details",url:"https://www.espn.com/soccer/match/_/gameId/123456"}],
  })}));
  await app.page.locator(".league-pick-card",{hasText:"English Premier League"}).click();
  await app.page.locator(".match-card").first().click();
  await expect(app.page.locator("#leagueDetailContent")).toContainText("Test Sport 1");
  await expect(app.page.locator(".lineup-pitch")).toHaveCount(0);
  await expect(app.page.locator(".lineup-starters")).toContainText("Named Starter");
  await expect(app.page.locator(".lineup-substitutes")).toContainText("Named Substitute");
  const h2h=app.page.locator('details[data-section-key="headToHead"]');await h2h.locator("summary").click();await expect(h2h).toContainText("Earlier Home 2 - 1 Earlier Away");
  const media=app.page.locator('details[data-section-key="media"]');await media.locator("summary").click();
  await expect(media.locator(".video-card--highlight")).toContainText("Highlighted video");await expect(media).toContainText("Match report");
  for(const anchor of await app.page.locator("#leagueDetailContent a").all()){
    await expect(anchor).toHaveAttribute("rel","noopener noreferrer");await expect(anchor).toHaveAttribute("href",/^https:\/\/(?:www\.)?espn\.com\//);
  }
});

for(const failure of [429,502,"network"]){
  test(`cold ${failure} failure is readable, settings remain available and power-off prevents requests`,async({app})=>{
    const {calls}=await servePopup(app,{failure});
    await expect(app.page.locator("#errorState")).toBeVisible();
    await app.page.locator("#settingsToggle").click();await expect(app.page.locator("#settingsPanel")).toBeVisible();
    await app.page.locator("#settingsClose").click();await app.page.locator("#powerToggle").click();
    const before=calls.length;await app.page.reload();
    await expect(app.page.locator(".app-shell--disabled")).toBeAttached();expect(calls.length).toBe(before);
  });
}

test("a malformed successful API response cannot masquerade as an empty healthy screen",async({app})=>{
  await servePopup(app,{payload:{unexpected:"schema"}});
  await expect(app.page.locator("#errorState")).toBeVisible();
  await expect(app.page.locator("#emptyState")).toBeHidden();
});

test("MV3 CSP blocks inline executable code in the real extension context",async({app})=>{
  await servePopup(app);await app.page.locator(".league-pick-card").first().waitFor();
  await app.page.evaluate(()=>{
    window.__violations=[];document.addEventListener("securitypolicyviolation",event=>window.__violations.push(event.violatedDirective));
    const script=document.createElement("script");script.textContent="window.__untrustedScriptExecuted = true";document.head.append(script);
  });
  await app.page.waitForFunction(()=>window.__violations.length>0);
  expect(await app.page.evaluate(()=>window.__untrustedScriptExecuted)).toBeUndefined();
});

test("failed allowed crests fall back once without a request loop",async({app})=>{
  await app.context.route("https://a.espncdn.com/test-broken.png",route=>route.fulfill({status:404,body:"missing"}));
  await servePopup(app);await app.page.locator(".league-pick-card").first().waitFor();
  await app.page.evaluate(()=>{const image=createLogoImage("detail-team-logo","https://a.espncdn.com/test-broken.png","Fallback crest");image.id="fallbackProbe";document.body.append(image);});
  await app.page.waitForFunction(()=>{const image=document.getElementById("fallbackProbe");return image.complete&&image.naturalWidth>0&&image.onerror===null;});
  expect(await app.page.locator("#fallbackProbe").getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
});
