// App: owns ALL state and wires the pieces together.
//   parser.ts       text  -> Command
//   architecture.ts Command + Architecture -> new Architecture
//   api.ts          Architecture -> SimulationResult (calls the service)
//   components/*    pure views
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chat } from './components/Chat';
import { Canvas } from './components/Canvas';
import { StepPanel } from './components/StepPanel';
import { HELP_TEXT, parseCommand } from './parser';
import { INITIAL_ARCHITECTURE, applyCommand, signature } from './architecture';
import { runSimulation } from './api';
import type { Architecture, ArchNode, ChatMessage, SimulationResult } from './types';

const STORAGE_KEY = 'architecture-chat-sim:v1';
const WELCOME = 'Hi! Describe changes in plain text, e.g. "add node Cache". Type "help" to see all commands.';

/** Load the saved architecture (so a page refresh doesn't lose work). */
function loadArch(): Architecture {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Architecture;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed;
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return INITIAL_ARCHITECTURE;
}

export default function App() {
  const [arch, setArch] = useState<Architecture>(loadArch);
  const [past, setPast] = useState<Architecture[]>([]); // undo stack
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, role: 'system', text: WELCOME, ok: true }]);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(''); // e.g. "running · 7s" while waiting on the service
  const nextId = useRef(1);

  // Persist architecture whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arch));
    } catch {
      /* storage full or blocked: not critical */
    }
  }, [arch]);

  const say = useCallback((role: 'user' | 'system', text: string, ok = true) => {
    setMessages((m) => [...m, { id: nextId.current++, role, text, ok }]);
  }, []);

  // Trace steps whose nodes still exist (a node may have been removed since the run).
  const steps = useMemo(() => {
    if (!sim) return [];
    const ids = new Set(arch.nodes.map((n) => n.id));
    return sim.steps.filter((s) => ids.has(s.source) && ids.has(s.target));
  }, [sim, arch.nodes]);

  // Clamp the index if steps were filtered out.
  const safeIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const stale = !!sim && sim.signature !== signature(arch);

  const doSimulate = useCallback(async () => {
    if (loading) return say('system', 'A simulation is already running. Please wait for it to finish.', false);
    setLoading(true);
    setProgress('queued');
    say('system', 'Simulation started. The service takes about 15 seconds; you can keep editing meanwhile.');
    try {
      // The service is asynchronous: runSimulation POSTs, then polls until "completed".
      const result = await runSimulation(arch, {
        onProgress: (status, ms) => setProgress(`${status} · ${Math.round(ms / 1000)}s`),
      });
      setSim(result);
      setStepIndex(0);
      if (result.steps.length === 0) {
        say('system', 'The service returned no trace steps for this architecture.', false);
      } else {
        const failed = result.steps.filter((s) => /fail|error|timeout/i.test(s.status)).length;
        say(
          'system',
          `Simulation ${result.status}: ${result.steps.length} step${result.steps.length === 1 ? '' : 's'}` +
            (failed ? `, ${failed} failed.` : '.') +
            ' Use Prev/Next to walk through it.',
        );
      }
    } catch (err) {
      // Error recovery: the architecture and any previous trace are left untouched.
      say('system', err instanceof Error ? err.message : 'Simulation failed.', false);
    } finally {
      setLoading(false);
      setProgress('');
    }
  }, [arch, loading, say]);

  const handleSend = useCallback(
    (text: string) => {
      say('user', text);
      const parsed = parseCommand(text);
      if (!parsed.ok) return say('system', parsed.error, false);

      const cmd = parsed.command;
      switch (cmd.type) {
        case 'help':
          return say('system', HELP_TEXT);
        case 'simulate':
          return void doSimulate();
        case 'undo': {
          if (past.length === 0) return say('system', 'Nothing to undo.', false);
          setArch(past[past.length - 1]);
          setPast(past.slice(0, -1));
          return say('system', 'Undid the last change.');
        }
        case 'reset':
          setPast((p) => [...p, arch]); // reset itself can be undone
          setArch(INITIAL_ARCHITECTURE);
          setSim(null);
          return say('system', 'Reset to the starting architecture.');
        default: {
          const result = applyCommand(arch, cmd);
          if (!result.ok) return say('system', result.message, false);
          setPast((p) => [...p, arch]);
          setArch(result.arch);
          return say('system', result.message);
        }
      }
    },
    [arch, past, say, doSimulate],
  );

  // Dragging nodes changes positions only; it is not an undoable "command".
  const handleMoved = useCallback((nodes: ArchNode[]) => setArch((a) => ({ ...a, nodes })), []);

  return (
    <div className="app">
      <aside>
        <Chat messages={messages} onSend={handleSend} />
      </aside>
      <main>
        <div className="canvas">
          <Canvas arch={arch} steps={steps} stepIndex={safeIndex} onNodesMoved={handleMoved} />
          <Legend />
        </div>
        <StepPanel
          steps={steps}
          stepIndex={safeIndex}
          stale={stale}
          loading={loading}
          progress={progress}
          hasSimulation={!!sim}
          onRun={doSimulate}
          onStep={(i) => setStepIndex(Math.max(0, Math.min(i, steps.length - 1)))}
        />
      </main>
    </div>
  );
}

/** Small key so a reviewer can tell architecture edges from trace edges at a glance. */
function Legend() {
  return (
    <div className="legend">
      <div>
        <span className="swatch arch" /> Architecture edge
      </div>
      <div>
        <span className="swatch trace" /> Trace edge (reached)
      </div>
      <div>
        <span className="swatch future" /> Trace edge (upcoming)
      </div>
      <div>
        <span className="swatch current" /> Current step
      </div>
      <div>
        <span className="swatch failed" /> Failed hop
      </div>
    </div>
  );
}
