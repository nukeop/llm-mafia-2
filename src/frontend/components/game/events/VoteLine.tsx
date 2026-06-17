import type { GameEvent } from "../../../../shared/types";
import { playerColor } from "../../../lib/playerColor";

type VoteLineProps = {
	event: Extract<GameEvent, { type: "vote" }>;
};

export const VoteLine = ({ event }: VoteLineProps) => (
	<div className="my-3 border-y border-danger/20 bg-danger/5 py-2 text-center">
		<p className="text-sm">
			<span className="font-semibold" style={{ color: playerColor(event.voter) }}>
				{event.voter}
			</span>
			<span className="text-danger"> votes against </span>
			<span className="font-semibold" style={{ color: playerColor(event.target) }}>
				{event.target}
			</span>
		</p>
		<p className="mt-0.5 text-xs text-ink/80 italic">“{event.reason}”</p>
	</div>
);
