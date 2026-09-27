import path from 'node:path';
import { appendFile, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ROOT } from './io.js';
// Good theses that were not chosen (editorial/thesis-selection.md). One JSON object per line.
export const Idea=z.object({thesis:z.string().trim().min(10),source:z.string().trim().min(3),why:z.string().trim().min(5),project:z.string().optional(),created_at:z.iso.datetime(),status:z.enum(['open','used','dropped']).default('open')}).strict();
export const backlogFile=()=>path.resolve(process.env.CAROUSEL_BACKLOG||path.join(ROOT,'ideas/backlog.jsonl'));
export async function addIdea(input:{thesis?:string;source?:string;why?:string;project?:string}){
 const idea=Idea.parse({...input,created_at:new Date().toISOString()});
 const existing=await readFile(backlogFile(),'utf8').catch(()=>'' );
 if(existing.split('\n').filter(Boolean).some(l=>{try{return JSON.parse(l).thesis===idea.thesis;}catch{return false;}}))throw Error('Tese já está no backlog');
 await appendFile(backlogFile(),(existing&&!existing.endsWith('\n')?'\n':'')+JSON.stringify(idea)+'\n');return idea;
}
export async function listIdeas(){return (await readFile(backlogFile(),'utf8').catch(()=>'')).split('\n').filter(Boolean).map(l=>JSON.parse(l));}
