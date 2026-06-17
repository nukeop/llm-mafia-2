import { serve } from "bun";
import index from "./frontend/index.html";
import { getModels } from "./server/models";
import {
	claimSeat,
	createSession,
	getSession,
	playerNameForToken,
	statusOf,
	type GameSession,
} from "./server/store";
import { endHumanTurn, runAiTurn, speakAsHuman, type Publish } from "./server/turns";
import type {
	ClientMessage,
	CreateGameRequest,
	CreateGameResponse,
	JoinGameResponse,
	ServerMessage,
} from "./shared/protocol";

type SocketData = {
	gameId: string;
	token?: string;
};

const topicOf = (gameId: string): string => `game:${gameId}`;

const hasEnvKey = (): boolean => Boolean(process.env.OPENROUTER_API_KEY);

const server = serve({
	port: Number(process.env.PORT) || 3000,
	hostname: "0.0.0.0",

	routes: {
		"/*": index,

		"/api/models": {
			async GET() {
				const models = await getModels();
				return Response.json({ models });
			},
		},

		"/api/key-status": {
			GET() {
				return Response.json({ hasEnvKey: hasEnvKey() });
			},
		},

		"/api/games": {
			async POST(req) {
				const body = (await req.json()) as CreateGameRequest;
				const error = validateCreateGame(body);
				if (error !== undefined) {
					return Response.json({ error }, { status: 400 });
				}

				const { session, host } = createSession(
					body.settings,
					body.apiKey?.trim() || undefined,
				);
				return Response.json({
					gameId: session.id,
					token: host.token,
					playerName: host.playerName,
				} satisfies CreateGameResponse);
			},
		},

		"/api/games/:id/restart": {
			POST(req) {
				const session = getSession(req.params.id);
				if (session === undefined) {
					return Response.json({ error: "Unknown game." }, { status: 404 });
				}
				const { session: next, host } = createSession(session.settings, session.apiKey);
				return Response.json({
					gameId: next.id,
					token: host.token,
					playerName: host.playerName,
				} satisfies CreateGameResponse);
			},
		},

		"/api/games/:id/join": {
			async POST(req) {
				const session = getSession(req.params.id);
				if (session === undefined) {
					return Response.json({ error: "Unknown game." }, { status: 404 });
				}

				const token = await parseJoinToken(req);

				if (token !== undefined) {
					const existing = playerNameForToken(session, token);
					if (existing !== undefined) {
						return Response.json({
							token,
							playerName: existing,
						} satisfies JoinGameResponse);
					}
				}

				const claim = claimSeat(session);
				if (claim === undefined) {
					return Response.json({ error: "This room is full." }, { status: 409 });
				}

			publishStatus(session, publishTo(session));

				return Response.json({
					token: claim.token,
					playerName: claim.playerName,
				} satisfies JoinGameResponse);
			},
		},

		"/ws": (req, server) => {
			// Unknown game IDs still upgrade; open() closes them with a 4004 so the
			// client can tell "session is gone" apart from a dropped connection.
			const params = new URL(req.url).searchParams;
			const gameId = params.get("gameId") ?? "";
			const token = params.get("token") ?? undefined;
			const upgraded = server.upgrade(req, { data: { gameId, token } satisfies SocketData });
			if (upgraded) {
				return undefined;
			}
			return new Response("WebSocket upgrade failed", { status: 400 });
		},
	},

	websocket: {
		data: {} as SocketData,

		open(ws) {
			const session = getSession(ws.data.gameId);
			if (session === undefined) {
				ws.close(4004, "Unknown game");
				return;
			}

			ws.subscribe(topicOf(session.id));

			const me =
				ws.data.token !== undefined
					? playerNameForToken(session, ws.data.token)
					: undefined;

			ws.send(
				encode({
					type: "sync",
					state: session.state,
					status: statusOf(session),
					settings: session.settings,
					youAre: me,
				}),
			);
		},

		message(ws, raw) {
			const session = getSession(ws.data.gameId);
			if (session === undefined) {
				return;
			}

			const message = decode(raw);
			if (message === undefined) {
				reply(ws, { type: "error", message: "Unintelligible client message." });
				return;
			}

			const me =
				ws.data.token !== undefined
					? playerNameForToken(session, ws.data.token)
					: undefined;

			handleClientMessage(session, message, me, (msg) => reply(ws, msg));
		},

		close(ws) {
			ws.unsubscribe(topicOf(ws.data.gameId));
		},
	},

	development: process.env.NODE_ENV !== "production" && {
		hmr: true,
		console: true,
	},
});

const encode = (message: ServerMessage): string => JSON.stringify(message);

const decode = (raw: string | Buffer): ClientMessage | undefined => {
	try {
		return JSON.parse(String(raw)) as ClientMessage;
	} catch {
		return undefined;
	}
};

/** Send a message to just this socket. */
const reply = (ws: { send: (data: string) => void }, message: ServerMessage): void => {
	ws.send(encode(message));
};

const publishTo = (session: GameSession): Publish => {
	return (message) => {
		server.publish(topicOf(session.id), encode(message));
	};
};

const publishStatus = (session: GameSession, publish: Publish): void => {
	publish({
		type: "status",
		status: statusOf(session),
		actingPlayer: session.state.actingPlayer,
	});
};

/** A full resync at turn boundaries keeps clients honest even if event folding drifts. */
const publishSync = (session: GameSession, publish: Publish): void => {
	publish({
		type: "sync",
		state: session.state,
		status: statusOf(session),
		settings: session.settings,
	});
};

/**
 * Returns `me` when it matches the acting player and the game is waiting for a
 * human move; otherwise replies to the sender with the appropriate error and
 * returns undefined.
 */
const requireActingHuman = (
	session: GameSession,
	me: string | undefined,
	replyToSender: Publish,
): string | undefined => {
	if (statusOf(session) !== "waitingForHuman") {
		replyToSender({ type: "error", message: "It's not your turn." });
		return undefined;
	}
	if (me !== session.state.actingPlayer) {
		replyToSender({ type: "error", message: "It's not your turn." });
		return undefined;
	}
	return me;
};

const handleClientMessage = (
	session: GameSession,
	message: ClientMessage,
	me: string | undefined,
	replyToSender: Publish,
): void => {
	if (me === undefined) {
		replyToSender({ type: "error", message: "Spectators can't act." });
		return;
	}

	const publish = publishTo(session);
	const status = statusOf(session);

	switch (message.type) {
		case "nextTurn": {
			if (status === "waitingForPlayers") {
				replyToSender({ type: "error", message: "Waiting for another player to join." });
				return;
			}
			if (status !== "waitingForAdvance") {
				replyToSender({ type: "error", message: "Can't advance the game right now." });
				return;
			}

			session.busy = true;
			publishStatus(session, publish);

			runAiTurn(session, publish)
				.catch((error: unknown) => {
					publish({
						type: "error",
						message: `AI turn failed: ${error instanceof Error ? error.message : String(error)}`,
					});
				})
				.finally(() => {
					session.busy = false;
					publishSync(session, publish);
				});
			return;
		}

		case "humanSpeech": {
			const actor = requireActingHuman(session, me, replyToSender);
			if (actor === undefined) {
				return;
			}
			speakAsHuman(session, actor, message.message, publish);
			return;
		}

		case "humanEndTurn": {
			const actor = requireActingHuman(session, me, replyToSender);
			if (actor === undefined) {
				return;
			}
			endHumanTurn(session, actor, publish);
			publishSync(session, publish);
			return;
		}

		default: {
			replyToSender({ type: "error", message: "Unknown message." });
		}
	}
};

/**
 * Reads the optional `token` field from a join request body.
 * Returns undefined if the body is absent, malformed, or has no token.
 */
const parseJoinToken = async (req: Request): Promise<string | undefined> => {
	const text = await req.text();
	if (text.trim().length === 0) {
		return undefined;
	}
	try {
		const body = JSON.parse(text) as { token?: unknown };
		return typeof body.token === "string" && body.token.length > 0 ? body.token : undefined;
	} catch {
		return undefined;
	}
};

const validateCreateGame = (body: CreateGameRequest): string | undefined => {
	const aiCount = body?.settings?.aiCount;
	const humanCount = body?.settings?.humanCount;
	const modelId = body?.settings?.modelId;

	if (!Number.isInteger(aiCount) || aiCount < 3 || aiCount > 8) {
		return "aiCount must be an integer between 3 and 8.";
	}
	if (!Number.isInteger(humanCount) || (humanCount !== 1 && humanCount !== 2)) {
		return "humanCount must be 1 or 2.";
	}
	if (typeof modelId !== "string" || modelId.length === 0) {
		return "modelId is required.";
	}
	if (!body.apiKey?.trim() && !hasEnvKey()) {
		return "No OpenRouter API key: paste one or set OPENROUTER_API_KEY on the server.";
	}
	return undefined;
};

console.log(`LLM Mafia running at ${server.url}`);
