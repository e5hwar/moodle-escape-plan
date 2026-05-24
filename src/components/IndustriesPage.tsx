import { useMemo, useState } from "react";
import {
  industries as seedIndustries,
  allCertsById,
  type Industry,
  type SubIndustry,
  type CareerStage,
  type IndustryCert,
} from "../data/industries";
import { SearchIcon, SmallXIcon, DragHandleIcon } from "./icons";

type Scope =
  | { kind: "industry"; industryKey: string }
  | { kind: "sub"; industryKey: string; subKey: string };

type ModalState =
  | { kind: "none" }
  | { kind: "new-industry" }
  | { kind: "new-sub"; industryKey: string }
  | { kind: "rename-industry"; industryKey: string }
  | { kind: "rename-sub"; industryKey: string; subKey: string }
  | { kind: "delete-confirm"; scope: Scope }
  | { kind: "add-certs"; scope: Scope };

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.4v.01M11 12h1v4h1" />
  </svg>
);
const CaretRightIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a1 1 0 001 1h8a1 1 0 001-1l1-14M10 11v6M14 11v6" />
  </svg>
);
const MoreDotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const CAREER_STAGES: CareerStage[] = ["Apprentice", "Journeyman", "Master"];

export function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>(seedIndustries);
  const [scope, setScope] = useState<Scope>({ kind: "industry", industryKey: "hvac" });
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["hvac"]));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const orderedIndustries = useMemo(
    () =>
      [...industries].sort((a, b) => a.displayPosition - b.displayPosition),
    [industries],
  );

  const totalSubIndustries = useMemo(
    () => industries.reduce((n, i) => n + i.subIndustries.length, 0),
    [industries],
  );

  const filteredIndustries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedIndustries;
    return orderedIndustries.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.subIndustries.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [orderedIndustries, search]);

  const currentIndustry =
    industries.find((i) => i.key === scope.industryKey) ?? industries[0];
  const currentSub =
    scope.kind === "sub"
      ? currentIndustry.subIndustries.find((s) => s.key === scope.subKey)
      : null;

  function toggleOpen(key: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function pickIndustry(key: string) {
    setScope({ kind: "industry", industryKey: key });
    setOpenIds((prev) => new Set([...prev, key]));
  }

  function pickSub(industryKey: string, subKey: string) {
    setScope({ kind: "sub", industryKey, subKey });
  }

  // ─── Mutations ────────────────────────────────────────────────────────────
  function addIndustry(name: string, position: number) {
    setIndustries((prev) => {
      const key = `i-${Date.now()}`;
      const clamped = Math.max(1, Math.min(position, prev.length + 1));
      // Shift positions >= clamped
      const shifted = prev.map((i) =>
        i.displayPosition >= clamped
          ? { ...i, displayPosition: i.displayPosition + 1 }
          : i,
      );
      return [
        ...shifted,
        { key, name, displayPosition: clamped, certIds: [], subIndustries: [] },
      ];
    });
  }

  function addSub(industryKey: string, name: string, position: number) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const subs = i.subIndustries;
        const clamped = Math.max(1, Math.min(position, subs.length + 1));
        const shifted = subs.map((s) =>
          s.displayPosition >= clamped
            ? { ...s, displayPosition: s.displayPosition + 1 }
            : s,
        );
        const newSub: SubIndustry = {
          key: `s-${Date.now()}`,
          name,
          displayPosition: clamped,
          certIds: [],
        };
        return { ...i, subIndustries: [...shifted, newSub] };
      }),
    );
  }

  function renameIndustry(key: string, name: string, position: number) {
    setIndustries((prev) => {
      const target = prev.find((i) => i.key === key);
      if (!target) return prev;
      const oldPos = target.displayPosition;
      const clamped = Math.max(1, Math.min(position, prev.length));
      const repositioned = prev.map((i) => {
        if (i.key === key) return { ...i, name, displayPosition: clamped };
        // Shift others
        if (clamped < oldPos) {
          if (i.displayPosition >= clamped && i.displayPosition < oldPos) {
            return { ...i, displayPosition: i.displayPosition + 1 };
          }
        } else if (clamped > oldPos) {
          if (i.displayPosition <= clamped && i.displayPosition > oldPos) {
            return { ...i, displayPosition: i.displayPosition - 1 };
          }
        }
        return i;
      });
      return repositioned;
    });
  }

  function renameSub(industryKey: string, subKey: string, name: string, position: number) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const target = i.subIndustries.find((s) => s.key === subKey);
        if (!target) return i;
        const oldPos = target.displayPosition;
        const clamped = Math.max(1, Math.min(position, i.subIndustries.length));
        const subs = i.subIndustries.map((s) => {
          if (s.key === subKey) return { ...s, name, displayPosition: clamped };
          if (clamped < oldPos) {
            if (s.displayPosition >= clamped && s.displayPosition < oldPos) {
              return { ...s, displayPosition: s.displayPosition + 1 };
            }
          } else if (clamped > oldPos) {
            if (s.displayPosition <= clamped && s.displayPosition > oldPos) {
              return { ...s, displayPosition: s.displayPosition - 1 };
            }
          }
          return s;
        });
        return { ...i, subIndustries: subs };
      }),
    );
  }

  function deleteIndustry(key: string) {
    setIndustries((prev) => {
      const target = prev.find((i) => i.key === key);
      if (!target) return prev;
      return prev
        .filter((i) => i.key !== key)
        .map((i) =>
          i.displayPosition > target.displayPosition
            ? { ...i, displayPosition: i.displayPosition - 1 }
            : i,
        );
    });
    // Reset selection
    const remaining = industries.filter((i) => i.key !== key);
    if (remaining[0]) {
      setScope({ kind: "industry", industryKey: remaining[0].key });
    }
  }

  function deleteSub(industryKey: string, subKey: string) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const target = i.subIndustries.find((s) => s.key === subKey);
        if (!target) return i;
        const subs = i.subIndustries
          .filter((s) => s.key !== subKey)
          .map((s) =>
            s.displayPosition > target.displayPosition
              ? { ...s, displayPosition: s.displayPosition - 1 }
              : s,
          );
        return { ...i, subIndustries: subs };
      }),
    );
    setScope({ kind: "industry", industryKey });
  }

  function addCertsToScope(certIds: string[]) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== scope.industryKey) return i;
        if (scope.kind === "industry") {
          return { ...i, certIds: [...i.certIds, ...certIds] };
        }
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === scope.subKey ? { ...s, certIds: [...s.certIds, ...certIds] } : s,
          ),
        };
      }),
    );
  }

  function reorderCertsInScope(nextIds: string[]) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== scope.industryKey) return i;
        if (scope.kind === "industry") {
          return { ...i, certIds: nextIds };
        }
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === scope.subKey ? { ...s, certIds: nextIds } : s,
          ),
        };
      }),
    );
  }

  function removeCertFromScope(certId: string) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== scope.industryKey) return i;
        if (scope.kind === "industry") {
          return { ...i, certIds: i.certIds.filter((c) => c !== certId) };
        }
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === scope.subKey
              ? { ...s, certIds: s.certIds.filter((c) => c !== certId) }
              : s,
          ),
        };
      }),
    );
  }

  // ─── Where is a cert currently tagged? ────────────────────────────────────
  function tagsForCert(certId: string): { industryName: string; subName?: string }[] {
    const out: { industryName: string; subName?: string }[] = [];
    for (const ind of industries) {
      if (ind.certIds.includes(certId)) {
        out.push({ industryName: ind.name });
      }
      for (const sub of ind.subIndustries) {
        if (sub.certIds.includes(certId)) {
          out.push({ industryName: ind.name, subName: sub.name });
        }
      }
    }
    return out;
  }

  // Tags excluding the current scope (for "Also tagged in")
  function alsoTaggedIn(certId: string): { industryName: string; subName?: string }[] {
    return tagsForCert(certId).filter((t) => {
      if (scope.kind === "industry") {
        return !(t.industryName === currentIndustry.name && !t.subName);
      }
      const sub = currentSub;
      return !(t.industryName === currentIndustry.name && t.subName === sub?.name);
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const scopeCertIds =
    scope.kind === "industry" ? currentIndustry.certIds : currentSub?.certIds ?? [];

  const currentIndustryTotalCerts =
    currentIndustry.certIds.length +
    currentIndustry.subIndustries.reduce((n, s) => n + s.certIds.length, 0);

  return (
    <div className="main">
      <div className="workspace">
        <div className="ind-page">
          {/* ─── Left rail ─── */}
          <aside className="ind-rail">
            <div className="ind-rail-head">
              <div className="ind-rail-eyebrow">CATEGORIZATION</div>
              <h1 className="ind-rail-title">Industries</h1>
              <div className="ind-rail-sub">
                {industries.length} Industries · {totalSubIndustries} Sub-Industries
              </div>
            </div>

            <div className="ind-rail-search">
              <span className="ind-rail-search-icon"><SearchIcon /></span>
              <input
                className="ind-rail-search-input"
                placeholder="Search Industries"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="ind-rail-add"
              onClick={() => setModal({ kind: "new-industry" })}
            >
              + Add Industry
            </button>

            <div className="ind-tree">
              {filteredIndustries.map((ind) => {
                const isOpen = openIds.has(ind.key);
                const hasSubs = ind.subIndustries.length > 0;
                const industryActive =
                  scope.kind === "industry" && scope.industryKey === ind.key;
                const totalCerts =
                  ind.certIds.length +
                  ind.subIndustries.reduce((n, s) => n + s.certIds.length, 0);
                return (
                  <div key={ind.key} className="ind-tree-group">
                    <button
                      className={`ind-tree-row ${industryActive ? "is-active" : ""}`}
                      onClick={() => {
                        if (hasSubs) toggleOpen(ind.key);
                        pickIndustry(ind.key);
                      }}
                    >
                      <span
                        className={`ind-tree-caret ${isOpen ? "is-open" : ""} ${hasSubs ? "" : "is-hidden"}`}
                      >
                        <CaretRightIcon />
                      </span>
                      <span className="ind-tree-row-label">{ind.name}</span>
                      <span className="ind-tree-row-count">{totalCerts}</span>
                    </button>
                    {hasSubs && isOpen && (
                      <div className="ind-sublist">
                        {[...ind.subIndustries]
                          .sort((a, b) => a.displayPosition - b.displayPosition)
                          .map((sub) => {
                            const isActive =
                              scope.kind === "sub" &&
                              scope.industryKey === ind.key &&
                              scope.subKey === sub.key;
                            return (
                              <button
                                key={sub.key}
                                className={`ind-sub-row ${isActive ? "is-active" : ""}`}
                                onClick={() => pickSub(ind.key, sub.key)}
                              >
                                <span className="ind-sub-row-label">{sub.name}</span>
                                <span className="ind-sub-row-count">{sub.certIds.length}</span>
                              </button>
                            );
                          })}
                        <button
                          className="ind-sub-add"
                          onClick={() =>
                            setModal({ kind: "new-sub", industryKey: ind.key })
                          }
                        >
                          + Add Sub-Industry
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ─── Detail pane ─── */}
          <section className="ind-detail">
            <header className="ind-detail-head">
              <div className="ind-detail-titleblock">
                <div className="ind-detail-eyebrow">
                  {scope.kind === "industry" ? "INDUSTRY" : "SUB-INDUSTRY"}
                </div>
                <h2 className="ind-detail-title">
                  {scope.kind === "industry"
                    ? currentIndustry.name
                    : currentSub?.name ?? "—"}
                </h2>
                <div className="ind-detail-sub">
                  {scope.kind === "industry" ? (
                    <>
                      <span>
                        <strong>{currentIndustry.subIndustries.length}</strong>{" "}
                        Sub-Industries
                      </span>
                      <span className="ind-dot" />
                      <span>
                        <strong>{currentIndustryTotalCerts}</strong>{" "}
                        Certifications total
                      </span>
                      <span className="ind-dot" />
                      <span>
                        Display position{" "}
                        <strong>{currentIndustry.displayPosition}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <strong>{currentSub?.certIds.length ?? 0}</strong>{" "}
                        Certifications
                      </span>
                      <span className="ind-dot" />
                      <span>
                        Display position{" "}
                        <strong>{currentSub?.displayPosition ?? 0}</strong>
                      </span>
                      <span className="ind-dot" />
                      <span>
                        in <strong>{currentIndustry.name}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="ind-detail-actions">
                <button
                  className="ind-detail-btn"
                  onClick={() =>
                    setModal(
                      scope.kind === "industry"
                        ? { kind: "rename-industry", industryKey: scope.industryKey }
                        : {
                            kind: "rename-sub",
                            industryKey: scope.industryKey,
                            subKey: scope.subKey,
                          },
                    )
                  }
                >
                  <PencilIcon /> Rename
                </button>
                <button
                  className="ind-detail-btn ind-detail-btn--danger"
                  onClick={() => setModal({ kind: "delete-confirm", scope })}
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            </header>

            {scope.kind === "industry" && currentIndustry.subIndustries.length > 0 && (
              <div className="ind-banner">
                <span className="ind-banner-icon"><InfoIcon /></span>
                <div className="ind-banner-text">
                  Certifications listed here are{" "}
                  <strong>tagged at the Industry level only</strong> — they belong to{" "}
                  {currentIndustry.name} but no specific Sub-Industry. Certs tagged with a
                  Sub-Industry appear under that Sub-Industry in the left panel, not here.
                  A Cert can be tagged with both (which makes it show up in both places).
                </div>
              </div>
            )}

            <div className="ind-list-head">
              <div>
                <div className="ind-list-title">
                  {scope.kind === "industry"
                    ? `Certifications at the ${currentIndustry.name} Industry level`
                    : `Certifications in ${currentIndustry.name} › ${currentSub?.name}`}{" "}
                  <span className="ind-list-count">· {scopeCertIds.length}</span>
                </div>
                <div className="ind-list-sub">
                  {scope.kind === "industry"
                    ? `Shown when users browse ${currentIndustry.name} at the top level. Drag rows to reorder.`
                    : `Shown when users browse ${currentIndustry.name} › ${currentSub?.name}. Drag rows to reorder.`}
                </div>
              </div>
              <button
                className="ind-add-certs-btn"
                onClick={() => setModal({ kind: "add-certs", scope })}
              >
                + Add Certifications
              </button>
            </div>

            <CertList
              certIds={scopeCertIds}
              alsoTaggedIn={alsoTaggedIn}
              onReorder={reorderCertsInScope}
              onRemove={removeCertFromScope}
            />
          </section>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {modal.kind === "new-industry" && (
        <NameModal
          title="New Industry"
          nameLabel="Name"
          posLabel="Display position"
          posHelp="Where this Industry appears in the browse order. Defaults to the end of the list — change to push it higher."
          nameHelp="Must be unique across all Industries."
          defaultName=""
          defaultPos={industries.length + 1}
          existingNames={industries.map((i) => i.name.toLowerCase())}
          submitLabel="Create Industry"
          onSubmit={(name, pos) => {
            addIndustry(name, pos);
            setModal({ kind: "none" });
          }}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}

      {modal.kind === "new-sub" && (() => {
        const parent = industries.find((i) => i.key === modal.industryKey);
        if (!parent) return null;
        return (
          <NameModal
            title={`New Sub-Industry in ${parent.name}`}
            nameLabel="Name"
            posLabel="Display position"
            posHelp={`Where this Sub-Industry appears under ${parent.name}. Defaults to the end of the list — change to push it higher.`}
            nameHelp={`Must be unique within ${parent.name}. Can repeat across other Industries.`}
            defaultName=""
            defaultPos={parent.subIndustries.length + 1}
            existingNames={parent.subIndustries.map((s) => s.name.toLowerCase())}
            submitLabel="Create Sub-Industry"
            onSubmit={(name, pos) => {
              addSub(modal.industryKey, name, pos);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "rename-industry" && (() => {
        const ind = industries.find((i) => i.key === modal.industryKey);
        if (!ind) return null;
        return (
          <NameModal
            title="Rename Industry"
            nameLabel="Name"
            posLabel="Display position"
            posHelp="Where this Industry appears in the browse order."
            nameHelp="Must be unique across all Industries."
            defaultName={ind.name}
            defaultPos={ind.displayPosition}
            existingNames={industries
              .filter((i) => i.key !== modal.industryKey)
              .map((i) => i.name.toLowerCase())}
            submitLabel="Save"
            onSubmit={(name, pos) => {
              renameIndustry(modal.industryKey, name, pos);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "rename-sub" && (() => {
        const parent = industries.find((i) => i.key === modal.industryKey);
        const sub = parent?.subIndustries.find((s) => s.key === modal.subKey);
        if (!parent || !sub) return null;
        return (
          <NameModal
            title={`Rename Sub-Industry in ${parent.name}`}
            nameLabel="Name"
            posLabel="Display position"
            posHelp={`Where this Sub-Industry appears under ${parent.name}.`}
            nameHelp={`Must be unique within ${parent.name}.`}
            defaultName={sub.name}
            defaultPos={sub.displayPosition}
            existingNames={parent.subIndustries
              .filter((s) => s.key !== modal.subKey)
              .map((s) => s.name.toLowerCase())}
            submitLabel="Save"
            onSubmit={(name, pos) => {
              renameSub(modal.industryKey, modal.subKey, name, pos);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "delete-confirm" && (() => {
        const scope = modal.scope;
        const ind = industries.find((i) => i.key === scope.industryKey);
        if (!ind) return null;
        const isIndustry = scope.kind === "industry";
        const sub =
          scope.kind === "sub"
            ? ind.subIndustries.find((s) => s.key === scope.subKey)
            : null;
        const label = isIndustry ? ind.name : `${ind.name} › ${sub?.name}`;
        const certCount = isIndustry
          ? ind.certIds.length +
            ind.subIndustries.reduce((n, s) => n + s.certIds.length, 0)
          : sub?.certIds.length ?? 0;
        const subCount = isIndustry ? ind.subIndustries.length : 0;
        return (
          <DeleteConfirm
            title={`Delete ${isIndustry ? "Industry" : "Sub-Industry"}?`}
            label={label}
            certCount={certCount}
            subCount={subCount}
            isIndustry={isIndustry}
            onConfirm={() => {
              if (scope.kind === "industry") {
                deleteIndustry(scope.industryKey);
              } else {
                deleteSub(scope.industryKey, scope.subKey);
              }
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "add-certs" && (
        <AddCertsModal
          scope={modal.scope}
          industryName={currentIndustry.name}
          subName={currentSub?.name}
          alreadyAtScope={new Set(scopeCertIds)}
          tagsForCert={tagsForCert}
          onAdd={(ids) => {
            addCertsToScope(ids);
            setModal({ kind: "none" });
          }}
          onClose={() => setModal({ kind: "none" })}
        />
      )}
    </div>
  );
}

/* ─── Cert list (with drag-to-reorder) ────────────────────────────────────── */

function CertList({
  certIds,
  alsoTaggedIn,
  onReorder,
  onRemove,
}: {
  certIds: string[];
  alsoTaggedIn: (id: string) => { industryName: string; subName?: string }[];
  onReorder: (next: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  if (certIds.length === 0) {
    return (
      <div className="ind-cert-empty">
        <div className="ind-cert-empty-title">No certifications tagged here yet.</div>
        <div className="ind-cert-empty-sub">
          Click <strong>+ Add Certifications</strong> above to attach existing certifications.
        </div>
      </div>
    );
  }

  function onDragStart(idx: number) {
    setDragIdx(idx);
  }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }
  function onDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...certIds];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    onReorder(next);
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <div className="ind-cert-list">
      {certIds.map((id, idx) => {
        const cert = allCertsById[id];
        if (!cert) return null;
        const also = alsoTaggedIn(id);
        const isDragging = dragIdx === idx;
        const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
        return (
          <div
            key={id}
            className={`ind-cert-row ${isDragging ? "is-dragging" : ""} ${isOver ? "is-over" : ""}`}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={onDrop}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
          >
            <span className="ind-cert-drag" aria-hidden>
              <DragHandleIcon />
            </span>
            <span className="ind-cert-num">{idx + 1}</span>
            <div className="ind-cert-meta">
              <div className="ind-cert-name">{cert.name}</div>
              <div className="ind-cert-sub">
                {cert.stage} · {cert.hours} {cert.hours === 1 ? "hour" : "hours"}
              </div>
              {also.length > 0 && (
                <div className="ind-cert-also">
                  <span className="ind-cert-also-label">Also tagged in:</span>
                  {also.map((t, i) => (
                    <span key={`${t.industryName}-${t.subName ?? ""}-${i}`} className="ind-cert-tag">
                      {t.subName ? `${t.industryName} › ${t.subName}` : t.industryName}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              className="ind-cert-action"
              aria-label="Remove from this Industry"
              title="Remove from this Industry"
              onClick={() => onRemove(id)}
            >
              <SmallXIcon />
            </button>
            <button className="ind-cert-action" aria-label="More" onClick={(e) => e.preventDefault()}>
              <MoreDotsIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Name + position modal ───────────────────────────────────────────────── */

function NameModal({
  title,
  nameLabel,
  posLabel,
  nameHelp,
  posHelp,
  defaultName,
  defaultPos,
  existingNames,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  nameLabel: string;
  posLabel: string;
  nameHelp: string;
  posHelp: string;
  defaultName: string;
  defaultPos: number;
  existingNames: string[];
  submitLabel: string;
  onSubmit: (name: string, pos: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [pos, setPos] = useState(String(defaultPos));

  const trimmed = name.trim();
  const isDuplicate =
    trimmed && existingNames.includes(trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  return (
    <div className="ind-modal-overlay" onClick={onCancel}>
      <div className="ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <h3 className="ind-modal-title">{title}</h3>
          <button className="ind-modal-close" aria-label="Close" onClick={onCancel}>
            <SmallXIcon />
          </button>
        </div>
        <div className="ind-modal-body">
          <label className="ind-field">
            <span className="ind-field-label">
              {nameLabel} <span className="ind-field-required">*</span>
            </span>
            <input
              autoFocus
              className="ind-field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Solar & Renewables"
            />
            <span className="ind-field-help">
              {isDuplicate ? (
                <span className="ind-field-error">A {nameLabel.toLowerCase()} with this name already exists.</span>
              ) : (
                nameHelp
              )}
            </span>
          </label>

          <label className="ind-field">
            <span className="ind-field-label">{posLabel}</span>
            <input
              className="ind-field-input ind-field-input--narrow"
              type="number"
              min={1}
              value={pos}
              onChange={(e) => setPos(e.target.value)}
            />
            <span className="ind-field-help">{posHelp}</span>
          </label>
        </div>
        <div className="ind-modal-foot">
          <button className="ind-btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="ind-btn-primary"
            disabled={!isValid}
            onClick={() => {
              if (!isValid) return;
              const n = Number(pos);
              onSubmit(trimmed, Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultPos);
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete confirm ──────────────────────────────────────────────────────── */

function DeleteConfirm({
  title,
  label,
  certCount,
  subCount,
  isIndustry,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  certCount: number;
  subCount: number;
  isIndustry: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="ind-modal-overlay" onClick={onCancel}>
      <div className="ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <h3 className="ind-modal-title">{title}</h3>
          <button className="ind-modal-close" aria-label="Close" onClick={onCancel}>
            <SmallXIcon />
          </button>
        </div>
        <div className="ind-modal-body">
          <p className="ind-modal-text">
            Delete <strong>{label}</strong>? This can't be undone.
          </p>
          <ul className="ind-modal-list">
            {isIndustry && subCount > 0 && (
              <li>
                All <strong>{subCount}</strong> Sub-{subCount === 1 ? "Industry" : "Industries"} under it will also be deleted.
              </li>
            )}
            {certCount > 0 ? (
              <li>
                <strong>{certCount}</strong> tagged Certification{certCount === 1 ? "" : "s"}{" "}
                will lose this tag. The Certifications themselves stay published — they just won't appear under this {isIndustry ? "Industry" : "Sub-Industry"} anymore.
              </li>
            ) : (
              <li>No Certifications are currently tagged here.</li>
            )}
          </ul>
        </div>
        <div className="ind-modal-foot">
          <button className="ind-btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="ind-btn-danger" onClick={onConfirm}>
            Delete {isIndustry ? "Industry" : "Sub-Industry"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add certifications modal ────────────────────────────────────────────── */

function AddCertsModal({
  scope,
  industryName,
  subName,
  alreadyAtScope,
  tagsForCert,
  onAdd,
  onClose,
}: {
  scope: Scope;
  industryName: string;
  subName?: string;
  alreadyAtScope: Set<string>;
  tagsForCert: (id: string) => { industryName: string; subName?: string }[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<CareerStage | "All">("All");
  const [tagFilter, setTagFilter] = useState<"All" | "Untagged" | "Tagged">("All");
  const [timeFilter, setTimeFilter] = useState<"Any" | "Short" | "Medium" | "Long">("Any");
  // Map of certId -> selection order
  const [selected, setSelected] = useState<Map<string, number>>(new Map());

  const scopeLabel = subName
    ? `${industryName} › ${subName.toUpperCase()}`
    : `${industryName} (INDUSTRY-LEVEL)`;

  // Build the cert universe — names from data/industries.ts certPool
  const universe = useMemo(() => {
    return Object.values(allCertsById)
      .filter((c) => !c.name.startsWith("Placeholder Cert"))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universe.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (stageFilter !== "All" && c.stage !== stageFilter) return false;
      const tags = tagsForCert(c.id);
      if (tagFilter === "Tagged" && tags.length === 0) return false;
      if (tagFilter === "Untagged" && tags.length > 0) return false;
      if (timeFilter === "Short" && c.hours > 4) return false;
      if (timeFilter === "Medium" && (c.hours <= 4 || c.hours > 10)) return false;
      if (timeFilter === "Long" && c.hours <= 10) return false;
      return true;
    });
  }, [universe, query, stageFilter, tagFilter, timeFilter, tagsForCert]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        const removed = next.get(id)!;
        next.delete(id);
        // Re-number remaining selections after the removed slot
        for (const [k, v] of next) {
          if (v > removed) next.set(k, v - 1);
        }
      } else {
        next.set(id, next.size + 1);
      }
      return next;
    });
  }

  const selectedCount = selected.size;
  const selectedInOrder = useMemo(() => {
    return [...selected.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
  }, [selected]);

  return (
    <div className="ind-modal-overlay" onClick={onClose}>
      <div className="ind-modal ind-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <div className="ind-modal-eyebrow">
            ADDING TO · <span className="ind-modal-eyebrow-strong">{scopeLabel}</span>
          </div>
          <button className="ind-modal-close" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>
        <h3 className="ind-modal-title ind-modal-title--padded">Add Certifications</h3>

        <div className="ind-addcerts-search">
          <span className="search-icon"><SearchIcon /></span>
          <input
            autoFocus
            className="ind-addcerts-search-input"
            placeholder="Search Certifications by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="ind-addcerts-filters">
          <FilterPill
            label="Career stage"
            value={stageFilter}
            options={["All", ...CAREER_STAGES]}
            onChange={(v) => setStageFilter(v as CareerStage | "All")}
          />
          <FilterPill
            label="Industry tag"
            value={tagFilter}
            options={["All", "Tagged", "Untagged"]}
            onChange={(v) => setTagFilter(v as "All" | "Untagged" | "Tagged")}
          />
          <FilterPill
            label="Time"
            value={timeFilter === "Any" ? "Any" : timeFilter}
            options={["Any", "Short", "Medium", "Long"]}
            onChange={(v) => setTimeFilter(v as "Any" | "Short" | "Medium" | "Long")}
          />
          <button className="ind-filter-more">+ More filters</button>
          <div className="ind-addcerts-count">{filtered.length} Certifications</div>
        </div>

        <div className="ind-addcerts-list">
          {filtered.length === 0 ? (
            <div className="ind-addcerts-empty">No certifications match the current filters.</div>
          ) : (
            filtered.map((cert) => {
              const alreadyAdded = alreadyAtScope.has(cert.id);
              const order = selected.get(cert.id);
              const tags = tagsForCert(cert.id);
              return (
                <button
                  key={cert.id}
                  className={`ind-addcerts-row ${order !== undefined ? "is-selected" : ""} ${alreadyAdded ? "is-disabled" : ""}`}
                  disabled={alreadyAdded}
                  onClick={() => !alreadyAdded && toggleSelect(cert.id)}
                >
                  <span className={`ind-addcerts-bullet ${order !== undefined ? "is-num" : ""} ${alreadyAdded ? "is-check" : ""}`}>
                    {alreadyAdded ? "✓" : order !== undefined ? order : ""}
                  </span>
                  <div className="ind-addcerts-meta">
                    <div className="ind-addcerts-name">{cert.name}</div>
                    <div className="ind-addcerts-sub">
                      {cert.stage} · {cert.hours} {cert.hours === 1 ? "hour" : "hours"}
                    </div>
                    <div className="ind-addcerts-tags">
                      {alreadyAdded ? (
                        <span className="ind-addcerts-tag-label ind-addcerts-tag-label--added">
                          Currently tagged in:
                        </span>
                      ) : tags.length > 0 ? (
                        <span className="ind-addcerts-tag-label">Currently tagged in:</span>
                      ) : (
                        <span className="ind-addcerts-tag-empty">No Industry tags yet</span>
                      )}
                      {tags.map((t, i) => (
                        <span key={`${cert.id}-tag-${i}`} className="ind-cert-tag">
                          {t.subName ? `${t.industryName} › ${t.subName}` : t.industryName}
                        </span>
                      ))}
                    </div>
                  </div>
                  {alreadyAdded && (
                    <span className="ind-addcerts-already">Already added</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="ind-modal-foot ind-modal-foot--addcerts">
          <div className="ind-addcerts-foot-text">
            <strong>{selectedCount} selected</strong>
            {selectedCount > 0 && (
              <span className="ind-addcerts-foot-sub">
                Will be added to <strong>{subName ? `${industryName} › ${subName}` : `${industryName} (Industry-level)`}</strong>{" "}
                in the order shown by the numbers. Click again to deselect.
              </span>
            )}
          </div>
          <div className="ind-addcerts-foot-actions">
            <button className="ind-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="ind-btn-primary"
              disabled={selectedCount === 0}
              onClick={() => onAdd(selectedInOrder)}
            >
              Add {selectedCount > 0 ? selectedCount : ""} Certification{selectedCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
      {void scope}
    </div>
  );
}

function FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="ind-filter-pill">
      <span className="ind-filter-pill-label">{label}:</span>
      <select
        className="ind-filter-pill-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="ind-filter-pill-caret">▾</span>
    </label>
  );
}

// Silence unused-var warnings for the cert type re-export
export type { IndustryCert };
