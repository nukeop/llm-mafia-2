import { useState } from "react";
import { restartGame } from "./lib/api";
import { GameScreen } from "./components/game/GameScreen";
import { Lobby } from "./components/lobby/Lobby";

const gameIdFromUrl = (): string | undefined =>
	new URLSearchParams(location.search).get("game") ?? undefined;

export const App = () => {
	const [gameId, setGameId] = useState<string | undefined>(gameIdFromUrl);

	const enterGame = (id: string) => {
		history.replaceState(null, "", `?game=${id}`);
		setGameId(id);
	};

	const leaveGame = () => {
		history.replaceState(null, "", location.pathname);
		setGameId(undefined);
	};

	const rerollGame = async (currentId: string) => {
		const { gameId: nextId } = await restartGame(currentId);
		enterGame(nextId);
	};

	if (gameId === undefined) {
		return <Lobby onGameCreated={enterGame} />;
	}
	return (
		<GameScreen
			key={gameId}
			gameId={gameId}
			onLeave={leaveGame}
			onRestart={() => rerollGame(gameId)}
		/>
	);
};
