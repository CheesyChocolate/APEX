// ─────────────────────────────────────────────────────────────────────────────
// APEX components
//
// Sidebar, top bar, pipeline stepper, status log, results tables, histogram,
// compound detail drawer, compare bar, empty states.
// ─────────────────────────────────────────────────────────────────────────────

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── BrandMark — small hexagonal APEX wordmark ─────────────────────────────
function BrandMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 2.5 L20 7 L20 17 L12 21.5 L4 17 L4 7 Z" />
        <path d="M12 2.5 L12 21.5" strokeWidth="1.2" opacity="0.4" />
        <path d="M4 7 L20 17" strokeWidth="1.2" opacity="0.4" />
        <path d="M20 7 L4 17" strokeWidth="1.2" opacity="0.4" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', fontSize: 14 }}>APEX</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '0.04em' }}>v2.4.1</span>
      </div>
    </div>
  );
}

// ── ScreeningPanel ────────────────────────────────────────────────────────
function parseSmilesCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const smilesKeys = ['smiles', 'canonical_smiles', 'smile', 'structure'];
  const firstLow = lines[0].toLowerCase();
  const isHeader = smilesKeys.some(k => firstLow.includes(k));
  let colIdx = 0;
  let start = 0;
  if (isHeader) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const found = headers.findIndex(h => smilesKeys.some(k => h.includes(k)));
    colIdx = found >= 0 ? found : 0;
    start = 1;
  }
  return lines.slice(start)
    .map(line => (line.split(',')[colIdx] || '').trim().replace(/^["']|["']$/g, ''))
    .filter(s => s.length > 2);
}

function ScreeningPanel({ mode, onModeChange, smiles, onSmilesChange }) {
  const [smilesText, setSmilesText] = useState('');
  const [csvName, setCsvName] = useState('');

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseSmilesCsv(ev.target.result);
      onSmilesChange(parsed);
    };
    reader.readAsText(file);
  };

  const handleSmilesText = (val) => {
    setSmilesText(val);
    const parsed = val.trim().split('\n').map(s => s.trim()).filter(s => s.length > 2);
    onSmilesChange(parsed.length ? parsed : null);
  };

  const modeStyle = (v) => ({
    flex: 1, padding: '4px 0', border: 0, borderRadius: 3,
    background: mode === v ? 'var(--surface)' : 'transparent',
    color: mode === v ? 'var(--ink)' : 'var(--ink-muted)',
    cursor: 'pointer', fontWeight: 500, fontSize: 11,
    boxShadow: mode === v ? '0 0 0 1px var(--hair-2), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
    fontFamily: 'var(--sans)',
  });

  return (
    <div style={{ padding: '0 var(--pad-x) 12px' }}>
      {/* mode toggle */}
      <div style={{
        display: 'flex', padding: 2,
        background: 'var(--surface-2)', border: '1px solid var(--hair-2)',
        borderRadius: 'var(--r)', marginBottom: 8,
      }}>
        {[['demo','Demo'],['csv','CSV'],['smiles','SMILES']].map(([v, l]) => (
          <button key={v} style={modeStyle(v)} onClick={() => onModeChange(v)}>{l}</button>
        ))}
      </div>

      {mode === 'demo' && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          Uses the held-out ChEMBL test split as the screening library.
        </p>
      )}

      {mode === 'csv' && (
        <div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 10px', borderRadius: 'var(--r-sm)',
            border: '1px dashed var(--hair-2)', cursor: 'pointer',
            fontSize: 11.5, color: 'var(--ink-muted)',
            background: 'var(--surface-2)',
          }}>
            <Icons.upload size={12} />
            {csvName || 'Upload CSV…'}
            <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCsvUpload} />
          </label>
          {smiles?.length > 0 && (
            <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--good)', fontFamily: 'var(--mono)' }}>
              ✓ {smiles.length} compounds loaded
            </div>
          )}
          <p style={{ margin: '5px 0 0', fontSize: 10.5, color: 'var(--ink-dim)', lineHeight: 1.4 }}>
            CSV must have a "smiles" or "canonical_smiles" column (or SMILES as the first column).
          </p>
        </div>
      )}

      {mode === 'smiles' && (
        <div>
          <textarea
            className="input"
            style={{ width: '100%', height: 90, fontSize: 11, fontFamily: 'var(--mono)', resize: 'vertical', boxSizing: 'border-box' }}
            placeholder={'CC(=O)Oc1ccccc1C(=O)O\nCCOC(=O)c1ccc(N)cc1\n…one SMILES per line'}
            value={smilesText}
            onChange={(e) => handleSmilesText(e.target.value)}
          />
          {smiles?.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--good)', fontFamily: 'var(--mono)' }}>
              ✓ {smiles.length} compounds
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({
  searchQuery, onSearch,
  searchResults,
  selectedTarget, onSelectTarget,
  recentRuns, onSelectRun,
  apiHealth,
  showHistory,
  screeningMode, onScreeningModeChange,
  screeningSmiles, onScreeningSmilesChange,
}) {
  const sectionStyle = {
    padding: '14px var(--pad-x) 8px',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--ink-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  return (
    <aside style={{
      borderRight: '1px solid var(--hair-2)',
      background: 'var(--paper-2)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* brand */}
      <div style={{
        padding: '16px var(--pad-x) 14px',
        borderBottom: '1px solid var(--hair-2)',
        color: 'var(--ink)',
      }}>
        <BrandMark />
      </div>

      {/* search */}
      <div style={{ padding: '12px var(--pad-x) 0' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-dim)', display: 'flex',
          }}>
            <Icons.search size={13} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 28, height: 30, fontSize: 12.5 }}
            placeholder="Search targets…"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => onSearch('')}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 0, cursor: 'pointer', padding: 4,
                color: 'var(--ink-dim)', display: 'flex',
              }}
              aria-label="Clear"
            ><Icons.x size={11} /></button>
          )}
        </div>
        <div style={{
          fontSize: 10.5, color: 'var(--ink-dim)', fontFamily: 'var(--mono)',
          marginTop: 6, paddingLeft: 2,
        }}>
          ChEMBL 34 · {searchResults.length} matches
        </div>
      </div>

      {/* target list */}
      <div className="scroll-y" style={{ flex: 1, marginTop: 4 }}>
        <div style={sectionStyle}>
          <span>Targets</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-dim)', letterSpacing: 0, textTransform: 'none', fontSize: 10, fontWeight: 400 }}>
            {searchResults.length}
          </span>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          {searchResults.map((t) => {
            const active = selectedTarget?.target_chembl_id === t.target_chembl_id;
            return (
              <button
                key={t.target_chembl_id}
                onClick={() => onSelectTarget(t)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px',
                  border: 0, borderRadius: 'var(--r-sm)',
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--paper)' : 'var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                  fontSize: 12.5,
                  marginBottom: 1,
                  transition: 'background 80ms ease',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--hair)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{t.short}</span>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    color: active ? 'rgba(255,255,255,0.5)' : 'var(--ink-dim)',
                  }}>{t.target_chembl_id.replace('CHEMBL', '')}</span>
                </div>
                <div style={{
                  fontSize: 11, lineHeight: 1.35, marginTop: 2,
                  color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t.pref_name}</div>
              </button>
            );
          })}
          {searchResults.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 11.5, color: 'var(--ink-dim)' }}>
              No matches for “{searchQuery}”.
            </div>
          )}
        </div>

        {/* recent runs */}
        {showHistory && (
          <>
            <div style={sectionStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icons.history size={11} /> Recent
              </span>
            </div>
            <div style={{ padding: '0 8px 16px' }}>
              {recentRuns.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelectRun(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', textAlign: 'left',
                    padding: '6px 10px', border: 0,
                    background: 'transparent', cursor: 'pointer',
                    borderRadius: 'var(--r-sm)',
                    fontFamily: 'var(--mono)', fontSize: 11,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hair)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    color: 'var(--ink)', minWidth: 0, overflow: 'hidden',
                  }}>
                    <i style={{
                      width: 5, height: 5, borderRadius: '50%', flex: 'none',
                      background: r.status === 'done' ? 'var(--good)' : r.status === 'failed' ? 'var(--bad)' : 'var(--ink-dim)',
                    }} />
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 12 }}>{r.short}</span>
                    <span style={{ color: 'var(--ink-dim)', fontSize: 10 }}>{r.id}</span>
                  </span>
                  <span style={{ color: 'var(--ink-dim)', fontSize: 10.5, fontFamily: 'var(--sans)', flex: 'none' }}>{r.when}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* screening library panel — only when a target is selected */}
      {selectedTarget && (
        <div style={{ borderTop: '1px solid var(--hair-2)', paddingTop: 12 }}>
          <div style={{ padding: '0 var(--pad-x) 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icons.beaker size={10} /> Screening library
          </div>
          <ScreeningPanel
            mode={screeningMode}
            onModeChange={onScreeningModeChange}
            smiles={screeningSmiles}
            onSmilesChange={onScreeningSmilesChange}
          />
        </div>
      )}

      {/* footer — health */}
      <div style={{
        borderTop: '1px solid var(--hair-2)',
        padding: '10px var(--pad-x)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--mono)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 6, height: 6, borderRadius: '50%',
            background: apiHealth === 'ok' ? 'var(--good)' : apiHealth === 'degraded' ? 'var(--warn)' : 'var(--bad)',
            boxShadow: apiHealth === 'ok' ? '0 0 0 2px rgba(23,108,59,0.15)' : 'none',
          }} />
          api {apiHealth === 'ok' ? 'online' : apiHealth}
        </span>
        <button className="btn ghost sm icon" aria-label="Settings"><Icons.settings size={13} /></button>
      </div>
    </aside>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────
function TopBar({
  target, runMode, onRunModeChange,
  pipelineStatus, onRun, onCancel, onReset,
  qsarDone, dockingDone,
}) {
  const isRunning = pipelineStatus.startsWith('running');
  const canRun = !!target && !isRunning;

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px var(--gap-lg) 14px var(--gap-lg)',
      borderBottom: '1px solid var(--hair-2)',
      background: 'var(--paper)',
      gap: 16, minHeight: 64,
    }}>
      {/* left: target chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
        {target ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span className="eyebrow" style={{ fontSize: 9.5 }}>Target</span>
                <h1 style={{
                  margin: 0, font: '500 18px/1.2 var(--sans)',
                  letterSpacing: '-0.005em', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50vw',
                }}>{target.short}<span style={{
                  color: 'var(--ink-dim)', fontWeight: 400, marginLeft: 10, fontSize: 14,
                }}>·</span><span style={{
                  fontWeight: 400, fontSize: 15, marginLeft: 8, color: 'var(--ink-3)',
                }}>{target.pref_name}</span></h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span className="badge outline mono" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{target.target_chembl_id}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{target.target_type.toLowerCase()}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontStyle: 'italic' }}>{target.organism}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontFamily: 'var(--mono)' }}>
                  UniProt {target.uniprot} · PDB {target.pdb}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="eyebrow" style={{ fontSize: 9.5 }}>Target</span>
            <span style={{ font: '400 18px/1.2 var(--sans)', color: 'var(--ink-dim)', fontStyle: 'italic' }}>
              No target selected
            </span>
          </div>
        )}
      </div>

      {/* right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        {/* run mode toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: 2, background: 'var(--surface-2)',
          border: '1px solid var(--hair-2)',
          borderRadius: 'var(--r)', fontSize: 11.5,
        }}>
          {[
            { v: 'auto',   l: 'Auto'   },
            { v: 'manual', l: 'Manual' },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => onRunModeChange(o.v)}
              style={{
                padding: '4px 10px', border: 0, borderRadius: 3,
                background: runMode === o.v ? 'var(--surface)' : 'transparent',
                color: runMode === o.v ? 'var(--ink)' : 'var(--ink-muted)',
                cursor: 'pointer', fontWeight: 500,
                boxShadow: runMode === o.v ? '0 0 0 1px var(--hair-2), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}
            >{o.l}</button>
          ))}
        </div>

        {isRunning ? (
          <button className="btn" onClick={onCancel}>
            <Icons.stop size={11} /> Cancel
          </button>
        ) : (qsarDone || dockingDone) ? (
          <>
            <button className="btn" onClick={onReset}>
              <Icons.x size={11} /> Reset
            </button>
            <button className="btn primary" onClick={onRun} disabled={!canRun}>
              <Icons.play size={10} /> Rerun
            </button>
          </>
        ) : (
          <button className="btn accent" onClick={onRun} disabled={!canRun}>
            <Icons.play size={10} /> Run pipeline
          </button>
        )}
      </div>
    </header>
  );
}

// ── Pipeline stepper ───────────────────────────────────────────────────────
function Stepper({ pipelineStatus, target, qsarCount, dockingCount, elapsed }) {
  // Stages: target ▸ qsar ▸ docking
  const stages = [
    {
      id: 'target',
      label: 'Target',
      sub: target ? `${target.short} · ${target.target_chembl_id}` : 'Choose a target',
      status: target ? 'done' : 'idle',
      icon: <Icons.beaker size={13} />,
    },
    {
      id: 'qsar',
      label: 'QSAR Screening',
      sub: pipelineStatus === 'running-qsar'
        ? 'Training model · predicting actives…'
        : pipelineStatus === 'running-docking' || pipelineStatus === 'qsar-done' || pipelineStatus === 'done'
          ? `${qsarCount} predicted actives`
          : 'Random Forest · Morgan FP',
      status:
        pipelineStatus === 'running-qsar' ? 'running'
        : pipelineStatus === 'qsar-done' || pipelineStatus === 'running-docking' || pipelineStatus === 'done' ? 'done'
        : pipelineStatus === 'failed-qsar' ? 'failed'
        : 'idle',
      icon: <Icons.dna size={13} />,
    },
    {
      id: 'docking',
      label: 'Molecular Docking',
      sub: pipelineStatus === 'running-docking'
        ? 'Vina · exhaustiveness 8…'
        : pipelineStatus === 'done'
          ? `${dockingCount} poses · top affinity computed`
          : 'AutoDock Vina',
      status:
        pipelineStatus === 'running-docking' ? 'running'
        : pipelineStatus === 'done' ? 'done'
        : pipelineStatus === 'failed-docking' ? 'failed'
        : 'idle',
      icon: <Icons.flask size={13} />,
    },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      padding: '12px var(--gap-lg)',
      gap: 0,
      borderBottom: '1px solid var(--hair-2)',
      background: 'var(--surface)',
    }}>
      {stages.map((s, i) => (
        <React.Fragment key={s.id}>
          <StepperNode {...s} index={i + 1} />
          {i < stages.length - 1 && (
            <StepperLink active={stages[i].status === 'done' || stages[i].status === 'running'}
                         running={stages[i+1].status === 'running'} />
          )}
        </React.Fragment>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--mono)',
      }}>
        <span>elapsed <span style={{ color: 'var(--ink)' }}>{elapsed || '0.0s'}</span></span>
      </div>
    </div>
  );
}

function StepperNode({ label, sub, status, icon, index }) {
  const bg =
    status === 'done'    ? 'var(--ink)' :
    status === 'running' ? 'var(--accent)' :
    status === 'failed'  ? 'var(--bad)' :
                           'var(--surface-2)';
  const fg =
    status === 'idle' ? 'var(--ink-muted)' : '#fff';
  const border =
    status === 'idle' ? '1px solid var(--hair-2)' : `1px solid ${bg}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--r)',
        background: bg, border, color: fg,
        display: 'grid', placeItems: 'center',
        position: 'relative',
        transition: 'background 200ms ease',
      }}>
        {status === 'running' ? (
          <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />
        ) : status === 'done' ? (
          <Icons.check size={14} />
        ) : status === 'failed' ? (
          <Icons.x size={14} />
        ) : (
          icon
        )}
        <div style={{
          position: 'absolute', top: -4, right: -4,
          fontFamily: 'var(--mono)', fontSize: 9,
          color: 'var(--ink-dim)',
          background: 'var(--surface)',
          padding: '0 3px', borderRadius: 2,
          lineHeight: 1.4,
          display: status === 'idle' ? 'block' : 'none',
        }}>
          {String(index).padStart(2, '0')}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 500, color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {label}
          {status === 'running' && (
            <span className="pulse" style={{
              fontSize: 9.5, fontFamily: 'var(--mono)',
              color: 'var(--accent)', fontWeight: 500,
              padding: '1px 5px', background: 'var(--accent-soft)',
              borderRadius: 2, letterSpacing: '0.04em',
            }}>RUNNING</span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--ink-muted)', marginTop: 1,
          fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 220,
        }}>{sub}</div>
      </div>
    </div>
  );
}

function StepperLink({ active, running }) {
  return (
    <div style={{
      flex: '0 0 40px', alignSelf: 'center', height: 1,
      position: 'relative', margin: '0 4px',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--hair-2)',
      }} />
      {active && (
        <div style={{
          position: 'absolute', inset: 0,
          background: running ? 'var(--accent)' : 'var(--ink)',
          animation: running ? 'pulse-soft 1.4s ease-in-out infinite' : 'none',
        }} />
      )}
    </div>
  );
}

// ── StatusLog — streaming terminal-style log ──────────────────────────────
function StatusLog({ lines, isRunning, onCollapse, collapsed }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  if (collapsed) {
    return (
      <div style={{
        padding: '6px var(--gap-lg)',
        borderBottom: '1px solid var(--hair-2)',
        background: 'var(--surface-2)',
        fontFamily: 'var(--mono)', fontSize: 11,
        color: 'var(--ink-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isRunning && <span className="spinner" style={{ width: 10, height: 10 }} />}
          <span style={{ color: isRunning ? 'var(--ink)' : 'var(--ink-muted)' }}>
            {lines[lines.length - 1]?.text || 'Pipeline log'}
          </span>
        </span>
        <button className="btn ghost sm" onClick={onCollapse}>
          <Icons.chevDown size={11} /> Show log
        </button>
      </div>
    );
  }

  return (
    <div style={{
      borderBottom: '1px solid var(--hair-2)',
      background: 'var(--surface-2)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px var(--gap-lg)',
        borderBottom: '1px solid var(--hair)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="eyebrow">Pipeline log</span>
          {isRunning && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10.5, fontFamily: 'var(--mono)',
              color: 'var(--accent)',
            }}>
              <span className="spinner" style={{ width: 9, height: 9 }} />
              streaming
            </span>
          )}
        </div>
        <button className="btn ghost sm" onClick={onCollapse}>
          <Icons.chevDown size={11} style={{ transform: 'rotate(180deg)' }} /> Hide
        </button>
      </div>
      <div
        ref={scrollRef}
        className="scroll-y"
        style={{
          maxHeight: 168, minHeight: 100,
          padding: '8px var(--gap-lg)',
          fontFamily: 'var(--mono)',
          fontSize: 11.5,
          lineHeight: 1.65,
        }}
      >
        {lines.length === 0 && !isRunning && (
          <div style={{ color: 'var(--ink-dim)' }}>
            <span style={{ color: 'var(--ink-muted)' }}>$</span> waiting for run…
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className="fade-in" style={{
            display: 'flex', gap: 10,
            color: l.level === 'ok' ? 'var(--good)' : l.level === 'err' ? 'var(--bad)' : 'var(--ink-3)',
          }}>
            <span style={{ color: 'var(--ink-dim)', flex: 'none', userSelect: 'none' }}>
              {String(i + 1).padStart(3, '0')}
            </span>
            <span style={{ color: 'var(--ink-dim)', flex: 'none', userSelect: 'none' }}>
              {l.timestamp}
            </span>
            <span style={{ minWidth: 0, whiteSpace: 'pre-wrap' }}>{l.text}</span>
          </div>
        ))}
        {isRunning && (
          <div style={{ display: 'flex', gap: 10, color: 'var(--ink-3)' }}>
            <span style={{ color: 'var(--ink-dim)' }}>{String(lines.length + 1).padStart(3, '0')}</span>
            <span style={{ color: 'var(--ink-dim)' }}>&nbsp;</span>
            <span><span className="blink" style={{ color: 'var(--accent)' }}>▎</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Affinity histogram ─────────────────────────────────────────────────────
function AffinityHistogram({ results, height = 64, onHover }) {
  // Display as ordered ranked bars (best→worst, more negative = taller).
  if (!results?.length) return null;
  const max = Math.max(...results.map(r => Math.abs(r.affinity_kcal_mol)));
  const min = Math.min(...results.map(r => Math.abs(r.affinity_kcal_mol)));
  const colorFor = (a) => {
    // a is negative; -11 → best (green), -5 → worst (red)
    const t = Math.min(1, Math.max(0, (Math.abs(a) - 5) / 6));
    if (t > 0.75) return 'var(--heat-best)';
    if (t > 0.55) return 'var(--heat-good)';
    if (t > 0.35) return 'var(--heat-mid)';
    if (t > 0.15) return 'var(--heat-poor)';
    return 'var(--heat-bad)';
  };
  return (
    <div style={{
      padding: '12px var(--gap-lg)',
      borderBottom: '1px solid var(--hair-2)',
      background: 'var(--surface)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="eyebrow">Affinity distribution</span>
          <span style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--mono)' }}>
            n = {results.length} · range {results[0].affinity_kcal_mol.toFixed(1)} … {results[results.length - 1].affinity_kcal_mol.toFixed(1)} kcal/mol
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10.5, color: 'var(--ink-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 8, height: 8, background: 'var(--heat-best)', borderRadius: 2 }} /> &lt; −9.0
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 8, height: 8, background: 'var(--heat-mid)', borderRadius: 2 }} /> −7.0
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 8, height: 8, background: 'var(--heat-bad)', borderRadius: 2 }} /> &gt; −6.0
          </span>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2,
        height, padding: '0 0 0 0',
      }}>
        {results.map((r, i) => {
          const t = (Math.abs(r.affinity_kcal_mol) - 4) / (max - 4 + 0.5);
          const h = Math.max(4, t * height);
          return (
            <div
              key={i}
              onMouseEnter={() => onHover?.(r)}
              onMouseLeave={() => onHover?.(null)}
              style={{
                flex: 1,
                height: h,
                background: colorFor(r.affinity_kcal_mol),
                borderRadius: '1px 1px 0 0',
                position: 'relative',
                transition: 'opacity 80ms ease',
                cursor: 'pointer',
              }}
              title={`rank ${r.rank}  ·  ${r.affinity_kcal_mol} kcal/mol`}
            />
          );
        })}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-dim)',
        marginTop: 4,
      }}>
        <span>rank 1</span>
        <span>better ←   binding affinity   → worse</span>
        <span>rank {results.length}</span>
      </div>
    </div>
  );
}

// ── QSAR table ────────────────────────────────────────────────────────────
function QsarTable({ rows, expanded, onToggleExpand, selected, onToggleSelected, onOpenDetail, showStructures }) {
  const visible = expanded ? rows : rows.slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <ResultsToolbar
        title="QSAR Predictions"
        count={rows.length}
        meta={[
          { l: 'top actives', v: rows.filter(r => r.predicted_active).length },
          { l: 'ROC-AUC',     v: '0.86' },
          { l: 'best p',      v: rows[0]?.activity_probability.toFixed(3) },
        ]}
      />
      <div className="scroll-y" style={{ flex: 1 }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th style={{ width: 50 }}>Rank</th>
              {showStructures && <th style={{ width: 96 }}>Structure</th>}
              <th>SMILES</th>
              <th style={{ width: 180 }}>Activity probability</th>
              <th style={{ width: 90 }}>Predicted</th>
              <th style={{ width: 90, textAlign: 'right' }}>MW</th>
              <th style={{ width: 80, textAlign: 'right' }}>cLogP</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const isSel = selected.has(r.id);
              return (
                <tr key={r.id} className={isSel ? 'selected' : ''}>
                  <td>
                    <span
                      role="checkbox"
                      aria-checked={isSel}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onToggleSelected(r.id); }}
                      className="check"
                      data-on={isSel ? '1' : '0'}
                    />
                  </td>
                  <td className="num" style={{ color: 'var(--ink-muted)' }}>{String(i + 1).padStart(2, '0')}</td>
                  {showStructures && (
                    <td>
                      <Molecule smiles={r.smiles} size={80} height={48} tint />
                    </td>
                  )}
                  <td>
                    <button
                      onClick={() => onOpenDetail(r)}
                      style={{
                        background: 'transparent', border: 0, padding: 0,
                        font: 'inherit', fontFamily: 'var(--mono)', fontSize: 11.5,
                        color: 'var(--ink-2)', textAlign: 'left', cursor: 'pointer',
                        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', display: 'inline-block',
                      }}
                      title={r.smiles}
                    >{r.smiles}</button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={'pbar ' + (r.predicted_active ? 'good' : '')}>
                        <i style={{ width: `${r.activity_probability * 100}%` }} />
                      </div>
                      <span className="num" style={{
                        color: r.predicted_active ? 'var(--good)' : 'var(--ink-muted)',
                        fontWeight: 500,
                      }}>{r.activity_probability.toFixed(3)}</span>
                    </div>
                  </td>
                  <td>
                    <span className={'badge ' + (r.predicted_active ? 'good' : '')}>
                      <span className="dot" />
                      {r.predicted_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.mw ?? '—'}</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.logp != null ? r.logp.toFixed(2) : '—'}</td>
                  <td>
                    <button
                      className="btn ghost icon sm"
                      onClick={() => onOpenDetail(r)}
                      aria-label="Open details"
                    ><Icons.chevRight size={12} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 20 && (
          <div style={{
            padding: '12px var(--pad-x)', textAlign: 'center',
            borderTop: '1px solid var(--hair)',
          }}>
            <button className="btn" onClick={onToggleExpand}>
              {expanded
                ? <><Icons.chevDown size={11} style={{ transform: 'rotate(180deg)' }} /> Show top 20</>
                : <><Icons.chevDown size={11} /> Show all {rows.length} predictions</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Docking table ─────────────────────────────────────────────────────────
function DockingTable({ rows, selected, onToggleSelected, onOpenDetail, showStructures, hoverIndex }) {
  const colorFor = (a) => {
    const v = Math.abs(a);
    if (v >= 9.5) return 'var(--heat-best)';
    if (v >= 8.0) return 'var(--heat-good)';
    if (v >= 6.5) return 'var(--heat-mid)';
    if (v >= 5.5) return 'var(--heat-poor)';
    return 'var(--heat-bad)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <ResultsToolbar
        title="Docking Results"
        count={rows.length}
        meta={[
          { l: 'best affinity', v: `${rows[0]?.affinity_kcal_mol.toFixed(1)} kcal/mol` },
          { l: 'median',        v: `${rows[Math.floor(rows.length/2)]?.affinity_kcal_mol.toFixed(1)}` },
          { l: 'exhaustiveness', v: '8' },
        ]}
      />
      <div className="scroll-y" style={{ flex: 1 }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th style={{ width: 60 }}>Rank</th>
              {showStructures && <th style={{ width: 96 }}>Structure</th>}
              <th>SMILES</th>
              <th style={{ width: 200 }}>Binding affinity</th>
              <th style={{ width: 90, textAlign: 'right' }}>Conformers</th>
              <th style={{ width: 90, textAlign: 'right' }}>RMSD (Å)</th>
              <th style={{ width: 70, textAlign: 'right' }}>H-bonds</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isSel = selected.has(r.smiles);
              const c = colorFor(r.affinity_kcal_mol);
              const hl = hoverIndex === i;
              const barT = (Math.abs(r.affinity_kcal_mol) - 4) / 8;
              return (
                <tr key={i} className={isSel ? 'selected' : ''}
                    style={hl ? { background: 'var(--surface-2)' } : {}}>
                  <td>
                    <span
                      role="checkbox"
                      aria-checked={isSel}
                      onClick={(e) => { e.stopPropagation(); onToggleSelected(r.smiles); }}
                      className="check"
                      data-on={isSel ? '1' : '0'}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.rank <= 3 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, borderRadius: 3,
                          background: r.rank === 1 ? 'var(--ink)' : 'var(--surface-2)',
                          color: r.rank === 1 ? 'var(--paper)' : 'var(--ink)',
                          border: r.rank === 1 ? 0 : '1px solid var(--hair-2)',
                          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                        }}>{r.rank}</span>
                      )}
                      {r.rank > 3 && (
                        <span className="num" style={{ color: 'var(--ink-muted)', paddingLeft: 4 }}>
                          {String(r.rank).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </td>
                  {showStructures && (
                    <td>
                      <Molecule smiles={r.smiles} size={80} height={48} tint />
                    </td>
                  )}
                  <td>
                    <button
                      onClick={() => onOpenDetail(r)}
                      style={{
                        background: 'transparent', border: 0, padding: 0,
                        font: 'inherit', fontFamily: 'var(--mono)', fontSize: 11.5,
                        color: 'var(--ink-2)', textAlign: 'left', cursor: 'pointer',
                        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', display: 'inline-block',
                      }}
                      title={r.smiles}
                    >{r.smiles}</button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        position: 'relative', width: 90, height: 5,
                        background: 'var(--hair)', borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${Math.min(100, barT * 100)}%`,
                          background: c,
                        }} />
                      </div>
                      <span className="affinity" style={{ color: c, fontWeight: 600 }}>
                        <span className="swatch" style={{ background: c }} />
                        {r.affinity_kcal_mol.toFixed(1)}
                        <span style={{ color: 'var(--ink-dim)', fontWeight: 400, fontSize: 10.5, marginLeft: 1 }}>kcal/mol</span>
                      </span>
                    </div>
                  </td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.conformers ?? '—'}</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.rmsd != null ? r.rmsd.toFixed(2) : '—'}</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{r.h_bonds ?? '—'}</td>
                  <td>
                    <button
                      className="btn ghost icon sm"
                      onClick={() => onOpenDetail(r)}
                      aria-label="Open details"
                    ><Icons.chevRight size={12} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ResultsToolbar — sits above each table ────────────────────────────────
function ResultsToolbar({ title, count, meta }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px var(--gap-lg)',
      borderBottom: '1px solid var(--hair-2)',
      background: 'var(--surface)',
      flex: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, font: '500 13.5px/1 var(--sans)', letterSpacing: '-0.005em' }}>
          {title}
          <span style={{ color: 'var(--ink-dim)', fontWeight: 400, marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 11 }}>
            n = {count}
          </span>
        </h2>
        {meta?.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span className="eyebrow" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>{m.l}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 500 }}>{m.v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="btn ghost sm"><Icons.filter size={11} /> Filter</button>
        <button className="btn ghost sm"><Icons.sortDesc size={11} /> Sort</button>
        <div style={{ width: 1, height: 18, background: 'var(--hair-2)', margin: '0 4px' }} />
        <button className="btn ghost sm"><Icons.download size={11} /> CSV</button>
        <button className="btn ghost sm"><Icons.download size={11} /> SDF</button>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid var(--hair-2)',
      background: 'var(--paper)',
      padding: '0 var(--gap-lg)',
      flex: 'none',
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            style={{
              position: 'relative',
              padding: '10px 14px',
              border: 0, background: 'transparent',
              color: on ? 'var(--ink)' : t.disabled ? 'var(--ink-faint)' : 'var(--ink-muted)',
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              borderBottom: on ? '2px solid var(--ink)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 80ms ease',
            }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: on ? 'var(--ink-muted)' : 'var(--ink-dim)',
                background: on ? 'transparent' : 'transparent',
                padding: '0 4px',
              }}>{t.count}</span>
            )}
            {t.dot && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: t.dotColor || 'var(--accent)',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Compound detail drawer ────────────────────────────────────────────────
function DetailDrawer({ compound, kind, onClose, target }) {
  if (!compound) return null;
  const isDocking = kind === 'docking';

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(14, 20, 25, 0.32)',
          zIndex: 50, animation: 'fade-in 180ms ease',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 440, background: 'var(--surface)',
          borderLeft: '1px solid var(--hair-2)',
          boxShadow: '-12px 0 32px rgba(14,20,25,0.08)',
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          animation: 'slide-in-right 240ms cubic-bezier(0.3,0.7,0.4,1)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px 14px 18px',
          borderBottom: '1px solid var(--hair-2)',
        }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5 }}>
              {isDocking ? `Pose · rank ${compound.rank}` : 'Predicted active'}
            </div>
            <h3 style={{
              margin: '2px 0 0', font: '500 15px/1.2 var(--sans)',
              letterSpacing: '-0.005em',
            }}>
              {isDocking
                ? <>Compound <span style={{ color: 'var(--ink-muted)', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 400 }}>
                    cpd-{String(compound.rank).padStart(3,'0')}
                  </span></>
                : 'Compound profile'}
            </h3>
          </div>
          <button className="btn ghost icon" onClick={onClose}><Icons.x size={13} /></button>
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: '18px' }}>
          {/* Big molecule */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--r)',
            padding: 16,
            marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Molecule smiles={compound.smiles} size={300} height={180} />
          </div>

          {/* SMILES */}
          <div style={{ marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 5 }}>SMILES</div>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--r-sm)',
            }}>
              <code style={{
                fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.5,
                color: 'var(--ink)', flex: 1, wordBreak: 'break-all',
              }}>{compound.smiles}</code>
              <button className="btn ghost icon sm" aria-label="Copy" title="Copy SMILES"
                onClick={() => navigator.clipboard?.writeText(compound.smiles)}>
                <Icons.copy size={11} />
              </button>
            </div>
          </div>

          {/* Key metric */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 12, marginBottom: 18,
          }}>
            {isDocking ? (
              <>
                <DetailMetric label="Binding affinity" big={compound.affinity_kcal_mol?.toFixed(1) ?? '—'} unit="kcal/mol" tone="good" />
                {compound.pose_score != null && <DetailMetric label="Pose score" big={compound.pose_score.toFixed(2)} />}
                {compound.rmsd != null && <DetailMetric label="RMSD" v={`${compound.rmsd.toFixed(2)} Å`} />}
                {compound.conformers != null && <DetailMetric label="Conformers" v={compound.conformers} />}
                {compound.h_bonds != null && <DetailMetric label="H-bonds" v={compound.h_bonds} />}
                <DetailMetric label="Rank"      v={`${compound.rank} of 20`} />
              </>
            ) : (
              <>
                <DetailMetric label="Activity probability" big={compound.activity_probability.toFixed(3)}
                              tone={compound.predicted_active ? 'good' : 'muted'} />
                <DetailMetric label="Prediction" v={compound.predicted_active ? 'Active' : 'Inactive'} />
                {compound.mw != null && <DetailMetric label="Mol. weight" v={`${compound.mw} g/mol`} />}
                {compound.logp != null && <DetailMetric label="cLogP" v={compound.logp.toFixed(2)} />}
                {compound.hbd != null && <DetailMetric label="HBD / HBA" v={`${compound.hbd} / ${compound.hba}`} />}
                {compound.tpsa != null && <DetailMetric label="TPSA" v={`${compound.tpsa} Å²`} />}
              </>
            )}
          </div>

          {/* Interactions (only for docking) */}
          {isDocking && (
            <div style={{ marginBottom: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Key interactions with {target?.short}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { residue: 'Tyr385', type: 'H-bond',     dist: '2.84 Å' },
                  { residue: 'Arg120', type: 'Salt bridge', dist: '3.12 Å' },
                  { residue: 'Val349', type: 'Hydrophobic', dist: '3.74 Å' },
                  { residue: 'Phe518', type: 'π-stack',     dist: '4.21 Å' },
                ].map((x, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 80px',
                    padding: '7px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 11.5, alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{x.residue}</span>
                    <span style={{ color: 'var(--ink-muted)' }}>{x.type}</span>
                    <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ink-3)' }}>{x.dist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lipinski / Lead-likeness */}
          <div style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Drug-likeness</div>
            <div style={{
              padding: '10px 12px',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--surface-2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12 }}>Lipinski Ro5</span>
                <span className="badge good"><span className="dot" /> Passes</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hair)',
              }}>
                <span style={{ fontSize: 12 }}>Veber permeability</span>
                <span className="badge good"><span className="dot" /> Passes</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hair)',
              }}>
                <span style={{ fontSize: 12 }}>PAINS filter</span>
                <span className="badge"><span className="dot" /> Clean</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }}><Icons.external size={11} /> Open in PyMOL</button>
            <button className="btn" style={{ flex: 1 }}><Icons.download size={11} /> Export pose (SDF)</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DetailMetric({ label, v, big, unit, tone }) {
  return (
    <div style={{
      padding: '10px 12px',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--r-sm)',
      background: 'var(--surface-2)',
    }}>
      <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 4 }}>{label}</div>
      {big ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="serif" style={{
            fontSize: 24, lineHeight: 1, color: tone === 'good' ? 'var(--good)' : 'var(--ink)',
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 300,
          }}>{big}</span>
          {unit && <span style={{ color: 'var(--ink-muted)', fontSize: 10.5, fontFamily: 'var(--mono)' }}>{unit}</span>}
        </div>
      ) : (
        <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{v}</div>
      )}
    </div>
  );
}

// ── Compare bar (sticky bottom) ───────────────────────────────────────────
function CompareBar({ count, onOpen, onClear }) {
  if (!count) return null;
  return (
    <div style={{
      position: 'absolute',
      left: '50%', bottom: 16, transform: 'translateX(-50%)',
      background: 'var(--ink)', color: 'var(--paper)',
      padding: '8px 8px 8px 14px',
      borderRadius: 999,
      boxShadow: '0 8px 24px rgba(14,20,25,0.25)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fade-in 200ms ease',
      zIndex: 30,
    }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>
        {count} compound{count !== 1 ? 's' : ''} selected
      </span>
      <button
        onClick={onClear}
        style={{
          background: 'transparent', border: 0, color: 'rgba(255,255,255,0.55)',
          fontSize: 11, cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >Clear</button>
      <button
        onClick={onOpen}
        style={{
          background: 'var(--accent)', border: 0, color: '#fff',
          padding: '6px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >Compare <Icons.arrowRight size={10} /></button>
    </div>
  );
}

// ── Compare overlay ────────────────────────────────────────────────────────
function CompareOverlay({ compounds, dockingResults, qsarResults, onClose }) {
  if (!compounds?.length) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14, 20, 25, 0.50)',
        zIndex: 60, animation: 'fade-in 180ms ease',
      }} />
      <div style={{
        position: 'fixed', inset: '5vh 5vw',
        background: 'var(--paper)',
        border: '1px solid var(--hair-2)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 20px 80px rgba(14,20,25,0.25)',
        zIndex: 61,
        display: 'flex', flexDirection: 'column',
        animation: 'fade-in 200ms ease',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 22px',
          borderBottom: '1px solid var(--hair-2)',
          background: 'var(--surface)',
        }}>
          <div>
            <h2 style={{ margin: 0, font: '500 16px/1.2 var(--sans)' }}>Side-by-side comparison</h2>
            <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>
              {compounds.length} compounds · QSAR + docking metrics
            </div>
          </div>
          <button className="btn ghost icon" onClick={onClose}><Icons.x size={13} /></button>
        </div>
        <div className="scroll-x" style={{
          flex: 1, display: 'flex', gap: 14, padding: 22, minHeight: 0, overflow: 'auto',
        }}>
          {compounds.map((c) => {
            const dock = dockingResults?.find(d => d.smiles === c.smiles);
            const qsar = qsarResults?.find(q => q.smiles === c.smiles);
            return (
              <div key={c.smiles + (c.id || c.rank)} style={{
                flex: '0 0 260px',
                background: 'var(--surface)',
                border: '1px solid var(--hair-2)',
                borderRadius: 'var(--r)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--hair)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    {dock && <span style={{
                      display: 'inline-grid', placeItems: 'center',
                      width: 20, height: 20, borderRadius: 3,
                      background: dock.rank === 1 ? 'var(--ink)' : 'var(--surface-2)',
                      color: dock.rank === 1 ? 'var(--paper)' : 'var(--ink)',
                      border: dock.rank === 1 ? 0 : '1px solid var(--hair-2)',
                      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                    }}>{dock.rank}</span>}
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      cpd-{String((dock?.rank || (qsar && qsarResults.indexOf(qsar) + 1)) || '?').padStart(3,'0')}
                    </span>
                  </div>
                </div>
                <div style={{ padding: 14 }}>
                  <Molecule smiles={c.smiles} size={232} height={140} tint />
                </div>
                <code style={{
                  display: 'block', padding: '0 14px 12px',
                  fontFamily: 'var(--mono)', fontSize: 10.5,
                  color: 'var(--ink-3)', wordBreak: 'break-all', lineHeight: 1.45,
                }}>{c.smiles}</code>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  borderTop: '1px solid var(--hair)',
                }}>
                  <CompareCell label="Affinity" v={dock ? `${dock.affinity_kcal_mol.toFixed(1)}` : '—'} sub="kcal/mol" tone="good" />
                  <CompareCell label="p(active)" v={qsar ? qsar.activity_probability.toFixed(3) : '—'} />
                  <CompareCell label="MW" v={qsar ? qsar.mw : '—'} sub="g/mol" />
                  <CompareCell label="cLogP" v={qsar ? qsar.logp.toFixed(2) : '—'} />
                  <CompareCell label="H-bonds" v={dock ? dock.h_bonds : '—'} />
                  <CompareCell label="RMSD" v={dock ? `${dock.rmsd.toFixed(2)}` : '—'} sub="Å" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function CompareCell({ label, v, sub, tone }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRight: '1px solid var(--hair)',
      borderBottom: '1px solid var(--hair)',
      background: 'var(--surface-2)',
    }}>
      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 13,
          color: tone === 'good' ? 'var(--good)' : 'var(--ink)',
          fontWeight: 500,
        }}>{v}</span>
        {sub && <span style={{ fontSize: 9.5, color: 'var(--ink-dim)' }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────
function EmptyState({ kind, target, onRun, runMode }) {
  if (kind === 'no-target') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 60, textAlign: 'center',
      }}>
        <div style={{
          width: 88, height: 88, marginBottom: 22,
          display: 'grid', placeItems: 'center',
          border: '1px dashed var(--hair-3)', borderRadius: '50%',
          color: 'var(--ink-dim)',
        }}>
          <Icons.dna size={32} />
        </div>
        <h2 className="serif" style={{
          margin: 0, font: '300 italic 32px/1.1 var(--serif)',
          color: 'var(--ink-3)', letterSpacing: '-0.01em',
        }}>Choose a target to begin.</h2>
        <p style={{
          margin: '14px 0 0', maxWidth: 460,
          fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.55,
        }}>
          APEX runs the full computational pipeline against any ChEMBL biological
          target — bioactivity retrieval, QSAR screening, and molecular docking
          end-to-end in a single click.
        </p>
        <div style={{
          marginTop: 24, display: 'flex', gap: 24,
          fontSize: 11.5, color: 'var(--ink-muted)', fontFamily: 'var(--mono)',
        }}>
          <span>← search by name or ChEMBL ID</span>
        </div>
      </div>
    );
  }
  if (kind === 'ready-to-run') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 60, textAlign: 'center',
      }}>
        <div style={{
          padding: '4px 10px', background: 'var(--accent-soft)', color: 'var(--accent-ink)',
          borderRadius: 999, fontSize: 10.5, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 16,
        }}>Target ready</div>
        <h2 className="serif" style={{
          margin: 0, font: '300 italic 32px/1.1 var(--serif)',
          color: 'var(--ink)', letterSpacing: '-0.01em',
        }}>
          {target.short} <span style={{ color: 'var(--ink-dim)' }}>·</span> {target.pref_name}
        </h2>
        <p style={{
          margin: '14px 0 0', maxWidth: 540,
          fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.55,
        }}>
          {target.records.toLocaleString()} bioactivity records on file. {runMode === 'auto'
            ? 'Pressing Run will train a QSAR model, predict the top-20 actives, and dock them into the binding pocket.'
            : 'You\u2019ll review QSAR predictions before triggering docking.'}
        </p>
        <button className="btn accent" onClick={onRun} style={{ marginTop: 22, height: 36, padding: '0 18px' }}>
          <Icons.play size={11} /> Run pipeline
        </button>
        <div style={{
          marginTop: 22,
          display: 'flex', gap: 18,
          fontSize: 11, color: 'var(--ink-dim)', fontFamily: 'var(--mono)',
        }}>
          <span>UniProt {target.uniprot}</span>
          <span>·</span>
          <span>PDB {target.pdb}</span>
          <span>·</span>
          <span>{target.records.toLocaleString()} records</span>
        </div>
      </div>
    );
  }
  if (kind === 'qsar-only') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 60, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56,
          display: 'grid', placeItems: 'center',
          border: '1px solid var(--hair-2)', borderRadius: 'var(--r)',
          color: 'var(--ink-dim)', marginBottom: 16,
        }}><Icons.flask size={24} /></div>
        <h3 style={{ margin: 0, font: '500 15px/1.2 var(--sans)' }}>Ready to dock</h3>
        <p style={{
          margin: '8px 0 0', maxWidth: 420, fontSize: 12.5,
          color: 'var(--ink-muted)', lineHeight: 1.5,
        }}>
          QSAR screening is done. Trigger docking to evaluate binding affinity of
          the top-20 predicted actives against {target?.short}.
        </p>
        <button className="btn primary" onClick={onRun} style={{ marginTop: 18 }}>
          <Icons.play size={11} /> Run docking
        </button>
      </div>
    );
  }
  return null;
}

// ── exports ───────────────────────────────────────────────────────────────
Object.assign(window, {
  Sidebar, TopBar, Stepper, StatusLog,
  AffinityHistogram, QsarTable, DockingTable, Tabs,
  DetailDrawer, CompareBar, CompareOverlay,
  EmptyState,
});
