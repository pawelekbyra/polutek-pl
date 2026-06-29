export type Tech = 'roughjs' | 'perfect-freehand' | 'rough-notation' | 'wired-elements' | 'custom SVG' | 'CSS/SVG';
export type Status = 'kandydat' | 'inspiracja' | 'eksperyment' | 'raczej nie';

export interface KatalogItem {
  id: string;
  name: string;
  tech: Tech;
  description: string;
  useCase: string;
  status: Status;
  params: Record<string, any>;
}

export interface KatalogSection {
  id: string;
  title: string;
  items: KatalogItem[];
}

export const sections: KatalogSection[] = [
  {
    id: 'L',
    title: 'Linie i kreski',
    items: [
      { id: 'L1', name: 'RoughJS cienka linia', tech: 'roughjs', description: 'Podstawowa linia o niskim roughness.', useCase: 'separator, obrys', status: 'kandydat', params: { roughness: 1, strokeWidth: 1 } },
      { id: 'L2', name: 'RoughJS mocniejsza linia', tech: 'roughjs', description: 'Grubsza linia, wyraźniejszy ślad.', useCase: 'akcent', status: 'kandydat', params: { roughness: 1.5, strokeWidth: 3 } },
      { id: 'L3', name: 'RoughJS linia z dużym roughness', tech: 'roughjs', description: 'Bardzo "pijana" linia, duże odchylenia.', useCase: 'stylizacja ekspresyjna', status: 'inspiracja', params: { roughness: 4, strokeWidth: 2 } },
      { id: 'L4', name: 'RoughJS linia z dużym bowing', tech: 'roughjs', description: 'Linia wygięta w łuk.', useCase: 'organiczne kształty', status: 'eksperyment', params: { bowing: 6, strokeWidth: 2 } },
      { id: 'L5', name: 'RoughJS stabilny seed', tech: 'roughjs', description: 'Linia, która nie skacze przy re-renderze.', useCase: 'UI stałe', status: 'kandydat', params: { seed: 42, roughness: 1.5 } },
      { id: 'L6', name: 'Perfect Freehand cienka organiczna kreska', tech: 'perfect-freehand', description: 'Symulacja nacisku pióra.', useCase: 'doodle, odręczny dopisek', status: 'kandydat', params: { size: 4, thinning: 0.5, smoothing: 0.5 } },
      { id: 'L7', name: 'Perfect Freehand grubsza organiczna kreska', tech: 'perfect-freehand', description: 'Efekt markera.', useCase: 'nagłówek, separator', status: 'inspiracja', params: { size: 12, thinning: 0.7, smoothing: 0.5 } },
      { id: 'L8', name: 'Perfect Freehand kreska z taperem', tech: 'perfect-freehand', description: 'Zwężające się końce.', useCase: 'strzałki, wskazówki', status: 'eksperyment', params: { size: 8, start: { taper: 20 }, end: { taper: 20 } } },
      { id: 'L9', name: 'Custom SVG path — prawie prosta', tech: 'custom SVG', description: 'Ręcznie zdefiniowany path z lekką niedoskonałością.', useCase: 'lekki separator', status: 'kandydat', params: { path: 'M 0 0 Q 50 2 100 0' } },
      { id: 'L10', name: 'Custom SVG path — podwójna poprawiana', tech: 'custom SVG', description: 'Dwie linie obok siebie imitujące poprawianie ruchu.', useCase: 'mocny akcent', status: 'inspiracja', params: { iterations: 2 } },
      { id: 'L11', name: 'Custom SVG path — nerwowa kreska', tech: 'custom SVG', description: 'Szybki, niedbały ruch.', useCase: 'szkicowy UI', status: 'eksperyment', params: { jitter: 5 } },
      { id: 'L12', name: 'Porównanie technik', tech: 'custom SVG', description: 'Zestawienie tych samych linii w różnych tech.', useCase: 'decyzja o silniku', status: 'kandydat', params: {} },
    ]
  },
  {
    id: 'B',
    title: 'Ramki i obrysy',
    items: [
      { id: 'B1', name: 'RoughJS ramka małej karty', tech: 'roughjs', description: 'Prostokąt o lekkim roughness.', useCase: 'karta wideo, tag', status: 'kandydat', params: { roughness: 1.2 } },
      { id: 'B2', name: 'RoughJS ramka dużego panelu', tech: 'roughjs', description: 'Obrys dla dużych sekcji.', useCase: 'kontener strony', status: 'kandydat', params: { roughness: 0.8, strokeWidth: 1.5 } },
      { id: 'B3', name: 'RoughJS ramka przycisku', tech: 'roughjs', description: 'Kompaktowa ramka o wyższym bowing.', useCase: 'CTA', status: 'inspiracja', params: { bowing: 2, roughness: 2 } },
      { id: 'B4', name: 'RoughJS ramka miniaturki', tech: 'roughjs', description: 'Ramka dopasowana do proporcji 16:9.', useCase: 'video placeholder', status: 'kandydat', params: { roughness: 1 } },
      { id: 'B5', name: 'RoughJS hachure fill', tech: 'roughjs', description: 'Wypełnienie kreskowane.', useCase: 'aktywne tło, hover', status: 'inspiracja', params: { fillStyle: 'hachure', fillWeight: 3 } },
      { id: 'B6', name: 'RoughJS dots fill', tech: 'roughjs', description: 'Wypełnienie kropkowane.', useCase: 'dekoracja', status: 'eksperyment', params: { fillStyle: 'dots' } },
      { id: 'B7', name: 'Custom SVG nieregularna ramka', tech: 'custom SVG', description: 'Path z celowo zachwianymi rogami.', useCase: 'unikalny panel', status: 'inspiracja', params: {} },
      { id: 'B8', name: 'Custom SVG podwójna ramka', tech: 'custom SVG', description: 'Dwie nałożone na siebie ramki.', useCase: 'retro szkic', status: 'eksperyment', params: {} },
      { id: 'B9', name: 'Custom SVG niedomknięty róg', tech: 'custom SVG', description: 'Przerwana linia w rogu.', useCase: 'lekkość wizualna', status: 'kandydat', params: {} },
      { id: 'B10', name: 'Porównanie obrysów', tech: 'CSS/SVG', description: 'Standard vs Rough vs Custom.', useCase: 'wybór stylu obramowań', status: 'kandydat', params: {} },
    ]
  },
  {
    id: 'S',
    title: 'Separatory',
    items: [
      { id: 'S1', name: 'Cienka pozioma linia', tech: 'roughjs', description: 'Dyskretny podział.', useCase: 'między akapitami', status: 'kandydat', params: { roughness: 0.5 } },
      { id: 'S2', name: 'Falujący separator', tech: 'custom SVG', description: 'Miękka fala.', useCase: 'sekcje tematyczne', status: 'inspiracja', params: {} },
      { id: 'S3', name: 'Podwójny separator', tech: 'roughjs', description: 'Dwie linie o różnym roughness.', useCase: 'ważny podział', status: 'kandydat', params: {} },
      { id: 'S4', name: 'Separator z doodle', tech: 'custom SVG', description: 'Linia z małą gwiazdką na środku.', useCase: 'ozdobnik', status: 'inspiracja', params: {} },
      { id: 'S5', name: 'Separator RoughJS', tech: 'roughjs', description: 'Klasyczny szkicowy podział.', useCase: 'standardowy separator', status: 'kandydat', params: { roughness: 1.5 } },
      { id: 'S6', name: 'Separator Perfect Freehand', tech: 'perfect-freehand', description: 'Podział narysowany "pisakiem".', useCase: 'autograf / koniec treści', status: 'inspiracja', params: {} },
      { id: 'S7', name: 'Separator custom SVG', tech: 'custom SVG', description: 'Precyzyjnie kontrolowany szkic.', useCase: 'branding', status: 'kandydat', params: {} },
      { id: 'S8', name: 'Separator "POLUTEK"', tech: 'custom SVG', description: 'Linia z wkomponowanym tekstem.', useCase: 'footer / intro', status: 'inspiracja', params: {} },
      { id: 'S9', name: 'Separator międzyblokowy', tech: 'roughjs', description: 'Długa, stabilna linia przez całą szerokość.', useCase: 'główny podział strony', status: 'kandydat', params: {} },
      { id: 'S10', name: 'Final candidates — separatory', tech: 'CSS/SVG', description: 'Zestawienie najlepszych typów.', useCase: 'produkcja', status: 'kandydat', params: {} },
    ]
  },
  {
    id: 'N',
    title: 'Rough Notation',
    items: [
      { id: 'N1', name: 'underline', tech: 'rough-notation', description: 'Podkreślenie tekstu.', useCase: 'linki, akcenty w tekście', status: 'kandydat', params: { type: 'underline' } },
      { id: 'N2', name: 'box', tech: 'rough-notation', description: 'Ramka wokół słowa.', useCase: 'ważne pojęcia', status: 'kandydat', params: { type: 'box' } },
      { id: 'N3', name: 'circle', tech: 'rough-notation', description: 'Zakreślenie kółkiem.', useCase: 'wyróżnienie liczby, ikony', status: 'inspiracja', params: { type: 'circle' } },
      { id: 'N4', name: 'highlight', tech: 'rough-notation', description: 'Marker/zakreślacz.', useCase: 'kluczowe frazy', status: 'kandydat', params: { type: 'highlight', color: '#ffeb3b' } },
      { id: 'N5', name: 'strike-through', tech: 'rough-notation', description: 'Skreślenie.', useCase: 'stare ceny, błędy', status: 'inspiracja', params: { type: 'strike-through' } },
      { id: 'N6', name: 'crossed-off', tech: 'rough-notation', description: 'Przekreślenie X.', useCase: 'negacja', status: 'eksperyment', params: { type: 'crossed-off' } },
      { id: 'N7', name: 'bracket left', tech: 'rough-notation', description: 'Nawias z lewej.', useCase: 'cytaty, listy', status: 'inspiracja', params: { type: 'bracket', brackets: ['left'] } },
      { id: 'N8', name: 'bracket both sides', tech: 'rough-notation', description: 'Nawiasy z obu stron.', useCase: 'bloki tekstu', status: 'inspiracja', params: { type: 'bracket', brackets: ['left', 'right'] } },
      { id: 'N9', name: 'multiline annotation', tech: 'rough-notation', description: 'Zakreślenie wielu linii.', useCase: 'dłuższe cytaty', status: 'kandydat', params: { multiline: true } },
      { id: 'N10', name: 'grupa adnotacji', tech: 'rough-notation', description: 'Kilka efektów na raz.', useCase: 'złożone UI', status: 'eksperyment', params: {} },
      { id: 'N11', name: 'animowane zakreślenie', tech: 'rough-notation', description: 'Efekt rysowania przy pojawieniu się.', useCase: 'landing page', status: 'inspiracja', params: { animate: true } },
      { id: 'N12', name: 'bez animacji', tech: 'rough-notation', description: 'Statyczny szkic.', useCase: 'standardowy UI', status: 'kandydat', params: { animate: false } },
    ]
  },
  {
    id: 'Z',
    title: 'Zakreślona kreska',
    items: [
      { id: 'Z1', name: 'kreska + underline', tech: 'custom SVG', description: 'Połączenie linii RoughJS z podkreśleniem tekstu.', useCase: 'nagłówek sekcji', status: 'kandydat', params: {} },
      { id: 'Z2', name: 'kreska + highlight', tech: 'custom SVG', description: 'Kreska nad którą jest "ślad markera".', useCase: 'akcent wizualny', status: 'inspiracja', params: {} },
      { id: 'Z3', name: 'kreska + circle', tech: 'custom SVG', description: 'Kreska zakończona kółkiem.', useCase: 'punkt listy', status: 'eksperyment', params: {} },
      { id: 'Z4', name: 'kreska + box', tech: 'custom SVG', description: 'Etykieta przy kresce.', useCase: 'legenda / opis', status: 'inspiracja', params: {} },
      { id: 'Z5', name: 'separator + bracket', tech: 'custom SVG', description: 'Separator z pionowym nawiasem.', useCase: 'struktura treści', status: 'eksperyment', params: {} },
      { id: 'Z6', name: 'duża kreska markera', tech: 'perfect-freehand', description: 'Bardzo szeroki ślad pędzla.', useCase: 'tło pod tytuł', status: 'kandydat', params: { size: 40 } },
      { id: 'Z7', name: 'CTA z kreską i zakreśleniem', tech: 'custom SVG', description: 'Przycisk "podpisany" i "zakreślony".', useCase: 'Główny przycisk sprzedaży', status: 'kandydat', params: {} },
      { id: 'Z8', name: 'Nagłówek złożony', tech: 'custom SVG', description: 'Underline + Rough line pod spodem.', useCase: 'H1 / H2', status: 'kandydat', params: {} },
      { id: 'Z9', name: 'Animowana zakreślona kreska', tech: 'custom SVG', description: 'Sekwencyjne rysowanie kreski i zakreślenia.', useCase: 'Intro', status: 'inspiracja', params: {} },
      { id: 'Z10', name: 'Statyczny kandydat UI', tech: 'custom SVG', description: 'Złożony efekt w wersji lekkiej.', useCase: 'Standardowy element stylu', status: 'kandydat', params: {} },
    ]
  },
  {
    id: 'P',
    title: 'Przyciski',
    items: [
      { id: 'P1', name: 'Przycisk RoughJS', tech: 'roughjs', description: 'Standardowa ramka wokół buttona.', useCase: 'secondary button', status: 'kandydat', params: {} },
      { id: 'P2', name: 'Przycisk custom SVG', tech: 'custom SVG', description: 'Ramka z "ogonkiem" lub niedoskonałością.', useCase: 'primary button', status: 'kandydat', params: {} },
      { id: 'P3', name: 'Przycisk tylko underline', tech: 'rough-notation', description: 'Minimalistyczny przycisk tekstowy.', useCase: 'menu, linki w stopce', status: 'kandydat', params: {} },
      { id: 'P4', name: 'CTA z zakreśleniem', tech: 'rough-notation', description: 'Button w środku "highlight".', useCase: 'akcja główna', status: 'inspiracja', params: {} },
      { id: 'P5', name: 'Hover state — extra kreska', tech: 'roughjs', description: 'Druga linia pojawiająca się po najechaniu.', useCase: 'interakcja', status: 'inspiracja', params: {} },
      { id: 'P6', name: 'Focus state', tech: 'CSS/SVG', description: 'Wyraźny obrys dostępnościowy w stylu szkicu.', useCase: 'dostępność', status: 'kandydat', params: {} },
      { id: 'P7', name: 'Disabled state', tech: 'roughjs', description: 'Wyszarzony szkic, może z przekreśleniem.', useCase: 'formularze', status: 'kandydat', params: {} },
      { id: 'P8', name: 'Porównanie z wired-button', tech: 'wired-elements', description: 'Wired vs Custom.', useCase: 'wybór biblioteki', status: 'inspiracja', params: {} },
    ]
  },
  {
    id: 'K',
    title: 'Karty i panele',
    items: [
      { id: 'K1', name: 'HandCard RoughJS', tech: 'roughjs', description: 'Karta z obrysem wielokrotnie rysowanym.', useCase: 'lista wideo', status: 'kandydat', params: {} },
      { id: 'K2', name: 'HandCard custom SVG', tech: 'custom SVG', description: 'Karta o lekko trapezowym kształcie.', useCase: 'wyróżniona treść', status: 'inspiracja', params: {} },
      { id: 'K3', name: 'HandPanel papierowy', tech: 'CSS/SVG', description: 'Panel z teksturą i cieniem "uniesionego papieru".', useCase: 'sekcja na landing page', status: 'kandydat', params: {} },
      { id: 'K4', name: 'Karta z ręcznym nagłówkiem', tech: 'custom SVG', description: 'Połączenie ramki i zakreślenia tytułu.', useCase: 'moduł informacyjny', status: 'kandydat', params: {} },
      { id: 'K5', name: 'Karta z doodle ikoną', tech: 'custom SVG', description: 'Szkicowa ikona w rogu karty.', useCase: 'funkcje/benefity', status: 'inspiracja', params: {} },
      { id: 'K6', name: 'Karta z przyciskiem', tech: 'custom SVG', description: 'Pełny interaktywny moduł.', useCase: 'miniatura zakupu', status: 'kandydat', params: {} },
      { id: 'K7', name: 'Panel sekcji', tech: 'roughjs', description: 'Duże tło z grubym obrysem.', useCase: 'kontener główny', status: 'kandydat', params: {} },
      { id: 'K8', name: 'Final candidates — karty', tech: 'CSS/SVG', description: 'Zestawienie najlepszych kart.', useCase: 'produkcja', status: 'kandydat', params: {} },
    ]
  },
  {
    id: 'V',
    title: 'Video Wrapper',
    items: [
      { id: 'V1', name: 'Ramka miniaturki RoughJS', tech: 'roughjs', description: 'Szkicowy obrys dla video 16:9.', useCase: 'lista filmów', status: 'kandydat', params: {} },
      { id: 'V2', name: 'Ramka miniaturki custom SVG', tech: 'custom SVG', description: 'Ramka z "uszami" lub spinaczem.', useCase: 'stylizacja blogowa', status: 'inspiracja', params: {} },
      { id: 'V3', name: 'Wrapper video', tech: 'roughjs', description: 'Główny kontener playera z ręczną kreską.', useCase: 'strona watch', status: 'kandydat', params: {} },
      { id: 'V4', name: 'Podpis cienkopisem', tech: 'perfect-freehand', description: 'Tytuł filmu pod spodem jako odręczny tekst.', useCase: 'podpis pod wideo', status: 'kandydat', params: {} },
      { id: 'V5', name: 'Doodle arrow', tech: 'custom SVG', description: 'Strzałka wskazująca przycisk Play.', useCase: 'UX hint', status: 'inspiracja', params: {} },
      { id: 'V6', name: 'CTA pod video', tech: 'rough-notation', description: 'Zakreślony przycisk wsparcia pod playerem.', useCase: 'konwersja', status: 'kandydat', params: {} },
      { id: 'V7', name: 'Wariant subtelny', tech: 'roughjs', description: 'Minimalny wpływ na player.', useCase: 'bezpieczny wybór', status: 'kandydat', params: {} },
      { id: 'V8', name: 'Wariant komiksowy', tech: 'roughjs', description: 'Mocne linie, dużo "bohomazów".', useCase: 'odważny wybór', status: 'inspiracja', params: {} },
    ]
  },
  {
    id: 'W',
    title: 'Wired Elements',
    items: [
      { id: 'W1', name: 'wired-button', tech: 'wired-elements', description: 'Gotowy przycisk z biblioteki wired.', useCase: 'inspiracja / szybki prototyp', status: 'inspiracja', params: {} },
      { id: 'W2', name: 'wired-input', tech: 'wired-elements', description: 'Pole tekstowe.', useCase: 'formularze', status: 'inspiracja', params: {} },
      { id: 'W3', name: 'wired-checkbox', tech: 'wired-elements', description: 'Checkbox.', useCase: 'zgody', status: 'inspiracja', params: {} },
      { id: 'W4', name: 'wired-radio', tech: 'wired-elements', description: 'Radio button.', useCase: 'wybory', status: 'inspiracja', params: {} },
      { id: 'W5', name: 'wired-card', tech: 'wired-elements', description: 'Karta z wired-elements.', useCase: 'panel', status: 'inspiracja', params: {} },
      { id: 'W6', name: 'wired-slider', tech: 'wired-elements', description: 'Suwak.', useCase: 'sterowanie głośnością (mock)', status: 'inspiracja', params: {} },
      { id: 'W7', name: 'Wired vs Custom', tech: 'CSS/SVG', description: 'Porównanie gotowca z własnym stylem.', useCase: 'decyzja architektoniczna', status: 'inspiracja', params: {} },
    ]
  },
  {
    id: 'T',
    title: 'Papierowe tło',
    items: [
      { id: 'T1', name: 'Subtelny papier', tech: 'CSS/SVG', description: 'Bardzo lekka faktura.', useCase: 'cała strona', status: 'kandydat', params: { opacity: 0.05 } },
      { id: 'T2', name: 'Mocniejszy papier', tech: 'CSS/SVG', description: 'Wyraźne ziarno i zagniecenia.', useCase: 'panele boczne', status: 'inspiracja', params: { opacity: 0.15 } },
      { id: 'T3', name: 'Papier z gradientem', tech: 'CSS/SVG', description: 'Winieta na fakturze papieru.', useCase: 'hero section', status: 'inspiracja', params: {} },
      { id: 'T4', name: 'Papier noise SVG', tech: 'custom SVG', description: 'Generowany dynamicznie szum.', useCase: 'tło uniwersalne', status: 'kandydat', params: {} },
      { id: 'T5', name: 'Test czytelności', tech: 'CSS/SVG', description: 'Długi blok tekstu na fakturze.', useCase: 'artykuły / opisy', status: 'kandydat', params: {} },
      { id: 'T6', name: 'Test scrollowania', tech: 'CSS/SVG', description: 'Jak tło zachowuje się przy ruchu.', useCase: 'performance / UX', status: 'kandydat', params: {} },
    ]
  },
  {
    id: 'C',
    title: 'Final Candidates',
    items: [
      { id: 'C1', name: 'Najlepsza kreska', tech: 'roughjs', description: 'L1/L5 jako fundament.', useCase: 'standard', status: 'kandydat', params: {} },
      { id: 'C2', name: 'Najlepsza ramka', tech: 'roughjs', description: 'B1/B4 dla kart wideo.', useCase: 'standard', status: 'kandydat', params: {} },
      { id: 'C3', name: 'Najlepszy separator', tech: 'roughjs', description: 'S1/S9 dla podziałów.', useCase: 'standard', status: 'kandydat', params: {} },
      { id: 'C4', name: 'Najlepsze zakreślenie', tech: 'rough-notation', description: 'N1/N4 dla tekstu.', useCase: 'standard', status: 'kandydat', params: {} },
      { id: 'C5', name: 'Najlepszy button', tech: 'custom SVG', description: 'P2 jako CTA.', useCase: 'standard', status: 'kandydat', params: {} },
      { id: 'C6', name: 'Najlepsza karta', tech: 'CSS/SVG', description: 'K3 z papierowym tłem.', useCase: 'standard', status: 'kandydat', params: {} },
      { id: 'C7', name: 'Najlepszy wrapper', tech: 'roughjs', description: 'V3 dla wideo.', useCase: 'standard', status: 'kandydat', params: {} },
    ]
  }
];
