const sharp = require('sharp');
const path = require('path');

const SIZE = 256;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="ocean" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#5bc5f7"/>
      <stop offset="100%" stop-color="#1565c0"/>
    </radialGradient>
    <radialGradient id="shine" cx="35%" cy="30%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Globe -->
  <circle cx="118" cy="138" r="108" fill="url(#ocean)"/>

  <!-- Europe -->
  <path d="M105,62 L112,58 L120,60 L126,55 L132,58 L130,65 L135,70 L132,78 L126,80 L118,76 L110,78 L105,72 Z" fill="#4caf50"/>
  <!-- Scandinavia -->
  <path d="M118,45 L122,42 L124,48 L120,55 L116,52 Z" fill="#4caf50"/>
  <!-- British Isles -->
  <path d="M98,60 L102,57 L104,62 L100,65 Z" fill="#4caf50"/>

  <!-- Africa -->
  <path d="M112,82 L120,80 L128,82 L135,90 L140,100 L145,115 L148,130 L146,145 L140,160 L132,170 L124,175 L118,172 L112,165 L106,155 L102,140 L100,125 L102,110 L105,98 L108,88 Z" fill="#4caf50"/>
  <!-- Madagascar -->
  <path d="M150,150 L153,145 L155,152 L152,158 Z" fill="#4caf50"/>

  <!-- Arabian Peninsula -->
  <path d="M140,88 L148,85 L158,90 L162,100 L158,108 L150,112 L144,108 L140,100 Z" fill="#4caf50"/>

  <!-- India -->
  <path d="M165,100 L175,95 L182,100 L185,110 L182,125 L175,135 L168,130 L164,118 L162,108 Z" fill="#4caf50"/>
  <!-- Sri Lanka -->
  <ellipse cx="176" cy="140" rx="4" ry="5" fill="#4caf50"/>

  <!-- Middle East / Iran -->
  <path d="M150,78 L160,75 L170,78 L175,85 L172,92 L165,95 L155,92 L148,85 Z" fill="#4caf50"/>

  <!-- Greenland hint -->
  <path d="M68,40 L80,35 L88,40 L85,48 L75,50 L68,46 Z" fill="#e0e0e0"/>

  <!-- Globe shine overlay -->
  <circle cx="118" cy="138" r="108" fill="url(#shine)"/>

  <!-- Chat bubble (white) -->
  <g transform="translate(155, 5)">
    <rect x="0" y="0" width="90" height="62" rx="16" fill="white"/>
    <polygon points="15,62 28,80 38,62" fill="white"/>
    <!-- Light gray dots -->
    <circle cx="30" cy="30" r="7" fill="#bdbdbd"/>
    <circle cx="50" cy="30" r="7" fill="#bdbdbd"/>
    <circle cx="70" cy="30" r="7" fill="#bdbdbd"/>
  </g>
</svg>`;

async function generate() {
  const pngBuf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  await sharp(pngBuf).toFile(path.join(__dirname, 'assets', 'icon.png'));

  const sizes = [16, 32, 48, 256];
  const images = [];
  for (const s of sizes) {
    images.push(await sharp(pngBuf).resize(s, s).png().toBuffer());
  }

  const ico = createIco(images, sizes);
  require('fs').writeFileSync(path.join(__dirname, 'assets', 'icon.ico'), ico);
  console.log('Icon generated!');
}

function createIco(images, sizes) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = images.length;
  let offset = headerSize + dirEntrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const dirEntries = [];
  for (let i = 0; i < numImages; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const s = sizes[i] >= 256 ? 0 : sizes[i];
    entry.writeUInt8(s, 0);
    entry.writeUInt8(s, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += images[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...images]);
}

generate();
