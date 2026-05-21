// Mock data for the APEX prototype.
// Targets are real ChEMBL IDs so the demo feels grounded; predictions are
// generated deterministically per target so re-running shows consistent data.

const TARGETS = [
  { target_chembl_id: 'CHEMBL230',  pref_name: 'Prostaglandin G/H synthase 2',  short: 'COX-2',   target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P35354', pdb: '5KIR', records: 4127 },
  { target_chembl_id: 'CHEMBL203',  pref_name: 'Epidermal growth factor receptor erbB1', short: 'EGFR', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P00533', pdb: '1M17', records: 9842 },
  { target_chembl_id: 'CHEMBL279',  pref_name: 'Vascular endothelial growth factor receptor 2', short: 'VEGFR2', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P35968', pdb: '4ASD', records: 6210 },
  { target_chembl_id: 'CHEMBL1824', pref_name: 'Receptor protein-tyrosine kinase erbB-2', short: 'HER2', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P04626', pdb: '3PP0', records: 3402 },
  { target_chembl_id: 'CHEMBL2363', pref_name: 'Tyrosine-protein kinase JAK2', short: 'JAK2', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'O60674', pdb: '4FVQ', records: 5188 },
  { target_chembl_id: 'CHEMBL333',  pref_name: 'Matrix metalloproteinase-9', short: 'MMP-9', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P14780', pdb: '1L6J', records: 2914 },
  { target_chembl_id: 'CHEMBL3837', pref_name: 'Histone deacetylase 6', short: 'HDAC6', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'Q9UBN7', pdb: '5EDU', records: 2087 },
  { target_chembl_id: 'CHEMBL204',  pref_name: 'Thrombin', short: 'F2', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P00734', pdb: '1A2C', records: 7411 },
  { target_chembl_id: 'CHEMBL244',  pref_name: 'Coagulation factor X', short: 'F10', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P00742', pdb: '1F0R', records: 5662 },
  { target_chembl_id: 'CHEMBL1075145', pref_name: 'Cyclin-dependent kinase 9', short: 'CDK9', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P50750', pdb: '3BLR', records: 1842 },
  { target_chembl_id: 'CHEMBL3308', pref_name: 'Phosphatidylinositol-4,5-bisphosphate 3-kinase α', short: 'PI3Kα', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'P42336', pdb: '4JPS', records: 4523 },
  { target_chembl_id: 'CHEMBL3717', pref_name: 'Bromodomain-containing protein 4', short: 'BRD4', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens', uniprot: 'O60885', pdb: '3MXF', records: 2876 },
];

// Realistic-looking SMILES strings for display (no chemistry inferred — these
// just need to render as believable strings in the table).
const SMILES_POOL = [
  'CC(=O)OC1=CC=CC=C1C(=O)O',
  'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O',
  'CN1CCC[C@H]1C2=CC=CN=C2',
  'CC(=O)NC1=CC=C(C=C1)O',
  'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
  'CC(C)NCC(O)COc1cccc2ccccc12',
  'COc1ccc2nc(S(=O)Cc3ncc(C)c(OC)c3C)[nH]c2c1',
  'CC(C)(C)NCC(O)c1ccc(O)c(CO)c1',
  'OC(=O)Cc1ccc(N=Nc2ccc(S(N)(=O)=O)cc2)cc1',
  'Clc1ccc2c(c1)NC(=O)C(=O)N2c1ccc(F)cc1',
  'COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1',
  'CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O',
  'Fc1ccc(-c2nn(C3CCN(Cc4ccccc4)CC3)c3ncnc(N)c23)cc1',
  'CC(C)c1nc(N(C)CCN(C)C2CCN(C)CC2)nc(-c2ccc(O)cc2)c1F',
  'OC1=C(C(=O)c2ccccc2)c2ccccc2OC1=O',
  'N#Cc1ccc(N2CCN(c3ccc(F)cc3)CC2)nc1',
  'CC(C)(C)c1cc(C(=O)Nc2ccc(C(F)(F)F)cn2)c(O)c(C(C)(C)C)c1',
  'COc1ccc(/C=C/C(=O)c2ccc(N(C)C)cc2)cc1',
  'O=C1N(Cc2ccccc2)C(=O)C(=Cc2cc3OCOc3cc2)C1',
  'CC(=O)Nc1nnc(S(N)(=O)=O)s1',
  'CC1=C(CCC(O)=O)C2=CC=C(O)C(I)=C2OC1=O',
  'COC(=O)C1=C(C)NC(=C(C1c1ccccc1[N+](=O)[O-])C(=O)OC)C',
  'OC(C(=O)NC1=CC=C(O)C=C1)C2=CC(O)=C(O)C=C2',
  'CCN(CC)CCNC(=O)c1ccc(N)cc1',
  'CC(C)c1ccc(C(C)C(=O)O)cc1',
  'CC(=O)NC1=NN=C(S(N)(=O)=O)S1',
  'Brc1ccc(-c2nc3cccnc3[nH]2)cc1',
  'OCC(O)C(O)C(O)C(O)CO',
  'CCN1CCN(c2nc(N)c3cc(OC)c(OC)cc3n2)CC1',
  'COc1cc(/C=C2\\SC(=S)NC2=O)ccc1O',
];

// Simple deterministic hash (FNV-1a) — used for seeded RNG and to assign
// stable molecule thumbnails per SMILES across renders.
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32 PRNG seeded by hash(seedStr).
function makeRng(seedStr) {
  let a = hash32(seedStr) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate QSAR predictions for a target. Deterministic per target.
function generateQsarPredictions(targetId, count = 40) {
  const rng = makeRng('qsar:' + targetId);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const smiles = SMILES_POOL[Math.floor(rng() * SMILES_POOL.length)];
    // Mostly-active distribution skewed toward higher probabilities for the
    // top-N feel; tail of inactives at the bottom.
    let p;
    if (i < 8)        p = 0.85 + rng() * 0.14;
    else if (i < 20)  p = 0.62 + rng() * 0.23;
    else if (i < 30)  p = 0.45 + rng() * 0.18;
    else              p = 0.25 + rng() * 0.20;
    p = Math.round(p * 1000) / 1000;
    rows.push({
      id: `${targetId}-q${i}`,
      smiles,
      activity_probability: p,
      predicted_active: p > 0.5,
      // Extra derived data shown in the detail drawer
      mw: 180 + Math.floor(rng() * 320),
      logp: Math.round((rng() * 6 - 0.5) * 100) / 100,
      hbd: Math.floor(rng() * 5),
      hba: Math.floor(rng() * 9),
      tpsa: Math.round(20 + rng() * 100),
    });
  }
  // sort by probability desc
  rows.sort((a, b) => b.activity_probability - a.activity_probability);
  return rows;
}

// Generate docking results from a list of SMILES.
function generateDockingResults(targetId, smilesList) {
  const rng = makeRng('dock:' + targetId);
  const rows = smilesList.map((smiles, i) => {
    // Affinity range -5 to -11; top-ranked get better.
    const base = -6 - rng() * 4.2;
    return {
      smiles,
      affinity_kcal_mol: Math.round(base * 10) / 10,
      rank: 0, // assigned after sort
      error: null,
      // extra
      conformers: 3 + Math.floor(rng() * 6),
      rmsd: Math.round(rng() * 200) / 100,
      h_bonds: Math.floor(rng() * 5),
      pose_score: Math.round((0.6 + rng() * 0.4) * 100) / 100,
    };
  });
  rows.sort((a, b) => a.affinity_kcal_mol - b.affinity_kcal_mol);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

// Pipeline log lines that stream in during a run.
const QSAR_LOG_SEQUENCE = (target) => [
  { delay: 0,    level: 'info',  text: `→ POST /qsar/${target.target_chembl_id}` },
  { delay: 280,  level: 'info',  text: `Connecting to ChEMBL release_34 (https://www.ebi.ac.uk/chembl/api)` },
  { delay: 520,  level: 'ok',    text: `Connected · latency 142ms` },
  { delay: 720,  level: 'info',  text: `Fetching bioactivity records for ${target.short} (${target.target_chembl_id})…` },
  { delay: 1450, level: 'info',  text: `  retrieved ${target.records.toLocaleString()} IC50 measurements` },
  { delay: 1700, level: 'info',  text: `  filtering: pchembl_value ≥ 5.0, assay_type = B, standard_units = nM` },
  { delay: 2050, level: 'info',  text: `  retained ${Math.floor(target.records * 0.62).toLocaleString()} records after QC` },
  { delay: 2300, level: 'info',  text: `Standardizing structures (RDKit · MolStandardize)` },
  { delay: 2700, level: 'info',  text: `  removed salts · neutralized charges · canonicalized tautomers` },
  { delay: 3050, level: 'info',  text: `Computing Morgan fingerprints (radius=2, n_bits=2048)` },
  { delay: 3450, level: 'info',  text: `Train/test split 80/20 · stratified · seed=42` },
  { delay: 3700, level: 'info',  text: `Training RandomForestClassifier(n_estimators=500, max_depth=12)` },
  { delay: 5200, level: 'ok',    text: `  fit in 1.42s · OOB score = 0.847` },
  { delay: 5500, level: 'info',  text: `5-fold CV: ROC-AUC = 0.86 ± 0.02 · MCC = 0.61 ± 0.03` },
  { delay: 5800, level: 'info',  text: `Predicting on virtual library (Enamine REAL · 12,847 cmpds)` },
  { delay: 6800, level: 'info',  text: `  identified 2,847 predicted actives (p > 0.5)` },
  { delay: 7050, level: 'ok',    text: `QSAR pipeline complete · 7.3s · top-20 selected for docking` },
];

const DOCKING_LOG_SEQUENCE = (target) => [
  { delay: 0,    level: 'info',  text: `→ POST /docking/  uniprot=${target.uniprot}  n_ligands=20` },
  { delay: 320,  level: 'info',  text: `Resolving structure for UniProt ${target.uniprot}…` },
  { delay: 700,  level: 'ok',    text: `  PDB ${target.pdb} selected · resolution 2.1 Å` },
  { delay: 950,  level: 'info',  text: `Preparing receptor (PDB2PQR · pH 7.4 · PROPKA3)` },
  { delay: 1450, level: 'info',  text: `Detecting binding pocket via fpocket` },
  { delay: 1800, level: 'ok',    text: `  pocket #1: 982 Å³ · druggability score 0.84` },
  { delay: 2100, level: 'info',  text: `Generating 3D conformers (RDKit ETKDGv3 · 5 each)` },
  { delay: 2700, level: 'info',  text: `Docking with AutoDock Vina · exhaustiveness 8` },
  { delay: 3200, level: 'info',  text: `  [001/020] ████░░░░░░  affinity = -7.8 kcal/mol` },
  { delay: 3700, level: 'info',  text: `  [005/020] ████████░░  affinity = -9.1 kcal/mol` },
  { delay: 4400, level: 'info',  text: `  [010/020] █████████░  affinity = -8.4 kcal/mol` },
  { delay: 5100, level: 'info',  text: `  [015/020] █████████░  affinity = -10.0 kcal/mol` },
  { delay: 5700, level: 'info',  text: `  [020/020] ██████████  complete` },
  { delay: 6000, level: 'info',  text: `Scoring poses · clustering · RMSD-based deduplication` },
  { delay: 6300, level: 'ok',    text: `Docking complete · 6.3s · top affinity = -10.4 kcal/mol` },
];

// Recent runs — purely cosmetic history sidebar entries.
const RECENT_RUNS = [
  { id: 'r-018', target: 'CHEMBL230',  short: 'COX-2',  when: '14 min ago',   status: 'done' },
  { id: 'r-017', target: 'CHEMBL203',  short: 'EGFR',   when: '2 hours ago',  status: 'done' },
  { id: 'r-016', target: 'CHEMBL2363', short: 'JAK2',   when: 'Yesterday',    status: 'done' },
  { id: 'r-015', target: 'CHEMBL3717', short: 'BRD4',   when: 'Yesterday',    status: 'failed' },
  { id: 'r-014', target: 'CHEMBL1824', short: 'HER2',   when: '2 days ago',   status: 'done' },
  { id: 'r-013', target: 'CHEMBL204',  short: 'F2',     when: '4 days ago',   status: 'done' },
  { id: 'r-012', target: 'CHEMBL3837', short: 'HDAC6',  when: 'Last week',    status: 'done' },
];

Object.assign(window, {
  TARGETS,
  SMILES_POOL,
  hash32,
  makeRng,
  generateQsarPredictions,
  generateDockingResults,
  QSAR_LOG_SEQUENCE,
  DOCKING_LOG_SEQUENCE,
  RECENT_RUNS,
});
