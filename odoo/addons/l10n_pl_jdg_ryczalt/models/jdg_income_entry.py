from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

from . import engine

KINDS = [
    ("sale", "Sprzedaż"),
    ("refund", "Zwrot"),
    ("dispute_lost", "Przegrany spór (chargeback)"),
    ("adjustment", "Korekta ręczna"),
    ("donation", "Darowizna / napiwek (poza przychodem)"),
]
# Rodzaje wpisów, które wchodzą do przychodu (iteracja 5 doda informacyjne: fee, payout).
TAXABLE_KINDS = ("sale", "refund", "dispute_lost", "adjustment")
# Darowizny (napiwki bez świadczenia zwrotnego): osobna kategoria, domyślnie POZA przychodem ryczałtowym.
# Przełącznik w profilu "Traktuj napiwki jako przychód" dolicza je do przychodu (CalcContext.taxable_kinds).
DONATION_KIND = "donation"

# Po zaksięgowaniu wolno zmienić wyłącznie te pola (notatki). Reszta: tylko wpis korygujący.
MUTABLE_AFTER_POST = {"note", "country_code", "buyer_type"}

GUARD_SQL = """
CREATE OR REPLACE FUNCTION jdg_income_entry_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.state = 'posted' AND NOT OLD.is_test THEN
            RAISE EXCEPTION 'jdg: zaksiegowany wpis przychodu (id=%) nie moze byc usuniety. Dodaj wpis korygujacy.', OLD.id;
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.state = 'posted' AND (
        NEW.state IS DISTINCT FROM OLD.state OR NEW.company_id IS DISTINCT FROM OLD.company_id
        OR NEW.seq_no IS DISTINCT FROM OLD.seq_no OR NEW.entry_year IS DISTINCT FROM OLD.entry_year
        OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.income_date IS DISTINCT FROM OLD.income_date
        OR NEW.doc_ref IS DISTINCT FROM OLD.doc_ref OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.currency_id IS DISTINCT FROM OLD.currency_id OR NEW.amount IS DISTINCT FROM OLD.amount
        OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate OR NEW.fx_rate_id IS DISTINCT FROM OLD.fx_rate_id
        OR NEW.pln_amount IS DISTINCT FROM OLD.pln_amount OR NEW.tax_base_pln IS DISTINCT FROM OLD.tax_base_pln
        OR NEW.rate_pct IS DISTINCT FROM OLD.rate_pct OR NEW.is_test IS DISTINCT FROM OLD.is_test
        OR NEW.external_ref IS DISTINCT FROM OLD.external_ref OR NEW.income_category IS DISTINCT FROM OLD.income_category
        OR NEW.donor_key IS DISTINCT FROM OLD.donor_key OR NEW.reverses_id IS DISTINCT FROM OLD.reverses_id OR NEW.fee_pln IS DISTINCT FROM OLD.fee_pln
    ) THEN
        RAISE EXCEPTION 'jdg: zaksiegowany wpis przychodu (id=%) jest niezmienny (append-only). Dodaj wpis korygujacy.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS jdg_income_entry_guard ON jdg_income_entry;
CREATE TRIGGER jdg_income_entry_guard BEFORE UPDATE OR DELETE ON jdg_income_entry
    FOR EACH ROW EXECUTE FUNCTION jdg_income_entry_guard();
"""


class JdgIncomeEntry(models.Model):
    """Ewidencja przychodów ryczałtowych: tylko dopisywana (SPEC 2.4).

    Wpis powstaje jako roboczy (`draft`, można poprawiać i usuwać), a akcją 'Zaksięguj' dostaje numer kolejny
    i staje się niezmienny: ORM blokuje zmianę i usunięcie, a trigger w bazie blokuje je także z poziomu SQL.
    Pomyłkę poprawia się wpisem korygującym (ujemnym). Wpisy testowe (`is_test`) są wyłączone z KAŻDEGO
    obliczenia podatkowego i można je usuwać (do czyszczenia danych demo).
    """

    _name = "jdg.income.entry"
    _description = "Wpis ewidencji przychodów"
    _order = "income_date desc, id desc"

    _seq_uniq = models.UniqueIndex(
        "(company_id, entry_year, seq_no) WHERE seq_no IS NOT NULL",
        "Numer kolejny w roku musi być unikalny.")
    _external_ref_uniq = models.UniqueIndex(
        "(company_id, external_ref) WHERE external_ref IS NOT NULL",
        "Ten zapis już istnieje (duplikat zewnętrznego identyfikatora).")
    _sign_check = models.Constraint(
        "CHECK((kind IN ('refund', 'dispute_lost') AND amount <= 0) OR (kind = 'sale' AND amount >= 0) "
        "OR (kind = 'donation' AND amount >= 0) OR kind = 'adjustment')",
        "Znak kwoty nie pasuje do rodzaju wpisu: sprzedaż i darowizna są dodatnie, zwrot i spór ujemne.")
    _company_date_idx = models.Index("(company_id, is_test, state, income_date)")

    name = fields.Char("Numer", compute="_compute_name")
    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company,
                                 index=True)
    state = fields.Selection([("draft", "Roboczy"), ("posted", "Zaksięgowany")], string="Stan",
                             default="draft", required=True, index=True, copy=False)
    seq_no = fields.Integer("Nr kolejny w roku", copy=False, readonly=True)
    entry_year = fields.Integer("Rok ewidencji", copy=False, readonly=True)
    posted_on = fields.Datetime("Zaksięgowano", copy=False, readonly=True)
    posted_by = fields.Many2one("res.users", "Zaksięgował", copy=False, readonly=True)

    kind = fields.Selection(KINDS, "Rodzaj", required=True, default="sale")
    income_date = fields.Date(
        "Data uzyskania przychodu", required=True, default=fields.Date.context_today, index=True,
        help="Dla płatności online: dzień zapłaty przez klienta (strefa Europe/Warsaw). To ta data wyznacza "
             "miesiąc, kwartał i kurs NBP.")
    doc_ref = fields.Char("Numer dowodu", help="Numer faktury albo identyfikator płatności (np. stripe:pi_...).")
    description = fields.Char("Opis zdarzenia", help="Np. 'Dostęp 30 dni', 'Napiwek'.")
    income_category = fields.Selection([
        ("vod", "Dostęp do wideo (VOD)"),
        ("tips", "Napiwki i wsparcie"),
        ("other", "Inne"),
    ], "Kategoria", default="vod", required=True)

    pln_currency_id = fields.Many2one("res.currency", compute="_compute_pln_currency")
    currency_id = fields.Many2one("res.currency", "Waluta", required=True,
                                  default=lambda self: self.env.ref("base.PLN"),
                                  domain="[('name', 'in', ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK'])]",
                                  help="Waluta, w której klient zapłacił. Przychód zapisujemy w walucie oryginalnej "
                                       "i przeliczamy na złote.")
    amount = fields.Monetary("Kwota brutto", currency_field="currency_id", required=True,
                             help="Kwota zapłacona przez klienta (brutto, w walucie oryginalnej). Opłaty Stripe jej nie zmniejszają.")
    fx_source = fields.Selection([
        ("pln", "złote (kurs 1)"),
        ("nbp", "tabela NBP z bazy kursów"),
        ("manual", "wpisany ręcznie"),
        ("missing", "brak kursu"),
    ], string="Źródło kursu", default="pln", readonly=True)
    fx_rate_id = fields.Many2one("jdg.fx.rate", "Tabela NBP", ondelete="restrict", readonly=True)
    fx_table_no = fields.Char("Numer tabeli NBP", help="Opcjonalnie, przy kursie wpisanym ręcznie.")
    fx_rate = fields.Float("Kurs (zł za 1 jednostkę)", digits=(12, 6), default=1.0,
                           help="Kurs średni NBP, tabela A, z ostatniego dnia roboczego PRZED dniem przychodu. "
                                "Podpowiada się z tabeli kursów; możesz wpisać ręcznie.")
    pln_amount = fields.Monetary("Kwota w PLN", currency_field="pln_currency_id", readonly=True,
                                 help="Kwota × kurs, zaokrąglona do grosza (liczone dla każdego wpisu osobno).")
    tax_base_pln = fields.Monetary("Przychód do ryczałtu (PLN)", currency_field="pln_currency_id", readonly=True,
                                   help="Kwota, od której liczy się ryczałt. Dla wpisów podatkowych = kwota w PLN.")
    rate_pct = fields.Float("Stawka ryczałtu (%)", digits=(5, 2), required=True,
                            default=lambda self: self._default_rate_pct(),
                            help="Stawka zamrożona w chwili wpisu (z ustawień firmy i tabeli reguł).")
    fee_amount = fields.Monetary("Opłata Stripe (informacyjnie)", currency_field="currency_id",
                                 help="Tylko informacyjnie: na ryczałcie opłat nie odliczamy od przychodu. "
                                      "Służy do wyliczenia, ile realnie wpłynęło.")
    fee_pln = fields.Monetary("Opłata w PLN", currency_field="pln_currency_id", readonly=True)

    is_test = fields.Boolean("Wpis testowy", default=False, index=True,
                             help="Wpisy testowe NIE wchodzą do żadnych obliczeń podatkowych ani eksportów.")
    source = fields.Selection([("manual", "Ręcznie"), ("stripe", "Stripe"), ("import", "Import")],
                              string="Pochodzenie", default="manual", required=True)
    external_ref = fields.Char("Identyfikator zewnętrzny", copy=False,
                               help="Klucz idempotencji integracji (np. stripe:pi_...:sale). Unikalny.")
    buyer_type = fields.Selection([("b2c", "Konsument (B2C)"), ("b2b", "Firma (B2B)")], "Nabywca", default="b2c")
    donor_key = fields.Char(
        "Klucz darczyńcy (pseudonim)", index=True, copy=False,
        help="Nieodwracalny pseudonim darczyńcy (HMAC liczony po stronie aplikacji, bez danych osobowych, RODO). "
             "Służy do sumowania darowizn od jednej osoby w oknie kilku lat wobec limitu z tabeli reguł.")
    country_code = fields.Char("Kraj klienta (ISO)", size=2)
    reverses_id = fields.Many2one("jdg.income.entry", "Koryguje wpis", copy=False, readonly=True, ondelete="restrict")
    note = fields.Text("Uwagi")

    # ----- pola pomocnicze UI -----
    is_foreign = fields.Boolean(compute="_compute_is_foreign")
    fx_info = fields.Char("Kurs NBP (tabela, data)", compute="_compute_fx_info")

    @api.model
    def _default_rate_pct(self):
        profile = self.env["jdg.profile"]._get()
        try:
            rule = self.env["jdg.tax.rule"]._lookup(profile.ryczalt_rate_key, fields.Date.context_today(self), self.env.company)
        except UserError:
            return 8.5
        return rule.value_num

    # ------------------------------------------------------------------ obliczenia

    @api.depends("seq_no", "entry_year", "state")
    def _compute_name(self):
        for entry in self:
            entry.name = "WP/%s/%04d" % (entry.entry_year, entry.seq_no) if entry.state == "posted" else "Wpis roboczy"

    @api.depends("name", "description", "amount", "currency_id")
    def _compute_display_name(self):
        for entry in self:
            entry.display_name = "%s %s" % (entry.name or "", entry.description or "").strip()

    def _compute_pln_currency(self):
        pln = self.env.ref("base.PLN")
        for entry in self:
            entry.pln_currency_id = pln

    @api.depends("currency_id")
    def _compute_is_foreign(self):
        for entry in self:
            entry.is_foreign = bool(entry.currency_id) and entry.currency_id.name != "PLN"

    @api.depends("fx_source", "fx_rate", "fx_rate_id", "fx_table_no", "currency_id")
    def _compute_fx_info(self):
        for entry in self:
            if entry.fx_source == "pln" or not entry.currency_id or entry.currency_id.name == "PLN":
                entry.fx_info = "PLN"
            elif entry.fx_source == "missing":
                entry.fx_info = "brak kursu: wpisz go albo dodaj tabelę NBP"
            else:
                table = entry.fx_rate_id and "%s z %s" % (entry.fx_rate_id.table_no or "tabela A", entry.fx_rate_id.rate_date) \
                    or entry.fx_table_no or "kurs ręczny"
                entry.fx_info = "%s: %.4f zł (%s)" % (entry.currency_id.name, entry.fx_rate, table)

    @api.model
    def _money_values(self, currency, income_date, amount, fee_amount=0.0, manual_rate=None, table_no=False):
        """Wylicza kurs i kwoty PLN dla wpisu. Jedno miejsce, wspólne dla create/write/onchange.

        manual_rate > 0: kurs wpisany ręcznie. Inaczej, dla waluty obcej, szukamy tabeli A w jdg.fx.rate
        (ostatnia przed dniem przychodu); brak = fx_source 'missing' (wpisu nie da się zaksięgować).
        """
        pln = self.env.ref("base.PLN")
        vals = {"fx_rate_id": False, "fx_table_no": table_no or False}
        fx = self.env["jdg.fx.rate"]
        if currency and currency != pln and income_date:
            fx = fx._rate_for(currency, income_date)
        if not currency or currency == pln:
            vals.update(fx_rate=1.0, fx_source="pln", fx_table_no=False)
            rate = engine.dec(1)
        elif manual_rate and manual_rate > 0 and not (fx and abs(fx.mid - manual_rate) < 1e-9):
            vals.update(fx_rate=manual_rate, fx_source="manual")
            rate = engine.dec(manual_rate)
        elif fx:
            vals.update(fx_rate=fx.mid, fx_source="nbp", fx_rate_id=fx.id, fx_table_no=fx.table_no)
            rate = engine.dec(fx.mid)
        else:
            vals.update(fx_rate=0.0, fx_source="missing")
            rate = engine.ZERO
        pln_amount = engine.jdg_round(engine.dec(amount) * rate)
        vals.update(
            pln_amount=float(pln_amount),
            tax_base_pln=float(pln_amount),
            fee_pln=float(engine.jdg_round(engine.dec(fee_amount) * rate)),
        )
        return vals

    @api.onchange("currency_id", "income_date")
    def _onchange_currency_date(self):
        for entry in self:
            entry.update(self._money_values(entry.currency_id, entry.income_date, entry.amount, entry.fee_amount))

    @api.onchange("amount", "fee_amount")
    def _onchange_amounts(self):
        for entry in self:
            manual = entry.fx_rate if entry.fx_source == "manual" else None
            entry.update(self._money_values(
                entry.currency_id, entry.income_date, entry.amount, entry.fee_amount, manual, entry.fx_table_no))

    @api.onchange("fx_rate")
    def _onchange_fx_rate(self):
        for entry in self:
            if entry.currency_id and entry.currency_id.name != "PLN":
                entry.update(self._money_values(
                    entry.currency_id, entry.income_date, entry.amount, entry.fee_amount, entry.fx_rate, entry.fx_table_no))

    @api.onchange("kind")
    def _onchange_kind_sign(self):
        for entry in self:
            if entry.kind == "donation":
                entry.income_category = "tips"
        for entry in self:
            if entry.kind in ("refund", "dispute_lost") and entry.amount > 0:
                entry.amount = -entry.amount
            elif entry.kind == "sale" and entry.amount < 0:
                entry.amount = -entry.amount

    # ------------------------------------------------------------------ create / write / unlink

    @api.model_create_multi
    def create(self, vals_list):
        pln = self.env.ref("base.PLN")
        for vals in vals_list:
            if vals.get("state") == "posted":
                raise UserError("Wpis tworzymy jako roboczy, a potem go księgujemy (akcja 'Zaksięguj').")
            currency = self.env["res.currency"].browse(vals["currency_id"]) if vals.get("currency_id") else pln
            income_date = fields.Date.to_date(vals.get("income_date")) or fields.Date.context_today(self)
            manual = vals.get("fx_rate") if (vals.get("fx_rate") and currency != pln and not vals.get("fx_rate_id")) else None
            vals.update(self._money_values(
                currency, income_date, vals.get("amount", 0.0), vals.get("fee_amount", 0.0), manual, vals.get("fx_table_no")))
            vals.setdefault("currency_id", currency.id)
            if vals.get("rate_pct") in (None, False):
                vals["rate_pct"] = self._default_rate_pct()
        return super().create(vals_list)

    _MONEY_TRIGGERS = {"currency_id", "income_date", "amount", "fee_amount", "fx_rate", "fx_table_no"}

    def write(self, vals):
        posted = self.filtered(lambda e: e.state == "posted")
        if posted and not self.env.context.get("jdg_posting"):
            blocked = set(vals) - MUTABLE_AFTER_POST - {"write_uid", "write_date"}
            if blocked:
                raise UserError(
                    "Zaksięgowany wpis jest niezmienny (zapisany na stałe). Błąd? Dodaj wpis korygujący. "
                    "Pola, których dotyczy próba zmiany: %s." % ", ".join(sorted(blocked)))
        res = super().write(vals)
        if self._MONEY_TRIGGERS & set(vals) and not self.env.context.get("jdg_posting"):
            for entry in self.filtered(lambda e: e.state == "draft"):
                if "fx_rate" in vals and entry.currency_id.name != "PLN" and vals["fx_rate"] and "currency_id" not in vals \
                        and "income_date" not in vals:
                    manual = vals["fx_rate"]
                else:
                    manual = None
                new = self._money_values(entry.currency_id, entry.income_date, entry.amount, entry.fee_amount, manual,
                                         entry.fx_table_no)
                super(JdgIncomeEntry, entry).write(new)
        return res

    def unlink(self):
        for entry in self:
            if entry.state == "posted" and not entry.is_test:
                raise UserError(
                    "Zaksięgowanego wpisu nie można usunąć (ewidencja jest dopisywana). Dodaj wpis korygujący.")
        if any(e.state == "posted" for e in self) and not self.env.user.has_group("l10n_pl_jdg_ryczalt.group_jdg_manager"):
            raise UserError("Usuwać testowe wpisy zaksięgowane może tylko właściciel (grupa 'Firma: właściciel').")
        return super().unlink()

    # ------------------------------------------------------------------ walidacje

    @api.constrains("currency_id", "amount", "fx_rate")
    def _check_fx(self):
        for entry in self:
            if entry.state == "posted" and entry.currency_id.name != "PLN" and entry.fx_rate <= 0:
                raise ValidationError("Wpis w walucie obcej wymaga kursu.")

    # ------------------------------------------------------------------ akcje

    def action_post(self):
        """Księguje wpis: sprawdza dane, nadaje numer kolejny w roku i blokuje edycję."""
        for entry in self.sorted("id"):
            if entry.state == "posted":
                continue
            profile = self.env["jdg.profile"]._get(entry.company_id)
            if not entry.amount:
                raise UserError("Kwota wpisu nie może być zerowa.")
            if entry.currency_id.name != "PLN" and entry.fx_rate <= 0:
                raise UserError(
                    "Brak kursu NBP dla %s na dzień %s. Dodaj tabelę kursów (Firma > Kursy NBP) albo wpisz kurs "
                    "ręcznie, a potem zaksięguj ponownie." % (entry.currency_id.name, entry.income_date))
            if not entry.is_test and entry.income_date < profile.start_date:
                raise UserError(
                    "Data przychodu (%s) jest wcześniejsza niż start działalności (%s). Zmień datę startu w "
                    "ustawieniach firmy albo oznacz wpis jako testowy." % (entry.income_date, profile.start_date))
            year = entry.income_date.year
            self.env.flush_all()
            # blokada wiersza profilu: numeracja bez luk i bez dubli przy równoległych księgowaniach
            self.env.cr.execute("SELECT id FROM jdg_profile WHERE company_id = %s FOR UPDATE", (entry.company_id.id,))
            self.env.cr.execute(
                "SELECT COALESCE(MAX(seq_no), 0) + 1 FROM jdg_income_entry WHERE company_id = %s AND entry_year = %s",
                (entry.company_id.id, year))
            seq_no = self.env.cr.fetchone()[0]
            entry.with_context(jdg_posting=True).write({
                "state": "posted", "seq_no": seq_no, "entry_year": year,
                "posted_on": fields.Datetime.now(), "posted_by": self.env.user.id,
            })
        return True

    def action_open_correction(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": "Korekta lub zwrot",
            "res_model": "jdg.income.correct.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {"default_entry_id": self.id},
        }

    def init(self):
        """Trigger w bazie: druga linia obrony append-only (patrz GUARD_SQL). Wykonywany przy każdej aktualizacji modułu."""
        self.env.cr.execute(GUARD_SQL)
