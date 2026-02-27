import { describe, it, expect, beforeEach } from "vitest";
import type { SubAgentInfo } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

function resetStore() {
  useOfficeStore.setState({
    agents: new Map(),
    links: [],
    globalMetrics: {
      activeAgents: 0,
      totalAgents: 0,
      totalTokens: 0,
      tokenRate: 0,
      collaborationHeat: 0,
    },
    connectionStatus: "disconnected",
    connectionError: null,
    selectedAgentId: null,
    viewMode: "2d",
    eventHistory: [],
    sidebarCollapsed: false,
    lastSessionsSnapshot: null,
    runIdMap: new Map(),
    sessionKeyMap: new Map(),
  });
}

function mkSubInfo(id: string): SubAgentInfo {
  return {
    sessionKey: `session-${id}`,
    agentId: id,
    label: `Sub-${id}`,
    task: "research",
    requesterSessionKey: "parent-session",
    startedAt: Date.now(),
  };
}

describe("office-store Sub-Agent management", () => {
  beforeEach(() => {
    resetStore();
    useOfficeStore.getState().initAgents([{ id: "parent", name: "ParentBot" }]);
  });

  it("addSubAgent creates sub-agent with correct parent relationship", () => {
    const { addSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub1"));

    const state = useOfficeStore.getState();
    const sub = state.agents.get("sub1");
    expect(sub).toBeDefined();
    expect(sub?.isSubAgent).toBe(true);
    expect(sub?.parentAgentId).toBe("parent");
    expect(sub?.zone).toBe("hotDesk");

    const parent = state.agents.get("parent");
    expect(parent?.childAgentIds).toContain("sub1");
  });

  it("removeSubAgent cleans up parent-child relationship", () => {
    const { addSubAgent, removeSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub1"));
    removeSubAgent("sub1");

    const state = useOfficeStore.getState();
    expect(state.agents.has("sub1")).toBe(false);
    expect(state.agents.get("parent")?.childAgentIds).not.toContain("sub1");
  });

  it("removeSubAgent clears selectedAgentId if selected", () => {
    const { addSubAgent, selectAgent, removeSubAgent } = useOfficeStore.getState();
    addSubAgent("parent", mkSubInfo("sub1"));
    selectAgent("sub1");
    expect(useOfficeStore.getState().selectedAgentId).toBe("sub1");

    removeSubAgent("sub1");
    expect(useOfficeStore.getState().selectedAgentId).toBeNull();
  });

  it("moveToMeeting saves original position and updates zone", () => {
    const { moveToMeeting } = useOfficeStore.getState();
    const parent = useOfficeStore.getState().agents.get("parent")!;
    const origPos = { ...parent.position };

    moveToMeeting("parent", { x: 890, y: 190 });

    const updated = useOfficeStore.getState().agents.get("parent")!;
    expect(updated.originalPosition).toEqual(origPos);
    expect(updated.position).toEqual({ x: 890, y: 190 });
    expect(updated.zone).toBe("meeting");
  });

  it("returnFromMeeting restores original position", () => {
    const { moveToMeeting, returnFromMeeting } = useOfficeStore.getState();
    const origPos = { ...useOfficeStore.getState().agents.get("parent")!.position };

    moveToMeeting("parent", { x: 890, y: 190 });
    returnFromMeeting("parent");

    const restored = useOfficeStore.getState().agents.get("parent")!;
    expect(restored.position).toEqual(origPos);
    expect(restored.originalPosition).toBeNull();
    expect(restored.zone).toBe("desk");
  });

  it("setSessionsSnapshot stores snapshot", () => {
    const { setSessionsSnapshot } = useOfficeStore.getState();
    const snapshot = { sessions: [mkSubInfo("s1")], fetchedAt: Date.now() };
    setSessionsSnapshot(snapshot);

    expect(useOfficeStore.getState().lastSessionsSnapshot).toEqual(snapshot);
  });

  it("initAgents sets correct Phase 2 default field values", () => {
    const agent = useOfficeStore.getState().agents.get("parent")!;
    expect(agent.parentAgentId).toBeNull();
    expect(agent.childAgentIds).toEqual([]);
    expect(agent.zone).toBe("desk");
    expect(agent.originalPosition).toBeNull();
  });
});
