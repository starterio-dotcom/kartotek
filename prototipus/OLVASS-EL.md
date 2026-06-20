# Ide másold a prototípust

Ebbe a mappába tedd be a saját **`kartotek-prototipus-v4.html`** fájlodat (a legfrissebb, gráffal bővített változatot), mielőtt a csomagot átadod a Claude Code-nak.

## Miért kell ide

A prototípus a **funkcionális specifikáció és a kiinduló példaadatok forrása**:

- A seed-script ennek az `ELEMEK` / `SZOLGALTATAS` / `ALKALMAZASOK` adataiból készül (lásd `../docs/migracio.md`).
- A domain-logika (állapotgép, kapcsolatvalidáció, ID-kezelés) innen kerül át a `packages/shared`-be, tesztekkel.
- Az UI és a kapcsolati gráf innen portolódik React-komponensekbe.

Ha a fájl nincs itt, a Claude Code a tervdokumentumokból akkor is tud dolgozni, de a **pontos példaadatok hiányoznak**, és a UI-portoláshoz nem lesz vizuális referencia.

## Elnevezés

Tartsd meg a `kartotek-prototipus-v4.html` nevet — a `CLAUDE.md` és a `docs/` erre a névre hivatkozik.
