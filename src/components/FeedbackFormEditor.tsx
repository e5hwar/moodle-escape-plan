import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FeedbackForm,
  type FormQuestionLink,
} from "../data/feedbackForms";
import { type Question, type QuestionType } from "../data/questionBank";
import { InfoTipIcon, MoveIcon, SmallXIcon } from "./icons";
import { SelectQuestionsModal } from "./SelectQuestionsModal";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

type Props = {
  form: FeedbackForm;
  bank: Question[];
  onUpdate: (links: FormQuestionLink[]) => void;
  onCreateQuestion: () => void;
};

const TODAY = "2026-07-09";

/* The row's second line names the question's shape in full (Figma 810:1285) —
   the Bank's short codes (T/F, Scale, Short) read as jargon here. */
const TYPE_LABEL: Record<QuestionType, string> = {
  "Multiple choice": "Multiple Choice",
  "Multiple select": "Multiple Select",
  "True/False": "True or False",
  "Match the following": "Match the Following",
  "Short answer": "Text Input",
  "File upload": "File Upload",
  "Linear scale": "Linear Scale",
};

/* The Quiz wizard's ordered Questions table (Figma 750:1672), reused verbatim
 * for Feedback Forms: one `.qz` list with drag-to-reorder rows and the Add
 * Question menu (752:2708) in the footer. The differences are the ones the two
 * features genuinely disagree on — a form has no points and no random pools, so
 * the POINTS column becomes a MANDATORY toggle (810:1285), and the menu drops
 * "Add Random Set". */
export function FeedbackFormEditor({ form, bank, onUpdate, onCreateQuestion }: Props) {
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const addWrapRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const actives = form.questions.filter((l) => l.status === "active");
  const inactives = form.questions.filter((l) => l.status === "inactive");

  // Keep the array normalized as [active links in display order, inactive links].
  function commit(nextActives: FormQuestionLink[], nextInactives: FormQuestionLink[]) {
    onUpdate([...nextActives, ...nextInactives]);
  }

  function setMandatory(questionId: string, mandatory: boolean) {
    onUpdate(
      form.questions.map((l) =>
        l.questionId === questionId ? { ...l, mandatory } : l,
      ),
    );
  }

  function removeLink(questionId: string) {
    if (form.responseCount === 0) {
      // Nothing has been answered yet — there is no response to preserve, so
      // the link is dropped outright rather than kept as a tombstone.
      onUpdate(form.questions.filter((l) => l.questionId !== questionId));
      return;
    }
    const l = actives.find((x) => x.questionId === questionId);
    if (!l) return;
    commit(
      actives.filter((x) => x.questionId !== questionId),
      [...inactives, { ...l, status: "inactive", deactivatedAt: TODAY }],
    );
  }

  function reactivateLink(questionId: string) {
    const l = inactives.find((x) => x.questionId === questionId);
    if (!l) return;
    commit(
      [...actives, { ...l, status: "active", deactivatedAt: undefined }],
      inactives.filter((x) => x.questionId !== questionId),
    );
  }

  /** Bank questions arrive in selection order and join the form in that order. */
  function addFromBank(ids: string[]) {
    const fresh = ids
      .filter((id) => !form.questions.some((l) => l.questionId === id))
      .map((id) => ({
        questionId: id,
        mandatory: false,
        status: "active" as const,
        linkedAt: TODAY,
      }));
    commit([...actives, ...fresh], inactives);
  }

  // Drag-to-reorder, pointer-based (HTML5 DnD is unreliable across
  // browsers/automation): pressing a handle starts a window-level pointer drag;
  // the row under the pointer is the drop slot.
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const rowUnder = (y: number) => {
    let target: string | null = null;
    rowRefs.current.forEach((el, k) => {
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) target = k;
    });
    return target;
  };
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = [...actives];
    const from = next.findIndex((l) => l.questionId === fromId);
    const to = next.findIndex((l) => l.questionId === toId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next, inactives);
  };
  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDrag(id);
    setOver(id);
    const onMove = (ev: PointerEvent) => setOver(rowUnder(ev.clientY));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const target = rowUnder(ev.clientY);
      if (target) reorder(id, target);
      setDrag(null);
      setOver(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const rowRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };
  const rowDragClass = (id: string) =>
    `${drag === id ? " dragging" : ""}${drag && over === id && drag !== id ? " drag-over" : ""}`;

  const openCreate = () => {
    setMenuOpen(false);
    onCreateQuestion();
  };
  const openBank = () => {
    setMenuOpen(false);
    setPicking(true);
  };

  useCreateShortcut(() => setMenuOpen(true), !menuOpen && !picking, "q");

  // While the menu is open: C / Q fire its rows, Escape and outside clicks
  // dismiss. Escape is captured so it can't also cancel the wizard.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
      } else if (k === "c") {
        e.preventDefault();
        openCreate();
      } else if (k === "q") {
        e.preventDefault();
        openBank();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (addWrapRef.current && !addWrapRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen]);

  return (
    <>
      <div className={`qz${drag ? " qz-dragging" : ""}`}>
        <div className="qz-hd">
          <span className="qz-ord-col">
            <span className="qz-drag qz-drag--ghost" aria-hidden="true">
              <MoveIcon />
            </span>
            <span className="qz-ord">ORDER</span>
          </span>
          <span className="qz-hd-q">QUESTION</span>
          <span className="qz-hd-points qz-hd-mand">
            MANDATORY
            <span
              className="form-help-info qz-points-info"
              tabIndex={0}
              role="note"
              aria-label="If the user chooses to submit, they must answer this question. Dismissing the whole form is always allowed."
              data-tip="If the user chooses to submit, they must answer this question. Dismissing the whole form is always allowed."
            >
              <InfoTipIcon />
            </span>
          </span>
        </div>

        {actives.length === 0 && (
          <div className="qz-empty">
            No questions yet — Add Question below creates one or picks from the
            Bank.
          </div>
        )}

        {actives.map((l, i) => {
          const q = byId.get(l.questionId);
          return (
            <div
              key={l.questionId}
              ref={rowRef(l.questionId)}
              className={`qz-row${rowDragClass(l.questionId)}`}
            >
              <span className="qz-ord-col">
                <button
                  className="qz-drag"
                  aria-label="Reorder"
                  onPointerDown={startDrag(l.questionId)}
                >
                  <MoveIcon />
                </button>
                <span className="qz-ord">{i + 1}</span>
              </span>
              <div className="qz-q">
                <div className="qz-q-title">
                  {q ? q.text : `${l.questionId} — not found in the Question Bank`}
                </div>
                <div className="qz-q-type">{q ? TYPE_LABEL[q.type] : "—"}</div>
              </div>
              <span className="qz-mand">
                <button
                  type="button"
                  className={`toggle ${l.mandatory ? "on" : ""}`}
                  aria-pressed={l.mandatory}
                  aria-label="Mandatory"
                  onClick={() => setMandatory(l.questionId, !l.mandatory)}
                >
                  <span className="toggle-knob" />
                </button>
              </span>
              <button
                className="qz-x"
                aria-label="Remove"
                title={
                  form.responseCount === 0
                    ? "Remove from this form"
                    : "Mark Inactive — stops appearing in future prompts; collected responses are preserved"
                }
                onClick={() => removeLink(l.questionId)}
              >
                <SmallXIcon />
              </button>
            </div>
          );
        })}

        <div className="qz-foot">
          <div className="qz-add-wrap" ref={addWrapRef}>
            <button
              className="cta-primary qz-add"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              Add Question
              <span className="qz-kbd">Q</span>
            </button>
            {menuOpen && (
              <div className="u-menu qz-menu" role="menu">
                <button className="u-menu-item qz-menu-item" role="menuitem" onClick={openCreate}>
                  <span className="qz-menu-label">Create New Question</span>
                  <span className="qz-kbd">C</span>
                </button>
                <button className="u-menu-item qz-menu-item" role="menuitem" onClick={openBank}>
                  <span className="qz-menu-label">Add from Question Bank</span>
                  <span className="qz-kbd">Q</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {inactives.length > 0 && (
        <div className="fb-inactive-section">
          <div className="fb-inactive-head">
            <h3 className="fb-section-title">Inactive questions</h3>
            <p className="fb-section-sub">
              No longer shown to users. The questions and all responses already
              collected against them remain attached to this form.
            </p>
          </div>
          <div className="qz">
            {inactives.map((l) => {
              const q = byId.get(l.questionId);
              return (
                <div key={l.questionId} className="qz-row qz-row--inactive">
                  <div className="qz-q">
                    <div className="qz-q-title">
                      {q ? q.text : `${l.questionId} — not found in the Question Bank`}
                    </div>
                    <div className="qz-q-type">
                      {q ? TYPE_LABEL[q.type] : "—"}
                      {l.deactivatedAt && ` · inactive since ${l.deactivatedAt}`}
                    </div>
                  </div>
                  <button
                    className="btn-save-draft fb-reactivate-btn"
                    onClick={() => reactivateLink(l.questionId)}
                  >
                    Reactivate
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Portalled to <body>: the wizard's step container is transformed, which
          would otherwise turn the overlay's position:fixed into a local box. */}
      {picking && createPortal(
        <SelectQuestionsModal
          mode="static"
          gradedOnly={false}
          excludeIds={form.questions.map((l) => l.questionId)}
          value={[]}
          onConfirm={(ids) => {
            addFromBank(ids);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />,
        document.body,
      )}
    </>
  );
}
