import { useEffect, useState } from "react";
import type { CreateGameResponse } from "../shared/protocol";
import { joinGame, restartGame } from "./lib/api";
import { clearToken, getToken, setToken } from "./lib/identity";
import { GameScreen } from "./components/game/GameScreen";
import { Lobby } from "./components/lobby/Lobby";

const gameIdFromUrl = (): string | undefined =>
	new URLSearchParams(location.search).get("game") ?? undefined;

/**
 * Token resolution:
 *   undefined  — still resolving (async join in flight)
 *   string     — seated player with a valid token
 *   null       — spectator (room was full or no token available)
 */
type TokenState = string | null | undefined;

export const App = () => {
	const [gameId, setGameId] = useState<string | undefined>(gameIdFromUrl);
	const [token, setTokenState] = useState<TokenState>(undefined);

	// When entering via URL (?game=<id>), resolve the token asynchronously.
	useEffect(() => {
		if (gameId === undefined) {
			setTokenState(undefined);
			return;
		}

		const stored = getToken(gameId);
		if (stored !== undefined) {
			// Reconnect with an existing token.
			setTokenState(stored);
			return;
		}

		// No stored token: attempt to claim the second seat.
		let cancelled = false;
		joinGame(gameId)
			.then((result) => {
				if (result.joined) {
					// Persist before the cancellation guard so an obtained seat is never dropped.
					setToken(gameId, result.token);
				}
				if (cancelled) {
					return;
				}
				// Room full resolves to a spectator (null).
				setTokenState(result.joined ? result.token : null);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				// The server doesn't know this game (stale link or restarted server):
				// drop back to the lobby instead of hanging on "establishing uplink".
				clearToken(gameId);
				history.replaceState(null, "", location.pathname);
				setGameId(undefined);
				setTokenState(undefined);
			});

		return () => {
			cancelled = true;
		};
	}, [gameId]);

	const enterGame = (id: string, gameToken: string) => {
		history.replaceState(null, "", `?game=${id}`);
		setToken(id, gameToken);
		setGameId(id);
		setTokenState(gameToken);
	};

	const leaveGame = () => {
		if (gameId !== undefined) {
			clearToken(gameId);
		}
		history.replaceState(null, "", location.pathname);
		setGameId(undefined);
		setTokenState(undefined);
	};

	const rerollGame = async (currentId: string) => {
		const response = await restartGame(currentId);
		clearToken(currentId);
		enterGame(response.gameId, response.token);
	};

	const handleGameCreated = (response: CreateGameResponse) => {
		enterGame(response.gameId, response.token);
	};

	if (gameId === undefined) {
		return <Lobby onGameCreated={handleGameCreated} />;
	}

	if (token === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center">
				<p className="cursor-blink text-sm text-dim">establishing uplink</p>
			</main>
		);
	}

	return (
		<GameScreen
			key={gameId}
			gameId={gameId}
			token={token === null ? undefined : token}
			onLeave={leaveGame}
			onRestart={() => rerollGame(gameId)}
		/>
	);
};
