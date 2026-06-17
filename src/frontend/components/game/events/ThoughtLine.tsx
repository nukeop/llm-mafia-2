import Markdown from "react-markdown";
import type { GameEvent } from "../../../../shared/types";
import { playerColor } from "../../../lib/playerColor";

type ThoughtLineProps = {
	event: Extract<GameEvent, { type: "thought" }>;
};

/**
 * A private AI thought, fully visible to the spectating human. Dramatic irony
 * is the whole point: you get to watch them scheme against you.
 */
export const ThoughtLine = ({ event }: ThoughtLineProps) => (
	<div
		className="my-2 border-l-2 bg-thought/5 py-1.5 pr-3 pl-3"
		style={{ borderColor: playerColor(event.player) }}
	>
		<p className="text-xs">
			<span className="font-semibold" style={{ color: playerColor(event.player) }}>
				{event.player}
			</span>
			<span className="text-thought"> thinks</span>
		</p>
		<div className="markdown mt-0.5 text-sm leading-relaxed text-thought italic">
			<Markdown>{event.content}</Markdown>
		</div>
	</div>
);
