import { cpSync } from 'node:fs';
for (const path of ['cards','art','catalog.json','game.json','round.json','rehearsal.json','demo.mp4','demo.vtt','watch.html','poster.jpg','pack-assets']) {
  cpSync('web/' + path, 'dist/' + path, {recursive:true});
}
