import { cpSync } from 'node:fs';
for (const path of ['cards','art','catalog.json','game.json','round.json','rehearsal.json']) {
  cpSync('web/' + path, 'dist/' + path, {recursive:true});
}
