// Shared types for the whole app.
// Architecture data uses React Flow's own Node / Edge shapes, so it can be
// passed straight to <ReactFlow nodes=... edges=... /> with no conversion.
import type { Node, Edge } from '@xyflow/react';

/** A node on the canvas. `data.label` is what the user sees and types. */
export type ArchNode = Node<{ label: string }>;

/** A plain React Flow edge (id, source, target). */
export type ArchEdge = Edge;

export interface Architecture {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/** One hop of the trace, normalised from whatever the service returns. */
export interface SimStep {
  index: number; // 0-based position in the trace
  source: string; // node id
  target: string; // node id
  status: string; // e.g. "success" | "failed"
  latency_ms?: number;
  packets?: number;
  description: string; // human readable sentence shown in the step panel
}

export interface SimulationResult {
  simulationId: string;
  status: string;
  steps: SimStep[];
  /** Fingerprint of the architecture that was simulated (to detect staleness). */
  signature: string;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: number;
  role: 'user' | 'system';
  text: string;
  ok: boolean; // false => rendered as an error
}
