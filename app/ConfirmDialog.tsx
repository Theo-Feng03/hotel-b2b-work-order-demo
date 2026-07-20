"use client";

import { useEffect, useRef, useState } from "react";

export type DialogRequest = {
  testId: string;
  title: string;
  body: string;
  confirmLabel: string;
  trigger: HTMLElement | null;
  onConfirm: () => boolean | void | Promise<boolean | void>;
};

export function ConfirmDialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
      if (event.key === "Tab") {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".confirm-dialog button:not(:disabled)"));
        if (!buttons.length) return;
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
        event.preventDefault(); buttons[next].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); request.trigger?.focus(); };
  }, [loading, onClose, request.trigger]);

  async function submit() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const succeeded = await request.onConfirm();
      if (succeeded === false) { setError("操作未完成，请检查页面提示后重试。"); setLoading(false); return; }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试。");
      setLoading(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onMouseDown={e => e.stopPropagation()}><span className="dialog-symbol">?</span><h2 id="confirm-title">{request.title}</h2><p id="confirm-description">{request.body}</p>{error && <div className="dialog-error" role="alert">{error}</div>}<div><button className="ghost" disabled={loading} onClick={onClose}>取消</button><button ref={confirmRef} className="primary" data-testid={request.testId} aria-label={request.confirmLabel} disabled={loading} aria-busy={loading} onClick={submit}>{loading ? "处理中…" : request.confirmLabel}</button></div></section></div>;
}
