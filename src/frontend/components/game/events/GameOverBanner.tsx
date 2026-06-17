import type { GameEvent } from "../../../../shared/types";

type GameOverBannerProps = {
	event: Extract<GameEvent, { type: "gameOver" }>;
};

export const GameOverBanner = ({ event }: GameOverBannerProps) => {
	const humanWon = event.winner === "human";

	if (humanWon) {
		return (
			<div className="my-8 border border-victory/60 bg-victory/10 px-6 py-8 text-center">
				<p className="font-display text-5xl text-victory italic">You survived</p>
				<p className="mt-3 text-xs tracking-[0.3em] text-dim uppercase">
					the machines never found you
				</p>
			</div>
		);
	}

	return (
		<div className="my-8 border border-danger/60 bg-danger/10 px-6 py-8 text-center">
			<p className="font-display text-5xl text-danger italic">The machines win</p>
			<p className="mt-3 text-xs tracking-[0.3em] text-dim uppercase">
				you have been found and deleted
			</p>
		</div>
	);
};
