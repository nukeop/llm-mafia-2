import type { ModelInfo } from "../shared/protocol";

const CACHE_TTL_MS = 60 * 60 * 1000;

type OpenRouterModel = {
	id: string;
	name: string;
	context_length: number | null;
	pricing?: {
		prompt?: string;
		completion?: string;
	};
};

let cache: { models: ModelInfo[]; fetchedAt: number } | undefined;

export const getModels = async (): Promise<ModelInfo[]> => {
	if (cache !== undefined && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
		return cache.models;
	}

	const response = await fetch("https://openrouter.ai/api/v1/models");
	if (!response.ok) {
		throw new Error(`OpenRouter model list request failed: ${response.status}`);
	}

	const body = (await response.json()) as { data: OpenRouterModel[] };
	const models = body.data
		.map(toModelInfo)
		.toSorted((a, b) => a.id.localeCompare(b.id));

	cache = { models, fetchedAt: Date.now() };
	return models;
};

const toModelInfo = (model: OpenRouterModel): ModelInfo => ({
	id: model.id,
	name: model.name,
	contextLength: model.context_length ?? 0,
	promptPricePerMillion: pricePerMillion(model.pricing?.prompt),
	completionPricePerMillion: pricePerMillion(model.pricing?.completion),
});

const pricePerMillion = (perToken: string | undefined): number => {
	const parsed = Number.parseFloat(perToken ?? "0");
	if (Number.isNaN(parsed)) {
		return 0;
	}
	return Math.round(parsed * 1_000_000 * 100) / 100;
};
