"use client";
import { useEffect, useRef, useState } from "react";
import { createEditor } from "@/lib/agent/browser";
import { documentIndex } from "@/lib/agent/document";
export default function OutputPreview({
  blob,
  blockId,
  onClose,
}: {
  blob: Blob;
  blockId?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let gone = false;
    let dispose = () => {};
    dialog.current!.showModal();
    void createEditor(
      host.current!,
      new File([blob], "comparison.docx"),
      undefined,
      "viewing",
    )
      .then(async (sd) => {
        if (gone) {
          sd.destroy();
          return;
        }
        dispose = () => sd.destroy();
        if (blockId) {
          const s = await documentIndex(
              sd.activeEditor!.doc!,
              "Inspect comparison",
              "0".repeat(64),
            ),
            b = s.blocks.find((b) => b.id === blockId);
          if (b)
            await sd.ui.viewport.scrollIntoView({
              target: {
                kind: "text",
                blockId: b.nodeId,
                range: { start: 0, end: 0 },
              },
              block: "center",
              behavior: "instant",
            });
        }
      })
      .catch(() =>
        setError(
          "Preview could not open. Download the Word copy to inspect it.",
        ),
      );
    return () => {
      gone = true;
      dispose();
    };
  }, [blob, blockId]);
  return (
    <dialog
      className="agent-output-dialog"
      ref={dialog}
      aria-label="Comparison Word copy"
      onCancel={onClose}
    >
      <header>
        <b>Comparison copy · read only</b>
        <button onClick={onClose}>Close preview</button>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="agent-output-document" ref={host} />
    </dialog>
  );
}
