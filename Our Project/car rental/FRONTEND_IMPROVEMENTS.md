VRMS Frontend improvement pass

Implemented:
- Role-aware bottom navigation: Reports for Manager/Admin; Admin tab for Admin only.
- Login role selector with server-authoritative role verification.
- Safer public registration: new accounts are Clerk accounts; privileged roles are not self-selectable.
- Password visibility controls on login and registration.
- 15-minute inactivity timeout with touch activity tracking and app foreground handling.
- More robust API error parsing and automatic local token clearing on HTTP 401.
- Dashboard redesign with role-aware messaging, clearer metrics, status badges, notifications, loading/error/empty states.
- Booking date defaults now use the current date rather than stale hard-coded 2026 dates.
- Booking date validation improved.
- Payment screen now allows an explicit payment amount and validates EFT reference.
- Booking screen better explains missing customers instead of silently showing nothing.

Not included yet:
- Backend security fixes (public registration role enforcement, booking overlap rules, return permissions, payment rules, fuel baseline, etc.). Those require the FastAPI project.
- Full standalone Customer Management screen and Vehicle Management/Create Vehicle screen; these can be added after the backend is provided/verified.
- The 15-minute inactivity feature is implemented on the frontend, but backend session policy can still be strengthened separately.
