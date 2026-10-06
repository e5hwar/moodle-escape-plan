import { useRef, useState, type DragEvent } from "react";

/* Drag-to-reorder for a table of editable rows — the Question editor's Options
   and Matching tables (Figma 814:1679 draws a grip on every row) and the Quiz
   Structure step's Sections. HTML5 drag, the same mechanic the Spotlights queue
   and the Edit Columns menu use — but the drag SOURCE is the grip, not the row:
   a draggable row swallows the caret and text selection inside the row's own
   inputs. The row is still the drop target, and the whole row (the nearest
   `rowSelector` ancestor of the grip) is the drag image, so what follows the
   cursor is the row, not the 16px handle. `dragRef` mirrors the dragged id so a
   drop landing in the same render tick reads it. The row classes are the app's
   shared pair: `.is-dragging` fades the carried row, `.is-drop-target` draws
   the accent line where it would land. */
export function useRowDrag<T extends { id: string }>(
  rows: T[],
  onReorder: (next: T[]) => void,
  rowSelector: string,
) {
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const end = () => {
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
  };

  const drop = (targetId: string) => {
    const from = dragRef.current;
    if (from && from !== targetId) {
      const next = [...rows];
      const fromIdx = next.findIndex((r) => r.id === from);
      const toIdx = next.findIndex((r) => r.id === targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        onReorder(next);
      }
    }
    end();
  };

  return {
    /* Spread on the row — the drop target. */
    rowProps: (id: string) => ({
      onDragEnter: () => {
        if (dragRef.current) setOverId(id);
      },
      onDragOver: (e: DragEvent) => {
        // Without this the drop never fires: the default is "no drop here".
        if (dragRef.current) e.preventDefault();
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        drop(id);
      },
      className: `${dragId === id ? " is-dragging" : ""}${
        overId === id && dragId !== id ? " is-drop-target" : ""
      }`,
    }),
    /* Spread on the grip — the drag source. */
    gripProps: (id: string) => ({
      draggable: true,
      onDragStart: (e: DragEvent<HTMLElement>) => {
        // Firefox refuses to start a drag with no payload.
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        const row = e.currentTarget.closest(rowSelector);
        if (row) e.dataTransfer.setDragImage(row, 24, row.clientHeight / 2);
        dragRef.current = id;
        setDragId(id);
      },
      onDragEnd: end,
      title: "Drag to reorder",
    }),
  };
}
