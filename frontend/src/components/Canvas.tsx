// The canvas. It is a pure view: it receives the architecture and the current
// simulation state as props, turns them into React Flow nodes/edges, and draws.
import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Architecture, ArchNode, SimStep } from '../types';
import { TraceEdge, type TraceEdgeType } from './TraceEdge';

// Must be defined outside the component so React Flow doesn't see a new object every render.
const edgeTypes = { trace: TraceEdge };

interface Props {
  arch: Architecture;
  steps: SimStep[]; // already filtered to nodes that still exist
  stepIndex: number;
  onNodesMoved: (nodes: ArchNode[]) => void; // user dragged a node
}

export function Canvas({ arch, steps, stepIndex, onNodesMoved }: Props) {
  const current = steps[stepIndex];

  // Nodes that appear anywhere in the trace vs. in the current step.
  const inTrace = useMemo(() => new Set(steps.flatMap((s) => [s.source, s.target])), [steps]);

  const nodes: ArchNode[] = useMemo(
    () =>
      arch.nodes.map((n) => {
        let cls = '';
        if (current && (n.id === current.source || n.id === current.target)) cls = 'node-active';
        else if (inTrace.has(n.id)) cls = 'node-in-trace';
        // Left-to-right flow: edges leave the right side and enter the left side,
        // which gives straight, readable lines for a horizontal layout.
        return { ...n, className: cls, sourcePosition: Position.Right, targetPosition: Position.Left };
      }),
    [arch.nodes, current, inTrace],
  );

  // Architecture edges: neutral grey arrows. Always drawn.
  const archEdges: Edge[] = useMemo(
    () =>
      arch.edges.map((e) => ({
        ...e,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })),
    [arch.edges],
  );

  // Trace edges: separate edges (own ids) drawn beside the architecture edges.
  const traceEdges: TraceEdgeType[] = useMemo(
    () =>
      steps.map((s, i) => {
        const state: 'past' | 'current' | 'future' = i === stepIndex ? 'current' : i < stepIndex ? 'past' : 'future';
        const failed = /fail|error|timeout/i.test(s.status);
        const color = failed ? '#dc2626' : state === 'current' ? '#f97316' : '#2563eb';
        const bits: string[] = [];
        if (s.latency_ms !== undefined) bits.push(`${s.latency_ms} ms`);
        if (s.packets !== undefined) bits.push(`${s.packets} pkts`);
        return {
          id: `trace_${i}`,
          type: 'trace',
          source: s.source,
          target: s.target,
          markerEnd: { type: MarkerType.ArrowClosed, color },
          data: { state, status: s.status, label: bits.join(' · ') || s.status, step: i + 1 },
          zIndex: state === 'current' ? 10 : 5,
          selectable: false,
        };
      }),
    [steps, stepIndex],
  );

  // `fitView` as a prop only runs on first load, so nodes added later could land
  // off-screen. Re-fit the view whenever the NUMBER of nodes changes (not on drags).
  const flow = useRef<{ fitView: (o?: { padding?: number; duration?: number }) => unknown } | null>(null);
  useEffect(() => {
    flow.current?.fitView({ padding: 0.15, duration: 300 });
  }, [arch.nodes.length]);

  const onNodesChange = (changes: NodeChange<ArchNode>[]) => {
    // Only dragging matters; add/remove happens through the chat, never the mouse.
    onNodesMoved(applyNodeChanges(changes, arch.nodes));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={[...archEdges, ...traceEdges]}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onInit={(instance) => {
        flow.current = instance;
      }}
      deleteKeyCode={null} // Backspace/Delete must not remove things: text input is the source of truth
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
