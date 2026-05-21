# APEX: Automated Pipeline for Explorative Drug Discovery — Teleprompter

---

## Slide 1: APEX: Automated Pipeline for Explorative Drug Discovery

Welcome. What you're looking at today is a platform that automates the most time-consuming part of early-stage drug discovery — the stage where we go from "we have a biological target" to "here are the ten most promising small molecules to synthesize and test." That process normally takes months of expert labor. APEX does it in under ten minutes, for any target in ChEMBL.

The full name is APEX: Automated Pipeline for Explorative drug discovery. The word "explorative" is deliberate — this isn't a tool optimized for one specific target or disease area. It's a general-purpose computational screening platform that connects to live bioactivity databases, trains a machine learning model on the fly, and passes the top predictions into a molecular docking simulation.

I'll walk you through the motivation, the technical architecture, results on a real cancer target, and the web interface that ties everything together.

**NEXT SLIDE**

---

## Slide 2: Outline

Here's how the presentation is structured. We'll start with the problem we're solving, then follow the pipeline stage by stage: first the data layer, then QSAR screening, then molecular docking. After that we'll look at concrete results on CDK2, a well-characterized kinase target, and finish with the web platform and where the project is heading.

The structure mirrors the pipeline itself — each section builds on the previous one, so by the end you'll have a complete mental model of what happens from the moment you type in a target name to the moment you get a ranked list of docking hits.

**NEXT SLIDE**

---

## Slide 3: The Drug Discovery Challenge

Drug discovery is extraordinarily expensive and slow, even by the standards of other complex engineering challenges. The numbers on the left are widely cited: roughly twelve to fifteen years from target identification to regulatory approval, and around two and a half billion dollars per drug that actually makes it through. Most of that cost isn't the winning compound — it's the ninety-nine percent that fail, often late in clinical trials.

The fundamental problem is the size of chemical space. There are an estimated $10^{60}$ drug-like molecules. No wet lab can screen more than a few million. The question computational chemistry tries to answer is: can we use computation to identify which molecules are worth synthesizing before anyone touches a pipette?

The answer, increasingly, is yes — but only when the computational pipeline is actually usable. That's the gap APEX addresses. Existing tools are either powerful but require expert configuration for every new target, or simple but too shallow to produce actionable results. APEX aims to be both automated and rigorous.

**NEXT SLIDE**

---

## Slide 4: APEX End-to-End Workflow

The pipeline has seven stages, shown here left to right. The user provides only one input: a biological target — either a target name or a ChEMBL ID. Everything else is automated.

The first two stages are the data layer. The platform queries ChEMBL for known bioactivity measurements against that target — IC50 values, concentrations, tested compounds. Those results are cached in a local SQLite database so that subsequent runs for the same target skip the API call entirely.

The preprocessing stage takes the raw ChEMBL data and converts it into a labeled training set: compounds with IC50 at or below one micromolar are labeled active; the rest are inactive. Invalid SMILES strings are discarded.

The QSAR stage trains a Random Forest classifier on molecular fingerprints and physico-chemical descriptors, then predicts activity probabilities for the full compound set. The top twenty predicted actives are passed to docking.

The structure fetch stage retrieves the target's three-dimensional protein structure, trying AlphaFold first, then the RCSB Protein Data Bank as a fallback.

Finally, AutoDock Vina docks each of the top ligands into the binding pocket and reports binding affinities. The output is a ranked hit list.

**NEXT SLIDE**

---

## Slide 5: ChEMBL Bioactivity Layer

ChEMBL is the world's largest manually curated database of bioactivity data for drug-like molecules. It contains over nineteen million measurements across more than two million compounds, all linked to biological targets with standardized assay types and units. APEX queries it directly through its REST API, no third-party library required.

The filtering step is critical. Raw ChEMBL data for a popular target can contain thousands of measurements from different assay types, different organisms, different concentration units. APEX restricts to IC50 measurements from human assays reported in nanomolar — the most comparable and clinically relevant subset.

The active/inactive threshold is set at one thousand nanomolar. This is a conventional choice: compounds potent enough to have therapeutic potential, but not so restrictive that the active class is too small to train on. It's configurable in the application settings.

The SQLite cache is simple but important. ChEMBL imposes rate limits, and a full bioactivity fetch for a popular target takes around ninety to a hundred and ten seconds on the first call. Caching with a seven-day TTL means re-running the pipeline for the same target — to try different model parameters, for example — is essentially instant.

**NEXT SLIDE**

---

## Slide 6: QSAR Model Architecture

QSAR stands for Quantitative Structure-Activity Relationship. The core idea is that a molecule's biological activity is determined by its structure, and that structure can be encoded into a fixed-length numerical vector that a machine learning model can learn from.

APEX uses two complementary types of features. The first is Morgan fingerprints, also known as circular fingerprints. These encode the local chemical environment around each atom out to a radius of two bonds, hashed into a 1024-bit binary vector. They capture structural motifs — ring systems, functional groups, connectivity patterns — in a way that's invariant to how the SMILES string is written.

The second is four physico-chemical descriptors computed by RDKit: molecular weight, partition coefficient (LogP), hydrogen bond donor count, and hydrogen bond acceptor count. These capture properties that correlate strongly with drug-likeness and membrane permeability — the Lipinski rule of five parameters.

Concatenated, the feature vector has 1028 dimensions. The classifier is a Random Forest with five hundred trees and five-fold stratified cross-validation. The five-fold CV gives us an honest estimate of generalization before we ever touch the test set. The model is serialized to disk after training, so the prediction step on subsequent runs skips retraining entirely.

**NEXT SLIDE**

---

## Slide 7: QSAR Screening Results

These two plots show the QSAR model output for CDK2, the case study we'll look at in detail shortly.

The left panel is the predicted activity probability distribution, split by ground-truth label. The green histogram is compounds the model predicts as active; the red histogram is predicted inactives. Notice the clean separation — the active distribution is strongly concentrated above 0.7, while the inactive distribution peaks near 0.1. The overlap region around 0.5 represents the ambiguous cases where the model is least certain, which is exactly where you'd expect uncertainty given the chemical similarity between borderline active and inactive compounds.

The right panel ranks the top twenty predicted actives by probability. All twenty exceed the 0.5 decision threshold. The color coding distinguishes confirmed actives in green from compounds the model predicted active but which were originally labeled inactive in the test set.

For CDK2 with 998 training examples, the model achieved a cross-validated AUC of 0.943 and a test-set F1 score of 0.901. These are strong results for a binary activity classifier trained on a dataset of this size, and they replicate consistently across reruns due to the fixed random seed.

**NEXT SLIDE**

---

## Slide 8: AutoDock Vina Integration

Molecular docking answers a different question than QSAR. Where QSAR asks "does this compound look like known actives?", docking asks "can this compound physically bind to the target's binding site, and if so, how tightly?"

AutoDock Vina is the industry-standard open-source docking tool. Its scoring function combines steric repulsion, hydrogen-bond energy, hydrophobic contacts, and an entropic penalty for restricted torsional rotation. The output is a predicted binding free energy in kilocalories per mole — more negative means tighter binding.

Before Vina can run, both the ligand and receptor need to be in PDBQT format, which includes Gasteiger partial charges and rotatable bond assignments. For ligands, APEX uses RDKit to generate a three-dimensional conformer from the SMILES string using the ETKDGv3 algorithm and MMFF94 force field minimization, then calls Open Babel to convert to PDBQT.

For the receptor, the protein structure is fetched from AlphaFold or the RCSB. The binding box — the three-dimensional search region Vina explores — is estimated automatically using BioPython: compute the centroid of all alpha-carbon atoms, then extend ten angstroms in each direction, capping at thirty angstroms to keep the search tractable.

Exhaustiveness is set to eight, Vina's default. Higher values explore the search space more thoroughly but increase runtime proportionally.

**NEXT SLIDE**

---

## Slide 9: Docking Results

These plots show the docking output for the CDK2 case study — twenty compounds selected from the top QSAR predictions and docked against the CDK2 binding site.

The left panel is the full affinity distribution. The histogram shows that most screened compounds cluster between minus seven and minus ten kilocalories per mole — a realistic range for drug-like molecules against a well-defined kinase binding site. The median affinity, shown by the red dashed line, gives a quick reference for what constitutes a strong versus weak hit in this particular run.

The right panel ranks the top twenty hits by affinity. The color coding follows the heat scale shown in the legend: green for strong binders below minus ten kilocalories per mole, transitioning through yellow for moderate binders, and red for weaker ones above minus four. Notice that the top six compounds cluster in the green zone — these are the candidates that would move to experimental validation.

A binding affinity of minus ten kilocalories per mole corresponds roughly to a dissociation constant in the low nanomolar range, which is the target for a useful drug candidate. The top hit at minus 10.8 is a strong result for an automated, no-manual-intervention docking run.

**NEXT SLIDE**

---

## Slide 10: Case Study — Cyclin-Dependent Kinase 2 (CDK2)

CDK2 is a serine/threonine kinase that drives the cell cycle transition from G1 to S phase. Its overexpression or deregulation is implicated in a wide range of cancers, making it one of the most studied kinase targets in oncology. It's also an ideal validation target for a computational pipeline because it's well characterized, has thousands of published bioactivity measurements, and its crystal structures are extensively deposited in the PDB.

The APEX run on CDK2 retrieved 998 IC50 measurements from ChEMBL on the first call, which took about a hundred and ten seconds. The QSAR model trained in under thirty seconds and produced the strong metrics shown earlier — AUC 0.943, F1 0.901.

Twenty compounds were forwarded to docking. The full docking run — ligand preparation, receptor preparation, Vina execution, score parsing — completes in roughly five minutes for twenty ligands. The top hit achieved minus 10.8 kilocalories per mole. Six of the twenty compounds scored below minus nine, which represents a genuinely selective and potent binding prediction.

The total wall-clock time from target name to ranked docking results, excluding the initial ChEMBL cache build, is under four minutes. That's the speed claim this platform is built on.

**NEXT SLIDE**

---

## Slide 11: APEX Web Platform

The platform is designed to be used without any command-line knowledge. The backend is a FastAPI application exposing four endpoints: target search, QSAR training and prediction, structure retrieval, and docking. Each endpoint is independently callable, so a researcher can run just the QSAR stage, inspect the results, and decide whether to proceed to docking.

The frontend is a React application that runs in any modern browser with no build step or server required — it's a single HTML file that loads React from a CDN and reads from the backend API. The design prioritizes data density over decoration: a sidebar for target search and run history, a stepper bar showing which pipeline stage is active, a QSAR results table sortable by activity probability, a docking results table with affinity heat coloring, and a compound compare overlay for side-by-side analysis of shortlisted hits.

The backend address is configurable via a single line in the HTML file. Setting it to null switches the frontend to demo mode, where mock data is used — useful for demonstrations without a running backend.

**NEXT SLIDE**

---

## Slide 12: Summary \& Future Work

APEX delivers what it promises: type in a target name, get back a ranked list of docking hits. The pipeline covers data ingestion, compound screening, structure retrieval, and docking in a single automated workflow, with a web interface that makes the results accessible without a computational background.

The CDK2 results validate the approach: a QSAR model with AUC above 0.94 trained on real ChEMBL data, and docking hits reaching minus 10.8 kilocalories per mole in the top position. These are numbers a medicinal chemist would take seriously as starting points for experimental follow-up.

The next development priorities are clear. The most impactful extension is integrating a large virtual library — Enamine REAL, with over seven billion purchasable compounds — so the QSAR model screens a genuinely novel chemical space rather than re-ranking known ChEMBL compounds. After that: ensemble QSAR models, ADMET filtering to remove compounds with poor drug-like properties before docking, and three-dimensional binding pose visualization directly in the browser.

**NEXT SLIDE**

---

## Slide 13: Questions?

Thank you. The source code is available on request, and I'm happy to go into more detail on any part of the pipeline — the QSAR feature engineering, the Vina integration, the frontend architecture, or the ChEMBL caching layer.

**END OF PRESENTATION**
