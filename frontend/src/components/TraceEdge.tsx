// Custom React Flow edge used ONLY for simulation-trace edges.
//
// Why a custom edge? The trace usually runs along the same node pairs as the
// architecture edges, so a normal edge would be drawn exactly on top of the
// architecture edge and be impossible to tell apart. This edge shifts its path
// sideways by a fixed offset (perpendicular to the line) and uses different
// colours, so both are visible at once.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';

export type TraceEdgeData = {
  state: 'past' | 'current' | 'future'; // relative to the step the user is on
  status: string; // "success" | "failed" | ...
  label: string; // e.g. "18 ms · 64 pkts"
  step: number; // 1-based step number, shown on the label
};

export type TraceEdgeType = Edge<TraceEdgeData, 'trace'>;

const OFFSET = 18; // px the trace line is shifted away from the architecture edge

export function TraceEdge(props: EdgeProps<TraceEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
  if (!data) return null;

  // Unit normal (perpendicular) to the source->target direction.
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * OFFSET;
  const ny = (dx / len) * OFFSET;

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sourceX + nx,
    sourceY: sourceY + ny,
    targetX: targetX + nx,
    targetY: targetY + ny,
    sourcePosition,
    targetPosition,
  });

  const failed = /fail|error|timeout/i.test(data.status);
  // Colour code: failed = red, current step = orange, otherwise blue.
  const color = failed ? '#dc2626' : data.state === 'current' ? '#f97316' : '#2563eb';
  const width = data.state === 'current' ? 4 : 2;
  const opacity = data.state === 'future' ? 0.35 : 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: width,
          opacity,
          // Dashed = not reached yet, solid = reached.
          strokeDasharray: data.state === 'future' ? '6 4' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`trace-label ${data.state}${failed ? ' failed' : ''}`}
          // Pushed a further 14px along the same normal so the text sits BESIDE the line, not on it.
          style={{
            transform: `translate(-50%, -50%) translate(${labelX + (nx / OFFSET) * 14}px, ${labelY + (ny / OFFSET) * 14}px)`,
          }}
        >
          <b>{data.step}</b> {data.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
