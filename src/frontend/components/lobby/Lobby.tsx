import { useEffect, useState } from "react";
import type { ModelInfo } from "../../../shared/protocol";
import { createGame, fetchKeyStatus, fetchModels } from "../../lib/api";
import { ModelCombobox } from "./ModelCombobox";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

type LobbyProps = {
	onGameCreated: (gameId: string) => void;
};

export const Lobby = ({ onGameCreated }: LobbyProps) => {
	const [models, setModels] = useState<ModelInfo[]>([]);
	const [modelId, setModelId] = useState("");
	const [aiCount, setAiCount] = useState(5);
	const [apiKey, setApiKey] = useState("");
	const [hasEnvKey, setHasEnvKey] = useState(false);
	const [error, setError] = useState<string>();
	const [starting, setStarting] = useState(false);

	useEffect(() => {
		fetchModels()
			.then(({ models }) => {
				setModels(models);
				const preferred = models.find((model) => model.id === DEFAULT_MODEL);
				setModelId(preferred?.id ?? models[0]?.id ?? "");
			})
			.catch((cause: Error) => setError(cause.message));

		fetchKeyStatus()
			.then(({ hasEnvKey }) => setHasEnvKey(hasEnvKey))
			.catch(() => setHasEnvKey(false));
	}, []);

	const start = async () => {
		setStarting(true);
		setError(undefined);
		try {
			const { gameId } = await createGame({
				settings: { aiCount, modelId },
				apiKey: apiKey.trim() === "" ? undefined : apiKey.trim(),
			});
			onGameCreated(gameId);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setStarting(false);
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-6">
			<div className="w-full max-w-lg">
				<header className="mb-10 text-center">
					<p className="mb-2 text-xs tracking-[0.4em] text-dim uppercase">
						social deduction protocol
					</p>
					<h1 className="font-display text-7xl text-amber italic">LLM Mafia</h1>
					<p className="mt-4 text-sm leading-relaxed text-dim">
						Every player is a machine, except you. They know one of them is human.
						<br />
						Blend in. Survive.
					</p>
				</header>

				<div className="space-y-6 border border-edge bg-panel p-6">
					<section>
						<LabelRow label="machine players" value={String(aiCount)} />
						<input
							type="range"
							min={2}
							max={8}
							value={aiCount}
							onChange={(event) => setAiCount(Number(event.target.value))}
							className="w-full accent-amber"
						/>
					</section>

					<section>
						<LabelRow label="model" value="" />
						<ModelCombobox models={models} selectedId={modelId} onSelect={setModelId} />
					</section>

					<section>
						<LabelRow
							label="openrouter api key"
							value={hasEnvKey ? "loaded from env · paste to override" : "required"}
						/>
						<input
							type="password"
							value={apiKey}
							onChange={(event) => setApiKey(event.target.value)}
							placeholder="sk-or-..."
							autoComplete="off"
							className="w-full border border-edge bg-raised px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-amber focus:outline-none"
						/>
					</section>

					{error !== undefined && (
						<p className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
							{error}
						</p>
					)}

					<button
						onClick={start}
						disabled={starting || modelId === ""}
						className="w-full border border-amber bg-amber/10 px-4 py-3 text-sm font-semibold tracking-[0.2em] text-amber uppercase transition-colors hover:bg-amber hover:text-bg disabled:cursor-not-allowed disabled:opacity-40"
					>
						{starting ? "Assembling machines..." : "Enter the game"}
					</button>
				</div>
			</div>
		</main>
	);
};

const LabelRow = ({ label, value }: { label: string; value: string }) => (
	<div className="mb-2 flex items-baseline justify-between">
		<span className="text-xs tracking-[0.25em] text-dim uppercase">{label}</span>
		<span className="text-xs text-faint">{value}</span>
	</div>
);
