// Which tile color a Section gets on the home screen, by its position.
// Position (not id) so the pinned four always form the same balanced
// teal/aqua/sky/cyan block like the prototype, whatever they're called.
const TILE_BG = [
  "bg-tile-teal",
  "bg-tile-aqua",
  "bg-tile-sky",
  "bg-tile-cyan",
  "bg-tile-blue",
  "bg-tile-deep",
];

export function tileColor(index: number): string {
  return TILE_BG[((index % TILE_BG.length) + TILE_BG.length) % TILE_BG.length];
}
