import { access } from 'node:fs/promises';
import { chromium, type LaunchOptions } from 'playwright';
// CAROUSEL_CHROMIUM points to another Chromium build (e.g. a cloud image with a preinstalled browser).
// The browser version is part of the render environment hash (chromiumVersion), so switching builds invalidates renders.
export const chromiumPath=()=>process.env.CAROUSEL_CHROMIUM||chromium.executablePath();
export async function launchChromium(options:LaunchOptions={}){
 const executablePath=process.env.CAROUSEL_CHROMIUM||undefined;
 if(executablePath)await access(executablePath);
 return chromium.launch({...options,executablePath});
}
// The browser version (not its path) is part of the render environment: a symlink updated to a newer build must
// invalidate renders. Asked once per process; falls back to the resolved path if the binary cannot answer.
let versionPromise:Promise<string>|undefined;
export function chromiumVersion(){
 versionPromise??=(async()=>{
  const bin=chromiumPath(),{execFile}=await import('node:child_process'),{realpath}=await import('node:fs/promises');
  const out=await new Promise<string>(resolve=>execFile(bin,['--version'],{timeout:15000},(e,stdout)=>resolve(e?'':String(stdout).trim())));
  return out||`path:${await realpath(bin).catch(()=>bin)}`;
 })();
 return versionPromise;
}
