import { describe,it,expect } from 'vitest';
import { parseCopy,cleanTranscript,toCopy,emphasis } from './copy.js';
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
describe('importação — casos da Rodada 0',()=>{
 it('marcador com headline na mesma linha, sem separador',()=>expect(parseCopy('P1 Tu sabe escutar?\n\nP2 Uma pergunta muda tudo\nCorpo.')).toEqual([{headline:'Tu sabe escutar?',body:null},{headline:'Uma pergunta muda tudo',body:'Corpo.'}]));
 it('P2P no início da linha é texto, não marcador',()=>expect(parseCopy('P1\nTítulo\n\nP2\nOutro\nP2P cresce.')[1].body).toBe('P2P cresce.'));
 it('formato Figma com parágrafos no body quando painéis são separados por duas linhas em branco',()=>expect(parseCopy('Capa aqui\n\n\nTítulo dois\nPrimeiro parágrafo.\n\nSegundo parágrafo.\n\n\nTítulo três\nCorpo.')).toEqual([{headline:'Capa aqui',body:null},{headline:'Título dois',body:'Primeiro parágrafo.\n\nSegundo parágrafo.'},{headline:'Título três',body:'Corpo.'}]));
 it('copy.md derivado reimporta igual, com parágrafos e ênfase',()=>{const p=[{headline:'Capa',body:null},{headline:'Um **HOMEM** decide',body:'Um.\n\nDois com **ênfase**.'}];expect(parseCopy(toCopy(p))).toEqual(p);});
 it('CAIXA ALTA dentro de texto misto vira ênfase; texto todo em caixa alta não',()=>{expect(emphasis('Como um HOMEM escolhe uma MULHER?')).toBe('Como um **HOMEM** escolhe uma **MULHER**?');expect(emphasis('TUDO EM CAIXA ALTA')).toBe('TUDO EM CAIXA ALTA');expect(emphasis('Já **marcado** e NÃO marcado')).toBe('Já **marcado** e **NÃO** marcado');expect(emphasis('Uma A só')).toBe('Uma A só');});
});
