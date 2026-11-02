import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { formatMoney, formatNumber, formatPct } from "./format";

/**
 * Ekran "Podatki i składki": rozliczenie okresu krok po kroku (przychód, odliczenia, podstawa, podatek, zaliczka),
 * karty: składka zdrowotna, ZUS, stawka ryczałtu. Dane: `jdg.dashboard.get_taxes`.
 * Wszystko to SZACUNEK, NIE PORADA PODATKOWA.
 */
export class JdgTaxes extends Component {
    static template = "l10n_pl_jdg_ryczalt.Taxes";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({ loading: true, error: null, data: null, period: "", onDate: "", includeTest: false, openWhy: {} });
        this.fmt = { money: formatMoney, num: formatNumber, pct: formatPct };
        onWillStart(() => this.load());
    }

    async load() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("jdg.dashboard", "get_taxes", [], {
                period_start: this.state.period || false,
                include_test: this.state.includeTest,
                on_date: this.state.onDate || false,
            });
            if (data.error) {
                this.state.error = data.error;
                this.state.data = null;
            } else {
                this.state.error = null;
                this.state.data = data;
                this.state.period = data.period;
                if (!this.state.onDate) {
                    this.state.onDate = data.meta.date;
                }
            }
        } catch (e) {
            this.state.error = "Nie udało się pobrać danych. Spróbuj ponownie.";
        } finally {
            this.state.loading = false;
        }
    }

    onPeriodChange(ev) {
        this.state.period = ev.target.value;
        this.load();
    }

    onDateChange(ev) {
        this.state.onDate = ev.target.value;
        this.state.period = "";
        this.load();
    }

    onToggleTest(ev) {
        this.state.includeTest = ev.target.checked;
        this.load();
    }

    toggleWhy(key) {
        this.state.openWhy[key] = !this.state.openWhy[key];
    }

    addPayment() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Zapłaciłem",
            res_model: "jdg.contribution.payment",
            views: [[false, "form"]],
            target: "current",
        });
    }

    openRules() {
        this.action.doAction("l10n_pl_jdg_ryczalt.action_jdg_tax_rule");
    }
}

registry.category("actions").add("jdg_taxes", JdgTaxes);
