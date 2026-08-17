# Chrome Web Store 产品详情文案

Scribdown 商店上架文案，覆盖扩展支持的全部 10 种语言。

## 各字段填在哪

| 商店字段 | 来源 | 操作 |
| --- | --- | --- |
| 名称 Name | `manifest.json` 的 `__MSG_extName__` | 不需要填，商店从安装包读取 |
| 摘要 Summary（≤132 字符） | `manifest.json` 的 `__MSG_extDescription__` | **不在后台填**，改 `messages.ts` 后跑 `pnpm sync:i18n` 重新打包 |
| 详细说明 Description（≤16000 字符） | 商店后台逐语言填写 | 本文档「详细说明」小节，按语言粘贴 |
| 分类 Category | 商店后台 | 建议 `Developer Tools` |
| 隐私事项 Privacy practices | 商店后台，仅英文 | 本文档「隐私事项」小节 |

> 摘要走安装包，所以要先改 [messages.ts](packages/shared/src/i18n/messages.ts) 的
> `manifest.browserDescription`，执行 `pnpm sync:i18n` 生成 `_locales/*/messages.json`，
> 重新构建后上传新包才会生效。

---

## 一、摘要（改进建议）

当前值是 `Handdrawn markdown rendering experience.`，只说了风格没说功能。建议替换为下列文案，
写进 `packages/shared/src/i18n/messages.ts` 各语言的 `manifest.browserDescription`。

| 语言 | 建议摘要 | 字符数 |
| --- | --- | --- |
| en | Renders any .md page or local Markdown file in place — code highlighting, Mermaid diagrams, table of contents. | 110 |
| zh-CN | 就地渲染 .md 网页与本地 Markdown 文件：代码高亮、Mermaid 图表、目录导航、本地文件自动刷新。 | 57 |
| zh-TW | 就地算繪 .md 網頁與本機 Markdown 檔案：程式碼高亮、Mermaid 圖表、目錄導覽、本機檔案自動重新整理。 | 60 |
| ja | .md ページやローカルの Markdown をその場で整形。コードハイライト、Mermaid 図、目次、自動更新。 | 58 |
| ko | .md 페이지와 로컬 Markdown 파일을 즉시 렌더링. 코드 하이라이트, Mermaid 다이어그램, 목차 제공. | 64 |
| es | Renderiza páginas .md y archivos Markdown locales al instante: resaltado, diagramas Mermaid e índice. | 101 |
| fr | Affiche les pages .md et vos fichiers Markdown locaux : coloration syntaxique, diagrammes Mermaid, sommaire. | 108 |
| de | Rendert .md-Seiten und lokale Markdown-Dateien direkt: Syntaxhervorhebung, Mermaid-Diagramme, Inhaltsverzeichnis. | 113 |
| pt-BR | Renderiza páginas .md e arquivos Markdown locais na hora: destaque de sintaxe, diagramas Mermaid e sumário. | 107 |
| ru | Отображает .md-страницы и локальные Markdown-файлы: подсветка кода, диаграммы Mermaid, оглавление. | 98 |

---

## 二、详细说明（逐语言粘贴到后台）

### English (en)

```text
Scribdown turns raw Markdown into something you can actually read — the moment you open it.

Open any URL ending in .md and Chrome normally hands you a wall of plain text. Scribdown renders it in place, in a warm hand-drawn style, with no build step and no copy-pasting into some other preview tool.

WHAT YOU GET
• Full GitHub-Flavored Markdown — tables, task lists, strikethrough, footnotes
• Syntax highlighting for code blocks, powered by Shiki
• Mermaid diagrams rendered inline, with zoom, pan and a fullscreen view
• A resizable table of contents built from the document's headings
• YAML frontmatter presented as a clean metadata card
• An image viewer with zoom, pan and keyboard shortcuts
• One-click copy for code blocks, tables and the whole document
• Adjustable page width, plus a dark theme that follows your system

WORKS ON YOUR OWN FILES
Switch on "Allow access to file URLs" and Scribdown also takes over local .md files. Auto-refresh re-reads the file every 1 to 60 seconds (2 by default), so the rendered page keeps up while you edit in your own editor.

STAYS OUT OF THE WAY
One toggle in the popup hands the page straight back to Chrome's plain text view.

TEN INTERFACE LANGUAGES
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

PRIVACY
No account, no tracking, no analytics. Scribdown reads only the Markdown file you are looking at, and your settings stay in local browser storage. Raw HTML inside a document is sanitized twice — rehype-sanitize and DOMPurify — before it ever reaches the page.

Open source under the MIT license: https://github.com/share-man-man/scribdown
```

### 简体中文 (zh-CN)

```text
Scribdown 让 Markdown 在打开的那一刻就变得可读。

浏览器打开以 .md 结尾的网址，默认只会甩给你一大片纯文本。Scribdown 就地把它渲染成排版清晰的页面，一套温暖的手绘风格，不需要任何构建步骤，也不用再复制粘贴到别的预览工具里。

功能一览
• 完整支持 GitHub 风格 Markdown —— 表格、任务列表、删除线、脚注
• 代码块语法高亮，由 Shiki 驱动
• Mermaid 图表就地渲染，支持缩放、拖拽与全屏查看
• 依据文档标题自动生成目录侧栏，宽度可拖拽调整
• YAML frontmatter 以独立的元数据卡片呈现
• 图片查看器，支持缩放、拖拽与键盘快捷键
• 代码块、表格、整篇文档均可一键复制
• 页面宽度可调，深色主题跟随系统

也能用在你自己的文件上
开启「允许访问文件网址」后，Scribdown 同样接管本地 .md 文件。自动刷新会每 1 到 60 秒（默认 2 秒）重新读取一次文件，你在自己的编辑器里改，渲染结果同步跟上。

不碍事
弹窗里的开关一关，页面立刻交还给浏览器原本的纯文本视图。

十种界面语言
English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch、Português (Brasil)、Русский。

隐私
不需要账号，不做追踪，不接统计。Scribdown 只读取你正在查看的那个 Markdown 文件，设置项保存在浏览器本地存储里。文档中的原始 HTML 会经过 rehype-sanitize 与 DOMPurify 两层清洗后才进入页面。

MIT 协议开源：https://github.com/share-man-man/scribdown
```

### 繁體中文 (zh-TW)

```text
Scribdown 讓 Markdown 在打開的那一刻就變得好讀。

瀏覽器打開以 .md 結尾的網址，預設只會丟給你一大片純文字。Scribdown 就地把它算繪成排版清晰的頁面，一套溫暖的手繪風格，不需要任何建置步驟，也不用再複製貼上到別的預覽工具裡。

功能一覽
• 完整支援 GitHub 風格 Markdown —— 表格、任務清單、刪除線、註腳
• 程式碼區塊語法高亮，由 Shiki 驅動
• Mermaid 圖表就地算繪，支援縮放、拖曳與全螢幕檢視
• 依文件標題自動產生目錄側欄，寬度可拖曳調整
• YAML frontmatter 以獨立的中繼資料卡片呈現
• 圖片檢視器，支援縮放、拖曳與鍵盤快速鍵
• 程式碼區塊、表格、整篇文件都能一鍵複製
• 頁面寬度可調，深色主題跟隨系統

也能用在你自己的檔案上
開啟「允許存取檔案網址」後，Scribdown 同樣接管本機 .md 檔案。自動重新整理會每 1 到 60 秒（預設 2 秒）重新讀取一次檔案，你在自己的編輯器裡改，算繪結果同步跟上。

不礙事
彈出視窗裡的開關一關，頁面立刻交還給瀏覽器原本的純文字檢視。

十種介面語言
English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch、Português (Brasil)、Русский。

隱私
不需要帳號，不做追蹤，不接統計。Scribdown 只讀取你正在檢視的那個 Markdown 檔案，設定值保存在瀏覽器本機儲存空間。文件中的原始 HTML 會經過 rehype-sanitize 與 DOMPurify 兩層清洗後才進入頁面。

MIT 授權開源：https://github.com/share-man-man/scribdown
```

### 日本語 (ja)

```text
Scribdown は、開いた瞬間から Markdown を読めるものに変えます。

.md で終わる URL をブラウザで開くと、通常はプレーンテキストの塊が表示されるだけです。Scribdown はそれをその場で整形し、温かみのある手描き風のスタイルで表示します。ビルド手順も、別のプレビューツールへのコピペも必要ありません。

主な機能
• GitHub Flavored Markdown に完全対応 — 表、タスクリスト、打ち消し線、脚注
• Shiki によるコードブロックのシンタックスハイライト
• Mermaid 図をインラインで描画。ズーム、パン、全画面表示に対応
• 見出しから自動生成される目次サイドバー（幅はドラッグで調整可能）
• YAML フロントマターを独立したメタデータカードとして表示
• ズーム、パン、キーボードショートカットに対応した画像ビューア
• コードブロック、表、文書全体をワンクリックでコピー
• ページ幅を調整可能。ダークテーマはシステム設定に追従

手元のファイルでも使えます
「ファイルの URL へのアクセスを許可する」を有効にすると、ローカルの .md ファイルも Scribdown が処理します。自動更新は 1〜60 秒ごと（既定は 2 秒）にファイルを読み直すので、使い慣れたエディタで編集しながら表示を追従させられます。

邪魔をしません
ポップアップのスイッチを切れば、ページはすぐにブラウザ本来のプレーンテキスト表示に戻ります。

10 種類の表示言語
English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch、Português (Brasil)、Русский。

プライバシー
アカウント不要、トラッキングなし、アナリティクスなし。Scribdown が読み取るのは表示中の Markdown ファイルだけで、設定はブラウザのローカルストレージに保存されます。文書内の生の HTML は rehype-sanitize と DOMPurify の二重サニタイズを経てから描画されます。

MIT ライセンスのオープンソース: https://github.com/share-man-man/scribdown
```

### 한국어 (ko)

```text
Scribdown은 여는 순간부터 Markdown을 읽을 수 있는 문서로 바꿔 줍니다.

.md로 끝나는 주소를 브라우저에서 열면 보통은 밋밋한 텍스트 덩어리만 나옵니다. Scribdown은 이를 그 자리에서 손그림 느낌의 따뜻한 스타일로 렌더링합니다. 빌드 과정도, 다른 미리보기 도구로 복사해 붙여 넣는 일도 필요 없습니다.

주요 기능
• GitHub Flavored Markdown 완전 지원 — 표, 작업 목록, 취소선, 각주
• Shiki 기반 코드 블록 구문 강조
• Mermaid 다이어그램을 문서 안에서 렌더링, 확대·이동·전체 화면 지원
• 문서의 제목으로 자동 생성되는 목차 사이드바(너비 조절 가능)
• YAML 프런트매터를 별도의 메타데이터 카드로 표시
• 확대, 이동, 키보드 단축키를 지원하는 이미지 뷰어
• 코드 블록, 표, 문서 전체를 클릭 한 번으로 복사
• 페이지 너비 조절, 시스템 설정을 따르는 다크 테마

내 파일에도 그대로
"파일 URL에 대한 액세스 허용"을 켜면 로컬 .md 파일도 Scribdown이 처리합니다. 자동 새로 고침이 1~60초(기본 2초)마다 파일을 다시 읽어, 평소 쓰던 편집기로 수정하는 동안 화면이 따라옵니다.

방해하지 않습니다
팝업의 스위치를 끄면 페이지는 곧바로 브라우저 본래의 일반 텍스트 보기로 돌아갑니다.

10개 인터페이스 언어
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

개인정보
계정 불필요, 추적 없음, 분석 도구 없음. Scribdown은 지금 보고 있는 Markdown 파일만 읽으며, 설정은 브라우저 로컬 저장소에 남습니다. 문서 안의 원본 HTML은 rehype-sanitize와 DOMPurify로 두 번 정제한 뒤에야 화면에 들어갑니다.

MIT 라이선스 오픈소스: https://github.com/share-man-man/scribdown
```

### Español (es)

```text
Scribdown convierte el Markdown en algo legible desde el momento en que lo abres.

Al abrir cualquier URL terminada en .md, el navegador suele mostrarte un muro de texto plano. Scribdown lo renderiza allí mismo, con un estilo cálido dibujado a mano, sin pasos de compilación y sin copiar nada en otra herramienta de vista previa.

QUÉ INCLUYE
• Compatibilidad total con GitHub Flavored Markdown: tablas, listas de tareas, tachado y notas al pie
• Resaltado de sintaxis en los bloques de código, con Shiki
• Diagramas Mermaid renderizados en línea, con zoom, desplazamiento y vista a pantalla completa
• Un índice lateral generado a partir de los encabezados del documento, con ancho ajustable
• El frontmatter YAML presentado como una tarjeta de metadatos
• Visor de imágenes con zoom, desplazamiento y atajos de teclado
• Copia con un clic de bloques de código, tablas o el documento completo
• Ancho de página ajustable y tema oscuro que sigue al del sistema

TAMBIÉN CON TUS PROPIOS ARCHIVOS
Activa "Permitir acceso a URL de archivo" y Scribdown también se encargará de los archivos .md locales. La actualización automática vuelve a leer el archivo cada 1 a 60 segundos (2 por defecto), así la página se mantiene al día mientras editas en tu editor de siempre.

NO ESTORBA
Un interruptor en la ventana emergente devuelve la página a la vista de texto plano del navegador.

DIEZ IDIOMAS DE INTERFAZ
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

PRIVACIDAD
Sin cuenta, sin rastreo, sin analíticas. Scribdown solo lee el archivo Markdown que estás viendo y tus ajustes se quedan en el almacenamiento local del navegador. El HTML sin procesar de un documento pasa por una doble limpieza —rehype-sanitize y DOMPurify— antes de llegar a la página.

Código abierto con licencia MIT: https://github.com/share-man-man/scribdown
```

### Français (fr)

```text
Scribdown rend le Markdown lisible dès l'instant où vous l'ouvrez.

Quand vous ouvrez une URL se terminant par .md, le navigateur vous sert d'ordinaire un mur de texte brut. Scribdown l'affiche sur place, dans un style dessiné à la main, sans étape de compilation et sans rien copier dans un autre outil d'aperçu.

CE QUE VOUS OBTENEZ
• Prise en charge complète du Markdown GitHub : tableaux, listes de tâches, texte barré, notes de bas de page
• Coloration syntaxique des blocs de code, propulsée par Shiki
• Diagrammes Mermaid rendus dans le document, avec zoom, déplacement et plein écran
• Un sommaire latéral construit à partir des titres du document, de largeur ajustable
• Le frontmatter YAML présenté sous forme de fiche de métadonnées
• Une visionneuse d'images avec zoom, déplacement et raccourcis clavier
• Copie en un clic des blocs de code, des tableaux ou du document entier
• Largeur de page réglable et thème sombre aligné sur celui du système

AUSSI SUR VOS PROPRES FICHIERS
Activez « Autoriser l'accès aux URL de fichier » et Scribdown prend aussi en charge les fichiers .md locaux. Le rafraîchissement automatique relit le fichier toutes les 1 à 60 secondes (2 par défaut) : la page suit pendant que vous éditez dans votre éditeur habituel.

DISCRET
Un interrupteur dans la fenêtre contextuelle rend aussitôt la page à l'affichage en texte brut du navigateur.

DIX LANGUES D'INTERFACE
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

CONFIDENTIALITÉ
Aucun compte, aucun suivi, aucune analytique. Scribdown ne lit que le fichier Markdown que vous consultez, et vos réglages restent dans le stockage local du navigateur. Le HTML brut contenu dans un document est nettoyé deux fois — rehype-sanitize puis DOMPurify — avant d'atteindre la page.

Open source sous licence MIT : https://github.com/share-man-man/scribdown
```

### Deutsch (de)

```text
Scribdown macht Markdown in dem Moment lesbar, in dem Sie es öffnen.

Öffnen Sie eine URL, die auf .md endet, zeigt der Browser normalerweise nur eine Wand aus reinem Text. Scribdown rendert sie direkt an Ort und Stelle, in einem warmen, handgezeichneten Stil — ohne Build-Schritt und ohne Umweg über ein anderes Vorschauwerkzeug.

DAS STECKT DRIN
• Vollständige Unterstützung für GitHub Flavored Markdown: Tabellen, Aufgabenlisten, Durchstreichungen, Fußnoten
• Syntaxhervorhebung für Codeblöcke, umgesetzt mit Shiki
• Mermaid-Diagramme direkt im Dokument, mit Zoom, Verschieben und Vollbildansicht
• Ein Inhaltsverzeichnis aus den Überschriften des Dokuments, in der Breite verstellbar
• YAML-Frontmatter als eigene Metadatenkarte dargestellt
• Ein Bildbetrachter mit Zoom, Verschieben und Tastenkürzeln
• Codeblöcke, Tabellen und das ganze Dokument per Klick kopieren
• Einstellbare Seitenbreite und ein dunkles Design, das der Systemeinstellung folgt

AUCH FÜR IHRE EIGENEN DATEIEN
Aktivieren Sie „Zugriff auf Datei-URLs zulassen", dann übernimmt Scribdown auch lokale .md-Dateien. Die automatische Aktualisierung liest die Datei alle 1 bis 60 Sekunden neu (Standard: 2), sodass die Ansicht mitläuft, während Sie in Ihrem gewohnten Editor arbeiten.

BLEIBT IM HINTERGRUND
Ein Schalter im Popup gibt die Seite sofort an die reine Textansicht des Browsers zurück.

ZEHN OBERFLÄCHENSPRACHEN
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

DATENSCHUTZ
Kein Konto, kein Tracking, keine Analyse. Scribdown liest ausschließlich die Markdown-Datei, die Sie gerade ansehen; Ihre Einstellungen bleiben im lokalen Speicher des Browsers. Rohes HTML in einem Dokument wird doppelt bereinigt — mit rehype-sanitize und DOMPurify — bevor es die Seite erreicht.

Open Source unter der MIT-Lizenz: https://github.com/share-man-man/scribdown
```

### Português (Brasil) (pt-BR)

```text
O Scribdown deixa o Markdown legível no instante em que você o abre.

Ao abrir qualquer URL terminada em .md, o navegador costuma entregar um paredão de texto puro. O Scribdown renderiza tudo ali mesmo, em um estilo desenhado à mão, sem etapa de build e sem precisar colar nada em outra ferramenta de visualização.

O QUE VOCÊ GANHA
• Suporte completo ao GitHub Flavored Markdown: tabelas, listas de tarefas, texto riscado e notas de rodapé
• Destaque de sintaxe nos blocos de código, com Shiki
• Diagramas Mermaid renderizados no documento, com zoom, arrasto e tela cheia
• Um sumário lateral montado a partir dos títulos do documento, com largura ajustável
• O frontmatter YAML exibido como um cartão de metadados
• Visualizador de imagens com zoom, arrasto e atalhos de teclado
• Cópia em um clique de blocos de código, tabelas ou do documento inteiro
• Largura de página ajustável e tema escuro que acompanha o do sistema

TAMBÉM NOS SEUS ARQUIVOS
Ative "Permitir acesso a URLs de arquivo" e o Scribdown passa a cuidar também dos arquivos .md locais. A atualização automática relê o arquivo a cada 1 a 60 segundos (2 por padrão), então a página acompanha enquanto você edita no seu editor de sempre.

NÃO ATRAPALHA
Um botão no popup devolve a página imediatamente à visualização de texto puro do navegador.

DEZ IDIOMAS DE INTERFACE
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

PRIVACIDADE
Sem conta, sem rastreamento, sem análise de uso. O Scribdown lê apenas o arquivo Markdown que você está vendo, e suas preferências ficam no armazenamento local do navegador. O HTML bruto dentro de um documento passa por dupla sanitização — rehype-sanitize e DOMPurify — antes de chegar à página.

Código aberto sob licença MIT: https://github.com/share-man-man/scribdown
```

### Русский (ru)

```text
Scribdown превращает Markdown в читаемый документ в тот же момент, когда вы его открываете.

Откройте любой адрес, оканчивающийся на .md, и браузер обычно покажет вам сплошную стену простого текста. Scribdown отображает его прямо на месте, в тёплом рисованном стиле — без сборки и без копирования в какой-то другой инструмент предпросмотра.

ЧТО ВНУТРИ
• Полная поддержка GitHub Flavored Markdown: таблицы, списки задач, зачёркивание, сноски
• Подсветка синтаксиса в блоках кода на основе Shiki
• Диаграммы Mermaid прямо в документе — с масштабированием, перетаскиванием и полноэкранным режимом
• Боковое оглавление, собранное из заголовков документа, с настраиваемой шириной
• YAML-фронтматтер в виде отдельной карточки метаданных
• Просмотрщик изображений с масштабированием, перетаскиванием и горячими клавишами
• Копирование блоков кода, таблиц и документа целиком в один клик
• Настраиваемая ширина страницы и тёмная тема, следующая за системной

РАБОТАЕТ И С ВАШИМИ ФАЙЛАМИ
Включите «Разрешить доступ к файлам по URL», и Scribdown возьмёт на себя также локальные .md-файлы. Автообновление перечитывает файл каждые 1–60 секунд (по умолчанию 2), поэтому страница не отстаёт, пока вы правите текст в привычном редакторе.

НЕ МЕШАЕТ
Один переключатель во всплывающем окне сразу возвращает страницу к обычному текстовому виду браузера.

ДЕСЯТЬ ЯЗЫКОВ ИНТЕРФЕЙСА
English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português (Brasil), Русский.

КОНФИДЕНЦИАЛЬНОСТЬ
Без аккаунта, без слежки, без аналитики. Scribdown читает только тот Markdown-файл, который вы просматриваете, а настройки остаются в локальном хранилище браузера. Необработанный HTML внутри документа проходит двойную очистку — rehype-sanitize и DOMPurify — прежде чем попасть на страницу.

Открытый исходный код под лицензией MIT: https://github.com/share-man-man/scribdown
```

---

## 三、隐私事项（Privacy practices 标签页，仅英文）

**Single purpose**

```text
Scribdown renders Markdown documents that the user opens in Chrome — both .md URLs on the web and local .md files — as formatted, readable pages instead of plain text.
```

**Permission justification**

| 权限 | 理由 |
| --- | --- |
| `storage` | ```Stores the user's own preferences locally: whether the extension is enabled, the interface language, and whether local-file auto-refresh is on and at what interval.``` |
| `alarms` | ```Schedules the periodic re-read of a local .md file that powers the auto-refresh feature, so the rendered page follows edits made in an external editor.``` |
| `host_permissions` (`http://*/*.md`, `https://*/*.md`) | ```Needed to replace the browser's plain-text view of a Markdown URL with the rendered document. Only URLs ending in .md are matched.``` |
| `file:///*` | ```Needed to render and auto-refresh Markdown files the user opens from their own disk. This is optional and only takes effect if the user turns on "Allow access to file URLs".``` |

**Data usage**：全部不勾选。Scribdown 不收集、不传输任何用户数据；不含远程代码（`content_security_policy` 限定 `script-src 'self'`）。

**Are you using remote code?** → No, I am not using remote code

---

## 事实核对依据

文案中的每项声明对应的代码位置：

- GFM / frontmatter / Shiki / Mermaid / 双层清洗 → [markdown-renderer/package.json](packages/markdown-renderer/package.json) 依赖
- 自动刷新 1–60 秒、默认 2 秒 → [storage.ts:30-40](apps/browser-extension/src/config/storage.ts:30)
- 10 种界面语言 → [locales.ts](packages/shared/src/i18n/locales.ts) 的 `SUPPORTED_LOCALES`
- 深色主题跟随系统 → [tokens.css:177](packages/ui-handdrawn/src/styles/tokens.css:177) 的 `prefers-color-scheme`
- 目录可拖拽调宽 → [constants.ts:263-273](packages/shared/src/constants.ts:263) 的 `TOC_WIDTH_MIN_PX` / `TOC_WIDTH_MAX_PX`
- 无追踪 → `apps/browser-extension/src` 下无任何统计 SDK，网络请求仅指向被查看的 .md 文件
- 权限清单 → 构建产物 `manifest.json`：`storage`、`alarms`、`http(s)://*/*.md`、`file:///*`
