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

// Unified type for Chef's Table grid — normalizes default and custom chefs.
export type ChefSlot = {
  id: string;                    // default: "gordon-ramsay", custom: channelId
  name: string;
  youtubeChannelId: string;
  isDefault: boolean;
  emoji: string;                 // defaults have unique emoji, customs get "👨‍🍳"
  country?: string;              // only defaults
  thumbnail?: string;            // YouTube avatar URL — only custom
};

export const DEFAULT_CHEF_IDS = CHEFS.map((c) => c.id);

export function defaultToSlot(chef: Chef): ChefSlot {
  return {
    id: chef.id,
    name: chef.name,
    youtubeChannelId: chef.youtubeChannelId,
    isDefault: true,
    emoji: chef.emoji,
    country: chef.country,
  };
}

export type CustomChefData = {
  channelId: string;
  channelName: string;
  channelThumbnail: string;
};

export function customToSlot(chef: CustomChefData): ChefSlot {
  return {
    id: chef.channelId,
    name: chef.channelName,
    youtubeChannelId: chef.channelId,
    isDefault: false,
    emoji: "👨‍🍳",
    thumbnail: chef.channelThumbnail,
  };
}

export function getSelectedSlots(ids: string[], allSlots: ChefSlot[]): ChefSlot[] {
  return allSlots.filter((slot) => ids.includes(slot.id));
}
