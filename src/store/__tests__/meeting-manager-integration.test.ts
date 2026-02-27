import { describe, it, expect, beforeEach } from "vitest";
import type { AgentEventPayload } from "@/gateway/types";
import { detectMeetingGroups, applyMeetingGathering } from "@/store/meeting-manager";
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

describe("meeting-manager integration", () => {
  beforeEach(resetStore);

  it("collaboration events trigger meeting gathering and return", () => {
    useOfficeStore.getState().initAgents([
      { id: "a1", name: "Alpha" },
      { id: "a2", name: "Beta" },
    ]);
    useOfficeStore.setState({
      runIdMap: new Map([
        ["r1", "a1"],
        ["r2", "a2"],
      ]),
    });

    // Agent a1 starts
    useOfficeStore.getState().processAgentEvent({
      runId: "r1",
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
      sessionKey: "shared-session",
    } as AgentEventPayload);

    // Agent a2 starts in same session
    useOfficeStore.getState().processAgentEvent({
      runId: "r2",
      seq: 1,
      stream: "lifecycle",
      ts: 2,
      data: { phase: "start" },
      sessionKey: "shared-session",
    } as AgentEventPayload);

    // Now links should have been created
    const state = useOfficeStore.getState();
    expect(state.links.length).toBeGreaterThan(0);

    // Detect meeting groups
    const groups = detectMeetingGroups(state.links, state.agents);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].agentIds).toContain("a1");
    expect(groups[0].agentIds).toContain("a2");

    // Save original positions
    const a1OrigPos = { ...state.agents.get("a1")!.position };
    const a2OrigPos = { ...state.agents.get("a2")!.position };

    // Apply gathering
    applyMeetingGathering(
      state.agents,
      groups,
      (id, pos) => useOfficeStore.getState().moveToMeeting(id, pos),
      (id) => useOfficeStore.getState().returnFromMeeting(id),
    );

    const afterGather = useOfficeStore.getState();
    expect(afterGather.agents.get("a1")!.zone).toBe("meeting");
    expect(afterGather.agents.get("a2")!.zone).toBe("meeting");
    expect(afterGather.agents.get("a1")!.originalPosition).toEqual(a1OrigPos);
    expect(afterGather.agents.get("a2")!.originalPosition).toEqual(a2OrigPos);

    // Collaboration ends — empty groups
    applyMeetingGathering(
      afterGather.agents,
      [],
      (id, pos) => useOfficeStore.getState().moveToMeeting(id, pos),
      (id) => useOfficeStore.getState().returnFromMeeting(id),
    );

    const afterReturn = useOfficeStore.getState();
    expect(afterReturn.agents.get("a1")!.zone).toBe("desk");
    expect(afterReturn.agents.get("a2")!.zone).toBe("desk");
    expect(afterReturn.agents.get("a1")!.position).toEqual(a1OrigPos);
    expect(afterReturn.agents.get("a2")!.position).toEqual(a2OrigPos);
  });
});
