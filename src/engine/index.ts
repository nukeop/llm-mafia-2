import {
	findPlayer,
	livingAiPlayers,
	livingPlayers,
	teamOf,
	type GameEvent,
	type GameState,
	type Player,
	type Vote,
} from "../shared/types";

export type EngineAction =
	| { type: "speech"; player: string; content: string }
	| { type: "thought"; player: string; content: string }
	| { type: "vote"; voter: string; target: string; reason: string }
	| { type: "endTurn"; player: string };

export type EngineError = {
	code: "gameFinished" | "notYourTurn" | "unknownTarget" | "aiOnlyAction" | "votingClosed";
	/** Human-readable, suitable for feeding back to an LLM as a tool error. */
	message: string;
};

export type ApplyResult =
	| { ok: true; state: GameState; events: GameEvent[] }
	| { ok: false; error: EngineError };

export const createGame = (options: {
	aiPlayers: { name: string; personality: string }[];
	humans: { name: string; seat?: number }[];
}): GameState => {
	const aiPlayers: Player[] = options.aiPlayers.map(({ name, personality }) => ({
		name,
		kind: "ai",
		personality,
		alive: true,
	}));

	const players = insertHumans(aiPlayers, options.humans);

	const opening: GameEvent = {
		type: "announcement",
		content: `The game begins! ${players.length} players are present, and ${humanCountPhrase(options.humans.length)}.`,
		round: 1,
	};

	return {
		players,
		actingPlayer: players[0]!.name,
		round: 1,
		votes: [],
		events: [opening],
		phase: "playing",
	};
};

/**
 * Inserts humans into the AI player list according to their requested seats.
 * Humans without a seat are appended in array order after all seated placements.
 * Humans with a seat are inserted at that index in the final list.
 */
const insertHumans = (
	aiPlayers: Player[],
	humans: { name: string; seat?: number }[],
): Player[] => {
	const toHuman = ({ name }: { name: string }): Player => ({ name, kind: "human", alive: true });

	const seated = humans.filter((h) => h.seat !== undefined);
	const unseated = humans.filter((h) => h.seat === undefined);

	// Sort seated humans by their requested index so we insert left-to-right.
	const sortedSeated = [...seated].sort((a, b) => a.seat! - b.seat!);

	let result: Player[] = [...aiPlayers];
	for (const human of sortedSeated) {
		result = [...result.slice(0, human.seat!), toHuman(human), ...result.slice(human.seat!)];
	}

	return [...result, ...unseated.map(toHuman)];
};

export const applyAction = (state: GameState, action: EngineAction): ApplyResult => {
	if (state.phase === "finished") {
		return failure("gameFinished", "The game is over.");
	}

	const actor = actorOf(action);
	if (actor !== state.actingPlayer) {
		return failure(
			"notYourTurn",
			`It's not your turn. It's currently ${state.actingPlayer}'s turn.`,
		);
	}

	switch (action.type) {
		case "speech":
			return applySpeech(state, action);
		case "thought":
			return applyThought(state, action);
		case "endTurn":
			return applyEndTurn(state, action);
		case "vote":
			return applyVote(state, action);
	}
};

const actorOf = (action: EngineAction): string => {
	if (action.type === "vote") {
		return action.voter;
	}
	return action.player;
};

const failure = (code: EngineError["code"], message: string): ApplyResult => ({
	ok: false,
	error: { code, message },
});

const success = (state: GameState, events: GameEvent[]): ApplyResult => ({
	ok: true,
	state: { ...state, events: [...state.events, ...events] },
	events,
});

const applySpeech = (
	state: GameState,
	action: Extract<EngineAction, { type: "speech" }>,
): ApplyResult =>
	success(state, [
		{ type: "speech", player: action.player, content: action.content, round: state.round },
	]);

const applyThought = (
	state: GameState,
	action: Extract<EngineAction, { type: "thought" }>,
): ApplyResult => {
	if (findPlayer(state, action.player)?.kind !== "ai") {
		return failure("aiOnlyAction", "Only AI players can think.");
	}

	return success(state, [
		{ type: "thought", player: action.player, content: action.content, round: state.round },
	]);
};

const applyEndTurn = (
	state: GameState,
	action: Extract<EngineAction, { type: "endTurn" }>,
): ApplyResult => {
	const event: GameEvent = { type: "endTurn", player: action.player, round: state.round };

	if (state.phase === "debrief") {
		return success(advanceDebrief(state, action.player), [event]);
	}
	return success({ ...state, actingPlayer: nextLivingPlayerAfter(state, action.player) }, [event]);
};

/** Pops the current speaker off the debrief queue; an empty queue ends the game. */
const advanceDebrief = (state: GameState, player: string): GameState => {
	const remaining = (state.debriefQueue ?? []).filter((name) => name !== player);
	if (remaining.length === 0) {
		return { ...state, phase: "finished", debriefQueue: [] };
	}
	return { ...state, debriefQueue: remaining, actingPlayer: remaining[0]! };
};

const applyVote = (
	state: GameState,
	action: Extract<EngineAction, { type: "vote" }>,
): ApplyResult => {
	if (state.phase === "debrief") {
		return failure("votingClosed", "The game is over. Voting is closed.");
	}
	if (findPlayer(state, action.voter)?.kind !== "ai") {
		return failure("aiOnlyAction", "Only AI players can vote.");
	}

	const target = findPlayer(state, action.target);
	if (target === undefined || !target.alive) {
		const livingNames = livingPlayers(state).map((player) => player.name);
		return failure(
			"unknownTarget",
			`${action.target} is not a living player. Living players are: ${livingNames.join(", ")}.`,
		);
	}

	const otherVotes = state.votes.filter((vote) => vote.voter !== action.voter);
	const votes: Vote[] = [...otherVotes, { voter: action.voter, target: action.target }];
	const voteEvent: GameEvent = {
		type: "vote",
		voter: action.voter,
		target: action.target,
		reason: action.reason,
		round: state.round,
	};

	const voted: GameState = { ...state, votes };
	if (!allLivingAisHaveVoted(voted)) {
		return success(voted, [voteEvent]);
	}

	const resolution = resolveRound(voted);
	return success(resolution.state, [voteEvent, ...resolution.events]);
};

const allLivingAisHaveVoted = (state: GameState): boolean =>
	livingAiPlayers(state).every((ai) => state.votes.some((vote) => vote.voter === ai.name));

const resolveRound = (state: GameState): { state: GameState; events: GameEvent[] } => {
	const announcement: GameEvent = {
		type: "announcement",
		content: `All votes are in! Round ${state.round} is over.`,
		round: state.round,
	};

	const eliminated = pluralityTarget(state);
	if (eliminated === undefined) {
		const tie: GameEvent = {
			type: "announcement",
			content: "It's a tie! No one is eliminated this round.",
			round: state.round,
		};
		return { state: startNextRound(state), events: [announcement, tie] };
	}

	return eliminate(state, eliminated, announcement);
};

const eliminate = (
	state: GameState,
	eliminated: Player,
	announcement: GameEvent,
): { state: GameState; events: GameEvent[] } => {
	const elimination: GameEvent = {
		type: "elimination",
		player: eliminated.name,
		team: teamOf(eliminated),
		round: state.round,
	};
	const afterDeath: GameState = {
		...state,
		players: state.players.map((player) => {
			if (player.name === eliminated.name) {
				return { ...player, alive: false };
			}
			return player;
		}),
	};

	const winner = winnerAfterElimination(afterDeath);
	if (winner !== undefined) {
		return {
			state: startDebrief(afterDeath, winner),
			events: [announcement, elimination, ...debriefEvents(afterDeath, winner)],
		};
	}

	return { state: startNextRound(afterDeath), events: [announcement, elimination] };
};

/** Everyone debriefs, including the eliminated: the dead get their last word too. */
const startDebrief = (state: GameState, winner: NonNullable<GameState["winner"]>): GameState => {
	const queue = state.players.map((player) => player.name);
	return {
		...state,
		phase: "debrief",
		winner,
		debriefQueue: queue,
		actingPlayer: queue[0] ?? state.actingPlayer,
	};
};

const debriefEvents = (state: GameState, winner: NonNullable<GameState["winner"]>): GameEvent[] => {
	const humans = state.players.filter((player) => player.kind === "human");
	return [
		{ type: "gameOver", winner, round: state.round },
		{
			type: "announcement",
			content: `${humanRevealPhrase(humans.map((h) => h.name))} The game moves to a debriefing - everyone may share their final thoughts and say goodbye.`,
			round: state.round,
		},
	];
};

const humanCountPhrase = (count: number): string => {
	if (count === 1) {
		return "exactly one of them is a Human in disguise";
	}
	return "two of them are Humans in disguise";
};

const humanRevealPhrase = (names: string[]): string => {
	if (names.length === 1) {
		return `The Human was ${names[0]}.`;
	}
	return `The Humans were ${names.join(" and ")}.`;
};

/**
 * Decides the winner after a single elimination, or undefined if play continues.
 *
 * Each round removes at most one player, so the machine count decreases by one at
 * a time: the "exactly two machines" human-win line is always landed on, never
 * skipped. If a future rule ever eliminates more than one player per round, revisit
 * this equality check (and the start-state assumption that no game begins already won).
 */
const winnerAfterElimination = (state: GameState): GameState["winner"] => {
	const livingHumans = livingPlayers(state).filter((player) => player.kind === "human");
	if (livingHumans.length === 0) {
		return "machines";
	}
	if (livingAiPlayers(state).length === 2) {
		return "human";
	}
	return undefined;
};

/**
 * The most-voted living player, or undefined when the top spot is tied.
 */
const pluralityTarget = (state: GameState): Player | undefined => {
	const tally = new Map<string, number>();
	for (const vote of state.votes) {
		tally.set(vote.target, (tally.get(vote.target) ?? 0) + 1);
	}

	const counts = [...tally.entries()].toSorted(([, a], [, b]) => b - a);
	const [leader, runnerUp] = counts;
	if (leader === undefined) {
		return undefined;
	}
	if (runnerUp !== undefined && runnerUp[1] === leader[1]) {
		return undefined;
	}
	return findPlayer(state, leader[0]);
};

const startNextRound = (state: GameState): GameState => ({
	...state,
	round: state.round + 1,
	votes: [],
	actingPlayer: ensureLivingActor(state),
});

/** Keeps the acting player if they survived; otherwise the next living player acts. */
const ensureLivingActor = (state: GameState): string => {
	const actor = findPlayer(state, state.actingPlayer);
	if (actor !== undefined && actor.alive) {
		return actor.name;
	}
	return nextLivingPlayerAfter(state, state.actingPlayer);
};

const nextLivingPlayerAfter = (state: GameState, name: string): string => {
	const count = state.players.length;
	const startIndex = state.players.findIndex((player) => player.name === name);

	for (let offset = 1; offset <= count; offset += 1) {
		const candidate = state.players[(startIndex + offset) % count];
		if (candidate !== undefined && candidate.alive) {
			return candidate.name;
		}
	}
	return name;
};
