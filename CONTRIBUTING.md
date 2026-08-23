# 🤝 Contributing to VoyaGen AI

Contributions are welcome.

1. Fork the repository
2. Create a feature branch — `git checkout -b feature/amadeus-pricing`
3. Commit your changes — `git commit -m "Add Amadeus fare pricing MCP server"`
4. Push the branch — `git push origin feature/amadeus-pricing`
5. Open a pull request describing the change and how you verified it

**If you are adding a tool**, prefer an MCP server over an inline API call, register it in
`mcp_client.py`, and give it a key check in `_get_server_tool()` so a missing credential produces
a readable setup error rather than a stack trace.

**If you are adding an agent**, you need four things: the node function, an entry in
`KNOWN_AGENTS` and `AGENT_ORDER`, a `ROUTE_MAP` entry with its conditional edge, and one line in
the supervisor prompt describing when to select it.

**If you are touching the front end**, run `npm run typecheck` before opening the PR, and keep
`src/lib/types.ts` in sync with `backend._serialize_result()`.

---

## Where things live

| Change | Files |
| --- | --- |
| A new specialist agent | `backend.py` — node fn, `KNOWN_AGENTS`, `AGENT_ORDER`, `ROUTE_MAP`, supervisor prompt |
| A new tool server | `mcp_client.py` — server entry + a key check in `_get_server_tool()` |
| The API contract | `app.py` + `backend._serialize_result()` **and** `frontend/src/lib/types.ts` |
| UI | `frontend/src/` — see [docs/frontend.md](docs/frontend.md) |
| Docs | `docs/` — the root README is the tour, `docs/` holds the detail |

## Before you open a PR

```bash
python -c "import ast,sys; [ast.parse(open(f,encoding='utf-8').read()) for f in ('app.py','backend.py','mcp_client.py')]"
cd frontend && npm run typecheck && npm run build
```

Describe what you changed and how you verified it. Screenshots help for UI work.
