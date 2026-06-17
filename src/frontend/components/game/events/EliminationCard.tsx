import type { GameEvent } from "../../../../shared/types";
import { playerColor } from "../../../lib/playerColor";

type EliminationCardProps = {
	event: Extract<GameEvent, { type: "elimination" }>;
};

export const EliminationCard = ({ event }: EliminationCardProps) => {
	const wasHuman = event.team === "humans";

	return (
		<div className="my-6 border border-danger/50 bg-danger/5 px-6 py-5 text-center">
			<p className="font-display text-3xl text-danger italic">
				<span style={{ color: playerColor(event.player) }}>{event.player}</span> has been
				eliminated
			</p>
			<p className="mt-2 text-xs tracking-[0.3em] text-dim uppercase">
				{wasHuman ? "they were the HUMAN" : "they were a machine"}
			</p>
		</div>
	);
};
