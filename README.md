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
- [Language](#language)
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
watch the runtime, drive lifecycle operations, deploy applications, and change
the settings you actually change day to day.** Creating servers and clusters, or
editing the security realm, is still WLST or Remote Console work.

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
| Host/IP  | `10.0.0.12` | Hostname or IP of the **AdminServer** — a `t3://` URL can be pasted here |
| Port     | `7001`      | The admin listen port (`7002` for the SSL port)     |
| Username | `weblogic`  | Any user in a role that can read the domain         |
| Password | —           | Held in the local process only, never stored        |
| SSL      | off         | Turn on for an HTTPS admin port                     |

### Already have a t3 address?

Paste it into the host field and it is split for you. WebLogic multiplexes T3
and HTTP on the same listen port, so the port carries straight over to the REST
API — only the scheme has to go:

| Your WLST address              | What the console uses                          |
| ------------------------------ | ---------------------------------------------- |
| `t3://10.0.0.12:7001`          | host `10.0.0.12`, port `7001`, SSL off          |
| `t3s://wls.corp.local:7002`    | host `wls.corp.local`, port `7002`, SSL on      |
| `t3://ms1:7001,ms2:7001`       | the first entry — connect to the AdminServer    |

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

## Language

The console speaks English and Turkish. The picker sits in the top bar, next to
the theme toggle, and on the connect screen — the choice is remembered in the
browser. With nothing chosen it follows the browser's own language and falls
back to English.

**WebLogic's vocabulary is left in English in every language.** Server, cluster,
domain, deployment, data source, heap, thread, JMS, JTA, MBean, WLST, RUNNING,
ADMIN — these stay as they are. A Turkish operator types `srvr` into WLST, reads
`<Server started in RUNNING mode>` in a log file, and searches Oracle's
documentation in English; rendering *cluster* as *küme* would invent a second
vocabulary that exists only inside this console and has to be translated back
before it is useful anywhere else. So the console's own sentences are
translated, and the product's nouns are not.

**Settings fields are named by their MBean attribute.** A field on the data
source page reads `maxCapacity`, with a short gloss beside it and the
explanation underneath; only the gloss and the explanation are translated. The
attribute name is the one string that is identical here, in WLST and in Oracle's
documentation, so it is the same in every language.

**Where the console does speak for itself, it uses the words operators use.** A
filter is a *filtre*, not a *süzgeç*: the aim is the Turkish of a server room,
not the purest word available.

### Adding a language

Translation is keyed by the English string itself, so a missing entry renders as
English rather than as a bare `page.header.refresh` key:

```js
// src/i18n/tr.js
export default {
  'Refresh': 'Yenile',
  '{count} selected': '{count} seçili',
}
```

1. Copy `src/i18n/tr.js` to `src/i18n/<code>.js` and translate the values.
2. Add the language to `LOCALES` in `src/i18n/index.js`.
3. Run `npm run i18n:check`.

That last step is the price of keying by the English text: editing an English
string orphans its translation silently. The script lists what each catalogue is
missing, and with `--all` what it still carries that the source no longer uses.

```
$ npm run i18n:check
tr — 1383/1383 translated
Every string is translated.
```

Strings reached indirectly — a label pulled out of a table rather than written
in place — are kept visible to that script by building the table in a function,
so the `t()` calls stay in the source where it can see them.

## Configuration

All configuration is environment variables — there is no config file to manage.

| Variable              | Default                 | Purpose                                                        |
| --------------------- | ----------------------- | -------------------------------------------------------------- |
| `WLC_PORT`            | `7101`                  | Port the local console listens on                               |
| `WLC_HOST`            | `127.0.0.1`             | Bind address — loopback on purpose                              |
| `WLC_HOME`            | `~/.wl-console`         | Directory holding `profiles.json`                               |
| `WLC_SAMPLE_MS`       | `15000`                 | How often runtime is sampled for charts and alerts; `0` is off  |
| `WLC_HISTORY_MINUTES` | `120`                   | How much of that history is kept in memory                      |
| `WLC_MAX_UPLOAD_MB`   | `256`                   | Largest application archive the deployment proxy will forward   |
| `VITE_BACKEND_URL`    | `http://127.0.0.1:7101` | Where Vite proxies `/api` during development                    |

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

### Runtime history

The browser only polls while a page is open, which is no use for a chart or for
noticing that a server went down ten minutes ago. So the backend samples each
live connection itself — one small `search` every `WLC_SAMPLE_MS` — and keeps
`WLC_HISTORY_MINUTES` of it in a ring buffer per connection. That buffer feeds
the sparklines and the alert rules, and it never touches the disk: it dies with
the process, like the credentials do.

Sampling follows the browser rather than running forever. A session nobody has
touched for fifteen minutes is skipped, so a console left open in a background
tab overnight stops asking the AdminServer anything at all.

### Activity and rollback

Every operation this console performs against the domain is written to a local
activity log: which attribute on which MBean went from which value to which
other value, which server was started or shut down, which application was
deployed. It is a log of *changes*, not of pages visited — the counter-clockwise
arrow in the top bar answers "what did I just change?", which is the only
question worth asking it.

Where an operation has an inverse, the entry carries it, and **Roll back**
replays it through the same REST calls:

| Operation                        | What rolling it back does                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| A setting saved (and activated)   | Writes the previous values back through the staged edit protocol, activating them if the original was activated |
| Start / suspend / resume / shutdown | Requests the opposite operation, one server at a time              |
| An application started or stopped | Starts or stops it again on the same targets                        |
| Undeploy, deploy, redeploy        | Nothing — the domain no longer holds the archive it had, so the entry says so instead of offering a button that would lie |

A rollback is a new change against the domain, not an erasure of the old one:
it takes the lock and activates like any other edit, everybody else sees it, and
a server that has been through a shutdown does not get its sessions back. The
entry it leaves behind says as much.

The log is an undo window, not an audit trail — WebLogic's own change log is
the audit trail. Entries therefore expire, taking their rollback with them,
**fifteen minutes** after the change by default. The window is settable per
browser from the panel itself (5 minutes to 12 hours); shortening it drops
whatever already falls outside the new window. Entries are held in
`localStorage`, so they survive a reload, and each is tied to the connection it
was made on — another domain's changes are never offered for replay against the
one on screen.

### Deploying an archive

An upload goes browser → console process → AdminServer as multipart form data,
so the archive never has to exist on the AdminServer's own disk. The console
takes the configuration lock, posts the archive, and activates; if anything
fails the edit session is discarded, and the domain is left exactly as it was.

## Project layout

```
server/index.mjs            connections, profiles, REST proxy, runtime sampler, static serving
scripts/dev.mjs             runs backend + Vite together
scripts/i18n-check.mjs      which strings are still missing a translation
src/
  api/
    client.js               fetch wrapper for the local backend, error shaping
    weblogic.js             one function per WebLogic endpoint / search payload
    config.js               the `edit` tree: read, write, lock, activate, targeting
  stores/
    connection.js           live connections, saved profiles, active target
    ui.js                   theme, refresh interval, hint visibility, toasts
    changes.js              the domain's configuration lock and pending changes
    history.js              the browser's copy of the sampled runtime history
    alerts.js               the threshold rules, and what they have raised
    activity.js             what this console changed, and how to put it back
  composables/
    useResource.js          load + auto-refresh + abort + reload on domain switch
    useReconnect.js         password prompt for bringing a saved profile back
    useServerActions.js     start/suspend/resume/shutdown, single and in bulk
    useUrlState.js          keeps filters and sorting in the page's address
  settings/
    catalog.js              every editable setting: plain name, help, when it applies
  i18n/
    index.js                the t() function, the locale, and the language list
    tr.js                   Türkçe — keyed by the English string it replaces
  components/               AppShell, DataTable, CommandPalette, AlertsMenu,
                            ActivityMenu, SparkLine, TargetPicker, DeployDialog,
                            SnippetDialog, StateBadge, MeterBar, InfoTip,
                            HelpPanel, …
  views/                    one view per console section
  utils/format.js           bytes, durations, health/target normalisation
  utils/target.js           parses t3:// and host:port addresses into fields
  utils/wlst.js             the same operation written out as WLST and as curl
  utils/export.js           CSV and JSON downloads of whatever a table is showing
  utils/title.js            the tab title, shared by the router and the alert badge
```

The backend depends on nothing but Node's standard library. The front end
depends on Vue, Vue Router, Pinia and Tailwind — nothing else at runtime.

## Features

| Section           | What it shows                                                                | REST source                                                        |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Dashboard**     | Domain summary, per-server cards with state, heap, threads, uptime; a banner for running-but-unhealthy servers | `domainRuntime/search`, `domainConfig/servers`                      |
| **Servers**       | Configured + runtime view per server; start, suspend, resume, shutdown, force shutdown | `serverLifeCycleRuntimes` + actions                                 |
| **Clusters**      | Membership, alive counts, replication primaries/secondaries, resend counts     | `clusterRuntime` per member server                                  |
| **Deployments**   | Applications and shared libraries, targets, staging mode, per-server health; deploy an archive, redeploy, start, stop, undeploy | `appDeployments`, `applicationRuntimes`, `deploymentManager`         |
| **Data Sources**  | JDBC URL, driver, JNDI names, pool capacity; live active/waiting/failure counts and a connection test | `JDBCSystemResources`, `JDBCDataSourceRuntimeMBeans`, `testPool`     |
| **JMS**           | JMS servers and destinations with message counts and consumers, plus the persistent stores, SAF agents and bridges underneath them | `JMSRuntime`, `persistentStoreRuntimes`, `SAFRuntime`, `messagingBridgeRuntimes` |
| **Transactions**  | JTA totals per server — commits, rollbacks and why they rolled back, heuristics, average duration — and work manager queues | `JTARuntime`, `workManagerRuntimes`                                 |
| **Monitoring**    | Per-server JVM heap, committed size, uptime, Java version; thread pool busy/idle, hogging, **stuck**, queue depth, throughput, each with its recent history | `JVMRuntime`, `threadPoolRuntime`                                   |
| **Logs**          | Server log records with minimum-severity filter, message search, time window; the filters live in the URL | WLDF data accessor (`search`, with cursor fallback)                 |
| **Security**      | The realm, its authentication providers in the order they are consulted, and the users and groups they hold — read-only | `securityConfiguration/realms/…`                                    |
| **Compare**       | Two open domains side by side: what exists on one side only, and every attribute that differs | `domainConfig/search` against both connections                      |
| **REST Explorer** | Any endpoint of the management API, with bookmarks and pretty-printed JSON     | anything                                                            |
| **Connections**   | Saved domains and open sessions: switch, rename, close, forget                 | local, no WebLogic call                                             |

Click a server, cluster, data source or application in those lists and you get
its own page: what it is doing right now, the actions that apply to it, and its
settings. There is no separate "configuration" section — you change a thing
where you were already looking at it.

| Page                | What you can change there                                                     | MBeans                                                              |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A server**        | Listen address and ports, SSL port, start-up mode and auto-restart, graceful shutdown, stuck-thread thresholds, message size, JVM arguments Node Manager starts it with — plus its log file, rotation and per-destination severities | `edit/servers/{name}`, `/SSL`, `/serverStart`, `/log`               |
| **A cluster**       | Unicast or multicast messaging, cluster address, load-balancing algorithm, front-end host and ports | `edit/clusters/{name}`                                              |
| **A data source**   | Pool minimum/maximum/increment, reserve and inactive timeouts, connection testing, statement cache, transaction protocol, database URL and driver — and which servers and clusters it is targeted to | `edit/JDBCSystemResources/{name}`, `/JDBCResource/…`                |
| **An application**  | Deployment order, staging mode, deployment plan, and the servers and clusters it is deployed to | `edit/appDeployments/{name}`                                        |
| **Domain settings** | Administration port, configuration auditing, the classic console, the domain-wide log — reached from the Dashboard | `edit`, `edit/log`                                                  |

Across every page:

- **Several domains open at once**, with instant switching from the sidebar.
- **It watches while you are not looking.** The console process samples every
  live connection in the background, so a server leaving RUNNING, a heap past
  90%, a stuck thread or a queue that will not drain raises an alert on
  whichever page you are on — with a bell in the top bar, and optionally a
  desktop notification and a count in the tab title. Every threshold is yours to
  set, and each condition is reported once when it starts and once when it
  clears, not on every poll.
- **Recent history, not just the current reading.** The same samples draw a
  sparkline under each heap and thread-pool bar. A heap that sawtooths is
  healthy garbage collection; one that climbs in steps is a leak, and that is
  visible the moment the page opens.
- **Ctrl-K goes anywhere.** One box holding every page and every server,
  cluster, data source and application in the domain — three keystrokes instead
  of a page load, a filter and a click.
- **Linkable views.** Table filters, sorting and the whole Logs query live in
  the page's address, so a search can go in a ticket, survives a reload, and
  steps back with the browser's back button.
- **Bulk operations and exports.** Tick a set of servers or applications and
  act on all of them at once; save what any table is showing as CSV or JSON,
  with the filter and sort you applied.
- **Recent changes, with a way back.** The console keeps a short log of what
  it changed — attribute by attribute, with the value before and the value
  after — and offers *Roll back* on the ones that have an inverse. Entries
  expire fifteen minutes after the change by default, and the window is
  settable. See [Activity and rollback](#activity-and-rollback).
- **Every change, as a script.** Any operation that changes something offers
  *Show script*: the same thing written as WLST, and as the exact REST call the
  console makes. Read it before confirming, or keep it for the change record.
- **Auto-refresh** with a selectable interval (off / 5s / 15s / 30s / 60s) that
  pauses while the tab is hidden, so a console left open overnight does not
  hammer the AdminServer.
- **Sortable, filterable tables** with per-column sorting and a live filter.
- **Dark and light themes**, remembered per browser.
- **Confirmation prompts** on every state-changing operation, each explaining
  what the operation actually does before you commit to it.
- **Settings that explain themselves.** Every field has the name an operator
  would use, one sentence on what happens when it is wrong, its WebLogic MBean
  attribute underneath, and a badge saying when the change takes effect — live
  on activate, after a restart, at next start, or on redeploy.
- **WebLogic's staged edits, made visible.** Changing a setting takes the
  domain-wide configuration lock, writes a pending change and activates it. A
  bar at the top of the page always says whether anything is waiting, and who
  holds the lock when it is not you. Edited fields show the value the
  AdminServer still holds, and leaving the page with unsaved edits asks first.
- **Actionable errors** — connection failures are translated into what to check,
  not just an error code.
- **Built-in help.** Every page opens with a collapsible *how this page works*
  panel, and the ⓘ next to a field, a column header or a metric explains what
  that number means and what to do when it looks wrong. The ⓘ button in the top
  bar hides all of it once you no longer need it; the choice is remembered per
  browser, as is each panel's open state.

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
  enforces this; the console only reflects it. The Compare page is a good use for
  a `Monitor` account: it only reads.

  WebLogic exposes no list of what a role may do, but it does answer `403` to
  what a role may not reach — so at connect the backend reads the edit tree once
  and remembers the answer. A user who cannot configure the domain gets a
  **Read-only** badge in the top bar, settings pages that open with a banner and
  disabled fields instead of a Save that would be refused at the end, and greyed
  Deploy, Redeploy and Undeploy buttons. Anything the probe cannot settle stays
  enabled: a `403` arriving later is reported as *"You are not authorized to do
  this"* with whatever WebLogic said underneath, and the console narrows what it
  offers from then on.
- **An uploaded archive passes through this process.** Deploying holds the file
  in the console's memory just long enough to forward it, and writes nothing to
  disk. `WLC_MAX_UPLOAD_MB` (256 by default) caps how large that can be; raise
  it deliberately, since the whole archive is buffered.
- **Background sampling costs one small request per domain per interval.** On a
  domain where even that is unwelcome, `WLC_SAMPLE_MS=0` turns it off — the
  charts and alerts go quiet with it, and the console says so rather than
  showing empty graphs.

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
| *Invalid host*                                   | The host field still holds a URL fragment. A `t3://` address is fine; a path or a space is not |
| *Port 7101 is already in use*                    | Another copy is running. Stop it or use `WLC_PORT`                            |

Other things worth knowing:

- **A page shows no data.** Most runtime MBeans only exist on *running* servers.
  A stopped server has configuration but no runtime, so JMS, monitoring and pool
  statistics will legitimately be empty.
- **The Logs page returns nothing.** Widen the time window or lower the minimum
  severity — the default is the last hour at `Warning` and above.
- **The sparklines stay empty.** History is collected by the console process
  while a browser session is active, so a freshly started console has nothing to
  draw yet — give it a few minutes. If the alerts panel says sampling is off,
  the backend was started with `WLC_SAMPLE_MS=0`.
- **The Security page says users are not exposed.** Not every WebLogic release
  offers the realm's accounts over REST. The realm and its providers are still
  read correctly; the accounts themselves need WLST or the Remote Console.
- **A deployment fails with 413.** The archive is larger than
  `WLC_MAX_UPLOAD_MB`. Raise it and restart the console.
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
Add `state-key` to put its filter and sort in the URL, `export-name` for the CSV
and JSON buttons, and `selectable` with `v-model:selected` for bulk operations.

### Notes for contributors

- WebLogic returns collections as `{items: [...]}` and singletons as bare
  objects. Always normalise with `items()` from `src/utils/format.js`.
- `healthState` is an object in current releases and a `HEALTH_*` string in older
  ones — `healthOf()` handles both.
- Anything that changes domain state must go through a `ConfirmDialog` and
  report success and failure through the toast store. Pass it
  `script: {wlst, curl}` from [`src/utils/wlst.js`](src/utils/wlst.js) so the
  operator can read the operation before confirming it.
- Runtime attribute names moved between WebLogic releases. For a new subtree,
  either name the fields you are sure of or omit `fields` entirely and read the
  result defensively — naming one attribute a release does not have fails the
  whole search.

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

- **Creating and deleting servers, clusters and data sources** — applications
  can now be deployed and undeployed, and anything that exists can be edited and
  re-targeted, but adding a new data source or removing a server still needs
  WLST or the Remote Console.
- **History that outlives the process** — samples are kept in memory for a
  couple of hours. Anything longer belongs in a real metrics store, and an
  exporter for one would be the honest way to do it.
- **Editing the security realm** — users, groups and role mappings are shown,
  but changing them is deliberately left to tools with an audit trail.
- **Alert delivery beyond the browser** — a webhook or an email for the rules
  that already exist.

## License

MIT — see [LICENSE](LICENSE).
