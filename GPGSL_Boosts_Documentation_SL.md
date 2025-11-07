# Dokumentacija GPGSL Boosts Sledilne Aplikacije

## Pregled

GPGSL Boosts Sledilna Aplikacija je celovit spletni sistem, zasnovan za upravljanje in sledenje igralnih boost-ov za Grand Prix Games forum igro. Aplikacija je sestavljena iz treh glavnih komponent:

1. **Glavna Administratorska Aplikacija** (`grandprix-login-client`) - React spletna aplikacija za administratorje in igralce za ogled boost predložkov
2. **Aplikacija za Predložitev Boost-ov** (`gpgsl-two-step-boost`) - Poenostavljena React aplikacija za igralce za predložitev boost-ov
3. **Backend API** (`grandprix-login-server`) - .NET Core Web API, ki upravlja avtentifikacijo in komunikacijo z zunanjim forumom

## Arhitektura

### Tehnološki Stack
- **Frontend**: React 19.0.0 s TypeScript (Two-Step Boost), React 19.0.0 z JavaScript (Glavna Aplikacija)
- **Backend**: .NET 9.0 Web API
- **Podatkovna baza**: Firebase Firestore
- **Avtentifikacija**: Avtentifikacija na osnovi sej z grandprixgames.org forumom
- **Razporeditev**: Vercel (Frontend), Azure/Cloud (Backend)

### Struktura Aplikacije
```
GPGSL boosts .net/
├── grandprix-login-client/     # Glavna administratorska/igralska aplikacija
├── gpgsl-two-step-boost/       # Aplikacija za predložitev boost-ov
└── grandprix-login-server/     # .NET Web API backend
```

## Osnovne Funkcije

### 1. Administrator Prijava (GPGSL Uporabnik)
- **Namen**: Omogoča administratorjem ogled vseh boost predložkov in upravljanje sistema
- **Avtentifikacija**: Uporablja GPGSL forum poverilnice za avtentifikacijo z grandprixgames.org
- **Možnosti**: 
  - Ogled vseh boost predložkov (ujemanje, brez ujemanja, neveljavni, drugi)
  - Upravljanje voznikov in ekip baze podatkov
  - Dodajanje novih dogodkov v koledar
  - Kopiranje podatkov v odložišče za Excel integracijo
  - Osveževanje forum sporočil in podatkovne baze

### 2. Obdelava in Kategorizacija Boost Podatkov
Sistem obdeluje boost predložke in jih kategorizira v štiri ločene tabele:

#### **Ujemajoči se Boost-i** (Pravilno Oblikovani)
- Boost-i, ki so pravilno oblikovani in uspešno povezani z vozniki/ekipami
- Prikazani v glavni lineup tabeli z boost vrednostmi (200 za voznike, 4/8 za ekipe)
- Vključuje zaznavanje duplikatov in sistem opozoril
- **Status Aktivnosti**: Prikazuje skladnost z zahtevami aktivnosti za vsakega igralca

#### **Boost-i brez Ujemanja**
- Boost-i zaznani kot veljavni predložki, vendar ne morejo se povezati z voznik/ekipa podatki
- Pogosti razlogi: napačno uporabniško ime, voznik/ekipa ni najden v podatkovni bazi
- Zagotavlja podrobna sporočila o napakah za odpravljanje težav

#### **Neveljavni Boost-i** (Po Rokovnici)
- Boost-i predloženi po rokovnici (običajno 20:00 na dan boost rokovnice)
- Samodejno izločeni iz veljavnih predložkov
- Prikazani v ločeni tabeli s časovnimi žigi predložitve

#### **Druga Sporočila**
- Sporočila, ki niso boost-i, vendar vsebujejo informacije o prizorišču
- Pomaga administratorjem identificirati irelevantne komunikacije

### 3. Napredni Filtrirni Sistem
- **Filtriranje Dogodkov**: Filtriranje boost-ov po specifičnih Grand Prix dogodkih
- **Filtriranje po Datumu**: Nastavitev prilagojenih rokovnic za validacijo boost-ov
- **Filtriranje Tipov Voznikov**: 
  - Dirkaški vozniki (pozicije 1-2)
  - Testni vozniki (pozicije 3+)
  - Test (polna mreža) način - vključuje dirkaške voznike, ko testni vozniki manjkajo
- **Filtriranje Ekip**: Ločeno sledenje ekip boost-ov

### 4. Integracija z Odložiščem
- **Kopiranje Tabele v Odložišče**: Popolni lineup podatki v tab-ločenem formatu za Excel
- **Kopiranje samo Voznikov**: Podatki specifični za voznike za ločeno analizo
- **Kopiranje samo Ekip**: Podatki specifični za ekipe za ločeno analizo
- **Seznam Vseh Boost-ov**: Oblikovani tekst izhod za objavo na forumu

### 5. Upravljanje Podatkovne Baze
- **Podatkovna Baza Ekip**: Upravljanje informacij o ekipah vključno z:
  - Imeni ekip in uporabniškimi imeni
  - Kratkimi imeni (short1, short2) za alternativno identifikacijo
  - Samodejno generiranje ID-jev in razvrščanje
- **Podatkovna Baza Voznikov**: Upravljanje informacij o voznikih vključno z:
  - Imeni voznikov, uporabniškimi imeni in povezavami z ekipami
  - Samodejno generiranje ID-jev na osnovi ekip
  - Podpora za dirkaške in testne voznike

### 6. Igralčeva Prijava in Predložitev Boost-a
- **Forum Avtentifikacija**: Varna prijava z grandprixgames.org poverilnicami
- **Zaznavanje Igralca**: Samodejno zaznavanje, ali je uporabnik registriran voznik ali lastnik ekipe
- **Izbira Tipa Boost-a**:
  - Vozniški boost-i (200 točk)
  - Ekipni boost-i z enojnim (4 točke) ali dvojnim (8 točk) možnostmi
- **Izbira Dogodka**: Ročna izbira dirke ali samodejno zaznavanje trenutnega GP

### 7. Samodejno Zaznavanje Dogodkov
- **Forum Integracija**: Skenira GPGSL objave za boost napovedi
- **Zaznavanje Kroga**: Samodejno identificira trenutni Grand Prix krog
- **Pametni Privzetki**: Samodejno izbere najnovejši dogodek za boost predložke

### 8. Sistem Direktnih Sporočil
- **Samodejno Pošiljanje PM**: Pošlje pravilno oblikovana boost sporočila GPGSL
- **Predloge Sporočil**: Standardizirani format boost sporočil
- **Sistem Potrditev**: Zagotavlja potrditev predložitve in upravljanje napak
- **Ohranjanje Kopije**: Zagotavlja, da je "Keep A Copy In My Sent Items" omogočen

### 9. Preverjanje Statusa Boost-a
- **Branje Poslane Mape**: Za navadne uporabnike preverja poslana sporočila za boost predložke
- **Branje Prejete Mape**: Za GPGSL račun bere prejeta boost sporočila
- **Verifikacija Statusa**: Omogoča uporabnikom preverjanje statusa njihove boost predložitve

### 10. Integracija Sistema Opozoril
- **Sledenje Aktivnosti**: Integrira z forum sistemom preverjanja aktivnosti
- **Kazni Opozoril**: 
  - 1 opozorilo: 10 točk (ekipe), 20 točk (vozniki)
  - 2 opozorili: 25 točk (ekipe), 40 točk (vozniki)
  - 3+ opozoril: Diskvalifikacija
- **Vizualni Indikatorji**: Rdeče označevanje za uporabnike z opozorili

### 11. Sledenje Zahtev Aktivnosti (Administratorska Funkcija)
- **Forum Pravilo Aktivnosti**: Igralci morajo objaviti vsaj enkrat med dvema dogodkoma, da ostanejo upravičeni
- **Integracija Zunanje Podatkovne Baze**: Povezuje z ločeno podatkovno bazo za sledenje aktivnosti
- **Prikaz v Realnem Času**: Status aktivnosti prikazan neposredno v tabeli ujemajočih se boost-ov
- **Samodejna Validacija**: Sistem preverja zahteve aktivnosti pri obdelavi boost-ov
- **Integracija Opozoril**: Kršitve aktivnosti prispevajo k celotnemu sistemu opozoril

## Tehnična Implementacija

### Backend API Končne Točke

#### Avtentifikacijske Končne Točke
- `POST /login` - Avtentifikacija z grandprixgames.org forumom
- `POST /login/get-pm-page` - Pridobitev PM form podatkov za predložitev boost-a
- `POST /login/send-pm` - Pošiljanje boost sporočila GPGSL
- `GET /login/check-session` - Validacija obstoječe seje

#### Podatkovne Končne Točke
- `GET /boost-announcement` - Pridobitev trenutne boost napovedi iz foruma

### Shema Podatkovne Baze (Firebase Firestore)

#### Zbirke
- **teams**: Informacije o ekipah z ID, ime, uporabniško ime, short1, short2
- **drivers**: Informacije o voznikih z ID, ime, uporabniško ime, ekipa
- **calendar**: Informacije o dogodkih z ID, prizorišče, steza, država
- **warnings**: Opozorilni podatki z notPosted in total dokumenti

### Logika Obdelave Boost-ov

#### Razčlenjevanje Sporočil
1. **HTML Dekodiranje**: Dekodira HTML entitete v naslovih sporočil
2. **Obdelava Naslovov**: Standardizira boost formate sporočil
3. **Ujemanje Prizorišča**: Ujema informacije o prizorišču z dogodki v koledarju
4. **Validacija Datuma**: Preverja predložitev proti rokovnici (20:00 meja)
5. **Ujemanje Voznik/Ekipa**: Ujema uporabniška imena z vnosi v podatkovni bazi
6. **Zaznavanje Tipa Boost-a**: Identificira enojne/dvojne ekipne boost-e
7. **Validacija Aktivnosti**: Preverja zahteve aktivnosti iz zunanje podatkovne baze

#### Pravila Validacije
- Vozniški boost-i: Mora se ujemati z voznik uporabniškim imenom in vsebovati informacije o prizorišču
- Ekipni boost-i: Mora se ujemati z ekipa uporabniškim imenom in določiti enojni/dvojni tip
- Validacija rokovnice: Sporočila po 20:00 na dan rokovnice boost-a so neveljavna
- Zaznavanje duplikatov: Preprečuje večkratne boost-e od istega uporabnika
- Zahteva aktivnosti: Igralci morajo objaviti med dogodki, da so upravičeni

### Varnostne Funkcije
- **CORS Konfiguracija**: Konfigurabilni dovoljeni izvori za API dostop
- **Upravljanje Sej**: Varno upravljanje piškotkov s pravilno preteklostjo
- **Validacija Vnosa**: Obsežna validacija vseh uporabniških vnosov
- **Upravljanje Napak**: Podrobna sporočila o napakah brez razkrivanja občutljivih informacij

## Funkcije Uporabniškega Vmesnika

### Glavni Vmesnik Aplikacije
- **Stranski Koledar**: Izbira dogodkov z administratorskimi možnostmi urejanja
- **Glavno Območje Vsebine**: Boost lineup tabela z možnostmi filtriranja in statusom aktivnosti
- **Stranske Tabele**: Prikazi boost-ov brez ujemanja, neveljavnih in drugih sporočil
- **Gumbi za Kopiranje**: Več možnosti integracije z odložiščem
- **Sistem Pomoči**: Kontekstualna pomoč za uporabnike prvič

### Vmesnik za Predložitev Boost-ov
- **Večkorakni Čarovnik**: Voden proces predložitve boost-a
- **Indikator Napredka**: Vizualni indikator napredka skozi korake predložitve
- **Samodejno Zaznavanje**: Pametni privzetki za trenutni GP in uporabniške vloge
- **Potrditveni Zaslon**: Končni pregled pred predložitvijo

### Odziven Design
- **Mobilna Kompatibilnost**: Odziven design za različne velikosti zaslonov
- **Dostopnost**: Pravilno označevanje in podpora za navigacijo s tipkovnico
- **Vizualni Povratni Podatki**: Jasni statusi uspeha/napake in indikatorji nalaganja

## Razporeditev in Konfiguracija

### Okoljske Spremenljivke
- **API Osnovni URL**: Konfiguracija končne točke backend storitve
- **Firebase Konfiguracija**: Povezava podatkovne baze in avtentifikacija
- **CORS Nastavitve**: Konfiguracija zahtevkov med izvori

### Proces Gradnje
- **Frontend**: Vite osnovni sistem gradnje za React aplikacije
- **Backend**: .NET 9.0 gradnja in razporeditev
- **Podatkovna baza**: Firebase Firestore s samodejnim skaliranjem

## Delovni Tokovi Uporabe

### Administratorski Delovni Tok
1. Prijava z GPGSL poverilnicami
2. Izbira dogodka iz koledarja
3. Nastavitev rokovnice boost-a
4. Pregled ujemajočih se boost-ov v glavni tabeli (vključno s statusom aktivnosti)
5. Preverjanje boost-ov brez ujemanja za ročno obdelavo
6. Kopiranje podatkov v odložišče za Excel integracijo
7. Upravljanje podatkovne baze voznikov/ekip po potrebi
8. Spremljanje skladnosti aktivnosti za vse igralce

### Igralčev Delovni Tok
1. Prijava z osebnimi forum poverilnicami
2. Sistem samodejno zazna, ali je uporabnik voznik ali lastnik ekipe.
3. Izbira tipa boost-a in količine (za ekipe)
4. Izbira dogodka (ročno ali samodejno zaznano)
5. Pregled in potrditev podrobnosti boost-a
6. Predložitev boost sporočila GPGSL
7. Prejemanje potrditve uspešne predložitve

### Delovni Tok Verifikacije Boost-a
1. Prijava z osebnimi poverilnicami
2. Izbira ustreznega dogodka in rokovnice
3. Ogled statusa boost-a v lineup tabeli
4. Preverjanje tabel brez ujemanja/neveljavnih, če boost ni najden
5. Verifikacija časovnega žiga predložitve in formata
6. Potrditev skladnosti z zahtevami aktivnosti

## Upravljanje Napak in Odpravljanje Težav

### Pogoste Težave
- **Neuspešne Prijave**: Napačne poverilnice ali težave s povezljivostjo foruma
- **Boost ni Najden**: Preverite tabelo boost-ov brez ujemanja za podrobnosti napake
- **Duplikatni Boost-i**: Sistem preprečuje večkratne predložke z jasnimi indikatorji
- **Težave z Rokovnico**: Neveljavni boost-i jasno označeni s časovnimi žigi predložitve
- **Kršitve Aktivnosti**: Igralci, ki niso izpolnili zahtev objavljanja, so označeni

### Funkcije za Odpravljanje Napak
- **Konzolno Beleženje**: Podrobni dnevniki obdelave boost-ov za administratorje
- **Sporočila o Napakah**: Specifični opisi napak za odpravljanje težav
- **Možnosti Osveževanja**: Ročno osveževanje forum podatkov in podatkovne baze
- **Indikatorji Statusa**: Jasni vizualni povratni podatki za vse sistemske statuse
- **Spremljanje Aktivnosti**: Status zahtev aktivnosti v realnem času