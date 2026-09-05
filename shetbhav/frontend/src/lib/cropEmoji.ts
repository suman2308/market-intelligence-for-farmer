const CROP_EMOJI: Record<string, string> = {
  tomato: "🍅",
  onion: "🧅",
  soybean: "🫘",
};

export function cropEmoji(cropName: string | null | undefined): string {
  return CROP_EMOJI[(cropName || "").toLowerCase()] || "🌾";
}
