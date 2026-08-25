import { useMemo, useState } from "react";
import {
  industries as seedIndustries,
  allCertsById,
  type Industry,
  type SubIndustry,
  type CareerStage,
  type IndustryCert,
} from "../data/industries";
import { SearchIcon, SmallXIcon, DragHandleIcon, RowArrowIcon, CheckIcon, InfoFilledIcon, TreeCaretIcon, TreeKebabIcon, RowEditIcon, RowEyeIcon, RowEyeOffIcon, RowDeleteIcon, ChevronRightIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { PillTrigger } from "./Filters";
import { PageBreak } from "./PageBreak";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

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

/* Cert-row remove ✕ — Figma "Icon Library" (I318:1351;7:1802): a 6.6px cross
   centred in a 16px slot, 1.333 square-cap stroke. */
const RowCloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <path d="M4.7 4.7l6.6 6.6M11.3 4.7l-6.6 6.6" />
  </svg>
);

const CAREER_STAGES: CareerStage[] = ["Apprentice", "Journeyman", "Master"];

export function IndustriesPage({ onBackToCerts }: { onBackToCerts?: () => void }) {
  const [industries, setIndustries] = useState<Industry[]>(seedIndustries);
  const [scope, setScope] = useState<Scope>({ kind: "industry", industryKey: "hvac" });
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["hvac"]));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [menu, setMenu] = useState<MenuState>(null);

  // "C" opens Add Certification for whatever scope is selected; "I" opens the
  // rail's Add Industry (both badges are shown on their buttons).
  useCreateShortcut(
    () => setModal({ kind: "add-certs", scope }),
    modal.kind === "none",
  );
  useCreateShortcut(
    () => setModal({ kind: "new-industry" }),
    modal.kind === "none",
    "i",
  );

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

  const currentHidden =
    scope.kind === "industry" ? !!currentIndustry.hidden : !!currentSub?.hidden;

  const orderedCurrentSubs = [...currentIndustry.subIndustries].sort(
    (a, b) => a.displayPosition - b.displayPosition,
  );

  return (
    <div className="main">
      <div className="workspace">
        <div className="ind-page">
          {/* ─── Left rail ─── */}
          <aside className="rail">
            <div className="rail-head">
              {/* This page is reached from the Certifications header button (it
                  no longer has its own sidebar entry), so the crumb is the way back. */}
              <nav className="rvc-crumbs ind-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Content</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={onBackToCerts} title="Back to Certifications">
                  Certifications
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Industries</span>
              </nav>
              <h1 className="tasks-title">Industries</h1>
              <div className="rail-desc">
                Learners and Companies browse content by Industry
                <span
                  className="rail-info"
                  tabIndex={0}
                  role="note"
                  aria-label="About Industries"
                  data-tooltip={`Placeholder copy — ${industries.length} Industries and ${totalSubIndustries} Sub-Industries make up the browse tree learners see in the app.`}
                >
                  <InfoFilledIcon />
                </span>
              </div>
            </div>

            <div className="rail-search">
              <span className="search-icon"><SearchIcon /></span>
              <input
                className="search-input"
                placeholder="Search Industries, Sub-Industries, Certifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <PageBreak
              label={`${industries.length} Industries · ${totalSubIndustries} Sub-Industries`}
            />

            <div className="tree">
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
            </div>

            <div className="rail-foot">
              <button
                className="cta-primary"
                onClick={() => setModal({ kind: "new-industry" })}
              >
                Add Industry
                <span className="cta-kbd">I</span>
              </button>
              <div className="rail-hint">
                Drag ⠿ to reorder · Select an Industry/Sub-Industry to manage
                Certifications
              </div>
            </div>
          </aside>

          {/* ─── Detail pane ─── */}
          <section className="ind-detail">
            <header className="ind-detail-head">
              <div className="ind-detail-titleblock">
                <div className="ind-detail-toprow">
                  <h2 className="tasks-title ind-detail-title">
                    {scope.kind === "industry"
                      ? currentIndustry.name
                      : currentSub?.name ?? "—"}
                  </h2>
                  {currentHidden && (
                    <span className="ind-hidden-pill">Hidden</span>
                  )}
                </div>
              </div>
            </header>

            <div className="ind-section">
              <div className="ind-sec-head">
                <h3 className="ind-sec-title">
                  Certifications in “
                  {scope.kind === "industry"
                    ? currentIndustry.name
                    : currentSub?.name ?? "—"}
                  ”
                </h3>
                <button
                  className="cta-primary"
                  onClick={() => setModal({ kind: "add-certs", scope })}
                >
                  Add Certification
                  <span className="cta-kbd">C</span>
                </button>
              </div>
              <CertList
                certIds={scopeCertIds}
                onReorder={reorderCertsInScope}
                onRemove={removeCertFromScope}
              />
            </div>

            {scope.kind === "industry" && orderedCurrentSubs.length > 0 && (
              <div className="ind-section">
                <h3 className="ind-sec-title">
                  Sub-Industries in “{currentIndustry.name}”
                </h3>
                <div className="ind-subcards">
                  {orderedCurrentSubs.map((sub) => {
                    // Up to four certs are listed in full; only a fifth and
                    // beyond collapse into "+ N MORE".
                    const names = sub.certIds
                      .map((id) => allCertsById[id]?.name)
                      .filter((n): n is string => !!n);
                    const shown = names.slice(0, 4);
                    const more = sub.certIds.length - shown.length;
                    return (
                      <button
                        key={sub.key}
                        className="ind-subcard"
                        onClick={() => {
                          pickSub(currentIndustry.key, sub.key);
                          setOpenIds((prev) => new Set([...prev, currentIndustry.key]));
                        }}
                      >
                        <span className="ind-subcard-body">
                          <span className="ind-subcard-head">
                            <span className="ind-subcard-name">{sub.name}</span>
                            <span className="ind-subcard-count">
                              · {sub.certIds.length} certification
                              {sub.certIds.length === 1 ? "" : "s"}
                            </span>
                            {sub.hidden && (
                              <span className="ind-hidden-pill">Hidden</span>
                            )}
                          </span>
                          <span className="ind-subcard-list">
                            <span className="ind-subcard-items">
                              {shown.map((n) => (
                                <span key={n} className="ind-subcard-item">{n}</span>
                              ))}
                            </span>
                            {/* Figma keeps this line as a spacer when nothing
                                overflows, so the cards stay the same height. */}
                            <span className={`ind-subcard-more ${more > 0 ? "" : "is-empty"}`}>
                              + {more} more
                            </span>
                          </span>
                        </span>
                        <span className="ind-subcard-arrow">
                          <RowArrowIcon />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </section>
        </div>
      </div>

      {/* ─── Row 3-dot menu ─── */}
      {menu && (
        <>
          <div className="ind-menu-backdrop" onClick={() => setMenu(null)} />
          <div
            className="u-menu ind-row-menu"
            style={{ top: menu.y + 6, left: menu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="u-menu-item"
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
              <span className="u-menu-item-icon"><RowEditIcon /></span> Edit
            </button>
            <button
              className="u-menu-item"
              onClick={() => {
                if (menu.scope.kind === "industry") {
                  toggleIndustryHidden(menu.scope.industryKey);
                } else {
                  toggleSubHidden(menu.scope.industryKey, menu.scope.subKey);
                }
                setMenu(null);
              }}
            >
              <span className="u-menu-item-icon">
                {menuIsHidden ? <RowEyeIcon /> : <RowEyeOffIcon />}
              </span>{" "}
              {menuIsHidden ? "Show" : "Hide"}
            </button>
            <button
              className="u-menu-item u-menu-item--danger"
              onClick={() => {
                setModal({ kind: "delete-confirm", scope: menu.scope });
                setMenu(null);
              }}
            >
              <span className="u-menu-item-icon"><RowDeleteIcon /></span> Delete
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
    <div className="tree-group">
      <div
        className={`tree-row ${industryActive ? "is-active" : ""} ${ind.hidden ? "is-hidden-item" : ""} ${isOver ? "is-drop-over" : ""}`}
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
          className={`tree-drag ${canDrag ? "" : "is-disabled"}`}
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
          className={`tree-caret-btn ${isOpen ? "is-open" : ""}`}
          onClick={onToggle}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <TreeCaretIcon />
        </button>
        <button className="tree-main" onClick={onPickIndustry}>
          <span className="tree-row-label">{ind.name}</span>
          {ind.hidden && <span className="ind-hidden-pill">Hidden</span>}
          <span className="tree-row-count">{totalCerts}</span>
        </button>
        <button
          className="tree-menu-btn"
          aria-label="Industry options"
          onClick={(e) => onMenu(e, { kind: "industry", industryKey: ind.key })}
        >
          <TreeKebabIcon />
        </button>
      </div>

      {isOpen && (
        <div className="tree-sublist">
          {orderedSubs.length > 0 && (
            <div className="tree-sublist-rows">
              {orderedSubs.map((sub) => (
                <SubRow
                  key={sub.key}
                  sub={sub}
                  industryKey={ind.key}
                  parentHidden={!!ind.hidden}
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
            </div>
          )}
          <button className="tree-add" onClick={onAddSub}>
            Add Sub-Industry
          </button>
        </div>
      )}
    </div>
  );
}

function SubRow({
  sub,
  industryKey,
  parentHidden,
  active,
  canDrag,
  orderedSubs,
  onPick,
  onMenu,
  onReorderSubs,
}: {
  sub: SubIndustry;
  industryKey: string;
  parentHidden: boolean;
  active: boolean;
  canDrag: boolean;
  orderedSubs: SubIndustry[];
  onPick: () => void;
  onMenu: (e: React.MouseEvent, scope: Scope) => void;
  onReorderSubs: (orderedKeys: string[]) => void;
}) {
  // A hidden Industry hides its Sub-Industries too: they take the hidden
  // colour, but only an explicitly hidden Sub carries the pill.
  const isHidden = sub.hidden || parentHidden;
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
      className={`tree-sub-row ${active ? "is-active" : ""} ${isHidden ? "is-hidden-item" : ""} ${isOver ? "is-drop-over" : ""}`}
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
        className={`tree-sub-drag ${canDrag ? "" : "is-disabled"}`}
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData(dragType, sub.key);
        }}
        aria-hidden
      >
        <DragHandleIcon />
      </span>
      <button className="tree-sub-main" onClick={onPick}>
        <span className="tree-sub-row-label">{sub.name}</span>
        {sub.hidden && !parentHidden && <span className="ind-hidden-pill">Hidden</span>}
        <span className="tree-sub-row-count">{sub.certIds.length}</span>
      </button>
      <button
        className="tree-menu-btn tree-sub-menu-btn"
        aria-label="Sub-Industry options"
        onClick={(e) => onMenu(e, { kind: "sub", industryKey, subKey: sub.key })}
      >
        <TreeKebabIcon />
      </button>
    </div>
  );
}

/* ─── Cert list (with drag-to-reorder) ────────────────────────────────────── */

function CertList({
  certIds,
  onReorder,
  onRemove,
}: {
  certIds: string[];
  onReorder: (next: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  if (certIds.length === 0) {
    return (
      <div className="u-empty ind-cert-empty">
        <div className="ind-cert-empty-title">No certifications tagged here yet</div>
        <div className="ind-cert-empty-sub">
          Use <strong>Add Certifications</strong> to attach existing certifications.
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
    <div className="ind-certtable">
      {certIds.map((id, idx) => {
        const cert = allCertsById[id];
        if (!cert) return null;
        const isDragging = dragIdx === idx;
        const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
        return (
          <div
            key={id}
            className={`ind-ct-row ${isDragging ? "is-dragging" : ""} ${isOver ? "is-over" : ""}`}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={onDrop}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
          >
            <span className="ind-ct-drag" title="Drag to reorder" aria-hidden>
              <DragHandleIcon />
            </span>
            <span className="ind-ct-num">{idx + 1}</span>
            <span className="ind-ct-cell">
              <span className="ind-ct-name">{cert.name}</span>
              <span className="ind-ct-sub">
                {cert.stage} · {cert.hours} {cert.hours === 1 ? "hour" : "hours"}
              </span>
            </span>
            <button
              className="ind-ct-x"
              aria-label="Remove from this Industry"
              title="Remove from this Industry"
              onClick={() => onRemove(id)}
            >
              <RowCloseIcon />
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
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-modal ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h3 className="pm-title">{title}</h3>
          <p className="pm-sub">{nameHelp}</p>
        </div>
        <div className="pm-body">
          <div className="form-group">
            <label className="form-label">
              {nameLabel} <span className="req">*</span>
            </label>
            <div className="lang-field">
              <div className="lang-field-row">
                <span className="lang-tag">EN</span>
                <input
                  autoFocus
                  className="lang-field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Solar & Renewables"
                />
              </div>
              <div className="lang-field-divider" />
              <div className="lang-field-row">
                <span className="lang-tag">ES</span>
                <input
                  className="lang-field-input"
                  value={nameEs}
                  onChange={(e) => setNameEs(e.target.value)}
                  placeholder="Solar y Energías Renovables"
                />
              </div>
            </div>
            {isDuplicate ? (
              <div className="pm-error">
                A {nameLabel.toLowerCase()} with this name already exists.
              </div>
            ) : (
              <div className="form-help">
                Spanish is optional — it falls back to the English name.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Visibility</label>
            <div className="tab-switch">
              <button
                className={`tab-switch-tab ${hidden ? "" : "active"}`}
                onClick={() => setHidden(false)}
              >
                Visible
              </button>
              <button
                className={`tab-switch-tab ${hidden ? "active" : ""}`}
                onClick={() => setHidden(true)}
              >
                Hidden
              </button>
            </div>
            <div className="form-help">
              {hidden
                ? "Won't appear to learners browsing the catalog."
                : "Appears to learners browsing the catalog."}
            </div>
          </div>
        </div>
        <div className="pm-foot">
          <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
          <button
            className="btn-publish"
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
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-modal ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h3 className="pm-title">{title}</h3>
          <p className="pm-sub">
            Delete <strong>{label}</strong>? This can't be undone.
          </p>
        </div>
        <div className="pm-body">
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
        <div className="pm-foot">
          <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
          <button className="btn-publish btn-publish--danger" onClick={onConfirm}>
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
    ? `${industryName} › ${subName}`
    : `${industryName} (Industry-level)`;

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

  const hasFilters =
    stageFilter !== "All" || tagFilter !== "All" || timeFilter !== "Any";

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal ind-addcerts" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head ind-addcerts-head">
          <div>
            <h3 className="pm-title">Add Certifications</h3>
            <p className="pm-sub">
              Adding to <strong>{scopeLabel}</strong>
            </p>
          </div>
          <button className="ind-icon-btn" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>

        <div className="ind-addcerts-controls">
          <div className="search-wrap ind-addcerts-search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              autoFocus
              className="search-input"
              placeholder="Search Certifications"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="filters ind-addcerts-filters">
            <SelectPill
              label="Career Stage"
              value={stageFilter}
              blank="All"
              options={["All", ...CAREER_STAGES]}
              onChange={(v) => setStageFilter(v as CareerStage | "All")}
            />
            <SelectPill
              label="Industry Tag"
              value={tagFilter}
              blank="All"
              options={["All", "Tagged", "Untagged"]}
              onChange={(v) => setTagFilter(v as "All" | "Untagged" | "Tagged")}
            />
            <SelectPill
              label="Time"
              value={timeFilter}
              blank="Any"
              options={["Any", "Short", "Medium", "Long"]}
              onChange={(v) => setTimeFilter(v as "Any" | "Short" | "Medium" | "Long")}
            />
            {hasFilters && (
              <button
                className="filter-clear-link"
                onClick={() => {
                  setStageFilter("All");
                  setTagFilter("All");
                  setTimeFilter("Any");
                }}
              >
                Clear Filters
              </button>
            )}
            <div className="filters-end ind-addcerts-count">
              {filtered.length} Certifications
            </div>
          </div>
        </div>

        <div className="ind-addcerts-list">
          {filtered.length === 0 ? (
            <div className="u-empty">No certifications match the current filters.</div>
          ) : (
            filtered.map((cert) => {
              const alreadyAdded = alreadyAtScope.has(cert.id);
              const order = selected.get(cert.id);
              const tags = tagsForCert(cert.id);
              return (
                <button
                  key={cert.id}
                  className={`ind-ct-row ind-addcerts-row ${order !== undefined ? "is-selected" : ""} ${alreadyAdded ? "is-disabled" : ""}`}
                  disabled={alreadyAdded}
                  onClick={() => !alreadyAdded && toggleSelect(cert.id)}
                >
                  <span
                    className={`checkbox ind-addcerts-box ${order !== undefined || alreadyAdded ? "checked" : ""}`}
                  >
                    {alreadyAdded ? <CheckIcon /> : order !== undefined ? order : null}
                  </span>
                  <span className="ind-ct-cell">
                    <span className="ind-ct-name">{cert.name}</span>
                    <span className="ind-ct-sub">
                      {cert.stage} · {cert.hours} {cert.hours === 1 ? "hour" : "hours"}
                    </span>
                  </span>
                  <span className="ind-addcerts-tags">
                    {tags.length > 0 ? (
                      tags.map((t, i) => (
                        <span
                          key={`${cert.id}-tag-${i}`}
                          className="co-status-pill co-status-pill--secondary"
                        >
                          {t.subName ? `${t.industryName} › ${t.subName}` : t.industryName}
                        </span>
                      ))
                    ) : (
                      <span className="ind-ct-plain">No industry tags yet</span>
                    )}
                  </span>
                  {alreadyAdded && (
                    <span className="co-status-pill co-status-pill--green">Already added</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="pm-foot ind-addcerts-foot">
          <div className="ind-addcerts-foot-text">
            <strong>{selectedCount} selected</strong>
            {selectedCount > 0 && (
              <span className="ind-addcerts-foot-sub">
                Added to{" "}
                <strong>
                  {subName ? `${industryName} › ${subName}` : `${industryName} (Industry-level)`}
                </strong>{" "}
                in the order shown. Click a row again to deselect.
              </span>
            )}
          </div>
          <div className="ind-addcerts-foot-actions">
            <button className="btn-save-draft" onClick={onClose}>Cancel</button>
            <button
              className="btn-publish"
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

/* Single-select filter pill on the shared Dropdown + PillTrigger chrome.
   `blank` is the value that counts as "no filter applied". */
function SelectPill({
  label,
  value,
  blank,
  options,
  onChange,
}: {
  label: string;
  value: string;
  blank: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          value={value === blank ? null : value}
          open={open}
          toggle={toggle}
          onClear={() => onChange(blank)}
        />
      )}
    >
      {({ close }) => (
        <div className="dropdown-list">
          {options.map((o) => (
            <button
              key={o}
              className="dropdown-item"
              onClick={() => {
                onChange(o);
                close();
              }}
            >
              <span className={`checkbox ${o === value ? "checked" : ""}`}>
                {o === value && <CheckIcon />}
              </span>
              {o}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

// Silence unused-var warnings for the cert type re-export
export type { IndustryCert };
