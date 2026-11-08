import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname,"..");

describe("release quality gate", () => {
  it("provides a comprehensive command and runs it before the npm deployment path", () => {
    const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
    assert.equal(typeof pkg.scripts["test:release"],"string","the comprehensive release command must exist");
    assert.equal(pkg.scripts.predeploy,"npm run test:release");
    assert.match(pkg.scripts["test:coverage"],/--test-coverage-lines=90/);
    assert.match(pkg.scripts["test:coverage"],/--test-coverage-branches=80/);
    assert.match(pkg.scripts["test:coverage"],/--test-coverage-functions=85/);
  });

  it("keeps production probes separate and never deploys, publishes, pushes or modifies dependencies", async () => {
    const { createValidationPlan }=await import("../tools/release-gate.mjs");
    const plan=createValidationPlan({root,npmCli:"npm-cli.js",release:true,live:true});
    const ids=plan.map(step=>step.id);
    for(const id of ["package","regressions","i18n","security-history","dependency-audit","worker-bundle","bundle-budget","coverage","browser","live-api","live-browser"])assert.ok(ids.includes(id),id);
    assert.ok(plan.find(step=>step.id==="live-api").args.includes("--coverage"));
    for(const step of plan){
      const cmd=step.args.join(" ");
      assert.doesNotMatch(cmd,/\b(?:push|publish|secret|login|audit fix)\b/);
      if(step.args.includes("deploy"))assert.ok(step.args.includes("--dry-run"));
    }
    const local=createValidationPlan({root,npmCli:"npm-cli.js",release:true,live:false});
    assert.ok(!local.some(step=>step.id.startsWith("live-")));
  });

  it("reports all independent failures, skips unsafe dependents and cannot call a failed candidate ready", async () => {
    const { runValidationPlan }=await import("../tools/release-gate.mjs");
    const called=[];
    const steps=[{id:"build",name:"Build",command:"node",args:[]},{id:"bundle",name:"Bundle",command:"node",args:[],dependsOn:["build"]},{id:"tests",name:"Tests",command:"node",args:[]}];
    const report=await runValidationPlan(steps,{execute:async step=>{called.push(step.id);return {status:step.id==="build"?1:0};},fingerprint:()=>"unchanged",scope:"full"});
    assert.deepEqual(called,["build","tests"]);
    assert.deepEqual(report.steps.map(step=>step.status),["failed","skipped","passed"]);
    assert.equal(report.readyForDeploy,false);
  });

  it("invalidates results if candidate files change during verification and labels limited runs honestly", async () => {
    const { runValidationPlan }=await import("../tools/release-gate.mjs");
    let reads=0;
    const steps=[{id:"tests",name:"Tests",command:"node",args:[]}];
    const changed=await runValidationPlan(steps,{execute:async()=>({status:0}),fingerprint:()=>String(reads++),scope:"full"});
    assert.equal(changed.readyForDeploy,false);
    assert.equal(changed.candidateUnchanged,false);
    const local=await runValidationPlan(steps,{execute:async()=>({status:0}),fingerprint:()=>"same",scope:"candidate-only"});
    assert.equal(local.ok,true);
    assert.equal(local.readyForDeploy,false);
  });

  it("treats crashed or timed-out children as failures instead of passing a null exit code", async () => {
    const { runValidationPlan }=await import("../tools/release-gate.mjs");
    for(const result of [{status:null,signal:"SIGTERM"},{status:null,error:{code:"ETIMEDOUT"}},{status:0,error:{code:"ENOENT"}}]){
      const report=await runValidationPlan([{id:"test",name:"Test",command:"node",args:[]}],{execute:async()=>result,fingerprint:()=>"same",scope:"full"});
      assert.equal(report.ok,false);
      assert.equal(report.readyForDeploy,false);
    }
  });

  it("fingerprints candidate bytes and paths, not generated test results", async () => {
    const { fingerprintFiles }=await import("../tools/release-gate.mjs");
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),"hype-fingerprint-test-"));
    try{
      fs.writeFileSync(path.join(temp,"source.js"),"first");
      const before=fingerprintFiles(temp,["source.js"]);
      fs.writeFileSync(path.join(temp,"source.js"),"second");
      assert.notEqual(fingerprintFiles(temp,["source.js"]),before);
      assert.throws(()=>fingerprintFiles(temp,["../outside"]),/outside|path/i);
      fs.mkdirSync(path.join(temp,"test-results"));
      fs.writeFileSync(path.join(temp,"test-results/report.json"),"generated");
      assert.equal(fingerprintFiles(temp,["source.js","test-results/report.json"]),fingerprintFiles(temp,["source.js"]));
    }finally{
      assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));
      assert.ok(path.basename(temp).startsWith("hype-fingerprint-test-"));
      fs.rmSync(temp,{recursive:true,force:true});
    }
  });

  it("rejects zero-test, skipped, flaky and incomplete test evidence even after a zero exit status", async () => {
    const { analyzeTestEvidence }=await import("../tools/release-gate.mjs");
    assert.equal(typeof analyzeTestEvidence,"function");
    for(const stdout of ["tests 0\nskipped 0\ntodo 0","tests 285\nskipped 1\ntodo 0","tests 285\nskipped 0\ntodo 1"]){
      assert.equal(analyzeTestEvidence("regressions",{stdout}).ok,false);
    }
    assert.equal(analyzeTestEvidence("regressions",{stdout:"ℹ tests 285\nℹ skipped 0\nℹ todo 0"}).ok,true);
    assert.equal(analyzeTestEvidence("regressions",{stdout:"\u001b[32mℹ tests \u001b[33m287\u001b[0m\nℹ skipped 0\nℹ todo 0"}).ok,true);
    for(const stats of [{expected:0,unexpected:0,skipped:0,flaky:0},{expected:32,unexpected:0,skipped:1,flaky:0},{expected:32,unexpected:0,skipped:0,flaky:1}]){
      assert.equal(analyzeTestEvidence("browser",{browserReport:{stats}}).ok,false);
    }
    assert.equal(analyzeTestEvidence("browser",{browserReport:{stats:{expected:33,unexpected:0,skipped:0,flaky:0},errors:[]}}).ok,true);
    assert.equal(analyzeTestEvidence("browser",{}).ok,false);
    assert.equal(analyzeTestEvidence("live-api",{stdout:"PASS GET /live-matches"}).ok,false);
  });

  it("redacts credential-shaped diagnostic text without echoing values", async () => {
    const {redactDiagnostics}=await import("../tools/release-gate.mjs");
    for(const value of ["cfat_"+"A".repeat(48),"ghp_"+"B".repeat(40),"npm_"+"C".repeat(36)]){
      assert.equal(redactDiagnostics(`failed: ${value}`).includes(value),false);
    }
  });

  it("isolates browser cleanup from release reports and does not launch a candidate rejected by safety gates", async () => {
    const config=fs.readFileSync(path.join(root,"playwright.config.mjs"),"utf8");
    assert.match(config,/outputDir:\s*["']test-results\/browser["']/);
    const {createValidationPlan}=await import("../tools/release-gate.mjs");
    const plan=createValidationPlan({root,npmCli:"npm-cli.js",release:true,live:true});
    for(const id of ["browser","live-browser"]){
      assert.ok(plan.find(step=>step.id===id).dependsOn.includes("package"));
      assert.ok(plan.find(step=>step.id===id).dependsOn.includes("security-history"));
    }
  });
});
