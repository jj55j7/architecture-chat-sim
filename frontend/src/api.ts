// The ONLY file that talks to the simulation service (simulation_service.py).
//
// How the real service behaves (read from its source):
//   POST /simulate        body {nodes:[{id, type?}]}  ->  202 {simulation_id, status:"queued", edges:null}
//   GET  /simulate/{id}   ->  {status: "queued" | "running" | "completed", edges: null | [...]}
//   The job takes ~15 seconds, so the client MUST poll until status is "completed".
//   Only nodes are accepted (edges are ignored). The trace is a path through the
//   nodes in the order they were sent: first node = source, last = destination,
//   the middle nodes are shuffled by the service.
import type { Architecture, SimStep, SimulationResult } from './types';
import { orderNodes, signature } from './architecture';

// "/sim" is proxied to http://127.0.0.1:8000 by vite.config.ts (avoids CORS).
// Set VITE_SIM_API_URL to call the service directly instead.
const BASE: string = (import.meta.env.VITE_SIM_API_URL as string | undefined) ?? '/sim';
const SIMULATE_PATH = '/simulate';
const RESULT_PATH = (id: string) => `/simulate/${id}`;

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 60_000; // service needs ~15 s; allow plenty of slack

/** One hop as returned by the service. */
interface RawEdge {
  source: string;
  target: string;
  latency_ms?: number;
  packets?: number;
  status?: string;
}
interface RawResponse {
  simulation_id: string;
  status: string; // "queued" | "running" | "completed"
  edges: RawEdge[] | null;
}

export interface RunOptions {
  /** Called after every response so the UI can show "queued / running, 7 s". */
  onProgress?: (status: string, elapsedMs: number) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start a simulation for the current architecture, wait for it, return a normalised trace. */
export async function runSimulation(arch: Architecture, opts: RunOptions = {}): Promise<SimulationResult> {
  const { onProgress, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  if (arch.nodes.length < 2) {
    throw new Error('Add at least two nodes before running a simulation.');
  }

  // The service builds the path from node ORDER, so send the nodes in a
  // meaningful order (sources first, sinks last) rather than creation order.
  // `type` is the service's only optional field; we use it to carry the label.
  const body = { nodes: orderNodes(arch).map((n) => ({ id: n.id, type: n.data.label })) };

  const started = Date.now();
  let data = await request<RawResponse>(SIMULATE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const id = data.simulation_id;
  onProgress?.(data.status, 0);

  // Asynchronous integration: poll until completed (or failed / timed out).
  while (data.status !== 'completed') {
    if (/fail|error/i.test(data.status)) {
      throw new Error(`Simulation service reported status "${data.status}".`);
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`The simulation did not finish within ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    await sleep(pollIntervalMs);
    data = await request<RawResponse>(RESULT_PATH(id));
    onProgress?.(data.status, Date.now() - started);
  }

  return normalise(data, arch);
}

/** fetch + JSON + readable errors (including FastAPI's {"detail": ...} format). */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new Error(
      'Could not reach the simulation service. Start it with: python -m uvicorn simulation_service:app --reload',
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* body was not JSON */
    }
    throw new Error(`Simulation service error ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return (await res.json()) as T;
}

/** Turn the raw service response into the app's own SimulationResult (one step per returned edge). */
function normalise(data: RawResponse, arch: Architecture): SimulationResult {
  const label = (id: string) => arch.nodes.find((n) => n.id === id)?.data.label ?? id;

  const steps: SimStep[] = (data.edges ?? []).map((r, index) => {
    const status = r.status ?? 'success';
    const parts = [`${label(r.source)} → ${label(r.target)}`];
    if (r.packets !== undefined) parts.push(`${r.packets} packets`);
    if (r.latency_ms !== undefined) parts.push(`${r.latency_ms} ms`);
    return {
      index,
      source: r.source,
      target: r.target,
      status,
      latency_ms: r.latency_ms,
      packets: r.packets,
      description: `${parts.join(' · ')} (${status})`,
    };
  });

  return {
    simulationId: data.simulation_id,
    status: data.status,
    steps,
    signature: signature(arch), // remembers which architecture this trace belongs to
  };
}
