# Baltic data dictionary

Every field we would load from the Baltic and cross-border sources, measured on real pulls of 19-20 Nov 2026. Companion to [baltics.md](baltics.md), which holds the source entries, licences and fill rates.

- **Null %**: share of rows (or nested records) where the field is empty, on the full file unless the section says otherwise.
- **Canonical field**: the report field it fills (the fields are listed in baltics.md, "Reality check"); blank or `-` means not used for the report.
- Field names are the publisher's, unchanged, so a loader can map them directly.

## Lithuania (LT)

Null % measured on full pulls of 2026-11-19 (financial statements: periods ending 2024 or later). Canonical field = the report field it fills (`-` = not used). Technical columns (`_type`, `_id`, `_revision`) omitted.

| Source | Table/file | Field (original) | English meaning | Type | Null % | Canonical field |
|---|---|---|---|---|---|---|
| JAR API | JuridinisAsmuo.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| JAR API | JuridinisAsmuo.csv | ja_pavadinimas | Legal name | text | 0.0 | legal_name |
| JAR API | JuridinisAsmuo.csv | pilnas_adresas | Full address (empty in API) | empty | 100.0 | address |
| JAR API | JuridinisAsmuo.csv | adresas._id | Address register ref | empty | 100.0 | address |
| JAR API | JuridinisAsmuo.csv | reg_data | Registration date | date | 0.0 | reg_date |
| JAR API | JuridinisAsmuo.csv | isreg_data | Deregistration date | date | 42.7 | closed_date |
| JAR API | JuridinisAsmuo.csv | forma._id | Legal form (ref) | text | 0.0 | legal_form |
| JAR API | JuridinisAsmuo.csv | statusas._id | Legal status (ref) | text | 0.0 | status |
| JAR API | JuridinisAsmuo.csv | stat_data | Status since | date | 0.0 | status |
| JAR API | ValdymoOrganas.csv | vadovas | Has a manager (0/1) | number | 0.0 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | vad_org_nuo | Manager since | date | 4.7 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | vad_lytis | Manager gender (M / V / unknown) | text | 0.0 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | valdyba | Has a board (0/1) | number | 0.0 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | vald_org_nuo | Board since | date | 92.4 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | taryba | Has a council (0/1) | number | 0.0 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | tar_org_nuo | Council since | date | 98.7 | officer_roles_dates |
| JAR API | ValdymoOrganas.csv | kiti_valdymo_organai | Has other management bodies (0/1) | number | 0.0 | officer_roles_dates |
| JAR API | Buveine.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR API | Buveine.csv | adresas._id | Address register ref | text | 5.1 | address |
| JAR API | Buveine.csv | adresas_nuo | Address since | date | 0.0 | address |
| JAR API | JuridinisAsmuoKapitalas.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR API | JuridinisAsmuoKapitalas.csv | forma._id | Legal form (ref) | text | 0.0 | legal_form |
| JAR API | JuridinisAsmuoKapitalas.csv | data_nuo | Capital since | date | 0.0 | - |
| JAR API | JuridinisAsmuoKapitalas.csv | reiksme | Amount (EUR) | number | 0.0 | - |
| JAR API | JuridinisAsmuoKapitalas.csv | valiuta | Currency | text | 0.0 | - |
| JAR API | Nepateikes.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR API | Nepateikes.csv | ja_reg_data | Registration date | date | 0.0 | reg_date |
| JAR API | Nepateikes.csv | forma._id | Legal form (ref) | text | 0.0 | legal_form |
| JAR API | Nepateikes.csv | statusas._id | Legal status (ref) | text | 0.0 | status |
| JAR API | Nepateikes.csv | nepateikta_iki | Statements not filed for year | number | 0.0 | filings |
| VMI arrears | NepriemokosSuma.csv | id | Source row ID | number | 0.0 | - |
| VMI arrears | NepriemokosSuma.csv | sukurta | Created | date | 0.0 | tax_debt |
| VMI arrears | NepriemokosSuma.csv | atnaujinta | Updated | date | 0.0 | - |
| VMI arrears | NepriemokosSuma.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| VMI arrears | NepriemokosSuma.csv | ja_pavadinimas | Legal name | text | 0.0 | legal_name |
| VMI arrears | NepriemokosSuma.csv | sav_kodas.sav_kodas | Municipality code | number | 0.0 | address |
| VMI arrears | NepriemokosSuma.csv | nepriemoka | Tax arrears (EUR) | number | 0.0 | tax_debt |
| VMI arrears | NepriemokosSuma.csv | pradelsta_nepriemoka | Overdue tax arrears (EUR) | number | 0.0 | tax_debt |
| VMI arrears | NepriemokosSuma.csv | atideta_nepriemoka | Deferred arrears (EUR) | number | 0.0 | tax_debt |
| VMI arrears | NepriemokosSuma.csv | atideta_pradelsta | Deferred overdue arrears (EUR) | number | 0.0 | tax_debt |
| VMI taxes paid | Moketojas.csv | id | Source row ID | number | 0.0 | - |
| VMI taxes paid | Moketojas.csv | mm_kodas._id | Company (ref to register UUID) | text | 1.1 | reg_code |
| VMI taxes paid | Moketojas.csv | pavadinimas | Name | text | 0.0 | legal_name |
| VMI taxes paid | Moketojas.csv | tipas | Tax-payer type | text | 1.2 | legal_form |
| VMI taxes paid | Moketojas.csv | apskritis._id | County (ref) | text | 0.0 | address |
| VMI taxes paid | Moketojas.csv | savivaldybe._id | Municipality (ref) | text | 0.0 | address |
| VMI taxes paid | Moketojas.csv | praeitu_metu_suma | Last-year amount (empty) | empty | 100.0 | - |
| VMI taxes paid | Moketojas.csv | einamu_metu_suma | Current-year amount (empty) | empty | 100.0 | - |
| VMI taxes paid | Moketojas.csv | metai | Year | number | 0.0 | taxes_paid |
| VMI taxes paid | Moketojas.csv | menuo | Month (cumulative to) | number | 0.0 | taxes_paid |
| VMI taxes paid | Moketojas.csv | suma | Taxes paid in year to month (EUR) | number | 0.0 | taxes_paid |
| VMI taxes paid | Moketojas.csv | atnaujinta | Updated | date | 0.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | id | Source row ID | text | 0.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | klnt_tipas | Client type | text | 0.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| VMI tax-payer register | MokesciuMoketojas.csv | pavadinimas | Name | text | 0.0 | legal_name |
| VMI tax-payer register | MokesciuMoketojas.csv | ireg_data | Tax registration date | date | 0.0 | reg_date |
| VMI tax-payer register | MokesciuMoketojas.csv | isreg_data | Deregistration date | date | 84.6 | closed_date |
| VMI tax-payer register | MokesciuMoketojas.csv | anul_data | Annulled | empty | 100.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | valstybe | Country | text | 0.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | tipo_kodas | Tax-payer type code | number | 0.0 | legal_form |
| VMI tax-payer register | MokesciuMoketojas.csv | tipo_aprasymas | Tax-payer type | text | 0.0 | legal_form |
| VMI tax-payer register | MokesciuMoketojas.csv | tipas_nuo | Type since | date | 0.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | tipas_iki | Type until | date | 82.7 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | anul_tipas | Type annulled | date | 97.1 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | pvm_kodas_pref | VAT prefix (LT) | text | 33.6 | vat_number |
| VMI tax-payer register | MokesciuMoketojas.csv | pvm_kodas | VAT code (9 or 12 digits) | number | 32.3 | vat_number |
| VMI tax-payer register | MokesciuMoketojas.csv | pvm_iregistruota | VAT registered on | date | 32.3 | vat_registered |
| VMI tax-payer register | MokesciuMoketojas.csv | pvm_isregistruota | VAT deregistered on | date | 76.7 | vat_registered |
| VMI tax-payer register | MokesciuMoketojas.csv | padalinio_nr | Branch number | number | 48.3 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | padalinio_pvd | Branch name | text | 48.8 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | padalinio_savivaldybe | Branch municipality | number | 49.6 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | padalinio_kodas | Branch code | number | 77.6 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | suformuota | Branch formed | date | 48.3 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | isformuota | Branch closed | date | 75.5 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | ekonomine_veikla._id | Economic activity (ref to EVRK) | text | 13.9 | activity_code |
| VMI tax-payer register | MokesciuMoketojas.csv | veiklos_pradzia | Activity start | date | 0.0 | activity_code |
| VMI tax-payer register | MokesciuMoketojas.csv | veiklos_pabaiga | Activity end | date | 37.6 | activity_code |
| VMI tax-payer register | MokesciuMoketojas.csv | veikla_anuliuota | Activity annulled | date | 98.9 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | pagrindine | Main-activity flag | number | 0.0 | activity_code |
| VMI tax-payer register | MokesciuMoketojas.csv | vv_savivaldybe | Place of business municipality | number | 40.9 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | vv_adresas_nuo | Place of business since | date | 40.8 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | vv_adresas_iki | Place of business until | date | 82.4 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | vv_adresas_anul | Place of business annulled | date | 100.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | mm_grupe | Tax-payer group | number | 100.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | grup_aprasymas | Group description | text | 100.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | grupe_nuo | Group since | date | 100.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | grupe_iki | Group until | date | 100.0 | - |
| VMI tax-payer register | MokesciuMoketojas.csv | grupe_anul | Group annulled | empty | 100.0 | - |
| JAR daily files | JAR_IREGISTRUOTI.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| JAR daily files | JAR_IREGISTRUOTI.csv | ja_pavadinimas | Legal name | text | 0.0 | legal_name |
| JAR daily files | JAR_IREGISTRUOTI.csv | adresas | Registered address (full text in daily files; empty in API) | text | 0.0 | address |
| JAR daily files | JAR_IREGISTRUOTI.csv | ja_reg_data | Registration date | date | 0.0 | reg_date |
| JAR daily files | JAR_IREGISTRUOTI.csv | form_kodas | Legal form code | number | 0.0 | legal_form |
| JAR daily files | JAR_IREGISTRUOTI.csv | form_pavadinimas | Legal form name (LT) | text | 0.0 | legal_form |
| JAR daily files | JAR_IREGISTRUOTI.csv | stat_kodas | Legal status code | number | 0.0 | status |
| JAR daily files | JAR_IREGISTRUOTI.csv | stat_pavadinimas | Legal status (LT) | text | 0.0 | status |
| JAR daily files | JAR_IREGISTRUOTI.csv | stat_data_nuo | Status since | date | 0.0 | status |
| JAR daily files | JAR_IREGISTRUOTI.csv | formavimo_data | File generation date (as-of) | date | 0.0 | - |
| JAR daily files | JAR_ISREGISTRUOTI.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| JAR daily files | JAR_ISREGISTRUOTI.csv | ja_pavadinimas | Legal name | text | 0.0 | legal_name |
| JAR daily files | JAR_ISREGISTRUOTI.csv | adresas | Registered address (full text in daily files; empty in API) | text | 0.0 | address |
| JAR daily files | JAR_ISREGISTRUOTI.csv | ja_reg_data | Registration date | date | 0.0 | reg_date |
| JAR daily files | JAR_ISREGISTRUOTI.csv | form_kodas | Legal form code | number | 0.0 | legal_form |
| JAR daily files | JAR_ISREGISTRUOTI.csv | form_pavadinimas | Legal form name (LT) | text | 0.0 | legal_form |
| JAR daily files | JAR_ISREGISTRUOTI.csv | isreg_data | Deregistration date | date | 0.0 | closed_date |
| JAR daily files | JAR_ISREGISTRUOTI.csv | formavimo_data | File generation date (as-of) | date | 0.0 | - |
| JAR daily files | JAR_VALDYMAS.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| JAR daily files | JAR_VALDYMAS.csv | obj_pav | Name (duplicate) | text | 0.0 | legal_name |
| JAR daily files | JAR_VALDYMAS.csv | ja_pavadinimas | Legal name | text | 0.0 | legal_name |
| JAR daily files | JAR_VALDYMAS.csv | vadovas | Has a manager (0/1) | number | 0.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | vad_org_nuo | Manager since | date | 4.2 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | vad_lytis | Manager gender (M / V / unknown) | text | 0.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | valdyba | Has a board (0/1) | number | 0.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | vald_org_nuo | Board since | date | 92.7 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | vyr_sk_valdyboje | Men on board | number | 93.8 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | mot_sk_valdyboje | Women on board | number | 95.1 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | nd_apie_lyt_sk_valdyboje | Board members, gender unknown | number | 99.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | steb_taryba | Has a supervisory board (0/1) | number | 0.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | steb_tar_org_nuo | Supervisory board since | date | 99.9 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | vyr_sk_steb_taryboje | Men on supervisory board | number | 100.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | mot_sk_steb_taryboje | Women on supervisory board | number | 100.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | nd_apie_lyt_sk_steb_taryboje | Supervisory board, gender unknown | number | 99.9 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | taryba | Has a council (0/1) | number | 0.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | tar_org_nuo | Council since | date | 98.8 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | vyr_sk_taryboje | Men on council | number | 99.1 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | mot_sk_taryboje | Women on council | number | 99.1 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | nd_apie_lyt_sk_taryboje | Council, gender unknown | number | 99.8 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | kiti_valdymo_organai | Has other management bodies (0/1) | number | 0.0 | officer_roles_dates |
| JAR daily files | JAR_VALDYMAS.csv | formavimo_data | File generation date (as-of) | date | 0.0 | - |
| JAR daily files | JAR_KAPITALAS.csv | ja_kodas | Company registry code (9 digits, check digit) | number | 0.0 | reg_code |
| JAR daily files | JAR_KAPITALAS.csv | ja_pavadinimas | Legal name | text | 0.0 | legal_name |
| JAR daily files | JAR_KAPITALAS.csv | adresas | Registered address (full text in daily files; empty in API) | text | 0.0 | address |
| JAR daily files | JAR_KAPITALAS.csv | ja_reg_data | Registration date | date | 0.0 | reg_date |
| JAR daily files | JAR_KAPITALAS.csv | form_kodas | Legal form code | number | 0.0 | legal_form |
| JAR daily files | JAR_KAPITALAS.csv | form_pavadinimas | Legal form name (LT) | text | 0.0 | legal_form |
| JAR daily files | JAR_KAPITALAS.csv | ist_kap_nuo | Share capital since | date | 0.0 | - |
| JAR daily files | JAR_KAPITALAS.csv | ist_kapitalas | Share capital | number | 0.0 | - |
| JAR daily files | JAR_KAPITALAS.csv | valiuta | Currency | text | 0.0 | - |
| JAR daily files | JAR_KAPITALAS.csv | formavimo_data | File generation date (as-of) | date | 0.0 | - |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | imones_kodas | Company code | number | 0.0 | reg_code |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | imones_pavadinimas | Company name | text | 0.0 | legal_name |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | teritorijos_kodas | Territory code | number | 0.0 | - |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | teritorijos_pavadinimas | Territory | text | 0.0 | - |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | apskrities_kodas | County code | number | 0.0 | - |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | apskrities_pavadinimas | County | text | 0.0 | - |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | teisine_forma | Legal form | text | 0.0 | legal_form |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | veiklos_kodas | Activity code | number | 3.8 | activity_code |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | veikla | Activity | text | 3.7 | activity_code |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | veiklos_sekcija | Activity section | text | 3.5 | activity_code |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | bankroto_iniciatorius | Bankruptcy initiator | text | 0.8 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | bankroto_data | Bankruptcy opened | date | 16.7 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | apygardos_teismas | Regional court | text | 16.7 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | ne_teismo_tvarka | Out-of-court bankruptcy date | date | 83.3 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | nutraukimo_data | Proceedings terminated | date | 97.9 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | nutraukimo_priezastis | Termination reason | text | 97.9 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | likvidavimo_data | Liquidation date | date | 11.1 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | supaprastintas_bankrotas | Simplified bankruptcy date | date | 88.1 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | nutrauktas_supaprastintas | Simplified bankruptcy terminated | date | 99.9 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | tycinis_bankrotas | Intentional bankruptcy recognised | date | 96.4 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | tycinio_bankroto_nutraukimas | Intentional bankruptcy terminated | date | 99.9 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | sprendimas_del_pabaigos | Decision to end | date | 33.9 | insolvency |
| AVNT bankruptcy | BankrotoAtaskaitosDatos.csv | isregistravimo_data | Deregistered | date | 36.4 | closed_date |
| EU funds 2014-2020 | Contract.csv | project._id | project (ref) (English field name) | text | 96.9 | - |
| EU funds 2014-2020 | Contract.csv | name | Name | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | tripartite | tripartite (English field name) | text | 0.4 | - |
| EU funds 2014-2020 | Contract.csv | state_aid | state aid (English field name) | text | 0.1 | - |
| EU funds 2014-2020 | Contract.csv | de_minimis_aid | de minimis aid (English field name) | text | 0.1 | - |
| EU funds 2014-2020 | Contract.csv | awards | awards (English field name) | text | 46.4 | - |
| EU funds 2014-2020 | Contract.csv | iti | iti (English field name) | text | 0.4 | - |
| EU funds 2014-2020 | Contract.csv | baltic_strategy | baltic strategy (English field name) | text | 0.4 | - |
| EU funds 2014-2020 | Contract.csv | is_submitted_ppp | is submitted ppp (English field name) | text | 2.5 | - |
| EU funds 2014-2020 | Contract.csv | partic_attend | partic attend (English field name) | text | 82.1 | - |
| EU funds 2014-2020 | Contract.csv | esf | esf (English field name) | text | 82.0 | - |
| EU funds 2014-2020 | Contract.csv | is_provided_gng | is provided gng (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | implement_type | implement type (English field name) | text | 99.8 | - |
| EU funds 2014-2020 | Contract.csv | impl_partners | impl partners (English field name) | text | 62.0 | - |
| EU funds 2014-2020 | Contract.csv | women_attend | women attend (English field name) | text | 62.0 | - |
| EU funds 2014-2020 | Contract.csv | partnership | partnership (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | voluminous | voluminous (English field name) | text | 18.0 | - |
| EU funds 2014-2020 | Contract.csv | executor | Grant recipient name | text | 6.8 | eu_funds |
| EU funds 2014-2020 | Contract.csv | executor_code | Grant recipient code | number | 0.0 | eu_funds |
| EU funds 2014-2020 | Contract.csv | executor_foreign_person | executor foreign person (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | legal_person_type | legal person type (English field name) | text | 0.4 | - |
| EU funds 2014-2020 | Contract.csv | subject_legal_form | subject legal form (English field name) | text | 3.9 | - |
| EU funds 2014-2020 | Contract.csv | description | Description | text | 0.0 | eu_funds |
| EU funds 2014-2020 | Contract.csv | county | county (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | municipality | municipality (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | eurostat_territory | eurostat territory (English field name) | text | 0.3 | - |
| EU funds 2014-2020 | Contract.csv | in_another_eu | in another eu (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | outside_eu | outside eu (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | fin_outside_amount | fin outside amount (English field name) | number | 99.7 | - |
| EU funds 2014-2020 | Contract.csv | duration | duration (English field name) | number | 0.6 | - |
| EU funds 2014-2020 | Contract.csv | principle | principle (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | started | Started | date | 0.6 | eu_funds |
| EU funds 2014-2020 | Contract.csv | canceled | canceled (English field name) | date | 95.8 | - |
| EU funds 2014-2020 | Contract.csv | finished | Finished | date | 22.2 | eu_funds |
| EU funds 2014-2020 | Contract.csv | impl_from | impl from (English field name) | date | 0.5 | - |
| EU funds 2014-2020 | Contract.csv | impl_till | impl till (English field name) | date | 0.4 | - |
| EU funds 2014-2020 | Contract.csv | fin_eligibility | fin eligibility (English field name) | text | 61.5 | - |
| EU funds 2014-2020 | Contract.csv | max_advance_amount | Maximum advance (EUR) | number | 0.0 | eu_funds |
| EU funds 2014-2020 | Contract.csv | final_pay_by | final pay by (English field name) | date | 46.4 | - |
| EU funds 2014-2020 | Contract.csv | expense_compensation | expense compensation (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | account_payment | account payment (English field name) | text | 0.6 | - |
| EU funds 2014-2020 | Contract.csv | fixed_rate | fixed rate (English field name) | text | 0.1 | - |
| EU funds 2014-2020 | Contract.csv | fixed_sum | fixed sum (English field name) | text | 0.1 | - |
| EU funds 2014-2020 | Contract.csv | finished_report | finished report (English field name) | text | 0.0 | - |
| EU funds 2014-2020 | Contract.csv | finished_report_period | finished report period (English field name) | number | 70.5 | - |
| EU funds 2014-2020 | Contract.csv | finished_report_order | finished report order (English field name) | text | 71.4 | - |
| EU funds 2014-2020 | Contract.csv | store_until | store until (English field name) | date | 51.0 | - |
| VPT procurement | Atn1TendererList.csv | id | Source row ID | number | 0.0 | - |
| VPT procurement | Atn1TendererList.csv | atn1._id | Procurement report (ref) | text | 0.0 | procurement_contracts |
| VPT procurement | Atn1TendererList.csv | item | Item flag | number | 96.1 | - |
| VPT procurement | Atn1TendererList.csv | is_tender_private_person | Tenderer is a natural person | text | 0.0 | - |
| VPT procurement | Atn1TendererList.csv | code | Tenderer code | number | 1.7 | procurement_contracts |
| VPT procurement | Atn1TendererList.csv | name | Name | text | 0.6 | - |
| VPT procurement | Atn1TendererList.csv | selected_tenderer | selected tenderer (English field name) | empty | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | name_adjustment | name adjustment (English field name) | empty | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | group_name | group name (English field name) | text | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | address | Tenderer address | text | 3.6 | - |
| VPT procurement | Atn1TendererList.csv | country | Country | text | 1.8 | - |
| VPT procurement | Atn1TendererList.csv | reason_for_selected_candidates | Reason for selection | text | 96.1 | - |
| VPT procurement | Atn1TendererList.csv | is_price | is price (English field name) | empty | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | price_cost_tender | price cost tender (English field name) | empty | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | is_optional | is optional (English field name) | empty | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | is_price_extent_mandatory | is price extent mandatory (English field name) | empty | 100.0 | - |
| VPT procurement | Atn1TendererList.csv | insert_date | Inserted | date | 0.0 | - |
| VPT procurement | Atn1TendererList.csv | update_date | Updated | date | 0.0 | - |
| JAR API | Dokumentas.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR API | Dokumentas.csv | dokumento_tipas._id | Document type (ref) | text | 0.0 | filings |
| JAR API | Dokumentas.csv | dokumento_potipis._id | Document subtype (ref) | text | 0.0 | filings |
| JAR API | Dokumentas.csv | dok_data | Document date | date | 0.0 | filings |
| JAR API | Dokumentas.csv | dok_reg_data | Document registered | date | 0.0 | filings |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | template_id | Statement template | text | 0.0 | fs_latest_year |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | standard_id | Statement standard (short / full) | text | 0.0 | fs_latest_year |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | line_type_id | Line ID | text | 0.0 | - |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | line_name | Line name (LT) | text | 0.0 | - |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | reiksme | Amount (EUR) | number | 0.0 | - |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | laikotarpis_nuo | Period from | date | 0.0 | fs_latest_year |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | laikotarpis_iki | Period to | date | 0.0 | fs_latest_year |
| JAR financial statements | PelnoAtaskaita_2024plus.csv | reg_date | Filing registered | date | 0.0 | filings |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | template_id | Statement template | text | 0.0 | fs_latest_year |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | standard_id | Statement standard (short / full) | text | 0.0 | fs_latest_year |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | line_type_id | Line ID | text | 0.0 | - |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | line_name | Line name (LT) | text | 0.0 | - |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | reiksme | Amount (EUR) | number | 0.0 | - |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | laikotarpis_nuo | Period from | date | 0.0 | fs_latest_year |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | laikotarpis_iki | Period to | date | 0.0 | fs_latest_year |
| JAR financial statements | BalansoAtaskaita_2024plus.csv | reg_date | Filing registered | date | 0.0 | filings |
| JADIS member counts | Dalyvis.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JADIS member counts | Dalyvis.csv | form_kodas._id | Legal form (ref) | text | 0.0 | legal_form |
| JADIS member counts | Dalyvis.csv | stat_statusas._id | Status (ref) | text | 0.0 | status |
| JADIS member counts | Dalyvis.csv | lr_fiziniai | Members: LT natural persons (count) | number | 15.7 | members_shareholders |
| JADIS member counts | Dalyvis.csv | lr_juridiniai | Members: LT legal persons (count) | number | 91.6 | members_shareholders |
| JADIS member counts | Dalyvis.csv | uzsienio_fiziniai | Members: foreign natural persons (count) | number | 91.3 | members_shareholders |
| JADIS member counts | Dalyvis.csv | uzsienio_juridiniai | Members: foreign legal persons (count) | number | 97.1 | members_shareholders |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | eil_nr | Row number | number | 0.0 | - |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | imones_kodas | Company code | number | 0.0 | reg_code |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | imones_pavadinimas | Company name | text | 0.0 | legal_name |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | bankroto_pradzia | Bankruptcy start | date | 0.0 | insolvency |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | apygardos_teismas | Regional court | text | 0.1 | insolvency |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | likvidavimo_data | Liquidation date | date | 0.2 | insolvency |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | tycinis_bankrotas | Intentional bankruptcy recognised | date | 0.0 | insolvency |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | sprendimas_del_pabaigos | Decision to end | date | 18.1 | insolvency |
| AVNT intentional bankruptcy | TycinisBankrotas.csv | isregistravimo_data | Deregistered | date | 20.0 | closed_date |
| JAR API | VeluojantisPateikti.csv | juridinis_asmuo._id | Company (ref to register UUID) | text | 0.0 | reg_code |
| JAR API | VeluojantisPateikti.csv | ja_reg_data | Registration date | empty | 100.0 | reg_date |
| JAR API | VeluojantisPateikti.csv | forma._id | Legal form (ref) | text | 0.0 | legal_form |
| JAR API | VeluojantisPateikti.csv | statusas._id | Legal status (ref) | text | 0.0 | status |
| JAR API | VeluojantisPateikti.csv | veluojantis_iki | Late for year (empty) | empty | 100.0 | filings |
| GLEIF | lt_lei.csv | lei | LEI | text | 0.0 | lei |
| GLEIF | lt_lei.csv | registered_as | Registry code at the registration authority | number | 2.0 | reg_code |
| GLEIF | lt_lei.csv | registered_at | Registration authority ID | text | 0.0 | - |
| GLEIF | lt_lei.csv | entity_status | Entity status | text | 0.0 | - |
| GLEIF | lt_lei.csv | registration_status | LEI registration status | text | 0.0 | - |
| Sodra yearly monthly file | monthly-2026.csv | Draudėjo kodas (code) | Insurer code (Sodra) | number | 0.0 | - |
| Sodra yearly monthly file | monthly-2026.csv | Juridinių asmenų registro kodas (jarCode) | Registry code | number | 0.6 | reg_code |
| Sodra yearly monthly file | monthly-2026.csv | Pavadinimas (name) | Name | text | 0.0 | legal_name |
| Sodra yearly monthly file | monthly-2026.csv | Savivaldybė, kurioje registruota(municipality) | Municipality | text | 0.0 | address |
| Sodra yearly monthly file | monthly-2026.csv | Ekonominės veiklos rūšies kodas(ecoActCode) | Activity code (numeric) | number | 2.7 | activity_code |
| Sodra yearly monthly file | monthly-2026.csv | Ekonominės veiklos rūšies kodas EVRK(ecoActCodeStr) | Activity code (EVRK) | text | 2.7 | activity_code |
| Sodra yearly monthly file | monthly-2026.csv | Ekonominės veiklos rūšies pavadinimas(ecoActName) | Activity label (LT) | text | 2.7 | activity_code |
| Sodra yearly monthly file | monthly-2026.csv | Mėnuo (month) | Month (YYYYMM) | number | 0.0 | employees_current |
| Sodra yearly monthly file | monthly-2026.csv | Vidutinis darbo užmokestis (avgWage) | Average insured income, employees (EUR) | number | 61.4 | avg_salary |
| Sodra yearly monthly file | monthly-2026.csv | Apdraustųjų skaičius (numInsured) | Insured persons | number | 0.0 | employees_current |
| Sodra yearly monthly file | monthly-2026.csv | Vidutinis darbo užmokestis II (avgWage2) | Average income, other insured | number | 99.7 | - |
| Sodra yearly monthly file | monthly-2026.csv | Apdraustųjų skaičius II (numInsured2) | Other insured persons | number | 0.0 | - |
| Sodra yearly monthly file | monthly-2026.csv | Valstybinio socialinio draudimo įmoka (tax) | Social-insurance contributions (EUR) | number | 61.4 | - |
| Sodra daily | APDRAUSTUJU_SKAICIUS.CSV | Mokesčių mokėtojo kodas | Tax-payer code (= registry code for legal persons) | number | 0.0 | reg_code |
| Sodra daily | APDRAUSTUJU_SKAICIUS.CSV | Draudėjo kodas | Insurer code (Sodra) | number | 0.0 | - |
| Sodra daily | APDRAUSTUJU_SKAICIUS.CSV | Apdraustųjų skaičius | Insured persons at start of day | number | 0.0 | employees_current |
| Sodra daily | SKOLA.CSV | Mokesčių mokėtojo kodas | Tax-payer code | number | 0.0 | reg_code |
| Sodra daily | SKOLA.CSV | Draudėjo kodas | Insurer code | number | 0.0 | - |
| Sodra daily | SKOLA.CSV | Skola | Social-insurance debt (EUR, comma decimal) | number | 0.0 | tax_debt |
| Sodra daily | SKOLA.CSV | Atidėta suma | Deferred debt (EUR) | number | 0.0 | tax_debt |
| Sodra monthly | VIDURKIAI.CSV | (7-line header) | Average insured income by contract type and gender, contributions; employers with > 3 insured only | number | n/a | avg_salary |
| Concept | Line IDs |
| Revenue | ISLT00001, ISLT00345, ISLT00293, BSLT00606 |
| Profit before tax | ISLT00017, ISLT00365, ISLT00309, BSLT00612 |
| Net profit | ISLT00019, ISLT00350, ISLT00310, BSLT00614, ISLT00222 |
| Non-current assets | BSLT00001 |
| Current assets | BSLT00021 |
| Total assets | BSLT00115 |
| Equity | BSLT00040, BSLT00583 |
| Liabilities / payables | BSLT00055, BSLT00110, BSLT00467 |
| Tangible fixed assets | BSLT00393 |

## Latvia (LV)

Null % measured on the 2026-11-19 pull (all rows of the file). Types inferred from values: int, dec, date, text.

| Source | Table/file | Field (original) | English meaning | Type | Null % | Canonical field |
|---|---|---|---|---|---|---|
| Enterprise Register: register | register.csv | regcode | Registry code (11 digits with check digit; 9 digits for legacy journal entries) | int | 0.0 | reg_code |
| Enterprise Register: register | register.csv | sepa | SEPA creditor identifier | text | 22.37 |  |
| Enterprise Register: register | register.csv | name | Legal name | text | 0.0 | legal_name |
| Enterprise Register: register | register.csv | name_before_quotes | name before quotes | text | 10.23 |  |
| Enterprise Register: register | register.csv | name_in_quotes | name in quotes | text | 2.89 |  |
| Enterprise Register: register | register.csv | name_after_quotes | name after quotes | text | 94.92 |  |
| Enterprise Register: register | register.csv | without_quotes | without quotes | int | 0.87 |  |
| Enterprise Register: register | register.csv | regtype | Register type code (K = Commercial Register, others) | text | 0.0 |  |
| Enterprise Register: register | register.csv | regtype_text | regtype text | text | 0.0 |  |
| Enterprise Register: register | register.csv | type | Legal form code (SIA, AS, IK, ...) | text | 0.0 | legal_form |
| Enterprise Register: register | register.csv | type_text | type text | text | 0.29 |  |
| Enterprise Register: register | register.csv | registered | Registration date | date | 0.02 | reg_date |
| Enterprise Register: register | register.csv | terminated | Termination date | date | 45.31 | closed_date |
| Enterprise Register: register | register.csv | closed | Closure code (L liquidated, R reorganised, blank = open) | text | 45.44 | status |
| Enterprise Register: register | register.csv | address | Registered address (full text) | text | 0.12 | address |
| Enterprise Register: register | register.csv | index | Postal code | int | 4.12 |  |
| Enterprise Register: register | register.csv | addressid | Address-register ID | int | 0.0 |  |
| Enterprise Register: register | register.csv | region | Region | int | 0.0 |  |
| Enterprise Register: register | register.csv | city | City | int | 0.0 |  |
| Enterprise Register: register | register.csv | atvk | Territorial unit code (ATVK) | int | 13.35 |  |
| Enterprise Register: register | register.csv | reregistration_term | reregistration term | date | 100.0 |  |
| Enterprise Register: officers | officers.csv | id | Row ID (stable across pulls) | int | 0.0 |  |
| Enterprise Register: officers | officers.csv | uri | URI (always empty) | empty | 100.0 |  |
| Enterprise Register: officers | officers.csv | at_legal_entity_registration_number | at legal entity registration number | int | 0.0 | reg_code |
| Enterprise Register: officers | officers.csv | entity_type | entity type | text | 0.0 |  |
| Enterprise Register: officers | officers.csv | position | Role (English enum, e.g. BOARD_MEMBER) | text | 29.03 | officer_roles_dates |
| Enterprise Register: officers | officers.csv | governing_body | governing body | text | 17.32 |  |
| Enterprise Register: officers | officers.csv | name | Officer name (person or legal entity) | text | 0.0 | legal_name |
| Enterprise Register: officers | officers.csv | latvian_identity_number_masked | latvian identity number masked | text | 6.87 | person_identifier |
| Enterprise Register: officers | officers.csv | birth_date | birth date | text | 97.42 | person_identifier |
| Enterprise Register: officers | officers.csv | legal_entity_registration_number | legal entity registration number | int | 99.64 | reg_code |
| Enterprise Register: officers | officers.csv | rights_of_representation_type | rights of representation type | text | 0.13 |  |
| Enterprise Register: officers | officers.csv | representation_with_at_least | representation with at least | int | 0.0 |  |
| Enterprise Register: officers | officers.csv | registered_on | registered on | date | 0.03 | officer_roles_dates |
| Enterprise Register: officers | officers.csv | last_modified_at | last modified at | date | 0.0 |  |
| Enterprise Register: members | members.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: members | members.csv | uri | URI (always empty) | empty | 100.0 |  |
| Enterprise Register: members | members.csv | at_legal_entity_registration_number | at legal entity registration number | int | 0.0 | reg_code |
| Enterprise Register: members | members.csv | entity_type | entity type | text | 0.0 |  |
| Enterprise Register: members | members.csv | name | Member name (person or legal entity) | text | 0.09 | legal_name |
| Enterprise Register: members | members.csv | latvian_identity_number_masked | latvian identity number masked | text | 12.09 | person_identifier |
| Enterprise Register: members | members.csv | birth_date | birth date | text | 97.15 | person_identifier |
| Enterprise Register: members | members.csv | legal_entity_registration_number | legal entity registration number | int | 93.99 | reg_code |
| Enterprise Register: members | members.csv | number_of_shares | number of shares | dec | 0.0 | members_shareholders |
| Enterprise Register: members | members.csv | share_nominal_value | share nominal value | dec | 0.0 |  |
| Enterprise Register: members | members.csv | share_currency | share currency | text | 0.0 |  |
| Enterprise Register: members | members.csv | date_from | date from | date | 0.0 |  |
| Enterprise Register: members | members.csv | registered_on | registered on | date | 0.0 | officer_roles_dates |
| Enterprise Register: members | members.csv | last_modified_at | last modified at | date | 0.0 |  |
| Enterprise Register: member joint owners | members_joint_owners.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: member joint owners | members_joint_owners.csv | member_id | member id | int | 0.0 |  |
| Enterprise Register: member joint owners | members_joint_owners.csv | entity_type | entity type | text | 0.0 |  |
| Enterprise Register: member joint owners | members_joint_owners.csv | name | Co-owner name | text | 0.0 | legal_name |
| Enterprise Register: member joint owners | members_joint_owners.csv | latvian_identity_number_masked | latvian identity number masked | text | 3.75 | person_identifier |
| Enterprise Register: member joint owners | members_joint_owners.csv | birth_date | birth date | text | 98.22 | person_identifier |
| Enterprise Register: member joint owners | members_joint_owners.csv | legal_entity_registration_number | legal entity registration number | int | 98.82 | reg_code |
| Enterprise Register: beneficial owners | beneficial_owners.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: beneficial owners | beneficial_owners.csv | legal_entity_registration_number | legal entity registration number | int | 0.0 | reg_code |
| Enterprise Register: beneficial owners | beneficial_owners.csv | forename | Beneficial owner first name | text | 0.0 | beneficial_owners |
| Enterprise Register: beneficial owners | beneficial_owners.csv | surname | Beneficial owner surname | text | 0.03 | beneficial_owners |
| Enterprise Register: beneficial owners | beneficial_owners.csv | latvian_identity_number_masked | latvian identity number masked | text | 4.67 | person_identifier |
| Enterprise Register: beneficial owners | beneficial_owners.csv | birth_date | birth date | text | 95.33 | person_identifier |
| Enterprise Register: beneficial owners | beneficial_owners.csv | nationality | Nationality (country code) | text | 0.0 |  |
| Enterprise Register: beneficial owners | beneficial_owners.csv | residence | Country of residence | text | 0.01 |  |
| Enterprise Register: beneficial owners | beneficial_owners.csv | registered_on | registered on | date | 0.0 | officer_roles_dates |
| Enterprise Register: beneficial owners | beneficial_owners.csv | last_modified_at | last modified at | date | 0.06 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_id | proceeding id | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | debtor_name | debtor name | text | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | debtor_registration_number | debtor registration number | int | 0.0 | reg_code |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | debtor_cleaned_name | debtor cleaned name | text | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | debtor_address | debtor address | text | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_started_on | proceeding started on | date | 0.0 | insolvency |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_ended_on | proceeding ended on | date | 4.53 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_form | proceeding form | text | 0.0 | insolvency |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_type | proceeding type | text | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_subtype | proceeding subtype | text | 99.63 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_resolution_type | proceeding resolution type | text | 5.86 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | proceeding_resolution_name | proceeding resolution name | text | 5.86 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | entry_created_on | entry created on | date | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | court_case_initial_number | court case initial number | text | 0.34 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | court_code | court code | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | court_name | court name | text | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | creditor_applications_deadline_date | creditor applications deadline date | date | 84.45 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | creditor_applications_deadline_in_days | creditor applications deadline in days | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | creditor_applications_deadline_in_weeks | creditor applications deadline in weeks | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | creditor_applications_deadline_in_months | creditor applications deadline in months | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | creditor_applications_deadline_in_years | creditor applications deadline in years | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | legislation_number | legislation number | int | 0.0 |  |
| Enterprise Register: insolvency proceedings | insolvency_legal_person_proceeding.csv | legislation_version | legislation version | int | 0.0 |  |
| Enterprise Register: securing measures | securing_measures.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: securing measures | securing_measures.csv | legal_entity_registration_number | legal entity registration number | int | 2.12 | reg_code |
| Enterprise Register: securing measures | securing_measures.csv | securing_measure_type | securing measure type | text | 0.23 | pledges_securing_measures |
| Enterprise Register: securing measures | securing_measures.csv | securing_measure_type_text | securing measure type text | text | 0.23 |  |
| Enterprise Register: securing measures | securing_measures.csv | type_details | type details | text | 17.4 |  |
| Enterprise Register: securing measures | securing_measures.csv | date_from | date from | date | 0.0 |  |
| Enterprise Register: securing measures | securing_measures.csv | case_number | case number | text | 2.23 |  |
| Enterprise Register: securing measures | securing_measures.csv | institution_identifier | institution identifier | int | 0.06 |  |
| Enterprise Register: securing measures | securing_measures.csv | institution_registration_number | institution registration number | int | 71.69 |  |
| Enterprise Register: securing measures | securing_measures.csv | institution_name | institution name | text | 0.06 |  |
| Enterprise Register: suspensions | suspensions_prohibitions.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: suspensions | suspensions_prohibitions.csv | legal_entity_registration_number | legal entity registration number | int | 0.0 | reg_code |
| Enterprise Register: suspensions | suspensions_prohibitions.csv | suspension_code | suspension code | text | 0.0 | pledges_securing_measures |
| Enterprise Register: suspensions | suspensions_prohibitions.csv | suspension_code_text | suspension code text | text | 0.0 |  |
| Enterprise Register: suspensions | suspensions_prohibitions.csv | date_from | date from | date | 0.0 |  |
| Enterprise Register: suspensions | suspensions_prohibitions.csv | ground_for | ground for | text | 0.0 |  |
| Enterprise Register: liquidations | liquidations.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: liquidations | liquidations.csv | legal_entity_registration_number | legal entity registration number | int | 0.0 | reg_code |
| Enterprise Register: liquidations | liquidations.csv | liquidation_type | liquidation type | text | 0.0 | court_or_official_notices |
| Enterprise Register: liquidations | liquidations.csv | liquidation_type_text | liquidation type text | text | 0.0 |  |
| Enterprise Register: liquidations | liquidations.csv | date_from | date from | date | 0.0 |  |
| Enterprise Register: liquidations | liquidations.csv | grounds_for_liquidation | grounds for liquidation | text | 0.02 |  |
| Enterprise Register: liquidations | liquidations.csv | registered_on | registered on | date | 0.0 | officer_roles_dates |
| Enterprise Register: liquidations | liquidations.csv | last_modified_at | last modified at | date | 0.0 |  |
| Enterprise Register: reorganisations | reorganizations.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: reorganisations | reorganizations.csv | reorganization_type | reorganization type | text | 0.0 |  |
| Enterprise Register: reorganisations | reorganizations.csv | reorganization_type_text | reorganization type text | text | 0.0 |  |
| Enterprise Register: reorganisations | reorganizations.csv | source_entity_regcode | source entity regcode | int | 0.01 |  |
| Enterprise Register: reorganisations | reorganizations.csv | final_entity_regcode | final entity regcode | int | 0.01 |  |
| Enterprise Register: reorganisations | reorganizations.csv | registered | Registration date of the reorganisation | date | 4.7 | reg_date |
| Enterprise Register: equity capital | equity_capitals.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: equity capital | equity_capitals.csv | legal_entity_registration_number | legal entity registration number | int | 0.0 | reg_code |
| Enterprise Register: equity capital | equity_capitals.csv | equity_capital_type | equity capital type | text | 0.0 |  |
| Enterprise Register: equity capital | equity_capitals.csv | equity_capital_type_text | equity capital type text | text | 0.0 |  |
| Enterprise Register: equity capital | equity_capitals.csv | amount | Share capital amount | dec | 0.0 |  |
| Enterprise Register: equity capital | equity_capitals.csv | currency | Currency of the share capital | text | 0.0 |  |
| Enterprise Register: equity capital | equity_capitals.csv | date_from | date from | date | 0.0 |  |
| Enterprise Register: equity capital | equity_capitals.csv | last_modified_at | last modified at | date | 0.0 |  |
| Enterprise Register: name history | register_name_history.csv | regcode | Registry code | int | 0.0 | reg_code |
| Enterprise Register: name history | register_name_history.csv | date_to | date to | date | 0.0 |  |
| Enterprise Register: name history | register_name_history.csv | name | Former name | text | 0.27 | legal_name |
| Enterprise Register: sanctions links | sanctions.csv | id | Row ID | int | 0.0 |  |
| Enterprise Register: sanctions links | sanctions.csv | registered_on | registered on | date | 0.0 | officer_roles_dates |
| Enterprise Register: sanctions links | sanctions.csv | entity_type | entity type | text | 0.0 |  |
| Enterprise Register: sanctions links | sanctions.csv | name | Sanctioned subject's name | text | 7.94 | legal_name |
| Enterprise Register: sanctions links | sanctions.csv | birth_date | birth date | date | 11.11 | person_identifier |
| Enterprise Register: sanctions links | sanctions.csv | latvian_identity_number_masked | latvian identity number masked | text | 61.9 | person_identifier |
| Enterprise Register: sanctions links | sanctions.csv | nationality | Sanctioned subject's nationality | text | 20.63 |  |
| Enterprise Register: sanctions links | sanctions.csv | legal_form_code | legal form code | text | 95.24 |  |
| Enterprise Register: sanctions links | sanctions.csv | legal_entity_registration_number | legal entity registration number | int | 92.06 | reg_code |
| Enterprise Register: sanctions links | sanctions.csv | legal_entity_name | legal entity name | text | 92.06 |  |
| Enterprise Register: sanctions links | sanctions.csv | legal_entity_country | legal entity country | text | 92.06 |  |
| Enterprise Register: sanctions links | sanctions.csv | position | Subject's role in the Latvian entity (BENEFICIAL_OWNER, SHAREHOLDER, ...) | text | 3.17 | officer_roles_dates |
| Enterprise Register: sanctions links | sanctions.csv | position_text_lv | position text lv | text | 3.17 |  |
| Enterprise Register: sanctions links | sanctions.csv | position_text_en | position text en | text | 3.17 |  |
| Enterprise Register: sanctions links | sanctions.csv | sanctions_subject_legal_form_code | sanctions subject legal form code | text | 4.76 |  |
| Enterprise Register: sanctions links | sanctions.csv | sanctions_subject_registration_number | sanctions subject registration number | int | 3.17 | sanctions_eu |
| Enterprise Register: sanctions links | sanctions.csv | sanctions_subject_name | sanctions subject name | text | 4.76 |  |
| Enterprise Register: sanctions links | sanctions.csv | list | Sanctions list (EU, Latvian national, OFAC SDN) | text | 0.0 | sanctions_eu |
| Enterprise Register: sanctions links | sanctions.csv | list_text | list text | text | 0.0 |  |
| Enterprise Register: sanctions links | sanctions.csv | program | Sanctions programme | text | 0.0 |  |
| Enterprise Register: sanctions links | sanctions.csv | entry_date | entry date | date | 0.0 |  |
| Enterprise Register: sanctions links | sanctions.csv | legal_base | legal base | text | 0.0 |  |
| Enterprise Register: sanctions links | sanctions.csv | legal_base_url | legal base url | text | 50.79 |  |
| Annual reports: statements | financial_statements.csv | id | Statement ID (joins the balance, income and cash-flow files) | int | 0.0 |  |
| Annual reports: statements | financial_statements.csv | file_id | file id | int | 0.0 |  |
| Annual reports: statements | financial_statements.csv | legal_entity_registration_number | legal entity registration number | int | 0.0 | reg_code |
| Annual reports: statements | financial_statements.csv | source_schema | source schema | text | 0.0 |  |
| Annual reports: statements | financial_statements.csv | source_type | source type | text | 34.6 |  |
| Annual reports: statements | financial_statements.csv | year | Financial year | int | 0.0 | fs_latest_year |
| Annual reports: statements | financial_statements.csv | year_started_on | year started on | date | 0.0 |  |
| Annual reports: statements | financial_statements.csv | year_ended_on | year ended on | date | 0.0 |  |
| Annual reports: statements | financial_statements.csv | employees | Average number of employees | int | 0.0 | fs_employees |
| Annual reports: statements | financial_statements.csv | rounded_to_nearest | rounded to nearest | text | 0.0 |  |
| Annual reports: statements | financial_statements.csv | currency | Currency (EUR, or LVL before 2014) | text | 0.0 |  |
| Annual reports: statements | financial_statements.csv | created_at | created at | date | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | statement_id | statement id | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | file_id | file id | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | cash | Cash | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | marketable_securities | marketable securities | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | accounts_receivable | accounts receivable | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | inventories | Inventories | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | total_current_assets | total current assets | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | investments | Investments | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | fixed_assets | fixed assets | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | intangible_assets | intangible assets | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | total_non_current_assets | total non current assets | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | total_assets | total assets | int | 0.0 | total_assets |
| Annual reports: balance sheets | balance_sheets.csv | future_housing_repairs_payments | future housing repairs payments | int | 97.97 |  |
| Annual reports: balance sheets | balance_sheets.csv | current_liabilities | current liabilities | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | non_current_liabilities | non current liabilities | int | 0.0 |  |
| Annual reports: balance sheets | balance_sheets.csv | provisions | Provisions | int | 5.85 |  |
| Annual reports: balance sheets | balance_sheets.csv | equity | Equity | int | 0.0 | equity |
| Annual reports: balance sheets | balance_sheets.csv | total_equities | total equities | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | statement_id | statement id | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | file_id | file id | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | net_turnover | net turnover | int | 0.0 | revenue |
| Annual reports: income statements | income_statements.csv | by_nature_inventory_change | by nature inventory change | int | 89.33 |  |
| Annual reports: income statements | income_statements.csv | by_nature_long_term_investment_expenses | by nature long term investment expenses | int | 89.33 |  |
| Annual reports: income statements | income_statements.csv | by_nature_other_operating_revenues | by nature other operating revenues | int | 89.33 |  |
| Annual reports: income statements | income_statements.csv | by_nature_material_expenses | by nature material expenses | int | 89.33 |  |
| Annual reports: income statements | income_statements.csv | by_nature_labour_expenses | by nature labour expenses | int | 89.33 |  |
| Annual reports: income statements | income_statements.csv | by_nature_depreciation_expenses | by nature depreciation expenses | int | 89.33 |  |
| Annual reports: income statements | income_statements.csv | by_function_cost_of_goods_sold | by function cost of goods sold | int | 10.67 |  |
| Annual reports: income statements | income_statements.csv | by_function_gross_profit | by function gross profit | int | 10.67 |  |
| Annual reports: income statements | income_statements.csv | by_function_selling_expenses | by function selling expenses | int | 10.67 |  |
| Annual reports: income statements | income_statements.csv | by_function_administrative_expenses | by function administrative expenses | int | 10.67 |  |
| Annual reports: income statements | income_statements.csv | by_function_other_operating_revenues | by function other operating revenues | int | 10.67 |  |
| Annual reports: income statements | income_statements.csv | other_operating_expenses | other operating expenses | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | equity_investment_earnings | equity investment earnings | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | other_long_term_investment_earnings | other long term investment earnings | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | other_interest_revenues | other interest revenues | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | investment_fair_value_adjustments | investment fair value adjustments | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | interest_expenses | interest expenses | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | extra_revenues | extra revenues | int | 66.32 |  |
| Annual reports: income statements | income_statements.csv | extra_expenses | extra expenses | int | 66.32 |  |
| Annual reports: income statements | income_statements.csv | income_before_income_taxes | income before income taxes | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | provision_for_income_taxes | provision for income taxes | int | 0.0 |  |
| Annual reports: income statements | income_statements.csv | income_after_income_taxes | income after income taxes | int | 33.68 |  |
| Annual reports: income statements | income_statements.csv | other_taxes | other taxes | int | 66.32 |  |
| Annual reports: income statements | income_statements.csv | extra_dividends | extra dividends | int | 20.69 |  |
| Annual reports: income statements | income_statements.csv | net_income | net income | int | 0.0 | net_profit |
| Annual reports: cash flow | cash_flow_statements.csv | statement_id | statement id | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | file_id | file id | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_cash_received_from_customers | cfo dm cash received from customers | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_cash_paid_to_suppliers_employees | cfo dm cash paid to suppliers employees | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_other_cash_received_paid | cfo dm other cash received paid | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_operating_cash_flow | cfo dm operating cash flow | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_interest_paid | cfo dm interest paid | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_income_taxes_paid | cfo dm income taxes paid | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_extra_items_cash_flow | cfo dm extra items cash flow | int | 73.86 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_dm_net_operating_cash_flow | cfo dm net operating cash flow | int | 61.68 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_income_before_income_taxes | cfo im income before income taxes | int | 38.32 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_income_before_changes_in_working_capital | cfo im income before changes in working capital | int | 38.32 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_operating_cash_flow | cfo im operating cash flow | int | 38.32 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_interest_paid | cfo im interest paid | int | 38.32 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_income_taxes_paid | cfo im income taxes paid | int | 38.32 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_extra_items_cash_flow | cfo im extra items cash flow | int | 55.26 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfo_im_net_operating_cash_flow | cfo im net operating cash flow | int | 38.32 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_acquisition_of_stocks_shares | cfi acquisition of stocks shares | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_sale_proceeds_from_stocks_shares | cfi sale proceeds from stocks shares | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_acquisition_of_fixed_assets_intangible_assets | cfi acquisition of fixed assets intangible assets | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_sale_proceeds_from_fixed_assets_intangible_assets | cfi sale proceeds from fixed assets intangible assets | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_loans_made | cfi loans made | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_repayments_of_loans_received | cfi repayments of loans received | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_interest_received | cfi interest received | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_dividends_received | cfi dividends received | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cfi_net_investing_cash_flow | cfi net investing cash flow | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_proceeds_from_stocks_bonds_issuance_or_contributed_capital | cff proceeds from stocks bonds issuance or contributed capital | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_loans_received | cff loans received | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_subsidies_grants_donations_received | cff subsidies grants donations received | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_repayments_of_loans_made | cff repayments of loans made | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_repayments_of_lease_obligations | cff repayments of lease obligations | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_dividends_paid | cff dividends paid | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | cff_net_financing_cash_flow | cff net financing cash flow | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | effect_of_exchange_rate_change | effect of exchange rate change | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | net_increase | net increase | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | at_beginning_of_year | at beginning of year | int | 0.0 |  |
| Annual reports: cash flow | cash_flow_statements.csv | at_end_of_year | at end of year | int | 0.0 |  |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Registracijas_kods | registry code | int | 0.0 | reg_code |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Nosaukums | name | text | 0.0 |  |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Taksacijas_gads_ceturksnis | tax quarter (Latvian text) | text | 0.0 |  |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR | taxes paid, thousand EUR | dec | 0.0 | taxes_paid |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Taja_skaita_PVN_iemaksa | of which VAT paid | dec | 0.0 |  |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Taja_skaita_PVN_atmaksa | of which VAT refunded | dec | 0.0 |  |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Taja_skaita_IIN_summa | of which personal income tax | dec | 0.0 |  |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Taja_skaita_VSAOI_summa | of which social contributions | dec | 0.0 | avg_salary (derived) |
| VID: taxes paid per quarter | pdb_samaksato_nodoklu_kopsummas_cet.csv | Videjais_nodarbinato_personu_skaits_cilv | average employees | int | 0.0 | employees_current |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Registracijas_kods | registry code | int | 0.0 | reg_code |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Nosaukums | name | text | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Taksacijas_gads | tax year | int | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Uznemejdarbibas_forma | legal form | text | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Pamatdarbibas_NACE_kods | main activity NACE code | int | 0.0 | activity_code |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Juridiska_adrese_ATVK_kods | territory code of legal address | int | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Juridiska_adrese_ATVK_nosaukums | territory name | text | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR | taxes paid, thousand EUR | dec | 0.0 | taxes_paid |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Taja_skaita_IIN | of which personal income tax | dec | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Taja_skaita_VSAOI | of which social contributions | dec | 0.0 |  |
| VID: taxes paid per year | pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv | Videjais_nodarbinato_personu_skaits_cilv | average employees | int | 0.0 | employees_current |
| VID: taxpayer rating | reitings_uznemumi.csv | Registracijas_kods | registry code | int | 0.0 | reg_code |
| VID: taxpayer rating | reitings_uznemumi.csv | Nosaukums | name | text | 0.0 |  |
| VID: taxpayer rating | reitings_uznemumi.csv | Reitings | tax rating A/B/C/N/J | text | 0.0 | tax_debt (proxy) |
| VID: taxpayer rating | reitings_uznemumi.csv | Skaidrojums | rating explanation (Latvian) | text | 0.0 |  |
| VID: taxpayer rating | reitings_uznemumi.csv | Informacijas_atjaunosanas_datums | rating update date | date | 0.0 |  |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | Numurs | VAT number (LV + code) | text | 0.0 | vat_number |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | Nosaukums | name | text | 0.0 |  |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | Aktivs | active VAT payer (ir/nav) | text | 0.0 | vat_registered |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | Registrets | VAT registration date | date | 0.0 |  |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | Buvniecibas_pazime | construction-sector flag | text | 0.0 |  |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | PVN139_2_pazime | VAT art. 139(2) flag | text | 0.0 |  |
| VID: VAT payers | pdb_pvnmaksataji_odata.csv | Izslegts | removed from VAT register | date | 30.07 |  |
| VID: activity suspensions | pdb_saimndarbibaaptureta_odata.csv | Registracijas_kods | registry code | text | 0.0 | reg_code |
| VID: activity suspensions | pdb_saimndarbibaaptureta_odata.csv | Nosaukums | name | text | 0.0 |  |
| VID: activity suspensions | pdb_saimndarbibaaptureta_odata.csv | Lemuma_datums | suspension decision date | date | 0.0 | pledges_securing_measures |
| VID: activity suspensions | pdb_saimndarbibaaptureta_odata.csv | Aizliegts_veikt_darijumus_no | transactions banned from | date | 1.54 |  |
| VID: activity suspensions | pdb_saimndarbibaaptureta_odata.csv | Aizliegts_veikt_darijumus_lidz | transactions banned until | date | 10.32 |  |
| VID: activity suspensions | pdb_saimndarbibaaptureta_odata.csv | Lemuma_par_atjaunosanu_datums | restoration decision date | date | 94.72 |  |
| VID: minimum-wage employers | pdb_dd_minalgasmaksataji_odata.csv | Darba_deveja_reg_kods_vai_personas_koda_otra_dala | employer code, or second half of a personal code | text | 0.0 |  |
| VID: minimum-wage employers | pdb_dd_minalgasmaksataji_odata.csv | Darba_deveja_dzimsanas_gads | employer birth year | empty | 100.0 |  |
| VID: minimum-wage employers | pdb_dd_minalgasmaksataji_odata.csv | Darba_deveja_nosaukums_vai_uzvards_vards_vardi | employer name or person's name | text | 0.0 |  |
| VID: minimum-wage employers | pdb_dd_minalgasmaksataji_odata.csv | Periods_no | period from | date | 0.0 |  |
| VID: minimum-wage employers | pdb_dd_minalgasmaksataji_odata.csv | Periods_lidz | period to | date | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | SamNumurs | Specific support objective number | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | SamNosaukums | Specific support objective name | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | PasakumaNumurs | Measure number | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | PasakumaNosaukums | Measure name | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | AtbildigaIestade | Responsible authority | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaNosaukums | Project name | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaNumurs | project number | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektsIrStrategiskiSvarigs | Strategically important project (flag) | int | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | PvnIrAttiecinamasIzmaksas | VAT is an eligible cost (flag) | int | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektsTiekIstenotsSaskanaArPrivataSektoraPartneribasStrukturu | Implemented as a public-private partnership (flag) | int | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | AtlasesVeids | Selection type | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | PecuzraudzibasPeriodsGados | Post-monitoring period (years) | int | 0.74 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaklasifikacijaNACE | Project NACE classification | text | 0.04 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | IesniedzejaNosaukums | applicant name | text | 11.53 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | IesniedzejaRegNo | applicant registry code | int | 46.16 | eu_funds |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | IesniedzejaJuridiskaAdrese | Applicant's legal address | text | 46.2 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | FinansejumaSanemejaEpasts | applicant email | text | 68.8 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | FinansejumaSanemejaTimeklaVietne | applicant website | text | 45.11 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaIesniedzejaTips | Applicant type | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | IrValstsBudzetaFinansetaInstitucija | Applicant is a state-budget institution (flag) | int | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaStatuss | project status | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | LigumaNoslegsanasDatums | contract date | date | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaIeviesanasSakumaDatums | Project start date | date | 0.16 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaIeviesanasBeiguDatums | Project end date | date | 0.16 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | KopsavilkumsKasPublicejamsEiropasSavienibasfondutimeklavietne | Public project summary | text | 0.66 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaMerkis | Project objective | text | 1.48 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaMerkaGrupa | Project target group | text | 61.55 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | Fonds | EU fund | text | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektaKopejasIzmaksas | total project cost | dec | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | KopejaisAttiecinamaisFinansejums | Total eligible funding (EUR) | dec | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ProjektamPieskirtaisESFonduLidzfinansejums | EU co-financing amount | dec | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | NacionalaisPubliskaisFinansejums | National public funding (EUR) | dec | 54.19 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | NacionalaisPrivataisFinansejums | National private funding (EUR) | dec | 33.07 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | ESLidzfinansejumaLikme | EU co-financing rate | dec | 0.0 |  |
| CFLA: EU projects 2021-27 | es_fondu_projektu_saraksts.csv | PedejasDatuAtjauninasanasDatums | Last data update date | date | 0.0 |  |
| CFLA: EU project partners 2021-27 | es_fondu_projektu_sadarbibas_partneri.csv | ProjektaNumurs | project number | text | 0.0 |  |
| CFLA: EU project partners 2021-27 | es_fondu_projektu_sadarbibas_partneri.csv | Nosaukums | name | text | 1.3 |  |
| CFLA: EU project partners 2021-27 | es_fondu_projektu_sadarbibas_partneri.csv | RegNr | partner registry code | int | 5.19 | eu_funds |
| CFLA: EU project partners 2021-27 | es_fondu_projektu_sadarbibas_partneri.csv | Adrese | address | text | 0.46 |  |
| IUB procurement | notice/DD-MM-YYYY.json | lots[].contracts[].winners[].winnerBusinessParties[].companyId | winner registry code | text | 0 for LV legal entities | procurement_contracts |
| IUB procurement | notice/DD-MM-YYYY.json | ...winners[].tenderValue | awarded value, EUR | dec | 21 | procurement_contracts |
| IUB procurement | notice/DD-MM-YYYY.json | ...winnerBusinessParties[].isNaturalPerson | winner is a natural person | bool | 0 | (filter) |
| IUB procurement | notice/DD-MM-YYYY.json | noticeType, identifier, clonedFrom | notice type, ID, replaced notice | text | 0 | procurement_contracts |

## Estonia (EE)

Measured on the files downloaded 19 Nov 2026. Null % = share of occurrences that are null or empty.
Nested arrays are written `parent[].field`; their null % is over the nested records.

| Source | Table/file | Field (original) | English meaning | Type | Null % | Canonical field |
|---|---|---|---|---|---|---|
| RIK annual reports | 4. key figures (one file per year 2019-2025) (`aruannete_elemendid_2025.csv`, 3,772,715 records) | | | | | |
| | | `report_id` | report id (joins the four annual-report files) | str | 0.0 |  |
| | | `tabel` | statement (balance sheet, income statement ...) | str | 0.0 |  |
| | | `elemendi_label` |  | str | 0.0 |  |
| | | `elemendi_nimetus` | element (Revenue, Assets, Equity, ...) | str | 0.2 |  |
| | | `vaartus` | value, EUR | str | 0.0 | revenue, net_profit, total_assets, equity, fs_employees |
| RIK annual reports | 1. report general data (`aruannete_yldandmed.csv`, 1,687,349 records) | | | | | |
| | | `report_id` | report id (joins the four annual-report files) | str | 0.0 |  |
| | | `taidetud_aruanne_report_id` |  | str | 99.9 |  |
| | | `registrikood` | registry code | str | 0.0 | reg_code |
| | | `õiguslik vorm` |  | str | 0.0 |  |
| | | `staatus` |  | str | 0.0 |  |
| | | `aruandeaasta` | report year | str | 0.0 | fs_latest_year |
| | | `kas konsolideeritud?` |  | str | 0.0 |  |
| | | `period_start` |  | str | 0.0 |  |
| | | `period_end` | period end | str | 0.0 |  |
| | | `esitatud_kpv` | submission date | str | 0.0 |  |
| | | `kas auditeeritud?` | audited | str | 0.0 |  |
| | | `valitud aruanne kategooria` | company size category chosen | str | 11.0 |  |
| | | `minimaalne kategooria andmete alusel` |  | str | 11.0 |  |
| | | `auditi töövõtu liik` |  | str | 96.1 |  |
| | | `audiitori otsuse tüüp` | auditor's opinion type | str | 96.4 |  |
| | | `modifikatsioon asjaolu rõhutamine` |  | str | 99.8 |  |
| | | `modifikatsioon muu asjaolu` |  | str | 99.7 |  |
| | | `modifikatsioon tegevuse jatkuvus` |  | str | 100.0 |  |
| | | `Audiitorettevõtja (AEV)` | audit firm | str | 96.6 |  |
| EMTA | tax debtors (legal persons) (`emta_maksuvolglased.csv`, 19,920 records) | | | | | |
| | | `Andmed on seisuga` | data as of | str | 0.0 |  |
| | | `Registrikood` | registry code | str | 0.0 | reg_code |
| | | `Nimi` | name | str | 0.0 |  |
| | | `Maksuvõlg` | tax debt, EUR | str | 0.0 | tax_debt |
| | | `sh vaidlustatud` | of which disputed | str | 0.0 |  |
| | | `sh tasumisgraafikus` | of which in a payment schedule | str | 0.0 |  |
| | | `Tasumisgraafiku lõppkuupäev` | payment schedule end date | str | 76.9 |  |
| | | `Vanima tasumata nõude tasumise tähtpäev` | due date of the oldest unpaid claim | str | 0.0 |  |
| EMTA | taxes paid, turnover, employees per quarter (`emta_tasutud_maksud_kaesolev.csv`, 469,591 records) | | | | | |
| | | `Andmete seis` | data as of | str | 0.0 |  |
| | | `Registrikood` | registry code | str | 0.0 | reg_code |
| | | `Nimi` | name | str | 0.0 |  |
| | | `Liik` | taxpayer type (company, FIE sole trader, non-resident, ...) | str | 0.0 |  |
| | | `Maakond` | county | str | 21.8 |  |
| | | `Tegevusala` | activity | str | 15.4 |  |
| | | `Aasta` | year | str | 0.0 |  |
| | | `Riiklikud maksud I kv` | state taxes paid, Q1 (also II-IV) | str | 32.6 | taxes_paid |
| | | `Riiklikud maksud II kv` |  | str | 33.8 |  |
| | | `Riiklikud maksud III kv` |  | str | 34.0 |  |
| | | `Riiklikud maksud IV kv` |  | str | 65.9 |  |
| | | `Tööjõumaksud I kv` | labour taxes paid, Q1 (also II-IV) | str | 32.6 |  |
| | | `Tööjõumaksud II kv` |  | str | 33.8 |  |
| | | `Tööjõumaksud III kv` |  | str | 34.0 |  |
| | | `Tööjõumaksud IV kv` |  | str | 65.9 |  |
| | | `Käive I kv` | taxable turnover, Q1 (also II-IV) | str | 46.3 |  |
| | | `Käive II kv` |  | str | 46.0 |  |
| | | `Käive III kv` |  | str | 45.6 |  |
| | | `Käive IV kv` |  | str | 72.9 |  |
| | | `Töötajate arv I kv` | employees at quarter end, Q1 (also II-IV) | str | 62.2 | employees_current |
| | | `Töötajate arv II kv` |  | str | 61.7 |  |
| | | `Töötajate arv III kv` |  | str | 61.4 |  |
| | | `Töötajate arv IV kv` |  | str | 81.0 |  |
| RIK annual reports | 2. revenue by activity (`EMTAK_myygitulu.csv`, 1,556,261 records) | | | | | |
| | | `report_id` | report id (joins the four annual-report files) | str | 0.0 |  |
| | | `emtak` | EMTAK code | str | 0.0 |  |
| | | `Jaotatud müügitulu` | revenue for this activity | str | 0.0 |  |
| | | `põhitegevusala` | is main activity | str | 0.0 |  |
| | | `emtak_version` |  | str | 0.0 |  |
| RIK e-Business Register | persons on registry card (`ettevotja_rekvisiidid__kaardile_kantud_isikud.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kirje_id` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_piirkond` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_tyyp` (on nested records) | registry card book-keeping | str | 0.0 | - |
| | | `kande_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardile_kantud_isikud[].isiku_tyyp` | person type: F natural, J legal | str | 0.0 |  |
| | | `kaardile_kantud_isikud[].isiku_roll` | role code (JUHL board member, OSAN shareholder, ...) | str | 0.0 | officers |
| | | `kaardile_kantud_isikud[].isiku_roll_tekstina` | role | str | 0.0 |  |
| | | `kaardile_kantud_isikud[].eesnimi` | first name | str | 5.1 |  |
| | | `kaardile_kantud_isikud[].nimi_arinimi` | surname or company name | str | 0.0 |  |
| | | `kaardile_kantud_isikud[].isikukood_hash` | pseudonymous person id: hash of the personal code (personal codes removed since 1 Nov 2024) | str | 1.8 | person_identifier |
| | | `kaardile_kantud_isikud[].isikukood_registrikood` | registry code when the person is a legal entity | str | 96.0 |  |
| | | `kaardile_kantud_isikud[].valis_kood` | foreign id code | str | 99.0 |  |
| | | `kaardile_kantud_isikud[].valis_kood_riik` | country of the foreign id | str | 97.5 |  |
| | | `kaardile_kantud_isikud[].valis_kood_riik_tekstina` |  | str | 97.5 |  |
| | | `kaardile_kantud_isikud[].synniaeg` | birth date | str | 96.9 |  |
| | | `kaardile_kantud_isikud[].osamaks` |  | float | 99.3 |  |
| | | `kaardile_kantud_isikud[].osamaksu_valuuta` |  | str | 99.3 |  |
| | | `kaardile_kantud_isikud[].osamaksu_valuuta_tekstina` |  | str | 99.3 |  |
| | | `kaardile_kantud_isikud[].volituste_loppemise_kpv` | mandate end date | - | 100.0 |  |
| | | `kaardile_kantud_isikud[].aadress_riik` | country of residence | str | 88.6 |  |
| | | `kaardile_kantud_isikud[].aadress_riik_tekstina` |  | str | 88.6 |  |
| | | `kaardile_kantud_isikud[].aadress_ehak` |  | str | 89.8 |  |
| | | `kaardile_kantud_isikud[].aadress_ehak_tekstina` |  | str | 89.8 |  |
| | | `kaardile_kantud_isikud[].aadress_tanav_maja_korter` |  | str | 95.8 |  |
| | | `kaardile_kantud_isikud[].aadress_postiindeks` |  | str | 97.0 |  |
| | | `kaardile_kantud_isikud[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kaardile_kantud_isikud[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kaardile_kantud_isikud[].email` | person email (on card persons) | str | 97.2 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__adr_id` |  | int | 96.9 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__ads_oid` |  | str | 96.9 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__ads_normaliseeritud_taisaadress` |  | str | 96.9 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__ads_normaliseeritud_taisaadress_tapsustus` |  | str | 100.0 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__koodaadress` |  | str | 96.9 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__adob_id` |  | str | 98.9 |  |
| | | `kaardile_kantud_isikud[].aadress_ads__tyyp` |  | - | 100.0 |  |
| | | `esindusoiguse_normaalregulatsioonid[].roll` |  | str | 0.0 |  |
| | | `esindusoiguse_normaalregulatsioonid[].sisu` |  | str | 0.0 |  |
| | | `esindusoiguse_eritingimused[].esinduse_tyyp` |  | str | 0.0 |  |
| | | `esindusoiguse_eritingimused[].esinduse_tyyp_tekstina` |  | str | 0.0 |  |
| | | `esindusoiguse_eritingimused[].esinduse_sisu` |  | str | 0.0 |  |
| | | `esindusoiguse_eritingimused[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `esindusoiguse_eritingimused[].lopp_kpv` | end date | - | 100.0 |  |
| | | `hooneyhistu_liikmed[].liikmesuse_nr` |  | str | 0.0 |  |
| | | `hooneyhistu_liikmed[].pindala` |  | float | 0.0 |  |
| | | `hooneyhistu_liikmed[].maksumaara_lugeja` |  | int | 0.0 |  |
| | | `hooneyhistu_liikmed[].maksumaara_nimetaja` |  | int | 0.0 |  |
| | | `hooneyhistu_liikmed[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `hooneyhistu_liikmed[].lopp_kpv` | end date | - | 100.0 |  |
| | | `hooneyhistu_liikmed[].kitsendused[].tyyp` |  | str | 0.0 |  |
| | | `hooneyhistu_liikmed[].kitsendused[].tyyp_tekstina` |  | str | 0.0 |  |
| | | `hooneyhistu_liikmed[].kitsendused[].sisu` |  | str | 0.0 |  |
| | | `hooneyhistu_liikmed[].kitsendused[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `hooneyhistu_liikmed[].kitsendused[].lopp_kpv` | end date | - | 100.0 |  |
| RIK e-Business Register | persons not on registry card (`ettevotja_rekvisiidid__kandevalised_isikud.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kirje_id` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardivalised_isikud[].isiku_tyyp` | person type: F natural, J legal | str | 0.0 |  |
| | | `kaardivalised_isikud[].isiku_roll` | role code (JUHL board member, OSAN shareholder, ...) | str | 0.0 | officers |
| | | `kaardivalised_isikud[].isiku_roll_tekstina` | role | str | 0.0 |  |
| | | `kaardivalised_isikud[].eesnimi` | first name | str | 10.8 |  |
| | | `kaardivalised_isikud[].nimi_arinimi` | surname or company name | str | 0.0 |  |
| | | `kaardivalised_isikud[].isikukood_registrikood` | registry code when the person is a legal entity | str | 89.8 |  |
| | | `kaardivalised_isikud[].valis_kood` | foreign id code | str | 99.5 |  |
| | | `kaardivalised_isikud[].valis_kood_riik_tekstina` |  | str | 98.3 |  |
| | | `kaardivalised_isikud[].valis_kood_riik` | country of the foreign id | str | 98.3 |  |
| | | `kaardivalised_isikud[].synniaeg` | birth date | str | 96.6 |  |
| | | `kaardivalised_isikud[].aadress_riik` | country of residence | str | 7.6 |  |
| | | `kaardivalised_isikud[].aadress_riik_tekstina` |  | str | 7.6 |  |
| | | `kaardivalised_isikud[].aadress_ehak` |  | str | 83.9 |  |
| | | `kaardivalised_isikud[].aadress_ehak_tekstina` |  | str | 83.9 |  |
| | | `kaardivalised_isikud[].aadress_tanav_maja_korter` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].osaluse_protsent` | holding, % | str | 99.2 | members_shareholders |
| | | `kaardivalised_isikud[].osaluse_suurus` | holding, nominal amount | str | 15.6 |  |
| | | `kaardivalised_isikud[].osaluse_valuuta` |  | str | 14.0 |  |
| | | `kaardivalised_isikud[].osamaksu_valuuta_tekstina` |  | str | 14.0 |  |
| | | `kaardivalised_isikud[].osaluse_omandiliik` |  | str | 0.0 |  |
| | | `kaardivalised_isikud[].osaluse_omandiliik_tekstina` | ownership type | str | 15.6 |  |
| | | `kaardivalised_isikud[].osaluse_murdosa_lugeja` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].osaluse_murdosa_nimetaja` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].volituste_loppemise_kpv` | mandate end date | - | 100.0 |  |
| | | `kaardivalised_isikud[].kontrolli_allikas` |  | str | 18.9 |  |
| | | `kaardivalised_isikud[].kontrolli_allikas_tekstina` |  | str | 18.9 |  |
| | | `kaardivalised_isikud[].kontrolli_allika_kpv` |  | str | 18.8 |  |
| | | `kaardivalised_isikud[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kaardivalised_isikud[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kaardivalised_isikud[].grupp` |  | int | 100.0 |  |
| | | `kaardivalised_isikud[].aadress_ads__adr_id` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].adress_ads__ads_oid` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].aadress_ads__ads_normaliseeritud_taisaadress` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].aadress_ads__ads_normaliseeritud_taisaadress_tapsustus` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].aadress_ads__koodaadress` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].aadress_ads__adob_id` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].aadress_ads__tyyp` |  | - | 100.0 |  |
| | | `kaardivalised_isikud[].isikukood_hash` | pseudonymous person id: hash of the personal code (personal codes removed since 1 Nov 2024) | str | 2.5 | person_identifier |
| RIK e-Business Register | beneficial owners (`ettevotja_rekvisiidid__kasusaajad.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kirje_id` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kasusaajad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kasusaajad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kasusaajad[].eesnimi` | first name | str | 0.0 |  |
| | | `kasusaajad[].nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kasusaajad[].isikukood` | personal code (empty since 1 Nov 2024) | - | 100.0 |  |
| | | `kasusaajad[].valis_kood` | foreign id code | - | 100.0 |  |
| | | `kasusaajad[].valis_kood_riik` | country of the foreign id | str | 95.1 |  |
| | | `kasusaajad[].valis_kood_riik_tekstina` |  | str | 95.1 |  |
| | | `kasusaajad[].synniaeg` | birth date | str | 97.4 |  |
| | | `kasusaajad[].aadress_riik` | country of residence | str | 0.0 |  |
| | | `kasusaajad[].aadress_riik_tekstina` |  | str | 0.0 |  |
| | | `kasusaajad[].kontrolli_teostamise_viis` |  | str | 0.0 |  |
| | | `kasusaajad[].kontrolli_teostamise_viis_tekstina` | how control is exercised (BO) | str | 0.0 | beneficial_owners |
| | | `kasusaajad[].lahknevusteade_esitatud` | discrepancy notice filed (BO) | bool | 99.9 |  |
| | | `kasusaajad[].isikukood_hash` | pseudonymous person id: hash of the personal code (personal codes removed since 1 Nov 2024) | str | 2.5 | person_identifier |
| RIK e-Business Register | commercial pledges (`ettevotja_rekvisiidid__kommertspandid.json`, 4,944 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kirje_id` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_piirkond` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_tyyp` (on nested records) | registry card book-keeping | str | 0.0 | - |
| | | `kande_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kommertspandiandmed[].pandi_id` |  | int | 0.0 |  |
| | | `kommertspandiandmed[].pandi_number` |  | int | 0.0 |  |
| | | `kommertspandiandmed[].pandi_olek` | pledge state | str | 0.0 |  |
| | | `kommertspandiandmed[].olek_tekstina` |  | - | 100.0 |  |
| | | `kommertspandiandmed[].pandi_jarjekoht` |  | int | 0.0 |  |
| | | `kommertspandiandmed[].pandi_jarjekoht_tekstina` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].pandi_summa` | pledge amount | str | 0.0 | pledges_securing_measures |
| | | `kommertspandiandmed[].pandi_valuuta` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].pandi_valuuta_tekstina` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kommertspandiandmed[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kommertspandiandmed[].jarjekohad[].sisu` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].jarjekohad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kommertspandiandmed[].jarjekohad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kommertspandiandmed[].pandisummad[].summa` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].pandisummad[].valuuta` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].pandisummad[].valuuta_tekstina` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].pandisummad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kommertspandiandmed[].pandisummad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_isikuliik` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_nimi` | pledgee name | str | 0.0 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_kood` | pledgee registry code | str | 0.2 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_riik` |  | str | 75.5 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_riik_tekstina` |  | str | 75.5 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_asukoht_ehak` |  | str | 75.6 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_asukoht_ehak_tekstina` |  | str | 75.6 |  |
| | | `kommertspandiandmed[].pandipidajad[].pidaja_murdosa` |  | str | 99.6 |  |
| | | `kommertspandiandmed[].pandipidajad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kommertspandiandmed[].pandipidajad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `kommertspandiandmed[].markused[].veeru_nr` |  | int | 0.0 |  |
| | | `kommertspandiandmed[].markused[].tyyp` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].markused[].tyyp_tekstina` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].markused[].sisu` |  | str | 0.0 |  |
| | | `kommertspandiandmed[].markused[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kommertspandiandmed[].markused[].lopp_kpv` | end date | - | 100.0 |  |
| RIK e-Business Register | rulings (`ettevotja_rekvisiidid__maarused.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `maarused[].maaruse_nr` | ruling number | str | 0.0 |  |
| | | `maarused[].maaruse_kpv` | ruling date | str | 0.0 |  |
| | | `maarused[].kande_kpv` |  | str | 27.7 |  |
| | | `maarused[].lisatahtaeg` |  | str | 77.4 |  |
| | | `maarused[].maaruse_liik` |  | str | 0.0 |  |
| | | `maarused[].maaruse_liik_tekstina` | ruling type | str | 0.0 | court_or_official_notices |
| | | `maarused[].maaruse_olek` |  | str | 0.0 |  |
| | | `maarused[].maaruse_olek_tekstina` | ruling state | str | 0.0 |  |
| | | `maarused[].kandeliik` |  | str | 13.9 |  |
| | | `maarused[].kandeliik_tekstina` | entry type (first entry, amendment, deletion, ...) | str | 13.9 |  |
| | | `maarused[].joustumise_kpv` | date in force | str | 2.6 |  |
| | | `maarused[].joust_olek` |  | str | 2.6 |  |
| | | `maarused[].joust_olek_tekstina` |  | str | 2.7 |  |
| RIK e-Business Register | shareholders (OÜ members) (`ettevotja_rekvisiidid__osanikud.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kirje_id` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `osanikud[].isiku_tyyp` | person type: F natural, J legal | str | 0.0 |  |
| | | `osanikud[].isiku_roll` | role code (JUHL board member, OSAN shareholder, ...) | str | 0.0 | officers |
| | | `osanikud[].isiku_roll_tekstina` | role | str | 0.0 |  |
| | | `osanikud[].eesnimi` | first name | str | 11.6 |  |
| | | `osanikud[].nimi_arinimi` | surname or company name | str | 0.0 |  |
| | | `osanikud[].isikukood_registrikood` | registry code when the person is a legal entity | str | 89.9 |  |
| | | `osanikud[].valis_kood` | foreign id code | str | 98.5 |  |
| | | `osanikud[].valis_kood_riik_tekstina` |  | str | 96.0 |  |
| | | `osanikud[].valis_kood_riik` | country of the foreign id | str | 96.0 |  |
| | | `osanikud[].synniaeg` | birth date | str | 93.9 |  |
| | | `osanikud[].aadress_riik` | country of residence | str | 94.2 |  |
| | | `osanikud[].aadress_riik_tekstina` |  | str | 94.2 |  |
| | | `osanikud[].aadress_ehak` |  | str | 97.8 |  |
| | | `osanikud[].aadress_ehak_tekstina` |  | str | 97.8 |  |
| | | `osanikud[].aadress_tanav_maja_korter` |  | - | 100.0 |  |
| | | `osanikud[].osaluse_protsent` | holding, % | str | 0.0 | members_shareholders |
| | | `osanikud[].osaluse_suurus` | holding, nominal amount | str | 0.0 |  |
| | | `osanikud[].osaluse_valuuta` |  | str | 0.0 |  |
| | | `osanikud[].osamaksu_valuuta_tekstina` |  | str | 0.0 |  |
| | | `osanikud[].osaluse_omandiliik` |  | str | 0.0 |  |
| | | `osanikud[].osaluse_omandiliik_tekstina` | ownership type | str | 0.0 |  |
| | | `osanikud[].osaluse_murdosa_lugeja` |  | str | 100.0 |  |
| | | `osanikud[].osaluse_murdosa_nimetaja` |  | str | 100.0 |  |
| | | `osanikud[].volituste_loppemise_kpv` | mandate end date | - | 100.0 |  |
| | | `osanikud[].kontrolli_allikas` |  | str | 94.5 |  |
| | | `osanikud[].kontrolli_allikas_tekstina` |  | str | 94.5 |  |
| | | `osanikud[].kontrolli_allika_kpv` |  | str | 94.5 |  |
| | | `osanikud[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `osanikud[].lopp_kpv` | end date | - | 100.0 |  |
| | | `osanikud[].grupp` |  | int | 5.9 |  |
| | | `osanikud[].aadress_ads__adr_id` |  | - | 100.0 |  |
| | | `osanikud[].adress_ads__ads_oid` |  | - | 100.0 |  |
| | | `osanikud[].aadress_ads__ads_normaliseeritud_taisaadress` |  | - | 100.0 |  |
| | | `osanikud[].aadress_ads__ads_normaliseeritud_taisaadress_tapsustus` |  | - | 100.0 |  |
| | | `osanikud[].aadress_ads__koodaadress` |  | - | 100.0 |  |
| | | `osanikud[].aadress_ads__adob_id` |  | - | 100.0 |  |
| | | `osanikud[].aadress_ads__tyyp` |  | - | 100.0 |  |
| | | `osanikud[].isikukood_hash` | pseudonymous person id: hash of the personal code (personal codes removed since 1 Nov 2024) | str | 3.4 | person_identifier |
| | | `osapandid_tingimuslikud_voorandamised[].osapant_voi_tingimuslik_voorandamine` |  | str | 0.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_omaniku_liik` |  | str | 0.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_omaniku_isikukood_registrikood` |  | str | 54.7 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_omaniku_valis_kood` |  | str | 91.7 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_omaniku_synniaeg` |  | str | 97.8 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_omaniku_nimi` |  | str | 0.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_omaniku_eesnimi` |  | str | 53.6 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osa_suurus` |  | float | 0.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osapandi_jarjekoht` |  | int | 50.3 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osapandi_kirjeldus` |  | str | 0.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osapandi_algus_kpv` |  | str | 0.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].osapandi_lopp_kpv` |  | - | 100.0 |  |
| | | `osapandid_tingimuslikud_voorandamised[].isikukood_hash` | pseudonymous person id: hash of the personal code (personal codes removed since 1 Nov 2024) | str | 0.0 | person_identifier |
| RIK e-Business Register | registry card entries (`ettevotja_rekvisiidid__registrikaardid.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `kaardi_piirkond` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_tyyp` (on nested records) | registry card book-keeping | str | 0.0 | - |
| | | `kande_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `registrikaardid[].kanded[].kpv` |  | str | 0.0 |  |
| | | `registrikaardid[].kanded[].kandeliik` |  | str | 0.0 |  |
| | | `registrikaardid[].kanded[].kandeliik_tekstina` | entry type (first entry, amendment, deletion, ...) | str | 1.1 |  |
| RIK e-Business Register | general data JSON (`ettevotja_rekvisiidid__yldandmed.json`, 381,685 records) | | | | | |
| | | `ariregistri_kood` | registry code (8 digits) | int | 0.0 | reg_code |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `yldandmed.ettevotteregistri_nr` |  | int | 96.5 |  |
| | | `yldandmed.esmaregistreerimise_kpv` | registration date | str | 0.0 | reg_date |
| | | `yldandmed.kustutamise_kpv` | deletion date (empty: deleted entities are not in the file) | str | 100.0 | closed_date |
| | | `yldandmed.staatus` | status code | str | 0.0 | status |
| | | `yldandmed.staatus_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.piirkond` |  | int | 0.0 |  |
| | | `yldandmed.piirkond_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.piirkond_tekstina_pikk` |  | str | 0.0 |  |
| | | `yldandmed.evks_registreeritud` |  | - | 100.0 |  |
| | | `yldandmed.evks_registreeritud_kande_kpv` |  | - | 100.0 |  |
| | | `yldandmed.oiguslik_vorm` | legal form short code | str | 0.0 |  |
| | | `yldandmed.oiguslik_vorm_nr` |  | int | 0.0 |  |
| | | `yldandmed.oiguslik_vorm_tekstina` | legal form | str | 0.0 | legal_form |
| | | `yldandmed.oigusliku_vormi_alaliik` |  | str | 93.0 |  |
| | | `yldandmed.lahknevusteade_puudumisest` | no discrepancy notice on beneficial owners | bool | 32.1 |  |
| | | `yldandmed.oigusliku_vormi_alaliik_tekstina` |  | str | 93.0 |  |
| | | `yldandmed.asutatud_sissemakset_tegemata` |  | bool | 0.0 |  |
| | | `yldandmed.loobunud_vorminouetest` |  | bool | 99.1 |  |
| | | `yldandmed.on_raamatupidamiskohustuslane` | has accounting obligation | bool | 0.0 |  |
| | | `yldandmed.tegutseb` |  | str | 93.6 |  |
| | | `yldandmed.tegutseb_tekstina` | operating (yes/no) | str | 0.0 |  |
| | | `kaardi_piirkond` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `kaardi_tyyp` (on nested records) | registry card book-keeping | str | 0.0 | - |
| | | `kande_nr` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `yldandmed.staatused[].staatus` | status (current entry) | str | 0.0 |  |
| | | `yldandmed.staatused[].staatus_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.staatused[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `kirje_id` (on nested records) | registry card book-keeping | int | 0.0 | - |
| | | `yldandmed.arinimed[].sisu` | business name | str | 0.0 |  |
| | | `yldandmed.arinimed[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.arinimed[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.aadressid[].riik` |  | str | 15.2 |  |
| | | `yldandmed.aadressid[].riik_tekstina` |  | str | 15.2 |  |
| | | `yldandmed.aadressid[].ehak` | administrative unit code | str | 0.4 |  |
| | | `yldandmed.aadressid[].ehak_nimetus` |  | str | 0.4 |  |
| | | `yldandmed.aadressid[].tanav_maja_korter` | street, house, flat | str | 0.7 | address |
| | | `yldandmed.aadressid[].aadress_ads__ads_oid` |  | str | 1.4 |  |
| | | `yldandmed.aadressid[].aadress_ads__adr_id` | national address register id | int | 0.5 |  |
| | | `yldandmed.aadressid[].aadress_ads__ads_normaliseeritud_taisaadress` |  | str | 0.5 |  |
| | | `yldandmed.aadressid[].aadress_ads__ads_normaliseeritud_taisaadress_tapsustus` |  | str | 99.6 |  |
| | | `yldandmed.aadressid[].aadress_ads__koodaadress` |  | str | 0.6 |  |
| | | `yldandmed.aadressid[].aadress_ads__adob_id` |  | str | 1.4 |  |
| | | `yldandmed.aadressid[].aadress_ads__tyyp` |  | - | 100.0 |  |
| | | `yldandmed.aadressid[].postiindeks` | postcode | str | 0.2 |  |
| | | `yldandmed.aadressid[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.aadressid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.oiguslikud_vormid[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.oiguslikud_vormid[].sisu_nr` |  | int | 0.0 |  |
| | | `yldandmed.oiguslikud_vormid[].sisu_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.oiguslikud_vormid[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.oiguslikud_vormid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.kapitalid[].kapitali_suurus` | share capital | str | 0.0 |  |
| | | `yldandmed.kapitalid[].kapitali_valuuta` | capital currency | str | 0.0 |  |
| | | `yldandmed.kapitalid[].kapitali_valuuta_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.kapitalid[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.kapitalid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.majandusaastad[].maj_aasta_algus` |  | str | 0.0 |  |
| | | `yldandmed.majandusaastad[].maj_aasta_lopp` | financial year end (dd.mm) | str | 0.0 |  |
| | | `yldandmed.majandusaastad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.majandusaastad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.pohikirjad[].kinnitamise_kpv` |  | str | 44.7 |  |
| | | `yldandmed.pohikirjad[].muutmise_kpv` |  | str | 90.7 |  |
| | | `yldandmed.pohikirjad[].selgitus` |  | - | 100.0 |  |
| | | `yldandmed.pohikirjad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.pohikirjad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.pohikirjad[].sisaldab_erioigusi` |  | bool | 0.0 |  |
| | | `yldandmed.markused_kaardil[].veerg_nr` |  | int | 0.0 |  |
| | | `yldandmed.markused_kaardil[].tyyp` |  | str | 0.0 |  |
| | | `yldandmed.markused_kaardil[].tyyp_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.markused_kaardil[].sisu` | remark on the registry card (free text) | str | 0.0 |  |
| | | `yldandmed.markused_kaardil[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.markused_kaardil[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.sidevahendid[].liik` | contact type: EMAIL, TEL, MOB, WWW, ... | str | 0.0 |  |
| | | `yldandmed.sidevahendid[].liik_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.sidevahendid[].sisu` | contact value | str | 0.0 | website_or_contact |
| | | `yldandmed.sidevahendid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.teatatud_tegevusalad[].emtak_kood` | declared activity, EMTAK code | str | 0.0 | activity_code |
| | | `yldandmed.teatatud_tegevusalad[].emtak_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.teatatud_tegevusalad[].emtak_versioon` |  | int | 0.0 |  |
| | | `yldandmed.teatatud_tegevusalad[].emtak_versioon_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.teatatud_tegevusalad[].nace_kood` | declared activity, NACE code | str | 0.0 | activity_code |
| | | `yldandmed.teatatud_tegevusalad[].on_pohitegevusala` | is main activity | bool | 0.0 |  |
| | | `yldandmed.teatatud_tegevusalad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.teatatud_tegevusalad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].majandusaasta_perioodi_algus_kpv` |  | str | 0.0 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].majandusaasta_perioodi_lopp_kpv` | annual report period end | str | 0.0 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].tootajate_arv` | employees in the annual report | str | 2.4 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].ettevotja_aadress_aruandes` |  | str | 5.1 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].tegevusala_emtak_kood` | activity in the annual report (EMTAK) | str | 21.1 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].tegevusala_emtak_tekstina` |  | str | 21.1 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].tegevusala_emtak_versioon` |  | str | 21.1 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].tegevusala_emtak_versioon_tekstina` |  | - | 100.0 |  |
| | | `yldandmed.info_majandusaasta_aruannetest[].tegevusala_nace_kood` |  | str | 21.1 |  |
| | | `yldandmed.esitab_kasusaajad` | has submitted beneficial owners | bool | 0.0 |  |
| | | `yldandmed.kontaktisiku_aadressid[].riik` |  | str | 3.7 |  |
| | | `yldandmed.kontaktisiku_aadressid[].riik_tekstina` |  | str | 3.7 |  |
| | | `yldandmed.kontaktisiku_aadressid[].ehak` |  | str | 0.0 |  |
| | | `yldandmed.kontaktisiku_aadressid[].ehak_nimetus` |  | str | 0.0 |  |
| | | `yldandmed.kontaktisiku_aadressid[].tanav_maja_korter` |  | str | 0.2 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__ads_oid` |  | str | 0.3 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__adr_id` |  | int | 0.2 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__ads_normaliseeritud_taisaadress` |  | str | 0.2 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__ads_normaliseeritud_taisaadress_tapsustus` |  | str | 99.7 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__koodaadress` |  | str | 0.2 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__adob_id` |  | str | 46.0 |  |
| | | `yldandmed.kontaktisiku_aadressid[].aadress_ads__tyyp` |  | - | 100.0 |  |
| | | `yldandmed.kontaktisiku_aadressid[].postiindeks` |  | str | 0.1 |  |
| | | `yldandmed.kontaktisiku_aadressid[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.kontaktisiku_aadressid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.oigusjargsused[].tyyp` |  | str | 0.0 |  |
| | | `yldandmed.oigusjargsused[].tyyp_tekstina` | legal succession type (merger, division) | str | 0.0 |  |
| | | `yldandmed.oigusjargsused[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.oigusjargsused[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.oigusjargsused[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.oigusliku_vormi_alaliigid[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.oigusliku_vormi_alaliigid[].sisu_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.oigusliku_vormi_alaliigid[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.oigusliku_vormi_alaliigid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.seisundi_muutused[].tyyp` |  | str | 0.0 |  |
| | | `yldandmed.seisundi_muutused[].tyyp_tekstina` | state change (e.g. bankruptcy, liquidation) | str | 0.0 |  |
| | | `yldandmed.seisundi_muutused[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.seisundi_muutused[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.seisundi_muutused[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.kinnisasjad[].ehak` |  | str | 4.7 |  |
| | | `yldandmed.kinnisasjad[].ehak_nimetus` |  | str | 4.7 |  |
| | | `yldandmed.kinnisasjad[].tanav_maja` |  | str | 7.4 |  |
| | | `yldandmed.kinnisasjad[].postiindeks` |  | str | 53.0 |  |
| | | `yldandmed.kinnisasjad[].kinnisasja_nr` |  | int | 8.4 |  |
| | | `yldandmed.kinnisasjad[].kinnistusjaoskond` |  | int | 88.4 |  |
| | | `yldandmed.kinnisasjad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.kinnisasjad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__adr_id` |  | int | 25.6 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__ads_oid` |  | str | 27.1 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__ads_normaliseeritud_taisaadress` |  | str | 25.6 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__ads_normaliseeritud_taisaadress_tapsustus` |  | - | 100.0 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__koodaadress` |  | str | 25.6 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__adob_id` |  | str | 28.4 |  |
| | | `yldandmed.kinnisasjad[].aadress_ads__tyyp` |  | - | 100.0 |  |
| | | `yldandmed.eesmargid_kaardil[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.eesmargid_kaardil[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.eesmargid_kaardil[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.asutamise_ajad[].sisu` |  | str | 0.4 |  |
| | | `yldandmed.asutamise_ajad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.asutamise_ajad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.tegevusalad_kaardil[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.tegevusalad_kaardil[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.tegevusalad_kaardil[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.esmanimetamise_ajad[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.esmanimetamise_ajad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.esmanimetamise_ajad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].arinimi[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].arinimi[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].arinimi[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].asukoht[].aadress_riik` | country of residence | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].asukoht[].aadress_riik_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].asukoht[].aadress` |  | str | 0.4 |  |
| | | `yldandmed.valismaa_ariyhing[].asukoht[].postiindeks` |  | str | 70.4 |  |
| | | `yldandmed.valismaa_ariyhing[].asukoht[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].asukoht[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].oiguslik_vorm[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].oiguslik_vorm[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].oiguslik_vorm[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].maa_mille_seaduse_alusel_tegutseb[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].maa_mille_seaduse_alusel_tegutseb[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].maa_mille_seaduse_alusel_tegutseb[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].register[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].register[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].register[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].registreerimisnumber[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].registreerimisnumber[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].registreerimisnumber[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.mkr_reg_kpv[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.mkr_reg_kpv[].kehtiv_kpv` |  | str | 0.0 |  |
| | | `yldandmed.mkr_reg_kpv[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.raamatupidamiskohustused[].sisu` |  | bool | 0.0 |  |
| | | `yldandmed.raamatupidamiskohustused[].kehtiv_kpv` |  | str | 0.0 |  |
| | | `yldandmed.raamatupidamiskohustused[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].tyyp` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].tyyp_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].periood_algus_kpv` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].periood_lopp_kpv` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].periood` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].periood_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.ettevotja_tegevuse_aeg[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.ettevotja_tegevuse_aeg[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.mps_koodid[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.mps_koodid[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.mps_koodid[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oigvorm[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oigvorm[].sisu_tekstina` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oigvorm[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oigvorm[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oiguslik_vorm_markus[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oiguslik_vorm_markus[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].sarnane_eesti_oiguslik_vorm_markus[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].majandusaasta_aruande_avalikustamise_kohustus[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.valismaa_ariyhing[].majandusaasta_aruande_avalikustamise_kohustus[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].majandusaasta_aruande_avalikustamise_kohustus[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.nimivaartuseta_aktsiad[].nimivaartuseta_aktsiate_arv` |  | str | 0.0 |  |
| | | `yldandmed.nimivaartuseta_aktsiad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.nimivaartuseta_aktsiad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.ky_kinnistu_aadressid[].ads_oid` |  | str | 0.0 |  |
| | | `yldandmed.ky_kinnistu_aadressid[].adr_id` |  | int | 0.0 |  |
| | | `yldandmed.ky_kinnistu_aadressid[].ads_normaliseeritud_taisaadress` | normalised full address | str | 0.0 | address |
| | | `yldandmed.ky_kinnistu_aadressid[].ads_koodaadress` |  | str | 0.0 |  |
| | | `yldandmed.ky_kinnistu_aadressid[].laadimise_kpv` |  | str | 0.0 |  |
| | | `yldandmed.taiendavad_nimed[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.taiendavad_nimed[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.taiendavad_nimed[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valismaa_ariyhing[].maa_mille_seaduse_alusel_tegutseb_markus[].sisu` |  | str | 8.3 |  |
| | | `yldandmed.valismaa_ariyhing[].maa_mille_seaduse_alusel_tegutseb_markus[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valismaa_ariyhing[].maa_mille_seaduse_alusel_tegutseb_markus[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.tegutsemise_tahtajad[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.tegutsemise_tahtajad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.tegutsemise_tahtajad[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.valislepingud[].joustumise_kpv` | date in force | str | 0.0 |  |
| | | `yldandmed.valislepingud[].avaldamismarge` |  | str | 0.0 |  |
| | | `yldandmed.valislepingud[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.valislepingud[].lopp_kpv` | end date | - | 100.0 |  |
| | | `yldandmed.kompromissi_tahtajad[].sisu` |  | str | 0.0 |  |
| | | `yldandmed.kompromissi_tahtajad[].algus_kpv` | start date | str | 0.0 | officer_roles_dates |
| | | `yldandmed.kompromissi_tahtajad[].lopp_kpv` | end date | - | 100.0 |  |
| RIK e-Business Register | basic data CSV (`lihtandmed.csv`, 381,685 records) | | | | | |
| | | `nimi` | legal name (on person records: surname or company name) | str | 0.0 | legal_name |
| | | `ariregistri_kood` | registry code (8 digits) | str | 0.0 | reg_code |
| | | `ettevotja_oiguslik_vorm` | legal form | str | 0.0 | legal_form |
| | | `ettevotja_oigusliku_vormi_alaliik` | legal form subtype | str | 93.0 |  |
| | | `kmkr_nr` | VAT number | str | 65.3 | vat_number |
| | | `ettevotja_staatus` | status code: R registered, L in liquidation, N in bankruptcy | str | 0.0 | status |
| | | `ettevotja_staatus_tekstina` | status as text | str | 0.0 |  |
| | | `ettevotja_esmakande_kpv` | date of first entry | str | 0.0 | reg_date |
| | | `ettevotja_aadress` | address (always empty in this file) | - | 100.0 |  |
| | | `asukoht_ettevotja_aadressis` | street address | str | 7.3 |  |
| | | `asukoha_ehak_kood` | administrative unit code (EHAK) | str | 7.1 |  |
| | | `asukoha_ehak_tekstina` | administrative unit | str | 7.1 |  |
| | | `indeks_ettevotja_aadressis` | postcode | str | 6.9 |  |
| | | `ads_adr_id` | national address register id | str | 7.2 |  |
| | | `ads_ads_oid` | address object id (always empty here) | - | 100.0 |  |
| | | `ads_normaliseeritud_taisaadress` | normalised full address | str | 7.2 | address |
| | | `teabesysteemi_link` | link to the register portal page | str | 0.0 |  |
| RIK annual reports | 3. revenue by country (`myygitulu_geograafiline.csv`, 661,945 records) | | | | | |
| | | `report_id` | report id (joins the four annual-report files) | str | 0.0 |  |
| | | `Riigi nimetus` | country or region | str | 0.0 |  |
| | | `Müügitulu geograafiliste piirkondade lõikes` | revenue for that region | str | 0.0 |  |

## Cross-border

Null % is measured on the Baltic subset (GLEIF: 40,486 LT+LV+EE records; Kohesio: per country, ranges LT/LV/EE) or the whole list (sanctions: share of listings without the element). 2026-11-19.

| Source | Table/file | Field (original) | English meaning | Type | Null % | Canonical field |
|---|---|---|---|---|---|---|
| GLEIF | lei2 | LEI | Legal Entity Identifier, ISO 17442, 20 chars, mod 97-10 check digits | string(20) | 0 | lei |
| GLEIF | lei2 | Entity.LegalName | legal name as registered | string | 0 | legal_name |
| GLEIF | lei2 | Entity.RegistrationAuthority.RegistrationAuthorityID | register that holds the entity (LT RA000430, LV RA000423, EE RA000181) | code | 0 | (join metadata) |
| GLEIF | lei2 | Entity.RegistrationAuthority.RegistrationAuthorityEntityID | national register code | string | 0.7 | reg_code |
| GLEIF | lei2 | Entity.LegalJurisdiction | jurisdiction (ISO 3166) | code | 0 | (country) |
| GLEIF | lei2 | Entity.LegalForm.EntityLegalFormCode | ISO 20275 ELF legal-form code | code(4) | 0 | legal_form |
| GLEIF | lei2 | Entity.EntityCategory | GENERAL / FUND / BRANCH / SOLE_PROPRIETOR / RESIDENT_GOVERNMENT_ENTITY | enum | 0 | legal_form |
| GLEIF | lei2 | Entity.EntityStatus | ACTIVE / INACTIVE | enum | 0 | status |
| GLEIF | lei2 | Entity.EntityCreationDate | date the entity was created | date | 7.2 | reg_date |
| GLEIF | lei2 | Entity.LegalAddress.* / Entity.HeadquartersAddress.* | legal and head-office address | strings | 0 (first line, city, country) | address |
| GLEIF | lei2 | Registration.RegistrationStatus | LEI status: ISSUED / LAPSED / RETIRED / MERGED / ... | enum | 0 | lei |
| GLEIF | lei2 | Registration.LastUpdateDate | last change to the record | datetime | 0 | (as-of) |
| GLEIF | lei2 | Registration.ValidationSources | FULLY_CORROBORATED / PARTIALLY / ENTITY_SUPPLIED_ONLY | enum | 0 | (quality) |
| GLEIF | rr | Relationship.StartNode.NodeID | child LEI | string(20) | 0 | members_shareholders (group) |
| GLEIF | rr | Relationship.EndNode.NodeID | parent or manager LEI | string(20) | 0 | members_shareholders (group) |
| GLEIF | rr | Relationship.RelationshipType | IS_DIRECTLY_CONSOLIDATED_BY / IS_ULTIMATELY_CONSOLIDATED_BY / IS_FUND-MANAGED_BY / IS_SUBFUND_OF / IS_INTERNATIONAL_BRANCH_OF | enum | 0 | (group) |
| GLEIF | rr | Relationship.RelationshipStatus | ACTIVE / INACTIVE | enum | 0 | (group) |
| GLEIF | rr | Relationship.Period.n.startDate / endDate / periodType | accounting or relationship period | date | not measured | (group) |
| GLEIF | repex | Exception.Category / Exception.Reason.1 | why no parent is reported (NATURAL_PERSONS, NON_CONSOLIDATING, NO_KNOWN_PERSON, NO_LEI, NON_PUBLIC) | enum | 0 | (group) |
| EU sanctions | sanctionEntity | @logicalId | listing ID | integer | 0 | sanctions_eu |
| EU sanctions | sanctionEntity | @euReferenceNumber | EU reference number | string | not measured | sanctions_eu |
| EU sanctions | sanctionEntity | @unitedNationId | UN reference, if a UN listing | string | 98.6 | sanctions_un |
| EU sanctions | sanctionEntity | @designationDate | date listed | date | 9.1 | sanctions_eu |
| EU sanctions | subjectType | @code | person / enterprise | enum | 0 | sanctions_eu |
| EU sanctions | regulation | @programme, @publicationDate, @numberTitle, publicationUrl | legal act: regime, date, OJ number, EUR-Lex link | strings | 0 | sanctions_eu (citation) |
| EU sanctions | nameAlias | @wholeName, @firstName, @lastName, @gender, @function, @nameLanguage | names and aliases | strings | 0 | sanctions_eu |
| EU sanctions | birthdate | @birthdate / @year, @city, @countryIso2Code | birth date (full or year) and place | date / int | 37.8 (persons and entities) | person_identifier |
| EU sanctions | citizenship | @countryIso2Code | citizenship | code | 56.9 | sanctions_eu |
| EU sanctions | address | @street, @city, @zipCode, @countryIso2Code | address | strings | 67.1 | sanctions_eu |
| EU sanctions | identification | @identificationTypeCode, @number, @countryIso2Code, @knownFalse, @knownExpired | ID documents and registration numbers (regnumber, fiscalcode, taxid, passport, id, imo, swiftbic, ...) | strings | 67.9 | reg_code / person_identifier |
| EU sanctions | remark | text | free-text remarks | string | 89.0 | sanctions_eu |
| UN list | INDIVIDUAL / ENTITY | DATAID, VERSIONNUM | entry ID and version | integer | 0 | sanctions_un |
| UN list | INDIVIDUAL / ENTITY | REFERENCE_NUMBER, UN_LIST_TYPE, LISTED_ON | public reference, regime, date listed | strings | 0 | sanctions_un |
| UN list | INDIVIDUAL / ENTITY | FIRST_NAME .. FOURTH_NAME, *_ALIAS/ALIAS_NAME, QUALITY | names and aliases (alias quality good / low) | strings | not measured | sanctions_un |
| UN list | INDIVIDUAL | INDIVIDUAL_DATE_OF_BIRTH (DATE / YEAR), INDIVIDUAL_PLACE_OF_BIRTH | birth date and place | date / int | full date missing for 43.1% of individuals | person_identifier |
| UN list | INDIVIDUAL | INDIVIDUAL_DOCUMENT (TYPE_OF_DOCUMENT, NUMBER, ISSUING_COUNTRY) | passports and national IDs | strings | 59.6 of individuals | person_identifier |
| UN list | INDIVIDUAL / ENTITY | NATIONALITY, *_ADDRESS (COUNTRY, CITY, STREET) | nationality and addresses | strings | not measured | sanctions_un |
| UN list | INDIVIDUAL / ENTITY | COMMENTS1 | narrative; holds IMO and registration numbers for some entities | string | not measured | sanctions_un |
| Kohesio | beneficiaries | Beneficiary | EU Knowledge Graph URI | URI | 0 | eu_funds |
| Kohesio | beneficiaries | BeneficiaryLabel | beneficiary name | string | 0 | eu_funds |
| Kohesio | beneficiaries | Beneficiary_Local_Identifier | national register code (sometimes VAT number) | string | 1.3 / 65.3 / 1.8 | reg_code |
| Kohesio | beneficiaries | Website, WikidataID | website, Wikidata ID | string | 100 / 100 / 100 | website_or_contact |
| Kohesio | projects | Operation_Unique_Identifier | project URI | URI | 0 | eu_funds |
| Kohesio | projects | Operation_Local_Identifier | programme's own project number | string | 0 | eu_funds |
| Kohesio | projects | Operation_Name_English, Operation_Name_Programme_Language | project title (EN, local) | string | 0 | eu_funds |
| Kohesio | projects | Operation_Start_Date, Operation_End_Date | start and end (DD/MM/YYYY) | date | start 0-0.2; end 0 / 0-69.6 / 0 | eu_funds |
| Kohesio | projects | Cofinancing_Rate | EU co-financing % | decimal | 0-0.2 | eu_funds |
| Kohesio | projects | Total_Eligible_Expenditure_amount, _Currency | total eligible cost | decimal, EUR | 0 | eu_funds |
| Kohesio | projects | Project_EU_Budget | EU contribution | decimal EUR | 0-0.2 | eu_funds |
| Kohesio | projects | Beneficiary_Unique_Identifier, Beneficiary_Name | beneficiary URI and name | URI, string | 0 | eu_funds |
| Kohesio | projects | Beneficiary_Local_Identifier | beneficiary register code | string | 2014-20: 0 / 100 / 0.2; 2021-27: 0 / 37.0 / 32.1 | reg_code |
| Kohesio | projects | Category_Of_Intervention, Category_Label | intervention field code and label | code, string | 0-16.3 | eu_funds |
| Kohesio | projects | Fund_Code, Fund_Name | ERDF / ESF / CF / ... | code | 0-0.2 | eu_funds |
| Kohesio | projects | Programme_Code, Programme_Name | operational programme | code, string | 0 | eu_funds |
| Kohesio | projects | Coordinates / Location_Indicator_latitude_longitude, LAU_*, NUTS3_* | location | strings | 0-47.2 | eu_funds |
| Kohesio | projects | NUTS1_*, NUTS2_*, Postal_Code, ManagingAuthority, InfoRegio_* | empty for the Baltics in most files | strings | ~100 | (skip) |
| Kohesio | projects | Operation_Summary_English, _Programme_Language | project summary | text | 0-0.7 | eu_funds |
