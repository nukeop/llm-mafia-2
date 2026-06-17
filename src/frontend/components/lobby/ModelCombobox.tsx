import { useMemo, useRef, useState } from "react";
import type { ModelInfo } from "../../../shared/protocol";

type ModelComboboxProps = {
	models: ModelInfo[];
	selectedId: string;
	onSelect: (id: string) => void;
};

const providerOf = (model: ModelInfo): string => model.id.split("/")[0] ?? "other";

const formatPrice = (perMillion: number): string => {
	if (perMillion === 0) {
		return "free";
	}
	return `$${perMillion}`;
};

const formatContext = (tokens: number): string => {
	if (tokens >= 1000) {
		return `${Math.round(tokens / 1000)}k`;
	}
	return String(tokens);
};

export const ModelCombobox = ({ models, selectedId, onSelect }: ModelComboboxProps) => {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (needle === "") {
			return models;
		}
		return models.filter(
			(model) =>
				model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle),
		);
	}, [models, query]);

	const groups = useMemo(() => {
		const byProvider = new Map<string, ModelInfo[]>();
		for (const model of filtered) {
			const provider = providerOf(model);
			byProvider.set(provider, [...(byProvider.get(provider) ?? []), model]);
		}
		return [...byProvider.entries()];
	}, [filtered]);

	const choose = (id: string) => {
		onSelect(id);
		setQuery("");
		setOpen(false);
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlighted((current) => Math.max(current - 1, 0));
			return;
		}
		if (event.key === "Enter" && open) {
			event.preventDefault();
			const model = filtered[highlighted];
			if (model !== undefined) {
				choose(model.id);
			}
			return;
		}
		if (event.key === "Escape") {
			setOpen(false);
		}
	};

	const onBlur = (event: React.FocusEvent) => {
		if (!containerRef.current?.contains(event.relatedTarget)) {
			setOpen(false);
			setQuery("");
		}
	};

	return (
		<div ref={containerRef} className="relative" onBlur={onBlur}>
			<input
				value={open ? query : selectedId}
				placeholder="Search models..."
				onFocus={() => {
					setOpen(true);
					setHighlighted(0);
				}}
				onChange={(event) => {
					setQuery(event.target.value);
					setOpen(true);
					setHighlighted(0);
				}}
				onKeyDown={onKeyDown}
				className="w-full border border-edge bg-raised px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-amber focus:outline-none"
			/>

			{open && (
				<div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto border border-edge bg-panel shadow-xl shadow-black/50">
					{groups.length === 0 && (
						<p className="px-3 py-2 text-sm text-faint">No models match.</p>
					)}
					{groups.map(([provider, providerModels]) => (
						<section key={provider}>
							<h3 className="sticky top-0 bg-raised px-3 py-1 text-[10px] tracking-[0.3em] text-dim uppercase">
								{provider}
							</h3>
							{providerModels.map((model) => {
								const index = filtered.indexOf(model);
								const isHighlighted = index === highlighted;
								const isSelected = model.id === selectedId;
								return (
									<button
										key={model.id}
										onMouseDown={(event) => event.preventDefault()}
										onMouseEnter={() => setHighlighted(index)}
										onClick={() => choose(model.id)}
										className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm ${isHighlighted ? "bg-amber/15 text-amber" : "text-ink"}`}
									>
										<span className="truncate">
											{isSelected ? "▸ " : ""}
											{model.id}
										</span>
										<span className="shrink-0 text-[10px] text-faint">
											{formatContext(model.contextLength)} ·{" "}
											{formatPrice(model.promptPricePerMillion)}/
											{formatPrice(model.completionPricePerMillion)} per 1M
										</span>
									</button>
								);
							})}
						</section>
					))}
				</div>
			)}
		</div>
	);
};
