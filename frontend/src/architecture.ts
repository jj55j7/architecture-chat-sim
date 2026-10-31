// Applying commands to the architecture.
//
// Every function here is PURE: it takes the current architecture and returns a
// NEW one (plus a message for the chat). Nothing is mutated, which makes undo
// trivial (keep the old object) and makes the logic easy to unit test.
import type { Architecture, ArchNode } from './types';
import type { Command } from './parser';

export interface ApplyResult {
  arch: Architecture; // the (possibly unchanged) architecture
  message: string; // what to tell the user
  ok: boolean; // false => message is an error and arch is unchanged
  changed: boolean; // true if the architecture actually changed
}

/** Starting architecture: the example from the assignment (Internet -> Web Server -> Database). */
export const INITIAL_ARCHITECTURE: Architecture = {
  nodes: [
    { id: 'node_11111111-1111-1111-1111-111111111111', position: { x: 0, y: 0 }, data: { label: 'Internet' } },
    { id: 'node_22222222-2222-2222-2222-222222222222', position: { x: 250, y: 0 }, data: { label: 'Web Server' } },
    { id: 'node_33333333-3333-3333-3333-333333333333', position: { x: 500, y: 0 }, data: { label: 'Database' } },
  ],
  edges: [
    {
      id: 'edge_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      source: 'node_11111111-1111-1111-1111-111111111111',
      target: 'node_22222222-2222-2222-2222-222222222222',
    },
    {
      id: 'edge_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      source: 'node_22222222-2222-2222-2222-222222222222',
      target: 'node_33333333-3333-3333-3333-333333333333',
    },
  ],
};

/** Ids follow the assignment's example format: "node_<uuid>" / "edge_<uuid>". */
export function newId(prefix: 'node' | 'edge'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Case-insensitive, whitespace-insensitive comparison key for labels. */
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

type Found = { node: ArchNode } | { error: string };

/** Find a node by its label (case-insensitive) or by its exact id. */
export function findNode(arch: Architecture, ref: string): Found {
  const key = norm(ref);
  const byId = arch.nodes.find((n) => n.id === ref.trim());
  if (byId) return { node: byId };
  const matches = arch.nodes.filter((n) => norm(n.data.label) === key);
  if (matches.length === 1) return { node: matches[0] };
  if (matches.length > 1) return { error: `More than one node is called "${ref}". Use its id instead.` };
  const known = arch.nodes.map((n) => n.data.label).join(', ') || '(none)';
  return { error: `I can't find a node called "${ref}". Existing nodes: ${known}.` };
}

/** Pick the first free grid slot so new nodes never land on top of each other. */
function nextPosition(arch: Architecture): { x: number; y: number } {
  const COLS = 4;
  for (let i = 0; ; i++) {
    const x = (i % COLS) * 250;
    const y = Math.floor(i / COLS) * 150;
    const taken = arch.nodes.some((n) => Math.abs(n.position.x - x) < 60 && Math.abs(n.position.y - y) < 60);
    if (!taken) return { x, y };
  }
}

const fail = (arch: Architecture, message: string): ApplyResult => ({ arch, message, ok: false, changed: false });

export function applyCommand(arch: Architecture, cmd: Command): ApplyResult {
  switch (cmd.type) {
    case 'add_node': {
      if (arch.nodes.some((n) => norm(n.data.label) === norm(cmd.label))) {
        return fail(arch, `A node called "${cmd.label}" already exists. Labels must be unique so commands stay unambiguous.`);
      }
      const node: ArchNode = { id: newId('node'), position: nextPosition(arch), data: { label: cmd.label } };
      return {
        arch: { ...arch, nodes: [...arch.nodes, node] },
        message: `Added node "${cmd.label}".`,
        ok: true,
        changed: true,
      };
    }

    case 'add_edge': {
      const a = findNode(arch, cmd.from);
      if ('error' in a) return fail(arch, a.error);
      const b = findNode(arch, cmd.to);
      if ('error' in b) return fail(arch, b.error);
      if (a.node.id === b.node.id) return fail(arch, 'A node cannot be connected to itself.');
      if (arch.edges.some((e) => e.source === a.node.id && e.target === b.node.id)) {
        return fail(arch, `"${a.node.data.label}" is already connected to "${b.node.data.label}".`);
      }
      const edge = { id: newId('edge'), source: a.node.id, target: b.node.id };
      return {
        arch: { ...arch, edges: [...arch.edges, edge] },
        message: `Connected "${a.node.data.label}" → "${b.node.data.label}".`,
        ok: true,
        changed: true,
      };
    }

    case 'remove_node': {
      const found = findNode(arch, cmd.ref);
      if ('error' in found) return fail(arch, found.error);
      const id = found.node.id;
      // Removing a node must also remove every edge touching it,
      // otherwise React Flow would be left with edges pointing at nothing.
      const removedEdges = arch.edges.filter((e) => e.source === id || e.target === id).length;
      return {
        arch: {
          nodes: arch.nodes.filter((n) => n.id !== id),
          edges: arch.edges.filter((e) => e.source !== id && e.target !== id),
        },
        message:
          `Removed node "${found.node.data.label}"` +
          (removedEdges ? ` and ${removedEdges} connected edge${removedEdges === 1 ? '' : 's'}.` : '.'),
        ok: true,
        changed: true,
      };
    }

    case 'remove_edge': {
      const a = findNode(arch, cmd.from);
      if ('error' in a) return fail(arch, a.error);
      const b = findNode(arch, cmd.to);
      if ('error' in b) return fail(arch, b.error);
      // Try the direction the user typed first, then the reverse.
      let edge = arch.edges.find((e) => e.source === a.node.id && e.target === b.node.id);
      let note = '';
      if (!edge) {
        edge = arch.edges.find((e) => e.source === b.node.id && e.target === a.node.id);
        if (edge) note = ' (it pointed the other way)';
      }
      if (!edge) return fail(arch, `There is no edge between "${a.node.data.label}" and "${b.node.data.label}".`);
      const removed = edge;
      return {
        arch: { ...arch, edges: arch.edges.filter((e) => e.id !== removed.id) },
        message: `Removed edge "${a.node.data.label}" – "${b.node.data.label}"${note}.`,
        ok: true,
        changed: true,
      };
    }

    case 'rename_node': {
      const found = findNode(arch, cmd.ref);
      if ('error' in found) return fail(arch, found.error);
      if (arch.nodes.some((n) => n.id !== found.node.id && norm(n.data.label) === norm(cmd.label))) {
        return fail(arch, `A node called "${cmd.label}" already exists.`);
      }
      return {
        arch: {
          ...arch,
          nodes: arch.nodes.map((n) => (n.id === found.node.id ? { ...n, data: { ...n.data, label: cmd.label } } : n)),
        },
        message: `Renamed "${found.node.data.label}" to "${cmd.label}".`,
        ok: true,
        changed: true,
      };
    }

    // simulate / undo / reset / help are handled by the UI layer (they need
    // state or network access that does not belong in this pure module).
    default:
      return fail(arch, 'That command is handled elsewhere.');
  }
}

/**
 * Order nodes for the simulation service, which builds its trace from node
 * ORDER (first = source, last = destination). We use a topological order
 * (Kahn's algorithm) so the order follows the architecture's data flow:
 *   1. nodes that have outgoing edges but no incoming ones (entry points) first,
 *   2. then nodes as their incoming edges are satisfied,
 *   3. finally anything left: unconnected nodes and nodes caught in a cycle,
 *      in their original order (so the function never loses a node).
 */
export function orderNodes(arch: Architecture): ArchNode[] {
  const byId = new Map(arch.nodes.map((n) => [n.id, n]));
  const indegree = new Map(arch.nodes.map((n) => [n.id, 0]));
  const hasOutgoing = new Set<string>();
  for (const e of arch.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    hasOutgoing.add(e.source);
  }

  const queue = arch.nodes.filter((n) => indegree.get(n.id) === 0 && hasOutgoing.has(n.id));
  const placed = new Set<string>();
  const ordered: ArchNode[] = [];

  while (queue.length) {
    const node = queue.shift()!;
    if (placed.has(node.id)) continue;
    placed.add(node.id);
    ordered.push(node);
    for (const e of arch.edges) {
      if (e.source !== node.id || !byId.has(e.target)) continue;
      const left = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, left);
      if (left === 0) queue.push(byId.get(e.target)!);
    }
  }

  for (const n of arch.nodes) if (!placed.has(n.id)) ordered.push(n);
  return ordered;
}

/**
 * A fingerprint of the structure (node ids + edge pairs, order independent).
 * Compared with the fingerprint stored on a simulation result to tell whether
 * the architecture has changed since the simulation was run ("stale").
 */
export function signature(arch: Architecture): string {
  const n = arch.nodes.map((x) => x.id).sort();
  const e = arch.edges.map((x) => `${x.source}>${x.target}`).sort();
  return JSON.stringify([n, e]);
}
