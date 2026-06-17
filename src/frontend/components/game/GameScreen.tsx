import { useEffect } from "react";
import { useGameSocket } from "../../hooks/useGameSocket";
import { ChatLog } from "./ChatLog";
import { ControlBar } from "./ControlBar";
import { Sidebar } from "./Sidebar";
import { Toasts } from "./Toasts";

type GameScreenProps = {
	gameId: string;
	onLeave: () => void;
	onRestart: () => void;
};

export const GameScreen = ({ gameId, onLeave, onRestart }: GameScreenProps) => {
	const { view, connection, errors, send, reconnect, dismissError } = useGameSocket(gameId);

	// The server no longer knows this game (e.g. it restarted): back to the lobby.
	useEffect(() => {
		if (connection === "gone") {
			onLeave();
		}
	}, [connection, onLeave]);

	if (view === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center">
				<p className="cursor-blink text-sm text-dim">establishing uplink</p>
			</main>
		);
	}

	return (
		<main className="flex h-screen">
			<Sidebar state={view.state} settings={view.settings} onRestart={onRestart} />

			<div className="flex min-w-0 flex-1 flex-col">
				{connection === "closed" && (
					<div className="flex items-center justify-between border-b border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
						<span>Connection lost.</span>
						<button onClick={reconnect} className="underline hover:text-ink">
							Reconnect
						</button>
					</div>
				)}

				<ChatLog state={view.state} />
				<ControlBar view={view} send={send} onLeave={onLeave} />
			</div>

			<Toasts errors={errors} dismiss={dismissError} />
		</main>
	);
};
