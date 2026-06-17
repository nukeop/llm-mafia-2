import { describe, expect, it } from "bun:test";
import { claimSeat, createSession, playerNameForToken, statusOf } from "./store";

const baseSettings = {
	aiCount: 3,
	modelId: "anthropic/claude-sonnet-4-5",
};

describe("createSession with humanCount: 2", () => {
	it("produces exactly two players with kind === 'human'", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 2 });
		const humans = session.state.players.filter((p) => p.kind === "human");
		expect(humans.length).toBe(2);
	});

	it("human names are distinct from each other and from all AI names", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 2 });
		const allNames = session.state.players.map((p) => p.name);
		const uniqueNames = new Set(allNames);
		expect(uniqueNames.size).toBe(allNames.length);
	});

	it("seats the two humans at distinct positions in the turn order", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 2 });
		const humanSeats = session.state.players
			.map((player, index) => ({ player, index }))
			.filter(({ player }) => player.kind === "human")
			.map(({ index }) => index);
		expect(new Set(humanSeats).size).toBe(2);
	});

	it("the host token resolves to one of the two human player names", () => {
		const { session, host } = createSession({ ...baseSettings, humanCount: 2 });
		const humans = session.state.players.filter((p) => p.kind === "human");
		const humanNames = humans.map((p) => p.name);
		const resolvedName = playerNameForToken(session, host.token);
		expect(resolvedName).toBeDefined();
		expect(humanNames).toContain(resolvedName!);
		expect(resolvedName).toBe(host.playerName);
	});

	it("claimSeat returns the other human name with a working token", () => {
		const { session, host } = createSession({ ...baseSettings, humanCount: 2 });
		const claim = claimSeat(session);
		expect(claim).toBeDefined();
		expect(claim!.playerName).not.toBe(host.playerName);
		const resolved = playerNameForToken(session, claim!.token);
		expect(resolved).toBe(claim!.playerName);
	});

	it("a third claimSeat returns undefined", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 2 });
		claimSeat(session);
		const third = claimSeat(session);
		expect(third).toBeUndefined();
	});

	it("statusOf is 'waitingForPlayers' right after createSession (only host claimed)", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 2 });
		expect(statusOf(session)).toBe("waitingForPlayers");
	});

	it("statusOf stops returning 'waitingForPlayers' once the second seat is claimed", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 2 });
		claimSeat(session);
		expect(statusOf(session)).not.toBe("waitingForPlayers");
	});
});

describe("createSession with humanCount: 1", () => {
	it("produces exactly one player with kind === 'human'", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 1 });
		const humans = session.state.players.filter((p) => p.kind === "human");
		expect(humans.length).toBe(1);
	});

	it("statusOf is never 'waitingForPlayers' (host claim already satisfies it)", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 1 });
		expect(statusOf(session)).not.toBe("waitingForPlayers");
	});

	it("a second claimSeat returns undefined; the lone seat is the host's", () => {
		const { session } = createSession({ ...baseSettings, humanCount: 1 });
		expect(claimSeat(session)).toBeUndefined();
	});
});
