#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { validateLocaleMessages } from "./locale-validation.mjs";
import { isPrivateProjectPath } from "./security-check.mjs";

export const RELEASE_BUDGETS=Object.freeze({extensionBytes:4*1024*1024,assetBytes:256*1024,workerBytes:256*1024,workerGzipBytes:64*1024});
const ROOT=path.resolve(import.meta.dirname,"..");
const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};

export function validateManifest(manifest){
  requireValue(manifest.manifest_version===3,"Manifest V3 is required");
  requireValue(JSON.stringify(manifest.permissions)===JSON.stringify([]),"Unexpected extension permissions");
  requireValue(JSON.stringify(manifest.host_permissions)===JSON.stringify(["https://api.atakanozkan.com/*"]),"Unexpected host permissions");
  for(const name of ["background","content_scripts","externally_connectable","web_accessible_resources","optional_permissions","optional_host_permissions","oauth2","update_url","key"])requireValue(!Object.hasOwn(manifest,name),`Unreviewed manifest surface: ${name}`);
  requireValue(manifest.action?.default_popup==="popup.html","Unexpected popup entry point");
  const csp=manifest.content_security_policy?.extension_pages||"";
  const directives=new Map();
  for(const text of csp.split(";").map(value=>value.trim()).filter(Boolean)){
    const [name,...values]=text.split(/\s+/);requireValue(!directives.has(name),"Duplicate CSP directive");directives.set(name,values.join(" "));
  }
  for(const [name,value] of [["script-src","'self'"],["object-src","'none'"],["base-uri","'none'"],["form-action","'none'"],["connect-src","https://api.atakanozkan.com"]])requireValue(directives.get(name)===value,`Unexpected CSP ${name}`);
  requireValue(!/unsafe-|http:|\s\*(?:\s|$)/i.test(csp),"Unsafe CSP policy");
}

function filesUnder(root){
  const files=[];
  const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);requireValue(!entry.isSymbolicLink(),"Symbolic links cannot be packaged");
    if(entry.isDirectory())walk(file);else{requireValue(entry.isFile(),"Only regular package files are supported");files.push(file);}
  }};walk(root);return files;
}

export function inspectExtension(root=ROOT){
  const directory=path.join(root,"extension");
  const read=file=>fs.readFileSync(path.join(directory,file),"utf8");
  const manifest=JSON.parse(read("manifest.json"));validateManifest(manifest);
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
  const normalized=version=>String(version).split(".").concat("0","0","0").slice(0,4).join(".");
  requireValue(/^\d+(?:\.\d+){1,3}$/.test(manifest.version)&&manifest.version.split(".").every(part=>Number(part)<=65535),"Invalid extension version");
  requireValue(normalized(manifest.version)===normalized(pkg.version)&&pkg.version===lock.version&&pkg.version===lock.packages?.[""].version,"Manifest/package/lock version mismatch");
  const files=filesUnder(directory);let totalBytes=0;
  for(const file of files){
    const name=path.relative(directory,file).replaceAll(path.sep,"/");const stat=fs.statSync(file);totalBytes+=stat.size;
    requireValue(!isPrivateProjectPath(name)&&/\.(?:html|css|js|json|png|svg)$/.test(name),`Private or unexpected package file: ${name}`);
    requireValue(stat.size<=RELEASE_BUDGETS.assetBytes,`Asset size budget exceeded: ${name}`);
    if(name.endsWith(".png")){
      const bytes=fs.readFileSync(file);
      requireValue(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0,`Invalid PNG asset: ${name}`);
    }
  }
  requireValue(totalBytes<=RELEASE_BUDGETS.extensionBytes,"Extension size budget exceeded");
  const asset=reference=>{
    const value=reference.split(/[?#]/)[0];const absolute=path.resolve(directory,value);const relative=path.relative(directory,absolute);
    requireValue(relative&&relative!==".."&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative),"Asset reference escapes the extension");
    requireValue(fs.existsSync(absolute)&&fs.lstatSync(absolute).isFile()&&!fs.lstatSync(absolute).isSymbolicLink(),`Missing packaged asset: ${value}`);
  };
  for(const file of [...Object.values(manifest.icons||{}),...Object.values(manifest.action.default_icon||{}),manifest.action.default_popup])asset(file);
  const html=read("popup.html");const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1]);
  requireValue(new Set(ids).size===ids.length,"Duplicate popup element IDs");
  requireValue(!/\son[a-z]+\s*=|(?:javascript|vbscript):|<\s*(?:iframe|object|embed)\b/i.test(html),"Unsafe executable HTML surface");
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const src=match[1].match(/\bsrc=["']([^"']+)["']/)?.[1];requireValue(src&&!/^(?:[a-z]+:|\/\/)/i.test(src)&&!match[2].trim(),"Inline or remote script in popup");asset(src);
  }
  for(const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))if(!/^(?:[a-z]+:|#|\/\/)/i.test(match[1]))asset(match[1]);
  for(const match of read("popup.js").matchAll(/["'`](icons\/[^"'`?#]+\.(?:png|svg))(?:\?[^"'`]*)?["'`]/g))asset(match[1]);
  const locales=fs.readdirSync(path.join(directory,"_locales"),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
  requireValue(locales.length>=55&&locales.includes(manifest.default_locale),"Missing supported locales");
  const reference=JSON.parse(read("_locales/en/messages.json"));
  for(const code of locales){
    const messages=JSON.parse(read(`_locales/${code}/messages.json`));requireValue(validateLocaleMessages(code,messages,reference).length===0,`Invalid locale: ${code}`);
    for(const key of ["extName","extDescription"])requireValue(typeof messages[key]?.message==="string"&&messages[key].message.trim(),`Missing manifest translation: ${code}/${key}`);
  }
  return {version:manifest.version,files:files.length,locales:locales.length,totalBytes,budgets:RELEASE_BUDGETS};
}

export function inspectWorkerBundle(root=ROOT){
  const directory=path.join(root,"dist/worker-dry-run");requireValue(fs.existsSync(directory),"Worker bundle is missing; run the dry-run first");
  const files=filesUnder(directory).filter(file=>/\.(?:js|wasm)$/.test(file));requireValue(files.some(file=>path.basename(file)==="index.js"),"Worker entry bundle is missing");
  const rawBytes=files.reduce((sum,file)=>sum+fs.statSync(file).size,0);const gzipBytes=files.reduce((sum,file)=>sum+gzipSync(fs.readFileSync(file)).byteLength,0);
  requireValue(rawBytes<=RELEASE_BUDGETS.workerBytes&&gzipBytes<=RELEASE_BUDGETS.workerGzipBytes,"Worker raw/gzip size budget exceeded");return {files:files.length,rawBytes,gzipBytes};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try{const args=process.argv.slice(2);requireValue(args.length===0||(args.length===1&&args[0]==="--worker-bundle"),"Unexpected package-check option");console.log(JSON.stringify(args.includes("--worker-bundle")?inspectWorkerBundle():inspectExtension(),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
