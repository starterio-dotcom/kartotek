# Kartotékrendszer — ROADMAP

> Konvenció: `## [id] Név` = modul, `### KÓD Név` = fázis, `- [ ]/[~]/[x]` = feladat.
> Commit eleje lehetőleg `[modul] rövid leírás`. A részletes fázisok: `docs/utiterv.md`.

## [domain] Domain mag & adatmodell

### K1 Adatmodell
- [x] Entitások, mezők, kapcsolatok, ID-séma (Fázis 1)
- [x] Állapotgép + ütemező-döntés a `shared` magban
- [x] Öt tipizált kapcsolat + validáció

## [backend] Backend API, RBAC, audit

### K2 API réteg
- [x] REST API + Mongoose séma (Fázis 2)
- [x] Szerepkör/jogosultság (RBAC) + négy-szem-elv
- [x] Audit-napló + ütemező
- [x] Fail-closed kapcsolat + CSP

## [web] Web frontend

### K3 Alap nézetek
- [x] Alap nézetek + a kartoték (Fázis 3)
- [x] Mellékletek: kép, Figma, CSV (Fázis 4)

### K4 Haladó
- [x] Verzió-diff, mentett szűrők, tömeges műveletek
- [x] axe a11y-audit
- [~] azonos-origin prod API finomítás

## [graf] Kapcsolati gráf

### K5 Gráf nézet
- [x] Kapcsolati gráf nézet (Fázis 5)
- [x] Csomópontra kattintva megnyílik az elem kartotékja
- [~] Kijelölő ikon a csomópontokon (megnyitás + szerkesztés)

## [biztonsag] Törlés-őrök, biztonság, üzemeltetés

### K6 Release
- [x] Törlés, függőség-őrök, riportok (Fázis 6)
- [x] Éles telepítés (docker-compose prod)

### K7 Üzemeltetés
- [x] Akadálymentesség, biztonság (Fázis 7)
- [ ] Monitoring + mentés-visszaállítás gyakorlat
