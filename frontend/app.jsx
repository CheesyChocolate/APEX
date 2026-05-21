// ─────────────────────────────────────────────────────────────────────────────
// APEX — main app
// ─────────────────────────────────────────────────────────────────────────────

const { useState: aUseState, useEffect: aUseEffect, useRef: aUseRef, useMemo: aUseMemo, useCallback: aUseCallback } = React;

// Speed multiplier on the streamed log delays — < 1 makes the demo snappier
// while preserving the rhythm of each stage. Adjustable via tweaks.
const SPEED_PROFILES = {
  realistic: 1.0,
  fast:      0.4,
  instant:   0.05,
};

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // ── core state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]       = aUseState('');
  const [selectedTarget, setSelectedTarget] = aUseState(null);
  const [runMode, setRunMode]               = aUseState('auto');
  const [speedProfile, setSpeedProfile]     = aUseState('fast');

  const [pipelineStatus, setPipelineStatus] = aUseState('idle');
  // idle | running-qsar | qsar-done | running-docking | done | failed-...

  const [qsarResults, setQsarResults]       = aUseState(null);
  const [dockingResults, setDockingResults] = aUseState(null);

  const [logLines, setLogLines]             = aUseState([]);
  const [logCollapsed, setLogCollapsed]     = aUseState(false);

  const [activeTab, setActiveTab]           = aUseState('qsar');
  const [qsarExpanded, setQsarExpanded]     = aUseState(false);
  const [selectedQsar, setSelectedQsar]     = aUseState(() => new Set());
  const [selectedDocking, setSelectedDocking] = aUseState(() => new Set());
  const [detail, setDetail]                 = aUseState(null); // { compound, kind }
  const [showCompare, setShowCompare]       = aUseState(false);
  const [histHoverIdx, setHistHoverIdx]     = aUseState(null);

  const [elapsedMs, setElapsedMs]           = aUseState(0);

  // ── derived ─────────────────────────────────────────────────────────────
  const searchResults = aUseMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return TARGETS;
    return TARGETS.filter(x =>
      x.short.toLowerCase().includes(q) ||
      x.pref_name.toLowerCase().includes(q) ||
      x.target_chembl_id.toLowerCase().includes(q) ||
      x.uniprot.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const qsarDone = pipelineStatus === 'qsar-done' || pipelineStatus === 'running-docking' || pipelineStatus === 'done';
  const dockingDone = pipelineStatus === 'done';
  const isRunning = pipelineStatus === 'running-qsar' || pipelineStatus === 'running-docking';

  // total selected (across qsar + docking) for the compare bar
  const totalSelected = selectedQsar.size + selectedDocking.size;

  const compareCompounds = aUseMemo(() => {
    const out = [];
    const seen = new Set();
    // dockingResults rows are richer; prefer those when available
    if (dockingResults) {
      for (const sm of selectedDocking) {
        const row = dockingResults.find(d => d.smiles === sm);
        if (row && !seen.has(sm)) { out.push(row); seen.add(sm); }
      }
    }
    if (qsarResults) {
      for (const id of selectedQsar) {
        const row = qsarResults.find(q => q.id === id);
        if (row && !seen.has(row.smiles)) { out.push(row); seen.add(row.smiles); }
      }
    }
    return out;
  }, [selectedQsar, selectedDocking, qsarResults, dockingResults]);

  // ── elapsed timer ───────────────────────────────────────────────────────
  const startRef = aUseRef(0);
  aUseEffect(() => {
    if (!isRunning) return;
    startRef.current = performance.now();
    let raf;
    const tick = () => {
      setElapsedMs(performance.now() - startRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isRunning]);

  const formatElapsed = (ms) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // ── pipeline runner ─────────────────────────────────────────────────────
  const timersRef = aUseRef([]);
  const cancelTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const tsNow = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  };

  const streamSequence = (sequence, onDone) => {
    const speed = SPEED_PROFILES[speedProfile] ?? 0.4;
    sequence.forEach((entry) => {
      const id = setTimeout(() => {
        setLogLines(prev => [...prev, { ...entry, timestamp: tsNow() }]);
      }, entry.delay * speed);
      timersRef.current.push(id);
    });
    const lastDelay = sequence[sequence.length - 1].delay * speed + 200;
    const tid = setTimeout(onDone, lastDelay);
    timersRef.current.push(tid);
  };

  const handleRun = () => {
    if (!selectedTarget) return;
    cancelTimers();
    setQsarResults(null);
    setDockingResults(null);
    setSelectedQsar(new Set());
    setSelectedDocking(new Set());
    setLogLines([]);
    setLogCollapsed(false);
    setActiveTab('qsar');
    setPipelineStatus('running-qsar');
    setElapsedMs(0);

    streamSequence(QSAR_LOG_SEQUENCE(selectedTarget), () => {
      const qsar = generateQsarPredictions(selectedTarget.target_chembl_id, 40);
      setQsarResults(qsar);
      setPipelineStatus('qsar-done');
      if (runMode === 'auto') {
        // continue automatically
        setTimeout(() => runDocking(qsar), 300);
      }
    });
  };

  const runDocking = (qsarOrNull) => {
    const qsar = qsarOrNull || qsarResults;
    if (!qsar) return;
    cancelTimers();
    setPipelineStatus('running-docking');
    setActiveTab('docking');
    setLogLines(prev => [...prev, { level: 'info', text: '', timestamp: '', _sep: true }]);
    streamSequence(DOCKING_LOG_SEQUENCE(selectedTarget), () => {
      const top20 = qsar.slice(0, 20).map(r => r.smiles);
      const docking = generateDockingResults(selectedTarget.target_chembl_id, top20);
      setDockingResults(docking);
      setPipelineStatus('done');
    });
  };

  const handleCancel = () => {
    cancelTimers();
    setPipelineStatus(qsarDone && !dockingDone ? 'qsar-done' : 'idle');
    setLogLines(prev => [...prev, { level: 'err', text: '✕ cancelled by user', timestamp: tsNow() }]);
  };

  const handleReset = () => {
    cancelTimers();
    setPipelineStatus('idle');
    setQsarResults(null);
    setDockingResults(null);
    setSelectedQsar(new Set());
    setSelectedDocking(new Set());
    setLogLines([]);
    setElapsedMs(0);
  };

  // close timers on unmount
  aUseEffect(() => cancelTimers, []);

  // ── selectors ───────────────────────────────────────────────────────────
  const toggleQsar = (id) => {
    setSelectedQsar(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleDocking = (smiles) => {
    setSelectedDocking(prev => {
      const next = new Set(prev);
      if (next.has(smiles)) next.delete(smiles); else next.add(smiles);
      return next;
    });
  };
  const clearSelections = () => {
    setSelectedQsar(new Set());
    setSelectedDocking(new Set());
  };

  // ── target change resets results ────────────────────────────────────────
  const handleSelectTarget = (target) => {
    if (target?.target_chembl_id === selectedTarget?.target_chembl_id) return;
    cancelTimers();
    setSelectedTarget(target);
    setPipelineStatus('idle');
    setQsarResults(null);
    setDockingResults(null);
    setSelectedQsar(new Set());
    setSelectedDocking(new Set());
    setLogLines([]);
    setActiveTab('qsar');
    setElapsedMs(0);
  };

  const handleSelectRun = (run) => {
    const target = TARGETS.find(t => t.target_chembl_id === run.target);
    if (target) handleSelectTarget(target);
  };

  // ── style: apply accent and density via root vars ───────────────────────
  aUseEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
    // derive accent-ink (slightly darker) and accent-soft
    const hex = t.accent.replace('#','');
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    const darker = (c) => Math.max(0, Math.round(c * 0.72));
    document.documentElement.style.setProperty(
      '--accent-ink',
      `rgb(${darker(r)}, ${darker(g)}, ${darker(b)})`,
    );
    document.documentElement.style.setProperty(
      '--accent-soft',
      `rgba(${r}, ${g}, ${b}, 0.10)`,
    );
    document.documentElement.style.setProperty(
      '--accent-line',
      `rgba(${r}, ${g}, ${b}, 0.30)`,
    );
  }, [t.accent]);

  aUseEffect(() => {
    document.documentElement.setAttribute('data-density', t.density);
  }, [t.density]);

  // ── render ──────────────────────────────────────────────────────────────
  const tabs = [
    {
      id: 'qsar',
      label: 'QSAR',
      icon: <Icons.dna size={11} />,
      count: qsarResults ? qsarResults.length : undefined,
      dot: pipelineStatus === 'running-qsar',
      dotColor: 'var(--accent)',
    },
    {
      id: 'docking',
      label: 'Docking',
      icon: <Icons.flask size={11} />,
      count: dockingResults ? dockingResults.length : undefined,
      disabled: !qsarDone,
      dot: pipelineStatus === 'running-docking',
      dotColor: 'var(--accent)',
    },
  ];

  return (
    <div className="app" style={{ position: 'relative' }}>

      <Sidebar
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        searchResults={searchResults}
        selectedTarget={selectedTarget}
        onSelectTarget={handleSelectTarget}
        recentRuns={RECENT_RUNS}
        onSelectRun={handleSelectRun}
        apiHealth="ok"
        showHistory={t.showHistory}
      />

      <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>

        <TopBar
          target={selectedTarget}
          runMode={runMode}
          onRunModeChange={setRunMode}
          pipelineStatus={pipelineStatus}
          onRun={handleRun}
          onCancel={handleCancel}
          onReset={handleReset}
          qsarDone={qsarDone}
          dockingDone={dockingDone}
        />

        {/* Pipeline visualization */}
        {t.pipelineViz === 'stepper' && (
          <Stepper
            pipelineStatus={pipelineStatus}
            target={selectedTarget}
            qsarCount={qsarResults?.length || 0}
            dockingCount={dockingResults?.length || 0}
            elapsed={formatElapsed(elapsedMs)}
          />
        )}

        {/* Status log — shown when running, dock complete, or has content */}
        {(isRunning || logLines.length > 0) && (
          <StatusLog
            lines={logLines.filter(l => !l._sep)}
            isRunning={isRunning}
            collapsed={logCollapsed}
            onCollapse={() => setLogCollapsed(c => !c)}
          />
        )}

        {/* Workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>

          {!selectedTarget ? (
            <EmptyState kind="no-target" />
          ) : (pipelineStatus === 'idle' && !qsarResults) ? (
            <EmptyState kind="ready-to-run" target={selectedTarget} onRun={handleRun} runMode={runMode} />
          ) : (
            <>
              <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

              {activeTab === 'qsar' && qsarResults && (
                <QsarTable
                  rows={qsarResults}
                  expanded={qsarExpanded}
                  onToggleExpand={() => setQsarExpanded(x => !x)}
                  selected={selectedQsar}
                  onToggleSelected={toggleQsar}
                  onOpenDetail={(c) => setDetail({ compound: c, kind: 'qsar' })}
                  showStructures={t.showStructures}
                />
              )}

              {activeTab === 'qsar' && !qsarResults && isRunning && (
                <SkeletonTable kind="qsar" />
              )}

              {activeTab === 'docking' && dockingResults && (
                <>
                  <AffinityHistogram
                    results={dockingResults}
                    onHover={(r) => setHistHoverIdx(r ? dockingResults.indexOf(r) : null)}
                  />
                  <DockingTable
                    rows={dockingResults}
                    selected={selectedDocking}
                    onToggleSelected={toggleDocking}
                    onOpenDetail={(c) => setDetail({ compound: c, kind: 'docking' })}
                    showStructures={t.showStructures}
                    hoverIndex={histHoverIdx}
                  />
                </>
              )}

              {activeTab === 'docking' && !dockingResults && (
                pipelineStatus === 'running-docking'
                  ? <SkeletonTable kind="docking" />
                  : (qsarDone && runMode === 'manual')
                    ? <EmptyState kind="qsar-only" target={selectedTarget} onRun={() => runDocking()} />
                    : null
              )}
            </>
          )}

          <CompareBar
            count={totalSelected}
            onOpen={() => setShowCompare(true)}
            onClear={clearSelections}
          />
        </div>
      </main>

      <DetailDrawer
        compound={detail?.compound}
        kind={detail?.kind}
        target={selectedTarget}
        onClose={() => setDetail(null)}
      />

      {showCompare && (
        <CompareOverlay
          compounds={compareCompounds}
          dockingResults={dockingResults}
          qsarResults={qsarResults}
          onClose={() => setShowCompare(false)}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance">
          <TweakColor
            label="Accent"
            value={t.accent}
            options={['#1E4FFF', '#0E7C66', '#A0321F', '#7A5AE0', '#0E1419']}
            onChange={(v) => setTweak('accent', v)}
          />
          <TweakRadio
            label="Density"
            value={t.density}
            options={['compact', 'regular', 'comfy']}
            onChange={(v) => setTweak('density', v)}
          />
        </TweakSection>
        <TweakSection label="Pipeline">
          <TweakSelect
            label="Visualization"
            value={t.pipelineViz}
            options={[
              { value: 'stepper', label: 'Stepper bar' },
              { value: 'minimal', label: 'Hidden (log only)' },
            ]}
            onChange={(v) => setTweak('pipelineViz', v)}
          />
          <TweakSelect
            label="Simulation speed"
            value={speedProfile}
            options={[
              { value: 'realistic', label: 'Realistic (~14s)' },
              { value: 'fast',      label: 'Fast (~5s)' },
              { value: 'instant',   label: 'Instant' },
            ]}
            onChange={setSpeedProfile}
          />
        </TweakSection>
        <TweakSection label="Tables">
          <TweakToggle label="Show structures"
            value={t.showStructures} onChange={(v) => setTweak('showStructures', v)} />
          <TweakToggle label="Recent runs panel"
            value={t.showHistory} onChange={(v) => setTweak('showHistory', v)} />
        </TweakSection>
        <TweakSection label="Demo">
          <TweakButton label="Run pipeline" onClick={handleRun} />
          <TweakButton label="Reset" secondary onClick={handleReset} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ── Skeleton tables shown while a stage is running ──────────────────────────
function SkeletonTable({ kind }) {
  const rows = kind === 'qsar' ? 8 : 6;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px var(--gap-lg)',
        borderBottom: '1px solid var(--hair-2)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="spinner" />
          <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            {kind === 'qsar' ? 'Training QSAR model…' : 'Running docking simulations…'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
          this may take a few minutes
        </span>
      </div>
      <div style={{ padding: '0 var(--gap-lg)', flex: 1 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 0',
            borderBottom: '1px solid var(--hair)',
            opacity: 1 - i * 0.08,
          }}>
            <div style={{ width: 14, height: 14, background: 'var(--hair)', borderRadius: 3 }} />
            <div style={{ width: 26, height: 10, background: 'var(--hair)', borderRadius: 2 }} />
            <div className="shimmer-bg" style={{ width: 80, height: 48, borderRadius: 3 }} />
            <div className="shimmer-bg" style={{ flex: 1, height: 10, borderRadius: 2 }} />
            <div className="shimmer-bg" style={{ width: 90, height: 10, borderRadius: 2 }} />
            <div style={{ width: 56, height: 16, background: 'var(--hair)', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
