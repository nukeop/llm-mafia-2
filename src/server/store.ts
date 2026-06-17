import { createGame } from "../engine";
import type { TurnStatus } from "../shared/protocol";
import { findPlayer, type GameSettings, type GameState } from "../shared/types";
import names from "../config/names.json";
import personalities from "../config/personalities.json";

export type GameSession = {
	readonly id: string;
	state: GameState;
	readonly settings: GameSettings;
	readonly apiKey?: string;
	/** True while an AI turn is being processed; guards against double advancement. */
	busy: boolean;
};

export type Personality = {
	name: string;
	description: string;
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

export const createSession = (settings: GameSettings, apiKey?: string): GameSession => {
	const sampledNames = shuffled(names).slice(0, settings.aiCount + 1);
	const sampledPersonalities = shuffled(personalities).slice(0, settings.aiCount);
	const aiPlayers = sampledPersonalities.map((personality, index) => ({
		name: sampledNames[index]!,
		personality: personality.name,
	}));

	const session: GameSession = {
		id: crypto.randomUUID(),
		state: createGame({
			aiPlayers,
			humanName: sampledNames[settings.aiCount]!,
			humanIndex: Math.floor(Math.random() * (settings.aiCount + 1)),
		}),
		settings,
		apiKey,
		busy: false,
	};
	sessions.set(session.id, session);
	return session;
};

export const getSession = (id: string): GameSession | undefined => sessions.get(id);

export const personalityDescription = (name: string): string => {
	const personality = (personalities as Personality[]).find((p) => p.name === name);
	return personality?.description ?? name;
};

export const statusOf = (session: GameSession): TurnStatus => {
	if (session.state.phase === "finished") {
		return "finished";
	}
	if (findPlayer(session.state, session.state.actingPlayer)?.kind === "human") {
		return "waitingForHuman";
	}
	if (session.busy) {
		return "aiActing";
	}
	return "waitingForAdvance";
};
