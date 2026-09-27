// ZIP store format: PNGs are already compressed. No external archiver needed.
export function zipFiles(files:{name:string;data:Buffer}[]){
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const f of files){if(!/^\d{2}\.png$/.test(f.name))throw Error('Nome inválido no ZIP');let crc=0xffffffff;for(const byte of f.data)crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;const name=Buffer.from(f.name);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x21,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(f.data.length,18);h.writeUInt32LE(f.data.length,22);h.writeUInt16LE(name.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x21,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(f.data.length,20);c.writeUInt32LE(f.data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);local.push(h,name,f.data);offset+=h.length+name.length+f.data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
