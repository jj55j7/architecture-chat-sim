// Unit tests for the two pure modules: the parser and the architecture logic.
// Run with:  npm test
import { describe, expect, it } from 'vitest';
import { parseCommand } from './parser';
import { INITIAL_ARCHITECTURE, applyCommand, findNode, signature } from './architecture';
import type { Architecture } from './types';

/** Parse + apply in one go, failing the test if the text isn't understood. */
function run(arch: Architecture, text: string) {
  const p = parseCommand(text);
  if (!p.ok) throw new Error(p.error);
  return applyCommand(arch, p.command);
}

describe('parseCommand', () => {
  it.each([
    ['add node Cache', { type: 'add_node', label: 'Cache' }],
    ['Add a node called Load Balancer', { type: 'add_node', label: 'Load Balancer' }],
    ['create component "Message Queue".', { type: 'add_node', label: 'Message Queue' }],
    ['add Cache', { type: 'add_node', label: 'Cache' }],
    ['add Web Server 2', { type: 'add_node', label: 'Web Server 2' }],
    ['connect Web Server to Database', { type: 'add_edge', from: 'Web Server', to: 'Database' }],
    ['add edge from Internet to Web Server', { type: 'add_edge', from: 'Internet', to: 'Web Server' }],
    ['link A with B', { type: 'add_edge', from: 'A', to: 'B' }],
    ['Cache -> Database', { type: 'add_edge', from: 'Cache', to: 'Database' }],
    ['remove node Cache', { type: 'remove_node', ref: 'Cache' }],
    ['delete Cache', { type: 'remove_node', ref: 'Cache' }],
    ['remove edge Web Server to Database', { type: 'remove_edge', from: 'Web Server', to: 'Database' }],
    ['delete connection between A and B', { type: 'remove_edge', from: 'A', to: 'B' }],
    ['disconnect A from B', { type: 'remove_edge', from: 'A', to: 'B' }],
    ['rename Database to Postgres', { type: 'rename_node', ref: 'Database', label: 'Postgres' }],
    ['run simulation', { type: 'simulate' }],
    ['undo', { type: 'undo' }],
    ['help', { type: 'help' }],
  ])('%s', (text, expected) => {
    expect(parseCommand(text)).toEqual({ ok: true, command: expected });
  });

  it('rejects gibberish and empty input', () => {
    expect(parseCommand('banana').ok).toBe(false);
    expect(parseCommand('   ').ok).toBe(false);
  });
});

describe('applyCommand', () => {
  it('adds a node at a free position with an id in the node_<uuid> format', () => {
    const r = run(INITIAL_ARCHITECTURE, 'add node Cache');
    expect(r.ok).toBe(true);
    expect(r.arch.nodes).toHaveLength(4);
    const added = r.arch.nodes[3];
    expect(added.id).toMatch(/^node_[0-9a-f-]{36}$/);
    expect(added.data.label).toBe('Cache');
    // must not overlap the three existing nodes (at y=0, x=0/250/500)
    expect(INITIAL_ARCHITECTURE.nodes.some((n) => n.position.x === added.position.x && n.position.y === added.position.y)).toBe(false);
  });

  it('does not mutate the input architecture', () => {
    const before = JSON.stringify(INITIAL_ARCHITECTURE);
    run(INITIAL_ARCHITECTURE, 'add node Cache');
    run(INITIAL_ARCHITECTURE, 'remove node Database');
    expect(JSON.stringify(INITIAL_ARCHITECTURE)).toBe(before);
  });

  it('rejects duplicate labels (case-insensitive)', () => {
    const r = run(INITIAL_ARCHITECTURE, 'add node database');
    expect(r.ok).toBe(false);
    expect(r.arch).toBe(INITIAL_ARCHITECTURE);
  });

  it('adds an edge between existing nodes (labels are case-insensitive)', () => {
    const r = run(INITIAL_ARCHITECTURE, 'connect internet to database');
    expect(r.ok).toBe(true);
    expect(r.arch.edges).toHaveLength(3);
    expect(r.arch.edges[2].id).toMatch(/^edge_/);
  });

  it('rejects unknown nodes, self-loops and duplicate edges', () => {
    expect(run(INITIAL_ARCHITECTURE, 'connect Internet to Ghost').ok).toBe(false);
    expect(run(INITIAL_ARCHITECTURE, 'connect Internet to Internet').ok).toBe(false);
    expect(run(INITIAL_ARCHITECTURE, 'connect Internet to Web Server').ok).toBe(false);
  });

  it('removing a node also removes its edges', () => {
    const r = run(INITIAL_ARCHITECTURE, 'remove node Web Server');
    expect(r.ok).toBe(true);
    expect(r.arch.nodes).toHaveLength(2);
    expect(r.arch.edges).toHaveLength(0); // both edges touched Web Server
  });

  it('removes an edge, also when typed in the reverse direction', () => {
    const fwd = run(INITIAL_ARCHITECTURE, 'remove edge Internet to Web Server');
    expect(fwd.arch.edges).toHaveLength(1);
    const rev = run(INITIAL_ARCHITECTURE, 'remove edge Web Server to Internet');
    expect(rev.ok).toBe(true);
    expect(rev.arch.edges).toHaveLength(1);
  });

  it('reports a missing edge and a missing node', () => {
    expect(run(INITIAL_ARCHITECTURE, 'remove edge Internet to Database').ok).toBe(false);
    expect(run(INITIAL_ARCHITECTURE, 'remove node Ghost').ok).toBe(false);
  });

  it('renames a node', () => {
    const r = run(INITIAL_ARCHITECTURE, 'rename Database to Postgres');
    expect(r.ok).toBe(true);
    expect(findNode(r.arch, 'postgres')).toHaveProperty('node');
  });
});

describe('signature', () => {
  it('changes when structure changes and ignores node positions', () => {
    const a = signature(INITIAL_ARCHITECTURE);
    const moved: Architecture = {
      ...INITIAL_ARCHITECTURE,
      nodes: INITIAL_ARCHITECTURE.nodes.map((n) => ({ ...n, position: { x: n.position.x + 10, y: 5 } })),
    };
    expect(signature(moved)).toBe(a);
    expect(signature(run(INITIAL_ARCHITECTURE, 'remove node Database').arch)).not.toBe(a);
  });
});
