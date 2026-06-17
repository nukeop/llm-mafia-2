import Markdown from "react-markdown";
import type { GameEvent } from "../../../../shared/types";
import { playerColor } from "../../../lib/playerColor";

type SpeechBubbleProps = {
	event: Extract<GameEvent, { type: "speech" }>;
	isOwn: boolean;
};

export const SpeechBubble = ({ event, isOwn }: SpeechBubbleProps) => {
	const alignment = isOwn ? "items-end" : "items-start";
	const bubbleStyles = isOwn
		? "border-amber/50 bg-amber/10"
		: "border-edge bg-panel";

	return (
		<div className={`my-2 flex flex-col ${alignment}`}>
			<span className="mb-1 px-1 text-xs font-semibold" style={{ color: playerColor(event.player) }}>
				{event.player}
			</span>
			<div className={`markdown max-w-[70%] border px-4 py-2.5 text-sm leading-relaxed ${bubbleStyles}`}>
				<Markdown>{event.content}</Markdown>
			</div>
		</div>
	);
};
