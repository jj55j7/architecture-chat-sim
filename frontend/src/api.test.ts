// Tests for the async integration in api.ts, using a fake fetch that behaves
// like the real service: 202 "queued" -> "running" -> "completed" with edges.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSimulation } from './api';
import { INITIAL_ARCHITECTURE, applyCommand, orderNodes } from './architecture';
import type { Architecture } from './types';

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

afterEach(() => vi.unstubAllGlobals());

describe('runSimulation', () => {
  it('POSTs {id,type} nodes, polls until completed, and builds step descriptions', async () => {
    const [a, b, c] = INITIAL_ARCHITECTURE.nodes;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const queue = [
      json({ simulation_id: 'sim-1', status: 'queued', edges: null }, 202),
      json({ simulation_id: 'sim-1', status: 'running', edges: null }),
      json({
        simulation_id: 'sim-1',
        status: 'completed',
        edges: [
          { source: a.id, target: b.id, latency_ms: 18, packets: 64, status: 'success' },
          { source: b.id, target: c.id, latency_ms: 31, packets: 42, status: 'success' },
        ],
      }),
    ];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return queue.shift()!;
    });

    const seen: string[] = [];
    const result = await runSimulation(INITIAL_ARCHITECTURE, {
      pollIntervalMs: 1,
      onProgress: (s) => seen.push(s),
    });

    // 1 POST + 2 GET polls
    expect(calls).toHaveLength(3);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].url).toMatch(/\/simulate$/);
    expect(calls[1].url).toMatch(/\/simulate\/sim-1$/);
    // Request body matches the service's schema exactly: nodes with id (+ type).
    const body = JSON.parse(calls[0].init!.body as string);
    expect(Object.keys(body)).toEqual(['nodes']);
    expect(body.nodes[0]).toEqual({ id: a.id, type: 'Internet' });

    expect(seen).toEqual(['queued', 'running', 'completed']);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].description).toBe('Internet → Web Server · 64 packets · 18 ms (success)');
  });

  it('times out if the service never completes', async () => {
    vi.stubGlobal('fetch', () => json({ simulation_id: 's', status: 'running', edges: null }));
    await expect(runSimulation(INITIAL_ARCHITECTURE, { pollIntervalMs: 1, timeoutMs: 20 })).rejects.toThrow(/did not finish/);
  });

  it('shows the service error detail (FastAPI {"detail": ...})', async () => {
    vi.stubGlobal('fetch', () => json({ detail: 'At least one node is required.' }, 400));
    await expect(runSimulation(INITIAL_ARCHITECTURE)).rejects.toThrow(/400: At least one node is required/);
  });

  it('explains how to start the service when it cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('failed to fetch')));
    await expect(runSimulation(INITIAL_ARCHITECTURE)).rejects.toThrow(/uvicorn simulation_service:app/);
  });

  it('refuses to run with fewer than two nodes without calling the service', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const one: Architecture = { nodes: [INITIAL_ARCHITECTURE.nodes[0]], edges: [] };
    await expect(runSimulation(one)).rejects.toThrow(/at least two nodes/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('orderNodes', () => {
  const labels = (arch: Architecture) => orderNodes(arch).map((n) => n.data.label);
  const add = (arch: Architecture, text: string) => {
    const [verb, ...rest] = text.split(' ');
    void verb;
    const cmd = text.startsWith('connect')
      ? ({ type: 'add_edge', from: rest.join(' ').split(' to ')[0], to: rest.join(' ').split(' to ')[1] } as const)
      : ({ type: 'add_node', label: rest.slice(1).join(' ') } as const);
    return applyCommand(arch, cmd).arch;
  };

  it('follows the data flow of the starting architecture', () => {
    expect(labels(INITIAL_ARCHITECTURE)).toEqual(['Internet', 'Web Server', 'Database']);
  });

  it('puts nodes in topological order even if they were created out of order', () => {
    let arch = add(INITIAL_ARCHITECTURE, 'add node Cache');
    arch = add(arch, 'connect Web Server to Cache');
    arch = add(arch, 'connect Cache to Database');
    const order = labels(arch);
    expect(order[0]).toBe('Internet');
    expect(order.indexOf('Web Server')).toBeLessThan(order.indexOf('Cache'));
    expect(order.indexOf('Cache')).toBeLessThan(order.indexOf('Database'));
  });

  it('puts unconnected nodes last and never loses a node (also with cycles)', () => {
    let arch = add(INITIAL_ARCHITECTURE, 'add node Orphan');
    const order = labels(arch);
    expect(order[order.length - 1]).toBe('Orphan');
    arch = add(arch, 'connect Database to Internet'); // creates a cycle
    expect(labels(arch).sort()).toEqual(['Database', 'Internet', 'Orphan', 'Web Server']);
  });
});
