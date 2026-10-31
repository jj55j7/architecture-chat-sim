// Text -> Command parser.
//
// Design choice: a small, rule-based parser (regular expressions) instead of an
// LLM. It is deterministic, instant, free, and easy to test. Each rule turns a
// sentence into a structured `Command`; applying the command to the
// architecture is a separate step (see architecture.ts). Keeping "understand
// the text" and "change the data" apart makes both halves easy to unit test.

export type Command =
  | { type: 'add_node'; label: string }
  | { type: 'add_edge'; from: string; to: string }
  | { type: 'remove_node'; ref: string }
  | { type: 'remove_edge'; from: string; to: string }
  | { type: 'rename_node'; ref: string; label: string }
  | { type: 'simulate' }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'help' };

export type ParseResult =
  | { ok: true; command: Command }
  | { ok: false; error: string };

/** Trim, collapse inner whitespace and strip wrapping quotes from a label. */
export function cleanLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Separator between the two ends of an edge: "->", "→", "to", "and", "with".
const SEP = String.raw`\s*(?:->|→|\bto\b|\band\b|\bwith\b)\s*`;
// Same but without "with" (used where "with" would read oddly).
const SEP_NO_WITH = String.raw`\s*(?:->|→|\bto\b|\band\b)\s*`;

const UNKNOWN =
  'Sorry, I did not understand that. Try "add node Cache", "connect Web Server to Cache", ' +
  '"remove node Cache", "remove edge Web Server to Cache", or type "help".';

export function parseCommand(input: string): ParseResult {
  // Normalise: trim and drop trailing punctuation like "." or "!".
  const text = input.trim().replace(/[.!]+$/, '').trim();
  if (!text) return { ok: false, error: 'Please type an instruction.' };

  let m: RegExpMatchArray | null;

  // --- Meta commands ------------------------------------------------------
  if (/^(?:help|\?|commands)$/i.test(text)) return { ok: true, command: { type: 'help' } };
  if (/^undo$/i.test(text)) return { ok: true, command: { type: 'undo' } };
  if (/^reset$/i.test(text)) return { ok: true, command: { type: 'reset' } };
  if (/^(?:simulate|(?:run|start)\s+(?:the\s+)?simulation)$/i.test(text)) {
    return { ok: true, command: { type: 'simulate' } };
  }

  // --- Rename: "rename Web Server to Frontend" ----------------------------
  m = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
  if (m) {
    return { ok: true, command: { type: 'rename_node', ref: cleanLabel(m[1]), label: cleanLabel(m[2]) } };
  }

  // --- Removals (checked BEFORE additions) --------------------------------
  // "remove node Cache"
  m = text.match(/^(?:remove|delete)\s+(?:the\s+)?node\s+(.+)$/i);
  if (m) return { ok: true, command: { type: 'remove_node', ref: cleanLabel(m[1]) } };

  // "remove edge A to B" / "delete connection between A and B"
  m = text.match(
    new RegExp(String.raw`^(?:remove|delete)\s+(?:the\s+)?(?:edge|connection|link)\s+(?:between\s+|from\s+)?(.+?)${SEP_NO_WITH}(.+)$`, 'i'),
  );
  if (m) {
    return { ok: true, command: { type: 'remove_edge', from: cleanLabel(m[1]), to: cleanLabel(m[2]) } };
  }

  // "disconnect A from B"
  m = text.match(/^(?:disconnect|unlink)\s+(.+?)\s+(?:from|and|to)\s+(.+)$/i);
  if (m) {
    return { ok: true, command: { type: 'remove_edge', from: cleanLabel(m[1]), to: cleanLabel(m[2]) } };
  }

  // Bare "remove Cache" => treat as removing a node.
  m = text.match(/^(?:remove|delete)\s+(.+)$/i);
  if (m) return { ok: true, command: { type: 'remove_node', ref: cleanLabel(m[1]) } };

  // --- Edge additions -----------------------------------------------------
  // "add edge from A to B" / "create a connection between A and B"
  m = text.match(
    new RegExp(String.raw`^(?:add|create)\s+(?:an?\s+|the\s+)?(?:edge|connection|link)\s+(?:from\s+|between\s+)?(.+?)${SEP}(.+)$`, 'i'),
  );
  if (m) {
    return { ok: true, command: { type: 'add_edge', from: cleanLabel(m[1]), to: cleanLabel(m[2]) } };
  }

  // "connect A to B" / "link A with B"
  m = text.match(new RegExp(String.raw`^(?:connect|link)\s+(.+?)${SEP}(.+)$`, 'i'));
  if (m) {
    return { ok: true, command: { type: 'add_edge', from: cleanLabel(m[1]), to: cleanLabel(m[2]) } };
  }

  // Bare arrow: "Web Server -> Cache"
  m = text.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
  if (m) {
    return { ok: true, command: { type: 'add_edge', from: cleanLabel(m[1]), to: cleanLabel(m[2]) } };
  }

  // --- Node addition ------------------------------------------------------
  // "add node Cache" / "add a node called Cache" / "create component Cache" / "add Cache"
  // Tip for the user: quote labels that start with "node", e.g. add node "Node Manager".
  m = text.match(
    /^(?:add|create|insert)\s+(?:an?\s+|the\s+)?(?:new\s+)?(?:(?:node|component)\s+)?(?:(?:called|named|labeled|labelled)\s+|:\s*)?(.+)$/i,
  );
  if (m) {
    const label = cleanLabel(m[1]);
    if (label) return { ok: true, command: { type: 'add_node', label } };
  }

  return { ok: false, error: UNKNOWN };
}

/** Text shown by the "help" command. */
export const HELP_TEXT = [
  'Supported commands:',
  '• add node <name>            e.g. add node Cache',
  '• connect <A> to <B>         e.g. connect Web Server to Cache',
  '• remove node <name>         e.g. remove node Cache',
  '• remove edge <A> to <B>     e.g. remove edge Web Server to Cache',
  '• rename <A> to <B>',
  '• run simulation',
  '• undo / reset / help',
].join('\n');
