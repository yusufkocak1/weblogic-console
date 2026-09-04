# wl-console

A modern, lightweight web console for Oracle WebLogic Server, built entirely on
the RESTful Management Services.

It runs on your own machine and connects to any AdminServer you point it at —
host, port, username, password — the way the WebLogic Remote Console desktop app
does, but in a browser tab. Nothing is installed into the domain, nothing is
deployed to the AdminServer, and no agent runs anywhere near your servers.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Quick start](#quick-start)
- [Multiple domains](#multiple-domains)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Features](#features)
- [Security model](#security-model)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Compatibility](#compatibility)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why this exists

Recent WebLogic Server releases removed the classic browser-based
Administration Console in favour of the WebLogic Remote Console — a desktop
application you install per workstation. That is a fine tool, but a desktop
install is awkward when you want to glance at a domain from a jump host, a
shared ops machine, or a container.

Everything the console needs is already exposed by WebLogic's REST management
API. `wl-console` is a small Vue front end over that API plus a thin local
process to hold the connection. It stays deliberately narrow: **read the domain,
watch the runtime, drive lifecycle operations.** It is not trying to replace
WLST or the Remote Console for deep configuration work.

## Quick start

```bash
git clone https://github.com/yusufkocak1/weblogic-console.git
cd weblogic-console
npm install
npm run serve
```

Open <http://127.0.0.1:7101>, enter your AdminServer details, and connect:

| Field    | Example     | Notes                                              |
| -------- | ----------- | -------------------------------------------------- |
| Host/IP  | `10.0.0.12` | Hostname or IP of the **AdminServer**               |
| Port     | `7001`      | The admin listen port (`7002` for the SSL port)     |
| Username | `weblogic`  | Any user in a role that can read the domain         |
| Password | —           | Held in the local process only, never stored        |
| SSL      | off         | Turn on for an HTTPS admin port                     |

Connections you make are saved so you can come back to them in one click —
see [Multiple domains](#multiple-domains). Passwords are never saved.

### Scripts

| Script            | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `npm run dev`     | Backend + Vite with hot reload → <http://localhost:5173>          |
| `npm run serve`   | Builds the UI, then serves everything from one process on `:7101` |
| `npm run build`   | Builds the UI into `dist/`                                        |
| `npm start`       | Serves an already-built `dist/` (no rebuild)                      |
| `npm run dev:ui`  | Vite alone                                                        |
| `npm run dev:server` | Backend alone, with `--watch`                                 |

`npm run dev` runs both halves in one terminal with prefixed, colour-coded
output; Ctrl-C stops both.

## Multiple domains

You can have several AdminServers open at the same time — production, test, a
colleague's sandbox — and switch between them instantly. The switcher sits at
the top of the sidebar; `Manage connections…` opens a page to rename, close and
forget them.

**Saved profiles** keep a name, host, port, SSL settings and username. They live
in `~/.wl-console/profiles.json` (override the directory with `WLC_HOME`) and
survive restarts, so the list is there the next time you open the console.

**Passwords are never written to disk.** They are held in the console process's
memory for as long as it runs. In practice this means:

- While the console is running, switching between open domains is instant and
  does not re-authenticate.
- After restarting the console, each profile asks for its password once — a
  small dialog, with everything else already filled in.
- Killing the process forgets every credential.

Each REST call is pinned to the connection it was issued for, so a slow response
from one domain can never be rendered as another domain's data if you switch
while it is in flight. Switching also clears the page and reloads it against the
new domain rather than leaving stale numbers on screen.

Untick **Save this connection** on the connect screen for a one-off session that
leaves nothing behind.

## Configuration

All configuration is environment variables — there is no config file to manage.

| Variable           | Default                 | Purpose                                        |
| ------------------ | ----------------------- | ---------------------------------------------- |
| `WLC_PORT`         | `7101`                  | Port the local console listens on               |
| `WLC_HOST`         | `127.0.0.1`             | Bind address — loopback on purpose              |
| `WLC_HOME`         | `~/.wl-console`         | Directory holding `profiles.json`               |
| `VITE_BACKEND_URL` | `http://127.0.0.1:7101` | Where Vite proxies `/api` during development    |

```bash
WLC_PORT=8080 npm start          # run somewhere else
```

## How it works

```
┌─────────┐  /api/connections  ┌──────────────────┐   /management/weblogic/latest/*   ┌─────────────┐
│ browser │ ──/api/wls/*────▶  │ server/index.mjs │ ────────────────────────────────▶ │ AdminServer │
└─────────┘  httpOnly cookie   │  (your machine)  │   HTTP Basic + X-Requested-By     └─────────────┘
                               └──────────────────┘
```

**The browser never talks to WebLogic directly**, for two reasons:

1. **It cannot.** The REST management API sends no CORS headers, so a page
   served from any other origin is blocked by the browser before the request
   ever leaves. A pure single-page app simply cannot reach an arbitrary
   AdminServer.
2. **It should not.** Doing it in the browser would mean keeping WebLogic admin
   credentials in JavaScript-reachable storage and re-sending them on every
   request.

So a small Node process — the one you start with `npm start`, running on your
own machine — owns the connections. On connect it validates the credentials
against `/domainConfig`, keeps the target URL and the Basic header in memory,
and hands the browser nothing but an opaque `httpOnly` session cookie. Every
subsequent `/api/wls/*` call is forwarded upstream with the stored credentials
attached server-side. One browser session can hold several connections at once;
each request carries an `X-Connection-Id` naming the one it belongs to. Sessions
expire after 8 hours idle and die with the process.

The same process serves the built UI in production mode, so `npm run serve` is
the entire application: one port, one command, no reverse proxy.

### Request efficiency

WebLogic's REST API exposes a `search` action on every tree that returns a whole
subtree in one POST. The dashboard, monitoring, JMS and data source pages each
use it to fetch every server's runtime in a **single round trip** instead of one
request per MBean. See `runtimeSnapshot()` in
[`src/api/weblogic.js`](src/api/weblogic.js) for the pattern.

## Project layout

```
server/index.mjs            connections, profiles, REST proxy, static serving
scripts/dev.mjs             runs backend + Vite together
src/
  api/
    client.js               fetch wrapper for the local backend, error shaping
    weblogic.js             one function per WebLogic endpoint / search payload
  stores/
    connection.js           live connections, saved profiles, active target
    ui.js                   theme, refresh interval, toasts
  composables/
    useResource.js          load + auto-refresh + abort + reload on domain switch
    useReconnect.js         password prompt for bringing a saved profile back
  components/               AppShell, DataTable, StateBadge, MeterBar, …
  views/                    one view per console section
  utils/format.js           bytes, durations, health/target normalisation
```

The backend depends on nothing but Node's standard library. The front end
depends on Vue, Vue Router, Pinia and Tailwind — nothing else at runtime.

## Features

| Section           | What it shows                                                                | REST source                                                        |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Dashboard**     | Domain summary, per-server cards with state, heap, threads, uptime; a banner for running-but-unhealthy servers | `domainRuntime/search`, `domainConfig/servers`                      |
| **Servers**       | Configured + runtime view per server; start, suspend, resume, shutdown, force shutdown | `serverLifeCycleRuntimes` + actions                                 |
| **Clusters**      | Membership, alive counts, replication primaries/secondaries, resend counts     | `clusterRuntime` per member server                                  |
| **Deployments**   | Applications and shared libraries, targets, staging mode, per-server health; start and stop | `appDeployments`, `applicationRuntimes`, `deploymentManager`         |
| **Data Sources**  | JDBC URL, driver, JNDI names, pool capacity; live active/waiting/failure counts and a connection test | `JDBCSystemResources`, `JDBCDataSourceRuntimeMBeans`, `testPool`     |
| **JMS**           | JMS servers and destinations: current, pending, high and received message counts, consumers, bytes | `JMSRuntime/JMSServers` + `destinations`                            |
| **Monitoring**    | Per-server JVM heap, committed size, uptime, Java version; thread pool busy/idle, hogging, **stuck**, queue depth, throughput | `JVMRuntime`, `threadPoolRuntime`                                   |
| **Logs**          | Server log records with minimum-severity filter, message search, time window   | WLDF data accessor (`search`, with cursor fallback)                 |
| **REST Explorer** | Any endpoint of the management API, with bookmarks and pretty-printed JSON     | anything                                                            |
| **Connections**   | Saved domains and open sessions: switch, rename, close, forget                 | local, no WebLogic call                                             |

Across every page:

- **Several domains open at once**, with instant switching from the sidebar.
- **Auto-refresh** with a selectable interval (off / 5s / 15s / 30s / 60s) that
  pauses while the tab is hidden, so a console left open overnight does not
  hammer the AdminServer.
- **Sortable, filterable tables** with per-column sorting and a live filter.
- **Dark and light themes**, remembered per browser.
- **Confirmation prompts** on every state-changing operation, each explaining
  what the operation actually does before you commit to it.
- **Actionable errors** — connection failures are translated into what to check,
  not just an error code.

> Starting a stopped managed server requires a running Node Manager on its
> machine. That is a WebLogic requirement, not a limitation of this console.

## Security model

This tool can drive a WebLogic domain with administrator credentials. Read this
section before you deploy it anywhere other than your own workstation.

**What it does well**

- Credentials live in the backend process's memory for the session's lifetime.
  They are never written to disk, never sent to the browser, and never placed in
  `localStorage` or `sessionStorage`.
- Saved profiles hold only a name, host, port, SSL flags and username. The
  profiles file is written with owner-only permissions and contains no secrets,
  so it is safe to back up or sync.
- The browser holds an opaque random token in an `httpOnly`, `SameSite=Lax`
  cookie. JavaScript on the page cannot read it.
- Only the host, port and username of recent targets are remembered in
  `localStorage`, so you can reconnect quickly without retyping.
- Sessions expire after 8 hours idle, and all sessions end when the process
  stops.
- The backend binds to `127.0.0.1` by default: nothing else on the network can
  reach it.

**What you must decide**

- **Do not expose it without thought.** Setting `WLC_HOST=0.0.0.0` shares more
  than a UI: anyone who can reach the port can drive an AdminServer with
  whatever credentials a live session holds. If you need shared access, put it
  behind HTTPS and an authenticating reverse proxy, and understand that the
  console has no user model of its own.
- **"Trust self-signed certificate"** disables TLS verification for that
  connection. It is there because internal WebLogic installs routinely use
  self-signed certs; it does mean the upstream connection is not authenticated.
- **Connect with a role that matches the job.** A `Monitor` or `Operator` user
  is enough for everything except lifecycle and deployment operations. WebLogic
  enforces this — the console just surfaces whatever the API allows for the user
  you signed in as.

## Troubleshooting

The backend translates connection failures into concrete next steps. The most
common ones:

| What you see                                     | What it usually means                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| *Connection refused*                             | Nothing is listening there. Check the AdminServer is up and the port is right |
| *Host not found*                                 | Hostname/IP typo, or DNS cannot resolve it from this machine                  |
| *Protocol mismatch — the port probably speaks SSL*| You hit the SSL port with SSL off. Enable the SSL option                      |
| *The AdminServer uses a self-signed certificate* | Enable "trust self-signed certificate"                                        |
| *Invalid username or password*                   | WebLogic rejected the credentials                                             |
| *REST management API not found*                  | Something answered, but it is not an AdminServer — or you hit a managed server's port |
| *Port 7101 is already in use*                    | Another copy is running. Stop it or use `WLC_PORT`                            |

Other things worth knowing:

- **A page shows no data.** Most runtime MBeans only exist on *running* servers.
  A stopped server has configuration but no runtime, so JMS, monitoring and pool
  statistics will legitimately be empty.
- **The Logs page returns nothing.** Widen the time window or lower the minimum
  severity — the default is the last hour at `Warning` and above.
- **`npm install` leaves a broken build.** Tailwind 4 and Vite pull
  platform-specific native binaries as optional dependencies. If a build fails
  with a missing `lightningcss.*.node` or `@esbuild/*`, delete `node_modules`
  and install again.

## Development

```bash
npm run dev
```

Vite serves the UI on `:5173` with hot module reload and proxies `/api` to the
backend on `:7101`, so the browser only ever sees one origin.

**Adding a console page** is three small steps:

1. Add an endpoint function in [`src/api/weblogic.js`](src/api/weblogic.js) —
   prefer a `search` payload over several individual GETs.
2. Create the view under `src/views/` and load data with `useResource()`, which
   handles loading state, aborting in-flight requests, auto-refresh and expired
   sessions for you.
3. Register the route in [`src/router/index.js`](src/router/index.js) and add a
   `NAV` entry in [`src/components/AppShell.vue`](src/components/AppShell.vue).

`DataTable` takes a column definition array and gives you sorting, filtering,
loading, empty and error states; override any cell with a `#cell:<key>` slot.

### Notes for contributors

- WebLogic returns collections as `{items: [...]}` and singletons as bare
  objects. Always normalise with `items()` from `src/utils/format.js`.
- `healthState` is an object in current releases and a `HEALTH_*` string in older
  ones — `healthOf()` handles both.
- Anything that changes domain state must go through a `ConfirmDialog` and
  report success and failure through the toast store.

## Compatibility

- **Node.js 24 or newer** to run the console (`.nvmrc` pins it for nvm users).
- **A WebLogic AdminServer with RESTful Management Services enabled** — this is
  the default in modern releases. The API lives under
  `/management/weblogic/latest`.
- Developed against WebLogic 15. The endpoints used are long-standing and should
  work on 12.2.1.x and 14.1.x as well; the Logs page is the most
  version-sensitive part, and falls back to the older WLDF cursor protocol when
  the one-shot `search` action is unavailable.

## Roadmap

Not implemented yet, in rough order of usefulness:

- **Configuration editing** — creating and modifying servers, data sources and
  deployments. This needs the `/edit` tree with proper edit sessions: acquire
  lock, change, activate, and handle conflicts. Everything today reads from the
  read-only `/domainConfig` tree and performs runtime operations only, so the
  console can never leave a dangling edit lock.
- **Application deployment** — uploading a WAR/EAR and targeting it.
- **Historical charts** — the data is polled already; it is not retained.
- **Security realm views** — users, groups and role mappings.

## License

MIT — see [LICENSE](LICENSE).
