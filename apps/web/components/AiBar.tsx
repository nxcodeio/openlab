"use client";

import { useState } from "react";

interface Props {
  onGenerate: (prompt: string) => Promise<void>;
  needsApiKey: boolean;
  onOpenSettings: () => void;
}

export function AiBar({ onGenerate, needsApiKey, onOpenSettings }: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!prompt.trim()) return;
    if (needsApiKey) {
      onOpenSettings();
      return;
    }
    setBusy(true);
    try {
      await onGenerate(prompt.trim());
      setPrompt("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-bar-container">
      <div className="ai-bar">
        <span className="prefix">↳</span>
        <input
          type="text"
          placeholder={needsApiKey
            ? "Add an Anthropic API key in settings to use the AI Bar →"
            : "Describe what to compute. e.g. plot a damped oscillator from 0 to 10s"}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
        />
        <button className="primary" onClick={submit} disabled={busy || !prompt.trim()}>
          {busy ? <><span className="spinner" /> generating</> : "generate"}
        </button>
      </div>
    </div>
  );
}
