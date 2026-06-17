import type { ModelMessage } from "ai";
import { livingPlayers, type GameEvent, type GameState, type Player } from "../shared/types";

/**
 * Renders the event log as a chat transcript from one player's perspective:
 * public events become announcer/player lines, the player's own actions become
 * assistant messages, and everyone else's private actions are omitted.
 */
export const buildHistory = (state: GameState, playerName: string): ModelMessage[] => {
  const lines = state.events
    .map((event) => renderEvent(event, playerName))
    .filter((line) => line !== undefined);

  return lines.reduce<ModelMessage[]>((messages, line) => {
    const previous = messages.at(-1);
    const shouldMerge =
      line.role === "user" && previous?.role === "user" && typeof previous.content === "string";

    if (shouldMerge) {
      return [
        ...messages.slice(0, -1),
        { role: "user", content: `${previous.content}\n${line.content}` },
      ];
    }
    return [...messages, line];
  }, []);
};

type HistoryLine = { role: "user" | "assistant"; content: string };

const renderEvent = (event: GameEvent, playerName: string): HistoryLine | undefined => {
  switch (event.type) {
    case "speech":
      if (event.player === playerName) {
        return { role: "assistant", content: event.content };
      }
      return { role: "user", content: `[${event.player}]: ${event.content}` };
    case "thought":
      if (event.player === playerName) {
        return { role: "assistant", content: `(thought: ${event.content})` };
      }
      return undefined;
    case "vote":
      if (event.voter === playerName) {
        return { role: "assistant", content: `(voted for ${event.target}: ${event.reason})` };
      }
      return undefined;
    case "announcement":
      return { role: "user", content: `[Announcer]: ${event.content}` };
    case "elimination":
      return {
        role: "user",
        content: `[Announcer]: ${event.player} has been eliminated! That player was on team: ${event.team}!`,
      };
    case "endTurn":
    case "gameOver":
      return undefined;
  }
};

export const buildSystemPrompt = (
  player: Player,
  state: GameState,
  personalityDescription: string,
): string => {
	return `You are an AI language model playing a social deduction game. Your assigned name is ${player.name}.

There are two teams: Machines and Humans. Every player except one is an AI like you - a Machine. Exactly one player is a Human. The Machines win when the Human is voted out. The Human wins by surviving until only two Machines remain.

The game is played in rounds. Players act in turns. Only Machines vote. When every living Machine has voted, the player with the most votes is eliminated (a tie eliminates no one), the eliminated player's team is revealed, and a new round begins.

How to act on your turn:
- Anything you write as plain text is public speech, visible to all players.
- Use the think tool for private notes: suspicions, plans, strategy. No one else ever sees them. In the transcript your past thoughts appear as "(thought: ...)". Never write a thought as plain text - plain text is always public.
- Use the vote tool to vote for the player you want eliminated. Votes are secret. You may change your vote until the round ends, and you may keep talking after voting.
- Use the endTurn tool to pass the turn to the next player. Always end your turn when you have nothing more to add.

Keep your speech SHORT. This is fast table talk between players, not a stage for monologues - rambling bores the table. Say your piece, or pieces. End your turn when you're done.

The transcript shows the game from your perspective: "[Announcer]" lines are game announcements, "[Name]" lines are the other players speaking, and your own past words and actions appear as your own messages.

${missionParagraph(player, state)}

Your personality: ${personalityDescription}

Assume this role completely and make its traits your defining characteristics. All your actions, thoughts, and speech should follow your personality. Your behavior should be an extreme, stereotyped caricature. Never break character.

${rosterLine(state)} It is round ${state.round}, and it is your turn, ${player.name}.`;
};

const rosterLine = (state: GameState): string => {
	if (state.phase === "debrief") {
		const everyone = state.players
			.map((p) => (p.alive ? p.name : `${p.name} (eliminated)`))
			.join(", ");
		return `Players: ${everyone}.`;
	}
	const living = livingPlayers(state)
		.map((p) => p.name)
		.join(", ");
	return `Living players: ${living}.`;
};

const missionParagraph = (player: Player, state: GameState): string => {
  if (state.phase !== "debrief") {
    return "You are a Machine. Find the Human, and make sure the others don't mistake you for the Human. You are allowed to lie, deceive, accuse, form alliances, and strategize. Remember: the Human will be trying to blend in and act like a Machine. Watch for inconsistencies. Don't let the game drag on - when you have a reasonable suspicion, vote.";
  }

	const human = state.players.find((p) => p.kind === "human");
	const outcome =
		state.winner === "machines"
			? `The Machines won: the Human, ${human?.name}, was found and eliminated`
			: `The Human, ${human?.name}, survived and won`;
	const obituary = player.alive
		? ""
		: " You were eliminated during the game - this is your chance for last words.";

	return `The game is over. ${outcome}. This is the debriefing - the masks are off and there is no more voting. Everyone gets one final turn, including the eliminated.${obituary} Share your honest post-game reflections: what you suspected, what fooled you, how you feel about the outcome. Then bid the others farewell and end your turn. Stay in character.`;
};
