import type { GameSettings } from "../../shared/protocol";
import type { GameEvent, GameState } from "../../shared/types";

/** Renders the full game log as a shareable markdown document. */
export const formatLogAsMarkdown = (state: GameState, settings: GameSettings): string => {
	const roster = state.players
		.map((player) => {
			const role = player.kind === "human" ? "**HUMAN**" : player.personality;
			const fate = player.alive ? "" : " †";
			return `- ${player.name} — ${role}${fate}`;
		})
		.join("\n");

	const header = [
		"# LLM Mafia — game log",
		"",
		`*${new Date().toLocaleString()} · model: ${settings.modelId}*`,
		"",
		roster,
	].join("\n");

	const body = state.events
		.flatMap((event, index) => {
			const previous = state.events[index - 1];
			const roundHeading =
				previous !== undefined && event.round > previous.round
					? [`\n## Round ${event.round}\n`]
					: [];
			const line = formatEvent(event);
			if (line === undefined) {
				return roundHeading;
			}
			return [...roundHeading, line];
		})
		.join("\n\n");

	return `${header}\n\n## Round 1\n\n${body}\n`;
};

const formatEvent = (event: GameEvent): string | undefined => {
	switch (event.type) {
		case "speech":
			return `**${event.player}**: ${event.content}`;
		case "thought":
			return `*(${event.player} thinks)* ${event.content}`;
		case "vote":
			return `*${event.voter} votes against ${event.target}: "${event.reason}"*`;
		case "endTurn":
			return undefined;
		case "announcement":
			return `> ${event.content}`;
		case "elimination": {
			const team = event.team === "humans" ? "the Human" : "a Machine";
			return `> **${event.player} has been eliminated! They were ${team}.**`;
		}
		case "gameOver": {
			const verdict =
				event.winner === "human" ? "The Human survived." : "The Machines win.";
			return `> **GAME OVER. ${verdict}**`;
		}
	}
};

export const downloadLog = (state: GameState, settings: GameSettings): void => {
	const markdown = formatLogAsMarkdown(state, settings);
	const blob = new Blob([markdown], { type: "text/markdown" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = `llm-mafia-${new Date().toISOString().slice(0, 16).replace(":", "")}.md`;
	link.click();

	URL.revokeObjectURL(url);
};
