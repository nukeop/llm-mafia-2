import { useCallback, useEffect, useRef, useState } from "react";
import type {
	ClientMessage,
	GameSettings,
	ServerMessage,
	TurnStatus,
} from "../../shared/protocol";
import type { GameEvent, GameState } from "../../shared/types";

export type GameView = {
	state: GameState;
	status: TurnStatus;
	actingPlayer: string;
	settings: GameSettings;
};

/** "gone" means the server told us this game no longer exists (close code 4004). */
export type ConnectionState = "connecting" | "open" | "closed" | "gone";

const GAME_GONE_CLOSE_CODE = 4004;

/**
 * Folds a live event into the client's copy of the game state. A full `sync`
 * arrives at every turn boundary, so this only needs to be right enough for
 * the duration of a single turn.
 */
const foldEvent = (view: GameView, event: GameEvent): GameView => {
	const enteredNewRound = event.round > view.state.round;
	const base: GameState = enteredNewRound
		? { ...view.state, round: event.round, votes: [] }
		: view.state;
	const state = applyEvent(base, event);

	return { ...view, state: { ...state, events: [...state.events, event] } };
};

const applyEvent = (state: GameState, event: GameEvent): GameState => {
	switch (event.type) {
		case "vote": {
			const others = state.votes.filter((vote) => vote.voter !== event.voter);
			return { ...state, votes: [...others, { voter: event.voter, target: event.target }] };
		}
		case "elimination":
			return {
				...state,
				votes: [],
				players: state.players.map((player) => {
					if (player.name === event.player) {
						return { ...player, alive: false };
					}
					return player;
				}),
			};
		case "gameOver":
			return { ...state, phase: "debrief", winner: event.winner };
		default:
			return state;
	}
};

const foldMessage = (view: GameView | undefined, message: ServerMessage): GameView | undefined => {
	switch (message.type) {
		case "sync":
			return {
				state: message.state,
				status: message.status,
				actingPlayer: message.state.actingPlayer,
				settings: message.settings,
			};
		case "event":
			if (view === undefined) {
				return view;
			}
			return foldEvent(view, message.event);
		case "status":
			if (view === undefined) {
				return view;
			}
			return { ...view, status: message.status, actingPlayer: message.actingPlayer };
		case "error":
			return view;
	}
};

export const useGameSocket = (gameId: string) => {
	const [view, setView] = useState<GameView>();
	const [connection, setConnection] = useState<ConnectionState>("connecting");
	const [errors, setErrors] = useState<string[]>([]);
	const [attempt, setAttempt] = useState(0);
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const protocol = location.protocol === "https:" ? "wss" : "ws";
		const socket = new WebSocket(`${protocol}://${location.host}/ws?gameId=${gameId}`);
		socketRef.current = socket;
		setConnection("connecting");

		socket.onopen = () => setConnection("open");
		socket.onclose = (event: CloseEvent) => {
			if (event.code === GAME_GONE_CLOSE_CODE) {
				setConnection("gone");
				return;
			}
			setConnection("closed");
		};
		socket.onmessage = (raw: MessageEvent<string>) => {
			const message = JSON.parse(raw.data) as ServerMessage;
			if (message.type === "error") {
				setErrors((current) => [...current, message.message]);
				return;
			}
			setView((current) => foldMessage(current, message));
		};

		return () => {
			socket.onclose = null;
			socket.close();
		};
	}, [gameId, attempt]);

	const send = useCallback((message: ClientMessage) => {
		socketRef.current?.send(JSON.stringify(message));
	}, []);

	const reconnect = useCallback(() => setAttempt((current) => current + 1), []);

	const dismissError = useCallback((index: number) => {
		setErrors((current) => current.filter((_, i) => i !== index));
	}, []);

	return { view, connection, errors, send, reconnect, dismissError };
};
