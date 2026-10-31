// Chat panel: message history + input box + clickable example commands.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../types';

const EXAMPLES = ['add node Cache', 'connect Web Server to Cache', 'remove edge Web Server to Cache', 'run simulation'];

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function Chat({ messages, onSend }: Props) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="chat">
      <h2>Chat</h2>
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}${m.ok ? '' : ' error'}`}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setText(ex)}>
            {ex}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="chat-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Try: add node Cache'
          aria-label="Architecture instruction"
          autoFocus
        />
        <button type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
