import { useEffect, useMemo, useRef, useState } from "react";
import {
  industries as seedIndustries,
  allCertsById,
  type Industry,
  type SubIndustry,
  type CareerStage,
  type IndustryCert,
} from "../data/industries";
import {
  SearchIcon,
  SmallXIcon,
  DragHandleIcon,
  CheckIcon,
  TreeAddIcon,
  TreeKebabIcon,
  RowKebabIcon,
  RowEditIcon,
  RowEyeIcon,
  RowEyeOffIcon,
  RowDeleteIcon,
  ChevronRightIcon,
} from "./icons";
import { SearchTrailing } from "./SearchPanelParts";
import { Dropdown } from "./Dropdown";
import { PillTrigger } from "./Filters";
import { SectionHeading } from "./SectionHeading";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

/* Industries — Claude Design "Industries · Launcher + Hub" (2a / 4a).
   The page opens as a LAUNCHER: a centred, keyboard-driven search over the
   industries ("Where to?"), one row per industry with its certification count,
   and "+ New industry" at the foot. Picking a row lands on the industry's HUB:
   its sub-industries as door cards, then the core certifications tagged at the
   industry level. A sub-industry opens the same hub shape one level down.
   Left rail + tree retired here (the shared `.rail`/`.tree` chrome stays for
   the Question Bank). */

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

/* One row of the launcher list. Without a query it is an industry; with one,
   sub-industries ("HVAC › Residential") and certifications join the results,
   each opening the scope it lives in. */
type LaunchItem =
  | { kind: "industry"; key: string; industry: Industry; count: number }
  | { kind: "sub"; key: string; industry: Industry; sub: SubIndustry }
  | { kind: "cert"; key: string; cert: IndustryCert; scope: Scope; where: string };

/* Cert-row remove ✕ — Figma "Icon Library" (I318:1351;7:1802): a 6.6px cross
   centred in a 16px slot, 1.333 square-cap stroke. */
const RowCloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <path d="M4.7 4.7l6.6 6.6M11.3 4.7l-6.6 6.6" />
  </svg>
);

const CAREER_STAGES: CareerStage[] = ["Apprentice", "Journeyman", "Master"];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const industryCertTotal = (ind: Industry) =>
  ind.certIds.length + ind.subIndustries.reduce((n, s) => n + s.certIds.length, 0);

export function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>(seedIndustries);
  // `null` is the launcher; a scope is the hub for that industry / sub-industry.
  const [scope, setScope] = useState<Scope | null>(null);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(0);
  /* The highlight is only DRAWN while a row is actually being driven — hovered
     ("pointer") or walked with the arrows ("keyboard") — or while a query is
     up, where the top hit is the ↵ target. At rest the list carries no
     selection, so an idle launcher never looks like something is hovered. */
  const [navMode, setNavMode] = useState<"idle" | "pointer" | "keyboard">("idle");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [menu, setMenu] = useState<MenuState>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const quiet = modal.kind === "none" && !menu;

  // "C" opens Add Certification on the hub; "I" opens New Industry on the
  // launcher (both badges are printed on their controls).
  useCreateShortcut(
    () => scope && setModal({ kind: "add-certs", scope }),
    quiet && scope !== null,
  );
  useCreateShortcut(
    () => setModal({ kind: "new-industry" }),
    quiet && scope === null,
    "i",
  );

  const orderedIndustries = useMemo(
    () => [...industries].sort((a, b) => a.displayPosition - b.displayPosition),
    [industries],
  );

  const totalSubIndustries = useMemo(
    () => industries.reduce((n, i) => n + i.subIndustries.length, 0),
    [industries],
  );

  // ─── Launcher results ─────────────────────────────────────────────────────
  const launchItems = useMemo<LaunchItem[]>(() => {
    const q = search.trim().toLowerCase();
    const out: LaunchItem[] = [];
    if (!q) {
      orderedIndustries.forEach((industry) =>
        out.push({ kind: "industry", key: industry.key, industry, count: industryCertTotal(industry) }),
      );
      return out;
    }
    const hit = (s?: string) => !!s && s.toLowerCase().includes(q);
    orderedIndustries.forEach((industry) => {
      if (hit(industry.name) || hit(industry.nameEs)) {
        out.push({ kind: "industry", key: industry.key, industry, count: industryCertTotal(industry) });
      }
    });
    orderedIndustries.forEach((industry) =>
      [...industry.subIndustries]
        .sort((a, b) => a.displayPosition - b.displayPosition)
        .forEach((sub) => {
          if (hit(sub.name) || hit(sub.nameEs)) out.push({ kind: "sub", key: sub.key, industry, sub });
        }),
    );
    // A certification opens the first scope it is tagged in.
    const seen = new Set<string>();
    orderedIndustries.forEach((industry) => {
      const consider = (id: string, sc: Scope, where: string) => {
        const cert = allCertsById[id];
        if (!cert || seen.has(id) || !hit(cert.name)) return;
        seen.add(id);
        out.push({ kind: "cert", key: `cert-${id}`, cert, scope: sc, where });
      };
      industry.certIds.forEach((id) =>
        consider(id, { kind: "industry", industryKey: industry.key }, industry.name),
      );
      industry.subIndustries.forEach((sub) =>
        sub.certIds.forEach((id) =>
          consider(
            id,
            { kind: "sub", industryKey: industry.key, subKey: sub.key },
            `${industry.name} › ${sub.name}`,
          ),
        ),
      );
    });
    return out.slice(0, 40);
  }, [orderedIndustries, search]);

  // The highlight goes back to the top on every new query, which also drops
  // any pointer/keyboard mode — the top hit is the ↵ target from there.
  useEffect(() => {
    setCursor(0);
    setNavMode("idle");
  }, [search]);
  /* Clamped on READ, not through an effect: a shrinking result list and the
     query's own reset-to-0 would otherwise be two writes racing in the same
     commit, and the clamp (running on the pre-reset cursor) won — typing left
     the highlight on the last row instead of the top hit. */
  const activeIdx = Math.min(cursor, Math.max(0, launchItems.length - 1));
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(".ind-launch-row.is-active")
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, scope]);

  // Coming back to the launcher: fresh search, focus in the bar, no selection.
  useEffect(() => {
    if (scope === null) {
      searchRef.current?.focus();
      setNavMode("idle");
    }
  }, [scope]);

  const showActive = navMode !== "idle" || !!search.trim();

  function openItem(item: LaunchItem) {
    const next: Scope =
      item.kind === "industry"
        ? { kind: "industry", industryKey: item.industry.key }
        : item.kind === "sub"
          ? { kind: "sub", industryKey: item.industry.key, subKey: item.sub.key }
          : item.scope;
    setSearch("");
    setScope(next);
  }

  // ↑↓ walk the launcher, ↵ opens the highlighted row, Esc clears the query.
  useEffect(() => {
    if (scope !== null || !quiet) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const inField =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inField && t !== searchRef.current) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        // The first ↓ from an unselected list lands on the top row, not the second.
        setCursor(showActive ? Math.min(launchItems.length - 1, activeIdx + 1) : 0);
        setNavMode("keyboard");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor(showActive ? Math.max(0, activeIdx - 1) : 0);
        setNavMode("keyboard");
      } else if (e.key === "Enter") {
        // Nothing is highlighted at rest, so ↵ has no target until the list is
        // being driven — it never opens a row the eye can't see.
        const item = showActive ? launchItems[activeIdx] : null;
        if (!item) return;
        e.preventDefault();
        openItem(item);
      } else if (e.key === "Escape" && search) {
        e.preventDefault();
        setSearch("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, quiet, launchItems, activeIdx, search, showActive]);

  const currentIndustry = scope
    ? industries.find((i) => i.key === scope.industryKey) ?? null
    : null;
  const currentSub =
    scope?.kind === "sub" && currentIndustry
      ? currentIndustry.subIndustries.find((s) => s.key === scope.subKey) ?? null
      : null;

  // A scope whose target was deleted from under it falls back to the launcher.
  useEffect(() => {
    if (scope && (!currentIndustry || (scope.kind === "sub" && !currentSub))) setScope(null);
  }, [scope, currentIndustry, currentSub]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  function addIndustry(name: string, nameEs: string, hidden: boolean) {
    const key = `i-${Date.now()}`;
    setIndustries((prev) => [
      ...prev,
      {
        key,
        name,
        nameEs: nameEs || undefined,
        hidden,
        displayPosition: prev.length + 1,
        certIds: [],
        subIndustries: [],
      },
    ]);
    // A new industry opens straight into its (empty) hub.
    setSearch("");
    setScope({ kind: "industry", industryKey: key });
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
    setScope(null);
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

  function updateScopeCerts(sc: Scope, fn: (ids: string[]) => string[]) {
    setIndustries((prev) =>
      prev.map((i) => {
        if (i.key !== sc.industryKey) return i;
        if (sc.kind === "industry") return { ...i, certIds: fn(i.certIds) };
        return {
          ...i,
          subIndustries: i.subIndustries.map((s) =>
            s.key === sc.subKey ? { ...s, certIds: fn(s.certIds) } : s,
          ),
        };
      }),
    );
  }

  // ─── Where is a cert currently tagged? ────────────────────────────────────
  function tagsForCert(certId: string): { industryName: string; subName?: string }[] {
    const out: { industryName: string; subName?: string }[] = [];
    for (const ind of industries) {
      if (ind.certIds.includes(certId)) out.push({ industryName: ind.name });
      for (const sub of ind.subIndustries) {
        if (sub.certIds.includes(certId)) out.push({ industryName: ind.name, subName: sub.name });
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
    const sc = menu.scope;
    const ind = industries.find((i) => i.key === sc.industryKey);
    if (!ind) return false;
    if (sc.kind === "industry") return !!ind.hidden;
    return !!ind.subIndustries.find((s) => s.key === sc.subKey)?.hidden;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────
  const scopeCertIds = scope
    ? scope.kind === "industry"
      ? currentIndustry?.certIds ?? []
      : currentSub?.certIds ?? []
    : [];

  return (
    <div className="main">
      <div className="workspace">
        {scope === null || !currentIndustry ? (
          <Launcher
            industriesCount={industries.length}
            subCount={totalSubIndustries}
            search={search}
            onSearch={setSearch}
            searchRef={searchRef}
            listRef={listRef}
            items={launchItems}
            activeIndex={showActive ? activeIdx : -1}
            onHover={(idx) => {
              setCursor(idx);
              setNavMode("pointer");
            }}
            onLeaveList={() => setNavMode((m) => (m === "pointer" ? "idle" : m))}
            onOpen={openItem}
            onNewIndustry={() => setModal({ kind: "new-industry" })}
            onMenu={openMenu}
            onReorder={reorderIndustries}
          />
        ) : (
          <Hub
            industry={currentIndustry}
            sub={currentSub}
            certIds={scopeCertIds}
            onBackToLauncher={() => setScope(null)}
            onBackToIndustry={() =>
              setScope({ kind: "industry", industryKey: currentIndustry.key })
            }
            onAddCerts={() => setModal({ kind: "add-certs", scope })}
            onMenu={(e) => openMenu(e, scope)}
            onNewSub={() => setModal({ kind: "new-sub", industryKey: currentIndustry.key })}
            onOpenSub={(subKey) => setScope({ kind: "sub", industryKey: currentIndustry.key, subKey })}
            onReorderSubs={(keys) => reorderSubs(currentIndustry.key, keys)}
            onReorderCerts={(ids) => updateScopeCerts(scope, () => ids)}
            onRemoveCert={(id) => updateScopeCerts(scope, (ids) => ids.filter((c) => c !== id))}
          />
        )}
      </div>

      {/* ─── Row / header 3-dot menu ─── */}
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
                    : { kind: "edit-sub", industryKey: menu.scope.industryKey, subKey: menu.scope.subKey },
                );
                setMenu(null);
              }}
            >
              <span className="u-menu-item-icon"><RowEditIcon /></span> Edit
            </button>
            <button
              className="u-menu-item"
              onClick={() => {
                if (menu.scope.kind === "industry") toggleIndustryHidden(menu.scope.industryKey);
                else toggleSubHidden(menu.scope.industryKey, menu.scope.subKey);
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
        const sub = dScope.kind === "sub" ? ind.subIndustries.find((s) => s.key === dScope.subKey) : null;
        const label = isIndustry ? ind.name : `${ind.name} › ${sub?.name}`;
        const certCount = isIndustry ? industryCertTotal(ind) : sub?.certIds.length ?? 0;
        const subCount = isIndustry ? ind.subIndustries.length : 0;
        return (
          <DeleteConfirm
            title={`Delete ${isIndustry ? "Industry" : "Sub-Industry"}?`}
            label={label}
            certCount={certCount}
            subCount={subCount}
            isIndustry={isIndustry}
            onConfirm={() => {
              if (dScope.kind === "industry") deleteIndustry(dScope.industryKey);
              else deleteSub(dScope.industryKey, dScope.subKey);
              setModal({ kind: "none" });
            }}
            onCancel={() => setModal({ kind: "none" })}
          />
        );
      })()}

      {modal.kind === "add-certs" && (() => {
        const target = modal.scope;
        const ind = industries.find((i) => i.key === target.industryKey);
        if (!ind) return null;
        const sub = target.kind === "sub" ? ind.subIndustries.find((s) => s.key === target.subKey) : null;
        const already = target.kind === "industry" ? ind.certIds : sub?.certIds ?? [];
        return (
          <AddCertsModal
            industryName={ind.name}
            subName={sub?.name}
            alreadyAtScope={new Set(already)}
            tagsForCert={tagsForCert}
            onAdd={(ids) => {
              updateScopeCerts(target, (cur) => [...cur, ...ids]);
              setModal({ kind: "none" });
            }}
            onClose={() => setModal({ kind: "none" })}
          />
        );
      })()}
    </div>
  );
}

/* ─── Launcher (2a) ───────────────────────────────────────────────────────── */

function Launcher({
  industriesCount,
  subCount,
  search,
  onSearch,
  searchRef,
  listRef,
  items,
  activeIndex,
  onHover,
  onLeaveList,
  onOpen,
  onNewIndustry,
  onMenu,
  onReorder,
}: {
  industriesCount: number;
  subCount: number;
  search: string;
  onSearch: (q: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  listRef: React.RefObject<HTMLDivElement>;
  items: LaunchItem[];
  /** The row drawn as selected, or -1 while the list is idle. */
  activeIndex: number;
  onHover: (idx: number) => void;
  onLeaveList: () => void;
  onOpen: (item: LaunchItem) => void;
  onNewIndustry: () => void;
  onMenu: (e: React.MouseEvent, scope: Scope) => void;
  onReorder: (orderedKeys: string[]) => void;
}) {
  // Drag reordering is only safe against the full, unfiltered order.
  const canDrag = !search.trim();
  const [overKey, setOverKey] = useState<string | null>(null);
  const industryKeys = items
    .filter((i): i is Extract<LaunchItem, { kind: "industry" }> => i.kind === "industry")
    .map((i) => i.industry.key);

  function dropOn(e: React.DragEvent, toKey: string) {
    e.preventDefault();
    setOverKey(null);
    const fromKey = e.dataTransfer.getData("ind/industry");
    if (!fromKey || fromKey === toKey) return;
    const keys = [...industryKeys];
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, fromKey);
    onReorder(keys);
  }

  const q = search.trim();
  const noHits = q && items.length === 0;

  return (
    <div className="tasks ind-launch">
      {/* The page header the rest of the app runs, stripped to its title: no
          crumb trail (the landing IS the top of this page, and the sidebar's
          Certifications entry stays lit as the way back out) and no create CTA
          — "＋ New Industry" sits on the list header, where the Question Bank
          landing keeps its Add Category. */}
      <header className="tasks-header">
        <div className="rvc-pagehead">
          <h1 className="tasks-title">Industries</h1>
        </div>
      </header>

      {/* Figma 772:1192 "Search Bar - Large" — the Question Bank landing's hero
          bar: the shared .search-input at 56px across 70% of the page, ⌘K badge
          and all (App.tsx's ⌘K handler focuses the first visible .search-input). */}
      <div className="search-wrap ind-launch-search">
        <span className="search-icon"><SearchIcon /></span>
        <input
          ref={searchRef}
          autoFocus
          className="search-input"
          placeholder="Search Industries, Certifications..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <SearchTrailing active={!!search} onClear={() => onSearch("")} />
      </div>

      {/* List header — Figma 867:2473, the Question Bank landing's index head:
          the uppercase count label at one end and the ＋ add row at the other,
          over the group's 1px rule. */}
      <div className="ind-launch-head">
        <div className="ind-launch-head-row">
          <span className="ind-launch-head-label">
            {industriesCount} Industries · {subCount} Sub-Industries
          </span>
          <button className="qbl-index-add" onClick={onNewIndustry}>
            <span className="tree-add-icon"><TreeAddIcon /></span>
            New Industry
            <span className="cta-kbd">I</span>
          </button>
        </div>
      </div>

      <div className="ind-launch-list" ref={listRef} onMouseLeave={onLeaveList}>
          {noHits && <div className="ind-launch-empty">Nothing matches “{q}”</div>}
          {items.map((item, idx) => {
            const active = idx === activeIndex;
            if (item.kind === "industry") {
              const { industry, count } = item;
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={-1}
                  className={`ind-launch-row ${active ? "is-active" : ""} ${industry.hidden ? "is-hidden-item" : ""} ${overKey === industry.key ? "is-drop-over" : ""}`}
                  onMouseEnter={() => onHover(idx)}
                  onClick={() => onOpen(item)}
                  onDragOver={(e) => {
                    if (!canDrag || !e.dataTransfer.types.includes("ind/industry")) return;
                    e.preventDefault();
                    setOverKey(industry.key);
                  }}
                  onDragLeave={() => setOverKey(null)}
                  onDrop={(e) => dropOn(e, industry.key)}
                >
                  <span
                    className={`tree-drag ${canDrag ? "" : "is-disabled"}`}
                    draggable={canDrag}
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("ind/industry", industry.key);
                    }}
                    aria-hidden
                  >
                    <DragHandleIcon />
                  </span>
                  <span className="ind-launch-name">{industry.name}</span>
                  {industry.hidden && <span className="ind-hidden-pill">Hidden</span>}
                  <span className="ind-launch-count">{plural(count, "certification")}</span>
                  <button
                    className="tree-menu-btn"
                    aria-label="Industry options"
                    onClick={(e) => onMenu(e, { kind: "industry", industryKey: industry.key })}
                  >
                    <TreeKebabIcon />
                  </button>
                </div>
              );
            }
            if (item.kind === "sub") {
              const { industry, sub } = item;
              const hidden = !!(sub.hidden || industry.hidden);
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={-1}
                  className={`ind-launch-row ${active ? "is-active" : ""} ${hidden ? "is-hidden-item" : ""}`}
                  onMouseEnter={() => onHover(idx)}
                  onClick={() => onOpen(item)}
                >
                  <span className="tree-drag is-disabled" aria-hidden />
                  <span className="ind-launch-name">
                    <span className="ind-launch-parent">{industry.name} › </span>
                    {sub.name}
                  </span>
                  {sub.hidden && <span className="ind-hidden-pill">Hidden</span>}
                  <span className="ind-launch-count">{plural(sub.certIds.length, "certification")}</span>
                  <button
                    className="tree-menu-btn"
                    aria-label="Sub-Industry options"
                    onClick={(e) => onMenu(e, { kind: "sub", industryKey: industry.key, subKey: sub.key })}
                  >
                    <TreeKebabIcon />
                  </button>
                </div>
              );
            }
            return (
              <button
                key={item.key}
                className={`ind-launch-row ${active ? "is-active" : ""}`}
                onMouseEnter={() => onHover(idx)}
                onClick={() => onOpen(item)}
              >
                <span className="tree-drag is-disabled" aria-hidden />
                <span className="ind-launch-name">{item.cert.name}</span>
                <span className="ind-launch-count">in {item.where}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

/* ─── Hub (4a) — an industry, or a sub-industry one level down ────────────── */

function Hub({
  industry,
  sub,
  certIds,
  onBackToLauncher,
  onBackToIndustry,
  onAddCerts,
  onMenu,
  onNewSub,
  onOpenSub,
  onReorderSubs,
  onReorderCerts,
  onRemoveCert,
}: {
  industry: Industry;
  sub: SubIndustry | null;
  certIds: string[];
  /** Crumb targets: the launcher, and (from a sub) its parent industry. */
  onBackToLauncher: () => void;
  onBackToIndustry: () => void;
  onAddCerts: () => void;
  onMenu: (e: React.MouseEvent) => void;
  onNewSub: () => void;
  onOpenSub: (subKey: string) => void;
  onReorderSubs: (orderedKeys: string[]) => void;
  onReorderCerts: (ids: string[]) => void;
  onRemoveCert: (id: string) => void;
}) {
  const name = sub ? sub.name : industry.name;
  const hidden = sub ? !!(sub.hidden || industry.hidden) : !!industry.hidden;
  const orderedSubs = [...industry.subIndustries].sort(
    (a, b) => a.displayPosition - b.displayPosition,
  );
  const [overKey, setOverKey] = useState<string | null>(null);

  function dropOn(e: React.DragEvent, toKey: string) {
    e.preventDefault();
    setOverKey(null);
    const fromKey = e.dataTransfer.getData("ind/sub");
    if (!fromKey || fromKey === toKey) return;
    const keys = orderedSubs.map((s) => s.key);
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, fromKey);
    onReorderSubs(keys);
  }

  const subtitle = sub
    ? `${plural(sub.certIds.length, "certification")} · in ${industry.name}`
    : `${plural(industryCertTotal(industry), "certification")} · ${plural(industry.subIndustries.length, "sub-industry").replace("sub-industrys", "sub-industries")}`;

  return (
    <div className="tasks ind-hub">
      <div className="ind-hub-col">
        <header className="tasks-header ind-hub-head">
          <div className="rvc-pagehead">
            {/* The app's breadcrumb atom (.rvc-crumbs / .rvc-crumb), the same
                trail Awards and the Question Bank run: every step above the
                current one navigates, the last is the page itself. */}
            <nav className="rvc-crumbs" aria-label="Breadcrumb">
              <button
                className="rvc-crumb"
                onClick={onBackToLauncher}
                title="Back to Industries"
              >
                Industries
              </button>
              <ChevronRightIcon />
              {sub ? (
                <>
                  <button
                    className="rvc-crumb"
                    onClick={onBackToIndustry}
                    title={`Back to ${industry.name}`}
                  >
                    {industry.name}
                  </button>
                  <ChevronRightIcon />
                  <span className="rvc-crumb rvc-crumb--current">{sub.name}</span>
                </>
              ) : (
                <span className="rvc-crumb rvc-crumb--current">{industry.name}</span>
              )}
            </nav>
            <div className="ind-hub-toprow">
              <h1 className="tasks-title">{name}</h1>
              {hidden && <span className="ind-hidden-pill">Hidden</span>}
            </div>
            <div className="tasks-subtitle">{subtitle}</div>
          </div>
          <div className="tasks-header-actions">
            <button className="cta-primary" onClick={onAddCerts}>
              Add Certification
              <span className="cta-kbd">C</span>
            </button>
            <button
              className="cta-quiet cta-quiet--icon"
              aria-label={sub ? "Sub-Industry options" : "Industry options"}
              onClick={onMenu}
            >
              <RowKebabIcon />
            </button>
          </div>
        </header>

        {!sub && (
          <section className="ind-section">
            <SectionHeading
              label="Sub-Industries"
              trailing={
                <button className="qbl-index-add ind-sec-action" onClick={onNewSub}>
                  <span className="tree-add-icon"><TreeAddIcon /></span>
                  New Sub-Industry
                </button>
              }
            />
            {orderedSubs.length === 0 ? (
              <div className="ind-sec-empty">
                No sub-industries yet — every certification here is shown to every {industry.name} learner.
              </div>
            ) : (
              <div className="ind-subcards">
                {orderedSubs.map((s) => (
                  <button
                    key={s.key}
                    className={`ind-subcard ${overKey === s.key ? "is-drop-over" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("ind/sub", s.key);
                    }}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes("ind/sub")) return;
                      e.preventDefault();
                      setOverKey(s.key);
                    }}
                    onDragLeave={() => setOverKey(null)}
                    onDrop={(e) => dropOn(e, s.key)}
                    onClick={() => onOpenSub(s.key)}
                  >
                    <span className="ind-subcard-head">
                      <span className="ind-subcard-name">{s.name}</span>
                      <span className="ind-subcard-arrow"><ChevronRightIcon /></span>
                    </span>
                    <span className="ind-subcard-foot">
                      <span className="ind-subcard-count">{plural(s.certIds.length, "certification")}</span>
                      {s.hidden && <span className="ind-hidden-pill">Hidden</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="ind-section">
          <SectionHeading
            label={sub ? "Certifications" : "Core Certifications"}
            trailing={
              <>
                <span className="ind-sec-note">
                  · shown to {sub ? `${industry.name} › ${sub.name}` : `every ${industry.name}`} learner{sub ? "s" : ""}
                </span>
                <button className="qbl-index-add ind-sec-action ind-sec-action--end" onClick={onAddCerts}>
                  <span className="tree-add-icon"><TreeAddIcon /></span>
                  Add
                </button>
              </>
            }
          />
          <CertList certIds={certIds} onReorder={onReorderCerts} onRemove={onRemoveCert} />
        </section>
      </div>
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
          Use <strong>Add Certification</strong> to attach existing certifications.
        </div>
      </div>
    );
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
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(idx);
            }}
            onDrop={onDrop}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
          >
            <span className="ind-ct-drag" title="Drag to reorder" aria-hidden>
              <DragHandleIcon />
            </span>
            <span className="ind-ct-name">{cert.name}</span>
            <span className="ind-ct-meta">
              {cert.stage} · {cert.hours} {cert.hours === 1 ? "hr" : "hrs"}
            </span>
            <button
              className="ind-ct-x"
              aria-label="Remove from here"
              title="Remove from here"
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
  const isDuplicate = trimmed && existingNames.includes(trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  function submit() {
    if (!isValid) return;
    onSubmit(trimmed, nameEs.trim(), hidden);
  }

  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div
        className="pm-modal ind-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
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
                  onKeyDown={(e) => e.key === "Enter" && submit()}
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
                  onKeyDown={(e) => e.key === "Enter" && submit()}
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
          <button className="btn-publish" disabled={!isValid} onClick={submit}>
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
      <div className="pm-modal ind-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
  industryName,
  subName,
  alreadyAtScope,
  tagsForCert,
  onAdd,
  onClose,
}: {
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
      <div className="pm-modal ind-addcerts" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
