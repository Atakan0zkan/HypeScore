import { test as base, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Public test-only key; never copied into the source extension manifest.
export const TEST_KEY_B64="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArCNyjzFSMwVpOyTorAhxcenmenBDK1679y5WVovURgCfEWyb7t+esq+L3s8KC+ELqSvuFiNGK1dVgvtj+cA5fr7pLY39yJ2N6Z2XIGB88zd8d/qKyZ0isuyZ9tn4/jYQNcCTpmM9Dldn/8T+e3ld2JaEv5+13WHJursI3MML+xGwd6csBXn7KP9HuSPePi9VSCOy7aXHyQpEfqMl5Hz1jVF3B7CD5gFd7oLik1XQ+bAvDCHvC91zJwvh/xoZxMDXRvmLS0OUBy1URkpU5NpnA60M1fxHw49aRKPnUxelAXuQtqteDEUWo6IOuDlnRG5htk5Ob+VOtcmu6FQ2pqgjzQIDAQAB";
export function extensionIdFromKey(key){
  return [...crypto.createHash("sha256").update(Buffer.from(key,"base64")).digest().subarray(0,16)]
    .map(byte=>String.fromCharCode(97+(byte>>4),97+(byte&15))).join("");
}

export function browserLaunchOptions(){
  if(process.env.E2E_BROWSER_PATH)return {executablePath:process.env.E2E_BROWSER_PATH};
  if(process.platform==="win32"){
    const candidates=["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","C:/Program Files/Microsoft/Edge/Application/msedge.exe","C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"];
    const executablePath=candidates.find(file=>fs.existsSync(file));
    if(executablePath)return {executablePath};
  }
  return {channel:"chromium"};
}

export async function launchUnpackedExtension(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"hype-browser-test-"));
  if(root.includes(" ") || path.dirname(path.resolve(root))!==path.resolve(os.tmpdir()))throw new Error("Use a temporary directory without spaces for extension testing");
  const extDir=path.join(root,"extension"),profileDir=path.join(root,"profile");
  let context;
  const close=async()=>{
    await context?.close();
    if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir()) || !path.basename(root).startsWith("hype-browser-test-") || fs.lstatSync(root).isSymbolicLink())throw new Error("Unsafe temporary cleanup target");
    fs.rmSync(root,{recursive:true,force:true});
  };
  try{
    fs.cpSync(path.resolve("extension"),extDir,{recursive:true});
    const file=path.join(extDir,"manifest.json"),manifest=JSON.parse(fs.readFileSync(file,"utf8"));
    manifest.key=TEST_KEY_B64;fs.writeFileSync(file,JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(profileDir,{headless:false,...browserLaunchOptions(),args:[`--disable-extensions-except=${extDir}`,`--load-extension=${extDir}`]});
    return {context,extDir,profileDir,url:`chrome-extension://${extensionIdFromKey(TEST_KEY_B64)}/popup.html`,close};
  }catch(error){await close();throw error;}
}

export const test=base.extend({
  app:async({},use,testInfo)=>{
    const app=await launchUnpackedExtension();
    const page=await app.context.newPage();
    const errors=[];page.on("pageerror",error=>errors.push(String(error)));
    await page.setViewportSize({width:580,height:600});
    await app.context.tracing.start({screenshots:true,snapshots:true,sources:false});
    let failed=false;
    try{await use({...app,page,errors});expect(errors,"no unhandled popup errors").toEqual([]);}
    catch(error){failed=true;throw error;}
    finally{
      try{if(failed || testInfo.status!==testInfo.expectedStatus){
        if(!page.isClosed()){const screenshot=testInfo.outputPath("failure.png");await page.screenshot({path:screenshot});await testInfo.attach("failure",{path:screenshot,contentType:"image/png"});}
        const trace=testInfo.outputPath("trace.zip");await app.context.tracing.stop({path:trace});await testInfo.attach("trace",{path:trace,contentType:"application/zip"});
      }else await app.context.tracing.stop();}
      finally{await app.close();}
    }
  },
});
export {expect};
