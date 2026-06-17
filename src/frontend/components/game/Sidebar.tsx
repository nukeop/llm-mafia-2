import type { GameSettings } from "../../../shared/protocol";
import type { GameState, Player } from "../../../shared/types";
import { downloadLog } from "../../lib/exportLog";
import { playerColor } from "../../lib/playerColor";

type SidebarProps = {
	state: GameState;
	settings: GameSettings;
	onRestart: () => void;
};

export const Sidebar = ({ state, settings, onRestart }: SidebarProps) => (
	<aside className="flex w-64 shrink-0 flex-col border-r border-edge bg-panel">
		<header className="border-b border-edge px-4 py-4">
			<div className="flex items-center justify-between">
				<h1 className="font-display text-2xl text-amber italic">LLM Mafia</h1>
				<div className="flex gap-1.5">
					<button
						onClick={() => downloadLog(state, settings)}
						title="Export the game log as markdown"
						className="border border-edge px-2 py-1 text-sm text-dim transition-colors hover:border-amber hover:text-amber"
					>
						⤓
					</button>
					<button
						onClick={onRestart}
						title="Restart with fresh players, same settings"
						className="border border-edge px-2 py-1 text-sm text-dim transition-colors hover:border-amber hover:text-amber"
					>
						↻
					</button>
				</div>
			</div>
			<p className="mt-2 text-[10px] tracking-[0.3em] text-dim uppercase">round {state.round}</p>
			<p className="mt-1 truncate text-[11px] text-dim" title={settings.modelId}>
				{settings.modelId}
			</p>
		</header>

		<ul className="flex-1 overflow-y-auto py-2">
			{state.players.map((player) => (
				<RosterEntry
					key={player.name}
					player={player}
					isActing={state.actingPlayer === player.name}
					hasVoted={state.votes.some((vote) => vote.voter === player.name)}
				/>
			))}
		</ul>
	</aside>
);

type RosterEntryProps = {
	player: Player;
	isActing: boolean;
	hasVoted: boolean;
};

const RosterEntry = ({ player, isActing, hasVoted }: RosterEntryProps) => {
	const deadStyles = player.alive ? "" : "opacity-40";
	const nameStyles = player.alive ? "" : "line-through";

	return (
		<li className={`px-4 py-2 ${deadStyles}`}>
			<div className="flex items-center gap-2">
				<span
					className="inline-block size-2 shrink-0 rounded-full"
					style={{ backgroundColor: playerColor(player.name) }}
				/>
				<span className={`truncate text-sm font-medium ${nameStyles}`}>{player.name}</span>
				{isActing && player.alive && <span className="text-[10px] text-amber">◂ acting</span>}
				{hasVoted && player.alive && (
					<span className="ml-auto text-[10px] tracking-wider text-victory uppercase">voted</span>
				)}
			</div>
			<p className="mt-0.5 pl-4 text-xs text-dim">
				{player.kind === "human" ? "← this is you" : (player.personality ?? "machine")}
			</p>
		</li>
	);
};
