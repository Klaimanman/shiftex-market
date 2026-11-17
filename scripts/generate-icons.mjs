// Renders the PWA icons from the ShiftEX mark. Run: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const mark = (scale, bg, full) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${full ? `<rect width="512" height="512" fill="${bg}"/>` : `<rect x="16" y="16" width="480" height="480" rx="112" fill="${bg}"/>`}
  <g transform="translate(256 256) scale(${scale}) translate(-16 -16)">
    <path d="M8 12.5h12.5l-3-3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 19.5H11.5l3 3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const render = (svg, size, file) => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(out, file), png);
  console.log('wrote', file);
};

render(mark(16, '#0E6B5C', false), 192, 'icon-192.png');
render(mark(16, '#0E6B5C', false), 512, 'icon-512.png');
render(mark(11, '#0E6B5C', true), 512, 'icon-maskable-512.png'); // safe zone for maskable
render(mark(13, '#0E6B5C', true), 180, 'apple-touch-icon.png');
