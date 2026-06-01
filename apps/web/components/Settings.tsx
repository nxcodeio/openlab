"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  initialKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

export function Settings({ open, initialKey, onSave, onClose }: Props) {
  const [key, setKey] = useState(initialKey);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Anthropic API key</h3>
        <p>
          OpenLab&apos;s AI Bar calls Claude directly from your browser. Your key is stored in
          <code style={{ margin: "0 4px" }}>localStorage</code> and sent only to api.anthropic.com.
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button onClick={onClose}>cancel</button>
          <button
            className="primary"
            onClick={() => {
              onSave(key.trim());
              onClose();
            }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}
