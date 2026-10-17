import { cp, mkdir, writeFile } from 'node:fs/promises';
const source = 'C:/Users/Pichau/Desktop/projetos/CentralJogos/assets/';
const target = new URL('../apps/web/public/assets/items/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(`${source}items`, target, { recursive: true });
const copies = {
  'windows-file-organizer/icons/folder.svg': 'folder.svg',
  'windows-file-organizer/icons/text.svg': 'text.svg',
  'windows-file-organizer/icons/excel.svg': 'spreadsheet.svg',
  'windows-file-organizer/icons/powerpoint.svg': 'presentation.svg',
  'windows-file-organizer/icons/photo-png.svg': 'image.svg',
  'side-game/icons/security.svg': 'shield.svg',
  'side-game/icons/print.svg': 'scanner.svg',
  'side-game/icons/tv.svg': 'computer.svg',
  'side-game/icons/sd_card.svg': 'usb.svg',
  'side-game/icons/settings_ethernet.svg': 'network.svg',
  'side-game/icons/apps.svg': 'apps.svg',
  'side-game/icons/http.svg': 'browser.svg',
  'side-game/icons/developer_mode.svg': 'os.svg',
  'side-game/icons/insert_drive_file.svg': 'file.svg',
  'side-game/icons/wifi.svg': 'wifi.svg',
  'side-game/icons/language.svg': 'internet.svg',
  'side-game/icons/arrow_downward.svg': 'download.svg',
  'side-game/icons/tv.svg': 'desktop.svg',
  'side-game/icons/restart_alt.svg': 'update.svg',
  'side-game/icons/graphic_eq.svg': 'audio.svg',
  'side-game/icons/visibility.svg': 'camera.svg',
  'side-game/icons/description.svg': 'mail.svg',
  'side-game/icons/memory.svg': 'calculator.svg',
  'side-game/icons/apps.svg': 'fallback.svg',
  'side-game/icons/close.svg': 'trash.svg',
};
// Explicit entries avoid duplicate object keys for assets sharing the same original.
for (const [original, name] of Object.entries(copies))
  await cp(`${source}${original}`, new URL(name, target));
await cp(`${source}side-game/icons/tv.svg`, new URL('computer.svg', target));
await cp(`${source}side-game/icons/apps.svg`, new URL('apps.svg', target));
await writeFile(
  new URL('../apps/web/public/assets/favicon.svg', import.meta.url),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0b1931"/><text x="32" y="45" text-anchor="middle" font-family="monospace" font-size="42" font-weight="bold" fill="#ffce45">?</text></svg>',
);
