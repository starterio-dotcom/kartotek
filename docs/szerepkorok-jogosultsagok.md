# Szerepkörök és jogosultságok

Ez a rendszer hozzáférés-vezérlési (RBAC) modellje: kik a szerepkörök, mit tehetnek, hogyan szabottak alkalmazásra, és hogyan rétegződik rájuk a négy-szem-elv. Az elv: **legkisebb jogosultság** — alapból semmihez nincs hozzáférés, a jogokat explicit tagság adja.

## Szerepkörök

| Szerepkör | Mire való |
|---|---|
| **Olvasó** | megtekintés: kartoték, verziók, megjegyzések, gráf, riportok |
| **Szerző** | elem és vázlat létrehozása/szerkesztése, beküldés, visszavonás, megjegyzésre válasz, új verzió nyitása, elvetés, kapcsolatok és mellékletek kezelése |
| **Jóváhagyó** | véleményezés (megjegyzések) és döntés: jóváhagyás / visszadobás |
| **Admin** (alkalmazás-szintű) | az alkalmazás teljes tartalmának kezelése + kivezetés + archiválás + az alkalmazás tagságainak kezelése |
| **Globális Admin** | minden alkalmazás; szolgáltatás/alkalmazás létrehozása-törlése; rendszerszintű felhasználó- és szerepkörkezelés |
| **RENDSZER** | nem bejelentkező felhasználó; az ütemező automata átmenetei (`Jóváhagyott→Hatályos`, `Hatályos→Elavult`) |

## Hatókör (scoping)

- A szerepkör **alkalmazásra szabott**: egy tagság = `(felhasználó × alkalmazás × szerepkör)`, a `felhasznalok.tagsagok[]`-ben (lásd `docs/adatmodell.md`). Egy felhasználónak **alkalmazásonként külön** szerepköre(i) lehet(nek).
- A **Globális Admin** a `felhasznalok.globalisAdmin` jelző — minden alkalmazásra érvényes, és övé a szolgáltatás/alkalmazás CRUD és a rendszerszintű jogosultságkezelés.
- **Olvasási hatókör:** egy alkalmazás tartalmát az láthatja, akinek ott **bármilyen tagsága** van (plusz a Globális Admin). Egy alkalmazásközi kapcsolat (`lebontja`/`megfelel` egy másik alkalmazás eleméhez) akkor látszik teljesen, ha mindkét véget olvashatod; egyébként hivatkozás-csonkként jelenik meg.
- **RENDSZER** nem impersonálható: az automata átmeneteket kizárólag az ütemező hajthatja végre, `ki=RENDSZER` naplóval.

## Jogosultsági mátrix

Pipa = megengedett. A `—` tiltást jelent. (A Globális Admin mindent megtehet, amit az alkalmazás-Admin, plusz a rendszerszintű műveleteket.)

| Művelet | Olvasó | Szerző | Jóváhagyó | Admin (alk.) | Globális Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Elem/verzió/megjegyzés megtekintése | ✓ | ✓ | ✓ | ✓ | ✓ |
| Elem létrehozása | — | ✓ | — | ✓ | ✓ |
| Vázlat szerkesztése | — | ✓ | — | ✓ | ✓ |
| Beküldés véleményezésre | — | ✓ | — | ✓ | ✓ |
| Visszavonás (saját beküldés) | — | ✓ | — | ✓ | ✓ |
| Megjegyzés írása / válasz | — | ✓¹ | ✓ | ✓ | ✓ |
| Megjegyzés megoldottra állítása | — | ✓¹ | ✓ | ✓ | ✓ |
| **Jóváhagyás** | — | — | ✓² | ✓² | ✓² |
| **Visszadobás** | — | — | ✓ | ✓ | ✓ |
| Új verzió nyitása (v+1) | — | ✓ | — | ✓ | ✓ |
| Kivezetés (Hatályos→Elavult) | — | — | — | ✓ | ✓ |
| **Archiválás** (Elavult→Archivált) | — | — | — | ✓ | ✓ |
| Elvetés (Vázlat→Elvetve) | — | ✓ | — | ✓ | ✓ |
| Vázlat törlése (sosem hivatkozott) | — | — | — | ✓ | ✓ |
| Kapcsolat felvétele / törlése | — | ✓ | — | ✓ | ✓ |
| Címke / melléklet kezelése az elemen | — | ✓ | — | ✓ | ✓ |
| Szolgáltatás / alkalmazás CRUD | — | — | — | —³ | ✓ |
| Tagságok kezelése (szerepkör-kiosztás) | — | — | — | ✓⁴ | ✓ |
| Ütemező automata átmenetei | — | — | — | — | —⁵ |

**Jelölések**
1. A **Szerző** a véleményezésben **válaszol** a megjegyzésekre és a saját elemén megoldottra állít; a véleményezést (új észrevételt) jellemzően a Jóváhagyó kezdeményezi.
2. **Négy-szem-elv:** a jóváhagyás csak akkor megengedett, ha a döntő felhasználó **nem** szerzője/szerkesztője az adott verziónak (lásd lent). Ez az Adminra és a Globális Adminra is vonatkozik.
3. Az **alkalmazás-Admin** a saját alkalmazása **metaadatát** szerkesztheti, de **új alkalmazást/szolgáltatást létrehozni vagy törölni** csak Globális Admin tud.
4. Az **alkalmazás-Admin** a **saját alkalmazása** tagságait kezeli; rendszerszintű (alkalmazásokon átívelő) jogosultságkezelés a Globális Adminé.
5. Az ütemezőt **RENDSZER**-ként a háttérfolyamat futtatja; emberi felhasználó nem indíthat automata átmenetet a saját nevében.

## Négy-szem-elv (overlay a mátrix felett)

A mátrix megadja, **kinek lehet** jóváhagyási joga; a négy-szem-elv egy **további feltétel** a konkrét elemre:

- Aki a verziót **létrehozta vagy szerkesztette**, az **nem hagyhatja jóvá** ugyanazt a verziót — akkor sem, ha Jóváhagyó vagy akár Admin.
- A backend a jóváhagyás-műveletnél ellenőrzi: a döntő felhasználó szerepel-e a verzió szerzői/szerkesztői között (`letrehozva`/`modositottaId`, illetve a szerkesztési előzmény). Ha igen → a művelet elutasul.
- **Üzemeltetési következmény:** alkalmazásonként legyen **legalább egy, a szerzőtől különböző Jóváhagyó**, különben nincs, aki jóváhagyjon.

## Több szerepkör egy felhasználónál

Egy felhasználó **egy alkalmazáson belül több szerepkört** is kaphat (pl. Szerző + Jóváhagyó): ekkor szerkeszthet **és** jóváhagyhat **másokét**, de a sajátját a négy-szem-elv miatt nem. Eltérő alkalmazásokban a szerepkörök függetlenek.

## Kikényszerítés

- **Egy igazság a `shared`-ben:** egy tiszta függvény dönt, pl. `szabad(muvelet, { felhasznalo, alkalmazasKod, verzio? }) → boolean`. Ezt használja a frontend (gombok tiltása/engedélyezése, optimista UX) és a backend (érdemi kényszerítés) is. Konkrét TypeScript-vázlat (a mátrixszal és a négy-szem-elvvel): `docs/domain-mag-vazlat.md`.
- **Backend RBAC hook:** minden írási műveletnél lefut, feloldja a `(felhasználó, művelet, alkalmazás)` hármast a tagságokból (+ globalisAdmin), és a négy-szem-elvet a jóváhagyásnál külön ellenőrzi.
- **Olvasás-szűrés:** a lekérdezések a felhasználó tagságai szerint szűrnek; a Globális Admin mindent lát.

## A nevesített szereplők leképezése (demó/seed)

| Felhasználó | Tagság / jog |
|---|---|
| Kiss Anna | Szerző @ **3R** |
| Varga Dóra | Szerző @ **Terminus** |
| Nagy Péter | FAIR szolgáltatásgazda → javaslat: **Globális Admin** (a `szolgaltatasok.gazdaId` rá mutat — ez metaadat; a tényleges jogokat az Admin adja) |

## Élhelyzetek és nyitott pontok

- **Tagság nélküli, bejelentkezett felhasználó:** alapból **nincs hozzáférése** — a jogokat Adminnak kell kiosztania.
- **Szerepkör elvétele folyamat közben:** ha egy Jóváhagyó jogát elveszik, miközben rá várnak elemek, azok Véleményezésben maradnak más Jóváhagyók számára — nincs adatvesztés.
- **Szolgáltatás-szintű Admin?** A modell alkalmazás-szintű Adminból + Globális Adminból áll. Ha egy szolgáltatásgazdának a **teljes szolgáltatás** (több alkalmazás) felett kell admin-jog, az ma vagy alkalmazásonkénti Admin-tagság, vagy Globális Admin. Egy külön „szolgáltatás-Admin” szerep **lehetséges jövőbeli bővítés** — egyeztetendő a kollégákkal.
- **Archiválás/megőrzés jogosultsága:** az archiválás Admin-jog (lásd a `CLAUDE.md` „Archiválási szabályok” szakaszát); a jogszabályi megőrzési idő kezelése konfigkérdés, nem szerepkör-kérdés.
