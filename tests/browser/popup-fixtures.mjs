import { loadWorkerContext } from "../helpers.mjs";

export async function scorePayload(perLeague=1){
  const {run}=await loadWorkerContext();
  const leagues=run("groupMatchesByLeague([])");
  let id=100000;
  for(const league of leagues){
    league.matches=league.code==="fifa.world"?[]:Array.from({length:perLeague},(_,index)=>({
      id:String(id++),leagueCode:league.code,league:league.name,homeTeam:`Home ${index+1}`,awayTeam:`Away ${index+1}`,
      homeScore:index%3,awayScore:index%2,state:["live","scheduled","finished"][index%3],
      status:["Live","Scheduled","Full Time"][index%3],minute:["25'","Scheduled","FT"][index%3],
      kickoff:new Date(Date.now()+(index%3===1?2:-1)*3600000).toISOString(),venue:"Test Stadium",
    }));
  }
  return {leagues,matches:leagues.flatMap(league=>league.matches)};
}

export async function servePopup(app,{payload=null,failure=null}={}){
  if(payload===null)payload=await scorePayload();
  const calls=[];
  await app.context.route("https://api.atakanozkan.com/**",async route=>{
    const url=new URL(route.request().url());calls.push(url.pathname);
    if(url.pathname==="/live-matches" && failure==="network")return route.abort("failed");
    if(url.pathname==="/live-matches" && typeof failure==="number")return route.fulfill({status:failure,contentType:"application/json",body:'{"error":"Temporary failure"}'});
    const body=url.pathname==="/live-matches"?payload:url.pathname==="/league-standings"?{leagueCode:url.searchParams.get("leagueCode"),standings:[]}:{rounds:[],seasonYear:2030,dates:"2030",leagueCode:"fifa.world"};
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
  });
  await app.page.goto(app.url,{waitUntil:"domcontentloaded"});
  return {calls,payload};
}
