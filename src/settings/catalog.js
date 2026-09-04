/**
 * Every configurable setting, described in plain language.
 *
 * Each entry here is a section of settings for one kind of object, and it is
 * rendered by SettingsPanel on that object's own page: the servers section on a
 * server's page, the data source section on a data source's page, and so on.
 * There is deliberately no separate "configuration" area — you change a thing
 * where you were already looking at it.
 *
 * The classic console shows WebLogic's own attribute names — MaxCapacity,
 * StuckThreadMaxTime, FileMinSize — and leaves you to work out what they do.
 * Here every field carries the name an operator would use, one sentence on what
 * happens when it is wrong, and when a new value actually takes effect. The
 * MBean attribute is still shown underneath, so anyone who knows WLST or the
 * Oracle documentation can map the two.
 *
 * Adding a setting means adding an entry here and nothing else: the page
 * renders whatever it finds in this file.
 */

import { clusterPath, dataSourcePath, deploymentPath, serverPath } from '@/api/config'

/**
 * When a change starts having an effect. Every field says which one it is,
 * because "I changed it and nothing happened" is the most common surprise.
 */
export const IMPACTS = {
  live: {
    label: 'Live on activate',
    help: 'The running domain picks this up as soon as the change is activated. No restart needed.',
    tone: 'emerald',
  },
  restart: {
    label: 'Needs a restart',
    help: 'The change is saved and activated, but the server keeps running with its old value until it is restarted.',
    tone: 'amber',
  },
  nextStart: {
    label: 'Used at next start',
    help: 'Only read while a server is starting, so nothing changes until the next time that server is started.',
    tone: 'sky',
  },
  redeploy: {
    label: 'Needs a redeploy',
    help: 'Takes effect when the resource is redeployed, or when its target servers are restarted.',
    tone: 'amber',
  },
}

const SEVERITIES = [
  { value: 'Trace', label: 'Trace — everything, extremely noisy' },
  { value: 'Debug', label: 'Debug — diagnostic detail' },
  { value: 'Info', label: 'Info — normal operational messages (default)' },
  { value: 'Notice', label: 'Notice — noteworthy but harmless' },
  { value: 'Warning', label: 'Warning — something looks wrong' },
  { value: 'Error', label: 'Error — a request or subsystem failed' },
  { value: 'Critical', label: 'Critical — a subsystem is unusable' },
  { value: 'Alert', label: 'Alert — needs attention immediately' },
  { value: 'Emergency', label: 'Emergency — the server is unusable' },
  { value: 'Off', label: 'Off — write nothing to this destination' },
]

/** Shared by the archive and its deployment plan: they stage the same three ways. */
const STAGING_MODES = [
  { value: 'stage', label: 'stage — copy it to each server' },
  { value: 'nostage', label: 'nostage — every server reads the same path' },
  { value: 'external_stage', label: 'external_stage — you place the files yourself' },
]

const ROTATION = [
  { value: 'none', label: 'Never rotate — one file that grows forever' },
  { value: 'bySize', label: 'By size — start a new file once it gets big' },
  { value: 'byTime', label: 'By time — start a new file on a schedule' },
]

/** Shared by the per-server log and the domain log: the same MBean type. */
const logFileFields = (what) => [
  {
    attr: 'fileName',
    label: 'Log file path',
    help: `Where ${what} is written. A relative path is resolved against the domain directory.`,
    type: 'text',
    impact: 'restart',
    mono: true,
  },
  {
    attr: 'rotationType',
    label: 'When to start a new file',
    help: 'Rotation keeps a single log from filling the disk. By size is the usual choice; by time suits domains where logs are shipped nightly.',
    type: 'select',
    options: ROTATION,
    impact: 'live',
  },
  {
    attr: 'fileMinSize',
    label: 'Rotate when the file reaches',
    help: 'Only used when rotation is by size. The size is checked periodically, so a file can grow slightly past this before it rotates.',
    type: 'number',
    unit: 'KB',
    min: 1,
    impact: 'live',
  },
  {
    attr: 'fileTimeSpan',
    label: 'Rotate every',
    help: 'Only used when rotation is by time. 24 gives one file per day.',
    type: 'number',
    unit: 'hours',
    min: 1,
    impact: 'live',
  },
  {
    attr: 'numberOfFilesLimited',
    label: 'Delete the oldest files',
    help: 'On, only the number of files below is kept and the rest are deleted. Off, old logs pile up until the disk is full — the usual reason a domain suddenly stops writing logs.',
    type: 'boolean',
    impact: 'live',
  },
  {
    attr: 'fileCount',
    label: 'Files to keep',
    help: 'How many rotated files survive, besides the one being written. Only used when deleting old files is on.',
    type: 'number',
    min: 1,
    impact: 'live',
  },
  {
    attr: 'rotateLogOnStartup',
    label: 'Start a new file on every boot',
    help: 'Makes each start begin a fresh log, which makes "what happened during the last start-up" easy to answer.',
    type: 'boolean',
    impact: 'nextStart',
  },
]

export const CATEGORIES = [
  // ------------------------------------------------------------------ servers
  {
    key: 'servers',
    label: 'Servers',
    blurb: 'Where a server listens, how it starts and stops, and when it calls a thread stuck.',
    groups: [
      {
        key: 'network',
        title: 'Listen address and port',
        description:
          'How clients and other servers reach this server. Get one of these wrong and the server still starts, but nothing can connect to it.',
        path: serverPath,
        fields: [
          {
            attr: 'listenAddress',
            label: 'Listen address',
            help: 'The address this server binds to. Empty means every address of the machine, which is what most domains want. Set it only when the machine has several networks and this server should answer on one of them.',
            type: 'text',
            placeholder: 'empty — listen on every address',
            impact: 'restart',
            mono: true,
          },
          {
            attr: 'listenPort',
            label: 'Plain (non-SSL) port',
            help: 'The port for plain HTTP and t3 traffic. Two servers on the same machine can never share a port; that clash appears as "Address already in use" at start-up.',
            type: 'number',
            min: 1,
            max: 65535,
            impact: 'restart',
          },
          {
            attr: 'listenPortEnabled',
            label: 'Plain port open',
            help: 'Turn this off to make the server reachable over SSL only. Check that the SSL port below really works first, or the server becomes unreachable after its next restart.',
            type: 'boolean',
            impact: 'restart',
          },
          {
            attr: 'tunnelingEnabled',
            label: 'Allow t3 tunnelled over HTTP',
            help: 'Lets t3 clients reach the server through firewalls and proxies that only pass HTTP. Leave it off unless a client needs it.',
            type: 'boolean',
            impact: 'restart',
          },
        ],
      },
      {
        key: 'ssl',
        title: 'SSL port',
        description:
          'The HTTPS and t3s listener. It needs a working identity keystore — without one the server logs a keystore error at start-up and the SSL port stays closed.',
        path: (name) => `${serverPath(name)}/SSL`,
        fields: [
          {
            attr: 'enabled',
            label: 'SSL port open',
            help: 'Whether this server listens for HTTPS and t3s at all.',
            type: 'boolean',
            impact: 'restart',
          },
          {
            attr: 'listenPort',
            label: 'SSL port',
            help: 'The HTTPS port. It has to differ from the plain port above and from every other server on the same machine.',
            type: 'number',
            min: 1,
            max: 65535,
            impact: 'restart',
          },
          {
            attr: 'hostnameVerificationIgnored',
            label: 'Accept certificates that do not match the hostname',
            help: 'Lets this server trust a certificate issued to a different name. Convenient with self-signed certificates in a test domain; in production it gives up a real protection against a man in the middle.',
            type: 'boolean',
            impact: 'restart',
          },
        ],
      },
      {
        key: 'lifecycle',
        title: 'Start-up and shutdown',
        description: 'What the server does when it is started, and how patient a graceful shutdown is.',
        path: serverPath,
        fields: [
          {
            attr: 'startupMode',
            label: 'State to start in',
            help: 'RUNNING serves traffic immediately. ADMIN starts everything but refuses application requests until you resume it, which is useful when you want to check a server before it takes load.',
            type: 'select',
            options: [
              { value: 'RUNNING', label: 'RUNNING — serve traffic as soon as it is up' },
              { value: 'ADMIN', label: 'ADMIN — start, but refuse application traffic' },
              { value: 'STANDBY', label: 'STANDBY — listen on the administration port only' },
            ],
            impact: 'nextStart',
          },
          {
            attr: 'autoRestart',
            label: 'Let Node Manager restart it after a crash',
            help: 'Only has an effect for servers started by Node Manager, and it never restarts a server you shut down deliberately.',
            type: 'boolean',
            impact: 'live',
          },
          {
            attr: 'restartMax',
            label: 'Restart attempts allowed',
            help: 'How many times Node Manager retries within the window below before it gives up and leaves the server down.',
            type: 'number',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'restartIntervalSeconds',
            label: 'Restart attempt window',
            help: 'The period those attempts are counted over, so a server that keeps failing stops being restarted instead of looping forever.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'gracefulShutdownTimeout',
            label: 'Graceful shutdown waits at most',
            help: 'How long a graceful shutdown lets in-flight work finish before stopping anyway. 0 means wait as long as it takes, which is why a shutdown sometimes looks like it has hung.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'ignoreSessionsDuringShutdown',
            label: 'Do not wait for HTTP sessions',
            help: 'On, a graceful shutdown drops sessions instead of waiting for them to end. Safe where sessions are replicated across a cluster or the application does not rely on them.',
            type: 'boolean',
            impact: 'live',
          },
        ],
      },
      {
        key: 'health',
        title: 'Stuck threads and request limits',
        description: 'When WebLogic decides a request thread is stuck, and how large a single request may be.',
        path: serverPath,
        fields: [
          {
            attr: 'stuckThreadMaxTime',
            label: 'Call a thread stuck after',
            help: 'A request thread busy for longer than this is logged as stuck and counted on the Monitoring page. Lower it to notice hangs sooner; raise it in domains with legitimately long jobs, or the log fills with false alarms.',
            type: 'number',
            unit: 'seconds',
            min: 1,
            impact: 'live',
          },
          {
            attr: 'stuckThreadTimerInterval',
            label: 'Check for stuck threads every',
            help: 'How often that check runs. It is cheap, so the default rarely needs changing.',
            type: 'number',
            unit: 'seconds',
            min: 1,
            impact: 'live',
          },
          {
            attr: 'maxMessageSize',
            label: 'Largest accepted message',
            help: 'The biggest single request the server accepts over HTTP and t3. Uploads above this are rejected before the application ever sees them.',
            type: 'number',
            unit: 'bytes',
            min: 4096,
            impact: 'restart',
          },
          {
            attr: 'acceptBacklog',
            label: 'Pending connection queue',
            help: 'How many TCP connections the operating system may queue before the server accepts them. Raise it only if connections are refused during traffic spikes.',
            type: 'number',
            min: 0,
            impact: 'restart',
          },
        ],
      },
      {
        key: 'serverStart',
        title: 'Java command line (Node Manager only)',
        description:
          'What Node Manager passes to the JVM when it starts this server. A server started from a shell script uses that script instead and ignores everything here.',
        path: (name) => `${serverPath(name)}/serverStart`,
        fields: [
          {
            attr: 'arguments',
            label: 'JVM arguments',
            help: 'Extra options for the java command, for example -Xms2g -Xmx2g -XX:+UseG1GC. This is where heap size is set for a server that Node Manager starts.',
            type: 'textarea',
            placeholder: '-Xms1g -Xmx2g',
            impact: 'nextStart',
            mono: true,
          },
          {
            attr: 'javaHome',
            label: 'Java home',
            help: 'The JDK this server is started with. Empty means the one Node Manager itself runs on.',
            type: 'text',
            impact: 'nextStart',
            mono: true,
          },
          {
            attr: 'classPath',
            label: 'Classpath',
            help: 'Put in front of the server classpath. Usually empty — libraries belong in the domain lib directory or in a deployment.',
            type: 'textarea',
            impact: 'nextStart',
            mono: true,
          },
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- clusters
  {
    key: 'clusters',
    label: 'Clusters',
    blurb: 'How cluster members find each other, and how load is spread across them.',
    groups: [
      {
        key: 'messaging',
        title: 'How members find each other',
        description:
          'Cluster members exchange heartbeats. Unicast is the modern default and works on networks where multicast is blocked.',
        path: clusterPath,
        fields: [
          {
            attr: 'clusterMessagingMode',
            label: 'Messaging mode',
            help: 'Unicast sends heartbeats over TCP through a few chosen members. Multicast needs the network to forward multicast traffic, which most data centres no longer do.',
            type: 'select',
            options: [
              { value: 'unicast', label: 'unicast — TCP, works on any network' },
              { value: 'multicast', label: 'multicast — needs multicast enabled on the network' },
            ],
            impact: 'restart',
          },
          {
            attr: 'clusterAddress',
            label: 'Cluster address',
            help: 'The host:port list clients use to reach the cluster, for example ms1:7003,ms2:7003. It is handed out with t3 references; leave it empty to have WebLogic build one from the running members.',
            type: 'text',
            placeholder: 'ms1:7003,ms2:7003',
            impact: 'restart',
            mono: true,
          },
          {
            attr: 'numberOfServersInClusterAddress',
            label: 'Members in a generated address',
            help: 'When the cluster address is generated rather than typed, this is how many members go into it.',
            type: 'number',
            min: 0,
            impact: 'restart',
          },
          {
            attr: 'multicastAddress',
            label: 'Multicast address',
            help: 'Only used in multicast mode. Two clusters on the same network must not share an address and port, or they see each other’s heartbeats.',
            type: 'text',
            impact: 'restart',
            mono: true,
          },
          {
            attr: 'multicastPort',
            label: 'Multicast port',
            help: 'Only used in multicast mode.',
            type: 'number',
            min: 1,
            max: 65535,
            impact: 'restart',
          },
        ],
      },
      {
        key: 'balancing',
        title: 'Load balancing and front end',
        description: 'How work is spread over the members, and the address the outside world sees.',
        path: clusterPath,
        fields: [
          {
            attr: 'defaultLoadAlgorithm',
            label: 'Load balancing algorithm',
            help: 'Round robin is even and stateless. The affinity variants keep a client on the member it used last, which helps when the application caches per-user data in memory.',
            type: 'select',
            options: [
              { value: 'round-robin', label: 'round-robin — each member in turn' },
              { value: 'weight-based', label: 'weight-based — by each member’s configured weight' },
              { value: 'random', label: 'random' },
              { value: 'round-robin-affinity', label: 'round-robin-affinity — in turn, then stick to a member' },
              { value: 'weight-based-affinity', label: 'weight-based-affinity' },
              { value: 'random-affinity', label: 'random-affinity' },
            ],
            impact: 'restart',
          },
          {
            attr: 'frontendHost',
            label: 'Front-end host',
            help: 'The hostname users actually type, usually the load balancer. WebLogic uses it when it builds a redirect, so without it users get redirected to an internal server name they cannot reach.',
            type: 'text',
            placeholder: 'shop.example.com',
            impact: 'live',
            mono: true,
          },
          {
            attr: 'frontendHTTPPort',
            label: 'Front-end HTTP port',
            help: 'The HTTP port on that front-end host. 0 means "do not rewrite the port".',
            type: 'number',
            min: 0,
            max: 65535,
            impact: 'live',
          },
          {
            attr: 'frontendHTTPSPort',
            label: 'Front-end HTTPS port',
            help: 'The HTTPS port on the front-end host, typically 443.',
            type: 'number',
            min: 0,
            max: 65535,
            impact: 'live',
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------- data sources
  {
    key: 'data-sources',
    label: 'Data sources',
    blurb: 'Pool sizing, the test that keeps dead connections out, and the database URL.',
    groups: [
      {
        key: 'pool',
        title: 'Pool size',
        description: 'How many database connections this data source keeps, on each server it is targeted to.',
        path: (name) => `${dataSourcePath(name)}/JDBCConnectionPoolParams`,
        fields: [
          {
            attr: 'initialCapacity',
            label: 'Connections created at start-up',
            help: 'Opened while the server boots. A high number makes start-up slower but avoids a slow first request; if the database is down, the data source fails to deploy unless the retry setting below is on.',
            type: 'number',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'minCapacity',
            label: 'Connections kept when idle',
            help: 'The pool never shrinks below this, so a quiet period does not force every connection to be opened again later.',
            type: 'number',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'maxCapacity',
            label: 'Maximum connections',
            help: 'The ceiling. Requests queue once every connection is busy, so this is what to raise when the Data Sources page shows threads waiting — but the database has its own session limit, and going past that is worse.',
            type: 'number',
            min: 1,
            impact: 'live',
          },
          {
            attr: 'capacityIncrement',
            label: 'Connections added at a time',
            help: 'How many connections the pool opens at once when it has to grow.',
            type: 'number',
            min: 1,
            impact: 'live',
          },
          {
            attr: 'shrinkFrequencySeconds',
            label: 'Shrink back to the minimum every',
            help: 'How often unused connections above the minimum are closed. 0 disables shrinking, so the pool stays at its high-water mark until the server restarts.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'connectionReserveTimeoutSeconds',
            label: 'A request waits for a free connection',
            help: 'How long application code blocks when every connection is busy before it gets "No available connections in pool". -1 waits forever, 0 fails straight away.',
            type: 'number',
            unit: 'seconds',
            min: -1,
            impact: 'live',
          },
          {
            attr: 'inactiveConnectionTimeoutSeconds',
            label: 'Reclaim a leaked connection after',
            help: 'Takes back a connection the application borrowed and never closed. 0 disables the check, which is how a leak can drain a pool with nothing in the log to show for it.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
        ],
      },
      {
        key: 'testing',
        title: 'Connection testing',
        description:
          'What stops the pool handing a dead connection to the application after a database restart or a firewall timeout.',
        path: (name) => `${dataSourcePath(name)}/JDBCConnectionPoolParams`,
        fields: [
          {
            attr: 'testConnectionsOnReserve',
            label: 'Test before handing a connection out',
            help: 'Costs one small round trip per checkout, and in exchange the application never receives a connection the database has already closed. Almost always worth it.',
            type: 'boolean',
            impact: 'live',
          },
          {
            attr: 'testTableName',
            label: 'Test query',
            help: 'A bare table name runs SELECT 1 FROM that table. Prefix a full statement with "SQL " — SQL SELECT 1 FROM DUAL on Oracle, SQL SELECT 1 on PostgreSQL and MySQL.',
            type: 'text',
            placeholder: 'SQL SELECT 1 FROM DUAL',
            impact: 'live',
            mono: true,
          },
          {
            attr: 'testFrequencySeconds',
            label: 'Test idle connections every',
            help: 'A background sweep that tests connections nobody is using and drops the broken ones. 0 turns the sweep off.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'secondsToTrustAnIdlePoolConnection',
            label: 'Skip the test for connections used within',
            help: 'A connection used this recently is handed out without testing. Raising it cuts test traffic; lowering it catches a database or firewall that drops connections quickly.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'connectionCreationRetryFrequencySeconds',
            label: 'Retry creating connections every',
            help: 'Lets a server start while the database is down: the data source deploys and keeps retrying instead of failing. 0 means no retry, which makes the database a start-up dependency.',
            type: 'number',
            unit: 'seconds',
            min: 0,
            impact: 'live',
          },
        ],
      },
      {
        key: 'statements',
        title: 'Prepared statement cache',
        description:
          'Reuses prepared statements per connection. It saves the database a parse, at the cost of one open cursor per cached statement.',
        path: (name) => `${dataSourcePath(name)}/JDBCConnectionPoolParams`,
        fields: [
          {
            attr: 'statementCacheSize',
            label: 'Statements cached per connection',
            help: 'Multiply this by the maximum pool size to get the cursors this data source can hold open on the database. On Oracle, that product running past the open_cursors limit is the classic ORA-01000.',
            type: 'number',
            min: 0,
            impact: 'live',
          },
          {
            attr: 'statementCacheType',
            label: 'What to drop when the cache is full',
            help: 'LRU discards the statement used least recently. FIXED keeps the first statements it cached and never replaces them.',
            type: 'select',
            options: [
              { value: 'LRU', label: 'LRU — drop the least recently used' },
              { value: 'FIXED', label: 'FIXED — keep the first ones cached' },
            ],
            impact: 'live',
          },
        ],
      },
      {
        key: 'transactions',
        title: 'Transactions',
        description: 'How this data source takes part in a transaction that spans more than one resource.',
        path: (name) => `${dataSourcePath(name)}/JDBCDataSourceParams`,
        fields: [
          {
            attr: 'globalTransactionsProtocol',
            label: 'Global transaction protocol',
            help: 'TwoPhaseCommit needs an XA driver. LoggingLastResource lets a single non-XA database join a global transaction safely and is the usual choice. None keeps the data source out of global transactions entirely.',
            type: 'select',
            options: [
              { value: 'TwoPhaseCommit', label: 'TwoPhaseCommit — full XA, needs an XA driver' },
              { value: 'LoggingLastResource', label: 'LoggingLastResource — one non-XA database, safely' },
              { value: 'EmulateTwoPhaseCommit', label: 'EmulateTwoPhaseCommit — no XA, can lose atomicity' },
              { value: 'OnePhaseCommit', label: 'OnePhaseCommit — the default for a non-XA driver' },
              { value: 'None', label: 'None — never joins a global transaction' },
            ],
            impact: 'redeploy',
          },
        ],
      },
      {
        key: 'driver',
        title: 'Database connection',
        description:
          'Where this data source connects and with which driver. Both affect every application using it, so press Test on the Data Sources page once the change is live.',
        path: (name) => `${dataSourcePath(name)}/JDBCDriverParams`,
        fields: [
          {
            attr: 'url',
            label: 'Database URL',
            help: 'The JDBC URL, for example jdbc:oracle:thin:@//db1:1521/ORCLPDB1. The database user and password are not changed here.',
            type: 'text',
            impact: 'redeploy',
            mono: true,
          },
          {
            attr: 'driverName',
            label: 'Driver class',
            help: 'The JDBC driver class. It has to be on the server classpath, otherwise the data source fails to deploy with a ClassNotFoundException.',
            type: 'text',
            impact: 'redeploy',
            mono: true,
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- deployments
  {
    key: 'deployments',
    label: 'Deployments',
    blurb:
      'Start order, how the archive and its plan reach the servers, which security model the application runs under, and where its files are.',
    groups: [
      {
        key: 'deployment',
        title: 'Order and staging',
        description:
          'When this application is deployed relative to the others, and how its files get to each target server.',
        path: deploymentPath,
        fields: [
          {
            attr: 'deploymentOrder',
            label: 'Deployment order',
            help: 'Lower numbers deploy first and 100 is the default. Use it when one application has to be up before another can initialise — a shared service before the applications that call it, say.',
            type: 'number',
            min: 0,
            impact: 'nextStart',
          },
          {
            attr: 'stagingMode',
            label: 'How the archive reaches the servers',
            help: 'stage copies the archive to each server before deploying, which is what you want when servers live on different machines. nostage deploys from the same path on every server, so the file has to exist there — typically a shared mount. Getting this wrong shows up as a deployment that works on the AdminServer and fails everywhere else.',
            type: 'select',
            options: STAGING_MODES,
            impact: 'redeploy',
          },
          {
            attr: 'planStagingMode',
            label: 'How the plan reaches the servers',
            help: 'The same choice for the deployment plan. Left empty it follows the archive, which is nearly always right; set it only when the plan lives somewhere the archive does not.',
            type: 'select',
            options: [{ value: '', label: 'Follow the archive (default)' }, ...STAGING_MODES],
            impact: 'redeploy',
          },
        ],
      },
      {
        key: 'plan',
        title: 'Deployment plan and descriptors',
        description:
          'A plan is how the same archive runs in test and in production without being rebuilt: it overrides values in the descriptors that were packaged with it.',
        path: deploymentPath,
        fields: [
          {
            attr: 'planPath',
            label: 'Deployment plan',
            help: 'Path to the plan XML that overrides descriptor values for this environment — JDBC names, EJB pool sizes, context roots. Empty means the archive is deployed exactly as it was built.',
            type: 'text',
            placeholder: 'empty — no plan',
            impact: 'redeploy',
            mono: true,
          },
          {
            attr: 'planDir',
            label: 'Plan directory',
            help: 'Where the plan and any external descriptors it references live. Usually the directory holding the plan file; needed when a plan brings its own descriptor files with it.',
            type: 'text',
            placeholder: 'empty — the plan file’s own directory',
            impact: 'redeploy',
            mono: true,
          },
          {
            attr: 'altDescriptorPath',
            label: 'Alternate Java EE descriptor',
            help: 'Deploys with a different application.xml or web.xml than the one inside the archive. Rare, and a deployment plan is usually the better answer — but it is how you deploy an archive you cannot rebuild.',
            type: 'text',
            placeholder: 'empty — use the descriptor in the archive',
            impact: 'redeploy',
            mono: true,
          },
          {
            attr: 'altWLSDescriptorPath',
            label: 'Alternate WebLogic descriptor',
            help: 'The same thing for weblogic-application.xml or weblogic.xml — the WebLogic-specific half of the configuration.',
            type: 'text',
            placeholder: 'empty — use the descriptor in the archive',
            impact: 'redeploy',
            mono: true,
          },
        ],
      },
      {
        key: 'app-security',
        title: 'Security model',
        description:
          'Where this application’s roles and policies come from: the descriptors it was built with, or the domain’s security realm.',
        path: deploymentPath,
        fields: [
          {
            attr: 'securityDDModel',
            label: 'Roles and policies come from',
            help: 'DD only takes both from the descriptors in the archive and ignores anything set in the realm. Custom roles lets the realm define who is in a role while the archive still decides what each role may do. Custom roles and policies puts both in the realm — that is the one to pick when access has to be changed without a rebuild. Advanced follows the realm’s own configuration. Changing this discards role and policy data that came from the other model, so read it before switching on a live application.',
            type: 'select',
            options: [
              { value: 'DDOnly', label: 'DD only — everything from the archive’s descriptors (default)' },
              { value: 'CustomRoles', label: 'Custom roles — roles from the realm, policies from the archive' },
              { value: 'CustomRolesAndPolicies', label: 'Custom roles and policies — both from the realm' },
              { value: 'Advanced', label: 'Advanced — as configured in the security realm' },
            ],
            impact: 'redeploy',
          },
          {
            attr: 'validateDDSecurityData',
            label: 'Check the descriptors’ security data on deploy',
            help: 'Validates the roles and policies in the descriptors as the application deploys. It catches a principal that does not exist at deployment time rather than at the first request that needs it.',
            type: 'boolean',
            impact: 'redeploy',
          },
          {
            attr: 'deploymentPrincipalName',
            label: 'Deploy as user',
            help: 'The user this application is deployed and started as when a server boots. Empty means the server’s own identity, which is the usual case. Set it when the application reads files or resources only a particular account may reach.',
            type: 'text',
            placeholder: 'empty — the server’s own identity',
            impact: 'redeploy',
          },
        ],
      },
      {
        key: 'deployment-files',
        title: 'Where the files are',
        description:
          'Resolved by the AdminServer, and read-only here: moving an application means deploying it again, not editing a path.',
        path: deploymentPath,
        fields: [
          {
            attr: 'sourcePath',
            label: 'Archive path',
            help: 'The path as it was given when the application was deployed. Relative paths are resolved against the domain directory.',
            type: 'text',
            readonly: true,
            mono: true,
          },
          {
            attr: 'absoluteSourcePath',
            label: 'Archive path, resolved',
            help: 'The full path the AdminServer resolved that to. This is the first thing to check when a deployment fails with a file-not-found on one server only.',
            type: 'text',
            readonly: true,
            mono: true,
          },
          {
            attr: 'absolutePlanPath',
            label: 'Plan path, resolved',
            help: 'The full path of the deployment plan actually in use, if there is one.',
            type: 'text',
            readonly: true,
            mono: true,
          },
          {
            attr: 'installDir',
            label: 'Install directory',
            help: 'Set when the application follows the installation-directory layout, with app/ and plan/ subdirectories. Empty for a plain archive deployment.',
            type: 'text',
            readonly: true,
            mono: true,
          },
          {
            attr: 'moduleType',
            label: 'Module type',
            help: 'war for a web application, ear for an enterprise application, jar for an EJB module, rar for a resource adapter.',
            type: 'text',
            readonly: true,
          },
          {
            attr: 'versionIdentifier',
            label: 'Version',
            help: 'The version this deployment carries, if it was built with one. Versioned applications can be deployed side by side, with the older one retiring as its sessions finish.',
            type: 'text',
            readonly: true,
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ logging
  {
    key: 'logging',
    label: 'Logging',
    blurb: 'Each server’s log file, its rotation, and how much detail every destination gets.',
    groups: [
      {
        key: 'file',
        title: 'Log file and rotation',
        description: 'The file this server writes, and when a new one is started.',
        path: (name) => `${serverPath(name)}/log`,
        fields: logFileFields('this server’s log'),
      },
      {
        key: 'severity',
        title: 'How much gets logged, and where',
        description:
          'A message reaches a destination only if it is at least as severe as that destination’s level. Debug and Trace can produce gigabytes an hour on a busy server.',
        path: (name) => `${serverPath(name)}/log`,
        fields: [
          {
            attr: 'loggerSeverity',
            label: 'Overall floor',
            help: 'Nothing below this level is produced at all, whatever the destinations below ask for. This is the setting to lower first when a Debug level elsewhere seems to be ignored.',
            type: 'select',
            options: SEVERITIES,
            impact: 'live',
          },
          {
            attr: 'logFileSeverity',
            label: 'Written to the log file',
            help: 'What ends up in the server log file, and therefore in the Logs page.',
            type: 'select',
            options: SEVERITIES,
            impact: 'live',
          },
          {
            attr: 'stdoutSeverity',
            label: 'Printed to standard out',
            help: 'What appears on the console or in nohup.out. Info is normal; Debug here slows a server down through terminal output alone.',
            type: 'select',
            options: SEVERITIES,
            impact: 'live',
          },
          {
            attr: 'domainLogBroadcastSeverity',
            label: 'Forwarded to the domain log',
            help: 'Messages this severe or worse are also sent to the AdminServer’s domain-wide log. Lowering it across a large domain puts real load on the AdminServer.',
            type: 'select',
            options: SEVERITIES,
            impact: 'live',
          },
        ],
      },
      {
        key: 'stdout',
        title: 'Standard output',
        description: 'What happens to what the application prints itself.',
        path: (name) => `${serverPath(name)}/log`,
        fields: [
          {
            attr: 'redirectStdoutToServerLogEnabled',
            label: 'Capture System.out into the server log',
            help: 'On, anything the application prints also lands in the server log, where the Logs page can search it — instead of only in the terminal that started the server.',
            type: 'boolean',
            impact: 'live',
          },
          {
            attr: 'stdoutLogStack',
            label: 'Print stack traces to standard out',
            help: 'Off, standard out shows only the message of an exception and the stack stays in the log file.',
            type: 'boolean',
            impact: 'live',
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- domain
  {
    key: 'domain',
    label: 'Domain',
    blurb: 'Settings that apply to the whole domain, including the domain-wide log.',
    groups: [
      {
        key: 'domain',
        title: 'Domain',
        description: 'Whole-domain switches — the ones worth reading twice before changing.',
        path: () => '/edit',
        fields: [
          {
            attr: 'name',
            label: 'Domain name',
            help: 'Fixed when the domain was created.',
            type: 'text',
            readonly: true,
          },
          {
            attr: 'productionModeEnabled',
            label: 'Production mode',
            help: 'Production mode requires the configuration lock for every change and turns off auto-deployment. Switching it needs every server in the domain restarted, so it is read-only here.',
            type: 'boolean',
            readonly: true,
          },
          {
            attr: 'administrationPortEnabled',
            label: 'Administration port',
            help: 'Moves all administration traffic onto one SSL port, separate from application traffic. It requires SSL configured on every server — without that, the domain is unmanageable after the restart.',
            type: 'boolean',
            impact: 'restart',
          },
          {
            attr: 'administrationPort',
            label: 'Administration port number',
            help: 'The port used when the administration port is on. Every server in the domain shares this number.',
            type: 'number',
            min: 1,
            max: 65535,
            impact: 'restart',
          },
          {
            attr: 'configurationAuditType',
            label: 'Audit configuration changes',
            help: 'Records who changed what. "log" writes to the server log, "audit" sends it to the auditing provider, "logaudit" does both.',
            type: 'select',
            options: [
              { value: 'none', label: 'none — do not record changes' },
              { value: 'log', label: 'log — write changes to the server log' },
              { value: 'audit', label: 'audit — send to the auditing provider' },
              { value: 'logaudit', label: 'logaudit — both' },
            ],
            impact: 'restart',
          },
          {
            attr: 'consoleEnabled',
            label: 'Classic WebLogic console',
            help: 'Whether the AdminServer serves /console. This console talks to the REST API instead, so it keeps working either way.',
            type: 'boolean',
            impact: 'restart',
          },
        ],
      },
      {
        key: 'domain-log',
        title: 'Domain log',
        description: 'The combined log on the AdminServer that collects what every server broadcasts.',
        path: () => '/edit/log',
        fields: logFileFields('the domain-wide log'),
      },
    ],
  },
]

export const categoryByKey = (key) => CATEGORIES.find((c) => c.key === key)
