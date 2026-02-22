// lib/chefs.ts
// Curated celebrity chef list for the Chef's Table feature.
// Channel IDs are permanent YouTube identifiers — verified manually before use.

export type Chef = {
  id: string;
  name: string;
  country: string;
  emoji: string;
  youtubeChannelId: string;
};

export const CHEFS: Chef[] = [
  { id: "gordon-ramsay",         name: "Gordon Ramsay",         country: "UK",       emoji: "🍳", youtubeChannelId: "UCIEv3lZ_tNXHzL3ox-_uUGQ" },
  { id: "jamie-oliver",          name: "Jamie Oliver",          country: "UK",       emoji: "🍕", youtubeChannelId: "UCpSgg_ECBj25s9moCDfSTsA" },
  { id: "ranveer-brar",          name: "Ranveer Brar",          country: "India",    emoji: "🍛", youtubeChannelId: "UCEHCDn_BBnk3uTK1M64ptyw" },
  { id: "maangchi",              name: "Maangchi",              country: "Korea",    emoji: "🥢", youtubeChannelId: "UC8gFadPgK2r1ndqLI04Xvvw" },
  { id: "pati-jinich",           name: "Pati Jinich",           country: "Mexico",   emoji: "🌮", youtubeChannelId: "UCdtXmukQ1Vp86Ldl7rOrPAw" },
  { id: "kenji-lopez-alt",       name: "Kenji López-Alt",       country: "USA",      emoji: "🔬", youtubeChannelId: "UCqqJQ_cXSat0KIAVfIfKkVA" },
  { id: "pailin-chongchitnant",  name: "Pailin Chongchitnant",  country: "Thailand", emoji: "🌶️", youtubeChannelId: "UC27C_HWo-UmKkdWGsRJZ8EA" },
  { id: "lidia-bastianich",      name: "Lidia Bastianich",      country: "Italy",    emoji: "🍝", youtubeChannelId: "UCaKGzfu_hg7NcRxjbZStTFg" },
];

// Returns only the chefs whose IDs are in the given array.
export function getSelectedChefs(ids: string[]): Chef[] {
  return CHEFS.filter((chef) => ids.includes(chef.id));
}
