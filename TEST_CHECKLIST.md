# SQ360 — Test Checklist manuale
Aggiornata: 31 ottobre 2026
Legenda: [ ] da testare | [OK] funziona | [ERR] errore | [PARZ] parziale
Per ogni errore annotare: modulo, cosa hai fatto, cosa e successo.

## 0. Prima di iniziare
- Usare una commessa di test (non una reale)
- Reimportare l'XPWE sulla commessa di test (le misurazioni compaiono solo sui nuovi import)

## 1. Accesso
[ ] Login admin@sq360.it
[ ] Logout e ritorno al login
[ ] Registrazione nuova azienda /register

## 2. Dashboard
[ ] KPI caricano
[ ] Alert DURC e scadenziario popolati
[ ] Mappa cantieri senza errori

## 3. Gare
[ ] Lista e nuova gara
[ ] Checklist offerta e migliorie
[ ] Simulatore ribasso
[ ] Crea commessa da gara aggiudicata

## 4. Commesse
[ ] Creazione commessa (wizard 3 step, codice automatico)
[ ] Elimina commessa (doppia conferma)
[ ] Navigazione gruppi: Contratto / Acquisti / Cantiere / Economico / Extra / Archivio

## 5. Contratto
Anagrafica
[ ] Campi editabili, figure RUP/DL/CSE
[ ] Toggle sicurezza interna
[ ] Bottone Verbale consegna genera PDF
[ ] WBS commessa: importa da template

Elenco Prezzi
[ ] Tariffe caricate dal computo, filtri, analisi

Computo
[ ] Import XPWE
[ ] Righe misurazioni visibili e con dati
[ ] Voci XPWE bloccate, voci manuali editabili
[ ] Filtro WBS e categoria
[ ] Selezione multipla e Ctrl+A
[ ] Analisi prezzi BASE/EXTRA
[ ] Voce da EP

SAL Attivi
[ ] Nuovo SAL, griglia, residuo live
[ ] Upload PDF DL e certificato RUP
[ ] Genera fattura attiva

SAL Passivi
[ ] Card sub, avanzamento, blocco se DURC scaduto

Varianti / Ordini di Servizio
[ ] Workflow completo
[ ] Variante esecutiva: le sue voci compaiono nel computo

Nuovi Prezzi
[ ] Proposta -> negoziazione -> concordato
[ ] PDF verbale
[ ] Inserimento in Elenco Prezzi

Riserve
[ ] Iscrizione, scadenza +30gg, alert <=7gg, cambio stato

## 6. Acquisti
RDA
[ ] Creazione da computo, WBS propagata, badge "WBS mancante"
RDO
[ ] Wizard multi-fornitore, pagina pubblica /offerta/[token]
[ ] Comparativa e aggiudica
[ ] Upload preventivo con AI
[ ] PDF RDO
SAM / ODA
[ ] Flusso RDO -> SAM -> ODA, 6 tipi ODA, PDF
Contratti Sub
[ ] Creazione, checklist 7 documenti, lavoratori, pagamenti

## 7. Cantiere
[ ] Giornale lavori
[ ] Sicurezza: upload con AI
[ ] Persone: QR badge, scanner, presenze
[ ] DDT: upload foto con AI

## 8. Economico
[ ] Fatturazione e fatture passive (upload con AI)
[ ] Conto economico (per tipo ODA, per WBS)
[ ] Marginalita

## 9. Impostazioni
[ ] Dati azienda (si chiude dopo salvataggio)
[ ] Logo e carta intestata
[ ] Template WBS
[ ] Gestione utenti, invito email, permessi moduli
[ ] Un utente con modulo disattivato non apre la pagina via URL

## 10. Contatti
[ ] Nuovo contatto compare in lista (anche tipo "altro")
[ ] Import AI da PDF
[ ] Banner scadenze e filtri
[ ] Drawer a 5 tab

## 11. PWA
[ ] Banner installazione
[ ] App installabile su telefono

## Bug trovati
(data - modulo - descrizione)
-
