---
name: dev-server-stop
description: Stop the Vite dev server for GH Insight. Use when asked to stop, kill, shut down, or turn off the dev site, dev server, or local app.
---

# dev-server-stop

Stops the running Vite dev server.

## Steps

1. **If you started it this session** with a known background task ID, use `TaskStop` with that ID. This kills the `npm` wrapper but often leaves the underlying Vite/node process listening — always continue to step 2.

2. **Find and kill the Vite listener.** Vite runs as a Node process listening on port 5173 (or the next free port). Use the command for the current platform — substitute the port if the user reported a different one.

   **Windows (PowerShell):**
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
     Select-Object -ExpandProperty OwningProcess -Unique |
     ForEach-Object { Stop-Process -Id $_ -Force }
   ```
   `-State Listen` filters out transient client sockets (TimeWait, FinWait).

   **macOS / Linux (Bash):**
   ```bash
   lsof -ti tcp:5173 -sTCP:LISTEN | xargs -r kill -9
   ```
   `-sTCP:LISTEN` ensures only the server socket is targeted, not transient client connections.

3. **Verify** the port is free.

   **Windows:**
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
   ```
   Check for empty output, not exit code — `Get-NetTCPConnection` reports a non-zero exit when nothing matches.

   **macOS / Linux:**
   ```bash
   lsof -ti tcp:5173 -sTCP:LISTEN
   ```
   No output = stopped.

## Notes

- Don't kill all `node.exe` processes — there may be other Node tools running (editors, language servers, other dev servers).
- If nothing is listening on the port, say so rather than reporting a successful stop — the user may have expected something to be running.
