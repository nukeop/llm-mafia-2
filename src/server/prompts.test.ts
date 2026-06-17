import { describe, expect, test } from "bun:test";
import type { GameEvent, GameState } from "../shared/types";
import { buildHistory } from "./prompts";

const stateWithEvents = (events: GameEvent[]): GameState => ({
	players: [
		{ name: "Red", kind: "ai", personality: "Paranoid", alive: true },
		{ name: "Blue", kind: "ai", personality: "Pigeon", alive: true },
		{ name: "Pink", kind: "human", alive: true },
	],
	actingPlayer: "Red",
	round: 1,
	votes: [],
	events,
	phase: "playing",
});

describe("buildHistory", () => {
	test("renders other players' speech as user messages with a name prefix", () => {
		const history = buildHistory(
			stateWithEvents([{ type: "speech", player: "Blue", content: "Coo. Coo!", round: 1 }]),
			"Red",
		);

		expect(history).toEqual([{ role: "user", content: "[Blue]: Coo. Coo!" }]);
	});

	test("renders the player's own speech as assistant messages", () => {
		const history = buildHistory(
			stateWithEvents([{ type: "speech", player: "Red", content: "I trust no one.", round: 1 }]),
			"Red",
		);

		expect(history).toEqual([{ role: "assistant", content: "I trust no one." }]);
	});

	test("renders announcements and eliminations as announcer lines", () => {
		const history = buildHistory(
			stateWithEvents([
				{ type: "announcement", content: "All votes are in! Round 1 is over.", round: 1 },
				{ type: "elimination", player: "Blue", team: "machines", round: 1 },
			]),
			"Red",
		);

		expect(history).toEqual([
			{
				role: "user",
				content:
					"[Announcer]: All votes are in! Round 1 is over.\n" +
					"[Announcer]: Blue has been eliminated! That player was on team: machines!",
			},
		]);
	});

	test("includes own thoughts and votes but hides everyone else's", () => {
		const history = buildHistory(
			stateWithEvents([
				{ type: "thought", player: "Red", content: "Blue coos too much.", round: 1 },
				{ type: "thought", player: "Blue", content: "Crumbs?", round: 1 },
				{ type: "vote", voter: "Blue", target: "Red", reason: "Startled me.", round: 1 },
				{ type: "vote", voter: "Red", target: "Blue", reason: "Suspicious cooing.", round: 1 },
			]),
			"Red",
		);

		expect(history).toEqual([
			{ role: "assistant", content: "(thought: Blue coos too much.)" },
			{ role: "assistant", content: "(voted for Blue: Suspicious cooing.)" },
		]);
	});

	test("omits end-turn and game-over events entirely", () => {
		const history = buildHistory(
			stateWithEvents([
				{ type: "endTurn", player: "Red", round: 1 },
				{ type: "endTurn", player: "Blue", round: 1 },
				{ type: "gameOver", winner: "human", round: 1 },
			]),
			"Red",
		);

		expect(history).toEqual([]);
	});

	test("merges consecutive user-visible lines into one user message", () => {
		const history = buildHistory(
			stateWithEvents([
				{ type: "speech", player: "Blue", content: "Coo.", round: 1 },
				{ type: "announcement", content: "All votes are in! Round 1 is over.", round: 1 },
				{ type: "speech", player: "Red", content: "Finally.", round: 1 },
				{ type: "speech", player: "Pink", content: "That was fast.", round: 1 },
			]),
			"Red",
		);

		expect(history).toEqual([
			{
				role: "user",
				content: "[Blue]: Coo.\n[Announcer]: All votes are in! Round 1 is over.",
			},
			{ role: "assistant", content: "Finally." },
			{ role: "user", content: "[Pink]: That was fast." },
		]);
	});
});
