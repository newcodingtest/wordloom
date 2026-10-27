import struct,zlib
from pathlib import Path
for size in [192,512]:
 rows=[]
 for y in range(size):
  row=bytearray()
  for x in range(size):
   X=(x-size/2)/size;Y=(y-size/2)/size
   leaf=((X+.12)**2/.025+(Y+.1)**2/.06<1) or ((X-.12)**2/.025+(Y+.1)**2/.06<1) or(abs(X)<.027 and -.08<Y<.28)
   row.extend((181,241,207) if leaf else (25,44,42))
  rows.append(b'\0'+row)
 def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 Path(f'icons/icon-{size}.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))
