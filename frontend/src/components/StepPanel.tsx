// Simulation controls: run button, current step + description, prev/next, step list.
import type { SimStep } from '../types';

interface Props {
  steps: SimStep[];
  stepIndex: number;
  stale: boolean; // architecture changed since the simulation ran
  loading: boolean;
  progress: string; // live status text while waiting for the service
  hasSimulation: boolean;
  onRun: () => void;
  onStep: (index: number) => void;
}

export function StepPanel({ steps, stepIndex, stale, loading, progress, hasSimulation, onRun, onStep }: Props) {
  const step = steps[stepIndex];

  return (
    <div className="steps">
      <div className="steps-head">
        <button className="primary" onClick={onRun} disabled={loading}>
          {loading ? `Running… ${progress}` : hasSimulation ? 'Re-run simulation' : 'Run simulation'}
        </button>

        {hasSimulation && steps.length > 0 && (
          <>
            <button onClick={() => onStep(stepIndex - 1)} disabled={stepIndex <= 0} aria-label="Previous step">
              ← Prev
            </button>
            <span className="counter">
              Step {stepIndex + 1} / {steps.length}
            </span>
            <button onClick={() => onStep(stepIndex + 1)} disabled={stepIndex >= steps.length - 1} aria-label="Next step">
              Next →
            </button>
          </>
        )}
      </div>

      {stale && hasSimulation && (
        <div className="stale">The architecture changed after this simulation ran. Re-run it to refresh the trace.</div>
      )}

      {step ? (
        <div className={`current-step${/fail|error|timeout/i.test(step.status) ? ' failed' : ''}`}>
          <b>Step {stepIndex + 1}:</b> {step.description}
        </div>
      ) : (
        <div className="hint">
          {hasSimulation ? 'The trace has no steps for the current nodes.' : 'Run the simulation to see the trace here.'}
        </div>
      )}

      {steps.length > 0 && (
        <ol className="step-list">
          {steps.map((s, i) => (
            <li key={i}>
              <button className={i === stepIndex ? 'active' : ''} onClick={() => onStep(i)}>
                {s.description}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
