# Tucoloc

A shared app for the people living together in one flatshare, to run their shared life: expenses and chores.

## Language

**Flatshare**:
The apartment and the group of people living in it, treated as one unit.
_Avoid_: Coloc, household, apartment, group

**Flatmate**:
A person who lives in the Flatshare and uses the app.
_Avoid_: Colocataire, roommate, user, member

**Room**:
One of the two shared rooms whose occupancy is tracked: the WC and the Salle de bain. Fixed list.
_Avoid_: Restroom, bathroom (ambiguous between the two)

**Occupancy**:
Whether a Room is currently occupied, and by which Flatmate.

**Recipe**:
A dish any Flatmate can add to the shared list and edit: title, free text, optional photo or link.

**Meal**:
What the whole Flatshare eats together tonight: either a Recipe from the list or a free-text dish. One at a time.
_Avoid_: Dinner, menu, repas

**Expense**:
Money one Flatmate (the payer) spent on a date for some of the Flatmates (the participants), described by a label and split equally between them. Records who created it, which may differ from the payer. Settled once a Settlement follows it, and then read-only.
_Avoid_: Purchase, dépense, transaction

**Balance**:
How much a Flatmate is owed (positive) or owes (negative) across all Expenses since the last Settlement.

**Settlement**:
The moment the Flatmates pay each other the suggested transfers and reset every Balance to zero, all at once. Settles every Expense before it.
_Avoid_: Reimbursement, remboursement, payback (partial or per-expense paybacks don't exist)
