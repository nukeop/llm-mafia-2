import { describe, expect, test } from "bun:test";
import type { GameState } from "../shared/types";
import { applyAction, createGame, type EngineAction } from "./index";

const newGame = (aiNames: string[] = ["Red", "Blue", "Green", "Orange"]) =>
	createGame({
		aiPlayers: aiNames.map((name) => ({ name, personality: `${name}-personality` })),
		humans: [{ name: "Pink" }],
	});

/** Applies an action that is expected to succeed and returns the new state. */
const apply = (state: GameState, action: EngineAction): GameState => {
	const result = applyAction(state, action);
	if (!result.ok) {
		throw new Error(`Expected action to succeed, got: ${result.error.message}`);
	}
	return result.state;
};

const applyAll = (state: GameState, actions: EngineAction[]): GameState =>
	actions.reduce(apply, state);

const vote = (voter: string, target: string): EngineAction => ({
	type: "vote",
	voter,
	target,
	reason: `${voter} suspects ${target}`,
});

const endTurn = (player: string): EngineAction => ({ type: "endTurn", player });

/** Red, Blue, Green all vote for the given targets, ending turns in between. */
const fullVotingRound = (targets: [string, string, string, string]): EngineAction[] => [
	vote("Red", targets[0]),
	endTurn("Red"),
	vote("Blue", targets[1]),
	endTurn("Blue"),
	vote("Green", targets[2]),
	endTurn("Green"),
	vote("Orange", targets[3]),
];

describe("createGame", () => {
	test("seats the human at the end by default", () => {
		const state = newGame();

		expect(state.players).toEqual([
			{ name: "Red", kind: "ai", personality: "Red-personality", alive: true },
			{ name: "Blue", kind: "ai", personality: "Blue-personality", alive: true },
			{ name: "Green", kind: "ai", personality: "Green-personality", alive: true },
			{ name: "Orange", kind: "ai", personality: "Orange-personality", alive: true },
			{ name: "Pink", kind: "human", alive: true },
		]);
	});

	test("seats the human at the requested position", () => {
		const state = createGame({
			aiPlayers: [
				{ name: "Red", personality: "a" },
				{ name: "Blue", personality: "b" },
			],
			humans: [{ name: "Pink", seat: 1 }],
		});

		expect(state.players.map((player) => player.name)).toEqual(["Red", "Pink", "Blue"]);
		expect(state.actingPlayer).toBe("Red");
	});

	test("a human seated first acts first", () => {
		const state = createGame({
			aiPlayers: [
				{ name: "Red", personality: "a" },
				{ name: "Blue", personality: "b" },
			],
			humans: [{ name: "Pink", seat: 0 }],
		});

		expect(state.players.map((player) => player.name)).toEqual(["Pink", "Red", "Blue"]);
		expect(state.actingPlayer).toBe("Pink");
	});

	test("two humans seated among AIs produce the correct interleaved order", () => {
		const state = createGame({
			aiPlayers: [
				{ name: "Red", personality: "a" },
				{ name: "Blue", personality: "b" },
				{ name: "Green", personality: "c" },
			],
			humans: [
				{ name: "Pink", seat: 0 },
				{ name: "Violet", seat: 3 },
			],
		});

		expect(state.players.map((player) => player.name)).toEqual([
			"Pink",
			"Red",
			"Blue",
			"Violet",
			"Green",
		]);
		expect(state.players.filter((player) => player.kind === "human")).toEqual([
			{ name: "Pink", kind: "human", alive: true },
			{ name: "Violet", kind: "human", alive: true },
		]);
		expect(state.players.every((player) => player.alive)).toBe(true);
		expect(state.actingPlayer).toBe("Pink");
	});

	test("starts at round 1 with the first AI acting", () => {
		const state = newGame();

		expect(state.actingPlayer).toBe("Red");
		expect(state.round).toBe(1);
		expect(state.phase).toBe("playing");
		expect(state.votes).toEqual([]);
	});

	test("opens the log with a game-start announcement for one human", () => {
		const state = newGame();

		expect(state.events).toEqual([
			{
				type: "announcement",
				content:
					"The game begins! 5 players are present, and exactly one of them is a Human in disguise.",
				round: 1,
			},
		]);
	});

	test("opens the log with a two-human game-start announcement", () => {
		const state = createGame({
			aiPlayers: [
				{ name: "Red", personality: "a" },
				{ name: "Blue", personality: "b" },
				{ name: "Green", personality: "c" },
			],
			humans: [{ name: "Pink" }, { name: "Violet" }],
		});

		expect(state.events).toEqual([
			{
				type: "announcement",
				content:
					"The game begins! 5 players are present, and two of them are Humans in disguise.",
				round: 1,
			},
		]);
	});
});

describe("speech", () => {
	test("the acting player can speak", () => {
		const state = apply(newGame(), { type: "speech", player: "Red", content: "Hello all" });

		expect(state.events.at(-1)).toEqual({ type: "speech", player: "Red", content: "Hello all", round: 1 });
	});

	test("speaking out of turn is rejected", () => {
		const result = applyAction(newGame(), {
			type: "speech",
			player: "Blue",
			content: "Interrupting",
		});

		expect(result).toEqual({
			ok: false,
			error: {
				code: "notYourTurn",
				message: "It's not your turn. It's currently Red's turn.",
			},
		});
	});

	test("the human can speak on their turn", () => {
		const toHumanTurn = ["Red", "Blue", "Green", "Orange"].map(endTurn);
		const state = applyAll(newGame(), toHumanTurn);
		const spoken = apply(state, { type: "speech", player: "Pink", content: "Just a robot here" });

		expect(spoken.events.at(-1)).toEqual({
			type: "speech",
			player: "Pink",
			content: "Just a robot here",
			round: 1,
		});
	});
});

describe("thought", () => {
	test("the acting AI can think privately", () => {
		const state = apply(newGame(), { type: "thought", player: "Red", content: "Blue seems off" });

		expect(state.events.at(-1)).toEqual({ type: "thought", player: "Red", content: "Blue seems off", round: 1 });
	});

	test("the human cannot think", () => {
		const toHumanTurn = ["Red", "Blue", "Green", "Orange"].map(endTurn);
		const state = applyAll(newGame(), toHumanTurn);
		const result = applyAction(state, { type: "thought", player: "Pink", content: "hmm" });

		expect(result).toEqual({
			ok: false,
			error: { code: "aiOnlyAction", message: "Only AI players can think." },
		});
	});
});

describe("turn rotation", () => {
	test("endTurn advances through the roster and wraps back around", () => {
		const state = applyAll(newGame(), ["Red", "Blue", "Green", "Orange", "Pink"].map(endTurn));

		expect(state.actingPlayer).toBe("Red");
	});

	test("endTurn emits an event", () => {
		const state = apply(newGame(), endTurn("Red"));

		expect(state.events.at(-1)).toEqual({ type: "endTurn", player: "Red", round: 1 });
	});

	test("rotation skips dead players", () => {
		// Everyone votes Blue; Blue dies. Orange (acting) ends turn -> Pink, who
		// ends turn -> Red, who ends turn -> Green (skipping dead Blue).
		const state = applyAll(newGame(), [
			...fullVotingRound(["Blue", "Blue", "Blue", "Blue"]),
			endTurn("Orange"),
			endTurn("Pink"),
			endTurn("Red"),
		]);

		expect(state.actingPlayer).toBe("Green");
	});
});

describe("voting", () => {
	test("a vote is recorded and does not end the turn", () => {
		const state = apply(newGame(), vote("Red", "Pink"));

		expect(state.votes).toEqual([{ voter: "Red", target: "Pink" }]);
		expect(state.actingPlayer).toBe("Red");
		expect(state.events.at(-1)).toEqual({
			type: "vote",
			voter: "Red",
			target: "Pink",
			reason: "Red suspects Pink",
			round: 1,
		});
	});

	test("re-voting replaces the previous vote", () => {
		const state = applyAll(newGame(), [vote("Red", "Pink"), vote("Red", "Blue")]);

		expect(state.votes).toEqual([{ voter: "Red", target: "Blue" }]);
	});

	test("the human cannot vote", () => {
		const toHumanTurn = ["Red", "Blue", "Green", "Orange"].map(endTurn);
		const state = applyAll(newGame(), toHumanTurn);
		const result = applyAction(state, vote("Pink", "Red"));

		expect(result).toEqual({
			ok: false,
			error: { code: "aiOnlyAction", message: "Only AI players can vote." },
		});
	});

	test("voting for a nonexistent player is rejected with the list of valid targets", () => {
		const result = applyAction(newGame(), vote("Red", "Chartreuse"));

		expect(result).toEqual({
			ok: false,
			error: {
				code: "unknownTarget",
				message:
					"Chartreuse is not a living player. Living players are: Red, Blue, Green, Orange, Pink.",
			},
		});
	});

	test("voting for a dead player is rejected", () => {
		const blueIsDead = applyAll(newGame(), [
			...fullVotingRound(["Blue", "Blue", "Blue", "Blue"]),
			endTurn("Orange"),
			endTurn("Pink"),
		]);
		const result = applyAction(blueIsDead, vote("Red", "Blue"));

		expect(result).toEqual({
			ok: false,
			error: {
				code: "unknownTarget",
				message: "Blue is not a living player. Living players are: Red, Green, Orange, Pink.",
			},
		});
	});
});

describe("round resolution", () => {
	test("a plurality eliminates the target and starts the next round", () => {
		const state = applyAll(newGame(), fullVotingRound(["Blue", "Blue", "Blue", "Pink"]));

		expect(state.players.find((player) => player.name === "Blue")?.alive).toBe(false);
		expect(state.round).toBe(2);
		expect(state.votes).toEqual([]);
		expect(state.phase).toBe("playing");
	});

	test("resolution emits the announcement and elimination stamped with the ending round", () => {
		const state = applyAll(newGame(), fullVotingRound(["Blue", "Blue", "Blue", "Pink"]));

		expect(state.events.slice(-2)).toEqual([
			{ type: "announcement", content: "All votes are in! Round 1 is over.", round: 1 },
			{ type: "elimination", player: "Blue", team: "machines", round: 1 },
		]);
	});

	test("events after resolution are stamped with the new round", () => {
		const state = applyAll(newGame(), [
			...fullVotingRound(["Blue", "Blue", "Blue", "Pink"]),
			{ type: "speech", player: "Orange", content: "Justice for Blue" },
		]);

		expect(state.events.at(-1)).toEqual({
			type: "speech",
			player: "Orange",
			content: "Justice for Blue",
			round: 2,
		});
	});

	test("a tie eliminates nobody and starts the next round", () => {
		const state = applyAll(newGame(), fullVotingRound(["Blue", "Blue", "Pink", "Pink"]));

		expect(state.players.every((player) => player.alive)).toBe(true);
		expect(state.round).toBe(2);
		expect(state.votes).toEqual([]);
		expect(state.events.slice(-2)).toEqual([
			{ type: "announcement", content: "All votes are in! Round 1 is over.", round: 1 },
			{
				type: "announcement",
				content: "It's a tie! No one is eliminated this round.",
				round: 1,
			},
		]);
	});

	test("the acting player keeps acting if they survive resolution", () => {
		const state = applyAll(newGame(), fullVotingRound(["Blue", "Blue", "Blue", "Pink"]));

		expect(state.actingPlayer).toBe("Orange");
	});

	test("the turn advances if the acting player was eliminated", () => {
		const state = applyAll(newGame(), fullVotingRound(["Orange", "Orange", "Orange", "Pink"]));

		expect(state.actingPlayer).toBe("Pink");
	});
});

describe("game over", () => {
	test("eliminating the human means the machines win", () => {
		const state = applyAll(newGame(), fullVotingRound(["Pink", "Pink", "Pink", "Pink"]));

		expect(state.winner).toBe("machines");
		expect(state.events.at(-2)).toEqual({ type: "gameOver", winner: "machines", round: 1 });
	});

	test("the human wins when only two AI players remain", () => {
		const state = applyAll(newGame(["Red", "Blue", "Green"]), [
			vote("Red", "Blue"),
			endTurn("Red"),
			vote("Blue", "Red"),
			endTurn("Blue"),
			vote("Green", "Blue"),
		]);

		expect(state.winner).toBe("human");
		expect(state.events.at(-2)).toEqual({ type: "gameOver", winner: "human", round: 1 });
	});

	describe("two-human games", () => {
		// 3 AIs + 2 humans: Red, Blue, Green, Pink, Violet
		const twoHumanGame = () =>
			createGame({
				aiPlayers: [
					{ name: "Red", personality: "a" },
					{ name: "Blue", personality: "b" },
					{ name: "Green", personality: "c" },
				],
				humans: [{ name: "Pink" }, { name: "Violet" }],
			});

		const twoHumanVote = (targets: [string, string, string]): EngineAction[] => [
			vote("Red", targets[0]),
			endTurn("Red"),
			vote("Blue", targets[1]),
			endTurn("Blue"),
			vote("Green", targets[2]),
		];

		test("voting out one human with two humans alive continues the game", () => {
			const state = applyAll(twoHumanGame(), twoHumanVote(["Pink", "Pink", "Pink"]));

			expect(state.winner).toBeUndefined();
			expect(state.phase).toBe("playing");
			expect(state.round).toBe(2);
		});

		test("voting out the second human after the first gives machines the win", () => {
			const round1 = applyAll(twoHumanGame(), twoHumanVote(["Pink", "Pink", "Pink"]));
			// After round 1, Green was the last voter so Green is still acting. Advance to Red.
			const round2Start = applyAll(round1, [endTurn("Green"), endTurn("Violet")]);
			const state = applyAll(round2Start, twoHumanVote(["Violet", "Violet", "Violet"]));

			expect(state.winner).toBe("machines");
			expect(state.phase).toBe("debrief");
		});

		test("reducing machines to two with both humans alive gives the humans the win", () => {
			const state = applyAll(twoHumanGame(), twoHumanVote(["Blue", "Blue", "Blue"]));

			expect(state.winner).toBe("human");
			expect(state.phase).toBe("debrief");
		});

		test("a lone surviving human wins by attrition after their teammate is eliminated", () => {
			const round1 = applyAll(twoHumanGame(), twoHumanVote(["Pink", "Pink", "Pink"]));
			// After round 1, Green was the last voter so Green is still acting. Advance to Red.
			const round2Start = applyAll(round1, [endTurn("Green"), endTurn("Violet")]);
			const state = applyAll(round2Start, twoHumanVote(["Blue", "Blue", "Blue"]));

			expect(state.winner).toBe("human");
			expect(state.phase).toBe("debrief");
			expect(state.players.find((player) => player.name === "Pink")?.alive).toBe(false);
			expect(state.players.find((player) => player.name === "Violet")?.alive).toBe(true);
		});
	});
});

describe("debrief", () => {
	const machinesWin = () => applyAll(newGame(), fullVotingRound(["Pink", "Pink", "Pink", "Pink"]));

	test("the game moves to a debrief of all players, dead or alive, with the human revealed", () => {
		const state = machinesWin();

		expect(state.phase).toBe("debrief");
		expect(state.debriefQueue).toEqual(["Red", "Blue", "Green", "Orange", "Pink"]);
		expect(state.actingPlayer).toBe("Red");
		expect(state.events.at(-1)).toEqual({
			type: "announcement",
			content:
				"The Human was Pink. The game moves to a debriefing - everyone may share their final thoughts and say goodbye.",
			round: 1,
		});
	});

	test("the debrief reveals both humans when two were in the game", () => {
		const twoHumanGame = createGame({
			aiPlayers: [
				{ name: "Red", personality: "a" },
				{ name: "Blue", personality: "b" },
				{ name: "Green", personality: "c" },
			],
			humans: [{ name: "Pink" }, { name: "Violet" }],
		});
		// Vote out both humans to end the game with machines winning.
		const round1 = applyAll(twoHumanGame, [
			vote("Red", "Pink"),
			endTurn("Red"),
			vote("Blue", "Pink"),
			endTurn("Blue"),
			vote("Green", "Pink"),
			endTurn("Green"),
			endTurn("Violet"),
			vote("Red", "Violet"),
			endTurn("Red"),
			vote("Blue", "Violet"),
			endTurn("Blue"),
			vote("Green", "Violet"),
		]);

		expect(round1.phase).toBe("debrief");
		expect(round1.events.at(-1)).toEqual({
			type: "announcement",
			content:
				"The Humans were Pink and Violet. The game moves to a debriefing - everyone may share their final thoughts and say goodbye.",
			round: 2,
		});
	});

	test("eliminated players are part of the debrief queue", () => {
		const state = applyAll(newGame(["Red", "Blue", "Green"]), [
			vote("Red", "Blue"),
			endTurn("Red"),
			vote("Blue", "Red"),
			endTurn("Blue"),
			vote("Green", "Blue"),
		]);

		expect(state.phase).toBe("debrief");
		expect(state.debriefQueue).toEqual(["Red", "Blue", "Green", "Pink"]);
	});

	test("an eliminated player can speak on their debrief turn", () => {
		const debrief = applyAll(machinesWin(), ["Red", "Blue", "Green", "Orange"].map(endTurn));
		const state = apply(debrief, {
			type: "speech",
			player: "Pink",
			content: "You got me. Well played, Orange.",
		});

		expect(state.actingPlayer).toBe("Pink");
		expect(state.events.at(-1)).toEqual({
			type: "speech",
			player: "Pink",
			content: "You got me. Well played, Orange.",
			round: 1,
		});
	});

	test("players can speak and think during their debrief turn", () => {
		const state = apply(machinesWin(), {
			type: "speech",
			player: "Red",
			content: "Good game, fellow machines.",
		});

		expect(state.events.at(-1)).toEqual({
			type: "speech",
			player: "Red",
			content: "Good game, fellow machines.",
			round: 1,
		});
	});

	test("speaking out of turn during the debrief is rejected", () => {
		const result = applyAction(machinesWin(), { type: "speech", player: "Blue", content: "Me first" });

		expect(result).toEqual({
			ok: false,
			error: {
				code: "notYourTurn",
				message: "It's not your turn. It's currently Red's turn.",
			},
		});
	});

	test("voting is closed during the debrief", () => {
		const result = applyAction(machinesWin(), vote("Red", "Blue"));

		expect(result).toEqual({
			ok: false,
			error: { code: "votingClosed", message: "The game is over. Voting is closed." },
		});
	});

	test("each player gets one final turn, then the game finishes", () => {
		const state = applyAll(
			machinesWin(),
			["Red", "Blue", "Green", "Orange", "Pink"].map(endTurn),
		);

		expect(state.phase).toBe("finished");
	});

	test("no actions are accepted once the debrief is over", () => {
		const finished = applyAll(
			machinesWin(),
			["Red", "Blue", "Green", "Orange", "Pink"].map(endTurn),
		);
		const result = applyAction(finished, { type: "speech", player: "Red", content: "gg" });

		expect(result).toEqual({
			ok: false,
			error: { code: "gameFinished", message: "The game is over." },
		});
	});
});

describe("immutability", () => {
	test("applyAction does not mutate the input state", () => {
		const state = newGame();
		const snapshot = structuredClone(state);

		applyAction(state, vote("Red", "Pink"));

		expect(state).toEqual(snapshot);
	});
});
