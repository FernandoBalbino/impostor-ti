import { cp, readFile, writeFile } from 'node:fs/promises';
import {
  faEdge,
  faOpera,
  faBrave,
  faSafari,
  faLinux,
  faAndroid,
  faApple,
} from '@fortawesome/free-brands-svg-icons';
const target = new URL('../apps/web/public/assets/items/', import.meta.url);
const mappings = {
  trash: 'trash',
  calculator: 'calculator',
  mail: 'envelope-simple',
  camera: 'video-camera',
  computer: 'desktop-tower',
  usb: 'usb',
  network: 'plugs-connected',
  apps: 'squares-four',
  download: 'download-simple',
  internet: 'globe',
  wifi: 'wifi-high',
  file: 'file',
  desktop: 'desktop',
  update: 'arrow-clockwise',
  audio: 'microphone',
  shield: 'shield-check',
  fallback: 'question',
};
for (const [name, icon] of Object.entries(mappings)) {
  const content = await readFile(
    new URL(
      `../node_modules/@phosphor-icons/core/assets/duotone/${icon}-duotone.svg`,
      import.meta.url,
    ),
    'utf8',
  );
  await writeFile(
    new URL(`${name}.svg`, target),
    content.replace('fill="currentColor"', 'fill="#27496c"'),
  );
}
for (const [name, icon, color] of [
  ['edge', faEdge, '#148caa'],
  ['opera', faOpera, '#e53c4f'],
  ['brave', faBrave, '#ed6e29'],
  ['safari', faSafari, '#228cc6'],
  ['linux', faLinux, '#23324c'],
  ['android', faAndroid, '#55a94c'],
  ['apple', faApple, '#526078'],
]) {
  const [width, height, , , paths] = icon.icon;
  await writeFile(
    new URL(`${name}.svg`, target),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="${color}">${(Array.isArray(paths) ? paths : [paths]).map((d) => `<path d="${d}"/>`).join('')}</svg>`,
  );
}
await cp(
  new URL('../node_modules/@phosphor-icons/core/LICENSE', import.meta.url),
  new URL('../apps/web/public/assets/PHOSPHOR-LICENSE.txt', import.meta.url),
);
await cp(
  new URL('../node_modules/@fortawesome/free-brands-svg-icons/LICENSE.txt', import.meta.url),
  new URL('../apps/web/public/assets/FONT-AWESOME-LICENSE.txt', import.meta.url),
);
