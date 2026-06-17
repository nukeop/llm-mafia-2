/**
 * The wire protocol between the frontend and the server.
 *
 * REST:
 *   GET  /api/models      -> ModelsResponse (proxied + cached from OpenRouter, no key needed)
 *   GET  /api/key-status  -> KeyStatusResponse
 *   POST /api/games       -> CreateGameRequest -> CreateGameResponse
 *
 * WebSocket:
 *   /ws?gameId=<id>
 *   On connect the server sends a full `sync`. After that, `event` and `status`
 *   messages stream in. Everything is broadcast to all sockets subscribed to the
 *   same game ID, so spectators and future multiplayer come for free.
 */
import type { GameEvent, GameSettings, GameState } from "./types";

export type { GameSettings } from "./types";

export type CreateGameRequest = {
	settings: GameSettings;
	/** Overrides the server's env key for this game's session. */
	apiKey?: string;
};

export type CreateGameResponse = {
	gameId: string;
};

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
	| { type: "sync"; state: GameState; status: TurnStatus; settings: GameSettings }
	| { type: "event"; event: GameEvent }
	| { type: "status"; status: TurnStatus; actingPlayer: string }
	| { type: "error"; message: string };
