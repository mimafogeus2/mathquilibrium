'use strict';
// A worker that builds an Impossible daily off the page's thread (theme.js starts it): { gen: the game's gen.js, tier, key } in, the puzzle out.
importScripts('common.js');
onmessage = ({ data: { gen, tier, key } }) => {
  importScripts(gen);
  postMessage(generate(hash(key), tier));
};
