import { useState, useMemo, useRef } from 'react';
import type { GearCategory, GearItem } from '../../types';
import { useGear } from '../../hooks/useGear';
import { importCsv } from '../../api/gear';
import styles from './GearPage.module.css';

// ── CSV parser ────────────────────────────────────────────────────────────────
// Columns: Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable
const UNIT_TO_G: Record<string, number> = { gram: 1, ounce: 28.3495, oz: 28.3495, kg: 1000, lbs: 453.592 };

function parseCsv(text: string) {
  const lines = text.trim().split('\n');
  // skip header
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const name     = cols[0]?.trim() ?? '';
    const category = cols[1]?.trim() || 'Misc';
    const notes    = cols[2]?.trim() || undefined;
    const qty      = parseInt(cols[3]?.trim()) || 1;
    const weight   = parseFloat(cols[4]?.trim()) || 0;
    const unit     = cols[5]?.trim().toLowerCase() ?? 'gram';
    const worn     = cols[8]?.trim() === '1';
    const consumable = cols[9]?.trim() === '1';
    const weightG  = weight * (UNIT_TO_G[unit] ?? 1);
    return { name, category, weightG, qty, worn, consumable, notes };
  }).filter(r => r.name);
}

interface GearPageProps {
  isAdmin: boolean;
  onClose: () => void;
}

type WeightUnit = 'g' | 'kg' | 'lbs' | 'oz';
const UNITS: WeightUnit[] = ['g', 'kg', 'lbs', 'oz'];
const TO_G: Record<WeightUnit, number> = { g: 1, kg: 1000, lbs: 453.592, oz: 28.3495 };

function fmtW(totalG: number, unit: WeightUnit): string {
  const val = totalG / TO_G[unit];
  return unit === 'g' ? Math.round(val).toString() : val.toFixed(2);
}

const PRESET_COLORS = ['#e05252', '#e08c52', '#d4c44a', '#52a852', '#52a8a8', '#5278e0', '#a852e0', '#888888'];

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditCell({ value, type = 'text', onSave, align = 'right' }: {
  value: string | number; type?: 'text' | 'number'; onSave: (v: string) => void; align?: 'left' | 'right';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const confirm = () => { setEditing(false); onSave(draft); };
  const cancel = () => setEditing(false);

  if (!editing) {
    return (
      <span style={{ cursor: 'pointer', textAlign: align }} onClick={() => { setDraft(String(value)); setEditing(true); }}>
        {value}
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
      <input
        className={styles.inlineInput}
        style={{ textAlign: align, flex: 1, minWidth: 0 }}
        type={type}
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel(); }}
      />
      <button className={`${styles.iconBtn} ${styles.confirmBtn}`} onMouseDown={e => { e.preventDefault(); confirm(); }} title="Save">✓</button>
      <button className={`${styles.iconBtn} ${styles.cancelEditBtn}`} onMouseDown={e => { e.preventDefault(); cancel(); }} title="Cancel">✕</button>
    </span>
  );
}

// ── Weight edit cell (number + unit selector) ─────────────────────────────────

function WeightEditCell({ weightG, displayUnit, onSave }: {
  weightG: number; displayUnit: WeightUnit; onSave: (grams: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [editUnit, setEditUnit] = useState<WeightUnit>(displayUnit);

  const open = () => {
    setEditUnit(displayUnit);
    setDraft(fmtW(weightG, displayUnit));
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const grams = parseFloat(draft) * TO_G[editUnit];
    onSave(isNaN(grams) ? 0 : grams);
  };

  const cancel = () => setEditing(false);

  if (!editing) {
    return (
      <span style={{ cursor: 'pointer' }} onClick={open}>
        {fmtW(weightG, displayUnit)}
        <span style={{ color: 'var(--outline)', marginLeft: 2 }}>{displayUnit}</span>
      </span>
    );
  }

  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
      <input
        className={styles.inlineInput}
        style={{ textAlign: 'right', width: 0, flex: 1 }}
        type="number" value={draft} autoFocus min="0" step="any"
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
      />
      <select
        className={styles.inlineInput}
        style={{ width: 42, padding: '2px 1px', flexShrink: 0 }}
        value={editUnit}
        onChange={e => setEditUnit(e.target.value as WeightUnit)}
      >
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <button className={`${styles.iconBtn} ${styles.confirmBtn}`} onMouseDown={e => { e.preventDefault(); save(); }} title="Save">✓</button>
      <button className={`${styles.iconBtn} ${styles.cancelEditBtn}`} onMouseDown={e => { e.preventDefault(); cancel(); }} title="Cancel">✕</button>
    </span>
  );
}

// ── Add item form (inline row) ────────────────────────────────────────────────

function AddItemRow({ categoryId, unit, onAdd, onCancel }: {
  categoryId: number; unit: WeightUnit;
  onAdd: (data: { categoryId: number; name: string; weightG: number; qty: number; worn: boolean; consumable: boolean }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('0');
  const [qty, setQty] = useState('1');
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    const weightG = parseFloat(weight) * TO_G[unit];
    onAdd({ categoryId, name: name.trim(), weightG: isNaN(weightG) ? 0 : weightG, qty: parseInt(qty) || 1, worn, consumable });
  };

  return (
    <tr className={styles.addItemRow}>
      <td colSpan={6}>
        <div className={styles.addItemForm}>
          <input
            type="text" placeholder="Item name" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
          <input
            type="number" placeholder={`Weight (${unit})`} value={weight}
            onChange={e => setWeight(e.target.value)} min="0" step="any"
          />
          <input
            type="number" placeholder="Qty" value={qty}
            onChange={e => setQty(e.target.value)} min="1"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontFamily: 'var(--font-headline)', color: 'var(--outline)', cursor: 'pointer' }}>
            <input type="checkbox" checked={worn} onChange={e => setWorn(e.target.checked)} /> WORN
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontFamily: 'var(--font-headline)', color: 'var(--outline)', cursor: 'pointer' }}>
            <input type="checkbox" checked={consumable} onChange={e => setConsumable(e.target.checked)} /> CONSUMABLE
          </label>
          <button className={styles.addBtn} onClick={submit}>ADD</button>
          <button className={styles.cancelBtn} onClick={onCancel}>CANCEL</button>
        </div>
      </td>
    </tr>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ cat, items, unit, isAdmin, isFirst, isLast, onMoveUp, onMoveDown, onDeleteCat,
  onAddItem, onUpdateItem, onDeleteItem }: {
  cat: GearCategory; items: GearItem[]; unit: WeightUnit; isAdmin: boolean;
  isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void; onDeleteCat: () => void;
  onAddItem: (data: { categoryId: number; name: string; weightG: number; qty: number; worn: boolean; consumable: boolean }) => void;
  onUpdateItem: (id: number, data: Partial<GearItem>) => void;
  onDeleteItem: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);

  const includedItems = items.filter(it => it.included);
  const totalG = includedItems.reduce((s, it) => s + it.weightG * it.qty, 0);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionColorDot} style={{ background: cat.color }} />
        <span className={styles.sectionTitle}>{cat.name}</span>
        <span className={styles.sectionMeta}>{includedItems.length}/{items.length} · {fmtW(totalG, unit)} {unit}</span>
        {isAdmin && (
          <div className={styles.sectionActions}>
            {!isFirst && <button className={styles.iconBtn} onClick={onMoveUp} title="Move up">↑</button>}
            {!isLast && <button className={styles.iconBtn} onClick={onMoveDown} title="Move down">↓</button>}
            <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={onDeleteCat} title="Delete category">✕</button>
          </div>
        )}
      </div>

      <table className={styles.itemTable}>
        <thead>
          <tr>
            {isAdmin && <th style={{ width: 32 }}></th>}
            <th style={{ width: '40%' }}>Item</th>
            <th>Weight</th>
            <th>Qty</th>
            <th>Total</th>
            {isAdmin && <th style={{ width: 36 }}></th>}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const totalItemG = item.weightG * item.qty;
            return (
              <tr key={item.id} className={styles.itemRow} style={{ opacity: item.included ? 1 : 0.35 }}>
                {isAdmin && (
                  <td style={{ textAlign: 'center', padding: '0 6px' }}>
                    <input type="checkbox" checked={item.included}
                      onChange={e => onUpdateItem(item.id, { included: e.target.checked })}
                      style={{ cursor: 'pointer', accentColor: 'var(--secondary)' }}
                    />
                  </td>
                )}
                <td>
                  <div className={styles.itemName}>
                    {isAdmin
                      ? <EditCell value={item.name} type="text" align="left"
                          onSave={v => onUpdateItem(item.id, { name: v })} />
                      : item.name
                    }
                  </div>
                  <div className={styles.itemBadges}>
                    {item.worn && <span className={`${styles.badge} ${styles.badgeWorn}`}>WORN</span>}
                    {item.consumable && <span className={`${styles.badge} ${styles.badgeConsumable}`}>CONSUMABLE</span>}
                  </div>
                </td>
                <td className={styles.itemNum}>
                  {isAdmin
                    ? <WeightEditCell weightG={item.weightG} displayUnit={unit}
                        onSave={grams => onUpdateItem(item.id, { weightG: grams })} />
                    : <>{fmtW(item.weightG, unit)}<span className={styles.itemNumMuted}> {unit}</span></>
                  }
                </td>
                <td className={styles.itemNum}>
                  {isAdmin
                    ? <EditCell value={item.qty} type="number"
                        onSave={v => onUpdateItem(item.id, { qty: parseInt(v) || 1 })} />
                    : item.qty
                  }
                </td>
                <td className={styles.itemNum}>
                  {fmtW(totalItemG, unit)} <span className={styles.itemNumMuted}>{unit}</span>
                </td>
                {isAdmin && (
                  <td style={{ textAlign: 'right' }}>
                    <button className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      onClick={() => onDeleteItem(item.id)}>✕</button>
                  </td>
                )}
              </tr>
            );
          })}

          {/* Category total */}
          <tr className={styles.totalRow}>
            {isAdmin && <td></td>}
            <td>SUBTOTAL</td>
            <td></td>
            <td></td>
            <td>{fmtW(totalG, unit)} {unit}</td>
            {isAdmin && <td></td>}
          </tr>

          {/* Add item */}
          {isAdmin && !adding && (
            <tr className={styles.addItemRow}>
              <td colSpan={6}>
                <button className={styles.addBtn} onClick={() => setAdding(true)}>+ ADD ITEM</button>
              </td>
            </tr>
          )}
          {isAdmin && adding && (
            <AddItemRow
              categoryId={cat.id} unit={unit}
              onAdd={data => { onAddItem(data); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GearPage({ isAdmin, onClose }: GearPageProps) {
  const { categories, items, loading, addCategory, updateCategory, deleteCategory,
    moveCategoryUp, moveCategoryDown, addItem, updateItem, deleteItem, load } = useGear();

  const [unit, setUnit] = useState<WeightUnit>(() => {
    return (localStorage.getItem('gear_unit') as WeightUnit) || 'g';
  });

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#5278e0');
  const [showAddCat, setShowAddCat] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCsv(text);
        if (rows.length === 0) { setImportMsg('No valid rows found.'); return; }
        const { imported } = await importCsv(rows);
        await load();
        setImportMsg(`Imported ${imported} item${imported !== 1 ? 's' : ''}.`);
      } catch (err) {
        setImportMsg(`Error: ${(err as Error).message}`);
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const setUnitAndSave = (u: WeightUnit) => {
    setUnit(u);
    localStorage.setItem('gear_unit', u);
  };

  const sorted = useMemo(() =>
    [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
  [categories]);

  const itemsByCategory = useMemo(() => {
    const map: Record<number, GearItem[]> = {};
    for (const it of items) {
      if (!map[it.categoryId]) map[it.categoryId] = [];
      map[it.categoryId].push(it);
    }
    return map;
  }, [items]);

  // Dashboard totals
  const included = items.filter(it => it.included);
  const totalG = included.reduce((s, it) => s + it.weightG * it.qty, 0);
  const baseG = included.filter(it => !it.worn && !it.consumable).reduce((s, it) => s + it.weightG * it.qty, 0);
  const wornG = included.filter(it => it.worn).reduce((s, it) => s + it.weightG * it.qty, 0);

  return (
    <div className={styles.gearPage}>

      {/* ── Fixed top: header + dashboard ── */}
      <div className={styles.gearPageSticky}>
        <div className={styles.gearPageStickyInner}>
          <div className={styles.gearPageHeader}>
            <h2>GEAR_LIST</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={styles.unitToggle}>
                {UNITS.map(u => (
                  <button key={u} className={`${styles.unitBtn} ${unit === u ? styles.unitBtnActive : ''}`}
                    onClick={() => setUnitAndSave(u)}>
                    {u}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
                  <button className={styles.addBtn} onClick={() => fileRef.current?.click()}
                    disabled={importing} style={{ fontSize: '0.65rem' }}>
                    {importing ? 'IMPORTING...' : 'IMPORT CSV'}
                  </button>
                  {importMsg && (
                    <span style={{ fontFamily: 'var(--font-headline)', fontSize: '0.65rem', color: 'var(--outline)' }}>
                      {importMsg}
                    </span>
                  )}
                </>
              )}
              <button onClick={onClose} style={{
                fontFamily: 'var(--font-headline)', fontSize: '0.7rem', fontWeight: 700,
                letterSpacing: '0.1em', padding: '6px 12px', background: 'none',
                border: 'var(--ghost-border)', color: 'var(--outline)', cursor: 'pointer',
              }}>CLOSE</button>
            </div>
          </div>

          {/* Dashboard */}
          <div className={styles.dashboard}>
            <div className={styles.dashCards}>
              <div className={`${styles.dashCard} ${styles.dashCardAccent}`}>
                <span className={styles.dashLabel}>BASE_WEIGHT</span>
                <span className={styles.dashValue}>{fmtW(baseG, unit)}<span className={styles.dashUnit}>{unit}</span></span>
              </div>
              <div className={styles.dashCard}>
                <span className={styles.dashLabel}>WORN</span>
                <span className={styles.dashValue}>{fmtW(wornG, unit)}<span className={styles.dashUnit}>{unit}</span></span>
              </div>
              <div className={styles.dashCard}>
                <span className={styles.dashLabel}>TOTAL</span>
                <span className={styles.dashValue}>{fmtW(totalG, unit)}<span className={styles.dashUnit}>{unit}</span></span>
              </div>
            </div>

            {/* Category breakdown bars */}
            {sorted.length > 0 && totalG > 0 && (
              <div className={styles.catBars}>
                {sorted.map(cat => {
                  const catItems = (itemsByCategory[cat.id] ?? []).filter(it => it.included);
                  const catG = catItems.reduce((s, it) => s + it.weightG * it.qty, 0);
                  const pct = totalG > 0 ? (catG / totalG) * 100 : 0;
                  return (
                    <div key={cat.id} className={styles.catBarRow}>
                      <span className={styles.catBarLabel}>{cat.name}</span>
                      <div className={styles.catBarTrack}>
                        <div className={styles.catBarFill} style={{ width: `${pct}%`, background: cat.color }} />
                      </div>
                      <span className={styles.catBarWeight}>{fmtW(catG, unit)} {unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div className={styles.gearPageScroll}>
        <div className={styles.gearPageContent}>
          {loading ? (
            <div className={styles.empty}>LOADING...</div>
          ) : (
            <>
              {sorted.length === 0 ? (
                <div className={styles.empty}>NO GEAR YET — ADD A CATEGORY TO GET STARTED</div>
              ) : (
                sorted.map((cat, idx) => (
                  <CategorySection
                    key={cat.id}
                    cat={cat}
                    items={itemsByCategory[cat.id] ?? []}
                    unit={unit}
                    isAdmin={isAdmin}
                    isFirst={idx === 0}
                    isLast={idx === sorted.length - 1}
                    onMoveUp={() => moveCategoryUp(cat.id)}
                    onMoveDown={() => moveCategoryDown(cat.id)}
                    onDeleteCat={() => deleteCategory(cat.id)}
                    onAddItem={addItem}
                    onUpdateItem={(id, data) => updateItem(id, data as Parameters<typeof updateItem>[1])}
                    onDeleteItem={deleteItem}
                  />
                ))
              )}

              {/* Add category */}
              {isAdmin && (
                <div>
                  {!showAddCat ? (
                    <button className={styles.addBtn} onClick={() => setShowAddCat(true)}>+ ADD CATEGORY</button>
                  ) : (
                    <div className={styles.addCategoryArea}>
                      <input
                        type="text" placeholder="Category name" value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && setShowAddCat(false)}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setNewCatColor(c)} style={{
                            width: 22, height: 22, background: c,
                            border: newCatColor === c ? '2px solid var(--on-surface)' : '1px solid transparent',
                            cursor: 'pointer', padding: 0,
                          }} />
                        ))}
                        <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                          className={styles.colorPicker} title="Custom color" />
                      </div>
                      <button className={styles.addBtn} onClick={async () => {
                        if (!newCatName.trim()) return;
                        await addCategory(newCatName.trim(), newCatColor);
                        setNewCatName('');
                        setShowAddCat(false);
                      }}>CREATE</button>
                      <button className={styles.cancelBtn} onClick={() => setShowAddCat(false)}>CANCEL</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
