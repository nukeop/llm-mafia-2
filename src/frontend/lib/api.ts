import type {
	CreateGameRequest,
	CreateGameResponse,
	KeyStatusResponse,
	ModelsResponse,
} from "../../shared/protocol";

export const fetchModels = async (): Promise<ModelsResponse> => {
	const response = await fetch("/api/models");
	if (!response.ok) {
		throw new Error(`Failed to load models (${response.status})`);
	}
	return response.json();
};

export const fetchKeyStatus = async (): Promise<KeyStatusResponse> => {
	const response = await fetch("/api/key-status");
	if (!response.ok) {
		throw new Error(`Failed to check key status (${response.status})`);
	}
	return response.json();
};

export const createGame = async (request: CreateGameRequest): Promise<CreateGameResponse> => {
	const response = await fetch("/api/games", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
	const body = await response.json();
	if (!response.ok) {
		throw new Error(body.error ?? `Failed to create game (${response.status})`);
	}
	return body;
};

/** Same settings and key, fresh players: a re-roll for unlucky personality draws. */
export const restartGame = async (gameId: string): Promise<CreateGameResponse> => {
	const response = await fetch(`/api/games/${gameId}/restart`, { method: "POST" });
	const body = await response.json();
	if (!response.ok) {
		throw new Error(body.error ?? `Failed to restart game (${response.status})`);
	}
	return body;
};
