import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool, type ModelMessage, type ToolCallPart } from "ai";
import { z } from "zod";
import { applyAction, type EngineAction } from "../engine";
import type { ServerMessage } from "../shared/protocol";
import { findPlayer, type GameEvent } from "../shared/types";
import { buildHistory, buildSystemPrompt } from "./prompts";
import { personalityDescription, type GameSession } from "./store";

export type Publish = (message: ServerMessage) => void;

/** Hard cap on actions per AI turn, so a chatty model can't filibuster. */
const MAX_ACTIONS_PER_TURN = 8;

const tools = {
	think: tool({
		description:
			"Write a private note that only you can see. Use it to plan, track suspicions, and strategize.",
		inputSchema: z.object({
			thought: z.string().describe("The private thought."),
		}),
	}),
	vote: tool({
		description:
			"Vote for a player to be eliminated. Votes are secret. Re-voting replaces your previous vote. When every Machine has voted, the most-voted player is eliminated and the round ends.",
		inputSchema: z.object({
			target: z.string().describe("The exact name of the player you vote to eliminate."),
			reason: z.string().describe("Why you are voting for this player."),
		}),
	}),
	endTurn: tool({
		description: "End your turn and pass play to the next player.",
		inputSchema: z.object({}),
	}),
};

type ToolCall = Pick<ToolCallPart, "toolCallId" | "toolName"> & { input: unknown };

/**
 * Applies an engine action to the session, publishing every resulting event.
 * Returns the events on success, or the error message meant for the model.
 */
const applyAndPublish = (
	session: GameSession,
	action: EngineAction,
	publish: Publish,
): { applied: true; events: GameEvent[] } | { applied: false; errorMessage: string } => {
	const result = applyAction(session.state, action);
	if (!result.ok) {
		return { applied: false, errorMessage: result.error.message };
	}

	session.state = result.state;
	for (const event of result.events) {
		publish({ type: "event", event });
	}
	return { applied: true, events: result.events };
};

const toEngineAction = (call: ToolCall, playerName: string): EngineAction | undefined => {
	if (call.toolName === "think") {
		const input = call.input as { thought: string };
		return { type: "thought", player: playerName, content: input.thought };
	}
	if (call.toolName === "vote") {
		const input = call.input as { target: string; reason: string };
		return { type: "vote", voter: playerName, target: input.target, reason: input.reason };
	}
	if (call.toolName === "endTurn") {
		return { type: "endTurn", player: playerName };
	}
	return undefined;
};

const confirmationFor = (action: EngineAction): string => {
	switch (action.type) {
		case "thought":
			return "Noted.";
		case "vote":
			return "Vote recorded.";
		case "endTurn":
			return "Turn ended.";
		case "speech":
			return "Said out loud.";
	}
};

const toolResultMessage = (call: ToolCall, value: string): ModelMessage => ({
	role: "tool",
	content: [
		{
			type: "tool-result",
			toolCallId: call.toolCallId,
			toolName: call.toolName,
			output: { type: "text", value },
		},
	],
});

/**
 * Runs the acting AI player's whole turn: repeated single-step generations,
 * each applied to the engine and broadcast, until the model ends its turn,
 * the game ends, or the action cap is reached.
 */
export const runAiTurn = async (session: GameSession, publish: Publish): Promise<void> => {
	const playerName = session.state.actingPlayer;
	const player = findPlayer(session.state, playerName);
	if (player === undefined || player.kind !== "ai") {
		throw new Error(`runAiTurn called while ${playerName} is acting`);
	}

	const openrouter = createOpenRouter({
		apiKey: session.apiKey ?? process.env.OPENROUTER_API_KEY,
	});
	const model = openrouter.chat(session.settings.modelId);
	const system = buildSystemPrompt(
		player,
		session.state,
		personalityDescription(player.personality ?? ""),
	);
	const messages: ModelMessage[] = buildHistory(session.state, playerName);

	const turnIsOver = (): boolean =>
		session.state.phase === "finished" || session.state.actingPlayer !== playerName;

	for (let step = 0; step < MAX_ACTIONS_PER_TURN; step += 1) {
		const result = await generateText({
			model,
			system,
			messages,
			tools,
			maxOutputTokens: 1024,
		});
		messages.push(...result.response.messages);

		const spoken = result.text.trim();
		const idled = spoken.length === 0 && result.toolCalls.length === 0;
		if (idled) {
			break;
		}

		if (spoken.length > 0) {
			applyAndPublish(session, { type: "speech", player: playerName, content: spoken }, publish);
		}

		for (const call of result.toolCalls) {
			const action = toEngineAction(call, playerName);
			if (action === undefined) {
				messages.push(toolResultMessage(call, `Unknown tool: ${call.toolName}`));
				continue;
			}

			const outcome = applyAndPublish(session, action, publish);
			if (outcome.applied) {
				messages.push(toolResultMessage(call, confirmationFor(action)));
			} else {
				messages.push(toolResultMessage(call, `Error: ${outcome.errorMessage}`));
			}
		}

		if (turnIsOver()) {
			return;
		}

		// A text-only step leaves the conversation dangling on an assistant message.
		// Many models treat that as a prefill and continue mid-sentence, or re-answer
		// from scratch as if their turn just started. A user-role nudge prevents both.
		if (result.toolCalls.length === 0) {
			messages.push({
				role: "user",
				content: `[Announcer]: You still have the floor, ${playerName}. You may speak again or use tools. Use the endTurn tool when you are done.`,
			});
		}
	}

	applyAndPublish(session, { type: "endTurn", player: playerName }, publish);
};

/** One public message from the human. The turn continues until they end it. */
export const speakAsHuman = (session: GameSession, message: string, publish: Publish): void => {
	const content = message.trim();
	if (content.length === 0) {
		return;
	}
	applyAndPublish(
		session,
		{ type: "speech", player: session.state.actingPlayer, content },
		publish,
	);
};

export const endHumanTurn = (session: GameSession, publish: Publish): void => {
	applyAndPublish(session, { type: "endTurn", player: session.state.actingPlayer }, publish);
};
