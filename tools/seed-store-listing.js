/**
 * Regenerates store-assets/store-listing-copy.md for all supported languages.
 * English source matches the Chrome Web Store long description master copy.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "store-assets", "store-listing-copy.md");

const EN = `⚽ Hype - Live Football Scores is a free, fast and clean way to follow football from your Chrome toolbar.

Open the popup to quickly check live scores, results, upcoming matches and league tables without jumping between sports websites.

What you get:

1️⃣ Live scores grouped by league
2️⃣ League tables and standings
3️⃣ Match stats when available
4️⃣ Lineups, timeline, commentary, news and links for supported matches
5️⃣ Favorite leagues pinned to the top

No account, no unnecessary permissions, no personal data collection.

⏭️ This extension is 100% open source and designed to be fully privacy-focused. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype keeps things simple: open, check the score, get back to what you were doing.

Free to use.`;

/** @type {Record<string, string>} */
const LISTINGS = {
  English: EN,

  "English (United States)": EN,

  "English (United Kingdom)": `⚽ Hype - Live Football Scores is a free, fast and clean way to follow football from your Chrome toolbar.

Open the popup to quickly check live scores, results, upcoming matches and league tables without jumping between sports websites.

What you get:

1️⃣ Live scores grouped by league
2️⃣ League tables and standings
3️⃣ Match stats when available
4️⃣ Line-ups, timeline, commentary, news and links for supported matches
5️⃣ Favourite leagues pinned to the top

No account, no unnecessary permissions, no personal data collection.

⏭️ This extension is 100% open source and designed to be fully privacy-focused. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype keeps things simple: open, check the score, get back to what you were doing.

Free to use.`,

  "English (Australia)": `⚽ Hype - Live Football Scores is a free, fast and clean way to follow football from your Chrome toolbar.

Open the popup to quickly check live scores, results, upcoming matches and league tables without jumping between sports websites.

What you get:

1️⃣ Live scores grouped by league
2️⃣ League tables and standings
3️⃣ Match stats when available
4️⃣ Line-ups, timeline, commentary, news and links for supported matches
5️⃣ Favourite leagues pinned to the top

No account, no unnecessary permissions, no personal data collection.

⏭️ This extension is 100% open source and designed to be fully privacy-focused. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype keeps things simple: open, check the score, get back to what you were doing.

Free to use.`,

  Deutsch: `⚽ Hype - Live-Fußballergebnisse ist eine kostenlose, schnelle und aufgeräumte Möglichkeit, Fußball direkt über die Chrome-Symbolleiste zu verfolgen.

Öffne das Popup und sieh dir Live-Ergebnisse, Resultate, anstehende Spiele und Tabellen an, ohne zwischen Sportseiten wechseln zu müssen.

Das bekommst du:

1️⃣ Live-Ergebnisse nach Liga gruppiert
2️⃣ Tabellen und Platzierungen
3️⃣ Spielstatistiken, wenn verfügbar
4️⃣ Aufstellungen, Spielverlauf, Kommentar, News und Links für unterstützte Spiele
5️⃣ Favorisierte Ligen ganz oben

Kein Konto, keine unnötigen Berechtigungen, keine Erfassung persönlicher Daten.

⏭️ Diese Erweiterung ist 100 % Open Source und konsequent datenschutzfreundlich. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype bleibt bewusst einfach: öffnen, Ergebnis prüfen, weitermachen.

Kostenlos nutzbar.`,

  Türkçe: `⚽ Hype - Canlı Futbol Skorları, Chrome araç çubuğundan futbolu takip etmenin ücretsiz, hızlı ve sade bir yolu.

Popup’ı açarak canlı skorları, sonuçları, yaklaşan maçları ve puan durumlarını spor siteleri arasında dolaşmadan hızlıca kontrol edebilirsin.

Neler sunar:

1️⃣ Liglere göre gruplanmış canlı skorlar
2️⃣ Puan durumları ve lig tabloları
3️⃣ Varsa maç istatistikleri
4️⃣ Desteklenen maçlarda kadrolar, olaylar, anlatım, haberler ve bağlantılar
5️⃣ Favori liglerini en üste sabitleme

Hesap yok, gereksiz izin yok, kişisel veri toplama yok.

⏭️ Bu eklenti %100 açık kaynaklıdır ve tamamen gizlilik odaklı tasarlanmıştır. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype işi basit tutar: aç, skoru kontrol et, işine geri dön.

Ücretsizdir.`,

  español: `⚽ Hype - Resultados de fútbol en directo es una forma gratis, rápida y limpia de seguir el fútbol desde la barra de herramientas de Chrome.

Abre la ventana emergente para consultar resultados en directo, marcadores finales, próximos partidos y clasificaciones sin saltar de web en web.

Qué incluye:

1️⃣ Resultados en directo agrupados por liga
2️⃣ Clasificaciones y tablas
3️⃣ Estadísticas del partido cuando estén disponibles
4️⃣ Alineaciones, cronología, narración, noticias y enlaces en partidos compatibles
5️⃣ Ligas favoritas fijadas arriba

Sin cuenta, sin permisos innecesarios y sin recopilación de datos personales.

⏭️ Esta extensión es 100 % de código abierto y está pensada para la privacidad. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype va al grano: abre, mira el resultado y vuelve a lo tuyo.

Gratis.`,

  "español (Latinoamérica)": `⚽ Hype - Resultados de fútbol en vivo es una forma gratis, rápida y limpia de seguir el fútbol desde la barra de Chrome.

Abre la ventana emergente para ver resultados en vivo, marcadores, próximos partidos y tablas sin saltar entre sitios de deportes.

Qué incluye:

1️⃣ Resultados en vivo agrupados por liga
2️⃣ Tablas y posiciones
3️⃣ Estadísticas del partido cuando estén disponibles
4️⃣ Alineaciones, cronología, narración, noticias y enlaces en partidos compatibles
5️⃣ Ligas favoritas fijadas arriba

Sin cuenta, sin permisos innecesarios y sin recolección de datos personales.

⏭️ Esta extensión es 100 % de código abierto y está diseñada con foco total en la privacidad. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype es simple: abre, revisa el marcador y sigue con lo tuyo.

Gratis.`,

  français: `⚽ Hype - Scores de football en direct est une façon gratuite, rapide et claire de suivre le foot depuis la barre d’outils Chrome.

Ouvrez la fenêtre de l’extension pour consulter les scores en direct, les résultats, les matchs à venir et les classements sans passer d’un site sportif à l’autre.

Ce que vous obtenez :

1️⃣ Scores en direct regroupés par ligue
2️⃣ Classements et tableaux
3️⃣ Statistiques de match quand elles sont disponibles
4️⃣ Compositions, chronologie, commentaire, actualités et liens pour les matchs pris en charge
5️⃣ Ligues favorites épinglées en haut

Pas de compte, pas d’autorisations inutiles, aucune collecte de données personnelles.

⏭️ Cette extension est 100 % open source et conçue pour la confidentialité. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype reste simple : ouvrez, vérifiez le score, reprenez ce que vous faisiez.

Gratuit.`,

  "português (Brasil)": `⚽ Hype - Placar de futebol ao vivo é uma forma grátis, rápida e limpa de acompanhar futebol pela barra do Chrome.

Abra o pop-up para ver placares ao vivo, resultados, próximos jogos e tabelas sem pular entre sites de esporte.

O que você encontra:

1️⃣ Placares ao vivo agrupados por liga
2️⃣ Tabelas e classificação
3️⃣ Estatísticas do jogo quando disponíveis
4️⃣ Escalações, linha do tempo, comentários, notícias e links em jogos compatíveis
5️⃣ Ligas favoritas fixadas no topo

Sem conta, sem permissões desnecessárias e sem coleta de dados pessoais.

⏭️ Esta extensão é 100% open source e feita com foco total em privacidade. ⏭️
https://github.com/Atakan0zkan/HypeScore

O Hype é simples: abra, confira o placar e volte ao que estava fazendo.

Grátis para usar.`,

  "português (Portugal)": `⚽ Hype - Resultados de futebol em direto é uma forma gratuita, rápida e simples de acompanhar futebol a partir da barra do Chrome.

Abra a janela da extensão para ver resultados em direto, resultados finais, próximos jogos e classificações sem saltar entre sites desportivos.

O que inclui:

1️⃣ Resultados em direto agrupados por liga
2️⃣ Classificações e tabelas
3️⃣ Estatísticas do jogo quando disponíveis
4️⃣ Formações, cronologia, comentários, notícias e ligações nos jogos suportados
5️⃣ Ligas favoritas fixadas no topo

Sem conta, sem permissões desnecessárias e sem recolha de dados pessoais.

⏭️ Esta extensão é 100% open source e pensada para a privacidade. ⏭️
https://github.com/Atakan0zkan/HypeScore

O Hype mantém tudo simples: abra, veja o resultado e volte ao que estava a fazer.

Gratuito.`,

  italiano: `⚽ Hype - Risultati di calcio in diretta è un modo gratuito, veloce e pulito per seguire il calcio dalla barra di Chrome.

Apri il popup per controllare live, risultati, prossime partite e classifiche senza saltare da un sito sportivo all’altro.

Cosa ottieni:

1️⃣ Risultati live raggruppati per campionato
2️⃣ Classifiche e tabelle
3️⃣ Statistiche di gara quando disponibili
4️⃣ Formazioni, cronologia, commento, notizie e link per le partite supportate
5️⃣ Campionati preferiti in cima

Niente account, niente permessi inutili, nessuna raccolta di dati personali.

⏭️ Questa estensione è open source al 100% e pensata per la privacy. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype resta semplice: apri, controlla il risultato, torna a quello che stavi facendo.

Gratuita.`,

  Nederlands: `⚽ Hype - Live voetbaluitslagen is een gratis, snelle en overzichtelijke manier om voetbal te volgen via de Chrome-werkbalk.

Open de popup om live scores, uitslagen, aankomende wedstrijden en standen te bekijken zonder van sportsite naar sportsite te springen.

Dit krijg je:

1️⃣ Live scores gegroepeerd per competitie
2️⃣ Standen en tabellen
3️⃣ Wedstrijdstatistieken wanneer beschikbaar
4️⃣ Opstellingen, tijdlijn, commentaar, nieuws en links voor ondersteunde wedstrijden
5️⃣ Favoriete competities bovenaan vastgezet

Geen account, geen onnodige rechten, geen verzameling van persoonsgegevens.

⏭️ Deze extensie is 100% open source en volledig privacygericht. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype houdt het simpel: openen, score checken, verdergaan.

Gratis te gebruiken.`,

  polski: `⚽ Hype - Wyniki piłkarskie na żywo to darmowy, szybki i przejrzysty sposób na śledzenie piłki z paska Chrome.

Otwórz popup, by szybko sprawdzić wyniki na żywo, rezultaty, nadchodzące mecze i tabele bez skakania po stronach sportowych.

Co dostajesz:

1️⃣ Wyniki na żywo pogrupowane według ligi
2️⃣ Tabele i rankingi
3️⃣ Statystyki meczu, gdy są dostępne
4️⃣ Składy, przebieg, komentarz, newsy i linki dla obsługiwanych meczów
5️⃣ Ulubione ligi przypięte na górze

Bez konta, bez zbędnych uprawnień, bez zbierania danych osobowych.

⏭️ To rozszerzenie jest w 100% open source i zaprojektowane z myślą o prywatności. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype jest proste: otwórz, sprawdź wynik, wróć do swoich spraw.

Darmowe.`,

  русский: `⚽ Hype - Живые футбольные счета — бесплатный, быстрый и аккуратный способ следить за футболом из панели Chrome.

Откройте всплывающее окно, чтобы быстро проверить live-счета, результаты, ближайшие матчи и таблицы, не прыгая по спортивным сайтам.

Что вы получаете:

1️⃣ Live-счета, сгруппированные по лигам
2️⃣ Турнирные таблицы
3️⃣ Статистику матча, когда она доступна
4️⃣ Составы, хронологию, комментарии, новости и ссылки для поддерживаемых матчей
5️⃣ Избранные лиги закреплены сверху

Без аккаунта, без лишних разрешений, без сбора персональных данных.

⏭️ Это расширение на 100% open source и создано с акцентом на приватность. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype остаётся простым: открой, проверь счёт, вернись к своим делам.

Бесплатно.`,

  日本語: `⚽ Hype - ライブサッカー速報は、Chrome ツールバーからサッカーを追うための無料・高速・シンプルな方法です。

ポップアップを開けば、スポーツサイトを行き来せずにライブスコア、結果、今後の試合、順位表をすぐ確認できます。

できること:

1️⃣ リーグ別にまとめたライブスコア
2️⃣ 順位表・テーブル
3️⃣ 利用可能な試合スタッツ
4️⃣ 対応試合のスタメン、タイムライン、実況、ニュース、リンク
5️⃣ お気に入りリーグを上部に固定

アカウント不要、不要な権限なし、個人データの収集なし。

⏭️ この拡張機能は 100% オープンソースで、プライバシー重視に設計されています。 ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype はシンプル: 開いて、スコアを見て、元の作業に戻る。

無料で使えます。`,

  한국어: `⚽ Hype - 라이브 축구 스코어는 Chrome 툴바에서 축구를 따라가는 무료·빠른·깔끔한 방법입니다.

팝업을 열어 스포츠 사이트를 오가지 않고도 라이브 스코어, 결과, 예정 경기, 순위표를 바로 확인하세요.

제공 기능:

1️⃣ 리그별로 묶인 라이브 스코어
2️⃣ 순위표와 테이블
3️⃣ 가능한 경우 경기 통계
4️⃣ 지원 경기의 라인업, 타임라인, 해설, 뉴스, 링크
5️⃣ 즐겨찾기 리그를 맨 위에 고정

계정 없음, 불필요한 권한 없음, 개인정보 수집 없음.

⏭️ 이 확장 프로그램은 100% 오픈 소스이며 프라이버시에 중점을 두고 설계되었습니다. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype는 단순합니다: 열고, 스코어를 확인하고, 하던 일로 돌아가세요.

무료입니다.`,

  "中文（中国）": `⚽ Hype - 足球即时比分是一种免费、快速、干净的方式，让你从 Chrome 工具栏关注足球。

打开弹窗即可快速查看即时比分、赛果、即将开赛和积分榜，无需在体育网站间来回切换。

你将获得：

1️⃣ 按联赛分组的即时比分
2️⃣ 积分榜与排名
3️⃣ 可用时的比赛数据
4️⃣ 支持比赛的阵容、赛况、文字直播、新闻与链接
5️⃣ 收藏联赛置顶

无需账号，无多余权限，不收集个人数据。

⏭️ 本扩展 100% 开源，并完全以隐私为先设计。 ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype 很简单：打开，看分，回到你正在做的事。

免费使用。`,

  "中文（台灣）": `⚽ Hype - 足球即時比分是一種免費、快速、乾淨的方式，讓你從 Chrome 工具列追蹤足球。

打開彈出視窗即可快速查看即時比分、賽果、即將開賽與積分榜，不必在體育網站間跳來跳去。

你會得到：

1️⃣ 依聯賽分組的即時比分
2️⃣ 積分榜與排名
3️⃣ 可用時的比賽數據
4️⃣ 支援比賽的陣容、賽況、文字直播、新聞與連結
5️⃣ 收藏聯賽置頂

免帳號、無多餘權限、不收集個人資料。

⏭️ 本擴充功能 100% 開源，並以隱私為核心設計。 ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype 很簡單：打開、看比分、回到你正在做的事。

免費使用。`,

  العربية: `⚽ Hype - نتائج كرة القدم المباشرة طريقة مجانية وسريعة ونظيفة لمتابعة كرة القدم من شريط أدوات Chrome.

افتح النافذة المنبثقة للتحقق بسرعة من النتائج المباشرة والنتائج والمباريات القادمة وترتيب الدوريات دون التنقل بين مواقع الرياضة.

ما تحصل عليه:

1️⃣ نتائج مباشرة مجمّعة حسب الدوري
2️⃣ جداول وترتيب الدوريات
3️⃣ إحصائيات المباراة عند توفرها
4️⃣ التشكيلة والخط الزمني والتعليق والأخبار والروابط للمباريات المدعومة
5️⃣ الدوريات المفضلة مثبتة في الأعلى

بدون حساب، وبدون أذونات غير ضرورية، وبدون جمع بيانات شخصية.

⏭️ هذه الإضافة مفتوحة المصدر بنسبة 100٪ ومصممة مع التركيز الكامل على الخصوصية. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype يبقي الأمر بسيطًا: افتح، تحقق من النتيجة، وعد لما كنت تفعله.

مجاني للاستخدام.`,

  हिन्दी: `⚽ Hype - लाइव फ़ुटबॉल स्कोर Chrome टूलबार से फ़ुटबॉल फॉलो करने का मुफ़्त, तेज़ और साफ़ तरीका है।

पॉपअप खोलकर स्पोर्ट्स वेबसाइट्स के बीच घूमे बिना लाइव स्कोर, नतीजे, आगामी मैच और लीग तालिकाएँ जल्दी देखें।

आपको मिलता है:

1️⃣ लीग के अनुसार समूहित लाइव स्कोर
2️⃣ लीग तालिकाएँ और स्टैंडिंग
3️⃣ उपलब्ध होने पर मैच आँकड़े
4️⃣ समर्थित मैचों के लिए लाइनअप, टाइमलाइन, कमेंट्री, समाचार और लिंक
5️⃣ पसंदीदा लीग ऊपर पिन

कोई खाता नहीं, अनावश्यक अनुमतियाँ नहीं, कोई व्यक्तिगत डेटा संग्रह नहीं।

⏭️ यह एक्सटेंशन 100% ओपन सोर्स है और पूरी तरह प्राइवेसी-केंद्रित है। ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype सरल रहता है: खोलें, स्कोर देखें, अपने काम पर लौटें।

मुफ़्त उपयोग।`,
};

// Additional locales with full store text
Object.assign(LISTINGS, {
  dansk: `⚽ Hype - Live fodboldresultater er en gratis, hurtig og overskuelig måde at følge fodbold fra Chrome-værktøjslinjen.

Åbn popup’en for hurtigt at tjekke livescoringer, resultater, kommende kampe og stillinger uden at hoppe mellem sportswebsites.

Det får du:

1️⃣ Livescoringer grupperet efter liga
2️⃣ Tabeller og stillinger
3️⃣ Kampstatistik, når det er tilgængeligt
4️⃣ Opstillinger, tidslinje, kommentar, nyheder og links for understøttede kampe
5️⃣ Favoritligaer øverst

Ingen konto, ingen unødvendige tilladelser, ingen indsamling af persondata.

⏭️ Denne udvidelse er 100 % open source og designet med fokus på privatliv. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype holder det enkelt: åbn, tjek scoren, vend tilbage til det, du lavede.

Gratis at bruge.`,

  svenska: `⚽ Hype - Live fotbollsresultat är ett gratis, snabbt och rent sätt att följa fotboll från Chrome-verktygsfältet.

Öppna popupen för att snabbt kolla livesiffror, resultat, kommande matcher och tabeller utan att hoppa mellan sportwebbplatser.

Det här får du:

1️⃣ Livesiffror grupperade per liga
2️⃣ Tabeller och ställningar
3️⃣ Matchstatistik när den finns
4️⃣ Laguppställningar, tidslinje, referat, nyheter och länkar för stödda matcher
5️⃣ Favoritligor högst upp

Inget konto, inga onödiga behörigheter, ingen insamling av personuppgifter.

⏭️ Detta tillägg är 100 % open source och byggt med integritet i fokus. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype håller det enkelt: öppna, kolla resultatet, fortsätt med det du höll på med.

Gratis att använda.`,

  norsk: `⚽ Hype - Live fotballresultater er en gratis, rask og ryddig måte å følge fotball fra Chrome-verktøylinjen.

Åpne popupen for raskt å sjekke livesifre, resultater, kommende kamper og tabeller uten å hoppe mellom sportsnettsteder.

Dette får du:

1️⃣ Livesifre gruppert etter liga
2️⃣ Tabeller og stillinger
3️⃣ Kampstatistikk når det er tilgjengelig
4️⃣ Lagoppstillinger, tidslinje, referat, nyheter og lenker for støttede kamper
5️⃣ Favorittligaer festet øverst

Ingen konto, ingen unødvendige tillatelser, ingen innsamling av persondata.

⏭️ Denne utvidelsen er 100 % open source og laget med personvern i fokus. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype holder det enkelt: åpne, sjekk resultatet, gå tilbake til det du holdt på med.

Gratis å bruke.`,

  suomi: `⚽ Hype - Live-jalkapallotulokset on ilmainen, nopea ja selkeä tapa seurata jalkapalloa Chrome-työkalupalkista.

Avaa ponnahdusikkuna ja tarkista livescoret, tulokset, tulevat ottelut ja sarjataulukot ilman hyppelyä urheilusivustolta toiselle.

Saat:

1️⃣ Liigoittain ryhmitellyt livescoret
2️⃣ Sarjataulukot
3️⃣ Ottelutilastot, kun ne ovat saatavilla
4️⃣ Kokoonpanot, tapahtumat, selostus, uutiset ja linkit tuetuille otteluille
5️⃣ Suosikkiliigat ylhäällä

Ei tiliä, ei turhia oikeuksia, ei henkilötietojen keräämistä.

⏭️ Tämä laajennus on 100 % avointa lähdekoodia ja suunniteltu yksityisyyttä ajatellen. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype pitää asian yksinkertaisena: avaa, tarkista tulos, palaa tekemääsi.

Ilmainen käyttää.`,

  català: `⚽ Hype - Resultats de futbol en directe és una manera gratuïta, ràpida i neta de seguir el futbol des de la barra de Chrome.

Obre la finestra emergent per consultar resultats en directe, resultats finals, propers partits i classificacions sense saltar entre webs esportives.

Què t’ofereix:

1️⃣ Resultats en directe agrupats per lliga
2️⃣ Classificacions i taules
3️⃣ Estadístiques del partit quan estiguin disponibles
4️⃣ Alineacions, cronologia, comentari, notícies i enllaços en partits compatibles
5️⃣ Lligues preferides fixades a dalt

Sense compte, sense permisos innecessaris i sense recollida de dades personals.

⏭️ Aquesta extensió és 100 % de codi obert i pensada per a la privadesa. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ho manté simple: obre, mira el resultat i torna al que feies.

Gratuït.`,

  eesti: `⚽ Hype - Jalgpalli live-tulemused on tasuta, kiire ja selge viis jalgpalli jälgimiseks Chrome’i tööriistaribalt.

Ava hüpikaken, et kiiresti vaadata live-skoore, tulemusi, eesseisvaid mänge ja tabeleid ilma spordisaitide vahel hüppamata.

Saad:

1️⃣ Liigade kaupa grupeeritud live-skoorid
2️⃣ Tabelid ja kohad
3️⃣ Mängu statistika, kui see on saadaval
4️⃣ Koosseisud, ajajoon, kommentaar, uudised ja lingid toetatud mängudele
5️⃣ Lemmikliigad üleval

Pole kontot, pole tarbetuid õigusi, pole isikuandmete kogumist.

⏭️ See laiendus on 100% avatud lähtekoodiga ja loodud privaatsust silmas pidades. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype hoiab asja lihtsana: ava, kontrolli skoori, naase oma asjade juurde.

Tasuta kasutamiseks.`,

  hrvatski: `⚽ Hype - Uživo nogometni rezultati besplatan je, brz i čist način praćenja nogometa s Chrome trake alata.

Otvori skočni prozor za brzi pregled live rezultata, ishoda, nadolazećih utakmica i ljestvica bez skakanja po sportskim stranicama.

Što dobivaš:

1️⃣ Live rezultate grupirane po ligama
2️⃣ Ljestvice i poretke
3️⃣ Statistiku utakmice kad je dostupna
4️⃣ Sastave, tijek, komentar, vijesti i poveznice za podržane utakmice
5️⃣ Omiljene lige pri vrhu

Bez računa, bez nepotrebnih dopuštenja, bez prikupljanja osobnih podataka.

⏭️ Ovo proširenje je 100 % open source i osmišljeno s naglaskom na privatnost. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ostaje jednostavan: otvori, provjeri rezultat, vrati se onome što si radio.

Besplatno za korištenje.`,

  latviešu: `⚽ Hype - Futbola rezultāti tiešraidē ir bezmaksas, ātrs un tīrs veids, kā sekot futbolam no Chrome rīkjoslas.

Atver uznirstošo logu, lai ātri pārbaudītu live rezultātus, iznākumus, gaidāmās spēles un tabulas, nelecēdams starp sporta vietnēm.

Ko tu iegūsti:

1️⃣ Live rezultātus, sagrupētus pēc līgas
2️⃣ Tabulas un vietas
3️⃣ Spēles statistiku, kad tā ir pieejama
4️⃣ Sastāvus, laika skalu, komentārus, ziņas un saites atbalstītajām spēlēm
5️⃣ Izlases līgas augšā

Bez konta, bez liekām atļaujām, bez personas datu vākšanas.

⏭️ Šis paplašinājums ir 100 % atvērtā koda un veidots ar privātumu prātā. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype paliek vienkāršs: atver, pārbaudi rezultātu, atgriezies pie sava darba.

Bezmaksas lietošanai.`,

  lietuvių: `⚽ Hype - Gyvi futbolo rezultatai yra nemokamas, greitas ir tvarkingas būdas sekti futbolą iš Chrome įrankių juostos.

Atidarykite iššokantįjį langą ir greitai patikrinkite live rezultatus, baigtis, artėjančias rungtynes ir lenteles be šokinėjimo tarp sporto svetainių.

Ką gaunate:

1️⃣ Live rezultatus, sugrupuotus pagal lygas
2️⃣ Lenteles ir pozicijas
3️⃣ Rungtynių statistiką, kai ji prieinama
4️⃣ Sudėtis, eigą, komentarus, naujienas ir nuorodas palaikomoms rungtynėms
5️⃣ Mėgstamas lygas viršuje

Be paskyros, be nereikalingų leidimų, be asmens duomenų rinkimo.

⏭️ Šis plėtinys yra 100 % atvirojo kodo ir sukurtas privatumo labui. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype lieka paprastas: atidarykite, patikrinkite rezultatą, grįžkite prie savo darbų.

Nemokama naudoti.`,

  magyar: `⚽ Hype - Élő futball eredmények ingyenes, gyors és tiszta módja a foci követésének a Chrome eszköztárból.

Nyisd meg a felugró ablakot, hogy gyorsan megnézd az élő állásokat, eredményeket, következő meccseket és tabellákat anélkül, hogy sportoldalak között ugrálnál.

Mit kapsz:

1️⃣ Ligánként csoportosított élő állások
2️⃣ Tabellák és helyezések
3️⃣ Meccsstatisztikák, ha elérhetők
4️⃣ Felállások, idővonal, kommentár, hírek és linkek a támogatott meccseknél
5️⃣ Kedvenc ligák a tetején

Nincs fiók, nincsenek felesleges engedélyek, nincs személyesadat-gyűjtés.

⏭️ Ez a bővítmény 100% open source, és a magánélet védelmére készült. ⏭️
https://github.com/Atakan0zkan/HypeScore

A Hype egyszerű marad: nyisd meg, nézd meg az eredményt, folytasd, amit csináltál.

Ingyenesen használható.`,

  română: `⚽ Hype - Scoruri de fotbal live este un mod gratuit, rapid și curat de a urmări fotbalul din bara Chrome.

Deschide fereastra pop-up pentru a verifica rapid scorurile live, rezultatele, meciurile următoare și clasamentele fără să sari între site-uri sportive.

Ce primești:

1️⃣ Scoruri live grupate pe ligi
2️⃣ Clasamente și tabele
3️⃣ Statistici de meci când sunt disponibile
4️⃣ Echipele de start, cronologie, comentariu, știri și linkuri pentru meciurile suportate
5️⃣ Ligi favorite fixate sus

Fără cont, fără permisiuni inutile, fără colectare de date personale.

⏭️ Această extensie este 100% open source și proiectată pentru confidențialitate. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype rămâne simplu: deschide, verifică scorul, revino la ce făceai.

Gratuit de folosit.`,

  slovenčina: `⚽ Hype - Živé futbalové výsledky je bezplatný, rýchly a prehľadný spôsob, ako sledovať futbal z panela Chrome.

Otvorte vyskakovacie okno a rýchlo skontrolujte live skóre, výsledky, nadchádzajúce zápasy a tabuľky bez skákania medzi športovými webmi.

Čo získate:

1️⃣ Live skóre zoskupené podľa líg
2️⃣ Tabuľky a umiestnenia
3️⃣ Štatistiky zápasu, keď sú dostupné
4️⃣ Zostavy, priebeh, komentár, novinky a odkazy pre podporované zápasy
5️⃣ Obľúbené ligy navrchu

Bez účtu, bez zbytočných oprávnení, bez zberu osobných údajov.

⏭️ Toto rozšírenie je 100 % open source a navrhnuté s dôrazom na súkromie. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype zostáva jednoduchý: otvorte, skontrolujte skóre, vráťte sa k tomu, čo ste robili.

Zadarmo na používanie.`,

  slovenščina: `⚽ Hype - Nogometni rezultati v živo je brezplačen, hiter in čist način spremljanja nogometa iz orodne vrstice Chrome.

Odprite pojavno okno in hitro preverite live rezultate, izide, prihajajoče tekme in lestvice, ne da bi skakali med športnimi spletnimi mesti.

Kaj dobite:

1️⃣ Live rezultate, združene po ligah
2️⃣ Lestvice in uvrstitve
3️⃣ Statistiko tekme, ko je na voljo
4️⃣ Postave, potek, komentar, novice in povezave za podprte tekme
5️⃣ Priljubljene lige na vrhu

Brez računa, brez nepotrebnih dovoljenj, brez zbiranja osebnih podatkov.

⏭️ Ta razširitev je 100 % odprtokodna in zasnovana zasebnostno usmerjeno. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ostaja preprost: odprite, preverite rezultat, nadaljujte, kar ste počeli.

Brezplačno za uporabo.`,

  čeština: `⚽ Hype - Živé fotbalové výsledky je bezplatný, rychlý a přehledný způsob, jak sledovat fotbal z panelu Chrome.

Otevřete vyskakovací okno a rychle zkontrolujte živé skóre, výsledky, nadcházející zápasy a tabulky bez přeskakování mezi sportovními weby.

Co získáte:

1️⃣ Živé skóre seskupené podle lig
2️⃣ Tabulky a pořadí
3️⃣ Statistiky zápasu, když jsou k dispozici
4️⃣ Sestavy, průběh, komentář, novinky a odkazy pro podporované zápasy
5️⃣ Oblíbené ligy nahoře

Bez účtu, bez zbytečných oprávnění, bez sběru osobních údajů.

⏭️ Toto rozšíření je 100% open source a navržené s důrazem na soukromí. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype zůstává jednoduchý: otevřete, zkontrolujte skóre, vraťte se k tomu, co jste dělali.

Zdarma k použití.`,

  Ελληνικά: `⚽ Hype - Ζωντανά σκορ ποδοσφαίρου είναι ένας δωρεάν, γρήγορος και καθαρός τρόπος να ακολουθείς το ποδόσφαιρο από τη γραμμή εργαλείων του Chrome.

Άνοιξε το αναδυόμενο παράθυρο για να δεις γρήγορα live σκορ, αποτελέσματα, επερχόμενους αγώνες και βαθμολογίες χωρίς να πηδάς μεταξύ αθλητικών ιστοσελίδων.

Τι παίρνεις:

1️⃣ Live σκορ ομαδοποιημένα ανά πρωτάθλημα
2️⃣ Βαθμολογίες και πίνακες
3️⃣ Στατιστικά αγώνα όταν είναι διαθέσιμα
4️⃣ Ενδεκάδες, χρονολόγιο, σχολιασμό, νέα και συνδέσμους για υποστηριζόμενους αγώνες
5️⃣ Αγαπημένα πρωταθλήματα καρφιτσωμένα πάνω

Χωρίς λογαριασμό, χωρίς περιττά δικαιώματα, χωρίς συλλογή προσωπικών δεδομένων.

⏭️ Αυτή η επέκταση είναι 100% ανοιχτού κώδικα και σχεδιασμένη με επίκεντρο το απόρρητο. ⏭️
https://github.com/Atakan0zkan/HypeScore

Το Hype μένει απλό: άνοιξε, δες το σκορ, συνέχισε αυτό που έκανες.

Δωρεάν στη χρήση.`,

  български: `⚽ Hype - Резултати от футбол на живо е безплатен, бърз и изчистен начин да следиш футбола от лентата на Chrome.

Отвори изскачащия прозорец, за да провериш бързо live резултати, изходи, предстоящи мачове и класирания, без да скачаш между спортни сайтове.

Какво получаваш:

1️⃣ Live резултати, групирани по лиги
2️⃣ Класирания и таблици
3️⃣ Статистика на мача, когато е налична
4️⃣ Състави, хронология, коментар, новини и връзки за поддържани мачове
5️⃣ Любими лиги най-отгоре

Без акаунт, без ненужни разрешения, без събиране на лични данни.

⏭️ Това разширение е 100% open source и проектирано с фокус върху поверителността. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype остава прост: отвори, провери резултата, върни се към това, което правеше.

Безплатно за ползване.`,

  српски: `⚽ Hype - Уживи фудбалски резултати је бесплатан, брз и прегледан начин да пратите фудбал са Chrome траке алатки.

Отворите искачући прозор да брзо проверите live резултате, исходе, предстојеће утакмице и табеле без скакања по спортским сајтовима.

Шта добијате:

1️⃣ Live резултате груписане по лигама
2️⃣ Табеле и пласмане
3️⃣ Статистику утакмице када је доступна
4️⃣ Саставе, ток, коментар, вести и линкове за подржане утакмице
5️⃣ Омиљене лиге на врху

Без налога, без непотребних дозвола, без прикупљања личних података.

⏭️ Ово проширење је 100% open source и направљено са фокусом на приватност. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype остаје једноставан: отворите, проверите резултат, вратите се на оно што сте радили.

Бесплатно за коришћење.`,

  українська: `⚽ Hype - Живі футбольні рахунки — безкоштовний, швидкий і охайний спосіб стежити за футболом з панелі Chrome.

Відкрийте спливаюче вікно, щоб швидко перевірити live-рахунки, результати, найближчі матчі та таблиці, не стрибаючи між спортивними сайтами.

Що ви отримуєте:

1️⃣ Live-рахунки, згруповані за лігами
2️⃣ Турнірні таблиці
3️⃣ Статистику матчу, коли вона доступна
4️⃣ Склади, хронологію, коментарі, новини та посилання для підтримуваних матчів
5️⃣ Улюблені ліги закріплені зверху

Без облікового запису, без зайвих дозволів, без збору персональних даних.

⏭️ Це розширення на 100% open source і створене з акцентом на приватність. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype залишається простим: відкрий, перевір рахунок, повернися до своїх справ.

Безкоштовно.`,

  עברית: `⚽ Hype - תוצאות כדורגל בשידור חי הוא דרך חינמית, מהירה ונקייה לעקוב אחרי כדורגל מסרגל הכלים של Chrome.

פתחו את החלון הקופץ כדי לבדוק במהירות תוצאות חיות, תוצאות, משחקים קרובים וטבלאות בלי לקפוץ בין אתרי ספורט.

מה תקבלו:

1️⃣ תוצאות חיות מקובצות לפי ליגה
2️⃣ טבלאות ודירוגים
3️⃣ סטטיסטיקת משחק כשהיא זמינה
4️⃣ הרכב, ציר זמן, פרשנות, חדשות וקישורים למשחקים נתמכים
5️⃣ ליגות מועדפות בראש

בלי חשבון, בלי הרשאות מיותרות, בלי איסוף נתונים אישיים.

⏭️ התוסף הזה הוא 100% קוד פתוח ומעוצב עם דגש על פרטיות. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype נשאר פשוט: פתחו, בדקו את התוצאה, חזרו למה שעשיתם.

חינם לשימוש.`,

  فارسی: `⚽ Hype - نتایج زنده فوتبال راهی رایگان، سریع و مرتب برای دنبال‌کردن فوتبال از نوار ابزار کروم است.

پنجره بازشو را باز کنید تا بدون پرش بین سایت‌های ورزشی، امتیازهای زنده، نتایج، بازی‌های آینده و جداول را سریع ببینید.

چه چیزی می‌گیرید:

1️⃣ امتیازهای زنده گروه‌بندی‌شده بر اساس لیگ
2️⃣ جداول و رده‌بندی
3️⃣ آمار بازی در صورت موجود بودن
4️⃣ ترکیب، خط زمانی، گزارش، اخبار و پیوندها برای بازی‌های پشتیبانی‌شده
5️⃣ لیگ‌های موردعلاقه در بالا

بدون حساب، بدون مجوزهای غیرضروری، بدون جمع‌آوری داده شخصی.

⏭️ این افزونه ۱۰۰٪ متن‌باز است و با تمرکز کامل بر حریم خصوصی طراحی شده. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ساده می‌ماند: باز کنید، نتیجه را ببینید، به کارتان برگردید.

رایگان برای استفاده.`,

  Filipino: `⚽ Hype - Live Football Scores ay isang libre, mabilis, at malinis na paraan para sundan ang football mula sa Chrome toolbar.

Buksan ang popup para mabilis na tingnan ang live scores, resulta, paparating na laban, at standings nang hindi tumatalon sa mga sports website.

Ano ang makukuha mo:

1️⃣ Live scores na naka-group ayon sa liga
2️⃣ League tables at standings
3️⃣ Match stats kapag available
4️⃣ Lineups, timeline, commentary, balita, at links para sa suportadong laban
5️⃣ Paboritong liga na naka-pin sa itaas

Walang account, walang hindi kailangang permission, walang personal data collection.

⏭️ Ang extension na ito ay 100% open source at idinisenyo para sa privacy. ⏭️
https://github.com/Atakan0zkan/HypeScore

Simpleng-simple ang Hype: buksan, tingnan ang score, bumalik sa ginagawa mo.

Libre gamitin.`,

  Indonesia: `⚽ Hype - Skor sepak bola langsung adalah cara gratis, cepat, dan bersih untuk mengikuti sepak bola dari bilah alat Chrome.

Buka pop-up untuk cepat mengecek skor live, hasil, pertandingan mendatang, dan klasemen tanpa berpindah-pindah situs olahraga.

Yang Anda dapatkan:

1️⃣ Skor live dikelompokkan per liga
2️⃣ Tabel dan klasemen
3️⃣ Statistik pertandingan jika tersedia
4️⃣ Susunan pemain, linimasa, komentar, berita, dan tautan untuk pertandingan yang didukung
5️⃣ Liga favorit dipasang di atas

Tanpa akun, tanpa izin yang tidak perlu, tanpa pengumpulan data pribadi.

⏭️ Ekstensi ini 100% open source dan dirancang dengan fokus penuh pada privasi. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype tetap sederhana: buka, cek skor, kembali ke yang sedang Anda kerjakan.

Gratis digunakan.`,

  Kiswahili: `⚽ Hype - Matokeo ya mpira wa miguu moja kwa moja ni njia ya bure, ya haraka na safi ya kufuatilia mpira kutoka kwenye upau wa zana wa Chrome.

Fungua dirisha linalojitokeza ili kuangalia haraka alama za live, matokeo, mechi zijazo na meza bila kuruka kati ya tovuti za michezo.

Unachopata:

1️⃣ Alama za live zilizopangwa kwa ligi
2️⃣ Meza na nafasi
3️⃣ Takwimu za mechi zinapopatikana
4️⃣ Orodha za wachezaji, mfululizo, ufafanuzi, habari na viungo kwa mechi zinazotumika
5️⃣ Ligi unazopenda zimebandikwa juu

Bila akaunti, bila ruhusa zisizohitajika, bila kukusanya data binafsi.

⏭️ Kiendelezi hiki ni open source 100% na kimeundwa kwa kuzingatia faragha. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype inabaki rahisi: fungua, angalia alama, rudi kwenye ulichokuwa ukifanya.

Bure kutumia.`,

  Melayu: `⚽ Hype - Skor bola sepak langsung ialah cara percuma, pantas dan kemas untuk mengikuti bola sepak dari bar alat Chrome.

Buka tetingkap timbul untuk menyemak skor live, keputusan, perlawanan akan datang dan carta kedudukan tanpa melompat antara laman sukan.

Apa yang anda dapat:

1️⃣ Skor live dikumpulkan mengikut liga
2️⃣ Carta kedudukan
3️⃣ Statistik perlawanan apabila tersedia
4️⃣ Barisan pemain, garis masa, ulasan, berita dan pautan untuk perlawanan yang disokong
5️⃣ Liga kegemaran dipinkan di atas

Tiada akaun, tiada kebenaran yang tidak perlu, tiada pengumpulan data peribadi.

⏭️ Sambungan ini 100% sumber terbuka dan direka dengan fokus privasi. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype kekal ringkas: buka, semak skor, kembali kepada apa yang anda lakukan.

Percuma digunakan.`,

  "Tiếng Việt": `⚽ Hype - Tỷ số bóng đá trực tiếp là cách miễn phí, nhanh và gọn để theo dõi bóng đá từ thanh công cụ Chrome.

Mở cửa sổ bật lên để nhanh chóng xem tỷ số live, kết quả, trận sắp đá và bảng xếp hạng mà không phải nhảy giữa các trang thể thao.

Bạn nhận được:

1️⃣ Tỷ số live nhóm theo giải
2️⃣ Bảng xếp hạng
3️⃣ Thống kê trận khi có
4️⃣ Đội hình, diễn biến, bình luận, tin tức và liên kết cho các trận được hỗ trợ
5️⃣ Giải yêu thích ghim trên cùng

Không tài khoản, không quyền thừa, không thu thập dữ liệu cá nhân.

⏭️ Tiện ích này 100% mã nguồn mở và được thiết kế hướng tới quyền riêng tư. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype giữ mọi thứ đơn giản: mở, xem tỷ số, quay lại việc bạn đang làm.

Miễn phí sử dụng.`,

  ไทย: `⚽ Hype - ผลบอลสด คือวิธีฟรี รวดเร็ว และสะอาดในการติดตามฟุตบอลจากแถบเครื่องมือ Chrome

เปิดป๊อปอัปเพื่อเช็คผลสด ผลแข่ง นัดที่จะมาถึง และตารางคะแนนอย่างรวดเร็ว โดยไม่ต้องกระโดดไปมาระหว่างเว็บกีฬา

สิ่งที่คุณได้:

1️⃣ ผลสดจัดกลุ่มตามลีก
2️⃣ ตารางคะแนนและอันดับ
3️⃣ สถิติแมตช์เมื่อมี
4️⃣ รายชื่อผู้เล่น ไทม์ไลน์ คำบรรยาย ข่าว และลิงก์สำหรับแมตช์ที่รองรับ
5️⃣ ลีกโปรดปักหมุดด้านบน

ไม่ต้องมีบัญชี ไม่ขอสิทธิ์เกินจำเป็น ไม่เก็บข้อมูลส่วนบุคคล

⏭️ ส่วนขยายนี้เป็นโอเพนซอร์ส 100% และออกแบบโดยโฟกัสความเป็นส่วนตัว ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype เรียบง่าย: เปิด ดูสกอร์ แล้วกลับไปทำสิ่งที่คุณกำลังทำ

ใช้ฟรี`,

  አማርኛ: `⚽ Hype - የቀጥታ እግር ኳስ ውጤቶች ከChrome የመሳሪያ አሞሌ በነጻ፣ በፍጥነት እና በንፁህ መንገድ እግር ኳስ ለመከታተል ነው።

የብቅ-ባይ መስኮቱን በመክፈት በስፖርት ድረ-ገጾች መካከል ሳትዘሉ ቀጥታ ውጤቶችን፣ ውጤቶችን፣ መጪ ጨዋታዎችን እና ሰንጠረዦችን በፍጥነት ይመልከቱ።

ምን ያገኛሉ፦

1️⃣ በሊግ የተከፋፈሉ ቀጥታ ውጤቶች
2️⃣ የሊግ ሰንጠረዦች
3️⃣ ሲገኝ የጨዋታ ስታቲስቲክስ
4️⃣ ለሚደገፉ ጨዋታዎች መስመሮች፣ ጊዜ መስመር፣ ትንታኔ፣ ዜና እና አገናኞች
5️⃣ ተወዳጅ ሊጎች በላይ ተጣብቀዋል

መለያ የለም፣ አላስፈላጊ ፈቃዶች የሉም፣ የግል መረጃ አይሰበሰብም።

⏭️ ይህ ቅጥያ 100% ክፍት ምንጭ ነው እና ሙሉ በሙሉ በግላዊነት ላይ ያተኮረ ነው። ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ቀላል ይቆያል፦ ክፈት፣ ውጤቱን ተመልከት፣ ወደ ሥራህ ተመለስ።

በነጻ ለመጠቀም።`,

  मराठी: `⚽ Hype - थेट फुटबॉल स्कोअर हे Chrome टूलबारवरून फुटबॉल फॉलो करण्याचा मोफत, जलद आणि स्वच्छ मार्ग आहे.

पॉपअप उघडून स्पोर्ट्स वेबसाइट्सवर उड्या न मारता थेट स्कोअर, निकाल, आगामी सामने आणि लीग तक्ते पटकन तपासा.

तुम्हाला मिळते:

1️⃣ लीगनुरूप गटबद्ध थेट स्कोअर
2️⃣ लीग तक्ते
3️⃣ उपलब्ध असल्यास सामना आकडेवारी
4️⃣ समर्थित सामन्यांसाठी संघ रचना, टाइमलाइन, समालोचन, बातम्या आणि दुवे
5️⃣ आवडत्या लीग वर पिन

खाते नाही, अनावश्यक परवानग्या नाहीत, वैयक्तिक डेटा संकलन नाही.

⏭️ हे विस्तार 100% ओपन सोर्स आहे आणि पूर्णपणे गोपनीयता-केंद्रित आहे. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype सोपे राहते: उघडा, स्कोअर तपासा, आपल्या कामाकडे परत जा.

मोफत वापरा.`,

  বাংলা: `⚽ Hype - লাইভ ফুটবল স্কোর Chrome টুলবার থেকে ফুটবল অনুসরণের একটি বিনামূল্যে, দ্রুত ও পরিচ্ছন্ন উপায়।

পপআপ খুলে স্পোর্টস ওয়েবসাইটগুলোর মধ্যে না ঘুরেই লাইভ স্কোর, ফলাফল, আসন্ন ম্যাচ ও লিগ টেবিল দ্রুত দেখুন।

আপনি পাবেন:

1️⃣ লিগ অনুযায়ী গোষ্ঠীবদ্ধ লাইভ স্কোর
2️⃣ লিগ টেবিল ও স্ট্যান্ডিং
3️⃣ উপলব্ধ হলে ম্যাচ পরিসংখ্যান
4️⃣ সমর্থিত ম্যাচের লাইনআপ, টাইমলাইন, ধারাভাষ্য, খবর ও লিঙ্ক
5️⃣ প্রিয় লিগ উপরে পিন

কোনো অ্যাকাউন্ট নেই, অপ্রয়োজনীয় অনুমতি নেই, ব্যক্তিগত ডেটা সংগ্রহ নেই।

⏭️ এই এক্সটেনশন ১০০% ওপেন সোর্স এবং সম্পূর্ণ গোপনীয়তা-কেন্দ্রিক। ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype সরল থাকে: খুলুন, স্কোর দেখুন, যা করছিলেন তাতে ফিরে যান।

বিনামূল্যে ব্যবহারযোগ্য।`,

  ગુજરાતી: `⚽ Hype - લાઇવ ફૂટબોલ સ્કોર એ Chrome ટૂલબારથી ફૂટબોલ અનુસરવાની મફત, ઝડપી અને સાફ રીત છે.

પૉપઅપ ખોલીને સ્પોર્ટ્સ વેબસાઇટ્સ વચ્ચે કૂદ્યા વગર લાઇવ સ્કોર, પરિણામો, આગામી મેચ અને લીગ કોષ્ટકો ઝડપથી તપાસો.

તમને મળે છે:

1️⃣ લીગ પ્રમાણે જૂથબદ્ધ લાઇવ સ્કોર
2️⃣ લીગ કોષ્ટકો
3️⃣ ઉપલબ્ધ હોય ત્યારે મેચ આંકડા
4️⃣ સમર્થિત મેચો માટે લાઇનઅપ, ટાઇમલાઇન, કોમેન્ટ્રી, સમાચાર અને લિંક
5️⃣ મનપસંદ લીગ ઉપર પિન

એકાઉન્ટ નહીં, બિનજરૂરી પરવાનગીઓ નહીં, વ્યક્તિગત ડેટા સંગ્રહ નહીં.

⏭️ આ એક્સટેન્શન 100% ઓપન સોર્સ છે અને સંપૂર્ણ ગોપનીયતા-કેન્દ્રિત છે. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype સરળ રહે છે: ખોલો, સ્કોર તપાસો, તમે જે કરતા હતા તે પર પાછા જાઓ.

મફત વાપરો.`,

  தமிழ்: `⚽ Hype - நேரடி கால்பந்து மதிப்பெண்கள் Chrome கருவிப்பட்டியில் இருந்து கால்பந்தைப் பின்தொடர இலவசமான, வேகமான, சுத்தமான வழி.

பாப்அப்பைத் திறந்து விளையாட்டு இணையதளங்களுக்கு இடையே குதிக்காமல் நேரடி மதிப்பெண்கள், முடிவுகள், வரவிருக்கும் போட்டிகள், லீக் அட்டவணைகளை விரைவாகப் பாருங்கள்.

நீங்கள் பெறுவது:

1️⃣ லீக் வாரியாக தொகுக்கப்பட்ட நேரடி மதிப்பெண்கள்
2️⃣ லீக் அட்டவணைகள்
3️⃣ கிடைக்கும்போது போட்டிப் புள்ளிவிவரங்கள்
4️⃣ ஆதரிக்கப்படும் போட்டிகளுக்கான அணி அமைப்பு, நேரக்கோடு, விளக்கம், செய்திகள், இணைப்புகள்
5️⃣ பிடித்த லீக்குகள் மேலே பின்

கணக்கு இல்லை, தேவையற்ற அனுமதிகள் இல்லை, தனிப்பட்ட தரவு சேகரிப்பு இல்லை.

⏭️ இந்த நீட்டிப்பு 100% திறந்த மூலமும் முழுமையாக தனியுரிமை மையமாகவும் வடிவமைக்கப்பட்டுள்ளது. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype எளிமையாக இருக்கும்: திற, மதிப்பெண்ணைப் பார், செய்துகொண்டிருந்ததற்குத் திரும்பு.

இலவசமாகப் பயன்படுத்தலாம்.`,

  తెలుగు: `⚽ Hype - లైవ్ ఫుట్‌బాల్ స్కోర్లు Chrome టూల్‌బార్ నుంచి ఫుట్‌బాల్ ఫాలో అవ్వడానికి ఉచిత, వేగవంతమైన, స్వచ్ఛమైన మార్గం.

పాపప్ తెరిచి స్పోర్ట్స్ వెబ్‌సైట్ల మధ్య దూకకుండా లైవ్ స్కోర్లు, ఫలితాలు, రాబోయే మ్యాచ్‌లు, లీగ్ పట్టికలు త్వరగా చూడండి.

మీకు లభించేది:

1️⃣ లీగ్ వారీగా సమూహీకరించిన లైవ్ స్కోర్లు
2️⃣ లీగ్ పట్టికలు
3️⃣ అందుబాటులో ఉన్నప్పుడు మ్యాచ్ గణాంకాలు
4️⃣ మద్దతు ఉన్న మ్యాచ్‌లకు లైనప్‌లు, టైమ్‌లైన్, కామెంటరీ, వార్తలు, లింకులు
5️⃣ ఇష్టమైన లీగ్‌లు పైన పిన్

ఖాతా లేదు, అనవసర అనుమతులు లేవు, వ్యక్తిగత డేటా సేకరణ లేదు.

⏭️ ఈ ఎక్స్‌టెన్షన్ 100% ఓపెన్ సోర్స్ మరియు పూర్తిగా గోప్యతా-కేంద్రీకృతం. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype సరళంగా ఉంటుంది: తెరవండి, స్కోర్ చూడండి, మీరు చేస్తున్న పనికి తిరిగి వెళ్లండి.

ఉచితంగా ఉపయోగించండి.`,

  ಕನ್ನಡ: `⚽ Hype - ಲೈವ್ ಫುಟ್‌ಬಾಲ್ ಸ್ಕೋರ್‌ಗಳು Chrome ಟೂಲ್‌ಬಾರ್‌ನಿಂದ ಫುಟ್‌ಬಾಲ್ ಅನುಸರಿಸುವ ಉಚಿತ, ವೇಗದ ಮತ್ತು ಸ್ವಚ್ಛ ಮಾರ್ಗ.

ಪಾಪ್‌ಅಪ್ ತೆರೆದು ಸ್ಪೋರ್ಟ್ಸ್ ವೆಬ್‌ಸೈಟ್‌ಗಳ ನಡುವೆ ಹಾರದೆ ಲೈವ್ ಸ್ಕೋರ್‌ಗಳು, ಫಲಿತಾಂಶಗಳು, ಮುಂಬರುವ ಪಂದ್ಯಗಳು ಮತ್ತು ಲೀಗ್ ಕೋಷ್ಟಕಗಳನ್ನು ತ್ವರಿತವಾಗಿ ಪರಿಶೀಲಿಸಿ.

ನೀವು ಪಡೆಯುವುದು:

1️⃣ ಲೀಗ್‌ವಾರು ಗುಂಪು ಮಾಡಿದ ಲೈವ್ ಸ್ಕೋರ್‌ಗಳು
2️⃣ ಲೀಗ್ ಕೋಷ್ಟಕಗಳು
3️⃣ ಲಭ್ಯವಿದ್ದಾಗ ಪಂದ್ಯದ ಅಂಕಿಅಂಶಗಳು
4️⃣ ಬೆಂಬಲಿತ ಪಂದ್ಯಗಳಿಗೆ ಲೈನಪ್, ಟೈಮ್‌ಲೈನ್, ವ್ಯಾಖ್ಯಾನ, ಸುದ್ದಿ ಮತ್ತು ಲಿಂಕ್‌ಗಳು
5️⃣ ಮೆಚ್ಚಿನ ಲೀಗ್‌ಗಳು ಮೇಲೆ ಪಿನ್

ಖಾತೆ ಇಲ್ಲ, ಅನಗತ್ಯ ಅನುಮತಿಗಳಿಲ್ಲ, ವೈಯಕ್ತಿಕ ಡೇಟಾ ಸಂಗ್ರಹವಿಲ್ಲ.

⏭️ ಈ ವಿಸ್ತರಣೆ 100% ಓಪನ್ ಸೋರ್ಸ್ ಮತ್ತು ಸಂಪೂರ್ಣ ಗೌಪ್ಯತಾ-ಕೇಂದ್ರಿತ. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ಸರಳವಾಗಿರುತ್ತದೆ: ತೆರೆಯಿರಿ, ಸ್ಕೋರ್ ನೋಡಿ, ನೀವು ಮಾಡುತ್ತಿದ್ದುದಕ್ಕೆ ಹಿಂತಿರುಗಿ.

ಉಚಿತವಾಗಿ ಬಳಸಿ.`,

  മലയാളം: `⚽ Hype - ലൈവ് ഫുട്ബോൾ സ്കോറുകൾ Chrome ടൂൾബാറിൽ നിന്ന് ഫുട്ബോൾ ഫോളോ ചെയ്യാനുള്ള സൗജന്യവും വേഗത്തിലുള്ളതും വൃത്തിയുള്ളതുമായ മാർഗം.

പോപ്പപ്പ് തുറന്ന് സ്പോർട്സ് വെബ്സൈറ്റുകൾക്കിടയിൽ ചാടാതെ ലൈവ് സ്കോറുകൾ, ഫലങ്ങൾ, വരാനിരിക്കുന്ന മത്സരങ്ങൾ, ലീഗ് പട്ടികകൾ വേഗത്തിൽ പരിശോധിക്കുക.

നിങ്ങൾക്ക് ലഭിക്കുന്നത്:

1️⃣ ലീഗ് അനുസരിച്ച് ഗ്രൂപ്പ് ചെയ്ത ലൈവ് സ്കോറുകൾ
2️⃣ ലീഗ് പട്ടികകൾ
3️⃣ ലഭ്യമാകുമ്പോൾ മത്സര സ്ഥിതിവിവരക്കണക്കുകൾ
4️⃣ പിന്തുണയുള്ള മത്സരങ്ങൾക്ക് ലൈനപ്പ്, ടൈംലൈൻ, കമന്ററി, വാർത്തകൾ, ലിങ്കുകൾ
5️⃣ പ്രിയപ്പെട്ട ലീഗുകൾ മുകളിൽ പിൻ

അക്കൗണ്ട് ഇല്ല, അനാവശ്യ അനുമതികൾ ഇല്ല, വ്യക്തിഗത ഡാറ്റ ശേഖരണം ഇല്ല.

⏭️ ഈ എക്സ്റ്റൻഷൻ 100% ഓപ്പൺ സോഴ്സും പൂർണ്ണമായും സ്വകാര്യതാ-കേന്ദ്രീകൃതവുമാണ്. ⏭️
https://github.com/Atakan0zkan/HypeScore

Hype ലളിതമായി നിലനിൽക്കുന്നു: തുറക്കുക, സ്കോർ നോക്കുക, ചെയ്തുകൊണ്ടിരുന്നതിലേക്ക് മടങ്ങുക.

സൗജന്യമായി ഉപയോഗിക്കുക.`,
});

const lines = [
  "# Chrome Web Store Listing Copy",
  "",
  "Use these as the long description text for each Chrome Web Store locale.",
  "English is the master reference. Popup UI locales live under `extension/_locales/`.",
  "Chrome selects the matching `_locales` folder automatically from the browser language.",
  "",
];

for (const [name, body] of Object.entries(LISTINGS)) {
  lines.push(`## ${name}`);
  lines.push("");
  lines.push(body.trim());
  lines.push("");
}

fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(
  `Wrote ${Object.keys(LISTINGS).length} store listing locales to ${OUT}`,
);
