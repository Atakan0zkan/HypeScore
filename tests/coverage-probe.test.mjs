import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkLiveFixtureCoverage } from "../tools/scoreboard-coverage.mjs";

const NOW = Date.parse("2026-11-07T16:15:00Z");
const live = () => ({matches:[],leagues:["fifa.world","tur.1",...Array.from({length:30},(_,i)=>`league.${i}`)].map(code=>({code,matches:[]}))});
const leagueCode = url => new URL(url).pathname.split("/").at(-2);
const json = data => new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
const provider = (code, events=[]) => ({leagues:[{id:code === "tur.1" ? "3946" : "1",slug:code}],events});
const target = report => report.find(row=>row.name === "Live fixture coverage tur.1");
const event = overrides => ({id:"401888371",date:"2026-11-07T16:00:00Z",status:{type:{state:"in",completed:false}},...overrides});
const check = (payload,fetchImpl,options={}) => checkLiveFixtureCoverage(payload,{fetchImpl,now:()=>NOW,...options});

describe("bounded provider-coverage probe", () => {
  it("checks all 31 current competitions, skips historical World Cups and matches exact league/event identities", async () => {
    const data=live(); data.matches=[{leagueCode:"tur.1",id:"401888371"}];
    const calls=[];
    const report=await check(data,async(url,init)=>{
      calls.push({url,init});
      return json(provider(leagueCode(url),leagueCode(url)==="tur.1"?[event()]:[]));
    });
    assert.equal(report.length,31);
    assert.equal(report.every(row=>row.status==="ok"),true);
    assert.equal(calls.every(call=>!call.url.includes("fifa.world")),true);
    assert.equal(calls.every(call=>call.init.redirect==="error" && !call.init.headers.Authorization && !call.init.headers.Origin),true);
    data.matches[0].leagueCode="esp.1";
    assert.equal(target(await check(data,async url=>json(provider(leagueCode(url),leagueCode(url)==="tur.1"?[event()]:[])))).code,"MISSING_LIVE_FIXTURES");
  });

  it("does not alert for pre-match, finished or just-started fixtures", async () => {
    const rows=[event({status:{type:{state:"pre"}}}),event({status:{type:{state:"in",completed:true}}}),event({date:"2026-11-07T16:14:30Z"})];
    const report=await check(live(),async url=>json(provider(leagueCode(url),rows)));
    assert.equal(report.every(row=>row.status==="ok"),true);
  });

  it("requires bounded league codes and a complete, unique league list before any request", async () => {
    for (const change of [p=>{p.leagues.pop();},p=>{p.leagues[1].code="tur.1?secret=value";},p=>{p.leagues[1].code="x".repeat(65)+".1";},p=>{p.leagues[1].code="fifa.world";},p=>{p.matches=null;}]) {
      const data=live(); change(data);
      await assert.rejects(check(data,()=>{throw Error("must not fetch");}),/32 unique valid league codes/);
    }
  });

  it("detects a changed numeric league identity even when no match is live", async () => {
    const data=live(); data.leagues[1].id="2310";
    assert.equal(target(await check(data,async url=>json(provider(leagueCode(url))))).code,"LEAGUE_ID_MISMATCH");
  });

  it("has at most four concurrent provider requests and one bounded host fallback", async () => {
    let active=0,peak=0;
    const signals=new Map();
    const report=await check(live(),async(url,init)=>{
      active++; peak=Math.max(peak,active); await new Promise(setImmediate); active--;
      const code=leagueCode(url);
      if(new URL(url).hostname==="site.api.espn.com") {signals.set(code,init.signal);return new Response("Blocked",{status:403});}
      assert.equal(init.signal,signals.get(code));
      return json(provider(code));
    });
    assert.ok(peak<=4);
    assert.equal(report.every(row=>row.status==="ok"),true);
  });

  it("does not retry permanent provider failures or saturated/oversized scoreboards", async () => {
    for(const make of [()=>new Response("Missing",{status:404}),()=>json(provider("tur.1",Array.from({length:1000},()=>event()))),()=>new Response("{}",{headers:{"Content-Type":"application/json","Content-Length":String(8*1024*1024+1)}})]) {
      let targetCalls=0;
      const report=await check(live(),async url=>{
        if(leagueCode(url)!=="tur.1")return json(provider(leagueCode(url)));
        targetCalls++;return make();
      });
      assert.equal(targetCalls,1);
      assert.equal(target(report).status,"failed");
    }
  });

  it("bounds streamed body bytes and omits provider error content", async () => {
    for(const make of [()=>new Response(new Uint8Array(8*1024*1024+1),{headers:{"Content-Type":"application/json"}}),()=>{throw new Error("private upstream content");}]) {
      const report=await check(live(),async url=>leagueCode(url)==="tur.1"?make():json(provider(leagueCode(url))));
      assert.equal(target(report).status,"failed");
      assert.equal(JSON.stringify(report).includes("private upstream content"),false);
    }
  });

  it("recovers schema, content-type and JSON failures on the alternate host", async () => {
    for(const bad of [()=>new Response("HTML"),()=>new Response("{bad",{headers:{"Content-Type":"application/json"}}),()=>json({events:[]})]) {
      const report=await check(live(),async url=>new URL(url).hostname==="site.api.espn.com"?bad():json(provider(leagueCode(url))));
      assert.equal(report.every(row=>row.status==="ok"),true);
    }
  });

  it("keeps the deadline active while the response body is pending", async () => {
    const report=await check(live(),async(_url,{signal})=>({ok:true,headers:new Headers({"Content-Type":"application/json"}),
      json:()=>new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(Object.assign(Error("Aborted"),{name:"AbortError"})),{once:true}))}),{timeoutMs:5});
    assert.equal(report.every(row=>row.code==="PROVIDER_TIMEOUT"),true);
  });
});
