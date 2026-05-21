# APEX: Automated Pipeline for Explorative Drug Discovery — Teleprompter

---

## Slide 1: APEX: Automated Pipeline for Explorative Drug Discovery

What you're looking at today is a platform that automates the computationally intensive part of early-stage drug discovery — taking a biological target as input and returning a ranked list of structurally diverse, drug-like small molecule candidates, each with a predicted binding affinity. That process normally requires a specialist configuring separate tools for data retrieval, machine learning, and docking. APEX compresses it into a single automated pipeline that runs in under ten minutes for any target in ChEMBL.

The full name is APEX: Automated Pipeline for Explorative drug discovery. The word "explorative" is deliberate. This isn't a tool hardwired to one disease area or one target class. It connects to live bioactivity databases, trains a machine learning model on the fly against whatever target you provide, and feeds the top predictions into a physics-based binding simulation.

I'll walk you through the motivation, the technical architecture of each stage, the design decisions we made and why, results on a real oncology target, and the web interface. There's a fair amount of algorithmic detail here since I know this audience wants to go beyond the surface.

**NEXT SLIDE**

---

## Slide 2: Outline

The talk follows the pipeline itself from left to right. We start with the problem APEX is solving, then go stage by stage: data ingestion, QSAR model architecture and training, candidate pre-selection, molecular docking, and finally the web platform. We'll anchor the discussion in concrete results on CDK2, a well-characterized kinase involved in cell-cycle regulation and a standard benchmark for computational drug discovery tools.

Each section builds on the previous one, so by the end you should have a complete mental model of every decision in the stack — what goes in, what comes out, and what assumptions each component makes.

**NEXT SLIDE**

---

## Slide 3: The Drug Discovery Challenge

The numbers are familiar but still striking. Roughly twelve to fifteen years from target identification to regulatory approval, and around two and a half billion dollars per drug that makes it through — most of that cost absorbed by the compounds that fail late in clinical trials, not the eventual winner.

The fundamental constraint is the size of chemical space. Drug-like molecules occupy an estimated 10 to the 60 compounds. Wet-lab high-throughput screening can handle at most a few million compounds, and only with significant infrastructure. Computational pre-filtering is how you make that search tractable — identify the most promising candidates so the wet lab tests those rather than sampling randomly.

The gap APEX addresses is automation. Existing tools like AutoDock Vina, RDKit, and ChEMBL are all mature and well-validated individually. But connecting them into a working pipeline for a new target has always required expert-level manual configuration: downloading structures, writing preprocessing scripts, tuning model hyperparameters, interpreting docking inputs. APEX wraps all of that into a single REST API call.

**NEXT SLIDE**

---

## Slide 4: APEX End-to-End Workflow

The pipeline has seven stages. The user provides one input: a ChEMBL target ID or a target name. Everything downstream is automated.

Stage one is the ChEMBL fetch. The platform queries the ChEMBL REST API for all IC50 bioactivity records against that target — human assays, nanomolar units. These results are written to a local SQLite cache so that the expensive API call only happens once per target.

Stage two is preprocessing. Raw ChEMBL data is noisy: duplicate SMILES representing the same scaffold under different notation, IC50 measurements in the ambiguous one-to-ten micromolar range that are neither clearly active nor inactive, and some invalid SMILES that RDKit cannot parse. All of this is cleaned before any model training.

Stage three is QSAR training and prediction. A Random Forest classifier is trained on molecular fingerprints plus physicochemical descriptors, evaluated by five-fold cross-validation, then used to score the entire compound set by predicted activity probability.

Stage four is candidate pre-selection. QSAR ranking alone can produce twenty structurally identical compounds. We apply a Lipinski drug-likeness filter followed by a greedy diversity selection to ensure the top twenty cover distinct regions of chemical space.

Stages five through seven are structure fetch, AutoDock Vina docking, and the ranked output returned to the frontend.

**NEXT SLIDE**

---

## Slide 5: ChEMBL Bioactivity Layer

ChEMBL is the world's largest manually curated bioactivity database — over nineteen million measurements across more than two million compounds. APEX queries it via its REST API, filtering to IC50 measurements from human assays reported in nanomolar units. That filtering alone typically reduces the raw dataset by thirty to fifty percent before we write a single record to disk.

The preprocessing pipeline has several technically important steps. First, SMILES validation: every canonical SMILES string is parsed by RDKit's MolFromSmiles. Invalid strings are silently dropped.

Second, fingerprint-based deduplication. Simply dropping duplicate SMILES strings is insufficient because the same molecular scaffold can appear under different SMILES representations — different atom orderings, different stereochemistry specification, tautomers. We compute a Morgan fingerprint for each valid molecule and use the bit-string as the deduplication key. This catches duplicates that SMILES comparison misses.

Third, grey-zone dropping. Compounds with IC50 between one thousand and ten thousand nanomolar occupy a decision boundary that the binary classifier has no principled way to resolve. Including them during training increases label noise without adding useful signal. We drop them entirely.

The remaining compounds are labeled: at or below one thousand nanomolar is active, above ten thousand is inactive. The data is then stratified and split eighty-twenty into training and test sets.

**NEXT SLIDE**

---

## Slide 6: QSAR Model Architecture

QSAR — Quantitative Structure-Activity Relationship — is the idea that a molecule's biological activity is determined by its structure, and that structure can be encoded numerically for a machine learning model.

APEX uses two complementary feature types. The primary feature is a Morgan fingerprint with radius two and 1024 bits. Morgan fingerprints are circular: they encode the local chemical environment around each atom by iteratively hashing the environments of neighboring atoms out to the specified bond radius. The result is a binary vector where each bit represents the presence or absence of a particular structural motif. They're invariant to SMILES notation, computationally cheap, and have strong empirical track records on bioactivity prediction.

The secondary features are six physicochemical descriptors computed by RDKit: molecular weight, partition coefficient LogP, hydrogen bond donor count, hydrogen bond acceptor count, number of rotatable bonds, and number of aromatic rings. These capture properties orthogonal to fingerprints — particularly membrane permeability and conformational flexibility. Concatenated, the full feature vector is 1030-dimensional.

The classifier is a Random Forest with 200 trees. We chose classification over regression for a specific reason: IC50 values in ChEMBL come from many different assay formats and measurement protocols. The absolute numeric value is noisy across assays even for the same compound. Binary classification is more robust to that inter-assay noise. Additionally, RandomForest's predict_proba output already provides a continuous probability score that we can rank — so we don't lose the ranking capability that regression would theoretically offer.

**NEXT SLIDE**

---

## Slide 7: QSAR Screening Results

These two panels show the model output for CDK2. The training set contained 798 compounds, the test set 200.

The left panel shows the predicted activity probability distribution, split by ground-truth label. The green distribution is compounds the model assigned high probability of activity; red is the inactive distribution. Notice the clean bimodal separation — active compounds cluster above 0.7, inactives cluster below 0.2. The overlap region around 0.4 to 0.6 is where the model is genuinely uncertain, which is expected: these are compounds near the one-micromolar IC50 boundary where the chemistry is borderline.

The right panel ranks the top twenty predicted actives by probability score. Every compound exceeds the 0.5 decision threshold. The color coding distinguishes true positives from predicted actives that were labeled inactive in the test set.

For CDK2, the cross-validated ROC-AUC is 0.943 with a standard deviation of 0.012 across folds. The test-set F1 score is 0.901. These are strong numbers for a 1030-dimensional dataset of roughly a thousand compounds, and they replicate consistently across reruns because of the fixed random seed.

**NEXT SLIDE**

---

## Slide 8: Candidate Pre-selection: Drug-likeness \& Diversity

Before anything goes to docking, we apply a two-step pre-selection filter. This step exists because naive top-N selection by QSAR probability alone sends redundant compounds to the docking engine — the top twenty by probability might all share the same core scaffold, which means Vina is running twenty times for what is effectively one binding hypothesis.

Step one is the Lipinski Rule of Five filter. This is the classic oral bioavailability heuristic: molecular weight below 500 daltons, LogP below 5, no more than five hydrogen bond donors, no more than ten hydrogen bond acceptors, and TPSA below 140 square angstroms. Any predicted active that fails these criteria is removed from the candidate pool. We have the descriptor values already from featurization, so this filter costs nothing computationally.

Step two is max-min diversity selection. This is a greedy farthest-point algorithm operating on Tanimoto distances over Morgan fingerprints. We seed with the highest-probability drug-like compound, then iteratively select the compound that maximizes the minimum Tanimoto distance to all already-selected compounds. The Tanimoto distance is one minus the Jaccard similarity of the fingerprint bit vectors. This runs in O(n times k) time — fast enough to be imperceptible in the pipeline.

The result is a set of twenty compounds that are simultaneously drug-like, predicted active, and maximally structurally distinct from each other — which maximises the chemical space explored in the docking run.

**NEXT SLIDE**

---

## Slide 9: AutoDock Vina: Molecule Preparation

Molecular docking answers a different question than QSAR. Where QSAR asks "does this molecule look like known actives?", docking asks "can this molecule physically fit into the target's binding site, and if so, how tightly?"

Before Vina can run, both ligand and receptor must be in PDBQT format, which encodes Gasteiger partial charges and marks rotatable bonds for the conformational search. For ligands, APEX starts from the SMILES string. RDKit's ETKDGv3 algorithm generates a three-dimensional conformer using distance geometry with torsion-angle constraints from the Cambridge Structural Database — producing geometrically realistic conformers rather than just strain-minimized ones. MMFF94 force-field minimization then relaxes the geometry. Open Babel handles the final conversion to PDBQT with the gen3d flag.

For the receptor, the protein structure is fetched from AlphaFold or the RCSB PDB as described earlier. Open Babel's receptor mode strips waters and non-standard residues during PDBQT conversion. The binding box is estimated in two tiers. If the receptor PDB already contains a co-crystal ligand recorded as HETATM atoms, we use that ligand's geometric centroid as the box center — this is the standard approach for structure-based docking because it places the search space directly over the experimentally confirmed binding site. If no co-crystal ligand is present, which is the common case for AlphaFold-predicted structures, we fall back to the protein's geometric centroid with ten angstrom padding per axis, capped at thirty angstroms. Users who know the binding site from literature can also supply explicit box coordinates via the API.

**NEXT SLIDE**

---

## Slide 10: AutoDock Vina: Scoring \& Search

Vina's scoring function is an empirical weighted sum of five energy terms. The steric term uses a Gaussian function of interatomic distance to capture van der Waals repulsion and attraction. The hydrogen-bond term rewards geometrically favorable donor-acceptor contacts. The hydrophobic term rewards contacts between non-polar atoms, encoding the desolvation contribution to binding. The torsional entropy penalty accounts for the loss of conformational freedom when a flexible ligand binds — more rotatable bonds means a larger entropy cost. The output is a predicted binding free energy in kilocalories per mole.

The practical scale: values at or below minus nine kilocalories per mole correspond roughly to dissociation constants in the low nanomolar range, which is the target affinity for a useful drug lead. Values around minus seven to minus eight are moderate; values above minus five are weak binders that would not typically proceed in a drug discovery campaign.

Exhaustiveness controls how many independent Monte Carlo optimization runs Vina performs. The default of eight is a reasonable trade-off between thoroughness and runtime. For each ligand, up to five poses are returned, ranked by score. We report the best score as the primary affinity and use the RMSD between poses as a measure of docking confidence — tightly clustered poses suggest the model is confident about the binding mode.

It's worth being explicit about the limitation: Vina's score is a scoring function approximation, not a quantum-mechanical free energy calculation. It correlates with experimental data in large benchmarks but false positives are common, particularly against AlphaFold-predicted structures where the binding pocket geometry has not been experimentally validated. Treat the docking step as a further filter that re-ranks candidates by structural complementarity — not as a final verdict on biological activity.

**NEXT SLIDE**

---

## Slide 11: Docking Results

These plots show the docking output for the CDK2 case study. Twenty compounds, pre-selected by Lipinski filter and max-min diversity, were docked against the CDK2 AlphaFold structure.

The left panel is the binding affinity distribution. The cluster between minus seven and minus ten kilocalories per mole is a realistic distribution for drug-like molecules against a kinase ATP-binding site. The red dashed line marks the median at minus 8.2 kilocalories per mole.

The right panel ranks the twenty hits explicitly. Three compounds score below minus nine — the strong-binder threshold — with the top hit reaching minus 9.5 kilocalories per mole. These three are the candidates that would move to experimental validation in a real campaign.

**NEXT SLIDE**

---

## Slide 12: Case Study — Cyclin-Dependent Kinase 2 (CDK2)

CDK2 is a serine/threonine kinase that drives the G1-to-S transition in the cell cycle. Its overexpression or deregulation is implicated in a wide range of cancers, and it has been one of the most intensively studied kinase targets in oncology for the past twenty years. For our purposes it's an ideal validation target: thousands of published bioactivity measurements in ChEMBL, extensive structural coverage in the PDB, and well-established SAR.

The APEX run on CDK2 retrieved 998 IC50 measurements from ChEMBL on the first fetch, which took 110 seconds. After preprocessing — SMILES validation, fingerprint deduplication, grey-zone dropping — the dataset was split into 798 training and 200 test compounds. The QSAR model trained in under thirty seconds and achieved CV AUC 0.943 and F1 0.901.

Twenty compounds were pre-selected by Lipinski filter and max-min diversity from the top QSAR actives. The docking run against the AlphaFold P24941 structure completed in roughly five minutes for twenty ligands. The top hit achieved minus 9.478 kilocalories per mole, with three of the twenty compounds below minus nine.

Total wall-clock time from target ID to ranked docking results, excluding the one-time ChEMBL cache build, is under four minutes.

**NEXT SLIDE**

---

## Slide 13: APEX Web Platform

The platform exposes the full pipeline through a web interface accessible to anyone who can type a target name. There's no configuration, no scripting, no manual file preparation required.

The scientifically important feature on this slide is the virtual screening mode. In demo mode, the QSAR model trains on ChEMBL bioactivity data and predicts on the ChEMBL test split — which is useful for benchmarking but circular in a real drug discovery context, since you already have the IC50 values for those compounds. The meaningful workflow is virtual screening: you supply your own compound library — either as a CSV file where the SMILES column is auto-detected, or by pasting SMILES directly into the interface — and the model screens that library against the target. This is how you find new scaffolds that are not in ChEMBL.

The results interface is designed for rapid triage. The QSAR table is sortable by predicted activity probability and shows Lipinski descriptor values per compound, so you can immediately see which predicted actives are drug-like and which are not. The docking results are ranked by binding free energy with heat colouring — green for strong binders, yellow for moderate, red for weak — so the top candidates are immediately identifiable without reading numbers. The compound compare overlay lets you put two candidates side by side for direct comparison before deciding which to prioritize for synthesis.

**NEXT SLIDE**

---

## Slide 14: Summary \& Future Work

APEX delivers end-to-end automated drug candidate screening across six computational stages — ChEMBL ingestion, preprocessing, QSAR training and prediction, Lipinski and diversity pre-selection, structure retrieval, and AutoDock Vina docking — with a REST API and a web frontend that makes the results accessible without a computational background.

The CDK2 case study validates each stage: a QSAR classifier with cross-validated AUC 0.943 and F1 0.901, followed by a diversity-filtered candidate set, followed by docking that identifies three compounds with predicted affinities below minus nine kilocalories per mole. The full run completes in under ten minutes.

The three most impactful planned extensions are: large virtual library integration such as Enamine REAL with seven billion purchasable compounds; ensemble QSAR models including XGBoost and graph neural networks; and automated binding-site detection via fpocket or P2Rank rather than centroid estimation — particularly important for AlphaFold structures where no experimental co-crystal ligand is available.

**NEXT SLIDE**

---

## Slide 15: Questions?

Thank you. I'm happy to go into more detail on any layer of the stack — the fingerprint deduplication logic, the max-min diversity algorithm, the classification versus regression trade-off, the Vina scoring function, the PDBQT preparation pipeline, or the frontend architecture.

**END OF PRESENTATION**
