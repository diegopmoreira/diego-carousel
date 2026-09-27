import { access } from 'node:fs/promises';
import { chromium, type LaunchOptions } from 'playwright';
// CAROUSEL_CHROMIUM points to another Chromium build (e.g. a cloud image with a preinstalled browser).
// The browser version is part of the render environment hash, so switching builds invalidates renders.
export const chromiumPath=()=>process.env.CAROUSEL_CHROMIUM||chromium.executablePath();
export async function launchChromium(options:LaunchOptions={}){
 const executablePath=process.env.CAROUSEL_CHROMIUM||undefined;
 if(executablePath)await access(executablePath);
 return chromium.launch({...options,executablePath});
}
