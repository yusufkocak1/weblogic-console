/**
 * Türkçe — the console's own words, not WebLogic's.
 *
 * GLOSSARY: these stay in English, on purpose.
 *
 *   server · cluster · domain · deployment · data source · target · realm
 *   heap · thread · thread pool · stuck thread · session · queue · topic
 *   JMS · JTA · JDBC · JVM · MBean · WLST · REST · JNDI · Node Manager
 *   AdminServer · work manager · commit · rollback · log · timeout · plan
 *   RUNNING · ADMIN · STANDBY · SHUTDOWN · production mode · staging modes
 *
 * The reason is not laziness. A Turkish WebLogic operator types `srvr` into
 * WLST, reads `<Server started in RUNNING mode>` in a log file, and searches
 * Oracle's documentation in English. Rendering "cluster" as "küme" or "heap" as
 * "yığın" invents a second vocabulary that exists only inside this console and
 * has to be translated back before it is useful anywhere else. So the console's
 * sentences are Turkish, and the product's nouns are left alone.
 *
 * Where a term takes a Turkish suffix the apostrophe follows pronunciation, the
 * way Turkish technical writing does it: `server'lar` (read /sörvır/, so the
 * suffix is separated) but `loglar` (read as written, so it is not).
 */

export default {
  // ---------------------------------------------------------------- navigation
  'Dashboard': 'Genel Bakış',
  'Domain overview: how many servers run, plus a card per server with heap, threads and health.':
    'Domain özeti: kaç server çalışıyor, ayrıca her server için heap, thread ve sağlık durumunu gösteren birer kart.',
  'Servers': "Server'lar",
  'Start, suspend, resume and shut down servers, and see their listen address, heap and uptime.':
    "Server'ları başlatın, askıya alın, sürdürün ve kapatın; listen adreslerini, heap ve çalışma sürelerini görün.",
  'Clusters': "Cluster'lar",
  'Cluster membership, how many members are alive, and session replication counts.':
    'Cluster üyelikleri, kaç üyenin ayakta olduğu ve session replikasyon sayıları.',
  'Deployments': "Deployment'lar",
  'Applications and shared libraries: where they are targeted and whether they are healthy. Start and stop them here.':
    "Uygulamalar ve paylaşılan kütüphaneler: hangi target'lara atandıkları ve sağlıklı olup olmadıkları. Başlatma ve durdurma da burada.",
  'Data Sources': "Data Source'lar",
  'JDBC pools with live connection counts, and a Test button that opens a real connection.':
    'Anlık bağlantı sayılarıyla JDBC havuzları ve gerçek bir bağlantı açan Test düğmesi.',
  'JMS': 'JMS',
  'Messaging runtime: JMS servers, queues and topics with current, pending and high message counts.':
    "Mesajlaşma runtime'ı: JMS server'ları, queue ve topic'ler; anlık, bekleyen ve tepe mesaj sayılarıyla.",
  'Transactions': "Transaction'lar",
  'JTA totals and work managers: commits, rollbacks, timeouts and the queues behind them.':
    "JTA toplamları ve work manager'lar: commit, rollback, timeout sayıları ve arkalarındaki kuyruklar.",
  'Monitoring': 'İzleme',
  'Per-server JVM heap and thread pool detail — the page to open when something feels slow.':
    'Server bazında JVM heap ve thread pool detayı — bir şey yavaşladığında açılacak sayfa.',
  'Logs': 'Loglar',
  'Search server logs by severity, time window and message text, without shell access to the machine.':
    'Server loglarını önem derecesi, zaman aralığı ve mesaj metnine göre arayın; makineye shell erişimi gerekmez.',
  'Security': 'Güvenlik',
  'The security realm: which providers authenticate, and the users and groups they hold.':
    "Güvenlik realm'i: kimlik doğrulamayı hangi provider'lar yapıyor ve içlerinde hangi kullanıcılarla gruplar var.",
  'Compare': 'Karşılaştırma',
  'Two open domains side by side: what test has that production does not, and where the two have drifted.':
    "Açık iki domain yan yana: test'te olup production'da olmayanlar ve ikisinin birbirinden ayrıştığı yerler.",
  'REST Explorer': 'REST Explorer',
  'Call any management REST endpoint directly, for anything the other pages do not cover.':
    "Diğer sayfaların kapsamadığı her şey için herhangi bir yönetim REST endpoint'ini doğrudan çağırın.",

  // --------------------------------------------------------------------- shell
  'Active domain': 'Etkin domain',
  'Active connection': 'Etkin bağlantı',
  'Every page below shows data for this domain only. Click the name to switch to another open AdminServer, add one, or manage saved connections.':
    "Aşağıdaki sayfaların hepsi yalnızca bu domain'in verisini gösterir. Başka bir açık AdminServer'a geçmek, yeni bir tane eklemek veya kayıtlı bağlantıları yönetmek için isme tıklayın.",
  'What the connection selector does': 'Bağlantı seçici ne işe yarar',
  'Signed in as': 'Bağlı:',
  '{count} connections open': '{count} bağlantı açık',
  'Close every open connection and return to the sign-in screen. Saved profiles are kept.':
    'Açık bütün bağlantıları kapatır ve giriş ekranına döner. Kayıtlı profiller korunur.',
  'Close this connection and return to the sign-in screen. The saved profile is kept, the password is forgotten.':
    'Bu bağlantıyı kapatır ve giriş ekranına döner. Kayıtlı profil korunur, parola unutulur.',
  'Disconnect all': 'Tümünü kes',
  'Disconnect': 'Bağlantıyı kes',
  'Toggle navigation': 'Menüyü aç/kapat',
  'Production': 'Production',
  'This domain runs in production mode: changes here affect live traffic, and WebLogic requires confirmation for many operations.':
    'Bu domain production modunda çalışıyor: buradaki değişiklikler canlı trafiği etkiler ve WebLogic birçok işlem için onay ister.',
  'Search this domain: any page, server, cluster, data source or application — Ctrl-K from anywhere':
    "Bu domain'de arama yapın: herhangi bir sayfa, server, cluster, data source veya uygulama — her yerden Ctrl-K",
  'Search pages and objects': 'Sayfalarda ve nesnelerde ara',
  'How often pages re-fetch data from the AdminServer. Set it to Off on a busy domain and use the Refresh button instead.':
    "Sayfaların AdminServer'dan veriyi hangi sıklıkla yeniden çekeceği. Yoğun bir domain'de Kapalı yapıp bunun yerine Yenile düğmesini kullanın.",
  'Auto-refresh': 'Otomatik yenileme',
  'Off': 'Kapalı',
  'Language': 'Dil',
  'The language this console speaks. WebLogic terms — server, cluster, deployment — are left in English whichever language you pick, because that is what the documentation, WLST and the log files call them.':
    'Konsolun konuştuğu dil. WebLogic terimleri — server, cluster, deployment — hangi dili seçerseniz seçin İngilizce kalır; dokümantasyon, WLST ve log dosyaları onları böyle adlandırır.',
  'Hide help hints': 'Yardım ipuçlarını gizle',
  'Show help hints': 'Yardım ipuçlarını göster',
  'Hide the help panels and the ⓘ hints throughout the console':
    'Konsoldaki yardım panellerini ve ⓘ ipuçlarını gizler',
  'Show help panels and ⓘ hints explaining each page, field and metric':
    'Her sayfayı, alanı ve metriği açıklayan yardım panellerini ve ⓘ ipuçlarını gösterir',
  'Switch to the light theme': 'Açık temaya geç',
  'Switch to the dark theme': 'Koyu temaya geç',
}
