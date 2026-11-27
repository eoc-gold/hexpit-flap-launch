import { cpSync, existsSync } from 'node:fs';
for (const path of ['cards','art','catalog.json','game.json','round.json','rehearsal.json','table-fork.json','demo.mp4','demo.vtt','watch.html','poster.jpg','pack-assets']) {
  cpSync('web/' + path, 'dist/' + path, {recursive:true});
}
if (existsSync('web/table-testnet.json')) cpSync('web/table-testnet.json', 'dist/table-testnet.json');
