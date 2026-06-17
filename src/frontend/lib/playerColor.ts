const PALETTE = [
	"#ffb454",
	"#7aa2f7",
	"#9ece6a",
	"#f7768e",
	"#bb9af7",
	"#73daca",
	"#e0af68",
	"#ff9e64",
	"#7dcfff",
] as const;

/** Deterministic accent color per player name. */
export const playerColor = (name: string): string => {
	const hash = [...name].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 7919, 7);
	return PALETTE[hash % PALETTE.length]!;
};
