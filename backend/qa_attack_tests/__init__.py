"""Permanent Security & QA regression module (SECURITY-QA-REPORT.md §8).

The audit produced its evidence by running a throw-away ``qa_attack_tests``
probe module (P1–P8) against the test database and then deleting it. This is
that module, restored as a permanent fixture: every test here asserts that a
previously-confirmed attack is now *denied*, so a regression re-opens a
documented hole only after a red build, not in production.

It carries no models, migrations, URLs or admin — it is a pure test app and
inert at runtime.
"""
