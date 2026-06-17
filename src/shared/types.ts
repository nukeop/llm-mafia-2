/**
 * Core game domain types, shared between the engine, the server, and the frontend.
 */

export type Team = "machines" | "humans";

export type PlayerKind = "ai" | "human";

export type Player = {
	readonly name: string;
	readonly kind: PlayerKind;
	/** Personality name from the config roster. AI players only. */
	readonly personality?: string;
	readonly alive: boolean;
};

export type Winner = "human" | "machines";

export type GamePhase = "playing" | "debrief" | "finished";

export type Vote = {
	readonly voter: string;
	readonly target: string;
};

export type GameEvent =
	| { type: "speech"; player: string; content: string; round: number }
	| { type: "thought"; player: string; content: string; round: number }
	| { type: "vote"; voter: string; target: string; reason: string; round: number }
	| { type: "endTurn"; player: string; round: number }
	| { type: "announcement"; content: string; round: number }
	| { type: "elimination"; player: string; team: Team; round: number }
	| { type: "gameOver"; winner: Winner; round: number };

export type GameState = {
	readonly players: readonly Player[];
	/** Name of the player whose turn it currently is. */
	readonly actingPlayer: string;
	/** 1-based round counter. A round ends when all living AI players have voted. */
	readonly round: number;
	/** Votes cast in the current round. One per voter; re-voting replaces. */
	readonly votes: readonly Vote[];
	/** Append-only log. The single source of truth for both the UI and LLM prompts. */
	readonly events: readonly GameEvent[];
	readonly phase: GamePhase;
	readonly winner?: Winner;
	/** During the debrief: players who still get a final turn, current speaker first. */
	readonly debriefQueue?: readonly string[];
};

export type GameSettings = {
	/** Number of AI players, 3-8. */
	readonly aiCount: number;
	/** Number of human seats, 1 or 2. */
	readonly humanCount: number;
	/** OpenRouter model ID, e.g. "anthropic/claude-sonnet-4.5". */
	readonly modelId: string;
};

export const teamOf = (player: Player): Team => {
	if (player.kind === "ai") {
		return "machines";
	}
	return "humans";
};

export const livingPlayers = (state: GameState): Player[] =>
	state.players.filter((player) => player.alive);

export const livingAiPlayers = (state: GameState): Player[] =>
	livingPlayers(state).filter((player) => player.kind === "ai");

export const findPlayer = (state: GameState, name: string): Player | undefined =>
	state.players.find((player) => player.name === name);
