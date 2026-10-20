---
name: Lingua product intent
description: The intended audience and release scope for Lingua.
---

The user describes Lingua as "my personal language-learning app initially, with the possibility of a public release later."

**Why:** The first version should support personal use while leaving room for a future public release.

**How to apply:** Do not assume multi-user accounts or cloud sync are needed for the MVP. When discussing release, distinguish public app availability from local learning data storage.

Lingua's local learning data must be migrated without deleting or overwriting the original saved state before a replacement has been validated. Preserve stable question IDs and exact review dates.

**Why:** the user wants existing Notebook, Progress, and review history to survive future saved-state changes.

**How to apply:** test migration candidates on copies of version-one browser data, keep unknown or malformed originals recoverable, and only replace stored state after validation.
