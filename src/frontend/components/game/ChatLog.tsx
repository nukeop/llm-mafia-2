import { useEffect, useRef, useState } from "react";
import type { GameEvent, GameState } from "../../../shared/types";
import { AnnouncementLine } from "./events/AnnouncementLine";
import { EliminationCard } from "./events/EliminationCard";
import { GameOverBanner } from "./events/GameOverBanner";
import { SpeechBubble } from "./events/SpeechBubble";
import { ThoughtLine } from "./events/ThoughtLine";
import { VoteLine } from "./events/VoteLine";

type ChatLogProps = {
	state: GameState;
};

const STICK_THRESHOLD_PX = 80;

export const ChatLog = ({ state }: ChatLogProps) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [stuckToBottom, setStuckToBottom] = useState(true);

	useEffect(() => {
		const container = scrollRef.current;
		if (container !== null && stuckToBottom) {
			container.scrollTop = container.scrollHeight;
		}
	}, [state.events.length, stuckToBottom]);

	const onScroll = () => {
		const container = scrollRef.current;
		if (container === null) {
			return;
		}
		const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
		setStuckToBottom(distance < STICK_THRESHOLD_PX);
	};

	const jumpToLatest = () => {
		const container = scrollRef.current;
		if (container !== null) {
			container.scrollTop = container.scrollHeight;
		}
		setStuckToBottom(true);
	};

	return (
		<div className="relative min-h-0 flex-1">
			<div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-6 py-4">
				<RoundDivider round={1} />
				{state.events.map((event, index) => {
					const previous = state.events[index - 1];
					const showDivider = previous !== undefined && event.round > previous.round;
					return (
						<div key={index} className="event-enter">
							{showDivider && <RoundDivider round={event.round} />}
							<EventLine event={event} state={state} />
						</div>
					);
				})}
			</div>

			{!stuckToBottom && (
				<button
					onClick={jumpToLatest}
					className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-amber/60 bg-panel px-4 py-1.5 text-xs tracking-wider text-amber uppercase shadow-lg shadow-black/50 hover:bg-amber hover:text-bg"
				>
					↓ jump to latest
				</button>
			)}
		</div>
	);
};

const RoundDivider = ({ round }: { round: number }) => (
	<div className="my-6 flex items-center gap-4">
		<div className="h-px flex-1 bg-edge" />
		<span className="text-[10px] tracking-[0.4em] text-faint uppercase">round {round}</span>
		<div className="h-px flex-1 bg-edge" />
	</div>
);

const EventLine = ({ event, state }: { event: GameEvent; state: GameState }) => {
	switch (event.type) {
		case "speech": {
			const speaker = state.players.find((player) => player.name === event.player);
			return <SpeechBubble event={event} isOwn={speaker?.kind === "human"} />;
		}
		case "thought":
			return <ThoughtLine event={event} />;
		case "vote":
			return <VoteLine event={event} />;
		case "endTurn":
			return (
				<p className="my-1 text-center text-[10px] tracking-wider text-faint">
					{event.player} ends their turn
				</p>
			);
		case "announcement":
			return <AnnouncementLine event={event} />;
		case "elimination":
			return <EliminationCard event={event} />;
		case "gameOver":
			return <GameOverBanner event={event} />;
	}
};
