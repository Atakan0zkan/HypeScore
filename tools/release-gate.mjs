#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { isPrivateProjectPath } from "./security-check.mjs";

const ROOT = path.resolve(import.meta.dirname,"..");
const REQUIRED = ["package","regressions","i18n","security-history","dependency-audit","worker-bundle","bundle-budget","coverage","browser","live-api","live-browser"];

export function createValidationPlan({root=ROOT,npmCli,release=true,live=true}={}) {
  if(!npmCli) throw new Error("Run through npm so the package-manager entry point is explicit");
  const node=process.execPath;
  const step=(id,name,args,extra={})=>({id,name,command:node,args,...extra});
  const npm=(id,name,args)=>step(id,name,[npmCli,...args]);
  const scripts=["worker/index.js","extension/popup.js","analytics-dashboard/server.mjs","analytics-dashboard/public/app.js","tools/scoreboard-coverage.mjs","tools/smoke-test.js","tools/production-monitor.mjs","tools/release-gate.mjs","tools/release-policy.mjs"];
  const plan=scripts.map(file=>step(`syntax:${file}`,`Syntax: ${file}`,["--check",file]));
  plan.push(step("package","Extension integrity, permissions and asset budgets",["tools/release-policy.mjs"]),
    npm("regressions","Popup, Worker, monitoring and dashboard regressions",["test"]),
    npm("i18n","All locale contracts and substitutions",["run","test:i18n"]),
    step(release?"security-history":"security","Source secrets, private files and immutable Actions",["tools/security-check.mjs",...(release?["--history"]:[])]),
    npm("dependency-audit","Dependency vulnerability audit",["audit","--audit-level=moderate"]),
    {id:"diff",name:"Diff whitespace",command:"git",args:["-c","core.safecrlf=false","diff","--check"]},
    step("worker-bundle","Candidate Worker dry-run (never deploys)",["node_modules/wrangler/bin/wrangler.js","deploy","--dry-run","--outdir","dist/worker-dry-run"]),
    step("bundle-budget","Worker bundle size budgets",["tools/release-policy.mjs","--worker-bundle"],{dependsOn:["worker-bundle"]}));
  if(release) plan.push(npm("coverage","Enforced source coverage thresholds",["run","test:coverage"]),
    {...npm("browser","Unpacked extension: features, security, accessibility and performance",["run","test:e2e"]),dependsOn:["package","security-history"]});
  if(live) plan.push(npm("live-api","Deployed API and provider fixture coverage (read-only)",["run","smoke","--","--coverage"]));
  if(release && live) plan.push({...npm("live-browser","Candidate popup against production API and latency probes (read-only)",["run","test:e2e:live"]),dependsOn:["package","security-history","browser"]});
  return plan;
}

export function fingerprintFiles(root,files) {
  const hash=createHash("sha256");
  for(const file of [...new Set(files)].sort()) {
    const absolute=path.resolve(root,file);
    const relative=path.relative(root,absolute);
    if(!relative || relative===".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Candidate path is outside the workspace");
    if(isPrivateProjectPath(relative)) continue;
    hash.update(relative.replaceAll(path.sep,"/")+"\0");
    let stat;
    try {stat=fs.lstatSync(absolute);} catch(error) {if(error.code!=="ENOENT")throw error;hash.update("deleted\0");continue;}
    if(!stat.isFile() || stat.isSymbolicLink() || stat.size>6*1024*1024) throw new Error("Candidate contains an unsafe or oversized source file");
    hash.update(fs.readFileSync(absolute)); hash.update("\0");
  }
  return hash.digest("hex");
}

function candidateFingerprint(root) {
  const names=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{cwd:root,encoding:"utf8",windowsHide:true}).split("\0").filter(Boolean);
  return fingerprintFiles(root,names);
}

export function redactDiagnostics(value="") {
  return stripVTControlCharacters(String(value)).replace(/\b(?:cfat_[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,})\b/g,"[REDACTED]")
    .replace(/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,"[REDACTED PRIVATE KEY]");
}

export function analyzeTestEvidence(id,{stdout="",browserReport}={}){
  stdout=stripVTControlCharacters(stdout);
  if(["regressions","coverage"].includes(id)){
    const count=Number(stdout.match(/(?:^|\n)[^\n]*\btests\s+(\d+)\s*(?:\n|$)/)?.[1]||0);
    const skipped=Number(stdout.match(/\bskipped\s+(\d+)/)?.[1]||0),todo=Number(stdout.match(/\btodo\s+(\d+)/)?.[1]||0);
    return {ok:count>=275&&skipped===0&&todo===0,tests:count,skipped,todo};
  }
  if(["browser","live-browser"].includes(id)){
    const stats=browserReport?.stats;
    return {ok:Boolean(stats&&stats.expected>=(id==="browser"?33:2)&&stats.unexpected===0&&stats.skipped===0&&stats.flaky===0&&!(browserReport.errors?.length)),...(stats||{})};
  }
  if(id==="live-api"){
    const leagues=new Set([...stdout.matchAll(/PASS Live fixture coverage ([a-z0-9.]+)/g)].map(match=>match[1]));
    return {ok:leagues.size===31,providerLeagues:leagues.size};
  }
  return {ok:true};
}

export async function runValidationPlan(plan,{execute,fingerprint,scope="full",onStart=()=>{},onResult=()=>{}}={}) {
  const before=fingerprint();
  const startedAt=new Date().toISOString();
  const steps=[];
  for(const item of plan) {
    if(item.dependsOn?.some(id=>steps.find(step=>step.id===id)?.status!=="passed")) {
      steps.push({id:item.id,name:item.name,status:"skipped",reason:"A prerequisite failed"}); continue;
    }
    onStart(item);
    const start=performance.now();
    let result;
    try {result=await execute(item);} catch(error) {result={status:null,error:{code:error.code || "EXECUTION_ERROR"}};}
    const status=result.status===0 && !result.error && !result.signal?"passed":"failed";
    const entry={id:item.id,name:item.name,status,durationMs:Math.round(performance.now()-start),exitCode:result.status??null,
      ...(result.signal?{signal:result.signal}:{}),...(result.error?{errorCode:result.error.code || "EXECUTION_ERROR"}:{})};
    steps.push(entry); onResult(entry,result);
  }
  const after=fingerprint();
  const candidateUnchanged=before===after;
  const ok=candidateUnchanged && steps.every(step=>step.status==="passed");
  return {schema:"hype.release-validation.v1",startedAt,finishedAt:new Date().toISOString(),scope,candidateHash:before,candidateUnchanged,ok,
    readyForDeploy:ok && scope==="full" && REQUIRED.every(id=>steps.some(step=>step.id===id && step.status==="passed")),steps,
    limits:["Production probes verify the deployed Worker, not an undeployed candidate Worker.","Local fixture budgets are regression guards, not worldwide speed or WCAG certification.","Passing tests is not permission to publish and cannot replace manual diff, translation, account-security and Store-package review."]};
}

export async function main(args=process.argv.slice(2)) {
  if(args.some(arg=>arg!=="--local-only")) throw new Error("Usage: npm run test:release -- [--local-only]");
  const npmCli=process.env.npm_execpath;
  if(!npmCli || !fs.existsSync(npmCli)) throw new Error("Run through npm run test:release");
  const localOnly=args.includes("--local-only");
  const directory=path.join(ROOT,"test-results","release-gate",`${new Date().toISOString().replaceAll(/[:.]/g,"-")}-${randomUUID().slice(0,8)}`);
  fs.mkdirSync(directory,{recursive:true});
  const report=await runValidationPlan(createValidationPlan({root:ROOT,npmCli,release:true,live:!localOnly}),{
    scope:localOnly?"candidate-only":"full",fingerprint:()=>candidateFingerprint(ROOT),
    execute:step=>{
      const started=Date.now();
      const result=spawnSync(step.command,step.args,{cwd:ROOT,encoding:"utf8",windowsHide:true,maxBuffer:8*1024*1024,timeout:step.id.includes("browser")?15*60*1000:10*60*1000});
      let browserReport;
      if(["browser","live-browser"].includes(step.id)){
        const file=path.join(ROOT,"test-results",step.id==="browser"?"browser-results.json":"live-browser-results.json");
        if(fs.existsSync(file)&&fs.statSync(file).mtimeMs>=started-1000){try{browserReport=JSON.parse(fs.readFileSync(file,"utf8"));}catch{}}
      }
      result.evidence=analyzeTestEvidence(step.id,{stdout:result.stdout||"",browserReport});
      if(!result.evidence.ok)result.error={code:"INCOMPLETE_TEST_EVIDENCE"};
      return result;
    },
    onStart:step=>console.log(`\n[RUN] ${step.name}`),
    onResult:(entry,result)=>{
      const name=entry.id.replaceAll(/[^a-z0-9-]/gi,"-")+".log";
      const log=redactDiagnostics((result.stdout||"")+"\n"+(result.stderr||""));
      fs.writeFileSync(path.join(directory,name),log);
      entry.log=name;
      if(result.evidence)entry.evidence=result.evidence;
      console.log(`[${entry.status.toUpperCase()}] ${entry.name} (${entry.durationMs}ms)`);
      console.log(log.trim().split(/\r?\n/).slice(entry.status==="failed"?-24:-3).join("\n"));
    },
  });
  const summary=["# Hype release validation",``, `Scope: ${report.scope}`,`Candidate unchanged: ${report.candidateUnchanged}`,`Automated release gates: ${report.readyForDeploy?"PASS":"NOT READY"}`,"",...report.steps.map(step=>`- ${step.status.toUpperCase()}: ${step.name}${step.log?` (${step.log})`:""}`),"",...report.limits.map(item=>`- Boundary: ${item}`)].join("\n");
  fs.writeFileSync(path.join(directory,"report.json"),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(directory,"summary.md"),summary);
  console.log(`\n${report.ok?"PASS":"FAIL"}: ${report.scope}; automated deploy gate ${report.readyForDeploy?"READY":"NOT READY"}`);
  console.log(`Report: ${path.join(directory,"summary.md")}`);
  if(!report.ok)process.exitCode=1;
  return report;
}

if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) main().catch(error=>{
  console.error(redactDiagnostics(error.message));process.exitCode=1;
});
