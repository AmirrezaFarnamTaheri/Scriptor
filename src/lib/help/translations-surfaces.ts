import { body, type GuideTranslations } from './translationTypes.ts'

/** Authored translations of workspace, recovery, and operational guidance. */
export const surfaceTranslations: GuideTranslations = {
  integrations: {
    de: body('Integrationen, Konten und Anbieter einrichten', 'Einstellungen > Integrationen.', 'Je nach Integration sind ein Tresor, die Desktop-App, Netzwerk, Zugangsdaten oder eine aktivierte Funktion nötig.', 'Das Öffnen liest nur. Konto verbinden, Schlüssel speichern, Anbieter aktivieren und Zugriffsrechte erteilen sind eigene ausdrückliche Aktionen.', [
      ['Mit der Aufgabe beginnen', 'Wählen Sie einen Anbieter für einen konkreten Arbeitsablauf. Lesen Sie vor dem Verbinden Reifegrad und Voraussetzungen.'],
      ['Konfiguration und Berechtigung unterscheiden', 'Lokal gespeicherte Endpunkte, Client-IDs, Modellnamen oder Tresoroptionen belegen keine externe Anmeldung oder Autorisierung.'],
      ['Gezielten Zugriff erlauben', 'Google, KI, Gmail, MCP und Plugins verwenden verschiedene Rechte und Zugangsdaten. Lesen Sie vor der Freigabe die jeweilige Anleitung.'],
      ['Verbindung praktisch prüfen', 'Führen Sie nach der Einrichtung einen kleinen Lese- oder Entwurfsvorgang aus und prüfen Sie den Kontostatus. Gespeicherte Felder beweisen keine erfolgreiche Anmeldung oder Synchronisierung.'],
    ], [['Warum gibt es eigene Google- und KI-Anleitungen?', 'Diese Übersicht erklärt gemeinsame Grundsätze. Anbieter unterscheiden sich bei Zugangsdaten, Rechten, Netzwerk und Fehlerbehebung.'], ['Sendet das Öffnen Daten?', 'Nein. Erst eine ausdrücklich gewählte Verbindung, Zugangsdaten-Speicherung, Synchronisierung oder Anfrage kommuniziert mit dem jeweiligen Anbieter.']]),
    fa: body('راه‌اندازی یکپارچه‌سازی‌ها، حساب‌ها و ارائه‌دهندگان', 'تنظیمات > یکپارچه‌سازی‌ها.', 'بسته به قابلیت، مخزن باز، برنامهٔ دسکتاپ، شبکه، اطلاعات ورود یا قابلیت فعال لازم است.', 'باز کردن این بخش فقط خواندنی است. اتصال حساب، ذخیرهٔ کلید، فعال‌سازی ارائه‌دهنده و دادن مجوز هرکدام عمل صریح جداگانه‌اند.', [
      ['از کار مورد نیاز شروع کنید', 'ارائه‌دهنده را برای گردش کار مشخص انتخاب کنید و پیش از اتصال، وضعیت بلوغ و پیش‌نیازهایش را بخوانید.'],
      ['تنظیم را از اختیار جدا کنید', 'ذخیرهٔ محلی نشانی، شناسهٔ کارخواه، نام مدل یا گزینهٔ مخزن، اتصال یا مجوز حساب بیرونی را ثابت نمی‌کند.'],
      ['مجوز محدود بدهید', 'Google، هوش مصنوعی، Gmail، MCP و افزونه‌ها دامنهٔ مجوز و اطلاعات ورود متفاوت دارند. پیش از تأیید، راهنمای همان ارائه‌دهنده را بخوانید.'],
      ['ارتباط واقعی را بیازمایید', 'پس از تنظیم، خواندن یا پیش‌نویس کوچکی انجام دهید و وضعیت حساب را بررسی کنید. ذخیرهٔ یک فیلد نشانهٔ موفقیت ورود یا همگام‌سازی نیست.'],
    ], [['چرا Google و هوش مصنوعی راهنمای جدا دارند؟', 'این بخش اصول مشترک را توضیح می‌دهد؛ اطلاعات ورود، مجوز، رفتار شبکه و بازیابی هر ارائه‌دهنده متفاوت است.'], ['باز کردن این بخش داده‌ای می‌فرستد؟', 'خیر. ارتباط بیرونی با عمل صریح اتصال، ذخیرهٔ اطلاعات ورود، همگام‌سازی یا درخواست مربوط به همان یکپارچه‌سازی آغاز می‌شود.']]),
  },
  'workspace-chrome': {
    de: body('Arbeitsbereich und Kopfleistenaktionen anpassen', 'Anpassen in der Kopfleiste oder Einstellungen > Arbeitsbereich.', 'Keine Tresoränderung und kein externer Dienst nötig.', 'Die Optionen ändern lokale Sichtbarkeit und Anordnung. Ausblenden beendet keine Aufgabe und entzieht keine Berechtigung.', [
      ['Dauerhaft sichtbare Aktionen wählen', 'Lassen Sie Navigation, Suche, Hilfe und häufige Aktionen sichtbar. Blenden Sie seltene Starter aus, damit die Kopfleiste übersichtlich bleibt.'],
      ['Ausgeblendete Aktionen wiederfinden', 'Öffnen Sie Anpassen über den Schieberegler oder die Arbeitsbereichseinstellungen. Unterstützte Aktionen bleiben im zuständigen Panel, der Befehlspalette oder per Tastenkürzel erreichbar.'],
      ['Seitenbereiche ausbalancieren', 'Seitenleiste und Inspektor sind Anzeigepräferenzen. Einklappen schafft Schreibraum; erneutes Öffnen erstellt oder lädt keine Notizen neu.'],
      ['Enge Anordnung wiederherstellen', 'Nutzen Sie Standardwerte oder eine bekannte Vorlage bei schmalen Fenstern, Zoom oder vielen fixierten Aktionen. Prüfen Sie, dass der Editor erreichbar bleibt.'],
    ], [['Deaktiviert das Ausblenden die Graph-Funktion?', 'Nein. Es entfernt nur den sichtbaren Starter. Funktionsfreigabe, Plugin-Rechte und Panel-Sichtbarkeit sind getrennt.'], ['Warum erscheinen nur Symbole?', 'Die responsive Anordnung schützt bei schmalen Fenstern und hohem Zoom den Schreibraum. Zugängliche Namen und Befehlspalette bleiben verfügbar.']]),
    fa: body('تنظیم نمای فضای کار و دکمه‌های نوار بالا', 'کنترل شخصی‌سازی نوار بالا یا تنظیمات > فضای کار.', 'تغییر مخزن یا خدمت بیرونی لازم نیست.', 'این گزینه‌ها فقط نمایش و چیدمان محلی را تغییر می‌دهند. پنهان کردن دکمه، قابلیت یا کار پس‌زمینه را متوقف نمی‌کند و مجوز را پس نمی‌گیرد.', [
      ['دکمه‌های همیشگی را انتخاب کنید', 'پیمایش، جست‌وجو، راهنما و کارهای پرتکرار را نمایان نگه دارید. دکمه‌های کم‌استفاده را پنهان کنید تا نوار بالا شلوغ نشود.'],
      ['دکمهٔ پنهان را برگردانید', 'شخصی‌سازی را از کنترل لغزنده یا تنظیمات فضای کار باز کنید. عمل پنهان، در صورت پشتیبانی، از پنل اصلی، پالت فرمان یا میان‌بر قابل دسترسی است.'],
      ['تعادل نوارهای کناری را تنظیم کنید', 'نمایش نوار کناری و بازرس ترجیح رابط است. جمع کردن نوار جا برای نوشتن می‌دهد؛ باز کردن دوباره یادداشت را بازسازی یا بارگذاری نمی‌کند.'],
      ['چیدمان فشرده را بازیابی کنید', 'در پنجرهٔ باریک، بزرگ‌نمایی یا دکمه‌های زیاد، پیش‌فرض یا الگوی شناخته‌شده را برگردانید. پیش از ادامه، دسترسی به ویرایشگر را بررسی کنید.'],
    ], [['پنهان کردن گراف، قابلیت گراف را خاموش می‌کند؟', 'خیر. فقط دکمهٔ ثابتش حذف می‌شود؛ فعال بودن قابلیت، مجوز افزونه و نمایش پنل وضعیت‌های جدا هستند.'], ['چرا برخی کنترل‌ها فقط نماد دارند؟', 'چیدمان پاسخ‌گو در عرض کم یا بزرگ‌نمایی زیاد فضای نوشتن را حفظ می‌کند. نام دسترس‌پذیر و پالت فرمان همچنان در دسترس‌اند.']]),
  },
  docks: {
    de: body('Panels, Andocken, Größen und Anordnung', 'Darstellungs- und Layoutsteuerung; Schalter für Seitenleiste und Inspektor.', 'Der verfügbare Platz bestimmt, ob ein Panel andockt oder als Dialog erscheint.', 'Anordnung ist eine Anzeigepräferenz. Ein verborgenes Panel behält Aufgaben, Daten und Berechtigungen.', [
      ['Darstellung wählen', 'Nutzen Sie einen Dialog für konzentrierte Arbeit oder, wo unterstützt, ein angedocktes Begleitpanel. Enge Fenster können stattdessen einen Dialog anzeigen.'],
      ['Platz für den Editor erhalten', 'Ein Begleitpanel kann vorübergehend den Inspektor ersetzen. Schließen stellt den ursprünglichen Seitenbereich wieder her.'],
      ['Zugänglich skalieren', 'Nutzen Sie unterstützte Trennleisten und prüfen Sie Fokus und Tastaturbedienung. Wichtige Texte müssen lesbar bleiben.'],
      ['Anordnung wiederherstellen', 'Wählen Sie eine bekannte Vorlage oder setzen Sie Layoutpräferenzen zurück, wenn Panels fehlen oder zu eng sind. Dokumentinhalt bleibt erhalten.'],
    ], [['Warum ändert sich Andocken bei kleinen Fenstern?', 'Die Anwendung reserviert Schreibraum und ordnet Bereiche bei begrenzter Breite oder Zoom neu an.'], ['Wo finde ich Hilfe für ein angedocktes Panel?', 'Drücken Sie darin F1 oder öffnen Sie den globalen Hilfeeintrag. Dieselbe Anleitung gilt für Dialog und angedockte Ansicht.']]),
    fa: body('پنل‌ها، اتصال کناری، اندازه و چیدمان', 'کنترل نمایش و چیدمان پنل؛ کلیدهای نوار کناری و بازرس.', 'فضای موجود تعیین می‌کند پنل کنار صفحه قرار گیرد یا به شکل گفت‌وگو باز شود.', 'تغییر چیدمان ترجیح نمایشی است. پنهان شدن پنل، کارها، داده‌ها و مجوزهایش را حذف نمی‌کند.', [
      ['نوع نمایش را انتخاب کنید', 'برای کار متمرکز از گفت‌وگو و برای نمای همراه از اتصال کناریِ پشتیبانی‌شده استفاده کنید. پنجرهٔ باریک ممکن است پنل را به گفت‌وگو تبدیل کند.'],
      ['فضای ویرایشگر را حفظ کنید', 'پنل همراه ممکن است موقتاً جای بازرس را بگیرد. بستن آن نوار قبلی را برمی‌گرداند.'],
      ['اندازه را دسترس‌پذیر تغییر دهید', 'از جداکنندهٔ پشتیبانی‌شده استفاده کنید و فوکوس و صفحه‌کلید را بیازمایید. متن مهم را بیش از حد کوچک نکنید.'],
      ['چیدمان را بازیابی کنید', 'اگر پنل‌ها گم یا فشرده شدند، الگوی شناخته‌شده یا بازنشانی چیدمان را به کار ببرید. محتوای سند بازنشانی نمی‌شود.'],
    ], [['چرا اتصال کناری در پنجرهٔ کوچک تغییر کرد؟', 'برنامه فضای کافی برای نوشتن نگه می‌دارد و در عرض کم یا بزرگ‌نمایی چیدمان را تغییر می‌دهد.'], ['راهنمای پنل کناری کجاست؟', 'داخل پنل F1 را بزنید یا راهنمای سراسری را باز کنید. راهنما برای نمایش گفت‌وگو و کناری یکسان است.']]),
  },
  status: {
    de: body('Statusleiste und Hintergrundarbeit', 'Untere Statusleiste und Dokumentstatistik.', 'Lesen Sie Anzeige, Beschriftung und Geltungsbereich gemeinsam.', 'Index bereit, gespeichert, Git sauber und Export erfolgreich sind getrennte Aussagen. Ein grünes Symbol belegt nicht alle.', [
      ['Subsystem erkennen', 'Unterscheiden Sie Dokument-Speicherzustand, Index, Git, Anbieter-Synchronisierung und Exportaufgaben.'],
      ['Ergebnis abwarten', 'Warteschlange und Ausführung bedeuten keinen Erfolg. Starten Sie bei normalem Fortschritt keine doppelte Aufgabe.'],
      ['Details öffnen', 'Lesen Sie bei Fehlern Probleme, Aufgabendetails oder Diagnose und bewahren Sie die tatsächliche Meldung auf.'],
      ['Wiederherstellung prüfen', 'Prüfen Sie nach einem erneuten Versuch die betroffene Quelle oder Ausgabe; ein verschwundenes Fehlersymbol allein reicht nicht.'],
    ], [['Bedeutet ein bereiter Index, dass die letzte Änderung gespeichert ist?', 'Nein. Index und Dokument-Speicherung haben getrennte Zustände und Verantwortliche.'], ['Warum unterscheiden sich Wortzahlen von Notiz und Tresor?', 'Sie haben unterschiedliche Geltungsbereiche und können zu verschiedenen Zeiten aktualisiert werden.']]),
    fa: body('نوار وضعیت و کار پس‌زمینه', 'نوار وضعیت پایین و آمار سند.', 'هر نشانگر را همراه برچسب و دامنه‌اش بخوانید.', 'آماده بودن نمایه، ذخیره شدن، پاک بودن Git و موفقیت خروجی ادعاهای جدا هستند. یک نشان سبز همه را ثابت نمی‌کند.', [
      ['زیرسامانه را مشخص کنید', 'وضعیت ذخیرهٔ سند، نمایه‌سازی، Git، همگام‌سازی ارائه‌دهنده و کار خروجی را از هم جدا کنید.'],
      ['منتظر نتیجه بمانید', 'صف یا در حال اجرا به معنی موفقیت نیست. تا پیشرفت عادی ادامه دارد فرمان تکراری ندهید.'],
      ['جزئیات را باز کنید', 'برای خطا به مشکلات، اطلاعات کار یا عیب‌یابی بروید و پیام دقیق را نگه دارید.'],
      ['بازیابی را تأیید کنید', 'پس از تلاش دوباره، منبع یا خروجی مربوط را بررسی کنید؛ ناپدید شدن نشان خطا کافی نیست.'],
    ], [['آماده بودن نمایه یعنی آخرین ویرایش ذخیره شده؟', 'خیر. نمایه و نگهداری سند مسئول و وضعیت جدا دارند.'], ['چرا شمار واژهٔ یادداشت و مخزن متفاوت است؟', 'دامنهٔ متفاوت دارند و ممکن است در زمان‌های متفاوت به‌روز شوند.']]),
  },
  'activity-output': {
    de: body('Aktivitätsausgabe und Vorgangsmeldungen', 'Ausgabe im unteren Statusbereich.', 'Öffnen Sie Ausgabe nach Fortschrittsmeldungen von Speichern, Export, Anbieter oder Hintergrundaufgaben.', 'Das Protokoll belegt einzelne Vorgänge. Prüfen Sie die entstandene Notiz, Datei, das Konto oder Subsystem, bevor Sie dem Ergebnis vertrauen.', [
      ['Absender bestimmen', 'Lesen Sie Zeit, Meldung und Details zusammen, um Git-, Export-, Anbieter-, Tresor- und Indexereignisse richtig zuzuordnen.'],
      ['Laufende Arbeit verfolgen', 'Exportausgabe kann sich während der Ausführung ändern. Warten Sie auf den endgültigen Aufgabenstatus, bevor Sie einen Vorgang erneut starten.'],
      ['Fehler aufbewahren', 'Bewahren Sie genaue Meldung und Details zur Diagnose auf. Löschen oder Einklappen der Ausgabe behebt keine Ursache.'],
      ['Ergebnis außerhalb des Protokolls prüfen', 'Öffnen Sie nach einem erneuten Versuch die betroffene Notiz, Datei, Exportausgabe, Integration oder Diagnose.'],
    ], [['Wie unterscheidet sich Ausgabe von Problemen?', 'Ausgabe zeigt zeitliche Aktivitäten und Vorgangsdetails. Probleme sammelt aktuell zu bearbeitende Diagnosen.'], ['Belegt eine Erfolgsmeldung die Gesundheit aller Systeme?', 'Nein. Sie bestätigt nur den meldenden Vorgang. Speichern, Index, Git, Integration und Export haben eigene Zustände.'], ['Darf ich Ausgabe leeren?', 'Sie ist abgeleitete Sitzungsevidenz. Bewahren Sie benötigte Fehlermeldungen vor Leeren oder Neustart auf.']]),
    fa: body('خروجی فعالیت و پیام عملیات', 'زبانهٔ خروجی در پنل وضعیت پایین.', 'پس از گزارش پیشرفت عملیات، ارائه‌دهنده، خروجی، ذخیره یا کار پس‌زمینه، خروجی را باز کنید.', 'این بخش گزارش فعالیت است؛ پیام موفقیت فقط همان عملیات را ثابت می‌کند. نتیجه را در یادداشت، فایل، حساب یا زیرسامانه هم بررسی کنید.', [
      ['منبع پیام را مشخص کنید', 'زمان، پیام و جزئیات را با هم بخوانید تا گزارش Git، خروجی، ارائه‌دهنده، مخزن یا نمایه به قابلیت دیگری نسبت داده نشود.'],
      ['کار جاری را دنبال کنید', 'خروجی صادرات هنگام اجرا به‌روز می‌شود. پیش از تکرار عملیات منتظر وضعیت نهایی کار مسئول بمانید.'],
      ['خطای مفید را نگه دارید', 'پیام و جزئیات دقیق را برای عیب‌یابی حفظ کنید. پاک کردن یا جمع کردن خروجی علت خطا را اصلاح نمی‌کند.'],
      ['بیرون از گزارش تأیید کنید', 'پس از تلاش دوباره، یادداشت، فایل، محصول خروجی، وضعیت یکپارچه‌سازی یا بخش عیب‌یابی را باز کنید و نتیجهٔ واقعی را ببینید.'],
    ], [['فرق خروجی با مشکلات چیست؟', 'خروجی فعالیت و جزئیات عملیات را به ترتیب زمان ثبت می‌کند؛ مشکلات، عیب‌های قابل اقدام فعلی را جمع می‌کند.'], ['پیام موفقیت یعنی همهٔ سامانه‌ها سالم‌اند؟', 'خیر. فقط عملیات گزارش‌دهنده را تأیید می‌کند. ذخیره، نمایه، Git، یکپارچه‌سازی و خروجی وضعیت مستقل دارند.'], ['می‌توانم خروجی را پاک کنم؟', 'این گزارش شاهد مشتق‌شدهٔ نشست است؛ پیش از پاک کردن یا راه‌اندازی دوباره، پیام لازم برای عیب‌یابی را حفظ کنید.']]),
  },
  problems: {
    de: body('Probleme und bearbeitbare Diagnosen', 'Probleme unten im Arbeitsbereich.', 'Ein gemeldetes Problem oder eine bewusst gestartete Qualitätsprüfung.', 'Diagnosen sind zu prüfende Hinweise und keine automatische Erlaubnis, Inhalt zu ändern oder zu löschen.', [
      ['Schwere und Umfang lesen', 'Ordnen Sie die Meldung Quellsyntax, Index, Export, Integration oder Laufzeit zu.'],
      ['Ursprung öffnen', 'Prüfen Sie die genannte Notiz, den Pfad oder das Steuerelement statt eine unbeteiligte aktive Notiz zu ändern.'],
      ['Gezielt reparieren', 'Korrigieren Sie Quelle oder Konfiguration und wiederholen Sie den betroffenen Vorgang. Sichern Sie Inhalte vor größeren Änderungen.'],
      ['Behebung bestätigen', 'Aktualisieren Sie das zuständige Subsystem. Eine ausgeblendete Meldung beweist keine Reparatur.'],
    ], [['Blockieren Warnungen immer?', 'Nein. Lesen Sie Meldung und betroffenen Ablauf; manche sind Hinweise, andere verhindern einen Vorgang.'], ['Kann ich Probleme ausblenden?', 'Soweit die Anordnung es erlaubt. Die zugrunde liegenden Fehler bleiben bestehen.']]),
    fa: body('پنل مشکلات و عیب‌های قابل اقدام', 'بخش مشکلات در پایین فضای کار.', 'مشکل گزارش‌شده یا بررسی کیفیتِ آگاهانه.', 'گزارش عیب شاهدی برای بررسی است، نه مجوز خودکار تغییر یا حذف محتوا.', [
      ['شدت و دامنه را بخوانید', 'مشخص کنید مشکل مربوط به نحو منبع، نمایه، خروجی، یکپارچه‌سازی یا زمان اجراست.'],
      ['منشأ را باز کنید', 'یادداشت، مسیر یا کنترل ارجاع‌شده را بررسی کنید و یادداشت فعال نامرتبط را تغییر ندهید.'],
      ['اصلاح محدود انجام دهید', 'منبع یا تنظیم را اصلاح و همان عملیات را تکرار کنید. پیش از بازنویسی گسترده محتوا را حفظ کنید.'],
      ['رفع مشکل را تأیید کنید', 'زیرسامانهٔ مسئول را تازه کنید. بستن پیام ثابت نمی‌کند علت اصلاح شده است.'],
    ], [['هشدار همیشه مانع کار است؟', 'خیر. پیام و گردش کار را بخوانید؛ برخی مشورتی و برخی مانع عملیات‌اند.'], ['می‌توانم مشکلات را پنهان کنم؟', 'اگر چیدمان اجازه دهد بله، اما پنهان کردن پنل مشکلاتش را حل نمی‌کند.']]),
  },
  diagnostics: {
    de: body('Diagnose, Zustandsprüfung und Supportbelege', 'Diagnose, Tresorzustand und Meldewerkzeuge.', 'Reproduzieren Sie den Fehler und notieren Sie Tresor, Funktion und Version ohne private Inhalte offenzulegen.', 'Protokolle und Bilder können private Daten enthalten. Entfernen Sie Zugangsdaten, Mail, Dokumenttext und unbeteiligte Pfade vor Weitergabe.', [
      ['Symptom erfassen', 'Notieren Sie Vorgang, erwartetes Ergebnis, genaue Abweichung und Wiederholbarkeit nach einem sicheren erneuten Versuch.'],
      ['Geltungsbereich trennen', 'Unterscheiden Sie Dokumentfehler, native Abhängigkeiten, Netzwerk und Konten, Darstellung und UI-Zustand.'],
      ['Begrenzte Belege sammeln', 'Nutzen Sie bereitgestellte Protokolle und minimale Beispiele. Geben Sie keinen ganzen Tresor oder unbearbeiteten Anbietertoken weiter.'],
      ['Reparatur verifizieren', 'Wiederholen Sie den ursprünglichen Ablauf und prüfen Sie sein Ergebnis. Eine andere erfolgreiche Prüfung reicht nicht.'],
    ], [['Soll ich sofort Zwischenspeicher löschen?', 'Bewahren Sie zuerst Diagnosebelege und prüfen Sie, dass der Speicher abgeleitet ist. Autoritative Notizen sind kein entbehrlicher Cache.'], ['Was macht einen hilfreichen Fehlerbericht aus?', 'Reproduzierbare Schritte, genaue Meldung, Umgebung und Version sowie ein bereinigtes minimales Beispiel.']]),
    fa: body('عیب‌یابی، بررسی سلامت و شواهد پشتیبانی', 'عیب‌یابی، سلامت مخزن و کنترل‌های گزارش.', 'مشکل را بازتولید کنید و مخزن، قابلیت و نسخه را بدون افشای محتوای خصوصی ثبت کنید.', 'گزارش و تصویر ممکن است دادهٔ خصوصی داشته باشد. پیش از اشتراک، اطلاعات ورود، نامه، متن سند و مسیرهای نامرتبط را حذف کنید.', [
      ['نشانه را ثبت کنید', 'عملیات، انتظار، خطای واقعی و امکان بازتولید پس از تلاش دوبارهٔ امن را بنویسید.'],
      ['دامنه را جدا کنید', 'مشکل سند را از وابستگی بومی، شبکه و حساب، رندر و وضعیت رابط تفکیک کنید.'],
      ['شاهد محدود جمع کنید', 'از گزارش و رسید موجود و نمونهٔ کوچک استفاده کنید. مخزن کامل یا توکن خام را نفرستید.'],
      ['اصلاح را بیازمایید', 'مسیر اصلی کاربر را تکرار و نتیجه را بررسی کنید. موفقیت بررسی دیگری کافی نیست.'],
    ], [['باید فوراً حافظهٔ نهان را پاک کنم؟', 'ابتدا شواهد لازم را حفظ و مشتق‌شده بودن حافظه را تأیید کنید. یادداشت اصلی حافظهٔ دورریختنی نیست.'], ['گزارش خطای مفید چه دارد؟', 'گام‌های قابل تکرار، خطای دقیق، محیط و نسخه و نمونهٔ حداقلی با اطلاعات خصوصی حذف‌شده.']]),
  },
  hibernation: {
    de: body('Leistungsanzeige und Subsystem-Ruhezustand', 'Befehle für Leistung und Ruhezustand.', 'Klären Sie, welches Subsystem Sie pausieren.', 'Pausierte Beobachter, Git-Aktualisierung, Graph oder Korrektur können veraltete Informationen zeigen. Reaktivieren Sie sie vor Verlass darauf.', [
      ['Konkretes Symptom messen', 'Vergleichen Sie Verzögerung und Ressourcen unter wiederholbarer Last. Eine Einzelzahl ist kein Qualitätsurteil.'],
      ['Gezielt pausieren', 'Versetzen Sie nur das zuständige Subsystem in Ruhe und lesen Sie seine Pausenanzeige.'],
      ['Einschränkung beachten', 'Aktualisierung oder Berechnung ist ausgesetzt. Eine eingefrorene Ansicht zeigt möglicherweise nicht den aktuellen Quellenstand.'],
      ['Aufwecken und prüfen', 'Lassen Sie das Subsystem aufholen, bevor Sie exportieren, synchronisieren oder abgeleiteten Informationen vertrauen.'],
    ], [['Löscht der Ruhezustand Daten?', 'Er pausiert Arbeit und ist keine Lösch- oder Rückgängigfunktion.'], ['Warum aktualisieren sich Links nicht?', 'Prüfen Sie Beobachter, Index und Ruhezustand, bevor Sie unnötig Dateien ändern oder neu aufbauen.']]),
    fa: body('نمایش عملکرد و خواب زیرسامانه', 'فرمان‌های عملکرد و خواب.', 'بدانید کدام زیرسامانه را متوقف می‌کنید.', 'خواب پایشگر، تازه‌سازی Git، گراف یا بازخوانی متن می‌تواند دادهٔ مشتق‌شده را قدیمی کند. پیش از اتکا آن را بیدار کنید.', [
      ['نشانهٔ واقعی را اندازه بگیرید', 'تأخیر و مصرف منابع را در بار قابل تکرار مقایسه کنید. یک عدد به‌تنهایی امتیاز کیفیت نیست.'],
      ['محدود توقف دهید', 'فقط زیرسامانهٔ مربوط را بخوابانید و نشان توقفش را بخوانید.'],
      ['محدودیت را لحاظ کنید', 'تازه‌سازی یا محاسبهٔ پس‌زمینه متوقف می‌شود؛ نمای ثابت الزاماً وضعیت فعلی منبع نیست.'],
      ['بیدار و بازبینی کنید', 'پیش از خروجی، همگام‌سازی یا اتکا به دادهٔ مشتق‌شده اجازه دهید زیرسامانه به‌روز شود.'],
    ], [['خواب داده را حذف می‌کند؟', 'کار را متوقف می‌کند؛ برای حذف یا واگردانی طراحی نشده است.'], ['چرا پیوندها به‌روز نمی‌شوند؟', 'پیش از بازسازی یا ویرایش غیرضروری، وضعیت پایشگر، نمایه و خواب را بررسی کنید.']]),
  },
  history: {
    de: body('Notizverlauf und frühere Fassungen wiederherstellen', 'Verlaufszeitleiste der aktiven Notiz.', 'Eine aktive Notiz mit aufgezeichneten Fassungen.', 'Wiederherstellung ersetzt aktuellen Inhalt. Sichern Sie aktuelle Änderungen vor der Bestätigung.', [
      ['Notiz bestätigen', 'Prüfen Sie Pfad und Zeitpunkt. Der Verlauf einer Notiz ist kein vollständiger Tresor-Sicherungsverlauf.'],
      ['Fassungen vergleichen', 'Prüfen Sie Inhalt und Unterschiede und wählen Sie die Fassung, die fehlende Arbeit tatsächlich enthält.'],
      ['Bewusst wiederherstellen', 'Lesen Sie, was ersetzt wird, und sichern Sie nützlichen neueren Text separat.'],
      ['Speicherung prüfen', 'Bestätigen Sie Inhalt und Speicherzustand. Prüfen Sie Links und Metadaten nach einer größeren Rücksetzung.'],
    ], [['Warum gibt es keinen Verlauf?', 'Nur aufgezeichnete und aufbewahrte Fassungen sind verfügbar. Nutzen Sie Git oder Sicherungen für andere Versionen.'], ['Ist Verlauf eine Katastrophensicherung?', 'Nein. Er kann zusammen mit Gerät oder Tresor verloren gehen. Bewahren Sie geprüfte externe Sicherungen auf.']]),
    fa: body('تاریخچهٔ یادداشت و بازیابی نسخه', 'خط زمانی تاریخچهٔ یادداشت فعال.', 'یادداشت فعال با نسخه‌های ثبت‌شده.', 'بازیابی نسخه محتوای فعلی را جایگزین می‌کند. پیش از تأیید، ویرایش فعلی را حفظ کنید.', [
      ['یادداشت را تأیید کنید', 'مسیر و زمان نسخه را بررسی کنید. تاریخچهٔ یک یادداشت، تاریخچهٔ کامل پشتیبان مخزن نیست.'],
      ['نسخه‌ها را مقایسه کنید', 'محتوا یا تفاوت‌ها را ببینید و نسخه‌ای را انتخاب کنید که واقعاً کار گم‌شده را دارد.'],
      ['آگاهانه بازیابی کنید', 'محتوای جایگزین‌شونده را بررسی و متن جدید مفید را جداگانه حفظ کنید.'],
      ['ذخیره روی دیسک را بررسی کنید', 'محتوای بازیابی‌شده و وضعیت ذخیره را تأیید کنید؛ پس از عقب‌گرد بزرگ پیوند و فراداده را ببینید.'],
    ], [['چرا تاریخچه‌ای موجود نیست؟', 'فقط نسخه‌های ثبت و نگهداری‌شده نمایش داده می‌شوند. برای نسخهٔ ثبت‌نشده از Git یا پشتیبان استفاده کنید.'], ['تاریخچه پشتیبان بازیابی فاجعه است؟', 'خیر. ممکن است با دستگاه یا مخزن از بین برود. پشتیبان بیرونیِ تأییدشده نگه دارید.']]),
  },
  recovery: {
    de: body('Speicherfehler, veralteter Zustand und sichere Wiederherstellung', 'Fehler- und Statusansichten, Verlauf, Konflikte und Sicherungen.', 'Ermitteln Sie die maßgebliche Quelle und sichern Sie ungespeicherte Arbeit.', 'Wiederherstellung kann Inhalt verwerfen oder ersetzen. Klären Sie Folgen vor Zurücksetzen, Neuladen oder Wiederherstellen.', [
      ['Text und Belege sichern', 'Notieren Sie den genauen Fehler und kopieren Sie nützlichen ungespeicherten Text vor verlustbehafteten Maßnahmen.'],
      ['Verantwortlichen Bereich erkennen', 'Vorschaufehler, veralteter Index, Speicherfehler, Konflikt und fehlendes Werkzeug benötigen verschiedene Reparaturen.'],
      ['Gezielte Maßnahme wählen', 'Wiederholen Sie den fehlgeschlagenen Lesevorgang, korrigieren Sie Konfiguration, lösen Sie den Konflikt oder stellen Sie eine geprüfte Fassung wieder her.'],
      ['Ursprünglichen Ablauf prüfen', 'Öffnen Sie Notiz oder Ausgabe erneut und wiederholen Sie den Vorgang. Ein geschlossener Fehler belegt keine Datenrettung.'],
    ], [['Soll ich sofort neu laden?', 'Nicht, wenn ungespeicherte Arbeit verloren gehen könnte. Lesen Sie Wiederherstellungsoptionen und sichern Sie sie zuerst.'], ['Kann ein neuer Index gelöschten Text retten?', 'Nein. Der Index ist abgeleitet. Nutzen Sie Quellenverlauf, Git oder eine geprüfte Sicherung.']]),
    fa: body('خطای ذخیره، وضعیت قدیمی و بازیابی امن', 'نمای خطا و وضعیت، تاریخچه، تعارض‌ها و پشتیبان‌ها.', 'منبع اصلی را مشخص و کار ذخیره‌نشدهٔ مفید را حفظ کنید.', 'بازیابی می‌تواند محتوا را دور بریزد یا جایگزین کند. پیش از بازنشانی، بارگذاری یا بازیابی پیامد را بفهمید.', [
      ['شاهد و متن را حفظ کنید', 'خطای دقیق را ثبت و پیش از بازیابی مخرب از متن ذخیره‌نشده نسخهٔ امن بگیرید.'],
      ['مسئول خطا را مشخص کنید', 'خطای پیش‌نمایش، نمایهٔ قدیمی، شکست ذخیره، تعارض و ابزار بیرونیِ مفقود اصلاح متفاوت می‌خواهند.'],
      ['عمل محدود انتخاب کنید', 'خواندن ناموفق را تکرار، تنظیم را اصلاح، تعارض را حل یا نسخهٔ تأییدشده را بازیابی کنید.'],
      ['مسیر اصلی را بیازمایید', 'یادداشت یا خروجی را دوباره باز و عملیات را تکرار کنید. بستن خطا نشانهٔ بازیابی داده نیست.'],
    ], [['باید فوراً دوباره بارگذاری کنم؟', 'اگر کار ذخیره‌نشده ممکن است از دست برود خیر. ابتدا گزینه‌های بازیابی را بخوانید و متن را حفظ کنید.'], ['بازسازی نمایه متن حذف‌شده را برمی‌گرداند؟', 'خیر. نمایه مشتق‌شده است. از تاریخچهٔ منبع، Git یا پشتیبان تأییدشده استفاده کنید.']]),
  },
}
