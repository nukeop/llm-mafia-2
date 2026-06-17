import type { GameEvent } from "../../../../shared/types";

type AnnouncementLineProps = {
	event: Extract<GameEvent, { type: "announcement" }>;
};

export const AnnouncementLine = ({ event }: AnnouncementLineProps) => (
	<p className="my-4 text-center text-xs tracking-[0.2em] text-amber uppercase">
		{event.content}
	</p>
);
