type ToastsProps = {
	errors: string[];
	dismiss: (index: number) => void;
};

export const Toasts = ({ errors, dismiss }: ToastsProps) => {
	if (errors.length === 0) {
		return null;
	}

	return (
		<div className="absolute top-4 right-4 z-20 flex w-80 flex-col gap-2">
			{errors.map((error, index) => (
				<div
					key={`${index}-${error}`}
					className="flex items-start justify-between gap-3 border border-danger/50 bg-bg/95 px-4 py-3 text-xs text-danger shadow-lg shadow-black/50"
				>
					<p className="leading-relaxed">{error}</p>
					<button onClick={() => dismiss(index)} className="shrink-0 text-dim hover:text-ink">
						✕
					</button>
				</div>
			))}
		</div>
	);
};
