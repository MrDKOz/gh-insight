---
name: dev-server-stop
description: Stop the Vite dev server for GH Insight. Use when asked to stop, kill, shut down, or turn off the dev site, dev server, or local app.
---

# dev-server-stop

Stops the running Vite dev server.

## Steps

1. **If you started it this session** with a known background task ID, use `TaskStop` with that ID. This kills the `npm` wrapper but often leaves the underlying Vite/node process listening — always continue to step 2.

2. **Find and kill the Vite listener.** Vite runs as a Node process listening on port 5173 (or the next free port). On Windows:
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
     Select-Object -ExpandProperty OwningProcess -Unique |
     ForEach-Object { Stop-Process -Id $_ -Force }
   ```
   Filter on `-State Listen` so transient client sockets (TimeWait, FinWait) don't get treated as the server. If the user reported a different port, substitute it.

3. **Verify** the port is free:
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
   ```
   No matches = stopped. Note: `Get-NetTCPConnection` exits with code 1 when nothing matches — that's success here, not failure. Check for empty output, not exit code.

## Notes

- Don't kill all `node.exe` processes — there may be other Node tools running (editors, language servers, other dev servers).
- If nothing is listening on the port, say so rather than reporting a successful stop — the user may have expected something to be running.
