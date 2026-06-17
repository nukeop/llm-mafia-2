import { createGame } from "../engine";
import type { SeatClaim, TurnStatus } from "../shared/protocol";
import { findPlayer, type GameSettings, type GameState, type Player } from "../shared/types";
import names from "../config/names.json";
import personalities from "../config/personalities.json";

export type GameSession = {
	readonly id: string;
	state: GameState;
	readonly settings: GameSettings;
	readonly apiKey?: string;
	/** True while an AI turn is being processed; guards against double advancement. */
	busy: boolean;
	/** Maps an identity token to the human player name it controls. Grows as seats are claimed. */
	claims: Map<string, string>;
};

export type Personality = {
	name: string;
	description: string;
};

export type CreateSessionResult = {
	session: GameSession;
	host: SeatClaim;
};

const sessions = new Map<string, GameSession>();

const shuffled = <T>(items: readonly T[]): T[] => {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j]!, copy[i]!];
	}
	return copy;
};

const distinctIndices = (count: number, range: number): number[] => {
	const pool = Array.from({ length: range }, (_, i) => i);
	return shuffled(pool).slice(0, count);
};

export const createSession = (settings: GameSettings, apiKey?: string): CreateSessionResult => {
	const totalPlayers = settings.aiCount + settings.humanCount;
	if (names.length < totalPlayers) {
		throw new Error(`Not enough player names: need ${totalPlayers}, have ${names.length}.`);
	}

	const sampledNames = shuffled(names).slice(0, totalPlayers);
	const sampledPersonalities = shuffled(personalities).slice(0, settings.aiCount);

	const aiPlayers = sampledPersonalities.map((personality, index) => ({
		name: sampledNames[index]!,
		personality: personality.name,
	}));

	const humanSeats = distinctIndices(settings.humanCount, totalPlayers);
	const humans = humanSeats.map((seat, index) => ({
		name: sampledNames[settings.aiCount + index]!,
		seat,
	}));

	const session: GameSession = {
		id: crypto.randomUUID(),
		state: createGame({ aiPlayers, humans }),
		settings,
		apiKey,
		busy: false,
		claims: new Map(),
	};

	// The host occupies the first human seat. claimSeat owns the binding rule,
	// so creation and joining assign seats identically.
	const host = claimSeat(session);
	if (host === undefined) {
		throw new Error("createSession built a game with no human seat to host.");
	}

	sessions.set(session.id, session);

	return { session, host };
};

export const getSession = (id: string): GameSession | undefined => sessions.get(id);

export const personalityDescription = (name: string): string => {
	const personality = (personalities as Personality[]).find((p) => p.name === name);
	return personality?.description ?? name;
};

/** The first human player whose seat no token controls yet, or undefined if all are claimed. */
const unclaimedHumanSeat = (session: GameSession): Player | undefined => {
	const claimedNames = new Set(session.claims.values());
	return session.state.players.find(
		(player) => player.kind === "human" && !claimedNames.has(player.name),
	);
};

/**
 * Mints a token for the first unclaimed human seat and records the binding.
 * Returns undefined when every human seat is already claimed.
 */
export const claimSeat = (session: GameSession): SeatClaim | undefined => {
	const seat = unclaimedHumanSeat(session);
	if (seat === undefined) {
		return undefined;
	}

	const token = crypto.randomUUID();
	session.claims.set(token, seat.name);
	return { token, playerName: seat.name };
};

/** Looks up which human player name a token was minted for. */
export const playerNameForToken = (session: GameSession, token: string): string | undefined =>
	session.claims.get(token);

export const statusOf = (session: GameSession): TurnStatus => {
	if (session.state.phase === "finished") {
		return "finished";
	}
	if (unclaimedHumanSeat(session) !== undefined) {
		return "waitingForPlayers";
	}
	if (findPlayer(session.state, session.state.actingPlayer)?.kind === "human") {
		return "waitingForHuman";
	}
	if (session.busy) {
		return "aiActing";
	}
	return "waitingForAdvance";
};
