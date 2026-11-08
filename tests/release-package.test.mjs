import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const manifest=()=>JSON.parse(fs.readFileSync(path.join(root,"extension/manifest.json"),"utf8"));
function fixture(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"hype-package-test-"));
  fs.cpSync(path.join(root,"extension"),path.join(directory,"extension"),{recursive:true});
  for(const name of ["package.json","package-lock.json"])fs.copyFileSync(path.join(root,name),path.join(directory,name));
  return {directory,close(){assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith("hype-package-test-"));fs.rmSync(directory,{recursive:true,force:true});}};
}

describe("extension release artifact policy",()=>{
  it("validates all packaged assets, locale references and version identities",async()=>{
    const {inspectExtension}=await import("../tools/release-policy.mjs");
    const report=inspectExtension(root);
    assert.equal(report.version,manifest().version);
    assert.equal(report.locales,55);
    assert.ok(report.files>90 && report.totalBytes<4*1024*1024);
  });

  it("blocks new permissions, remote executable code, externally reachable surfaces and shipping the test key",async()=>{
    const {validateManifest}=await import("../tools/release-policy.mjs");
    for(const modify of [m=>m.permissions.push("tabs"),m=>m.host_permissions.push("<all_urls>"),m=>{m.content_scripts=[{}];},m=>{m.background={service_worker:"remote.js"};},m=>{m.externally_connectable={matches:["*://*/*"]};},m=>{m.key="test public key must not ship";},m=>{m.content_security_policy.extension_pages+="; script-src https://evil.invalid";},m=>{m.content_security_policy.extension_pages=m.content_security_policy.extension_pages.replace("script-src 'self'","script-src 'self' 'unsafe-eval'");}]){
      const value=manifest();modify(value);assert.throws(()=>validateManifest(value));
    }
  });

  it("catches missing referenced assets, injected HTML, private package files, broken locales and version drift",async()=>{
    const {inspectExtension}=await import("../tools/release-policy.mjs");
    for(const mutate of [
      directory=>fs.unlinkSync(path.join(directory,"extension/icons/icon48.png")),
      directory=>fs.appendFileSync(path.join(directory,"extension/popup.html"),'<script>alert("inline")</script>'),
      directory=>fs.appendFileSync(path.join(directory,"extension/popup.html"),'<img src="icons/icon48.png" onerror="alert(1)">'),
      directory=>fs.writeFileSync(path.join(directory,"extension/.env"),"never ship this"),
      directory=>fs.writeFileSync(path.join(directory,"extension/_locales/tr/messages.json"),"{}"),
      directory=>{const pkg=JSON.parse(fs.readFileSync(path.join(directory,"package.json"),"utf8"));pkg.version="9.9.9";fs.writeFileSync(path.join(directory,"package.json"),JSON.stringify(pkg));},
    ]){
      const f=fixture();try{mutate(f.directory);assert.throws(()=>inspectExtension(f.directory));}finally{f.close();}
    }
  });

  it("enforces extension asset and Worker raw/gzip budgets without producing a Store ZIP",async()=>{
    const {inspectExtension,inspectWorkerBundle}=await import("../tools/release-policy.mjs");
    const f=fixture();
    try{
      fs.writeFileSync(path.join(f.directory,"extension/icons/oversized.png"),Buffer.alloc(256*1024+1));
      assert.throws(()=>inspectExtension(f.directory),/budget|size/i);
      const bundle=path.join(f.directory,"dist/worker-dry-run");fs.mkdirSync(bundle,{recursive:true});
      fs.writeFileSync(path.join(bundle,"index.js"),"export default {};");
      assert.ok(inspectWorkerBundle(f.directory).gzipBytes<64*1024);
      fs.writeFileSync(path.join(bundle,"index.js"),"x".repeat(256*1024+1));
      assert.throws(()=>inspectWorkerBundle(f.directory),/budget|size/i);
    }finally{f.close();}
  });
});
