/**
 * The wire protocol between the frontend and the server.
 *
 * REST:
 *   GET  /api/models         -> ModelsResponse (proxied + cached from OpenRouter, no key needed)
 *   GET  /api/key-status     -> KeyStatusResponse
 *   POST /api/games          -> CreateGameRequest -> CreateGameResponse
 *   POST /api/games/:id/join -> JoinGameResponse (no request body; claims the second human seat)
 *
 * WebSocket:
 *   /ws?gameId=<id>&token=<token>
 *   On connect the server sends a full `sync` with `youAre` set to the player name
 *   this socket controls. After that, `event` and `status` messages stream in.
 *   Broadcasts omit `youAre`. All sockets subscribed to the same game ID receive
 *   the same `event` and `status` messages, so spectators come for free.
 */
import type { GameEvent, GameSettings, GameState } from "./types";

export type { GameSettings } from "./types";

export type CreateGameRequest = {
	settings: GameSettings;
	/** Overrides the server's env key for this game's session. */
	apiKey?: string;
};

/** A seat binding: an identity token and the player name it controls. */
export type SeatClaim = {
	/** Identity token; present this on /ws as ?token=. */
	token: string;
	/** The player name this token controls. */
	playerName: string;
};

/** Creating a game is a join (the host's seat claim) plus the new game's id. */
export type CreateGameResponse = SeatClaim & {
	gameId: string;
};

export type JoinGameResponse = SeatClaim;

export type KeyStatusResponse = {
	hasEnvKey: boolean;
};

export type ModelInfo = {
	id: string;
	name: string;
	contextLength: number;
	/** USD per million prompt tokens. */
	promptPricePerMillion: number;
	/** USD per million completion tokens. */
	completionPricePerMillion: number;
};

export type ModelsResponse = {
	models: ModelInfo[];
};

export type TurnStatus =
	/** Not all human seats have been claimed yet; game has not started. */
	| "waitingForPlayers"
	/** An AI player is up next; waiting for the user to click "next turn". */
	| "waitingForAdvance"
	/** An AI player's turn is being processed; actions are streaming in. */
	| "aiActing"
	/** It's the human's turn; waiting for a message or a pass. */
	| "waitingForHuman"
	| "finished";

export type ClientMessage =
	/** Run the next AI player's full turn. */
	| { type: "nextTurn" }
	/** Speak as the human. Does not end the turn; speak as often as you like. */
	| { type: "humanSpeech"; message: string }
	/** End the human's turn. */
	| { type: "humanEndTurn" };

export type ServerMessage =
	| {
		type: "sync";
		state: GameState;
		status: TurnStatus;
		settings: GameSettings;
		/** The player name this socket controls. Only set on per-socket syncs; omitted on broadcasts. */
		youAre?: string;
	}
	| { type: "event"; event: GameEvent }
	| { type: "status"; status: TurnStatus; actingPlayer: string }
	| { type: "error"; message: string };
