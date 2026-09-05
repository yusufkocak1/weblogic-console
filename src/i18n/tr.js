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

  // ----------------------------------------------------------- shared components 
  'Not connected': 'Bağlı değil',
  'Request failed with status {status}': 'İstek {status} durum koduyla başarısız oldu',
  'Request timed out': 'İstek zaman aşımına uğradı',
  'The console backend is not responding': 'Konsolun arka uç süreci yanıt vermiyor',
  'Something went wrong': 'Bir şeyler ters gitti',
  'Try again': 'Yeniden dene',
  'History is unavailable.': 'Geçmiş verisi alınamıyor.',
  'WebLogic Domain': 'WebLogic Domain',
  'Are you sure?': 'Emin misiniz?',
  'Confirm': 'Onayla',
  'Cancel': 'Vazgeç',
  'Show script': 'Script göster',
  'Show this operation as a WLST script and as the REST call the console makes':
    'Bu işlemi WLST scripti ve konsolun yaptığı REST çağrısı olarak gösterir',
  'Could not switch connection': 'Bağlantı değiştirilemedi',
  'Could not close connection': 'Bağlantı kapatılamadı',
  'The domain every page is showing. Click to switch to another open AdminServer, add one, or manage saved connections.':
    "Bütün sayfaların gösterdiği domain. Başka bir açık AdminServer'a geçmek, yeni bir tane eklemek veya kayıtlı bağlantıları yönetmek için tıklayın.",
  'Connected': 'Bağlı',
  'Close {name}': '{name} bağlantısını kapat',
  'Saved': 'Kayıtlı',
  'Add connection…': 'Bağlantı ekle…',
  'Manage connections…': 'Bağlantıları yönet…',
  'What {label} means': '{label} ne anlama geliyor',
  'How this page works': 'Bu sayfa nasıl çalışır',
  'What is this?': 'Bu nedir?',
  'What this bar measures': 'Bu çubuk neyi ölçüyor',
  '{used}% used — amber from {warn}%, red from {danger}%':
    '%{used} kullanımda — %{warn} sonrası sarı, %{danger} sonrası kırmızı',
  'Back': 'Geri',
  'What the {title} page shows': '{title} sayfası ne gösterir',
  'When this page last received data from the AdminServer': "Bu sayfanın AdminServer'dan en son ne zaman veri aldığı",
  'Updated {time}': 'Güncellendi {time}',
  'Fetch the data on this page again now (auto-refresh is set in the top bar)':
    'Bu sayfadaki veriyi şimdi yeniden çeker (otomatik yenileme üst çubuktan ayarlanır)',
  'Refresh': 'Yenile',
  'Recent history': 'Yakın geçmiş',
  'no history yet': 'henüz geçmiş yok',
  'Dismiss': 'Kapat',
  'Dismiss — failures stay until you close them': 'Kapat — hatalar siz kapatana kadar durur',
  'Connect to {name}': '{name} bağlantısını aç',
  'Password': 'Parola',
  'Connecting…': 'Bağlanıyor…',
  'Connect': 'Bağlan',
  'Now working on {name}.': 'Artık {name} üzerinde çalışıyorsunuz.',
  '{value} — current value': '{value} — şu anki değer',
  'When this change takes effect': 'Bu değişiklik ne zaman etkili olur',
  'Read-only': 'Salt okunur',
  'Edited': 'Değiştirildi',
  'currently {value} on the AdminServer': "AdminServer'da şu an {value}",
  'Equivalent script': 'Eşdeğer script',
  'Copied': 'Kopyalandı',
  'The WLST script is on the clipboard.': 'WLST scripti panoya kopyalandı.',
  'The curl command is on the clipboard.': 'curl komutu panoya kopyalandı.',
  'Could not copy automatically': 'Otomatik kopyalanamadı',
  'Select the text and copy it with Ctrl-C.': 'Metni seçip Ctrl-C ile kopyalayın.',
  'The same operation as a WLST script': 'Aynı işlemin WLST scripti hâli',
  'The REST request the console itself sends': 'Konsolun kendi gönderdiği REST isteği',
  'Copy this to the clipboard': 'Bunu panoya kopyala',
  'Copy': 'Kopyala',
  'Close': 'Kapat',
  'The curl form is exactly what the console sends. The WLST form is a translation — check the MBean paths before running it against a domain that matters, and never leave a real password in a script.':
    'curl hâli konsolun tam olarak gönderdiği şeydir. WLST hâli ise bir çeviridir — önemli bir domain üzerinde çalıştırmadan önce MBean yollarını kontrol edin ve bir scriptin içinde asla gerçek parola bırakmayın.',
  '5s': '5 sn',
  '15s': '15 sn',
  '30s': '30 sn',
  '60s': '60 sn',
  'Compare domains': 'Domain karşılaştırma',
  'Connections': 'Bağlantılar',
  'That page does not exist in this console.': 'Bu konsolda böyle bir sayfa yok.',
  'Back to dashboard': 'Genel Bakış’a dön',

  // ------------------------------------------ tables, staged changes and targets 
  'Filter…': 'Süz…',
  'Filter': 'Süzgeç',
  'Type to keep only the rows containing this text. It matches every column shown here and filters the rows already loaded — it does not query the server.':
    'Yazdıkça yalnızca bu metni içeren satırlar kalır. Burada görünen bütün sütunlarda eşleşme arar ve hâlihazırda yüklenmiş satırları süzer — sunucuya sorgu göndermez.',
  'How the filter box works': 'Süzgeç kutusu nasıl çalışır',
  'Save the rows shown here as a CSV file — the filter and sort you have applied are kept':
    'Burada görünen satırları CSV dosyası olarak kaydeder — uyguladığınız süzgeç ve sıralama korunur',
  'Save the rows shown here as JSON, for a script or a diff':
    'Burada görünen satırları bir script veya karşılaştırma için JSON olarak kaydeder',
  'Rows shown / rows loaded': 'Görünen satır / yüklenen satır',
  'Clear the selection': 'Seçimi temizle',
  'Select every row shown': 'Görünen bütün satırları seç',
  'Select every row the filter is showing': 'Süzgecin gösterdiği bütün satırları seç',
  'Click to sort by {column}': '{column} sütununa göre sıralamak için tıklayın',
  'What the {column} column shows': '{column} sütunu ne gösterir',
  'Loading…': 'Yükleniyor…',
  'No rows match this filter.': 'Bu süzgece uyan satır yok.',
  'Nothing to show.': 'Gösterilecek bir şey yok.',
  'Select {name}': '{name} satırını seç',
  '{owner} is editing this domain right now': "{owner} şu anda bu domain'i düzenliyor",
  'WebLogic allows one editor at a time. You can read every setting on this page, but saving will be refused until they activate or discard their changes.':
    'WebLogic aynı anda tek bir düzenleyiciye izin verir. Bu sayfadaki bütün ayarları okuyabilirsiniz, ancak o kişi değişikliklerini etkinleştirene veya iptal edene kadar kaydetme reddedilir.',
  'Saved, but not live yet': 'Kaydedildi, ancak henüz canlı değil',
  'Why two steps?': 'Neden iki adım?',
  'WebLogic writes your changes into a pending set first. The domain keeps running with its old values until you activate them, so a half-finished set of edits never reaches a live server.':
    "WebLogic değişikliklerinizi önce bekleyen bir kümeye yazar. Siz etkinleştirene kadar domain eski değerleriyle çalışmaya devam eder; böylece yarım kalmış bir düzenleme kümesi hiçbir zaman canlı bir server'a ulaşmaz.",
  'Why changes have to be activated': 'Değişikliklerin neden etkinleştirilmesi gerekir',
  'Throw the pending changes away and release the configuration lock. The domain keeps the values it is running with.':
    'Bekleyen değişiklikleri atar ve yapılandırma kilidini bırakır. Domain çalışmakta olduğu değerleri korur.',
  'Discarding…': 'İptal ediliyor…',
  'Discard': 'İptal et',
  'Apply every pending change to the domain now.': "Bekleyen bütün değişiklikleri domain'e şimdi uygular.",
  'Activating…': 'Etkinleştiriliyor…',
  'Activate changes': 'Değişiklikleri etkinleştir',
  '1 change is waiting.': '1 değişiklik bekliyor.',
  '{count} changes are waiting.': '{count} değişiklik bekliyor.',
  'Changes are waiting.': 'Bekleyen değişiklikler var.',
  'Activate them to apply them to the running domain, or discard them to leave the domain as it is.':
    "Çalışan domain'e uygulamak için etkinleştirin; domain'i olduğu gibi bırakmak için iptal edin.",
  'The configuration on disk changed while these edits were open, so WebLogic will merge them on activation.':
    'Bu düzenlemeler açıkken diskteki yapılandırma değişti; WebLogic etkinleştirme sırasında ikisini birleştirecek.',
  'Hide what is waiting': 'Bekleyenleri gizle',
  'Show what is waiting': 'Bekleyenleri göster',
  'You hold the configuration lock, but nothing is waiting to be activated.':
    'Yapılandırma kilidi sizde, ancak etkinleştirilmeyi bekleyen bir şey yok.',
  'Release the configuration lock so another operator can edit the domain.':
    "Başka bir operatör domain'i düzenleyebilsin diye yapılandırma kilidini bırakır.",
  'Release the lock': 'Kilidi bırak',
  'Nothing is waiting to be activated — every value below is what the domain is running with.':
    "Etkinleştirilmeyi bekleyen bir şey yok — aşağıdaki her değer domain'in çalışmakta olduğu değerdir.",
  'Changes you save are held here first, and only reach the domain when you activate them.':
    "Kaydettiğiniz değişiklikler önce burada tutulur ve domain'e ancak siz etkinleştirdiğinizde ulaşır.",
  'Serving application traffic normally.': 'Uygulama trafiğini normal şekilde karşılıyor.',
  'Deployed and serving requests.': 'Deploy edilmiş ve istekleri karşılıyor.',
  'Deployed and loaded on its targets, but not serving requests yet. Start it to make it active.':
    "Target'larına deploy edilmiş ve yüklenmiş, ancak henüz istek karşılamıyor. Etkin hâle getirmek için başlatın.",
  'The archive has reached its targets but has not been prepared or started there.':
    "Arşiv target'larına ulaştı, ancak orada hazırlanmadı veya başlatılmadı.",
  'Configured in the domain but not distributed to any target yet.':
    "Domain'de tanımlı, ancak henüz hiçbir target'a dağıtılmamış.",
  'A newer version took over. This one still finishes the sessions it already had, so it may show running instances — it is not serving new requests.':
    "Daha yeni bir sürüm devraldı. Bu sürüm elindeki session'ları hâlâ tamamlıyor, bu yüzden çalışan örnekler gösterebilir — yeni istek karşılamıyor.",
  'WebLogic knows no deployment by this name on its targets.':
    "WebLogic, target'larında bu isimde bir deployment tanımıyor.",
  'A deployment change is being applied. The state settles once it finishes.':
    'Bir deployment değişikliği uygulanıyor. İşlem bitince durum oturur.',
  'Started, but only administration requests are accepted — application traffic is refused. Resume to bring it back.':
    'Başlatıldı, ancak yalnızca yönetim istekleri kabul ediliyor — uygulama trafiği reddediliyor. Geri getirmek için sürdürün.',
  'Started and listening on the administration port only. It holds no application work yet.':
    'Başlatıldı ve yalnızca yönetim portunu dinliyor. Henüz uygulama işi tutmuyor.',
  'Booting. It moves to RUNNING on its own if startup succeeds.':
    'Açılıyor. Başlatma başarılı olursa kendiliğinden RUNNING durumuna geçer.',
  'Coming back from ADMIN or STANDBY into RUNNING.': 'ADMIN veya STANDBY durumundan RUNNING durumuna dönüyor.',
  'Finishing in-flight work before moving to ADMIN.': 'ADMIN durumuna geçmeden önce devam eden işleri tamamlıyor.',
  'Moving to ADMIN without waiting for in-flight work to finish.':
    'Devam eden işlerin bitmesini beklemeden ADMIN durumuna geçiyor.',
  'Stopping gracefully. In-flight requests are allowed to complete.':
    'Düzgün şekilde duruyor. Devam eden isteklerin tamamlanmasına izin veriliyor.',
  'Present but not handing out work — a data source in this state refuses connections.':
    'Mevcut, ancak iş dağıtmıyor — bu durumdaki bir data source bağlantı vermez.',
  'Beyond its configured limits and refusing further work.':
    'Tanımlı sınırlarını aşmış durumda ve yeni iş kabul etmiyor.',
  'Stopped. Starting it needs a running Node Manager on its machine.':
    'Durdurulmuş. Başlatmak için makinesinde çalışan bir Node Manager gerekir.',
  'The server started but could not reach a usable state. Check the log for the first error.':
    'Server başladı, ancak kullanılabilir bir duruma ulaşamadı. Loglarda ilk hataya bakın.',
  'Failed and will not restart itself. It has to be started deliberately.':
    'Başarısız oldu ve kendiliğinden yeniden başlamayacak. Elle başlatılması gerekir.',
  'No state was reported when asked — for a server that usually means it is unreachable.':
    'Sorulduğunda bir durum bildirilmedi — bir server için bu genelde erişilemez olduğu anlamına gelir.',
  'Reporting itself healthy.': 'Kendini sağlıklı bildiriyor.',
  'Working, but reporting a problem — worth reading the log.':
    'Çalışıyor, ancak bir sorun bildiriyor — loglara bakmakta fayda var.',
  'A subsystem has failed. Traffic is likely affected.': 'Bir alt sistem çöktü. Trafik büyük ihtimalle etkileniyor.',
  'The component has failed and is not serving.': 'Bileşen çöktü ve hizmet vermiyor.',
  'Refusing work because it is beyond its configured limits.': 'Tanımlı sınırlarını aştığı için iş kabul etmiyor.',
  'No health was reported. Normal for a component that is not running.':
    'Sağlık bilgisi bildirilmedi. Çalışmayan bir bileşen için normaldir.',
  'Cluster — every member serves it': 'Cluster — bütün üyeleri hizmet verir',
  'Adding: {targets}.': 'Eklenen: {targets}.',
  'Removing: {targets}.': 'Çıkarılan: {targets}.',
  'A resource stops being available on a target the moment it is removed there.':
    "Bir kaynak, bir target'tan çıkarıldığı anda orada erişilebilir olmaktan çıkar.",
  'The resource is deployed to the new targets when the change is activated.':
    "Değişiklik etkinleştirildiğinde kaynak yeni target'lara deploy edilir.",
  'With no targets left, this resource is deployed nowhere at all.':
    'Hiç target kalmazsa bu kaynak hiçbir yere deploy edilmemiş olur.',
  'Change where {name} is deployed?': '{name} nereye deploy edildiği değiştirilsin mi?',
  'Targets updated': "Target'lar güncellendi",
  '{name} is now targeted at {targets}.': "{name} artık şu target'lara atanmış durumda: {targets}.",
  'nothing': 'hiçbiri',
  'Could not change the targets': "Target'lar değiştirilemedi",
  'Re-targeting {name}': '{name} için target değişikliği',
  'Targets are replaced as a whole, not added to.': "Target'lar eklenerek değil, topluca değiştirilerek yazılır.",
  'The servers and clusters this resource is deployed to. Targeting a cluster deploys to every member, now and in future — that is nearly always what you want over picking members one by one.':
    'Bu kaynağın deploy edildiği server ve cluster’lar. Bir cluster’ı hedeflemek, şimdiki ve sonradan eklenecek bütün üyelere deploy eder — üyeleri tek tek seçmek yerine neredeyse her zaman istediğiniz budur.',
  'Tick where this should be deployed. The change is staged and activated like any other configuration change.':
    'Nereye deploy edileceğini işaretleyin. Değişiklik, diğer yapılandırma değişiklikleri gibi bekletilir ve etkinleştirilir.',
  'Show this change as a WLST script and as a curl command':
    'Bu değişikliği WLST scripti ve curl komutu olarak gösterir',
  'Reading the servers and clusters in this domain…': "Bu domain'deki server ve cluster'lar okunuyor…",
  'Undo': 'Geri al',

  // ---------------------------------------- command palette, alerts and activity 
  'Page': 'Sayfa',
  'Cluster': 'Cluster',
  'Data source': 'Data source',
  'Application': 'Uygulama',
  'Connection': 'Bağlantı',
  'Setting': 'Ayar',
  'Open this server': "Bu server'ı aç",
  'Open this cluster': "Bu cluster'ı aç",
  'Open this data source': "Bu data source'u aç",
  'Open this application': 'Bu uygulamayı aç',
  'Switch to {name}': '{name} bağlantısına geç',
  '{host}:{port} as {user}': '{host}:{port} — {user}',
  'Remembered in this browser': 'Bu tarayıcıda hatırlanır',
  'The ⓘ icons and the panel at the top of each page': 'ⓘ simgeleri ve her sayfanın üstündeki yardım paneli',
  'Auto-refresh: {interval}': 'Otomatik yenileme: {interval}',
  'How often pages re-fetch from the AdminServer': "Sayfaların AdminServer'dan veriyi hangi sıklıkla yeniden çektiği",
  'Manage connections': 'Bağlantıları yönet',
  'Rename, close and forget saved domains': "Kayıtlı domain'leri yeniden adlandır, kapat ve unut",
  'Domain settings': 'Domain ayarları',
  'Administration port, auditing and the domain log': 'Yönetim portu, denetim kaydı ve domain logu',
  'Go to a page, a server, a data source…': 'Bir sayfaya, server’a, data source’a gidin…',
  'Reading the domain…': 'Domain okunuyor…',
  'Nothing matches that.': 'Buna uyan bir şey yok.',
  '↑↓ to move · Enter to open · Ctrl-K from anywhere': '↑↓ gezinmek · Enter açmak · Ctrl-K her yerden',
  '{count} unread alerts': '{count} okunmamış uyarı',
  'Alerts': 'Uyarılar',
  'Alerts raised by watching this domain: a server leaving RUNNING, a heap or queue past its threshold, a stuck thread. Click to see them and to set the thresholds.':
    'Bu domain izlenirken oluşan uyarılar: RUNNING durumundan çıkan bir server, eşiğini aşan bir heap veya kuyruk, takılmış bir thread. Görmek ve eşikleri ayarlamak için tıklayın.',
  'Raised from the runtime samples the console collects in the background, on whichever page you are on. Each one fires when the condition starts holding and again only once it has cleared, so a long-running problem is one line, not hundreds.':
    'Hangi sayfada olursanız olun, konsolun arka planda topladığı runtime örneklerinden üretilir. Her uyarı, koşul oluştuğunda bir kez ve ancak ortadan kalktığında bir kez daha tetiklenir; böylece uzun süren bir sorun yüzlerce satır değil, tek satır olur.',
  'Show the thresholds these alerts fire at': 'Bu uyarıların tetiklendiği eşikleri gösterir',
  'Hide thresholds': 'Eşikleri gizle',
  'Thresholds': 'Eşikler',
  'Remove every alert from this list. It does not change anything on the domain.':
    'Bu listedeki bütün uyarıları kaldırır. Domain üzerinde hiçbir şeyi değiştirmez.',
  'Server leaves RUNNING': 'Server RUNNING durumundan çıkarsa',
  'Heap above': 'Heap şu değeri aşarsa',
  'Stuck threads at or above': 'Takılmış thread sayısı şuna eşit veya fazlaysa',
  'Queued requests at or above': 'Kuyruktaki istek sayısı şuna eşit veya fazlaysa',
  'Desktop notifications': 'Masaüstü bildirimleri',
  'Also notify when this tab is hidden': 'Bu sekme görünmezken de bildir',
  'Back to the defaults: heap {heap}%, {stuck} stuck thread, {queued} queued requests':
    'Varsayılanlara döner: heap %{heap}, {stuck} takılmış thread, {queued} kuyruktaki istek',
  'Reset to defaults': 'Varsayılanlara dön',
  'Runtime sampling is switched off in the backend (WLC_SAMPLE_MS=0), so nothing is being watched.':
    'Arka uçta runtime örnekleme kapalı (WLC_SAMPLE_MS=0), bu yüzden hiçbir şey izlenmiyor.',
  'Nothing to report. Alerts appear here when something changes — the state the domain was already in when you opened the console is on the Dashboard, not in this list.':
    "Bildirilecek bir şey yok. Uyarılar bir şey değiştiğinde burada belirir — konsolu açtığınızda domain'in zaten içinde olduğu durum bu listede değil, Genel Bakış sayfasındadır.",
  'Configuration': 'Yapılandırma',
  'Server': 'Server',
  'Deployment': 'Deployment',
  'Change lock': 'Değişiklik kilidi',
  'Failed': 'Başarısız',
  'Rolled back': 'Geri alındı',
  'expiring': 'süresi doluyor',
  '{hours}h left': '{hours} sa kaldı',
  '{minutes}m left': '{minutes} dk kaldı',
  '(empty)': '(boş)',
  'On': 'Açık',
  'Roll this change back?': 'Bu değişiklik geri alınsın mı?',
  'The console makes the opposite request against the domain. It is a new change, not an erasure of the old one.':
    "Konsol, domain'e ters yönde bir istek gönderir. Bu, eskisinin silinmesi değil, yeni bir değişikliktir.",
  'Roll back': 'Geri al',
  'Could not roll that back': 'Bu geri alınamadı',
  'Clear the activity log?': 'Etkinlik kaydı temizlensin mi?',
  'The list is emptied and nothing in it can be rolled back afterwards. The domain itself is not touched.':
    "Liste boşaltılır ve içindeki hiçbir şey sonradan geri alınamaz. Domain'in kendisine dokunulmaz.",
  'Clear': 'Temizle',
  'Activity: {count} recent changes': 'Etkinlik: son {count} değişiklik',
  'Activity': 'Etkinlik',
  'What you have changed on this domain recently — settings, server actions, deployments — each with the values before and after, and a Roll back button while the entry lasts.':
    "Bu domain'de son zamanlarda neleri değiştirdiğiniz — ayarlar, server işlemleri, deployment'lar — her biri öncesi ve sonrasındaki değerlerle ve kayıt durduğu sürece bir Geri al düğmesiyle.",
  'Recent changes': 'Son değişiklikler',
  'Every change this console made to the domain — a setting written, a server started or stopped, an application deployed — with the value it held before and the value it holds now. Kept for a short window so a mistake can be undone; it is not an audit trail, and it does not record what other tools or other operators did.':
    "Bu konsolun domain'de yaptığı her değişiklik — yazılan bir ayar, başlatılan veya durdurulan bir server, deploy edilen bir uygulama — önceki ve şimdiki değeriyle birlikte. Bir hata geri alınabilsin diye kısa bir süre tutulur; bir denetim kaydı değildir ve başka araçların ya da başka operatörlerin yaptıklarını kaydetmez.",
  'How long entries are kept before they expire': 'Kayıtların süresi dolmadan önce ne kadar tutulacağı',
  'Hide settings': 'Ayarları gizle',
  'Empty the list. Nothing in it can be rolled back afterwards.':
    'Listeyi boşaltır. İçindeki hiçbir şey sonradan geri alınamaz.',
  'Keep changes for': 'Değişiklikleri şu kadar sakla',
  'An entry disappears when its window runs out, and its rollback goes with it.':
    'Süresi dolan bir kayıt listeden düşer ve geri alma imkânı da onunla birlikte gider.',
  'Make the opposite change on the domain': "Domain'de ters yönde değişikliği yapar",
  'Rolling back…': 'Geri alınıyor…',
  'Nothing changed on this domain in the last {window}. Settings you save, servers you start or stop and applications you deploy appear here, with a way to undo them.':
    "Son {window} içinde bu domain'de hiçbir şey değişmedi. Kaydettiğiniz ayarlar, başlattığınız veya durdurduğunuz server'lar ve deploy ettiğiniz uygulamalar burada, geri alma imkânıyla birlikte görünür.",
  '5 minutes': '5 dakika',
  '15 minutes': '15 dakika',
  '30 minutes': '30 dakika',
  '1 hour': '1 saat',
  '4 hours': '4 saat',
  '12 hours': '12 saat',
  '{count} minutes': '{count} dakika',
  'This change was made on {domain}. Switch to it first.':
    '{domain} üzerinde yapılmış bir değişiklik. Önce o bağlantıya geçin.',
  'another domain': 'başka bir domain',
  'This operation has no rollback.': 'Bu işlemin geri alması yok.',
  'Rolled back — {title}': 'Geri alındı — {title}',
  'The previous values were written back.': 'Önceki değerler geri yazıldı.',
  'A rollback is not itself rolled back. Make the change again if it was wanted after all.':
    'Geri alma işleminin kendisi geri alınmaz. Değişiklik yine de isteniyorsa yeniden yapın.',
  'Desktop notifications are blocked': 'Masaüstü bildirimleri engellendi',
  'The browser refused permission for this site, so alerts will only appear in the console.':
    'Tarayıcı bu site için izin vermedi; uyarılar yalnızca konsol içinde görünecek.',
  '{server} is {state}': '{server} şu durumda: {state}',
  'not running': 'çalışmıyor',
  'The server left the RUNNING state. Check the Servers page and its log.':
    "Server RUNNING durumundan çıktı. Server'lar sayfasına ve loglarına bakın.",
  '{server} is running again': '{server} yeniden çalışıyor',
  'The server is back in the RUNNING state.': 'Server yeniden RUNNING durumunda.',
  '{server} heap at {percent}%': '{server} heap kullanımı %{percent}',
  'Heap in use has passed {threshold}% of the JVM maximum. Sustained, this shows up as slowness long before an OutOfMemoryError.':
    'Kullanımdaki heap, JVM üst sınırının %{threshold} değerini aştı. Bu durum sürerse, OutOfMemoryError alınmadan çok önce yavaşlık olarak kendini gösterir.',
  '{server} heap is back under {threshold}%': '{server} heap kullanımı yeniden %{threshold} altında',
  'Garbage collection recovered the memory.': 'Garbage collection belleği geri kazandı.',
  '{server} has 1 stuck thread': '{server} üzerinde 1 takılmış thread var',
  '{server} has {count} stuck threads': '{server} üzerinde {count} takılmış thread var',
  'Requests are blocked on something outside the server — a database, a remote call or a lock.':
    'İstekler server dışında bir şeyde bloke olmuş durumda — bir veritabanı, uzak bir çağrı veya bir kilit.',
  '{server} has no stuck threads': '{server} üzerinde takılmış thread kalmadı',
  'Whatever the threads were waiting on has cleared.': "Thread'lerin beklediği şey her neyse çözüldü.",
  '{server} has {count} requests queued': '{server} üzerinde {count} istek kuyrukta',
  'More work is arriving than the thread pool is finishing. Look for a slow downstream system first.':
    'Thread pool bitirdiğinden daha çok iş geliyor. Önce yavaş bir alt sistem olup olmadığına bakın.',
  '{server} reports {health}': '{server} şunu bildiriyor: {health}',
  'The server is running but does not consider itself healthy. Its log usually says which subsystem.':
    'Server çalışıyor, ancak kendini sağlıklı görmüyor. Hangi alt sistem olduğunu genelde logları söyler.',
  '{server} reports OK again': '{server} yeniden OK bildiriyor',
  'Health is back to normal.': 'Sağlık durumu normale döndü.',
  'Suspend': 'Askıya al',
  'Shutdown': 'Kapat',
  'Resume': 'Sürdür',
  'Start': 'Başlat',
  'Force shutdown': 'Zorla kapat',
  'Node Manager must be running on the target machine for a server to start.':
    "Bir server'ın başlayabilmesi için hedef makinede Node Manager çalışıyor olmalıdır.",
  'The server stops accepting new work and shuts down gracefully.':
    'Server yeni iş kabul etmeyi bırakır ve düzgün şekilde kapanır.',
  'The server is killed immediately. In-flight work is lost.':
    'Server anında sonlandırılır. Devam eden işler kaybolur.',
  'The server moves to ADMIN state and stops serving application traffic.':
    'Server ADMIN durumuna geçer ve uygulama trafiğini karşılamayı bırakır.',
  'The server returns to RUNNING and resumes serving traffic.':
    'Server RUNNING durumuna döner ve trafiği yeniden karşılamaya başlar.',
  'previous state': 'önceki durum',
  '{count} servers': '{count} server',
  'Failed — {action} {what}': 'Başarısız — {what}: {action}',
  'Nothing to roll back: the operation did not go through.': 'Geri alınacak bir şey yok: işlem gerçekleşmedi.',
  '{action} {what}': '{what}: {action}',
  '{action} requested on {what}.': '{what} üzerinde {action} isteği gönderildi.',
  '{action} is requested on {what}, one server at a time.':
    '{what} üzerinde {action} isteği, her seferinde bir server olacak şekilde gönderilir.',
  'A server that has been through a shutdown does not come back where it was — sessions and in-flight work are gone either way.':
    "Kapatılmış bir server kaldığı yerden geri dönmez — session'lar ve devam eden işler her hâlükârda kaybolur.",
  'This operation has no opposite.': 'Bu işlemin tersi yok.',
  '{action} {server}?': '{server}: {action}?',
  '{action} {server}': '{server}: {action}',
  '{action} requested': '{action} isteği gönderildi',
  '{server} is transitioning — the state updates as it changes.':
    '{server} durum değiştiriyor — durum değiştikçe güncellenir.',
  '{action} failed on {server}': '{server} üzerinde {action} başarısız oldu',
  '{action} 1 server?': '1 server için {action}?',
  '{action} {count} servers?': '{count} server için {action}?',
  'Each one is requested in turn.': 'Her biri sırayla istenir.',
  '{action} requested on 1 server': '1 server için {action} isteği gönderildi',
  '{action} requested on {count} servers': '{count} server için {action} isteği gönderildi',
  'States update as they change.': 'Durumlar değiştikçe güncellenir.',
  '{action} failed on {count}': '{count} tanesinde {action} başarısız oldu',

  // --------------------------------------------- dashboard, servers and clusters 
  'last {minutes} min': 'son {minutes} dk',
  'last {hours} h': 'son {hours} sa',
  'A single screen for the whole domain: the four counters summarise it, and each card below is one configured server. Click a card to open that server, or Domain settings for what applies to the domain as a whole.':
    "Bütün domain tek ekranda: üstteki dört sayaç özeti verir, aşağıdaki her kart tanımlı bir server'dır. Bir server'ı açmak için kartına, domain'in tamamını ilgilendirenler için Domain ayarları'na tıklayın.",
  'Settings that belong to no single server: the administration port, change auditing and the domain-wide log':
    "Tek bir server'a ait olmayan ayarlar: yönetim portu, değişiklik denetimi ve domain geneli log",
  'New here? Start with these three steps': 'Yeni misiniz? Şu üç adımla başlayın',
  'Check the counters: a green Servers running means every configured server is up.':
    "Sayaçlara bakın: yeşil bir Çalışan server sayısı, tanımlı bütün server'ların ayakta olduğu anlamına gelir.",
  'Scan the server cards for a red or amber heap bar, or a state that is not RUNNING.':
    'Server kartlarında kırmızı veya sarı bir heap çubuğu ya da RUNNING dışında bir durum olup olmadığına bakın.',
  'Click a card to open that server — its runtime detail, the buttons to start, suspend or stop it, and every setting it has.':
    "Bir server'ı açmak için kartına tıklayın — runtime detayı, başlatma/askıya alma/durdurma düğmeleri ve bütün ayarları oradadır.",
  'Numbers refresh on the interval set in the top bar. Hover any ⓘ for an explanation; the ⓘ button up there hides all hints once you no longer need them.':
    'Sayılar üst çubukta ayarlanan aralıkta yenilenir. Açıklama için herhangi bir ⓘ üzerine gelin; yukarıdaki ⓘ düğmesi, gerek kalmadığında bütün ipuçlarını gizler.',
  "The line under each heap bar is that server's recent history, collected in the background whether or not this page is open. The bell in the top bar says when a threshold has been crossed, and Ctrl-K jumps straight to any server, application or data source by name.":
    "Her heap çubuğunun altındaki çizgi, o server'ın yakın geçmişidir; bu sayfa açık olsun olmasın arka planda toplanır. Üst çubuktaki zil bir eşiğin aşıldığını söyler, Ctrl-K ise adıyla herhangi bir server, uygulama veya data source'a doğrudan atlar.",
  'Servers running': 'Çalışan server sayısı',
  'Configured servers in this domain': "Bu domain'de tanımlı server'lar",
  'Servers reporting RUNNING out of every server configured in the domain. Amber means some are down, red means none are up. A server only reports runtime data while it is running.':
    "Domain'de tanımlı bütün server'lar içinde RUNNING bildirenler. Sarı bazılarının kapalı, kırmızı hiçbirinin ayakta olmadığı anlamına gelir. Bir server yalnızca çalışırken runtime verisi bildirir.",
  'Configured clusters': "Tanımlı cluster'lar",
  'Groups of servers that share work and replicate sessions. Open the Clusters page to see which members are alive.':
    "İşi paylaşan ve session'ları replike eden server grupları. Hangi üyelerin ayakta olduğunu görmek için Cluster'lar sayfasını açın.",
  'Applications and modules': 'Uygulamalar ve modüller',
  'Applications deployed to this domain (EAR, WAR and similar). Shared libraries are counted separately on the Deployments page.':
    "Bu domain'e deploy edilmiş uygulamalar (EAR, WAR ve benzerleri). Paylaşılan kütüphaneler Deployment'lar sayfasında ayrıca sayılır.",
  'Stuck threads': 'Takılmış threadler',
  'Across all running servers': "Çalışan bütün server'lar genelinde",
  'Request threads that have been busy longer than the configured stuck-thread timeout (600s by default). Anything above zero usually means a slow database call, a remote call without a timeout, or a deadlock — check Monitoring and Logs next.':
    "Tanımlı takılmış-thread zaman aşımından (varsayılan 600 sn) daha uzun süredir meşgul olan istek thread'leri. Sıfırın üzerindeki her değer genelde yavaş bir veritabanı çağrısını, zaman aşımı olmayan bir uzak çağrıyı veya bir deadlock'u işaret eder — sırada İzleme ve Loglar var.",
  'running server is not reporting healthy:': 'çalışan server sağlıklı olduğunu bildirmiyor:',
  'running servers are not reporting healthy:': 'çalışan server sağlıklı olduğunu bildirmiyor:',
  'Loading servers…': "Server'lar yükleniyor…",
  'No servers are configured in this domain.': "Bu domain'de tanımlı server yok.",
  'Java heap in use against the JVM maximum (-Xmx). The bar turns amber past 75% and red past 90%. Brief peaks are normal; a bar that stays red points at a memory problem.':
    "JVM üst sınırına (-Xmx) karşı kullanımdaki Java heap'i. Çubuk %75'i geçince sarıya, %90'ı geçince kırmızıya döner. Kısa tepeler normaldir; sürekli kırmızı kalan bir çubuk bellek sorununu işaret eder.",
  'Heap {used} of {max}': 'Heap {used} / {max}',
  'Heap used, {window}': 'Kullanılan heap, {window}',
  'heap history builds up as the console runs': 'konsol çalıştıkça heap geçmişi birikir',
  'Uptime': 'Çalışma süresi',
  "How long this server's JVM has been running. A value that keeps resetting means the process is restarting.":
    "Bu server'ın JVM'inin ne kadardır çalıştığı. Sürekli sıfırlanan bir değer, sürecin yeniden başladığı anlamına gelir.",
  'Threads': 'Threadler',
  'Total execute threads in the self-tuning pool. WebLogic grows and shrinks this number with load; the split between busy and idle is on the Monitoring page.':
    'Kendi kendini ayarlayan havuzdaki toplam execute thread sayısı. WebLogic bu sayıyı yüke göre büyütüp küçültür; meşgul ve boşta ayrımı İzleme sayfasındadır.',
  'Health': 'Sağlık',
  "The server's self-reported health: OK, WARN, CRITICAL, FAILED or OVERLOADED. A running server can still be unhealthy — that is what this field is for.":
    "Server'ın kendi bildirdiği sağlık durumu: OK, WARN, CRITICAL, FAILED veya OVERLOADED. Çalışan bir server yine de sağlıksız olabilir — bu alan tam olarak bunun içindir.",
  'No runtime data — the server is not running.': 'Runtime verisi yok — server çalışmıyor.',
  'The configured server name, with the WebLogic version it reports underneath while it is running.':
    'Tanımlı server adı; altında, çalışırken bildirdiği WebLogic sürümü.',
  'RUNNING serves traffic; ADMIN accepts only administration requests; STANDBY is started but idle; SHUTDOWN is stopped; FAILED needs attention. The second badge is the health the server reports about itself.':
    "RUNNING trafiği karşılar; ADMIN yalnızca yönetim isteklerini kabul eder; STANDBY başlatılmış ama boştadır; SHUTDOWN durdurulmuştur; FAILED ilgi ister. İkinci rozet, server'ın kendi hakkında bildirdiği sağlık durumudur.",
  'The cluster this server belongs to, or — for a standalone server.':
    "Bu server'ın ait olduğu cluster; bağımsız bir server için —.",
  'Where the server accepts requests. This is also the port used for T3 and for the management REST API.':
    "Server'ın istekleri karşıladığı adres. Bu aynı zamanda T3 ve yönetim REST API'si için kullanılan porttur.",
  'Java heap in use against the JVM maximum (-Xmx). Rising steadily and never dropping after a garbage collection suggests a leak.':
    "JVM üst sınırına (-Xmx) karşı kullanımdaki Java heap'i. Sürekli yükselip garbage collection sonrası hiç düşmemesi sızıntıya işaret eder.",
  'How long the JVM has been up. A short uptime on a server you did not restart means it crashed and was restarted.':
    "JVM'in ne kadardır ayakta olduğu. Yeniden başlatmadığınız bir server'da kısa bir süre, çöküp yeniden başladığı anlamına gelir.",
  'Execute threads in the self-tuning pool, with the stuck count in red when there is one. Stuck threads have been busy longer than the configured timeout.':
    "Kendi kendini ayarlayan havuzdaki execute thread'leri; takılmış olan varsa sayısı kırmızıyla gösterilir. Takılmış threadler, tanımlı zaman aşımından uzun süredir meşguldür.",
  'Lifecycle and runtime state of every configured server': "Tanımlı her server'ın yaşam döngüsü ve runtime durumu",
  "One row per configured server. The buttons on the right offer only the lifecycle operations that are valid for the server's current state, and each one asks for confirmation before it runs.":
    "Tanımlı her server için bir satır. Sağdaki düğmeler yalnızca server'ın mevcut durumu için geçerli olan yaşam döngüsü işlemlerini sunar ve her biri çalışmadan önce onay ister.",
  'How to start, stop or restart a server': 'Bir server nasıl başlatılır, durdurulur veya yeniden başlatılır',
  'Find the row, and read its State badge — the available buttons follow from it.':
    'Satırı bulun ve Durum rozetini okuyun — hangi düğmelerin çıkacağı ona bağlıdır.',
  'Start boots a stopped server, Suspend moves a running one to ADMIN so it finishes current work but takes no new traffic, Resume brings it back, and Shutdown stops it gracefully.':
    "Başlat durmuş bir server'ı açar, Askıya al çalışan birini ADMIN durumuna geçirir (mevcut işini bitirir ama yeni trafik almaz), Sürdür geri getirir, Kapat ise düzgün şekilde durdurur.",
  'Confirm in the dialog. The state column then moves through STARTING or SHUTTING DOWN on its own.':
    'Açılan pencerede onaylayın. Durum sütunu ardından kendiliğinden STARTING veya SHUTTING DOWN aşamalarından geçer.',
  'To restart: Shutdown, wait for SHUTDOWN, then Start. Force shutdown kills the process and loses in-flight work — keep it for a server that will not stop otherwise.':
    'Yeniden başlatmak için: Kapat, SHUTDOWN durumunu bekleyin, sonra Başlat. Zorla kapat süreci öldürür ve devam eden işleri kaybettirir — bunu yalnızca başka türlü durmayan bir server için saklayın.',
  "Starting needs a running Node Manager on that server's machine. If Start fails immediately, that is almost always the reason.":
    "Başlatma, o server'ın makinesinde çalışan bir Node Manager gerektirir. Başlat hemen başarısız oluyorsa sebep neredeyse her zaman budur.",
  'To act on several servers at once — a whole cluster, say — tick them on the left and use the buttons that appear above the table. They are requested one after another, and any that fail are named individually.':
    'Birden çok server üzerinde aynı anda işlem yapmak için — örneğin bütün bir cluster — soldan işaretleyin ve tablonun üstünde beliren düğmeleri kullanın. İstekler arka arkaya gönderilir ve başarısız olanlar tek tek adlarıyla bildirilir.',
  'Filter servers…': "Server'ları süz…",
  'Keeps the rows whose name, state, cluster or listen address contain this text. Useful on a domain with dozens of managed servers.':
    "Adı, durumu, cluster'ı veya listen adresi bu metni içeren satırları bırakır. Onlarca managed server bulunan bir domain'de işe yarar.",
  'Open this server: runtime detail and every setting it has': "Bu server'ı aç: runtime detayı ve bütün ayarları",
  '({count} stuck)': '({count} takılmış)',
  'Starting a stopped server requires a running Node Manager on its machine; the AdminServer itself can only be stopped, not started, from here.':
    "Durmuş bir server'ı başlatmak, makinesinde çalışan bir Node Manager gerektirir; AdminServer'ın kendisi buradan yalnızca durdurulabilir, başlatılamaz.",
  'Listening on': 'Dinlediği adres',
  'all addresses': 'bütün adresler',
  'The address and plain port this server accepts requests on — the same values the settings below change.':
    "Bu server'ın istekleri karşıladığı adres ve SSL'siz port — aşağıdaki ayarların değiştirdiği değerlerin aynısı.",
  'standalone': 'bağımsız',
  'Machine': 'Machine',
  'The machine this server runs on, which is also the Node Manager that can start it.':
    "Bu server'ın üzerinde çalıştığı machine; onu başlatabilecek Node Manager da budur.",
  'How long this JVM has been up. A short uptime you did not cause means the server crashed and was restarted.':
    "Bu JVM'in ne kadardır ayakta olduğu. Sizin yol açmadığınız kısa bir süre, server'ın çöküp yeniden başladığı anlamına gelir.",
  'Java heap in use against the JVM maximum. Change the maximum in the JVM arguments below, then restart.':
    "JVM üst sınırına karşı kullanımdaki Java heap'i. Üst sınırı aşağıdaki JVM argümanlarından değiştirip yeniden başlatın.",
  '{count} stuck': '{count} takılmış',
  'Execute threads in the self-tuning pool. The stuck count follows the stuck-thread settings below.':
    "Kendi kendini ayarlayan havuzdaki execute thread'leri. Takılmış sayısı aşağıdaki takılmış-thread ayarlarına göre belirlenir.",
  'WebLogic': 'WebLogic',
  'Java': 'Java',
  'Runtime state and configuration of this server': "Bu server'ın runtime durumu ve yapılandırması",
  'Everything about one server: what it is doing now, the lifecycle actions available for that state, and the settings that decide how it starts and behaves.':
    'Tek bir server hakkında her şey: şu anda ne yaptığı, o durum için geçerli yaşam döngüsü işlemleri ve nasıl başlayıp nasıl davrandığını belirleyen ayarlar.',
  'This domain has no server called {name}.': "Bu domain'de {name} adında bir server yok.",
  'It may have been renamed or removed — go back to': 'Adı değişmiş veya kaldırılmış olabilir — şuraya dönün:',
  'Not running, so the runtime figures below are unavailable — the settings still are.':
    'Çalışmıyor, bu yüzden aşağıdaki runtime değerleri yok — ayarlar yine de kullanılabilir.',
  'Membership and replication state': 'Üyelik ve replikasyon durumu',
  'One card per configured cluster: who its members are, how many of them are alive, and how much session replication is going on between them.':
    'Tanımlı her cluster için bir kart: üyelerinin kimler olduğu, kaçının ayakta olduğu ve aralarında ne kadar session replikasyonu olduğu.',
  'How to read a cluster card': 'Bir cluster kartı nasıl okunur',
  'Alive is the headline number: members reachable / members configured.':
    'Ayakta en önemli sayıdır: erişilebilen üye / tanımlı üye.',
  'Primaries and Secondaries are replicated HTTP sessions. Sessions have a primary copy on one member and a backup on another, so a member can fail without logging users out.':
    "Birincil ve Yedek, replike edilmiş HTTP session'larıdır. Bir session'ın birincil kopyası bir üyede, yedeği başka bir üyede durur; böylece bir üye çökse de kullanıcılar oturumlarından düşmez.",
  "Resends should stay near zero. A number that keeps climbing means cluster members are losing each other's messages — usually a network or multicast problem.":
    'Yeniden gönderim sıfıra yakın kalmalıdır. Sürekli artan bir sayı, cluster üyelerinin birbirinin mesajlarını kaybettiği anlamına gelir — genelde bir ağ veya multicast sorunudur.',
  'The badges at the bottom are the live state of each member; click through to Servers to act on one.':
    "Alttaki rozetler her üyenin anlık durumudur; biri üzerinde işlem yapmak için Server'lar sayfasına geçin.",
  'There is no domain-wide cluster runtime in WebLogic: each member reports its own view, and these figures are that view combined.':
    "WebLogic'te domain geneli bir cluster runtime'ı yoktur: her üye kendi gördüğünü bildirir ve buradaki değerler bu görüşlerin birleşimidir.",
  'No clusters are configured in this domain.': "Bu domain'de tanımlı cluster yok.",
  'Open this cluster: replication detail and every setting it has':
    "Bu cluster'ı aç: replikasyon detayı ve bütün ayarları",
  'How members find and talk to each other: unicast (direct TCP, the usual choice) or multicast (UDP group, needs multicast enabled on the network).':
    'Üyelerin birbirini nasıl bulup konuştuğu: unicast (doğrudan TCP, alışılmış seçim) veya multicast (UDP grubu, ağda multicast açık olmalıdır).',
  'Alive': 'Ayakta',
  'Members currently reachable, out of the members configured for this cluster. Anything below the total means a member is down or cannot be reached.':
    'Bu cluster için tanımlı üyeler içinde şu anda erişilebilenler. Toplamın altındaki her değer bir üyenin kapalı veya erişilemez olduğunu gösterir.',
  'Primaries': 'Birincil',
  'HTTP sessions whose primary copy lives on a member of this cluster. Roughly, the sessions this cluster is actively serving.':
    "Birincil kopyası bu cluster'ın bir üyesinde duran HTTP session'ları. Kabaca, bu cluster'ın etkin olarak hizmet verdiği session'lar.",
  'Secondaries': 'Yedek',
  'Backup copies of sessions held for other members. Zero across a multi-member cluster means session replication is not working.':
    "Diğer üyeler için tutulan session yedek kopyaları. Çok üyeli bir cluster'da sıfır olması, session replikasyonunun çalışmadığı anlamına gelir.",
  'Resends': 'Yeniden gönderim',
  'Cluster messages that had to be sent again. It should stay at or near zero; a rising count points at a congested or lossy network.':
    'Yeniden gönderilmek zorunda kalınan cluster mesajları. Sıfırda veya sıfıra yakın kalmalıdır; artan bir sayı tıkalı ya da paket kaybeden bir ağı işaret eder.',
  '{member} — current state of this cluster member. Click to open it and change its settings.':
    '{member} — bu cluster üyesinin mevcut durumu. Açıp ayarlarını değiştirmek için tıklayın.',
  'Members that can currently see each other, against the number configured.':
    'Tanımlı üye sayısına karşılık şu anda birbirini görebilen üyeler.',
  'Messaging': 'Mesajlaşma',
  'Address': 'Adres',
  'Primary sessions': "Birincil session'lar",
  'Replicated HTTP sessions whose main copy lives on a member of this cluster.':
    "Ana kopyası bu cluster'ın bir üyesinde duran, replike edilmiş HTTP session'ları.",
  'Secondary sessions': "Yedek session'lar",
  'Backup copies held for other members, so a member can fail without logging users out.':
    'Diğer üyeler için tutulan yedek kopyalar; böylece bir üye çökse de kullanıcılar oturumlarından düşmez.',
  'Cluster messages that had to be sent again. A number that keeps climbing means members are losing each other’s messages — usually a network problem.':
    'Yeniden gönderilmek zorunda kalınan cluster mesajları. Sürekli artan bir sayı, üyelerin birbirinin mesajlarını kaybettiği anlamına gelir — genelde bir ağ sorunudur.',
  'Cluster membership, replication and settings': 'Cluster üyeliği, replikasyon ve ayarlar',
  'One cluster: how many members are alive, how much session replication is going on, and the settings that decide how members find each other.':
    'Tek bir cluster: kaç üyenin ayakta olduğu, ne kadar session replikasyonu yapıldığı ve üyelerin birbirini nasıl bulacağını belirleyen ayarlar.',
  'This domain has no cluster called {name}.': "Bu domain'de {name} adında bir cluster yok.",
  'Go back to': 'Şuraya dönün:',
  'for the current list.': '— güncel liste orada.',
  'Members — click one to configure it': 'Üyeler — yapılandırmak için birine tıklayın',
  "Membership belongs to each server rather than to the cluster, so it is changed on a server's own page. These settings decide how the members talk to each other and how they are addressed from outside.":
    "Üyelik cluster'a değil her server'a ait olduğundan, server'ın kendi sayfasından değiştirilir. Buradaki ayarlar üyelerin birbiriyle nasıl konuşacağını ve dışarıdan nasıl adreslendiğini belirler.",
  'Mode': 'Mod',
  'Development': 'Development',
  'Production mode requires the configuration lock for every change and turns off auto-deployment. Changing it needs every server in the domain restarted.':
    "Production modu her değişiklik için yapılandırma kilidini zorunlu kılar ve otomatik deployment'ı kapatır. Bunu değiştirmek, domain'deki bütün server'ların yeniden başlatılmasını gerektirir.",
  'AdminServer': 'AdminServer',
  'Configuration version': 'Yapılandırma sürümü',
  'The WebLogic version this domain’s configuration was written for.':
    "Bu domain'in yapılandırmasının yazıldığı WebLogic sürümü.",
  'Domain directory': 'Domain dizini',
  'Connected as': 'Bağlanan kullanıcı',
  'Settings that apply to the whole domain': "Bütün domain'i ilgilendiren ayarlar",
  'The domain-wide switches: the administration port, change auditing, and the combined domain log that every server broadcasts into.':
    "Domain geneli anahtarlar: yönetim portu, değişiklik denetimi ve bütün server'ların yazdığı birleşik domain logu.",

  // ----------------------------------------- login, connections and data sources 
  'Add another AdminServer': 'Başka bir AdminServer ekle',
  'Connect to an AdminServer': "Bir AdminServer'a bağlan",
  'active': 'etkin',
  'open': 'açık',
  'connect': 'bağlan',
  'New connection…': 'Yeni bağlantı…',
  'What to enter here': 'Buraya ne yazılır',
  'Connect with the AdminServer of the domain, not a managed server. Everything in this console goes through it.':
    "Domain'in managed server'ına değil, AdminServer'ına bağlanın. Bu konsoldaki her şey onun üzerinden geçer.",
  "Host and port are the AdminServer's admin listen address, usually port 7001 (7002 with SSL). Already have a t3://host:port address from a WLST script? Paste it into the host box and it splits itself into the fields.":
    "Sunucu ve port, AdminServer'ın yönetim listen adresidir; genelde 7001 (SSL ile 7002). Bir WLST scriptinden gelen t3://sunucu:port adresiniz mi var? Sunucu kutusuna yapıştırın, kendiliğinden alanlara ayrılır.",
  'Username needs a role that can read the management API — Monitor is enough to look around, Operator or Admin to start and stop things.':
    "Kullanıcı adının yönetim API'sini okuyabilen bir role sahip olması gerekir — etrafa bakmak için Monitor yeter, bir şeyleri başlatıp durdurmak için Operator veya Admin gerekir.",
  'Save this connection keeps the host, port and username on this machine for next time. The password is never stored.':
    'Bu bağlantıyı kaydet seçeneği; sunucu, port ve kullanıcı adını bir sonraki sefer için bu makinede tutar. Parola asla saklanmaz.',
  'If connecting fails, check that the AdminServer is up on that port and that the REST management interface is enabled for the domain.':
    "Bağlantı başarısız olursa, AdminServer'ın o portta ayakta olduğunu ve domain için REST yönetim arayüzünün açık olduğunu kontrol edin.",
  'Host or IP': 'Sunucu veya IP',
  'Where the AdminServer listens. A hostname, an IPv4 or IPv6 address, or a whole t3:// URL pasted from a WLST script — a URL is split into host, port and SSL automatically.':
    "AdminServer'ın dinlediği yer. Bir sunucu adı, IPv4 veya IPv6 adresi ya da bir WLST scriptinden yapıştırılmış tam bir t3:// adresi — adres otomatik olarak sunucu, port ve SSL alanlarına ayrılır.",
  '10.0.0.12 or t3://10.0.0.12:7001': '10.0.0.12 veya t3://10.0.0.12:7001',
  'Port': 'Port',
  "The AdminServer's admin port: 7001 by default, or 7002 when the SSL port is used. T3 and HTTP share the same port, so a t3:// address gives you the right number.":
    "AdminServer'ın yönetim portu: varsayılan 7001, SSL portu kullanılıyorsa 7002. T3 ve HTTP aynı portu paylaşır, bu yüzden bir t3:// adresi size doğru numarayı verir.",
  'Username': 'Kullanıcı adı',
  'A WebLogic account, not an operating-system one. It needs a role with access to the management API: Monitor to view, Operator or Admin to start and stop servers and applications.':
    "İşletim sistemi hesabı değil, bir WebLogic hesabı. Yönetim API'sine erişebilen bir rol gerekir: görüntülemek için Monitor, server ve uygulamaları başlatıp durdurmak için Operator veya Admin.",
  'Held by the local console process for this session only, so it can talk to the AdminServer for you. It is never written to disk and never saved with a profile.':
    'Yalnızca bu oturum boyunca yerel konsol sürecinde tutulur; sizin adınıza AdminServer ile konuşabilsin diye. Diske hiç yazılmaz ve profille birlikte hiç kaydedilmez.',
  'Hide': 'Gizle',
  'Show': 'Göster',
  'Name': 'Ad',
  '(optional)': '(isteğe bağlı)',
  'A label for this connection, so several open domains are easy to tell apart in the switcher. Defaults to the domain name reported by the AdminServer.':
    "Bu bağlantı için bir etiket; böylece açık birden çok domain'i seçicide kolayca ayırt edersiniz. Varsayılan olarak AdminServer'ın bildirdiği domain adı kullanılır.",
  'Production · Ankara': 'Production · Ankara',
  'Use SSL (https)': 'SSL kullan (https)',
  'Use SSL': 'SSL kullan',
  'Talk to the admin port over https instead of http. Turn it on only if the domain has its SSL listen port enabled — usually 7002. The address preview below shows the URL that will be called.':
    "Yönetim portuyla http yerine https üzerinden konuşur. Yalnızca domain'in SSL listen portu açıksa — genelde 7002 — işaretleyin. Aşağıdaki adres önizlemesi çağrılacak URL'yi gösterir.",
  'Accept self-signed or otherwise untrusted certificates':
    'Kendinden imzalı veya başka şekilde güvenilmeyen sertifikaları kabul eder',
  'Trust self-signed certificate': 'Kendinden imzalı sertifikaya güven',
  'Save this connection': 'Bu bağlantıyı kaydet',
  'Stores the host, port, username and name on this machine so the domain is one click away next time. The password is never included — you enter it once per console restart.':
    'Sunucu, port, kullanıcı adı ve adı bu makinede saklar; böylece domain bir sonraki sefer tek tıkla açılır. Parola hiçbir zaman dâhil edilmez — her konsol açılışında bir kez girersiniz.',
  'The management API URL these fields build. This is exactly what the console will call.':
    'Bu alanların oluşturduğu yönetim API adresi. Konsolun çağıracağı şey tam olarak budur.',
  'Paste a t3:// address and it is split into these fields — T3 and HTTP share the admin port.':
    'Bir t3:// adresi yapıştırın, bu alanlara ayrılsın — T3 ve HTTP yönetim portunu paylaşır.',
  'Saved connections keep the host, port and username — never the password. Credentials are held by the local console process for this session only.':
    'Kayıtlı bağlantılar sunucu, port ve kullanıcı adını tutar — parolayı asla. Kimlik bilgileri yalnızca bu oturum boyunca yerel konsol sürecinde tutulur.',
  'Switched': 'Geçildi',
  'Close {name}?': '{name} kapatılsın mı?',
  'The connection is dropped and its password is forgotten. The saved profile stays.':
    'Bağlantı kesilir ve parolası unutulur. Kayıtlı profil kalır.',
  'Close connection': 'Bağlantıyı kapat',
  'Could not rename': 'Yeniden adlandırılamadı',
  'Forget {name}?': '{name} unutulsun mu?',
  'The connection is left open, but the saved profile is removed — you will have to enter the host and port again next time.':
    'Bağlantı açık kalır, ancak kayıtlı profil silinir — bir sonraki sefer sunucu ve portu yeniden girmeniz gerekir.',
  'The saved profile is removed. Nothing on the server is affected.':
    'Kayıtlı profil silinir. Sunucu tarafında hiçbir şey etkilenmez.',
  'Forget profile': 'Profili unut',
  'Could not remove the profile': 'Profil silinemedi',
  'Saved domains and the ones currently open': "Kayıtlı domain'ler ve şu anda açık olanlar",
  'Every AdminServer you have saved or opened. Several can be connected at once; the one marked Active is the domain every other page is showing.':
    "Kaydettiğiniz veya açtığınız bütün AdminServer'lar. Aynı anda birkaçına bağlanılabilir; Etkin olarak işaretli olan, diğer bütün sayfaların gösterdiği domain'dir.",
  'Open the connect form to add another AdminServer, keeping the ones already open':
    'Zaten açık olanları koruyarak başka bir AdminServer eklemek için bağlantı formunu açar',
  'Add connection': 'Bağlantı ekle',
  'What the buttons on each row do': 'Her satırdaki düğmeler ne yapar',
  'Connect opens a saved profile. It asks for the password, because passwords are never stored.':
    'Bağlan kayıtlı bir profili açar. Parolalar hiç saklanmadığı için parolayı sorar.',
  'Switch to makes an already-open connection the active one — every page then shows that domain. The connections you switch away from stay open.':
    "Geç, zaten açık olan bir bağlantıyı etkin hâle getirir — bütün sayfalar bundan sonra o domain'i gösterir. Ayrıldığınız bağlantılar açık kalır.",
  'Close drops the live connection and forgets its password. The saved profile stays, so you can connect again later.':
    'Kapat, canlı bağlantıyı keser ve parolasını unutur. Kayıtlı profil kalır, böylece sonra yeniden bağlanabilirsiniz.',
  'Forget deletes the saved profile from this machine. Nothing on the server changes.':
    'Unut, kayıtlı profili bu makineden siler. Sunucu tarafında hiçbir şey değişmez.',
  'rename next to the name gives a connection a label of your own, such as Prod · Ankara.':
    'Adın yanındaki yeniden adlandır, bağlantıya Prod · Ankara gibi kendi seçtiğiniz bir etiketi verir.',
  'The dot on the left is green for active, grey for open but not active, and hollow for not connected.':
    'Soldaki nokta etkin için yeşil, açık ama etkin olmayan için gri, bağlı olmayan için içi boştur.',
  'No saved connections yet.': 'Henüz kayıtlı bağlantı yok.',
  'Active': 'Etkin',
  'not saved': 'kaydedilmedi',
  'Give this connection a name of your own, such as Prod · Ankara':
    'Bu bağlantıya Prod · Ankara gibi kendi seçtiğiniz bir ad verin',
  'rename': 'yeniden adlandır',
  'Last used {when}': 'Son kullanım {when}',
  'Make this the active domain — every page switches to it. Other connections stay open.':
    'Bunu etkin domain yapar — bütün sayfalar buna geçer. Diğer bağlantılar açık kalır.',
  'Switch to': 'Buna geç',
  'Open this saved profile — you will be asked for the password': 'Bu kayıtlı profili açar — parola sorulacaktır',
  'Drop this connection and forget its password. The saved profile is kept.':
    'Bu bağlantıyı keser ve parolasını unutur. Kayıtlı profil korunur.',
  'Delete this saved profile from this machine. Nothing on the server is affected.':
    'Bu kayıtlı profili bu makineden siler. Sunucu tarafında hiçbir şey etkilenmez.',
  'Forget': 'Unut',
  'Profiles are stored on this machine without passwords, so each one needs its password entered once per console restart. Connections stay open until you close them or the console process stops.':
    'Profiller bu makinede parolasız saklanır; bu yüzden her konsol açılışında her biri için parola bir kez girilmelidir. Bağlantılar siz kapatana veya konsol süreci durana kadar açık kalır.',
  'The data source name, with its JDBC URL underneath. Applications look it up by JNDI name, not by this one.':
    'Data source adı; altında JDBC adresi. Uygulamalar onu bu adla değil, JNDI adıyla bulur.',
  'State': 'Durum',
  'Running means the pool is up on at least one server. Suspended or Overloaded means the pool exists but is not usable. Not deployed means no target server is running it.':
    "Running, havuzun en az bir server'da ayakta olduğu anlamına gelir. Suspended veya Overloaded, havuzun var olduğunu ama kullanılamadığını gösterir. Deploy edilmemiş ise hiçbir target server'ın onu çalıştırmadığı anlamına gelir.",
  'Connections currently checked out by application code, summed over every server. Sitting at the pool maximum means requests are queueing for a connection.':
    "Uygulama kodunun şu anda kullandığı bağlantılar, bütün server'lar toplanarak. Havuz üst sınırında sabit kalması, isteklerin bağlantı için kuyrukta beklediği anlamına gelir.",
  'Connections the pool holds right now, with the configured initial – maximum capacity in brackets. WebLogic grows the pool towards the maximum under load.':
    'Havuzun şu anda tuttuğu bağlantılar; parantez içinde tanımlı başlangıç – üst sınır kapasitesi. WebLogic yük altında havuzu üst sınıra doğru büyütür.',
  'Threads blocked waiting for a free connection. Anything above zero means the pool is too small or queries are too slow.':
    "Boş bağlantı bekleyen bloke thread'ler. Sıfırın üzerindeki her değer havuzun küçük ya da sorguların yavaş olduğunu gösterir.",
  'The servers and clusters this data source is deployed to. A data source only has runtime numbers where it is targeted.':
    "Bu data source'un deploy edildiği server ve cluster'lar. Bir data source yalnızca hedeflendiği yerde runtime değerlerine sahiptir.",
  'JDBC configuration and live pool statistics': 'JDBC yapılandırması ve anlık havuz istatistikleri',
  'Every JDBC data source in the domain with its live connection pool numbers. Counts are summed across all servers the data source is targeted to.':
    "Domain'deki her JDBC data source ve anlık bağlantı havuzu değerleri. Sayılar, data source'un hedeflendiği bütün server'lar toplanarak verilir.",
  'How to check whether a database connection is healthy':
    'Bir veritabanı bağlantısının sağlıklı olup olmadığı nasıl kontrol edilir',
  'Press Test on the row. It borrows a real connection from the pool on one running server and runs the configured test query, so a pass proves the database is genuinely reachable with these credentials.':
    "Satırdaki Test düğmesine basın. Çalışan bir server'daki havuzdan gerçek bir bağlantı alır ve tanımlı test sorgusunu çalıştırır; böylece başarılı bir sonuç, veritabanına bu kimlik bilgileriyle gerçekten erişilebildiğini kanıtlar.",
  'A failure toast carries the JDBC error itself — ORA-01017 is a wrong password, ORA-12541 or a connection refused is a listener or firewall problem.':
    'Hata bildirimi JDBC hatasının kendisini taşır — ORA-01017 yanlış parola, ORA-12541 veya reddedilen bağlantı ise listener ya da güvenlik duvarı sorunudur.',
  'If Waiting is above zero, or Active is stuck at the maximum in brackets, the pool is the bottleneck rather than the database.':
    'Bekleyen sıfırın üzerindeyse ya da Etkin parantezdeki üst sınırda takılı kalıyorsa, darboğaz veritabanı değil havuzdur.',
  'Test needs at least one target server running — a data source with no runtime instance cannot be tested.':
    "Test için en az bir target server'ın çalışıyor olması gerekir — runtime örneği olmayan bir data source test edilemez.",
  'No JDBC data sources are configured.': 'Tanımlı JDBC data source yok.',
  'Filter data sources…': "Data source'ları süz…",
  'Matches the data source name, state and targets of the rows already loaded.':
    "Yüklenmiş satırların data source adı, durumu ve target'larıyla eşleşir.",
  'Open this data source: live pool figures and every setting it has':
    "Bu data source'u aç: anlık havuz değerleri ve bütün ayarları",
  'Not deployed': 'Deploy edilmemiş',
  'Configured initial – maximum capacity of this pool': 'Bu havuzun tanımlı başlangıç – üst sınır kapasitesi',
  'Test': 'Test',
  'Active connections': 'Etkin bağlantılar',
  'Connections checked out by application code right now, added up over every server. Sitting at the maximum means requests are queueing.':
    "Uygulama kodunun şu anda kullandığı bağlantılar, bütün server'lar toplanarak. Üst sınırda sabit kalması, isteklerin kuyrukta beklediği anlamına gelir.",
  'Connections the pool holds at the moment. It grows towards the configured maximum under load.':
    'Havuzun şu an tuttuğu bağlantılar. Yük altında tanımlı üst sınıra doğru büyür.',
  'Waiting': 'Bekleyen',
  'Threads blocked waiting for a free connection. Anything above zero means the pool is too small or the queries are too slow.':
    "Boş bağlantı bekleyen bloke thread'ler. Sıfırın üzerindeki her değer havuzun küçük ya da sorguların yavaş olduğunu gösterir.",
  'Reconnect failures': 'Yeniden bağlanma hataları',
  'Times the pool could not replace a connection. A climbing number points at the database or the network, not at these settings.':
    'Havuzun bir bağlantıyı yenileyemediği durum sayısı. Artan bir değer bu ayarları değil, veritabanını ya da ağı işaret eder.',
  'Running on': 'Çalıştığı yer',
  'nowhere': 'hiçbir yerde',
  'JNDI names': 'JNDI adları',
  'URL': 'Adres',
  'Nothing to test': 'Test edilecek bir şey yok',
  '{name} has no running instance — start a target server first.':
    '{name} için çalışan bir örnek yok — önce bir target server başlatın.',
  'Connection test passed': 'Bağlantı testi başarılı',
  '{name} on {server}': '{server} üzerinde {name}',
  'Connection test failed for {name}': '{name} için bağlantı testi başarısız oldu',
  'Connection pool statistics and settings': 'Bağlantı havuzu istatistikleri ve ayarları',
  'One data source: what its pool is doing right now, and the settings that decide its size, its connection test and where it connects.':
    'Tek bir data source: havuzunun şu anda ne yaptığı ve boyutunu, bağlantı testini ve nereye bağlandığını belirleyen ayarlar.',
  'Borrow a connection from this pool and run its test query against the database. Read-only and safe to press at any time.':
    'Bu havuzdan bir bağlantı alıp test sorgusunu veritabanında çalıştırır. Salt okunurdur, her an güvenle basılabilir.',
  'Testing…': 'Test ediliyor…',
  'Test connection': 'Bağlantıyı test et',
  'This domain has no data source called {name}.': "Bu domain'de {name} adında bir data source yok.",
  'Not deployed on any running server, so there are no live figures — the settings still apply.':
    "Çalışan hiçbir server'a deploy edilmemiş, bu yüzden anlık değer yok — ayarlar yine de geçerlidir.",
  'Where this data source is deployed. Adding a target creates its pool there when the change is activated; removing one takes the pool away, so anything using that JNDI name on that server stops working.':
    "Bu data source'un deploy edildiği yer. Bir target eklemek, değişiklik etkinleştirildiğinde orada havuzunu oluşturur; bir target'ı çıkarmak havuzu kaldırır, böylece o server'da o JNDI adını kullanan her şey çalışmayı bırakır.",
  'Pool sizes count per server: a maximum of 20 on a data source targeted to three servers means up to 60 sessions on the database.':
    "Havuz boyutları server başına sayılır: üç server'a hedeflenmiş bir data source'ta 20 üst sınırı, veritabanında 60 oturuma kadar çıkabilir demektir.",

  // ----------------------------------------------------------------- deployments 
  'Domain default': 'Domain varsayılanı',
  'stage — copy the archive to each server': "stage — arşivi her server'a kopyala",
  'nostage — every server reads the same path': 'nostage — bütün serverlar aynı yolu okur',
  'external_stage — you copy it yourself': 'external_stage — kopyalamayı siz yaparsınız',
  'Redeploy {name}': '{name} yeniden deploy et',
  'Deploy an application': 'Bir uygulama deploy et',
  'Member of {cluster}': '{cluster} üyesi',
  'Standalone server': 'Bağımsız server',
  'Could not read the targets available': "Kullanılabilir target'lar okunamadı",
  'Taking the configuration lock…': 'Yapılandırma kilidi alınıyor…',
  '{owner} holds the configuration lock. Ask them to activate or release it first.':
    'Yapılandırma kilidi {owner} kullanıcısında. Önce etkinleştirmesini veya bırakmasını isteyin.',
  'Uploading {file} ({size})…': '{file} yükleniyor ({size})…',
  'Activating the change…': 'Değişiklik etkinleştiriliyor…',
  'Redeployed {name}': '{name} yeniden deploy edildi',
  'Deployed {name}': '{name} deploy edildi',
  '{file} ({size}) to {targets}.': '{file} ({size}) → {targets}.',
  '{file} ({size}).': '{file} ({size}).',
  'the previous archive': 'önceki arşiv',
  '(not deployed)': '(deploy edilmemiş)',
  'A redeploy cannot be rolled back from here: the console does not keep the archive it replaced. Deploy the previous file again to go back.':
    'Yeniden deploy buradan geri alınamaz: konsol, yerine geçtiği arşivi saklamaz. Geri dönmek için önceki dosyayı yeniden deploy edin.',
  'A deployment is undone by undeploying the application, which is done from its own page.':
    'Bir deployment, uygulamanın kendi sayfasından undeploy edilerek geri alınır.',
  'Redeployed': 'Yeniden deploy edildi',
  'Deployed': 'Deploy edildi',
  '{name} is installed. It can take a moment to reach ACTIVE on every target.':
    "{name} kuruldu. Bütün target'larda ACTIVE duruma gelmesi biraz sürebilir.",
  'Redeploy failed': 'Yeniden deploy başarısız oldu',
  'Deployment failed': 'Deployment başarısız oldu',
  'the change was not activated, so the domain is unchanged.':
    'değişiklik etkinleştirilmedi, dolayısıyla domain olduğu gibi kaldı.',
  '<application>': '<uygulama>',
  'Deployment uploads the archive; WLST reads it from a path the AdminServer can see.':
    "Deployment arşivi yükler; WLST ise onu AdminServer'ın görebildiği bir yoldan okur.",
  'The archive is uploaded through this console to the AdminServer and activated as a configuration change. Nothing is written to the domain until the upload has succeeded.':
    "Arşiv bu konsol üzerinden AdminServer'a yüklenir ve bir yapılandırma değişikliği olarak etkinleştirilir. Yükleme başarılı olmadan domain'e hiçbir şey yazılmaz.",
  'Archive': 'Arşiv',
  "The WAR, EAR, JAR or RAR to install. It travels from this browser through the local console process to the AdminServer, so it does not need to exist on the AdminServer's own disk.":
    "Kurulacak WAR, EAR, JAR veya RAR dosyası. Bu tarayıcıdan yerel konsol süreci üzerinden AdminServer'a gider; dolayısıyla AdminServer'ın kendi diskinde bulunması gerekmez.",
  'Deployment name': 'Deployment adı',
  'What the application is called in the domain — the name on the Deployments page, not the file name. Redeploying keeps the existing name.':
    "Uygulamanın domain'deki adı — dosya adı değil, Deployment'lar sayfasındaki ad. Yeniden deploy mevcut adı korur.",
  'myapp': 'uygulamam',
  'Staging': 'Staging',
  'stage copies the archive to each target server, which is the safe default. nostage leaves it on a path every server must be able to read. external_stage means you place it there yourself.':
    "stage, arşivi her target server'a kopyalar; güvenli varsayılan budur. nostage, arşivi bütün server'ların okuyabilmesi gereken bir yolda bırakır. external_stage ise dosyayı oraya sizin koyduğunuz anlamına gelir.",
  'Targets': "Target'lar",
  'Where the application will run. Targeting a cluster deploys it to every member, including members added later.':
    "Uygulamanın çalışacağı yer. Bir cluster'ı hedeflemek, sonradan eklenecek üyeler dâhil bütün üyelere deploy eder.",
  'Deployment plan (optional)': 'Deployment planı (isteğe bağlı)',
  'A plan.xml overriding descriptor values for this environment. Leave it empty unless you already use one.':
    'Bu ortam için descriptor değerlerini ezen bir plan.xml. Zaten kullanmıyorsanız boş bırakın.',
  'Working…': 'Çalışıyor…',
  'Redeploy': 'Yeniden deploy et',
  'Deploy': 'Deploy et',
  'Type': 'Tür',
  'Stop': 'Durdur',
  'on {targets}': '{targets} üzerinde',
  'Failed — {action} {app}': 'Başarısız — {app}: {action}',
  'Nothing to roll back: the request did not go through.': 'Geri alınacak bir şey yok: istek gerçekleşmedi.',
  '{action} {app}': '{app}: {action}',
  'Put back into service on {targets}.': '{targets} üzerinde yeniden hizmete alındı.',
  'its targets': "kendi target'ları",
  'No longer served on {targets}.': '{targets} üzerinde artık hizmet vermiyor.',
  'Started again.': 'Yeniden başlatıldı.',
  'Stopped again.': 'Yeniden durduruldu.',
  '{action} {app}?': '{app}: {action}?',
  'The application will be served on: {targets}.': 'Uygulama şurada hizmet verecek: {targets}.',
  'Clients will stop being served by this application on all its targets.':
    "İstemciler bu uygulamadan bütün target'larında hizmet almayı bırakacak.",
  '{app} — state refreshes shortly.': '{app} — durum birazdan yenilenir.',
  '{action} failed for {app}': '{app} için {action} başarısız oldu',
  'Undeploy {app}?': '{app} undeploy edilsin mi?',
  'The application is removed from the domain configuration and stops being served on {targets}. Putting it back means deploying the archive again.':
    'Uygulama domain yapılandırmasından kaldırılır ve {targets} üzerinde hizmet vermeyi bırakır. Geri getirmek, arşivi yeniden deploy etmek demektir.',
  'Undeploy': 'Undeploy et',
  'Undeploy {app}': '{app} undeploy',
  '{owner} holds the configuration lock.': 'Yapılandırma kilidi {owner} kullanıcısında.',
  'Undeployed {app}': '{app} undeploy edildi',
  'Removed from the domain configuration and from {targets}.':
    'Domain yapılandırmasından ve {targets} üzerinden kaldırıldı.',
  'deployed': 'deploy edilmiş',
  '(removed)': '(kaldırıldı)',
  'An undeploy cannot be rolled back from here: the domain no longer holds the archive, so putting the application back means deploying the file again.':
    'Undeploy buradan geri alınamaz: domain artık arşivi tutmuyor, dolayısıyla uygulamayı geri getirmek dosyayı yeniden deploy etmek demektir.',
  'Undeployed': 'Undeploy edildi',
  '{app} has been removed from the domain.': "{app} domain'den kaldırıldı.",
  'Failed — undeploy {app}': 'Başarısız — {app} undeploy',
  'The edit was discarded, so the application should still be deployed.':
    'Düzenleme iptal edildi, dolayısıyla uygulama hâlâ deploy edilmiş olmalı.',
  'Could not undeploy {app}': '{app} undeploy edilemedi',
  'Put this application back into service on all of its targets':
    "Bu uygulamayı bütün target'larında yeniden hizmete alır",
  'Take this application out of service on all of its targets — clients stop being served immediately':
    "Bu uygulamayı bütün target'larında hizmet dışına alır — istemciler anında hizmet almayı bırakır",
  'Remove this application from the domain configuration entirely':
    'Bu uygulamayı domain yapılandırmasından tamamen kaldırır',
  'war for a web application, ear for an enterprise application, jar for an EJB module.':
    'Web uygulaması için war, kurumsal uygulama için ear, EJB modülü için jar.',
  'The servers and clusters this application is deployed to. Start and Stop act on all of them.':
    "Bu uygulamanın deploy edildiği server ve cluster'lar. Başlat ve Durdur hepsi üzerinde işlem yapar.",
  'Lower numbers deploy first. The setting below changes it.':
    'Küçük numaralar önce deploy edilir. Aşağıdaki ayar bunu değiştirir.',
  'The application is started again where it was.': 'Uygulama bulunduğu yerde yeniden başlatılır.',
  'The application is stopped again where it was.': 'Uygulama bulunduğu yerde yeniden durdurulur.',
  'Deployment state and settings': 'Deployment durumu ve ayarları',
  'One application: whether it is serving and where, the settings that decide how it is deployed, and the buttons to put a new build out or remove it from the domain.':
    "Tek bir uygulama: hizmet verip vermediği ve nerede verdiği, nasıl deploy edileceğini belirleyen ayarlar ve yeni bir sürüm çıkarma ya da domain'den kaldırma düğmeleri.",
  'Upload a new archive over this deployment, keeping its name and targets — this is how a new build goes out':
    "Bu deployment'ın üzerine, adını ve target'larını koruyarak yeni bir arşiv yükler — yeni bir sürüm böyle çıkar",
  'This domain has nothing deployed under the name {name}.': "Bu domain'de {name} adıyla deploy edilmiş bir şey yok.",
  'Not active anywhere — check that its target servers are running.':
    "Hiçbir yerde etkin değil — target server'larının çalıştığını kontrol edin.",
  'Where this application runs. Targeting a cluster deploys it to every member, including members added later; removing a target stops it being served there as soon as the change is activated.':
    "Bu uygulamanın çalıştığı yer. Bir cluster'ı hedeflemek, sonradan eklenecek üyeler dâhil bütün üyelere deploy eder; bir target'ı çıkarmak ise değişiklik etkinleştirilir etkinleştirilmez orada hizmet vermesini durdurur.",
  "These settings describe how the application is deployed, not what is inside it: anything from the archive's own descriptors — context roots, session timeouts, EJB pool sizes — is overridden with a deployment plan, which is set below. Most of these are read when the application is next deployed, so activate the change and then redeploy it, or stop and start it, to apply it.":
    "Buradaki ayarlar uygulamanın içinde ne olduğunu değil, nasıl deploy edildiğini tanımlar: arşivin kendi descriptor'larından gelen her şey — context root'lar, session zaman aşımları, EJB havuz boyutları — aşağıda belirlenen bir deployment planıyla ezilir. Bunların çoğu uygulama bir sonraki deploy edilişinde okunur; uygulamak için değişikliği etkinleştirip yeniden deploy edin ya da durdurup başlatın.",
  'The deployment name, with the archive or directory it was deployed from underneath.':
    'Deployment adı; altında, deploy edildiği arşiv veya dizin.',
  'The state WebLogic reports for the deployment — Active means it is serving requests, Retired means a newer version took over and this one is only draining its last sessions. Next to it: the health of the loaded instances when it is not OK, and how many servers the application is loaded on. "Not active" means WebLogic reports no state and no instance at all — usually because its target servers are down.':
    'WebLogic\'in deployment için bildirdiği durum — Active istekleri karşıladığı, Retired ise daha yeni bir sürümün devraldığı ve bunun yalnızca son session\'larını tükettiği anlamına gelir. Yanında: OK değilse yüklü örneklerin sağlık durumu ve uygulamanın kaç server\'a yüklendiği. "Etkin değil", WebLogic\'in hiçbir durum ve hiçbir örnek bildirmediği anlamına gelir — genelde target server\'ları kapalı olduğu içindir.',
  'What kind of module this is: war for a web application, ear for an enterprise application, jar for an EJB module, and so on.':
    'Bunun ne tür bir modül olduğu: web uygulaması için war, kurumsal uygulama için ear, EJB modülü için jar vb.',
  'The servers and clusters the application is deployed to. Start and Stop act on all of them at once.':
    "Uygulamanın deploy edildiği server ve cluster'lar. Başlat ve Durdur hepsi üzerinde aynı anda işlem yapar.",
  'How the archive reaches each server: stage copies it to the server, nostage leaves it on a shared path that every server must be able to read, external_stage means you copy it yourself.':
    "Arşivin her server'a nasıl ulaştığı: stage server'a kopyalar, nostage bütün server'ların okuyabilmesi gereken paylaşımlı bir yolda bırakır, external_stage ise kopyalamayı sizin yaptığınız anlamına gelir.",
  'Library': 'Kütüphane',
  'Shared libraries are referenced by applications rather than served themselves. An application that references a missing library will not start.':
    'Paylaşılan kütüphaneler kendileri hizmet vermez, uygulamalar tarafından referans alınır. Eksik bir kütüphaneyi referans alan uygulama başlamaz.',
  'Specification / implementation version. Applications can pin a specific version, so several versions of one library may be deployed side by side.':
    'Belirtim / gerçekleştirim sürümü. Uygulamalar belirli bir sürüme sabitlenebildiği için aynı kütüphanenin birkaç sürümü yan yana deploy edilmiş olabilir.',
  'The servers and clusters this library is deployed to.': "Bu kütüphanenin deploy edildiği server ve cluster'lar.",
  'Source': 'Kaynak',
  'Where the library archive was deployed from.': 'Kütüphane arşivinin deploy edildiği yer.',
  'The application is started again on the same targets.': "Uygulama aynı target'lar üzerinde yeniden başlatılır.",
  'The application is stopped again on the same targets.': "Uygulama aynı target'lar üzerinde yeniden durdurulur.",
  '{action} 1 application?': '1 uygulama için {action}?',
  '{action} {count} applications?': '{count} uygulama için {action}?',
  'Clients stop being served by each of them on all of their targets.':
    "İstemciler bunların her birinden bütün target'larında hizmet almayı bırakır.",
  'Each is put back into service on its own targets.': "Her biri kendi target'larında yeniden hizmete alınır.",
  '{action} requested for {count}': '{count} tanesi için {action} isteği gönderildi',
  'States refresh shortly.': 'Durumlar birazdan yenilenir.',
  '{action} failed for {count}': '{count} tanesi için {action} başarısız oldu',
  'Applications and shared libraries in this domain': "Bu domain'deki uygulamalar ve paylaşılan kütüphaneler",
  'Every application deployed to this domain and the shared libraries they reference. Install a new archive, replace one that is already there, start and stop them, or remove them entirely.':
    "Bu domain'e deploy edilmiş bütün uygulamalar ve referans aldıkları paylaşılan kütüphaneler. Yeni bir arşiv kurun, mevcut birini değiştirin, başlatıp durdurun ya da tamamen kaldırın.",
  'Upload a WAR, EAR or JAR and install it in this domain': "Bir WAR, EAR veya JAR yükleyip bu domain'e kurar",
  'How to stop and restart an application': 'Bir uygulama nasıl durdurulur ve yeniden başlatılır',
  'Stop takes the application out of service on every one of its targets. Clients get a 404 from that point on, and any session state in it is gone.':
    "Durdur, uygulamayı bütün target'larında hizmet dışına alır. İstemciler o andan itibaren 404 alır ve içindeki session durumu kaybolur.",
  'Start puts it back into service on the same targets. Together they are a restart.':
    "Başlat, uygulamayı aynı target'larda yeniden hizmete alır. İkisi birlikte yeniden başlatma demektir.",
  'The State column shows the state WebLogic reports for the deployment, plus the health of its loaded instances when that is not OK. It can take a few seconds to catch up after either action.':
    "Durum sütunu, WebLogic'in deployment için bildirdiği durumu ve OK değilse yüklü örneklerinin sağlık durumunu gösterir. Her iki işlemden sonra da yetişmesi birkaç saniye sürebilir.",
  'An application that shows Not active is deployed but running nowhere — check that its target servers are up on the Servers page before assuming the deployment is broken. Retired is different: a newer version of the same application took over, and this one is only finishing the sessions it already had. It still shows the servers it is loaded on, but it serves no new requests.':
    "Etkin değil görünen bir uygulama deploy edilmiştir ama hiçbir yerde çalışmıyordur — deployment'ın bozuk olduğuna karar vermeden önce Server'lar sayfasından target server'larının ayakta olduğunu kontrol edin. Retired farklıdır: aynı uygulamanın daha yeni bir sürümü devralmıştır ve bu sürüm yalnızca elindeki session'ları tamamlamaktadır. Yüklü olduğu server'ları hâlâ gösterir, ancak yeni istek karşılamaz.",
  'Deploy uploads a new archive and installs it. Redeploy replaces the archive of one already there, keeping its name and targets — that is how a new build goes out. Undeploy removes it from the domain altogether. All three are staged as configuration changes and activated, so a failed upload leaves the domain exactly as it was.':
    "Deploy et yeni bir arşiv yükleyip kurar. Yeniden deploy et, mevcut bir uygulamanın arşivini adını ve target'larını koruyarak değiştirir — yeni bir sürüm böyle çıkar. Undeploy et ise uygulamayı domain'den tamamen kaldırır. Üçü de yapılandırma değişikliği olarak bekletilip etkinleştirilir; bu yüzden başarısız bir yükleme domain'i olduğu gibi bırakır.",
  'Nothing is deployed to this domain.': "Bu domain'e deploy edilmiş bir şey yok.",
  'Filter applications…': 'Uygulamaları süz…',
  'Matches the application name, type, targets and staging mode of the rows already loaded.':
    "Yüklenmiş satırların uygulama adı, türü, target'ları ve staging moduyla eşleşir.",
  '{count} selected': '{count} seçili',
  'Open this application: deployment state and its settings': 'Bu uygulamayı aç: deployment durumu ve ayarları',
  'Not active': 'Etkin değil',
  'Loaded on {servers}': '{servers} üzerinde yüklü',
  'on {count}': '{count} tanesinde',
  'Upload a new archive over this deployment, keeping its name and targets':
    "Bu deployment'ın üzerine, adını ve target'larını koruyarak yeni bir arşiv yükler",
  '— code that applications reference instead of bundling; they have no lifecycle buttons of their own':
    '— uygulamaların içine gömmek yerine referans aldığı kod; kendilerine ait yaşam döngüsü düğmeleri yoktur',

  // ---------------------------------------------------------- JMS and monitoring 
  'JMS server': 'JMS server',
  'A JMS server hosts destinations and their message store. The WebLogic server it runs on is shown underneath.':
    "Bir JMS server, destination'ları ve mesaj deposunu barındırır. Üzerinde çalıştığı WebLogic server'ı altta gösterilir.",
  'Health of this JMS server. Anything but OK means messaging on it is degraded.':
    "Bu JMS server'ın sağlık durumu. OK dışındaki her değer, üzerindeki mesajlaşmanın bozulduğu anlamına gelir.",
  'Current': 'Anlık',
  'Messages sitting in the destination right now, waiting to be consumed. A number that keeps growing means consumers are slower than producers, or have stopped.':
    "Destination'da şu anda tüketilmeyi bekleyen mesajlar. Sürekli artan bir sayı, tüketicilerin üreticilerden yavaş olduğunu veya durduğunu gösterir.",
  'Pending': 'Bekleyen',
  'Messages sent or received inside a transaction that has not committed yet, plus messages awaiting acknowledgement. A persistently high value points at consumers that never acknowledge or transactions that never commit.':
    'Henüz commit edilmemiş bir transaction içinde gönderilmiş veya alınmış mesajlar ile onay bekleyen mesajlar. Sürekli yüksek bir değer, hiç onay vermeyen tüketicileri veya hiç commit edilmeyen transactionları işaret eder.',
  'High': 'Tepe',
  'The highest current count reached since the server started. Useful for spotting a backlog that has already drained.':
    'Server başladığından beri ulaşılan en yüksek anlık sayı. Şimdiden erimiş bir birikmeyi fark etmekte işe yarar.',
  'Received': 'Alınan',
  'Total messages this JMS server has taken in since it started. It only ever grows; the rate it grows at is the interesting part.':
    "Bu JMS server'ın başladığından beri aldığı toplam mesaj. Yalnızca artar; asıl ilginç olan artış hızıdır.",
  'Bytes': 'Bayt',
  'Size of the messages currently held. Watch it against the quota configured for the store.':
    'Şu anda tutulan mesajların boyutu. Depo için tanımlı kotaya karşı izleyin.',
  'Destinations': "Destination'lar",
  'Queues and topics hosted by this JMS server.': "Bu JMS server'ın barındırdığı queue ve topic'ler.",
  'Destination': 'Destination',
  'A queue or topic. This is the name applications look up in JNDI to send and receive messages.':
    "Bir queue veya topic. Uygulamaların mesaj gönderip almak için JNDI'da aradığı ad budur.",
  'The JMS server hosting this destination.': "Bu destination'ı barındıran JMS server.",
  'Consumers': 'Tüketiciler',
  'Clients or MDBs currently listening on this destination. Zero consumers with a rising Current count is the classic stuck-queue signature.':
    "Bu destination'ı şu anda dinleyen istemciler veya MDB'ler. Sıfır tüketiciyle birlikte artan bir Anlık sayı, tıkanmış kuyruğun klasik işaretidir.",
  'Size of the messages currently held on this destination.': "Bu destination'da şu anda tutulan mesajların boyutu.",
  'Store': 'Depo',
  'Where persistent messages and transaction records are kept — a file store on disk or a JDBC store in a database. A JMS server is only as reliable as its store.':
    'Kalıcı mesajların ve transaction kayıtlarının tutulduğu yer — diskte bir dosya deposu veya veritabanında bir JDBC deposu. Bir JMS server ancak deposu kadar güvenilirdir.',
  'The server this store is open on.': 'Bu deponun açık olduğu server.',
  'Objects': 'Kayıtlar',
  'Records the store currently holds. A number that only grows means something is being written and never acknowledged.':
    'Deponun şu anda tuttuğu kayıtlar. Yalnızca artan bir sayı, bir şeyin yazıldığını ama hiç onaylanmadığını gösterir.',
  'Writes': 'Yazma',
  'Records written since the store opened.': 'Depo açıldığından beri yazılan kayıtlar.',
  'Reads': 'Okuma',
  'Records read back, usually during recovery or redelivery.':
    'Geri okunan kayıtlar; genelde kurtarma veya yeniden teslim sırasında.',
  'Deletes': 'Silme',
  'Records removed once their message was consumed.': 'Mesajı tüketildikten sonra kaldırılan kayıtlar.',
  'SAF agent': 'SAF agent',
  'Store-and-forward keeps messages locally when the remote domain cannot be reached, and sends them when it can. A rising pending count means the far end is unreachable.':
    "Store-and-forward, uzak domain'e erişilemediğinde mesajları yerelde tutar ve erişilebildiğinde gönderir. Artan bir bekleyen sayısı, karşı tarafa erişilemediği anlamına gelir.",
  'The server this agent runs on.': "Bu agent'ın üzerinde çalıştığı server.",
  'Sending, receiving or both.': 'Gönderen, alan veya her ikisi.',
  'Messages the agent is holding right now.': "Agent'ın şu anda tuttuğu mesajlar.",
  'Messages waiting to be forwarded. Sustained above zero means the remote destination is not accepting them.':
    "İletilmeyi bekleyen mesajlar. Sürekli sıfırın üzerinde olması, uzak destination'ın onları kabul etmediği anlamına gelir.",
  'Messages taken in since the server started.': 'Server başladığından beri alınan mesajlar.',
  'Messages the agent gave up on, according to its retry and expiry policy. These are gone unless an error destination was configured.':
    "Agent'ın yeniden deneme ve son kullanma politikasına göre vazgeçtiği mesajlar. Bir hata destination'ı tanımlanmadıysa bunlar kaybolur.",
  'Bridge': 'Bridge',
  'A messaging bridge copies messages between a WebLogic destination and another provider — a second domain, or a third-party broker.':
    "Bir messaging bridge, bir WebLogic destination'ı ile başka bir sağlayıcı arasında mesaj kopyalar — ikinci bir domain ya da üçüncü taraf bir broker.",
  'The server running this bridge.': "Bu bridge'i çalıştıran server.",
  'Active means it is forwarding. A bridge that will not leave its starting state usually cannot reach one of its two ends.':
    'Active, iletim yaptığı anlamına gelir. Başlangıç durumundan çıkamayan bir bridge genelde iki ucundan birine erişemiyordur.',
  'Description': 'Açıklama',
  'Messaging runtime across every running server': "Çalışan bütün server'lardaki mesajlaşma runtime'ı",
  'Live JMS numbers gathered from every running server. This page is runtime only — a JMS server on a stopped WebLogic server does not appear at all.':
    "Çalışan bütün server'lardan toplanan anlık JMS değerleri. Bu sayfa yalnızca runtime gösterir — durmuş bir WebLogic server üzerindeki JMS server burada hiç görünmez.",
  'How to tell whether messages are stuck': 'Mesajların takılıp takılmadığı nasıl anlaşılır',
  'Look at Messages pending above. Zero is the healthy state on most domains; a number that stays high means something is not completing.':
    "Yukarıdaki Bekleyen mesaj sayısına bakın. Çoğu domain'de sağlıklı olan sıfırdır; yüksek kalan bir sayı bir şeyin tamamlanmadığını gösterir.",
  'Scroll to Destinations and sort by Current to find the queue holding the backlog.':
    "Birikmeyi tutan kuyruğu bulmak için Destination'lar bölümüne inip Anlık sütununa göre sıralayın.",
  "Check that queue's Consumers. Zero consumers means the listener or MDB is down — look at Deployments, then Logs on the server named under the destination.":
    "O kuyruğun Tüketiciler değerine bakın. Sıfır tüketici, listener veya MDB'nin kapalı olduğu anlamına gelir — önce Deployment'lara, sonra destination'ın altında adı geçen server'ın loglarına bakın.",
  'Every column header here has its own info icon explaining what that counter actually measures.':
    'Buradaki her sütun başlığının, o sayacın gerçekte neyi ölçtüğünü açıklayan kendi bilgi simgesi vardır.',
  'Below the destinations are the things messaging depends on: the persistent stores that hold messages on disk or in a database, the SAF agents holding messages for a domain that cannot be reached, and the bridges to other providers. A backlog with no obvious cause is often a store that has stopped keeping up.':
    "Destination'ların altında mesajlaşmanın bağlı olduğu şeyler yer alır: mesajları diskte veya veritabanında tutan kalıcı depolar, erişilemeyen bir domain için mesaj bekleten SAF agent'ları ve diğer sağlayıcılara giden bridge'ler. Bariz bir sebebi olmayan birikmenin arkasında çoğu zaman yetişemez hâle gelmiş bir depo vardır.",
  'JMS servers': "JMS server'lar",
  'JMS servers running right now across the domain. Each one hosts destinations and owns their message store.':
    "Domain genelinde şu anda çalışan JMS server'lar. Her biri destination'ları barındırır ve mesaj depolarının sahibidir.",
  'Queues and topics currently available across all JMS servers.':
    "Bütün JMS server'larda şu anda kullanılabilir olan queue ve topic'ler.",
  'Messages current': 'Anlık mesaj',
  'Messages held across every destination right now. A steady number is normal traffic; a number that only climbs is a backlog.':
    "Şu anda bütün destination'larda tutulan mesajlar. Sabit bir sayı normal trafiktir; yalnızca yükselen bir sayı birikmedir.",
  'Messages pending': 'Bekleyen mesaj',
  'Messages inside uncommitted transactions or awaiting acknowledgement. This is usually the first place a messaging problem shows up.':
    'Commit edilmemiş transactionların içindeki veya onay bekleyen mesajlar. Bir mesajlaşma sorunu genelde ilk burada görünür.',
  'No JMS servers are running. Only running servers report JMS runtime.':
    "Çalışan JMS server yok. JMS runtime'ını yalnızca çalışan server'lar bildirir.",
  'Filter JMS servers…': "JMS server'ları süz…",
  'Matches the JMS server name and the WebLogic server hosting it.':
    'JMS server adı ve onu barındıran WebLogic server ile eşleşir.',
  'Filter destinations…': "Destination'ları süz…",
  'Matches the destination name, its JMS server and the WebLogic server hosting it.':
    'Destination adı, JMS server’ı ve onu barındıran WebLogic server ile eşleşir.',
  'Persistent stores': 'Kalıcı depolar',
  '— where persistent messages and transaction records actually live':
    '— kalıcı mesajların ve transaction kayıtlarının gerçekte durduğu yer',
  'Filter stores…': 'Depoları süz…',
  'Matches the store name and the server it is open on.': 'Depo adı ve açık olduğu server ile eşleşir.',
  'Store-and-forward agents': "Store-and-forward agent'ları",
  '— messages held for a domain that cannot be reached right now':
    '— şu anda erişilemeyen bir domain için bekletilen mesajlar',
  'Filter agents…': "Agent'ları süz…",
  'Matches the agent name, its type and the server it runs on.':
    'Agent adı, türü ve üzerinde çalıştığı server ile eşleşir.',
  'Messaging bridges': "Messaging bridge'ler",
  "— links between this domain's destinations and another provider":
    "— bu domain'in destination'ları ile başka bir sağlayıcı arasındaki bağlantılar",
  'Filter bridges…': "Bridge'leri süz…",
  'Matches the bridge name, state and the server it runs on.':
    'Bridge adı, durumu ve üzerinde çalıştığı server ile eşleşir.',
  'Persistent stores, SAF agents and bridges could not be read from this domain — that part of the runtime tree is not exposed by this WebLogic release.':
    "Kalıcı depolar, SAF agent'ları ve bridge'ler bu domain'den okunamadı — runtime ağacının o bölümü bu WebLogic sürümünde sunulmuyor.",
  'building up': 'birikiyor',
  'JVM memory and thread pool health per running server': 'Çalışan server başına JVM belleği ve thread pool sağlığı',
  'One card per running server, with the two things that explain most WebLogic slowdowns: how much heap the JVM is using, and how busy its request thread pool is. Only running servers appear here.':
    "Çalışan her server için bir kart; WebLogic yavaşlamalarının çoğunu açıklayan iki şeyle: JVM'in ne kadar heap kullandığı ve istek thread pool'unun ne kadar meşgul olduğu. Burada yalnızca çalışan server'lar görünür.",
  'How to work out why a server feels slow': 'Bir server neden yavaş, nasıl anlaşılır',
  'Heap red or amber and staying there? The JVM is short of memory. It will spend its time in garbage collection long before it throws OutOfMemoryError, so this shows up as slowness first.':
    "Heap kırmızı ya da sarı ve öyle mi kalıyor? JVM'in belleği yetmiyordur. OutOfMemoryError vermeden çok önce zamanını garbage collection'da geçirir; bu yüzden önce yavaşlık olarak kendini gösterir.",
  'Stuck above zero? Requests are blocked on something outside the server — a database, a remote call, a lock. Check Data Sources for waiting connections, then read Logs on that server.':
    "Takılmış sayısı sıfırın üzerinde mi? İstekler server dışında bir şeyde bloke olmuştur — bir veritabanı, uzak bir çağrı, bir kilit. Bekleyen bağlantılar için Data Source'lara bakın, sonra o server'ın loglarını okuyun.",
  'Thread pool bar near full with a growing queue? More work is arriving than the server can finish. Look for a slow downstream system before adding capacity.':
    "Thread pool çubuğu doluya yakın ve kuyruk büyüyor mu? Server'ın bitirebileceğinden çok iş geliyordur. Kapasite eklemeden önce yavaş bir alt sistem arayın.",
  'The line under each bar is the last couple of hours, sampled in the background — so the direction is there the moment you open the page, without having to sit and watch it. A heap that sawtooths is healthy garbage collection; one that climbs in steps and never returns is a leak.':
    'Her çubuğun altındaki çizgi son birkaç saattir ve arka planda örneklenir — böylece sayfayı açtığınız anda gidişat karşınızdadır, oturup izlemeniz gerekmez. Testere dişi çizen bir heap sağlıklı garbage collection demektir; basamak basamak yükselip hiç geri dönmeyen ise sızıntıdır.',
  'No server is running, so there is no runtime to monitor.':
    'Çalışan server yok, dolayısıyla izlenecek bir runtime da yok.',
  'Heap': 'Heap',
  'Java heap': 'Java heap',
  'Memory available to application objects. WebLogic reports what is committed now and the maximum the JVM may grow to (-Xmx). Used memory sawtooths as garbage collection runs; what matters is whether the low points keep rising.':
    "Uygulama nesnelerinin kullanabileceği bellek. WebLogic şu an ayrılmış olanı ve JVM'in çıkabileceği üst sınırı (-Xmx) bildirir. Kullanılan bellek, garbage collection çalıştıkça testere dişi çizer; asıl önemli olan dip noktalarının yükselip yükselmediğidir.",
  'Heap in use against the JVM maximum. Amber past 75%, red past 90%. A bar that never drops after garbage collection is the classic memory-leak shape.':
    'JVM üst sınırına karşı kullanımdaki heap. %75 sonrası sarı, %90 sonrası kırmızı. Garbage collection sonrası hiç düşmeyen bir çubuk, klasik bellek sızıntısı görüntüsüdür.',
  '{used} of {max}': '{used} / {max}',
  'Heap used as a percentage of the maximum — {window}': 'Üst sınırın yüzdesi olarak kullanılan heap — {window}',
  'history builds up while the console runs': 'konsol çalıştıkça geçmiş birikir',
  'Committed': 'Ayrılmış',
  'Heap the JVM has actually reserved from the operating system right now. It grows towards the maximum as needed.':
    "JVM'in şu anda işletim sisteminden fiilen ayırdığı heap. İhtiyaç oldukça üst sınıra doğru büyür.",
  'Free of committed': 'Ayrılmışın boş kısmı',
  'Free share of the committed heap - not of the maximum. It can read comfortably high while the heap is still close to its ceiling, so read it together with the bar above.':
    "Üst sınırın değil, ayrılmış heap'in boş oranı. Heap tavana yakınken bile rahatlıkla yüksek görünebilir; bu yüzden yukarıdaki çubukla birlikte okuyun.",
  'How long this JVM has been running. An uptime that resets on its own means the process is crashing and being restarted.':
    "Bu JVM'in ne kadardır çalıştığı. Kendiliğinden sıfırlanan bir süre, sürecin çöküp yeniden başladığı anlamına gelir.",
  'Thread pool': 'Thread pool',
  'Self-tuning thread pool': 'Kendi kendini ayarlayan thread pool',
  'The threads that execute incoming requests. WebLogic sizes this pool itself based on throughput, so the count moving up and down is normal — busy threads against total is the number to watch.':
    "Gelen istekleri çalıştıran thread'ler. WebLogic bu havuzun boyutunu iş hacmine göre kendi ayarlar; bu yüzden sayının inip çıkması normaldir — izlenecek değer, toplama karşı meşgul thread sayısıdır.",
  'Threads currently executing requests against the total in the pool. Near full for long stretches means the server is saturated.':
    "Havuzdaki toplama karşı şu anda istek çalıştıran thread'ler. Uzun süre doluya yakın olması, server'ın doyuma ulaştığını gösterir.",
  '{busy} busy of {total}': '{total} thread’in {busy} tanesi meşgul',
  'Threads executing requests — {window}': 'İstek çalıştıran threadler — {window}',
  'Idle': 'Boşta',
  'Threads in the pool with nothing to do. Plenty of idle threads while requests are slow means the bottleneck is elsewhere.':
    "Havuzda yapacak işi olmayan thread'ler. İstekler yavaşken bol miktarda boşta thread olması, darboğazın başka yerde olduğunu gösterir.",
  'Hogging / stuck': 'Uzun süren / takılmış',
  'Hogging threads are holding on much longer than normal; stuck threads have exceeded the configured timeout (600s by default). Either number above zero deserves a look at the logs.':
    'Uzun süren threadler normalden çok daha fazla tutuyor; takılmış threadler ise tanımlı zaman aşımını (varsayılan 600 sn) aşmış durumda. İki sayıdan biri sıfırın üzerindeyse loglara bakmakta fayda var.',
  'Queue / pending': 'Kuyruk / bekleyen',
  'Requests waiting for a thread, and user requests not yet handed to one. Both should sit near zero on a healthy server.':
    "Thread bekleyen istekler ve henüz bir thread'e verilmemiş kullanıcı istekleri. Sağlıklı bir server'da ikisi de sıfıra yakın olmalıdır.",
  'Throughput': 'İş hacmi',
  'Requests completed per second, as measured by the self-tuning pool. Compare it between servers in the same cluster to spot an outlier.':
    "Kendi kendini ayarlayan havuzun ölçtüğü, saniyede tamamlanan istek sayısı. Aykırı olanı yakalamak için aynı cluster'daki server'lar arasında karşılaştırın.",
  '{count} req/s': '{count} istek/sn',
  'Network sockets the server currently holds open, including client connections and connections to other servers':
    "Server'ın şu anda açık tuttuğu ağ soketleri; istemci bağlantıları ve diğer server'lara giden bağlantılar dâhil",
  'Open sockets {count}': 'Açık soket {count}',
  'Health the thread pool reports about itself — it turns critical when threads stay stuck':
    "Thread pool'un kendi hakkında bildirdiği sağlık durumu — threadler takılı kaldığında kritik olur",
  'Pool health {health}': 'Havuz sağlığı {health}',
  'WebLogic version this server runs': "Bu server'ın çalıştırdığı WebLogic sürümü",
  'version unknown': 'sürüm bilinmiyor',

  // ------------------------------------------------------- transactions and logs 
  'Each server keeps its own transaction totals, counted since it last started.':
    'Her server, en son başladığı andan itibaren kendi transaction toplamlarını tutar.',
  'Transactions in flight right now. A number that grows and never falls means transactions are being started and not finished.':
    'Şu anda devam eden transactionlar. Artıp hiç düşmeyen bir sayı, transactionların başlatılıp bitirilmediği anlamına gelir.',
  'Transactions that completed successfully since the server started. Only ever grows; the rate is what matters.':
    'Server başladığından beri başarıyla tamamlanan transactionlar. Yalnızca artar; asıl önemli olan hızıdır.',
  'Transactions that were undone, with the share of all transactions underneath. A few percent is normal on most systems; a jump is not.':
    'Geri alınan transactionlar; altta bütün transactionlar içindeki oranı. Çoğu sistemde birkaç yüzde normaldir, ani bir sıçrama değildir.',
  'Timeouts': 'Zaman aşımı',
  'Rollbacks caused by the transaction taking longer than the JTA timeout. These point at a slow database or a remote call without a limit.':
    "Transaction'ın JTA zaman aşımından uzun sürmesi yüzünden oluşan rollbacklar. Bunlar yavaş bir veritabanını ya da sınırı olmayan bir uzak çağrıyı işaret eder.",
  'Resource': 'Kaynak',
  'Rollbacks a resource asked for — usually the database refusing to commit. Read the server log for the SQL error behind them.':
    'Bir kaynağın istediği rollbacklar — genelde veritabanının commit etmeyi reddetmesi. Arkalarındaki SQL hatası için server loglarını okuyun.',
  'Rollbacks the application asked for itself, by calling setRollbackOnly or throwing out of a transactional method. Normal in small numbers.':
    'Uygulamanın setRollbackOnly çağırarak ya da transactional bir metottan hata fırlatarak kendi istediği rollbacklar. Az sayıda olması normaldir.',
  'Heuristic': 'Sezgisel',
  'Participants that decided for themselves rather than following the coordinator, so two systems may now disagree. Anything above zero needs investigating by hand.':
    'Koordinatörü izlemek yerine kendi kararını veren katılımcılar; bu yüzden iki sistem artık uyuşmuyor olabilir. Sıfırın üzerindeki her değer elle incelenmelidir.',
  'Avg time': 'Ort. süre',
  'Average seconds a transaction stayed active, over every transaction since start-up. Compare it between servers rather than against an absolute figure.':
    "Başlangıçtan beri bütün transactionlar üzerinden, bir transaction'ın etkin kaldığı ortalama saniye. Mutlak bir değerle değil, server'lar arasında karşılaştırın.",
  'Work manager': 'Work manager',
  'A named queue of work with its own rules. Applications get their own; the WebLogic internal ones handle housekeeping.':
    "Kendi kuralları olan, adlandırılmış bir iş kuyruğu. Uygulamaların kendine ait olanları vardır; WebLogic'in dâhilî olanları bakım işlerini yürütür.",
  'The server this work manager belongs to.': "Bu work manager'ın ait olduğu server.",
  'Requests waiting for a thread in this work manager. This is where a saturated thread pool shows which application is causing it.':
    "Bu work manager'da thread bekleyen istekler. Doymuş bir thread pool'un hangi uygulamadan kaynaklandığı burada görünür.",
  'Completed': 'Tamamlanan',
  'Requests this work manager has finished since the server started.':
    "Server başladığından beri bu work manager'ın bitirdiği istekler.",
  'Stuck': 'Takılmış',
  'Threads in this work manager busy longer than the stuck-thread timeout. Narrows a domain-wide stuck count down to one application.':
    "Bu work manager'da, takılmış-thread zaman aşımından uzun süredir meşgul olan threadler. Domain genelindeki takılmış sayısını tek bir uygulamaya indirger.",
  'JTA totals and work manager queues per server': 'Server başına JTA toplamları ve work manager kuyrukları',
  'What the transaction manager has been doing since each server started, and how much work is queued behind each work manager. Only running servers report these numbers.':
    "Her server başladığından beri transaction yöneticisinin ne yaptığı ve her work manager'ın arkasında ne kadar iş biriktiği. Bu değerleri yalnızca çalışan server'lar bildirir.",
  'How to read a rising rollback count': 'Artan bir rollback sayısı nasıl okunur',
  'Timeouts climbing means transactions are running past the JTA timeout — nearly always a slow query or a remote call with no limit of its own. Check Data Sources for waiting connections next.':
    "Zaman aşımının artması, transactionların JTA zaman aşımını geçtiği anlamına gelir — bu neredeyse her zaman yavaş bir sorgu ya da kendi sınırı olmayan bir uzak çağrıdır. Sırada, bekleyen bağlantılar için Data Source'lara bakmak var.",
  'Resource rollbacks are the database refusing to commit: a constraint, a deadlock or a lost connection. The server log carries the actual SQL error.':
    'Kaynak rollbackleri veritabanının commit etmeyi reddetmesidir: bir kısıt, bir deadlock veya kopmuş bir bağlantı. Asıl SQL hatası server loglarındadır.',
  'Application rollbacks are deliberate — the code asked for them. A jump usually means a validation or downstream failure rather than an infrastructure problem.':
    'Uygulama rollbackleri bilinçlidir — kodun kendisi istemiştir. Ani bir sıçrama genelde altyapı sorunu değil, bir doğrulama ya da alt sistem hatasıdır.',
  'Heuristic above zero means a participant decided on its own and two systems may now disagree. That one is investigated by hand, not fixed from a console.':
    'Sezgisel değerin sıfırın üzerinde olması, bir katılımcının kendi kararını verdiği ve iki sistemin artık uyuşmuyor olabileceği anlamına gelir. Bu, konsoldan düzeltilecek değil, elle incelenecek bir durumdur.',
  'Totals only ever grow. Turn auto-refresh on and watch how fast they move — the rate tells you far more than the number.':
    'Toplamlar yalnızca artar. Otomatik yenilemeyi açıp ne kadar hızlı ilerlediklerine bakın — hız, size sayının kendisinden çok daha fazlasını söyler.',
  'Active now': 'Şu anda etkin',
  'Transactions in flight across every running server at this moment.':
    "Şu anda çalışan bütün server'larda devam eden transactionlar.",
  'Transactions that completed successfully since each server started.':
    'Her server başladığından beri başarıyla tamamlanan transactionlar.',
  'Rollback rate': 'Rollback oranı',
  '{count} rolled back': '{count} geri alındı',
  'Rolled back as a share of all transactions since start-up. A steady low percentage is normal; a rise is the signal worth acting on.':
    'Başlangıçtan beri bütün transactionlar içinde geri alınanların oranı. Sabit ve düşük bir yüzde normaldir; yükseliş harekete geçmeye değer sinyaldir.',
  'Heuristic outcomes': 'Sezgisel sonuçlar',
  "Participants that committed or rolled back against the coordinator's decision, leaving two systems possibly out of step. Anything above zero deserves a manual check.":
    'Koordinatörün kararına aykırı biçimde commit veya rollback yapan katılımcılar; bu, iki sistemi uyumsuz bırakmış olabilir. Sıfırın üzerindeki her değer elle kontrol edilmelidir.',
  'No server is running, so there are no transaction runtimes to read.':
    "Çalışan server yok, dolayısıyla okunacak transaction runtime'ı da yok.",
  'Matches the server name of the rows already loaded.': 'Yüklenmiş satırların server adıyla eşleşir.',
  '{count}s': '{count} sn',
  'Work managers': "Work manager'lar",
  '— which queue the pending requests are actually sitting in':
    '— bekleyen isteklerin gerçekte hangi kuyrukta durduğu',
  'Filter work managers…': "Work manager'ları süz…",
  'Matches the work manager name and the server it belongs to.': 'Work manager adı ve ait olduğu server ile eşleşir.',
  'Last 15 minutes': 'Son 15 dakika',
  'Last hour': 'Son bir saat',
  'Last 6 hours': 'Son 6 saat',
  'Last 24 hours': 'Son 24 saat',
  'Last 7 days': 'Son 7 gün',
  'Custom range…': 'Özel aralık…',
  'Time': 'Zaman',
  'Severity': 'Önem',
  'Subsystem': 'Alt sistem',
  'Message': 'Mesaj',
  'Enter both a start and an end time.': 'Hem başlangıç hem bitiş zamanını girin.',
  'The start of the range has to come before its end.': 'Aralığın başlangıcı bitişinden önce olmalıdır.',
  'Check the time range': 'Zaman aralığını kontrol edin',
  'No matching log records': 'Eşleşen log kaydı yok',
  'Try a wider time window or a lower severity.':
    'Daha geniş bir zaman aralığı ya da daha düşük bir önem derecesi deneyin.',
  'Server log records via the WLDF accessor': 'WLDF accessor üzerinden server log kayıtları',
  'Reads log records straight out of a running server through the WLDF accessor, so you can search them without shell access to the machine. Set the filters, press Fetch, and the newest records appear first.':
    "Log kayıtlarını WLDF accessor aracılığıyla doğrudan çalışan bir server'dan okur; böylece makineye shell erişimi olmadan arama yapabilirsiniz. Süzgeçleri ayarlayıp Getir düğmesine basın; en yeni kayıtlar önce görünür.",
  'How to find the error behind an incident': 'Bir olayın arkasındaki hata nasıl bulunur',
  'Pick the Server that showed the problem. Only running servers can be queried.':
    "Sorunu gösteren Server'ı seçin. Yalnızca çalışan server'lar sorgulanabilir.",
  "Leave Log on ServerLog for application and server messages. DomainLog is the AdminServer's merged copy, HTTPAccessLog is one line per HTTP request.":
    "Uygulama ve server mesajları için Log seçimini ServerLog'da bırakın. DomainLog, AdminServer'ın birleştirilmiş kopyasıdır; HTTPAccessLog ise her HTTP isteği için bir satır tutar.",
  'Set Minimum severity to Error and a Time window that covers the incident, then press Fetch. When you know when it happened, pick Custom range and give the exact start and end.':
    'En düşük önem derecesini Error yapın, olayı kapsayan bir Zaman aralığı seçin ve Getir düğmesine basın. Ne zaman olduğunu biliyorsanız Özel aralık seçip tam başlangıç ve bitişi verin.',
  'Nothing found? Widen the window or drop to Warning. Too much? Put a message id such as BEA-000337 or a class name in Message contains.':
    'Bir şey bulunamadı mı? Aralığı genişletin veya Warning seviyesine inin. Çok mu fazla? Mesaj içerir alanına BEA-000337 gibi bir mesaj kimliği ya da bir sınıf adı yazın.',
  'Click a heading in the Sort by row to reorder the records, and again to reverse it. Severity orders by seriousness rather than by name, so the worst records come first.':
    'Kayıtları yeniden sıralamak için Sırala satırındaki bir başlığa, tersine çevirmek için tekrar tıklayın. Önem sütunu ada göre değil ciddiyete göre sıralar; böylece en kötü kayıtlar başa gelir.',
  'The first matching record is usually the real cause; the ones after it are often knock-on failures. Note the subsystem in brackets — JDBC, JMS or Deployer tells you which page to look at next.':
    'Eşleşen ilk kayıt genelde asıl sebeptir; sonrakiler çoğu zaman zincirleme hatalardır. Köşeli parantez içindeki alt sisteme dikkat edin — JDBC, JMS veya Deployer size sırada hangi sayfaya bakacağınızı söyler.',
  "These filters and the sort are kept in the page's address, so the browser's back button steps through them and the link in the address bar reopens exactly this search for whoever you send it to.":
    'Bu süzgeçler ve sıralama sayfanın adresinde tutulur; böylece tarayıcının geri düğmesi aralarında gezinir ve adres çubuğundaki bağlantı, gönderdiğiniz kişide tam olarak bu aramayı yeniden açar.',
  "Which server's log to read. Each server writes its own log file, so pick the one that served the failing request. Stopped servers cannot be queried at all.":
    "Hangi server'ın logunun okunacağı. Her server kendi log dosyasını yazar; bu yüzden hatalı isteği karşılayanı seçin. Durmuş server'lar hiç sorgulanamaz.",
  'No running server': 'Çalışan server yok',
  'Log': 'Log',
  "ServerLog is the general server and application log and the right default. DomainLog is the AdminServer's merged view of the domain. HTTPAccessLog has one line per HTTP request. DataSourceLog carries JDBC detail.":
    "ServerLog genel server ve uygulama logudur; doğru varsayılan budur. DomainLog, AdminServer'ın domain'e dair birleştirilmiş görünümüdür. HTTPAccessLog her HTTP isteği için bir satır tutar. DataSourceLog ise JDBC detayını taşır.",
  'Minimum severity': 'En düşük önem derecesi',
  'Keeps this level and everything more serious. Error is the usual starting point; Warning catches problems that have not failed yet; Info is verbose on a busy server.':
    "Bu seviyeyi ve daha ciddi olan her şeyi bırakır. Alışılmış başlangıç noktası Error'dır; Warning henüz hataya dönüşmemiş sorunları yakalar; Info ise yoğun bir server'da çok ayrıntılıdır.",
  'Time window': 'Zaman aralığı',
  "How far back to search, counted from now. Custom range takes an exact start and end in this browser's timezone, which is what you want when you know when the incident happened. Records outside the window are dropped even when the server sends them.":
    'Şu andan geriye ne kadar aranacağı. Özel aralık, bu tarayıcının saat diliminde tam bir başlangıç ve bitiş alır; olayın ne zaman olduğunu bildiğinizde isteyeceğiniz şey budur. Aralığın dışındaki kayıtlar, server gönderse bile elenir.',
  'Message contains': 'Mesaj içerir',
  'Free text matched inside the message body, case sensitive. Good values: a message id such as BEA-000337, an exception class, an order number. Leave it empty to see everything at this severity.':
    'Mesaj gövdesinde aranan serbest metin; büyük/küçük harfe duyarlıdır. İyi örnekler: BEA-000337 gibi bir mesaj kimliği, bir exception sınıfı, bir sipariş numarası. Bu önem derecesindeki her şeyi görmek için boş bırakın.',
  'e.g. BEA-000337': 'örn. BEA-000337',
  'Limit': 'Sınır',
  'Most records to fetch, between 10 and 2000. The newest ones inside the window are kept, so a low limit on a wide window can hide older matches.':
    'Getirilecek en fazla kayıt sayısı; 10 ile 2000 arasında. Aralık içindeki en yeniler tutulur; bu yüzden geniş bir aralıkta düşük bir sınır, eski eşleşmeleri gizleyebilir.',
  'Run the query with these filters. Severity, log, window and time changes fetch on their own; the text box needs this button or the Enter key.':
    'Sorguyu bu süzgeçlerle çalıştırır. Önem, log, aralık ve zaman değişiklikleri kendiliğinden getirir; metin kutusu için bu düğme ya da Enter tuşu gerekir.',
  'Fetch': 'Getir',
  'From': 'Başlangıç',
  "Start of the range, read in this browser's timezone. Records before it are not shown.":
    'Aralığın başlangıcı; bu tarayıcının saat diliminde okunur. Bundan önceki kayıtlar gösterilmez.',
  'To': 'Bitiş',
  "End of the range, read in this browser's timezone. Records after it are not shown.":
    'Aralığın bitişi; bu tarayıcının saat diliminde okunur. Bundan sonraki kayıtlar gösterilmez.',
  'Could not read the log': 'Log okunamadı',
  'Sort by': 'Sırala',
  'Order the records by {column}. Click again to reverse it.':
    'Kayıtları {column} sütununa göre sıralar. Tersine çevirmek için tekrar tıklayın.',
  '{count} records': '{count} kayıt',
  'Reading log records…': 'Log kayıtları okunuyor…',
  'No records for these filters.': 'Bu süzgeçlere uyan kayıt yok.',
  'Records are read through the WLDF data accessor on the selected server and trimmed to the time window shown above.':
    "Kayıtlar, seçili server üzerindeki WLDF veri accessor'ı aracılığıyla okunur ve yukarıda gösterilen zaman aralığına göre kırpılır.",

  // ----------------------------------------- security, REST explorer and compare 
  'This WebLogic release does not expose users or groups over the REST management API. The realm and its providers above are still accurate; use WLST or the Remote Console for the accounts themselves.':
    "Bu WebLogic sürümü kullanıcıları veya grupları REST yönetim API'si üzerinden sunmuyor. Yukarıdaki realm ve provider'lar yine de doğrudur; hesapların kendisi için WLST veya Remote Console kullanın.",
  'Realm': 'Realm',
  'The security realm the domain runs with. Almost every domain has exactly one, called myrealm.':
    "Domain'in çalıştığı güvenlik realm'i. Neredeyse her domain'de myrealm adında tek bir tane bulunur.",
  'Providers': "Provider'lar",
  'Authentication providers, consulted in the order shown below.':
    "Aşağıda gösterilen sırayla başvurulan kimlik doğrulama provider'ları.",
  'Users listed': 'Listelenen kullanıcı',
  'not exposed': 'sunulmuyor',
  'Groups listed': 'Listelenen grup',
  'Provider': 'Provider',
  'Providers are consulted in this order when somebody signs in. DefaultAuthenticator is WebLogic’s own store; anything else usually points at LDAP or Active Directory.':
    "Biri giriş yaptığında provider'lara bu sırayla başvurulur. DefaultAuthenticator WebLogic'in kendi deposudur; diğerleri genelde LDAP veya Active Directory'yi işaret eder.",
  'The provider implementation — what it authenticates against.':
    "Provider'ın gerçekleştirimi — kimlik doğrulamayı neye karşı yaptığı.",
  'Control flag': 'Kontrol bayrağı',
  'How a result from this provider affects the chain. REQUIRED must succeed; SUFFICIENT ends the chain on success; OPTIONAL neither; REQUISITE fails the chain immediately on failure.':
    "Bu provider'dan gelen sonucun zinciri nasıl etkilediği. REQUIRED başarılı olmak zorundadır; SUFFICIENT başarı hâlinde zinciri bitirir; OPTIONAL ikisini de yapmaz; REQUISITE başarısızlık hâlinde zinciri anında düşürür.",
  'User': 'Kullanıcı',
  'The account name used to sign in.': 'Giriş için kullanılan hesap adı.',
  'Whatever the provider records about the account.': "Provider'ın hesap hakkında tuttuğu bilgi.",
  'Group': 'Grup',
  'Groups are what roles are granted to. Administrators, Deployers, Operators and Monitors are the built-in ones that decide what this console can do for a given user.':
    'Roller gruplara verilir. Administrators, Deployers, Operators ve Monitors, bu konsolun belirli bir kullanıcı için ne yapabileceğini belirleyen yerleşik gruplardır.',
  'The realm, its authentication providers, and the accounts they hold':
    "Realm, kimlik doğrulama provider'ları ve içlerindeki hesaplar",
  'A read-only view of who can sign in to this domain and through which provider. Creating accounts and changing role mappings is left to WLST or the Remote Console on purpose.':
    "Bu domain'e kimin, hangi provider üzerinden giriş yapabileceğinin salt okunur görünümü. Hesap oluşturma ve rol eşlemelerini değiştirme, bilinçli olarak WLST veya Remote Console'a bırakılmıştır.",
  'What decides whether a user can do something here':
    'Bir kullanıcının burada bir şey yapıp yapamayacağını ne belirler',
  "Signing in goes through the providers below, in order. The control flag decides whether one provider's answer is enough.":
    "Giriş, aşağıdaki provider'lardan sırayla geçer. Bir provider'ın cevabının yeterli olup olmadığına kontrol bayrağı karar verir.",
  'What the account may then do comes from the groups it belongs to: Administrators may change anything, Deployers may deploy, Operators may start and stop servers, Monitors may only read.':
    "Hesabın bundan sonra ne yapabileceği, ait olduğu gruplardan gelir: Administrators her şeyi değiştirebilir, Deployers deploy edebilir, Operators server'ları başlatıp durdurabilir, Monitors ise yalnızca okuyabilir.",
  'This console enforces nothing of its own — WebLogic refuses what the signed-in user may not do, and the error is shown as it comes back.':
    'Bu konsol kendinden bir kısıt uygulamaz — giriş yapan kullanıcının yapamayacağı şeyi WebLogic reddeder ve hata geldiği gibi gösterilir.',
  'Connecting with a Monitor account is a good way to look around a production domain without being able to change it by accident.':
    "Monitor hesabıyla bağlanmak, bir production domain'ine yanlışlıkla dokunma riski olmadan göz atmanın iyi bir yoludur.",
  'No authentication providers were returned for this realm.': "Bu realm için kimlik doğrulama provider'ı dönmedi.",
  'Filter providers…': "Provider'ları süz…",
  'Matches the provider name, type and control flag.': 'Provider adı, türü ve kontrol bayrağı ile eşleşir.',
  'Show the users and groups this provider holds': "Bu provider'ın içindeki kullanıcı ve grupları gösterir",
  'Accounts in {provider}': '{provider} içindeki hesaplar',
  '— reading…': '— okunuyor…',
  'This provider returned no users.': 'Bu provider hiç kullanıcı döndürmedi.',
  'Filter users…': 'Kullanıcıları süz…',
  'Matches the user name and description of the accounts already loaded.':
    'Yüklenmiş hesapların kullanıcı adı ve açıklamasıyla eşleşir.',
  'This provider returned no groups.': 'Bu provider hiç grup döndürmedi.',
  'Filter groups…': 'Grupları süz…',
  'Matches the group name and description of the groups already loaded.':
    'Yüklenmiş grupların adı ve açıklamasıyla eşleşir.',
  'Read-only by design. Adding a user or changing a role mapping is a WLST or Remote Console operation.':
    'Tasarım gereği salt okunur. Kullanıcı eklemek veya rol eşlemesi değiştirmek WLST ya da Remote Console işidir.',
  'Domain config': 'Domain yapılandırması',
  'Servers (config)': "Server'lar (yapılandırma)",
  'Server runtimes': "Server runtime'ları",
  'Lifecycle states': 'Yaşam döngüsü durumları',
  'JDBC resources': 'JDBC kaynakları',
  'Security realms': "Güvenlik realm'leri",
  'Request body is not valid JSON': 'İstek gövdesi geçerli JSON değil',
  'Call any endpoint of the management API directly': "Yönetim API'sinin herhangi bir endpoint'ini doğrudan çağırın",
  'An escape hatch onto the WebLogic management REST API for anything the other pages do not cover. GET requests are safe to explore with; anything else changes the domain.':
    "Diğer sayfaların kapsamadığı her şey için WebLogic yönetim REST API'sine açılan bir kaçış kapağı. GET istekleriyle keşif yapmak güvenlidir; diğerleri domain'i değiştirir.",
  'How to explore the management API': "Yönetim API'si nasıl keşfedilir",
  'Press one of the buttons at the bottom of the box. They are working examples — the fastest way to see the shape of a response.':
    'Kutunun altındaki düğmelerden birine basın. Bunlar çalışan örneklerdir — bir yanıtın biçimini görmenin en hızlı yolu.',
  'Edit the path and press Enter. Everything hangs off two trees: /domainConfig/… for configuration and /domainRuntime/… for live state.':
    'Yolu düzenleyip Enter tuşuna basın. Her şey iki ağaca bağlıdır: yapılandırma için /domainConfig/…, anlık durum için /domainRuntime/….',
  'Trim the output with query parameters: ?links=none drops the navigation links, &fields=name,state keeps only the fields you name.':
    'Çıktıyı sorgu parametreleriyle kırpın: ?links=none gezinme bağlantılarını atar, &fields=name,state yalnızca adını verdiğiniz alanları bırakır.',
  'Walk down a tree by appending the name of a child: /domainConfig/servers lists the servers, /domainConfig/servers/ms1 is one of them. Use Copy to take a response into a ticket or a script.':
    "Bir alt öğenin adını ekleyerek ağaçta ilerleyin: /domainConfig/servers server'ları listeler, /domainConfig/servers/ms1 ise onlardan biridir. Bir yanıtı bir kayda veya scripte taşımak için Kopyala düğmesini kullanın.",
  'GET only reads and is safe. POST, PUT and DELETE change the domain — most configuration edits also need an edit session under /edit.':
    "GET yalnızca okur ve güvenlidir. POST, PUT ve DELETE domain'i değiştirir — çoğu yapılandırma düzenlemesi ayrıca /edit altında bir düzenleme oturumu gerektirir.",
  'Fixed base of every management URL — type only the part after it':
    'Her yönetim adresinin sabit ön eki — yalnızca sonrasını yazın',
  '/domainRuntime/serverRuntimes?links=none': '/domainRuntime/serverRuntimes?links=none',
  'Sending…': 'Gönderiliyor…',
  'Send': 'Gönder',
  'Request body (JSON)': 'İstek gövdesi (JSON)',
  'Request body': 'İstek gövdesi',
  'Sent as the JSON payload of the request. Actions usually take an empty object or a small object of arguments; a configuration change takes the attributes you want to set. Invalid JSON is rejected before anything is sent.':
    'İsteğin JSON gövdesi olarak gönderilir. İşlemler genelde boş bir nesne ya da küçük bir argüman nesnesi alır; bir yapılandırma değişikliği ise ayarlamak istediğiniz öznitelikleri alır. Geçersiz JSON, hiçbir şey gönderilmeden reddedilir.',
  '{method} changes domain state. Configuration edits normally need an edit session under /edit.':
    '{method} domain durumunu değiştirir. Yapılandırma düzenlemeleri normalde /edit altında bir düzenleme oturumu gerektirir.',
  'Examples — click one to run it, then edit the path and press Enter:':
    'Örnekler — çalıştırmak için birine tıklayın, sonra yolu düzenleyip Enter tuşuna basın:',
  '{count} lines': '{count} satır',
  '{count} ms': '{count} ms',
  'Copy the whole JSON response to the clipboard': 'JSON yanıtının tamamını panoya kopyalar',
  'Applications': 'Uygulamalar',
  'Shared libraries': 'Paylaşılan kütüphaneler',
  'Machines': "Machine'ler",
  'Comparison saved': 'Karşılaştırma kaydedildi',
  'The full difference report has been downloaded as JSON.': 'Fark raporunun tamamı JSON olarak indirildi.',
  'What differs between two open domains': 'Açık iki domain arasındaki farklar',
  'Reads the configuration of two domains you have open and subtracts one from the other: what exists on one side only, where the same object is set up differently, and how much memory, threads and connections each side is given. Nothing is changed by comparing.':
    "Açık olan iki domain'in yapılandırmasını okur ve birini diğerinden çıkarır: yalnızca bir tarafta bulunanlar, aynı nesnenin farklı kurulduğu yerler ve her tarafa ne kadar bellek, thread ve bağlantı verildiği. Karşılaştırmak hiçbir şeyi değiştirmez.",
  'Download the whole comparison as JSON, for a ticket or a review':
    'Karşılaştırmanın tamamını bir kayıt veya inceleme için JSON olarak indirir',
  'Save report': 'Raporu kaydet',
  'How to use this when something works in one environment and not the other':
    'Bir ortamda çalışan bir şey diğerinde çalışmıyorsa bu sayfa nasıl kullanılır',
  'Open both domains — the connection switcher at the top of the sidebar adds a second one.':
    "İki domain'i de açın — kenar çubuğunun üstündeki bağlantı seçici ikincisini ekler.",
  'Pick them below, left and right, and press Compare.':
    'Aşağıdan sol ve sağ olarak seçin ve Karşılaştır düğmesine basın.',
  'Read Only in first: a data source or an application that exists on one side and not the other explains most works-in-test reports on its own.':
    'Önce Yalnızca şurada bölümünü okuyun: bir tarafta olup diğerinde olmayan bir data source ya da uygulama, "test\'te çalışıyor" şikâyetlerinin çoğunu tek başına açıklar.',
  'Then read Resources. It is where "the same application is slower there" usually ends: half the heap, a smaller connection pool, a different garbage collector, a work manager ceiling that only one side has.':
    '"Aynı uygulama orada daha yavaş" sorusu genelde Kaynaklar bölümünde biter: yarısı kadar heap, daha küçük bir bağlantı havuzu, farklı bir garbage collector, yalnızca bir tarafta olan bir work manager üst sınırı.',
  'Then read the changed objects. Pool sizes, listen ports, timeouts and targets are where domains drift fastest.':
    "Sonra değişmiş nesneleri okuyun. Havuz boyutları, listen portları, zaman aşımları ve target'lar, domain'lerin en hızlı ayrıştığı yerlerdir.",
  'Heap and metaspace are read from the JVM arguments Node Manager passes to each server, next to what the running JVM reports. A server started from a shell script instead takes its sizes from that script, and then only the running value is the true one.':
    "Heap ve metaspace, Node Manager'ın her server'a geçirdiği JVM argümanlarından, çalışan JVM'in bildirdiğinin yanında okunur. Bunun yerine bir kabuk scriptinden başlatılan bir server boyutlarını o scriptten alır; o zaman yalnızca çalışan değer doğrudur.",
  'Both sides are read with the credentials of their own connection, so a Monitor account is enough for this page.':
    'Her iki taraf da kendi bağlantısının kimlik bilgileriyle okunur; bu yüzden bu sayfa için bir Monitor hesabı yeterlidir.',
  'Comparing needs two domains open at once. Use the connection switcher at the top of the sidebar to connect to a second AdminServer — production and test, say — and this page will compare them.':
    "Karşılaştırma için aynı anda iki domain'in açık olması gerekir. İkinci bir AdminServer'a — örneğin production ve test — bağlanmak için kenar çubuğunun üstündeki bağlantı seçiciyi kullanın; bu sayfa ikisini karşılaştıracaktır.",
  'Left': 'Sol',
  'The domain treated as the baseline. Differences are described as left versus right; swapping them changes nothing but the reading order.':
    'Temel alınan domain. Farklar sola karşı sağ olarak anlatılır; yer değiştirmeleri okuma sırasından başka bir şeyi değiştirmez.',
  'Swap the two sides': 'İki tarafın yerini değiştir',
  'Right': 'Sağ',
  'The domain compared against the baseline.': 'Temel alınana karşı karşılaştırılan domain.',
  'Reading both domains…': 'İki domain de okunuyor…',
  'Pick two different domains — comparing one with itself has nothing to show.':
    "Farklı iki domain seçin — bir domain'i kendisiyle karşılaştırmanın gösterecek bir şeyi yok.",
  'Could not read both domains': 'İki domain de okunamadı',
  'Objects that exist on the left and have no counterpart on the right.':
    'Solda bulunan ve sağda karşılığı olmayan nesneler.',
  'Objects that exist on the right and have no counterpart on the left.':
    'Sağda bulunan ve solda karşılığı olmayan nesneler.',
  'Configured differently': 'Farklı yapılandırılmış',
  'Objects with the same name on both sides but at least one attribute that differs.':
    'İki tarafta da aynı ada sahip olan, ancak en az bir özniteliği farklı olan nesneler.',
  'Sized differently': 'Farklı boyutlandırılmış',
  'Amounts that differ: heap, metaspace, pool sizes, thread ceilings and the totals across the domain. Listed under Resources.':
    'Farklılaşan miktarlar: heap, metaspace, havuz boyutları, thread üst sınırları ve domain genelindeki toplamlar. Kaynaklar bölümünde listelenir.',
  'Identical': 'Aynı',
  'Objects that match on every attribute compared.': 'Karşılaştırılan bütün özniteliklerde eşleşen nesneler.',
  'The running JVMs of {domains} could not be read, so only its configured amounts are compared. Servers that are down report nothing.':
    "{domains} için çalışan JVM'ler okunamadı; bu yüzden yalnızca tanımlı miktarları karşılaştırıldı. Kapalı server'lar hiçbir şey bildirmez.",
  'Attribute': 'Öznitelik',
  'Also list the sections where everything matches': 'Her şeyin eşleştiği bölümleri de listele',
  '{count} identical': '{count} aynı',
  '{count} different': '{count} farklı',
  '{count} unmatched': '{count} eşleşmeyen',
  'Everything matches.': 'Her şey eşleşiyor.',
  'Pick two domains and press Compare. Both are read with their own credentials; nothing is written to either.':
    'İki domain seçip Karşılaştır düğmesine basın. İkisi de kendi kimlik bilgileriyle okunur; hiçbirine bir şey yazılmaz.',
  'Resources': 'Kaynaklar',
  'How much each domain is given: heap and metaspace from the JVM command line, connection pool sizes, work manager ceilings, and what the running JVMs report. Sizes are normalised before they are compared, so -Xmx2g and -Xmx2048m count as the same heap.':
    "Her domain'e ne kadar verildiği: JVM komut satırından heap ve metaspace, bağlantı havuzu boyutları, work manager üst sınırları ve çalışan JVM'lerin bildirdikleri. Boyutlar karşılaştırılmadan önce normalleştirilir; böylece -Xmx2g ile -Xmx2048m aynı heap sayılır.",
  '{count} amounts differ': '{count} miktar farklı',
  'Show matching amounts too': 'Eşleşen miktarları da göster',
  'Both domains are sized the same on every amount compared.':
    'Karşılaştırılan bütün miktarlarda iki domain de aynı boyutlandırılmış.',
  'Open this object in the active domain': 'Bu nesneyi etkin domain içinde aç',
  'Only in {domain}': 'Yalnızca {domain} içinde',
  'Amount': 'Miktar',
  'Change': 'Fark',

  // -------------------------------------------------------------- settings panel 
  'Session ended': 'Oturum sona erdi',
  'Connect to the AdminServer again.': "AdminServer'a yeniden bağlanın.",
  'These changes as a script': 'Bu değişikliklerin script hâli',
  'Discard your unsaved edits?': 'Kaydedilmemiş düzenlemeleriniz atılsın mı?',
  '1 field on this page has been changed but not saved. Leaving loses that edit — nothing has reached the AdminServer yet.':
    "Bu sayfada 1 alan değiştirildi ama kaydedilmedi. Ayrılırsanız bu düzenleme kaybolur — AdminServer'a henüz hiçbir şey ulaşmadı.",
  '{count} fields on this page have been changed but not saved. Leaving loses those edits — nothing has reached the AdminServer yet.':
    "Bu sayfada {count} alan değiştirildi ama kaydedilmedi. Ayrılırsanız bu düzenlemeler kaybolur — AdminServer'a henüz hiçbir şey ulaşmadı.",
  'Discard edits': 'Düzenlemeleri at',
  '1 setting changed on {subject}': '{subject} üzerinde 1 ayar değişti',
  '{count} settings changed on {subject}': '{subject} üzerinde {count} ayar değişti',
  'Failed — {title}': 'Başarısız — {title}',
  'Nothing is offered to roll back, because it is not certain how much of this reached the AdminServer. The pending changes bar shows what is actually waiting.':
    "Bunun ne kadarının AdminServer'a ulaştığı kesin olmadığı için geri alma sunulmuyor. Gerçekte neyin beklediğini bekleyen değişiklikler çubuğu gösterir.",
  'Saved and activated — the running domain is using the new values.':
    'Kaydedildi ve etkinleştirildi — çalışan domain artık yeni değerleri kullanıyor.',
  'Saved as pending changes; not activated yet.': 'Bekleyen değişiklik olarak kaydedildi; henüz etkinleştirilmedi.',
  'The previous values were written back and activated.': 'Önceki değerler geri yazıldı ve etkinleştirildi.',
  'The previous values were written back into the pending changes.':
    'Önceki değerler bekleyen değişikliklere geri yazıldı.',
  'The old values are written back through the same staged edit and activated, so the domain ends up where it started.':
    'Eski değerler aynı bekletmeli düzenleme yoluyla geri yazılır ve etkinleştirilir; böylece domain başladığı yere döner.',
  'The old values are written back into the pending changes, which still have to be activated or discarded.':
    'Eski değerler bekleyen değişikliklere geri yazılır; bunların yine de etkinleştirilmesi veya iptal edilmesi gerekir.',
  'Write the previous values back': 'Önceki değerleri geri yazar',
  'Apply 1 change to the domain?': "Domain'e 1 değişiklik uygulansın mı?",
  'Apply {count} changes to the domain?': "Domain'e {count} değişiklik uygulansın mı?",
  '{count} of these only take effect later ({kinds}).':
    'Bunlardan {count} tanesi ancak daha sonra etkili olur ({kinds}).',
  'These take effect on the running domain immediately.': "Bunlar çalışan domain'de anında etkili olur.",
  'This domain runs in production mode.': 'Bu domain production modunda çalışıyor.',
  'Save and activate': 'Kaydet ve etkinleştir',
  'Save 1 change for later?': '1 değişiklik sonrası için kaydedilsin mi?',
  'Save {count} changes for later?': '{count} değişiklik sonrası için kaydedilsin mi?',
  'These are written to the AdminServer as pending changes and hold the domain lock until they are activated or discarded. The running domain keeps its current values until then.':
    "Bunlar AdminServer'a bekleyen değişiklik olarak yazılır ve etkinleştirilene ya da iptal edilene kadar domain kilidini tutar. Çalışan domain o ana kadar mevcut değerlerini korur.",
  'Save for later': 'Sonrası için kaydet',
  'Saved as pending changes': 'Bekleyen değişiklik olarak kaydedildi',
  'Nothing is live yet — press Activate changes at the top of the page to apply them.':
    'Henüz hiçbiri canlı değil — uygulamak için sayfanın üstündeki Değişiklikleri etkinleştir düğmesine basın.',
  'Could not save the changes': 'Değişiklikler kaydedilemedi',
  'anything saved before the failure is still waiting in the pending changes.':
    'hatadan önce kaydedilen her şey bekleyen değişikliklerde duruyor.',
  'Changes activated': 'Değişiklikler etkinleştirildi',
  '{count} of them wait for a restart or redeploy before they do anything.':
    'Bunlardan {count} tanesi etkili olmak için bir yeniden başlatma ya da yeniden deploy bekliyor.',
  'The running domain is using the new values.': 'Çalışan domain artık yeni değerleri kullanıyor.',
  'Saved, but activating failed': 'Kaydedildi, ancak etkinleştirme başarısız oldu',
  'Activate the pending changes?': 'Bekleyen değişiklikler etkinleştirilsin mi?',
  'Everything currently waiting is applied to the running domain, including changes made on another page or by another tool.':
    "Şu anda bekleyen her şey çalışan domain'e uygulanır; başka bir sayfada veya başka bir araçla yapılmış değişiklikler dâhil.",
  'Activate': 'Etkinleştir',
  'pending': 'bekliyor',
  'applied': 'uygulandı',
  'Pending changes activated on {subject}': '{subject} üzerinde bekleyen değişiklikler etkinleştirildi',
  'Everything that was waiting is now live, including changes made on another page or by another tool. Only the edits this console made are listed here.':
    'Bekleyen her şey artık canlı; başka bir sayfada veya başka bir araçla yapılmış değişiklikler dâhil. Burada yalnızca bu konsolun yaptığı düzenlemeler listelenir.',
  'Activating is not undone as one operation. Roll back the individual changes above, or edit the settings back by hand.':
    'Etkinleştirme tek bir işlem olarak geri alınmaz. Yukarıdaki değişiklikleri tek tek geri alın ya da ayarları elle eski hâline getirin.',
  'Could not activate the changes': 'Değişiklikler etkinleştirilemedi',
  'Discard the pending changes?': 'Bekleyen değişiklikler iptal edilsin mi?',
  'Release the configuration lock?': 'Yapılandırma kilidi bırakılsın mı?',
  'Everything waiting to be activated is thrown away and the domain keeps the values it is running with.':
    'Etkinleştirilmeyi bekleyen her şey atılır ve domain çalışmakta olduğu değerleri korur.',
  'The lock is released so another operator can edit the domain.':
    "Başka bir operatör domain'i düzenleyebilsin diye kilit bırakılır.",
  'Release': 'Bırak',
  '(discarded)': '(iptal edildi)',
  'Pending changes discarded on {subject}': '{subject} üzerinde bekleyen değişiklikler iptal edildi',
  'Nothing reached the running domain, which keeps the values it was already using.':
    "Çalışan domain'e hiçbir şey ulaşmadı; zaten kullandığı değerleri koruyor.",
  'Discarded edits are gone from the AdminServer. Make them again if they were wanted.':
    "İptal edilen düzenlemeler AdminServer'dan silindi. Gerekiyorsa yeniden yapın.",
  'Pending changes discarded': 'Bekleyen değişiklikler iptal edildi',
  'Lock released': 'Kilit bırakıldı',
  'Could not discard the changes': 'Değişiklikler iptal edilemedi',
  'How changing a setting works': 'Bir ayarı değiştirmek nasıl işler',
  'Change the fields you need. An edited field is outlined and shows what the AdminServer currently holds, so you can always see what you are about to change.':
    "İhtiyacınız olan alanları değiştirin. Değiştirilen bir alan çerçevelenir ve AdminServer'ın şu anda tuttuğu değeri gösterir; böylece neyi değiştirmek üzere olduğunuzu her zaman görürsünüz.",
  'Press Save and activate to apply them, or Save for later to stage them and activate several edits together.':
    'Uygulamak için Kaydet ve etkinleştir, bekletip birkaç düzenlemeyi birlikte etkinleştirmek için Sonrası için kaydet düğmesine basın.',
  'Every field says when it takes effect. Live on activate works immediately; Needs a restart means the running server keeps its old value until it is restarted.':
    "Her alan ne zaman etkili olacağını söyler. Etkinleştirmede canlı anında çalışır; Yeniden başlatma gerekir ise çalışan server'ın yeniden başlatılana kadar eski değerini koruyacağı anlamına gelir.",
  'WebLogic allows one editor per domain at a time. While you hold that lock nobody else can change the configuration, so activate or discard rather than leaving edits open.':
    'WebLogic her domain için aynı anda tek bir düzenleyiciye izin verir. Kilit sizdeyken başka kimse yapılandırmayı değiştiremez; bu yüzden düzenlemeleri açık bırakmak yerine etkinleştirin ya da iptal edin.',
  'Show script writes the pending edits out as WLST and as the REST calls this console makes — worth a glance before changing a production domain, and worth keeping afterwards as the record of what was changed.':
    "Script göster, bekleyen düzenlemeleri WLST ve bu konsolun yaptığı REST çağrıları olarak yazar — bir production domain'ini değiştirmeden önce göz atmaya, sonrasında da neyin değiştiğinin kaydı olarak saklamaya değer.",
  'Reading the configuration…': 'Yapılandırma okunuyor…',
  'These settings could not be read from this domain —': "Bu ayarlar bu domain'den okunamadı —",
  '1 unsaved edit': '1 kaydedilmemiş düzenleme',
  '{count} unsaved edits': '{count} kaydedilmemiş düzenleme',
  'Show these edits as a WLST script and as the REST calls the console makes — to check before saving, or to keep as a record':
    'Bu düzenlemeleri WLST scripti ve konsolun yaptığı REST çağrıları olarak gösterir — kaydetmeden önce kontrol etmek ya da kayıt olarak saklamak için',
  'Put every field back to the value the AdminServer holds.': "Her alanı AdminServer'daki değerine geri döndürür.",
  'Undo edits': 'Düzenlemeleri geri al',
  'Stage these changes on the AdminServer without applying them. They stay pending until you activate them.':
    "Bu değişiklikleri uygulamadan AdminServer'da bekletir. Siz etkinleştirene kadar bekleyen olarak kalırlar.",
  'Stage these changes and apply them to the running domain.':
    "Bu değişiklikleri bekletir ve çalışan domain'e uygular.",
  'Saving…': 'Kaydediliyor…',

  // --------------------- settings catalogue: impacts, logging, servers, clusters 
  'Live on activate': 'Etkinleştirmede canlı',
  'The running domain picks this up as soon as the change is activated. No restart needed.':
    'Değişiklik etkinleştirilir etkinleştirilmez çalışan domain bunu alır. Yeniden başlatma gerekmez.',
  'Needs a restart': 'Yeniden başlatma gerekir',
  'The change is saved and activated, but the server keeps running with its old value until it is restarted.':
    'Değişiklik kaydedilip etkinleştirilir, ancak server yeniden başlatılana kadar eski değeriyle çalışmaya devam eder.',
  'Used at next start': 'Bir sonraki açılışta kullanılır',
  'Only read while a server is starting, so nothing changes until the next time that server is started.':
    'Yalnızca bir server başlarken okunur; bu yüzden o server bir daha başlatılana kadar hiçbir şey değişmez.',
  'Needs a redeploy': 'Yeniden deploy gerekir',
  'Takes effect when the resource is redeployed, or when its target servers are restarted.':
    "Kaynak yeniden deploy edildiğinde ya da target server'ları yeniden başlatıldığında etkili olur.",
  'Trace — everything, extremely noisy': 'Trace — her şey, aşırı gürültülü',
  'Debug — diagnostic detail': 'Debug — tanılama detayı',
  'Info — normal operational messages (default)': 'Info — normal işleyiş mesajları (varsayılan)',
  'Notice — noteworthy but harmless': 'Notice — dikkate değer ama zararsız',
  'Warning — something looks wrong': 'Warning — bir şey yolunda görünmüyor',
  'Error — a request or subsystem failed': 'Error — bir istek veya alt sistem başarısız oldu',
  'Critical — a subsystem is unusable': 'Critical — bir alt sistem kullanılamaz durumda',
  'Alert — needs attention immediately': 'Alert — hemen ilgi gerektiriyor',
  'Emergency — the server is unusable': 'Emergency — server kullanılamaz durumda',
  'Off — write nothing to this destination': 'Off — bu hedefe hiçbir şey yazma',
  'stage — copy it to each server': "stage — her server'a kopyala",
  'external_stage — you place the files yourself': 'external_stage — dosyaları siz yerleştirirsiniz',
  'Never rotate — one file that grows forever': 'Hiç döndürme — sonsuza kadar büyüyen tek dosya',
  'By size — start a new file once it gets big': 'Boyuta göre — dosya büyüdüğünde yenisine geç',
  'By time — start a new file on a schedule': 'Zamana göre — belirli aralıklarla yenisine geç',
  'Log file path': 'Log dosyası yolu',
  'Where {what} is written. A relative path is resolved against the domain directory.':
    '{what} nereye yazılır. Göreli bir yol, domain dizinine göre çözümlenir.',
  'this server’s log': "bu server'ın logu",
  'the domain-wide log': 'domain geneli log',
  'When to start a new file': 'Ne zaman yeni dosyaya geçilir',
  'Rotation keeps a single log from filling the disk. By size is the usual choice; by time suits domains where logs are shipped nightly.':
    'Döndürme, tek bir logun diski doldurmasını engeller. Alışılmış seçim boyuta göredir; logların gece aktarıldığı domainlerde ise zamana göre uygundur.',
  'Rotate when the file reaches': 'Dosya şu boyuta ulaşınca döndür',
  'Only used when rotation is by size. The size is checked periodically, so a file can grow slightly past this before it rotates.':
    'Yalnızca boyuta göre döndürmede kullanılır. Boyut belirli aralıklarla kontrol edildiğinden, dosya döndürülmeden önce bu değeri biraz aşabilir.',
  'KB': 'KB',
  'Rotate every': 'Şu aralıkla döndür',
  'Only used when rotation is by time. 24 gives one file per day.':
    'Yalnızca zamana göre döndürmede kullanılır. 24 değeri günde bir dosya verir.',
  'hours': 'saat',
  'Delete the oldest files': 'En eski dosyaları sil',
  'On, only the number of files below is kept and the rest are deleted. Off, old logs pile up until the disk is full — the usual reason a domain suddenly stops writing logs.':
    "Açıkken yalnızca aşağıdaki sayı kadar dosya tutulur, geri kalanı silinir. Kapalıyken eski loglar disk dolana kadar birikir — bir domain'in aniden log yazmayı bırakmasının alışılmış sebebi budur.",
  'Files to keep': 'Saklanacak dosya sayısı',
  'How many rotated files survive, besides the one being written. Only used when deleting old files is on.':
    'Yazılmakta olanın dışında kaç döndürülmüş dosyanın kalacağı. Yalnızca eski dosyaları silme açıkken kullanılır.',
  'Start a new file on every boot': 'Her açılışta yeni dosyaya geç',
  'Makes each start begin a fresh log, which makes "what happened during the last start-up" easy to answer.':
    'Her açılışın taze bir logla başlamasını sağlar; böylece "son açılışta ne oldu" sorusu kolayca yanıtlanır.',
  'Where a server listens, how it starts and stops, and when it calls a thread stuck.':
    "Bir server'ın nerede dinlediği, nasıl başlayıp durduğu ve bir thread'e ne zaman takılmış dediği.",
  'Listen address and port': 'Listen adresi ve portu',
  'How clients and other servers reach this server. Get one of these wrong and the server still starts, but nothing can connect to it.':
    "İstemcilerin ve diğer server'ların bu server'a nasıl ulaştığı. Bunlardan biri yanlış olursa server yine başlar, ancak hiçbir şey ona bağlanamaz.",
  'Listen address': 'Listen adresi',
  'The address this server binds to. Empty means every address of the machine, which is what most domains want. Set it only when the machine has several networks and this server should answer on one of them.':
    "Bu server'ın bağlandığı adres. Boş olması makinenin bütün adresleri demektir; çoğu domain'in istediği de budur. Yalnızca makinede birden çok ağ varsa ve bu server bunlardan birinde yanıt vermeliyse doldurun.",
  'empty — listen on every address': 'boş — bütün adresleri dinle',
  'Plain (non-SSL) port': 'Düz (SSL’siz) port',
  'The port for plain HTTP and t3 traffic. Two servers on the same machine can never share a port; that clash appears as "Address already in use" at start-up.':
    'Düz HTTP ve t3 trafiği için port. Aynı makinedeki iki server bir portu asla paylaşamaz; bu çakışma açılışta "Address already in use" olarak görünür.',
  'Plain port open': 'Düz port açık',
  'Turn this off to make the server reachable over SSL only. Check that the SSL port below really works first, or the server becomes unreachable after its next restart.':
    "Server'a yalnızca SSL üzerinden erişilmesi için bunu kapatın. Önce aşağıdaki SSL portunun gerçekten çalıştığını doğrulayın; yoksa server bir sonraki yeniden başlatmadan sonra erişilemez hâle gelir.",
  'Allow t3 tunnelled over HTTP': 'HTTP üzerinden tünellenmiş t3’e izin ver',
  'Lets t3 clients reach the server through firewalls and proxies that only pass HTTP. Leave it off unless a client needs it.':
    "t3 istemcilerinin, yalnızca HTTP geçiren güvenlik duvarları ve proxy'ler üzerinden server'a ulaşmasını sağlar. Bir istemcinin ihtiyacı yoksa kapalı bırakın.",
  'SSL port': 'SSL portu',
  'The HTTPS and t3s listener. It needs a working identity keystore — without one the server logs a keystore error at start-up and the SSL port stays closed.':
    "HTTPS ve t3s dinleyicisi. Çalışan bir kimlik keystore'u gerektirir — olmadığında server açılışta bir keystore hatası yazar ve SSL portu kapalı kalır.",
  'SSL port open': 'SSL portu açık',
  'Whether this server listens for HTTPS and t3s at all.': "Bu server'ın HTTPS ve t3s dinleyip dinlemeyeceği.",
  'The HTTPS port. It has to differ from the plain port above and from every other server on the same machine.':
    'HTTPS portu. Yukarıdaki düz porttan ve aynı makinedeki diğer bütün serverlardan farklı olmalıdır.',
  'Accept certificates that do not match the hostname': 'Sunucu adıyla eşleşmeyen sertifikaları kabul et',
  'Lets this server trust a certificate issued to a different name. Convenient with self-signed certificates in a test domain; in production it gives up a real protection against a man in the middle.':
    "Bu server'ın başka bir ada verilmiş bir sertifikaya güvenmesini sağlar. Test domain'lerinde kendinden imzalı sertifikalarla kullanışlıdır; production'da ise ortadaki adam saldırısına karşı gerçek bir korumadan vazgeçmek demektir.",
  'Start-up and shutdown': 'Açılış ve kapanış',
  'What the server does when it is started, and how patient a graceful shutdown is.':
    'Server başlatıldığında ne yaptığı ve düzgün kapanışın ne kadar sabırlı olduğu.',
  'State to start in': 'Başlangıç durumu',
  'RUNNING serves traffic immediately. ADMIN starts everything but refuses application requests until you resume it, which is useful when you want to check a server before it takes load.':
    "RUNNING trafiği hemen karşılar. ADMIN her şeyi başlatır, ancak siz sürdürene kadar uygulama isteklerini reddeder; bu, bir server'ı yük almadan önce kontrol etmek istediğinizde işe yarar.",
  'RUNNING — serve traffic as soon as it is up': 'RUNNING — ayağa kalkar kalkmaz trafiği karşıla',
  'ADMIN — start, but refuse application traffic': 'ADMIN — başlat, ancak uygulama trafiğini reddet',
  'STANDBY — listen on the administration port only': 'STANDBY — yalnızca yönetim portunu dinle',
  'Let Node Manager restart it after a crash': 'Çöktükten sonra Node Manager yeniden başlatsın',
  'Only has an effect for servers started by Node Manager, and it never restarts a server you shut down deliberately.':
    "Yalnızca Node Manager tarafından başlatılan server'larda etkilidir ve bilerek kapattığınız bir server'ı asla yeniden başlatmaz.",
  'Restart attempts allowed': 'İzin verilen yeniden başlatma denemesi',
  'How many times Node Manager retries within the window below before it gives up and leaves the server down.':
    "Node Manager'ın, vazgeçip server'ı kapalı bırakmadan önce aşağıdaki süre içinde kaç kez yeniden deneyeceği.",
  'Restart attempt window': 'Yeniden başlatma denemesi penceresi',
  'The period those attempts are counted over, so a server that keeps failing stops being restarted instead of looping forever.':
    'Bu denemelerin sayıldığı süre; böylece sürekli hata veren bir server sonsuza kadar döngüye girmek yerine yeniden başlatılmayı bırakır.',
  'seconds': 'saniye',
  'Graceful shutdown waits at most': 'Düzgün kapanış en fazla şu kadar bekler',
  'How long a graceful shutdown lets in-flight work finish before stopping anyway. 0 means wait as long as it takes, which is why a shutdown sometimes looks like it has hung.':
    'Düzgün bir kapanışın, yine de durmadan önce devam eden işlerin bitmesi için ne kadar beklediği. 0, ne kadar sürerse sürsün bekle demektir; kapanışın bazen takılmış gibi görünmesinin sebebi budur.',
  'Do not wait for HTTP sessions': "HTTP session'larını bekleme",
  'On, a graceful shutdown drops sessions instead of waiting for them to end. Safe where sessions are replicated across a cluster or the application does not rely on them.':
    "Açıkken düzgün kapanış, session'ların bitmesini beklemek yerine onları düşürür. Session'ların bir cluster'da replike edildiği ya da uygulamanın onlara dayanmadığı yerlerde güvenlidir.",
  'Stuck threads and request limits': 'Takılmış threadler ve istek sınırları',
  'When WebLogic decides a request thread is stuck, and how large a single request may be.':
    "WebLogic'in bir istek thread'ine ne zaman takılmış dediği ve tek bir isteğin ne kadar büyük olabileceği.",
  'Call a thread stuck after': 'Şu süreden sonra threade takılmış de',
  'A request thread busy for longer than this is logged as stuck and counted on the Monitoring page. Lower it to notice hangs sooner; raise it in domains with legitimately long jobs, or the log fills with false alarms.':
    "Bundan uzun süre meşgul kalan bir istek thread'i takılmış olarak loglanır ve İzleme sayfasında sayılır. Takılmaları daha erken fark etmek için düşürün; gerçekten uzun süren işleri olan domain'lerde ise yükseltin, yoksa log yanlış alarmlarla dolar.",
  'Check for stuck threads every': 'Takılmış threadleri şu aralıkla kontrol et',
  'How often that check runs. It is cheap, so the default rarely needs changing.':
    'Bu kontrolün hangi sıklıkla çalıştığı. Maliyeti düşüktür, bu yüzden varsayılanı nadiren değiştirmek gerekir.',
  'Largest accepted message': 'Kabul edilen en büyük mesaj',
  'The biggest single request the server accepts over HTTP and t3. Uploads above this are rejected before the application ever sees them.':
    "Server'ın HTTP ve t3 üzerinden kabul ettiği en büyük tek istek. Bunun üzerindeki yüklemeler, uygulama görmeden önce reddedilir.",
  'bytes': 'bayt',
  'Pending connection queue': 'Bekleyen bağlantı kuyruğu',
  'How many TCP connections the operating system may queue before the server accepts them. Raise it only if connections are refused during traffic spikes.':
    'Server kabul etmeden önce işletim sisteminin kaç TCP bağlantısını kuyruğa alabileceği. Yalnızca trafik sıçramalarında bağlantılar reddediliyorsa yükseltin.',
  'Java command line (Node Manager only)': 'Java komut satırı (yalnızca Node Manager)',
  'What Node Manager passes to the JVM when it starts this server. A server started from a shell script uses that script instead and ignores everything here.':
    "Node Manager bu server'ı başlatırken JVM'e neyi geçirdiği. Bir kabuk scriptinden başlatılan server bunun yerine o scripti kullanır ve buradaki her şeyi yok sayar.",
  'JVM arguments': 'JVM argümanları',
  'Extra options for the java command, for example -Xms2g -Xmx2g -XX:+UseG1GC. This is where heap size is set for a server that Node Manager starts.':
    "java komutu için ek seçenekler; örneğin -Xms2g -Xmx2g -XX:+UseG1GC. Node Manager'ın başlattığı bir server'da heap boyutu burada ayarlanır.",
  '-Xms1g -Xmx2g': '-Xms1g -Xmx2g',
  'Java home': 'Java home',
  'The JDK this server is started with. Empty means the one Node Manager itself runs on.':
    "Bu server'ın hangi JDK ile başlatıldığı. Boş olması, Node Manager'ın kendi çalıştığı JDK demektir.",
  'Classpath': 'Classpath',
  'Put in front of the server classpath. Usually empty — libraries belong in the domain lib directory or in a deployment.':
    "Server classpath'inin önüne eklenir. Genelde boştur — kütüphanelerin yeri domain lib dizini ya da bir deployment'tır.",
  'How cluster members find each other, and how load is spread across them.':
    'Cluster üyelerinin birbirini nasıl bulduğu ve yükün aralarında nasıl dağıtıldığı.',
  'How members find each other': 'Üyeler birbirini nasıl bulur',
  'Cluster members exchange heartbeats. Unicast is the modern default and works on networks where multicast is blocked.':
    'Cluster üyeleri birbirine heartbeat gönderir. Unicast modern varsayılandır ve multicast’in engellendiği ağlarda da çalışır.',
  'Messaging mode': 'Mesajlaşma modu',
  'Unicast sends heartbeats over TCP through a few chosen members. Multicast needs the network to forward multicast traffic, which most data centres no longer do.':
    "Unicast, heartbeat'leri seçilmiş birkaç üye üzerinden TCP ile gönderir. Multicast ise ağın multicast trafiğini iletmesini gerektirir; çoğu veri merkezi artık bunu yapmaz.",
  'unicast — TCP, works on any network': 'unicast — TCP, her ağda çalışır',
  'multicast — needs multicast enabled on the network': 'multicast — ağda multicast açık olmalıdır',
  'Cluster address': 'Cluster adresi',
  'The host:port list clients use to reach the cluster, for example ms1:7003,ms2:7003. It is handed out with t3 references; leave it empty to have WebLogic build one from the running members.':
    "İstemcilerin cluster'a ulaşmak için kullandığı sunucu:port listesi; örneğin ms1:7003,ms2:7003. t3 referanslarıyla birlikte dağıtılır; WebLogic'in bunu çalışan üyelerden kendi oluşturması için boş bırakın.",
  'ms1:7003,ms2:7003': 'ms1:7003,ms2:7003',
  'Members in a generated address': 'Üretilen adresteki üye sayısı',
  'When the cluster address is generated rather than typed, this is how many members go into it.':
    'Cluster adresi yazılmak yerine üretildiğinde, içine kaç üyenin gireceği.',
  'Multicast address': 'Multicast adresi',
  'Only used in multicast mode. Two clusters on the same network must not share an address and port, or they see each other’s heartbeats.':
    "Yalnızca multicast modunda kullanılır. Aynı ağdaki iki cluster bir adres ve portu paylaşmamalıdır; yoksa birbirinin heartbeat'lerini görürler.",
  'Multicast port': 'Multicast portu',
  'Only used in multicast mode.': 'Yalnızca multicast modunda kullanılır.',
  'Load balancing and front end': 'Yük dengeleme ve ön yüz',
  'How work is spread over the members, and the address the outside world sees.':
    'İşin üyeler arasında nasıl dağıtıldığı ve dış dünyanın gördüğü adres.',
  'Load balancing algorithm': 'Yük dengeleme algoritması',
  'Round robin is even and stateless. The affinity variants keep a client on the member it used last, which helps when the application caches per-user data in memory.':
    'Round robin eşit ve durumsuzdur. Affinity çeşitleri bir istemciyi en son kullandığı üyede tutar; bu, uygulama kullanıcı başına veriyi bellekte önbelleklediğinde işe yarar.',
  'round-robin — each member in turn': 'round-robin — sırayla her üye',
  'weight-based — by each member’s configured weight': 'weight-based — her üyenin tanımlı ağırlığına göre',
  'random': 'random',
  'round-robin-affinity — in turn, then stick to a member':
    'round-robin-affinity — sırayla, sonra bir üyeye sadık kal',
  'weight-based-affinity': 'weight-based-affinity',
  'random-affinity': 'random-affinity',
  'Front-end host': 'Ön yüz sunucusu',
  'The hostname users actually type, usually the load balancer. WebLogic uses it when it builds a redirect, so without it users get redirected to an internal server name they cannot reach.':
    'Kullanıcıların gerçekten yazdığı sunucu adı; genelde yük dengeleyici. WebLogic bir yönlendirme oluştururken bunu kullanır; bu yüzden boş olduğunda kullanıcılar erişemeyecekleri bir iç server adına yönlendirilir.',
  'shop.example.com': 'magaza.ornek.com',
  'Front-end HTTP port': 'Ön yüz HTTP portu',
  'The HTTP port on that front-end host. 0 means "do not rewrite the port".':
    'O ön yüz sunucusundaki HTTP portu. 0, "portu yeniden yazma" anlamına gelir.',
  'Front-end HTTPS port': 'Ön yüz HTTPS portu',
  'The HTTPS port on the front-end host, typically 443.': 'Ön yüz sunucusundaki HTTPS portu; genelde 443.',
  'Data sources': "Data source'lar",
  'Pool sizing, the test that keeps dead connections out, and the database URL.':
    'Havuz boyutlandırma, ölü bağlantıları dışarıda tutan test ve veritabanı adresi.',
  'Pool size': 'Havuz boyutu',
  'How many database connections this data source keeps, on each server it is targeted to.':
    "Bu data source'un, hedeflendiği her server'da kaç veritabanı bağlantısı tuttuğu.",
  'Connections created at start-up': 'Açılışta oluşturulan bağlantılar',
  'Opened while the server boots. A high number makes start-up slower but avoids a slow first request; if the database is down, the data source fails to deploy unless the retry setting below is on.':
    'Server açılırken oluşturulur. Yüksek bir sayı açılışı yavaşlatır ama ilk isteğin yavaş olmasını önler; veritabanı kapalıysa, aşağıdaki yeniden deneme ayarı açık değilse data source deploy edilemez.',
  'Connections kept when idle': 'Boştayken tutulan bağlantılar',
  'The pool never shrinks below this, so a quiet period does not force every connection to be opened again later.':
    'Havuz asla bunun altına inmez; böylece sakin bir dönem, sonradan bütün bağlantıların yeniden açılmasını gerektirmez.',
  'Maximum connections': 'En fazla bağlantı',
  'The ceiling. Requests queue once every connection is busy, so this is what to raise when the Data Sources page shows threads waiting — but the database has its own session limit, and going past that is worse.':
    "Üst sınır. Bütün bağlantılar meşgul olduğunda istekler kuyruğa girer; bu yüzden Data Source'lar sayfasında bekleyen threadler görünüyorsa yükseltilecek değer budur — ancak veritabanının da kendi oturum sınırı vardır ve onu aşmak daha kötüdür.",
  'Connections added at a time': 'Bir seferde eklenen bağlantı',

  // --------------------- settings catalogue: pools, deployments, logging, domain 
  'How many connections the pool opens at once when it has to grow.':
    'Havuz büyümek zorunda kaldığında bir seferde kaç bağlantı açacağı.',
  'Shrink back to the minimum every': 'Şu aralıkla asgariye küçült',
  'How often unused connections above the minimum are closed. 0 disables shrinking, so the pool stays at its high-water mark until the server restarts.':
    'Asgarinin üzerindeki kullanılmayan bağlantıların hangi sıklıkla kapatılacağı. 0 küçültmeyi kapatır; böylece havuz, server yeniden başlayana kadar ulaştığı en yüksek seviyede kalır.',
  'A request waits for a free connection': 'Bir istek boş bağlantıyı şu kadar bekler',
  'How long application code blocks when every connection is busy before it gets "No available connections in pool". -1 waits forever, 0 fails straight away.':
    'Bütün bağlantılar meşgulken uygulama kodunun, "No available connections in pool" hatasını almadan önce ne kadar bloke olacağı. -1 sonsuza kadar bekler, 0 anında hata verir.',
  'Reclaim a leaked connection after': 'Sızmış bağlantıyı şu süre sonra geri al',
  'Takes back a connection the application borrowed and never closed. 0 disables the check, which is how a leak can drain a pool with nothing in the log to show for it.':
    'Uygulamanın alıp hiç kapatmadığı bir bağlantıyı geri alır. 0 bu kontrolü kapatır; bir sızıntının, logda hiçbir iz bırakmadan havuzu tüketmesi böyle olur.',
  'Connection testing': 'Bağlantı testi',
  'What stops the pool handing a dead connection to the application after a database restart or a firewall timeout.':
    'Bir veritabanı yeniden başlatmasından veya güvenlik duvarı zaman aşımından sonra havuzun uygulamaya ölü bir bağlantı vermesini engelleyen şey.',
  'Test before handing a connection out': 'Bağlantıyı vermeden önce test et',
  'Costs one small round trip per checkout, and in exchange the application never receives a connection the database has already closed. Almost always worth it.':
    'Her alışta küçük bir gidiş-dönüşe mal olur; karşılığında uygulama, veritabanının çoktan kapattığı bir bağlantıyı asla almaz. Neredeyse her zaman buna değer.',
  'Test query': 'Test sorgusu',
  'A bare table name runs SELECT 1 FROM that table. Prefix a full statement with "SQL " — SQL SELECT 1 FROM DUAL on Oracle, SQL SELECT 1 on PostgreSQL and MySQL.':
    'Yalnızca bir tablo adı yazılırsa o tablo üzerinde SELECT 1 FROM çalıştırılır. Tam bir ifadeyi "SQL " ön ekiyle yazın — Oracle’da SQL SELECT 1 FROM DUAL, PostgreSQL ve MySQL’de SQL SELECT 1.',
  'SQL SELECT 1 FROM DUAL': 'SQL SELECT 1 FROM DUAL',
  'Test idle connections every': 'Boştaki bağlantıları şu aralıkla test et',
  'A background sweep that tests connections nobody is using and drops the broken ones. 0 turns the sweep off.':
    'Kimsenin kullanmadığı bağlantıları test edip bozuk olanları düşüren arka plan taraması. 0 taramayı kapatır.',
  'Skip the test for connections used within': 'Şu süre içinde kullanılan bağlantılarda testi atla',
  'A connection used this recently is handed out without testing. Raising it cuts test traffic; lowering it catches a database or firewall that drops connections quickly.':
    'Bu kadar yakın zamanda kullanılmış bir bağlantı test edilmeden verilir. Yükseltmek test trafiğini azaltır; düşürmek ise bağlantıları hızla düşüren bir veritabanını ya da güvenlik duvarını yakalar.',
  'Retry creating connections every': 'Bağlantı oluşturmayı şu aralıkla yeniden dene',
  'Lets a server start while the database is down: the data source deploys and keeps retrying instead of failing. 0 means no retry, which makes the database a start-up dependency.':
    "Veritabanı kapalıyken bir server'ın başlamasını sağlar: data source deploy edilir ve hata vermek yerine denemeyi sürdürür. 0 yeniden deneme yok demektir; bu da veritabanını açılış bağımlılığı hâline getirir.",
  'Prepared statement cache': 'Prepared statement önbelleği',
  'Reuses prepared statements per connection. It saves the database a parse, at the cost of one open cursor per cached statement.':
    'Prepared statementları bağlantı başına yeniden kullanır. Veritabanına bir ayrıştırma tasarrufu sağlar; karşılığında önbellekteki her ifade için bir açık cursor tutulur.',
  'Statements cached per connection': 'Bağlantı başına önbelleklenen ifade',
  'Multiply this by the maximum pool size to get the cursors this data source can hold open on the database. On Oracle, that product running past the open_cursors limit is the classic ORA-01000.':
    "Bunu havuzun üst sınırıyla çarparsanız, bu data source'un veritabanında açık tutabileceği cursor sayısını bulursunuz. Oracle'da bu çarpımın open_cursors sınırını aşması, klasik ORA-01000 hatasıdır.",
  'What to drop when the cache is full': 'Önbellek dolduğunda ne atılır',
  'LRU discards the statement used least recently. FIXED keeps the first statements it cached and never replaces them.':
    'LRU, en uzun süredir kullanılmayan ifadeyi atar. FIXED ise ilk önbelleklediği ifadeleri tutar ve hiç değiştirmez.',
  'LRU — drop the least recently used': 'LRU — en uzun süredir kullanılmayanı at',
  'FIXED — keep the first ones cached': 'FIXED — ilk önbelleklenenleri tut',
  'How this data source takes part in a transaction that spans more than one resource.':
    "Bu data source'un, birden çok kaynağa yayılan bir transaction'a nasıl katıldığı.",
  'Global transaction protocol': 'Global transaction protokolü',
  'TwoPhaseCommit needs an XA driver. LoggingLastResource lets a single non-XA database join a global transaction safely and is the usual choice. None keeps the data source out of global transactions entirely.':
    "TwoPhaseCommit bir XA sürücüsü gerektirir. LoggingLastResource, XA olmayan tek bir veritabanının global bir transaction'a güvenle katılmasını sağlar ve alışılmış seçim budur. None ise data source'u global transactionların tamamen dışında tutar.",
  'TwoPhaseCommit — full XA, needs an XA driver': 'TwoPhaseCommit — tam XA, XA sürücüsü gerekir',
  'LoggingLastResource — one non-XA database, safely': 'LoggingLastResource — XA olmayan tek veritabanı, güvenle',
  'EmulateTwoPhaseCommit — no XA, can lose atomicity': 'EmulateTwoPhaseCommit — XA yok, atomikliği kaybedebilir',
  'OnePhaseCommit — the default for a non-XA driver': 'OnePhaseCommit — XA olmayan sürücüler için varsayılan',
  'None — never joins a global transaction': "None — global transaction'a hiç katılmaz",
  'Database connection': 'Veritabanı bağlantısı',
  'Where this data source connects and with which driver. Both affect every application using it, so press Test on the Data Sources page once the change is live.':
    "Bu data source'un nereye ve hangi sürücüyle bağlandığı. İkisi de onu kullanan bütün uygulamaları etkiler; bu yüzden değişiklik canlıya geçtiğinde Data Source'lar sayfasındaki Test düğmesine basın.",
  'Database URL': 'Veritabanı adresi',
  'The JDBC URL, for example jdbc:oracle:thin:@//db1:1521/ORCLPDB1. The database user and password are not changed here.':
    'JDBC adresi; örneğin jdbc:oracle:thin:@//db1:1521/ORCLPDB1. Veritabanı kullanıcısı ve parolası buradan değiştirilmez.',
  'Driver class': 'Sürücü sınıfı',
  'The JDBC driver class. It has to be on the server classpath, otherwise the data source fails to deploy with a ClassNotFoundException.':
    "JDBC sürücü sınıfı. Server classpath'inde bulunmalıdır; aksi hâlde data source ClassNotFoundException ile deploy edilemez.",
  'Start order, how the archive and its plan reach the servers, which security model the application runs under, and where its files are.':
    "Başlangıç sırası, arşivin ve planının server'lara nasıl ulaştığı, uygulamanın hangi güvenlik modeliyle çalıştığı ve dosyalarının nerede olduğu.",
  'Order and staging': 'Sıra ve staging',
  'When this application is deployed relative to the others, and how its files get to each target server.':
    "Bu uygulamanın diğerlerine göre ne zaman deploy edildiği ve dosyalarının her target server'a nasıl ulaştığı.",
  'Deployment order': 'Deployment sırası',
  'Lower numbers deploy first and 100 is the default. Use it when one application has to be up before another can initialise — a shared service before the applications that call it, say.':
    'Küçük numaralar önce deploy edilir; varsayılan 100’dür. Bir uygulamanın, diğeri başlayabilmesi için önce ayakta olması gerektiğinde kullanın — örneğin onu çağıran uygulamalardan önce paylaşılan bir servis.',
  'How the archive reaches the servers': "Arşiv server'lara nasıl ulaşır",
  'stage copies the archive to each server before deploying, which is what you want when servers live on different machines. nostage deploys from the same path on every server, so the file has to exist there — typically a shared mount. Getting this wrong shows up as a deployment that works on the AdminServer and fails everywhere else.':
    "stage, deploy etmeden önce arşivi her server'a kopyalar; server'lar farklı makinelerdeyse isteyeceğiniz budur. nostage, her server'da aynı yoldan deploy eder; dolayısıyla dosyanın orada bulunması gerekir — genelde paylaşımlı bir bağlama noktası. Bunu yanlış seçmek, AdminServer'da çalışıp başka her yerde başarısız olan bir deployment olarak karşınıza çıkar.",
  'How the plan reaches the servers': "Plan server'lara nasıl ulaşır",
  'The same choice for the deployment plan. Left empty it follows the archive, which is nearly always right; set it only when the plan lives somewhere the archive does not.':
    'Deployment planı için aynı seçim. Boş bırakıldığında arşivi izler; neredeyse her zaman doğru olan budur. Yalnızca plan, arşivin bulunmadığı bir yerdeyse doldurun.',
  'Follow the archive (default)': 'Arşivi izle (varsayılan)',
  'Deployment plan and descriptors': 'Deployment planı ve descriptorlar',
  'A plan is how the same archive runs in test and in production without being rebuilt: it overrides values in the descriptors that were packaged with it.':
    "Plan, aynı arşivin yeniden derlenmeden hem test'te hem production'da çalışmasını sağlayan şeydir: arşivle birlikte paketlenmiş descriptor'lardaki değerleri ezer.",
  'Deployment plan': 'Deployment planı',
  'Path to the plan XML that overrides descriptor values for this environment — JDBC names, EJB pool sizes, context roots. Empty means the archive is deployed exactly as it was built.':
    "Bu ortam için descriptor değerlerini ezen plan XML'inin yolu — JDBC adları, EJB havuz boyutları, context root'lar. Boş olması, arşivin derlendiği gibi deploy edildiği anlamına gelir.",
  'empty — no plan': 'boş — plan yok',
  'Plan directory': 'Plan dizini',
  'Where the plan and any external descriptors it references live. Usually the directory holding the plan file; needed when a plan brings its own descriptor files with it.':
    "Planın ve referans aldığı dış descriptor'ların bulunduğu yer. Genelde plan dosyasının olduğu dizindir; bir plan kendi descriptor dosyalarını da getirdiğinde gerekir.",
  'empty — the plan file’s own directory': 'boş — plan dosyasının kendi dizini',
  'Alternate Java EE descriptor': 'Alternatif Java EE descriptor’ı',
  'Deploys with a different application.xml or web.xml than the one inside the archive. Rare, and a deployment plan is usually the better answer — but it is how you deploy an archive you cannot rebuild.':
    'Arşivin içindekinden farklı bir application.xml veya web.xml ile deploy eder. Nadirdir ve genelde deployment planı daha iyi cevaptır — ancak yeniden derleyemediğiniz bir arşivi böyle deploy edersiniz.',
  'empty — use the descriptor in the archive': "boş — arşivdeki descriptor'ı kullan",
  'Alternate WebLogic descriptor': 'Alternatif WebLogic descriptor’ı',
  'The same thing for weblogic-application.xml or weblogic.xml — the WebLogic-specific half of the configuration.':
    "weblogic-application.xml veya weblogic.xml için aynı şey — yapılandırmanın WebLogic'e özgü yarısı.",
  'Security model': 'Güvenlik modeli',
  'Where this application’s roles and policies come from: the descriptors it was built with, or the domain’s security realm.':
    "Bu uygulamanın rollerinin ve politikalarının nereden geldiği: derlendiği descriptor'lar ya da domain'in güvenlik realm'i.",
  'Roles and policies come from': 'Roller ve politikalar nereden gelir',
  'DD only takes both from the descriptors in the archive and ignores anything set in the realm. Custom roles lets the realm define who is in a role while the archive still decides what each role may do. Custom roles and policies puts both in the realm — that is the one to pick when access has to be changed without a rebuild. Advanced follows the realm’s own configuration. Changing this discards role and policy data that came from the other model, so read it before switching on a live application.':
    "DD only, ikisini de arşivdeki descriptor'lardan alır ve realm'de tanımlı olanı yok sayar. Custom roles, bir rolde kimin olduğunu realm'in belirlemesine izin verirken her rolün ne yapabileceğine arşiv karar vermeye devam eder. Custom roles and policies ikisini de realm'e koyar — erişimin yeniden derleme olmadan değiştirilmesi gerektiğinde seçilecek olan budur. Advanced ise realm'in kendi yapılandırmasını izler. Bunu değiştirmek, diğer modelden gelen rol ve politika verisini atar; bu yüzden canlı bir uygulamada değiştirmeden önce okuyun.",
  'DD only — everything from the archive’s descriptors (default)':
    "DD only — her şey arşivin descriptor'larından (varsayılan)",
  'Custom roles — roles from the realm, policies from the archive':
    "Custom roles — roller realm'den, politikalar arşivden",
  'Custom roles and policies — both from the realm': "Custom roles and policies — ikisi de realm'den",
  'Advanced — as configured in the security realm': "Advanced — güvenlik realm'inde yapılandırıldığı gibi",
  'Check the descriptors’ security data on deploy': "Deploy sırasında descriptor'ların güvenlik verisini kontrol et",
  'Validates the roles and policies in the descriptors as the application deploys. It catches a principal that does not exist at deployment time rather than at the first request that needs it.':
    "Uygulama deploy edilirken descriptor'lardaki rolleri ve politikaları doğrular. Var olmayan bir principal'ı, ona ihtiyaç duyan ilk istekte değil, deployment anında yakalar.",
  'Deploy as user': 'Şu kullanıcı olarak deploy et',
  'The user this application is deployed and started as when a server boots. Empty means the server’s own identity, which is the usual case. Set it when the application reads files or resources only a particular account may reach.':
    "Bir server açılırken bu uygulamanın hangi kullanıcı olarak deploy edilip başlatılacağı. Boş olması, alışılmış durum olan server'ın kendi kimliği demektir. Uygulama yalnızca belirli bir hesabın erişebildiği dosya veya kaynakları okuyorsa doldurun.",
  'empty — the server’s own identity': "boş — server'ın kendi kimliği",
  'Where the files are': 'Dosyalar nerede',
  'Resolved by the AdminServer, and read-only here: moving an application means deploying it again, not editing a path.':
    'AdminServer tarafından çözümlenir ve burada salt okunurdur: bir uygulamayı taşımak, bir yolu düzenlemek değil, yeniden deploy etmek demektir.',
  'Archive path': 'Arşiv yolu',
  'The path as it was given when the application was deployed. Relative paths are resolved against the domain directory.':
    'Uygulama deploy edilirken verilen hâliyle yol. Göreli yollar domain dizinine göre çözümlenir.',
  'Archive path, resolved': 'Arşiv yolu, çözümlenmiş',
  'The full path the AdminServer resolved that to. This is the first thing to check when a deployment fails with a file-not-found on one server only.':
    "AdminServer'ın bunu çözümlediği tam yol. Bir deployment yalnızca tek bir server'da dosya bulunamadı hatası veriyorsa ilk bakılacak yer burasıdır.",
  'Plan path, resolved': 'Plan yolu, çözümlenmiş',
  'The full path of the deployment plan actually in use, if there is one.':
    'Varsa, fiilen kullanılan deployment planının tam yolu.',
  'Install directory': 'Kurulum dizini',
  'Set when the application follows the installation-directory layout, with app/ and plan/ subdirectories. Empty for a plain archive deployment.':
    'Uygulama, app/ ve plan/ alt dizinleriyle kurulum dizini düzenini izliyorsa doldurulur. Düz bir arşiv deployment’ında boştur.',
  'Module type': 'Modül türü',
  'war for a web application, ear for an enterprise application, jar for an EJB module, rar for a resource adapter.':
    'Web uygulaması için war, kurumsal uygulama için ear, EJB modülü için jar, resource adapter için rar.',
  'Version': 'Sürüm',
  'The version this deployment carries, if it was built with one. Versioned applications can be deployed side by side, with the older one retiring as its sessions finish.':
    "Bu deployment'ın taşıdığı sürüm; varsa. Sürümlü uygulamalar yan yana deploy edilebilir; eski olan, session'ları bittikçe emekliye ayrılır.",
  'Logging': 'Loglama',
  'Each server’s log file, its rotation, and how much detail every destination gets.':
    "Her server'ın log dosyası, döndürmesi ve her hedefin ne kadar ayrıntı aldığı.",
  'Log file and rotation': 'Log dosyası ve döndürme',
  'The file this server writes, and when a new one is started.':
    "Bu server'ın yazdığı dosya ve ne zaman yenisine geçildiği.",
  'How much gets logged, and where': 'Ne kadarının, nereye loglandığı',
  'A message reaches a destination only if it is at least as severe as that destination’s level. Debug and Trace can produce gigabytes an hour on a busy server.':
    "Bir mesaj, ancak o hedefin seviyesi kadar ciddiyse hedefe ulaşır. Debug ve Trace, yoğun bir server'da saatte gigabaytlarca çıktı üretebilir.",
  'Overall floor': 'Genel alt sınır',
  'Nothing below this level is produced at all, whatever the destinations below ask for. This is the setting to lower first when a Debug level elsewhere seems to be ignored.':
    'Aşağıdaki hedefler ne isterse istesin, bu seviyenin altındaki hiçbir şey üretilmez. Başka bir yerdeki Debug seviyesi yok sayılıyor gibi görünüyorsa ilk düşürülecek ayar budur.',
  'Written to the log file': 'Log dosyasına yazılan',
  'What ends up in the server log file, and therefore in the Logs page.':
    'Server log dosyasına, dolayısıyla Loglar sayfasına neyin düştüğü.',
  'Printed to standard out': 'Standart çıktıya yazılan',
  'What appears on the console or in nohup.out. Info is normal; Debug here slows a server down through terminal output alone.':
    "Konsolda veya nohup.out dosyasında ne göründüğü. Info normaldir; buradaki Debug, tek başına terminal çıktısı yüzünden bile bir server'ı yavaşlatır.",
  'Forwarded to the domain log': 'Domain loguna iletilen',
  'Messages this severe or worse are also sent to the AdminServer’s domain-wide log. Lowering it across a large domain puts real load on the AdminServer.':
    "Bu ciddiyette veya daha kötü mesajlar AdminServer'ın domain geneli loguna da gönderilir. Büyük bir domain'de bunu düşürmek AdminServer'a ciddi yük bindirir.",
  'Standard output': 'Standart çıktı',
  'What happens to what the application prints itself.': 'Uygulamanın kendi yazdıklarına ne olduğu.',
  'Capture System.out into the server log': 'System.out çıktısını server loguna al',
  'On, anything the application prints also lands in the server log, where the Logs page can search it — instead of only in the terminal that started the server.':
    "Açıkken uygulamanın yazdığı her şey server loguna da düşer ve Loglar sayfasından aranabilir — yalnızca server'ı başlatan terminalde kalmak yerine.",
  'Print stack traces to standard out': 'Stack trace’leri standart çıktıya yaz',
  'Off, standard out shows only the message of an exception and the stack stays in the log file.':
    'Kapalıyken standart çıktı yalnızca exception mesajını gösterir; stack, log dosyasında kalır.',
  'Domain': 'Domain',
  'Settings that apply to the whole domain, including the domain-wide log.':
    'Domain geneli log dâhil, bütün domaini ilgilendiren ayarlar.',
  'Whole-domain switches — the ones worth reading twice before changing.':
    'Domain geneli anahtarlar — değiştirmeden önce iki kez okumaya değer olanlar.',
  'Domain name': 'Domain adı',
  'Fixed when the domain was created.': 'Domain oluşturulurken belirlenmiştir.',
  'Production mode': 'Production modu',
  'Production mode requires the configuration lock for every change and turns off auto-deployment. Switching it needs every server in the domain restarted, so it is read-only here.':
    "Production modu her değişiklik için yapılandırma kilidini zorunlu kılar ve otomatik deployment'ı kapatır. Değiştirmek domain'deki bütün server'ların yeniden başlatılmasını gerektirdiğinden burada salt okunurdur.",
  'Administration port': 'Yönetim portu',
  'Moves all administration traffic onto one SSL port, separate from application traffic. It requires SSL configured on every server — without that, the domain is unmanageable after the restart.':
    "Bütün yönetim trafiğini, uygulama trafiğinden ayrı tek bir SSL portuna taşır. Her server'da SSL yapılandırılmış olmasını gerektirir — aksi hâlde domain yeniden başlatmadan sonra yönetilemez hâle gelir.",
  'Administration port number': 'Yönetim portu numarası',
  'The port used when the administration port is on. Every server in the domain shares this number.':
    "Yönetim portu açıkken kullanılan port. Domain'deki bütün server'lar bu numarayı paylaşır.",
  'Audit configuration changes': 'Yapılandırma değişikliklerini denetle',
  'Records who changed what. "log" writes to the server log, "audit" sends it to the auditing provider, "logaudit" does both.':
    'Kimin neyi değiştirdiğini kaydeder. "log" server loguna yazar, "audit" denetim provider’ına gönderir, "logaudit" ikisini de yapar.',
  'none — do not record changes': 'none — değişiklikleri kaydetme',
  'log — write changes to the server log': 'log — değişiklikleri server loguna yaz',
  'audit — send to the auditing provider': 'audit — denetim provider’ına gönder',
  'logaudit — both': 'logaudit — ikisi birden',
  'Classic WebLogic console': 'Klasik WebLogic konsolu',
  'Whether the AdminServer serves /console. This console talks to the REST API instead, so it keeps working either way.':
    "AdminServer'ın /console adresini sunup sunmadığı. Bu konsol bunun yerine REST API ile konuşur, dolayısıyla her hâlükârda çalışmaya devam eder.",
  'Domain log': 'Domain logu',
  'The combined log on the AdminServer that collects what every server broadcasts.':
    "AdminServer üzerinde, bütün server'ların yaydığını toplayan birleşik log.",

  // ----------------------------------------------------------- alerts: last rule 
  'Running server reports unhealthy': 'Çalışan server sağlıksız bildirirse',
}
