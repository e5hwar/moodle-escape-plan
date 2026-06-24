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
  | { kind: "edit-industry"; industryKey: string }
  | { kind: "edit-sub"; industryKey: string; subKey: string }
  | { kind: "delete-confirm"; scope: Scope }
  | { kind: "add-certs"; scope: Scope };

// Which row's 3-dot menu is open, plus where to anchor the popover.
type MenuState = { scope: Scope; x: number; y: number } | null;

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
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A9.5 9.5 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.3 4.1M6.1 6.1A17 17 0 002 12s3.6 7 10 7a9.6 9.6 0 003.9-.8" />
  </svg>
);

const CAREER_STAGES: CareerStage[] = ["Apprentice", "Journeyman", "Master"];

export function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>(seedIndustries);
  const [scope, setScope] = useState<Scope>({ kind: "industry", industryKey: "hvac" });
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["hvac"]));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [menu, setMenu] = useState<MenuState>(null);

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
        (i.nameEs ?? "").toLowerCase().includes(q) ||
        i.subIndustries.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [orderedIndustries, search]);

  // Drag reordering is only safe against the full, unfiltered order.
  const canDrag = !search.trim();

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
  }

  function pickSub(industryKey: string, subKey: string) {
    setScope({ kind: "sub", industryKey, subKey });
  }

  // ─── Mutations ────────────────────────────────────────────────────────────
  function addIndustry(name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) => {
      const key = `i-${Date.now()}`;
      const position = prev.length + 1;
      return [
        ...prev,
        {
          key,
          name,
          nameEs: nameEs || undefined,
          hidden,
          displayPosition: position,
          certIds: [],
          subIndustries: [],
        },
      ];
    });
  }

  function addSub(industryKey: string, name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const newSub: SubIndustry = {
          key: `s-${Date.now()}`,
          name,
          nameEs: nameEs || undefined,
          hidden,
          displayPosition: i.subIndustries.length + 1,
          certIds: [],
        };
        return { ...i, subIndustries: [...i.subIndustries, newSub] };
      }),
    );
    // Make sure the parent is expanded so the new Sub-Industry is visible.
    setOpenIds((prev) => new Set([...prev, industryKey]));
  }

  function editIndustry(key: string, name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, name, nameEs: nameEs || undefined, hidden } : i,
      ),
    );
  }

  function editSub(industryKey: string, subKey: string, name: string, nameEs: string, hidden: boolean) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === subKey ? { ...s, name, nameEs: nameEs || undefined, hidden } : s,
          ),
        };
      }),
    );
  }

  function toggleIndustryHidden(key: string) {
    setIndustries((prev) =>
      prev.map((i) => (i.key === key ? { ...i, hidden: !i.hidden } : i)),
    );
  }

  function toggleSubHidden(industryKey: string, subKey: string) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === subKey ? { ...s, hidden: !s.hidden } : s,
          ),
        };
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

  // Reorder the full industry list from a dragged ordering of keys.
  function reorderIndustries(orderedKeys: string[]) {
    setIndustries((prev) => {
      const byKey = new Map(prev.map((i) => [i.key, i]));
      return orderedKeys
        .map((k) => byKey.get(k))
        .filter((i): i is Industry => !!i)
        .map((i, idx) => ({ ...i, displayPosition: idx + 1 }));
    });
  }

  // Reorder Sub-Industries within a single Industry.
  function reorderSubs(industryKey: string, orderedKeys: string[]) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== industryKey) return i;
        const byKey = new Map(i.subIndustries.map((s) => [s.key, s]));
        const subs = orderedKeys
          .map((k) => byKey.get(k))
          .filter((s): s is SubIndustry => !!s)
          .map((s, idx) => ({ ...s, displayPosition: idx + 1 }));
        return { ...i, subIndustries: subs };
      }),
    );
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

  function alsoTaggedIn(certId: string): { industryName: string; subName?: string }[] {
    return tagsForCert(certId).filter((t) => {
      if (scope.kind === "industry") {
        return !(t.industryName === currentIndustry.name && !t.subName);
      }
      const sub = currentSub;
      return !(t.industryName === currentIndustry.name && t.subName === sub?.name);
    });
  }

  // ─── Menu ────────────────────────────────────────────────────────────────
  function openMenu(e: React.MouseEvent, menuScope: Scope) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ scope: menuScope, x: r.right, y: r.bottom });
  }

  const menuIsHidden = (() => {
    if (!menu) return false;
    const menuScope = menu.scope;
    const ind = industries.find((i) => i.key === menuScope.industryKey);
    if (!ind) return false;
    if (menuScope.kind === "industry") return !!ind.hidden;
    const sub = ind.subIndustries.find((s) => s.key === menuScope.subKey);
    return !!sub?.hidden;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────
  const scopeCertIds =
    scope.kind === "industry" ? currentIndustry.certIds : currentSub?.certIds ?? [];

  const currentIndustryTotalCerts =
    currentIndustry.certIds.length +
    currentIndustry.subIndustries.reduce((n, s) => n + s.certIds.length, 0);

  const currentHidden =
    scope.kind === "industry" ? !!currentIndustry.hidden : !!currentSub?.hidden;

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

            <div className="ind-tree">
              {filteredIndustries.map((ind) => (
                <IndustryTreeGroup
                  key={ind.key}
                  ind={ind}
                  isOpen={openIds.has(ind.key)}
                  scope={scope}
                  canDrag={canDrag}
                  orderedIndustries={orderedIndustries}
                  onToggle={() => toggleOpen(ind.key)}
                  onPickIndustry={() => pickIndustry(ind.key)}
                  onPickSub={(subKey) => pickSub(ind.key, subKey)}
                  onAddSub={() => setModal({ kind: "new-sub", industryKey: ind.key })}
                  onMenu={openMenu}
                  onReorderIndustries={reorderIndustries}
                  onReorderSubs={(orderedKeys) => reorderSubs(ind.key, orderedKeys)}
                />
              ))}

              {/* Add Industry sits under the last Industry in the list */}
              <button
                className="ind-rail-add"
                onClick={() => setModal({ kind: "new-industry" })}
              >
                + Add Industry
              </button>
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
                  {currentHidden && <span className="ind-hidden-badge">Hidden</span>}
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
                        ? { kind: "edit-industry", industryKey: scope.industryKey }
                        : {
                            kind: "edit-sub",
                            industryKey: scope.industryKey,
                            subKey: scope.subKey,
                          },
                    )
                  }
                >
                  <PencilIcon /> Edit
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

      {/* ─── Row 3-dot menu ─── */}
      {menu && (
        <>
          <div className="ind-menu-backdrop" onClick={() => setMenu(null)} />
          <div
            className="ind-row-menu"
            style={{ top: menu.y + 4, left: menu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ind-row-menu-item"
              onClick={() => {
                setModal(
                  menu.scope.kind === "industry"
                    ? { kind: "edit-industry", industryKey: menu.scope.industryKey }
                    : {
                        kind: "edit-sub",
                        industryKey: menu.scope.industryKey,
                        subKey: menu.scope.subKey,
                      },
                );
                setMenu(null);
              }}
            >
              <PencilIcon /> Edit
            </button>
            <button
              className="ind-row-menu-item"
              onClick={() => {
                if (menu.scope.kind === "industry") {
                  toggleIndustryHidden(menu.scope.industryKey);
                } else {
                  toggleSubHidden(menu.scope.industryKey, menu.scope.subKey);
                }
                setMenu(null);
              }}
            >
              {menuIsHidden ? <EyeIcon /> : <EyeOffIcon />}{" "}
              {menuIsHidden ? "Show" : "Hide"}
            </button>
            <div className="ind-row-menu-sep" />
            <button
              className="ind-row-menu-item ind-row-menu-item--danger"
              onClick={() => {
                setModal({ kind: "delete-confirm", scope: menu.scope });
                setMenu(null);
              }}
            >
              <TrashIcon /> Delete
            </button>
          </div>
        </>
      )}

      {/* ─── Modals ─── */}
      {modal.kind === "new-industry" && (
        <NameModal
          title="New Industry"
          nameLabel="Name"
          nameHelp="Must be unique across all Industries."
          defaultName=""
          defaultNameEs=""
          defaultHidden={false}
          existingNames={industries.map((i) => i.name.toLowerCase())}
          submitLabel="Create Industry"
          onSubmit={(name, nameEs, hidden) => {
            addIndustry(name, nameEs, hidden);
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
            nameHelp={`Must be unique within ${parent.name}. Can repeat across other Industries.`}
            defaultName=""
            defaultNameEs=""
            defaultHidden={false}
            existingNames={parent.subIndustries.map((s) => s.name.toLowerCase())}
            submitLabel="Create Sub-Industry"
            onSubmit={(name, nameEs, hidden) => {
              addSub(modal.industryKey, name, nameEs, hidden);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "edit-industry" && (() => {
        const ind = industries.find((i) => i.key === modal.industryKey);
        if (!ind) return null;
        return (
          <NameModal
            title="Edit Industry"
            nameLabel="Name"
            nameHelp="Must be unique across all Industries."
            defaultName={ind.name}
            defaultNameEs={ind.nameEs ?? ""}
            defaultHidden={!!ind.hidden}
            existingNames={industries
              .filter((i) => i.key !== modal.industryKey)
              .map((i) => i.name.toLowerCase())}
            submitLabel="Save"
            onSubmit={(name, nameEs, hidden) => {
              editIndustry(modal.industryKey, name, nameEs, hidden);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "edit-sub" && (() => {
        const parent = industries.find((i) => i.key === modal.industryKey);
        const sub = parent?.subIndustries.find((s) => s.key === modal.subKey);
        if (!parent || !sub) return null;
        return (
          <NameModal
            title={`Edit Sub-Industry in ${parent.name}`}
            nameLabel="Name"
            nameHelp={`Must be unique within ${parent.name}.`}
            defaultName={sub.name}
            defaultNameEs={sub.nameEs ?? ""}
            defaultHidden={!!sub.hidden}
            existingNames={parent.subIndustries
              .filter((s) => s.key !== modal.subKey)
              .map((s) => s.name.toLowerCase())}
            submitLabel="Save"
            onSubmit={(name, nameEs, hidden) => {
              editSub(modal.industryKey, modal.subKey, name, nameEs, hidden);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "delete-confirm" && (() => {
        const dScope = modal.scope;
        const ind = industries.find((i) => i.key === dScope.industryKey);
        if (!ind) return null;
        const isIndustry = dScope.kind === "industry";
        const sub =
          dScope.kind === "sub"
            ? ind.subIndustries.find((s) => s.key === dScope.subKey)
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
              if (dScope.kind === "industry") {
                deleteIndustry(dScope.industryKey);
              } else {
                deleteSub(dScope.industryKey, dScope.subKey);
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

/* ─── Industry tree group (draggable industry + its sub list) ──────────────── */

function IndustryTreeGroup({
  ind,
  isOpen,
  scope,
  canDrag,
  orderedIndustries,
  onToggle,
  onPickIndustry,
  onPickSub,
  onAddSub,
  onMenu,
  onReorderIndustries,
  onReorderSubs,
}: {
  ind: Industry;
  isOpen: boolean;
  scope: Scope;
  canDrag: boolean;
  orderedIndustries: Industry[];
  onToggle: () => void;
  onPickIndustry: () => void;
  onPickSub: (subKey: string) => void;
  onAddSub: () => void;
  onMenu: (e: React.MouseEvent, scope: Scope) => void;
  onReorderIndustries: (orderedKeys: string[]) => void;
  onReorderSubs: (orderedKeys: string[]) => void;
}) {
  const industryActive =
    scope.kind === "industry" && scope.industryKey === ind.key;
  const totalCerts =
    ind.certIds.length +
    ind.subIndustries.reduce((n, s) => n + s.certIds.length, 0);
  const [isOver, setIsOver] = useState(false);

  const orderedSubs = [...ind.subIndustries].sort(
    (a, b) => a.displayPosition - b.displayPosition,
  );

  function onIndustryDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsOver(false);
    const fromKey = e.dataTransfer.getData("ind/industry");
    if (!fromKey || fromKey === ind.key) return;
    const keys = orderedIndustries.map((i) => i.key);
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(ind.key);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, fromKey);
    onReorderIndustries(keys);
  }

  return (
    <div className="ind-tree-group">
      <div
        className={`ind-tree-row ${industryActive ? "is-active" : ""} ${ind.hidden ? "is-hidden-item" : ""} ${isOver ? "is-drop-over" : ""}`}
        onDragOver={(e) => {
          if (!canDrag) return;
          if (e.dataTransfer.types.includes("ind/industry")) {
            e.preventDefault();
            setIsOver(true);
          }
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onIndustryDrop}
      >
        <span
          className={`ind-tree-drag ${canDrag ? "" : "is-disabled"}`}
          draggable={canDrag}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("ind/industry", ind.key);
          }}
          aria-hidden
        >
          <DragHandleIcon />
        </span>
        <button
          className={`ind-tree-caret-btn ${isOpen ? "is-open" : ""}`}
          onClick={onToggle}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <CaretRightIcon />
        </button>
        <button className="ind-tree-main" onClick={onPickIndustry}>
          <span className="ind-tree-row-label">{ind.name}</span>
          {ind.hidden && <span className="ind-row-hidden-tag">Hidden</span>}
          <span className="ind-tree-row-count">{totalCerts}</span>
        </button>
        <button
          className="ind-tree-menu-btn"
          aria-label="Industry options"
          onClick={(e) => onMenu(e, { kind: "industry", industryKey: ind.key })}
        >
          <MoreDotsIcon />
        </button>
      </div>

      {isOpen && (
        <div className="ind-sublist">
          {orderedSubs.map((sub) => (
            <SubRow
              key={sub.key}
              sub={sub}
              industryKey={ind.key}
              active={
                scope.kind === "sub" &&
                scope.industryKey === ind.key &&
                scope.subKey === sub.key
              }
              canDrag={canDrag}
              orderedSubs={orderedSubs}
              onPick={() => onPickSub(sub.key)}
              onMenu={onMenu}
              onReorderSubs={onReorderSubs}
            />
          ))}
          <button className="ind-sub-add" onClick={onAddSub}>
            + Add Sub-Industry
          </button>
        </div>
      )}
    </div>
  );
}

function SubRow({
  sub,
  industryKey,
  active,
  canDrag,
  orderedSubs,
  onPick,
  onMenu,
  onReorderSubs,
}: {
  sub: SubIndustry;
  industryKey: string;
  active: boolean;
  canDrag: boolean;
  orderedSubs: SubIndustry[];
  onPick: () => void;
  onMenu: (e: React.MouseEvent, scope: Scope) => void;
  onReorderSubs: (orderedKeys: string[]) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  // Sub drags carry their parent key so they can't cross into another Industry.
  const dragType = `ind/sub/${industryKey}`;

  function onSubDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsOver(false);
    const fromKey = e.dataTransfer.getData(dragType);
    if (!fromKey || fromKey === sub.key) return;
    const keys = orderedSubs.map((s) => s.key);
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(sub.key);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, fromKey);
    onReorderSubs(keys);
  }

  return (
    <div
      className={`ind-sub-row ${active ? "is-active" : ""} ${sub.hidden ? "is-hidden-item" : ""} ${isOver ? "is-drop-over" : ""}`}
      onDragOver={(e) => {
        if (!canDrag) return;
        if (e.dataTransfer.types.includes(dragType)) {
          e.preventDefault();
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onSubDrop}
    >
      <span
        className={`ind-sub-drag ${canDrag ? "" : "is-disabled"}`}
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData(dragType, sub.key);
        }}
        aria-hidden
      >
        <DragHandleIcon />
      </span>
      <button className="ind-sub-main" onClick={onPick}>
        <span className="ind-sub-row-label">{sub.name}</span>
        {sub.hidden && <span className="ind-row-hidden-tag">Hidden</span>}
        <span className="ind-sub-row-count">{sub.certIds.length}</span>
      </button>
      <button
        className="ind-tree-menu-btn"
        aria-label="Sub-Industry options"
        onClick={(e) => onMenu(e, { kind: "sub", industryKey, subKey: sub.key })}
      >
        <MoreDotsIcon />
      </button>
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

/* ─── Name + translation + visibility modal ───────────────────────────────── */

function NameModal({
  title,
  nameLabel,
  nameHelp,
  defaultName,
  defaultNameEs,
  defaultHidden,
  existingNames,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  nameLabel: string;
  nameHelp: string;
  defaultName: string;
  defaultNameEs: string;
  defaultHidden: boolean;
  existingNames: string[];
  submitLabel: string;
  onSubmit: (name: string, nameEs: string, hidden: boolean) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [nameEs, setNameEs] = useState(defaultNameEs);
  const [hidden, setHidden] = useState(defaultHidden);

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
              {nameLabel} <span className="ind-field-flag">EN</span>{" "}
              <span className="ind-field-required">*</span>
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
            <span className="ind-field-label">
              {nameLabel} <span className="ind-field-flag">ES</span>
            </span>
            <input
              className="ind-field-input"
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value)}
              placeholder="e.g. Solar y Energías Renovables"
            />
            <span className="ind-field-help">
              Spanish translation shown to Spanish-locale learners. Optional — falls back to the English name.
            </span>
          </label>

          <div className="ind-toggle-field">
            <button
              type="button"
              className={`ind-toggle ${hidden ? "" : "is-on"}`}
              role="switch"
              aria-checked={!hidden}
              onClick={() => setHidden((h) => !h)}
            >
              <span className="ind-toggle-knob" />
            </button>
            <div className="ind-toggle-text">
              <span className="ind-toggle-title">
                {hidden ? "Hidden" : "Visible"}
              </span>
              <span className="ind-toggle-sub">
                {hidden
                  ? "Won't appear to learners browsing the catalog."
                  : "Appears to learners browsing the catalog."}
              </span>
            </div>
          </div>
        </div>
        <div className="ind-modal-foot">
          <button className="ind-btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="ind-btn-primary"
            disabled={!isValid}
            onClick={() => {
              if (!isValid) return;
              onSubmit(trimmed, nameEs.trim(), hidden);
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
