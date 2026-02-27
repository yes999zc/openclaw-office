import { useEffect, useRef } from "react";
import { GatewayRpcClient } from "@/gateway/rpc-client";
import { initAdapter } from "@/gateway/adapter-provider";
import type {
  AgentEventPayload,
  AgentSummary,
  GatewayEventFrame,
  HealthSnapshot,
} from "@/gateway/types";
import { GatewayWsClient } from "@/gateway/ws-client";
import { EventThrottle } from "@/lib/event-throttle";
import { useOfficeStore } from "@/store/office-store";
import { useSubAgentPoller } from "./useSubAgentPoller";
import { useUsagePoller } from "./useUsagePoller";

interface UseGatewayConnectionOptions {
  url: string;
  token: string;
}

export function useGatewayConnection({ url, token }: UseGatewayConnectionOptions) {
  const wsRef = useRef<GatewayWsClient | null>(null);
  const rpcRef = useRef<GatewayRpcClient | null>(null);
  const throttleRef = useRef<EventThrottle | null>(null);

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const processAgentEvent = useOfficeStore((s) => s.processAgentEvent);
  const setOperatorScopes = useOfficeStore((s) => s.setOperatorScopes);

  useEffect(() => {
    if (!url) {
      return;
    }

    const ws = new GatewayWsClient();
    const rpc = new GatewayRpcClient(ws);
    const throttle = new EventThrottle();

    wsRef.current = ws;
    rpcRef.current = rpc;
    throttleRef.current = throttle;

    throttle.onBatch((events) => {
      for (const event of events) {
        processAgentEvent(event);
      }
    });

    throttle.onImmediate((event) => {
      processAgentEvent(event);
    });

    ws.onStatusChange((status, error) => {
      setConnectionStatus(status, error);

      if (status === "connected") {
        initAgentsFromSnapshot(ws, initAgents);
        const snapshot = ws.getSnapshot();
        const scopes = (snapshot as Record<string, unknown>)?.scopes;
        setOperatorScopes(Array.isArray(scopes) ? (scopes as string[]) : ["operator"]);

        void initAdapter("ws", { wsClient: ws, rpcClient: rpc });
      }
    });

    ws.onEvent("agent", (frame: GatewayEventFrame) => {
      throttle.push(frame.payload as AgentEventPayload);
    });

    ws.onEvent("health", (frame: GatewayEventFrame) => {
      const health = frame.payload as HealthSnapshot;
      if (health?.agents) {
        const summaries = healthAgentsToSummaries(health);
        initAgents(summaries);
      }
    });

    ws.connect(url, token);

    return () => {
      throttle.destroy();
      ws.disconnect();
      wsRef.current = null;
      rpcRef.current = null;
      throttleRef.current = null;
    };
  }, [url, token, setConnectionStatus, initAgents, processAgentEvent, setOperatorScopes]);

  useSubAgentPoller(rpcRef);
  useUsagePoller(rpcRef);

  return { wsClient: wsRef, rpcClient: rpcRef };
}

function healthAgentsToSummaries(health: HealthSnapshot): AgentSummary[] {
  if (!health.agents) {
    return [];
  }
  return health.agents.map((a) => ({
    id: a.agentId,
    name: a.agentId,
  }));
}

function initAgentsFromSnapshot(
  ws: GatewayWsClient,
  initAgents: (agents: AgentSummary[]) => void,
): void {
  const snapshot = ws.getSnapshot();
  const health = snapshot?.health as HealthSnapshot | undefined;
  if (health?.agents) {
    initAgents(healthAgentsToSummaries(health));
  }
}
