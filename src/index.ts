import { serve } from "bun";
import index from "./frontend/index.html";
import { getModels } from "./server/models";
import { createSession, getSession, statusOf, type GameSession } from "./server/store";
import { endHumanTurn, runAiTurn, speakAsHuman, type Publish } from "./server/turns";
import type {
	ClientMessage,
	CreateGameRequest,
	ServerMessage,
} from "./shared/protocol";

type SocketData = {
	gameId: string;
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

				const session = createSession(body.settings, body.apiKey?.trim() || undefined);
				return Response.json({ gameId: session.id });
			},
		},

		"/api/games/:id/restart": {
			POST(req) {
				const session = getSession(req.params.id);
				if (session === undefined) {
					return Response.json({ error: "Unknown game." }, { status: 404 });
				}
				const next = createSession(session.settings, session.apiKey);
				return Response.json({ gameId: next.id });
			},
		},

		"/ws": (req, server) => {
			// Unknown game IDs still upgrade; open() closes them with a 4004 so the
			// client can tell "session is gone" apart from a dropped connection.
			const gameId = new URL(req.url).searchParams.get("gameId") ?? "";
			const upgraded = server.upgrade(req, { data: { gameId } satisfies SocketData });
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
			ws.send(
				encode({
					type: "sync",
					state: session.state,
					status: statusOf(session),
					settings: session.settings,
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
				publishTo(session)({ type: "error", message: "Unintelligible client message." });
				return;
			}
			handleClientMessage(session, message);
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

const handleClientMessage = (session: GameSession, message: ClientMessage): void => {
	const publish = publishTo(session);

	if (message.type === "nextTurn") {
		if (statusOf(session) !== "waitingForAdvance") {
			publish({ type: "error", message: "Can't advance the game right now." });
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

	if (statusOf(session) !== "waitingForHuman") {
		publish({ type: "error", message: "It's not your turn." });
		return;
	}

	if (message.type === "humanSpeech") {
		speakAsHuman(session, message.message, publish);
		return;
	}
	endHumanTurn(session, publish);
	publishSync(session, publish);
};

const validateCreateGame = (body: CreateGameRequest): string | undefined => {
	const aiCount = body?.settings?.aiCount;
	const modelId = body?.settings?.modelId;

	if (!Number.isInteger(aiCount) || aiCount < 2 || aiCount > 8) {
		return "aiCount must be an integer between 2 and 8.";
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
