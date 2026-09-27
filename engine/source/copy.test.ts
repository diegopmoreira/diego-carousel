import { describe,it,expect } from 'vitest';
import { parseCopy,cleanTranscript,toCopy } from './copy.js';
import { escapeHtml } from '../render/compose.js';
import { Tweaks } from '../schema/index.js';
describe('importação',()=>{
 it('preserva body com parágrafos no formato numerado',()=>expect(parseCopy('P1\nTu sabe escutar?\n\nP2\nUma pergunta muda tudo\nPrimeiro parágrafo.\n\nSegundo parágrafo.')).toEqual([{headline:'Tu sabe escutar?',body:null},{headline:'Uma pergunta muda tudo',body:'Primeiro parágrafo.\n\nSegundo parágrafo.'}]));
 it('aceita Slide N e título na linha do marcador',()=>expect(parseCopy('Slide 1: Tu sabe ouvir\n\nSlide 2\nTu pode tentar\nCorpo.')).toHaveLength(2));
 it('aceita o formato Figma e normaliza NFC sem mudar maiúsculas',()=>{const p=parseCopy('AÇÃO começa aqui\n\nOutra frase inteira\nCorpo');expect(p[0].headline).toBe('AÇÃO começa aqui');expect(parseCopy(toCopy(p))).toEqual(p);});
 it('rejeita vazio e numeração com lacunas',()=>{expect(()=>parseCopy('')).toThrow();expect(()=>parseCopy('P1\nTítulo\nP3\nOutro')).toThrow();});
 it('limpa só linhas de timestamps e preserva capítulos',()=>expect(cleanTranscript('0:32\nCapítulo 2\n32 segundos\nUma frase com 10 segundos.')).toBe('Capítulo 2\nUma frase com 10 segundos.'));
 it('escapa HTML de entrada',()=>expect(escapeHtml('<script>"&')).toBe('&lt;script&gt;&quot;&amp;'));
 it('impede tweaks fora dos limites e propriedades desconhecidas',()=>{expect(Tweaks.safeParse({schema_version:1,slides:{k123:{params:{headline_size_delta:-100}}}}).success).toBe(false);expect(Tweaks.safeParse({schema_version:1,slides:{k123:{params:{css:'url(remote)'}}}}).success).toBe(false);});
});
