import { useState } from "react";
import type { ClientMessage } from "../../../shared/protocol";
import type { GameView } from "../../hooks/useGameSocket";

type ControlBarProps = {
	view: GameView;
	send: (message: ClientMessage) => void;
	onLeave: () => void;
};

export const ControlBar = ({ view, send, onLeave }: ControlBarProps) => (
	<div className="border-t border-edge bg-panel px-6 py-4">
		<Controls view={view} send={send} onLeave={onLeave} />
	</div>
);

const Controls = ({ view, send, onLeave }: ControlBarProps) => {
	switch (view.status) {
		case "waitingForAdvance":
			return (
				<button
					onClick={() => send({ type: "nextTurn" })}
					className="w-full border border-amber bg-amber/10 px-4 py-3 text-sm font-semibold tracking-[0.2em] text-amber uppercase transition-colors hover:bg-amber hover:text-bg"
				>
					Next: {view.actingPlayer}'s turn
				</button>
			);
		case "aiActing":
			return (
				<p className="cursor-blink w-full px-4 py-3 text-center text-sm text-dim">
					{view.actingPlayer} is thinking
				</p>
			);
		case "waitingForHuman":
			return <HumanTurnInput send={send} />;
		case "finished":
			return <FinishedControls view={view} onLeave={onLeave} />;
	}
};

const HumanTurnInput = ({ send }: { send: (message: ClientMessage) => void }) => {
	const [draft, setDraft] = useState("");

	const speak = () => {
		const message = draft.trim();
		if (message === "") {
			return;
		}
		send({ type: "humanSpeech", message });
		setDraft("");
	};

	const endTurn = () => {
		send({ type: "humanEndTurn" });
		setDraft("");
	};

	return (
		<div className="flex items-end gap-2">
			<textarea
				autoFocus
				rows={3}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						speak();
					}
				}}
				placeholder="Your turn. Speak as often as you like - Shift+Enter for a new line..."
				className="min-w-0 flex-1 resize-y border border-amber/60 bg-raised px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-faint focus:border-amber focus:outline-none"
			/>
			<div className="flex shrink-0 flex-col gap-2">
				<button
					onClick={speak}
					disabled={draft.trim() === ""}
					className="border border-amber bg-amber/10 px-5 py-2 text-sm font-semibold tracking-wider text-amber uppercase hover:bg-amber hover:text-bg disabled:cursor-not-allowed disabled:opacity-40"
				>
					Send
				</button>
				<button
					onClick={endTurn}
					className="border border-edge px-5 py-2 text-xs tracking-wider text-dim uppercase hover:border-dim hover:text-ink"
				>
					End turn
				</button>
			</div>
		</div>
	);
};

const FinishedControls = ({ view, onLeave }: { view: GameView; onLeave: () => void }) => {
	const humanWon = view.state.winner === "human";
	const verdict = humanWon ? "You survived." : "You were found.";
	const verdictColor = humanWon ? "text-victory" : "text-danger";

	return (
		<div className="flex items-center justify-between gap-4">
			<p className={`text-sm font-semibold ${verdictColor}`}>{verdict}</p>
			<button
				onClick={onLeave}
				className="border border-amber bg-amber/10 px-6 py-2.5 text-sm font-semibold tracking-[0.2em] text-amber uppercase hover:bg-amber hover:text-bg"
			>
				New game
			</button>
		</div>
	);
};
