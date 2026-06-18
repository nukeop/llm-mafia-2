const tokenKey = (gameId: string) => `mafia:token:${gameId}`;

export const getToken = (gameId: string): string | undefined =>
	localStorage.getItem(tokenKey(gameId)) ?? undefined;

export const setToken = (gameId: string, token: string): void => {
	localStorage.setItem(tokenKey(gameId), token);
};

export const clearToken = (gameId: string): void => {
	localStorage.removeItem(tokenKey(gameId));
};
