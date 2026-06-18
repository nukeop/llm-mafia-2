import type {
	CreateGameRequest,
	CreateGameResponse,
	JoinGameResponse,
	KeyStatusResponse,
	ModelsResponse,
} from "../../shared/protocol";

export type JoinResult =
	| { joined: true; token: string; playerName: string }
	| { joined: false; roomFull: true };

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

export const joinGame = async (gameId: string, token?: string): Promise<JoinResult> => {
	const response = await fetch(`/api/games/${gameId}/join`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: token !== undefined ? JSON.stringify({ token }) : undefined,
	});
	if (response.status === 409) {
		return { joined: false, roomFull: true };
	}
	const body = await response.json();
	if (!response.ok) {
		throw new Error(body.error ?? `Failed to join game (${response.status})`);
	}
	const { token: returnedToken, playerName } = body as JoinGameResponse;
	return { joined: true, token: returnedToken, playerName };
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
