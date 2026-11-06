import { Component, onMounted, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { daysText, formatMoney, formatMoneyAuto, formatNumber, formatPct } from "./format";

/**
 * Pulpit "Dzisiaj zarobiłem".
 * Wszystkie liczby przychodzą z jednej metody `jdg.dashboard.get_data` (Python), tu tylko je pokazujemy.
 * Wszystko to SZACUNEK, NIE PORADA PODATKOWA.
 */
export class JdgDashboard extends Component {
    static template = "l10n_pl_jdg_ryczalt.Dashboard";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({
            loading: true,
            error: null,
            data: null,
            onDate: "",
            includeTest: false,
            openWhy: {},
            showTable: false,
        });
        this.fmt = { num: formatNumber, money: formatMoney, auto: formatMoneyAuto, pct: formatPct, days: daysText };
        onWillStart(() => this.load());
        onMounted(() => {
            this.timer = setInterval(() => this.load(true), 60000);
        });
        onWillUnmount(() => clearInterval(this.timer));
    }

    async load(silent = false) {
        if (!silent) {
            this.state.loading = true;
        }
        try {
            const data = await this.orm.call("jdg.dashboard", "get_data", [], {
                on_date: this.state.onDate || false,
                include_test: this.state.includeTest,
            });
            if (data.error) {
                this.state.error = data.error;
                this.state.data = null;
            } else {
                this.state.error = null;
                this.state.data = data;
                if (!this.state.onDate) {
                    this.state.onDate = data.meta.date;
                }
            }
        } catch (e) {
            if (!silent) {
                this.state.error = "Nie udało się pobrać danych. Spróbuj ponownie.";
            }
        } finally {
            this.state.loading = false;
        }
    }

    onDateChange(ev) {
        this.state.onDate = ev.target.value;
        this.load();
    }

    onToggleTest(ev) {
        this.state.includeTest = ev.target.checked;
        this.load();
    }

    resetDate() {
        this.state.onDate = "";
        this.load();
    }

    toggleWhy(key) {
        this.state.openWhy[key] = !this.state.openWhy[key];
    }

    addEntry() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Nowy przychód",
            res_model: "jdg.income.entry",
            views: [[false, "form"]],
            target: "current",
        });
    }

    openEntries() {
        this.action.doAction("l10n_pl_jdg_ryczalt.action_jdg_income_entry");
    }

    openRules() {
        this.action.doAction("l10n_pl_jdg_ryczalt.action_jdg_tax_rule");
    }

    openTaxes() {
        this.action.doAction("l10n_pl_jdg_ryczalt.action_jdg_taxes");
    }

    /** Segmenty paska "ile mi zostaje" w procentach przychodu miesiąca. */
    get barSegments() {
        const free = this.state.data.free;
        const total = free.bar.reduce((sum, r) => sum + Math.max(0, r.amount), 0);
        if (!total) {
            return [];
        }
        return free.bar.map((r) => ({
            key: r.key,
            tone: r.tone,
            label: r.key === "free" ? "Wolne " + formatMoneyAuto(r.amount) : this.shortLabel(r.key),
            width: (Math.max(0, r.amount) / total) * 100,
            title: r.label + ": " + formatMoney(r.amount),
        }));
    }

    shortLabel(key) {
        return { pit: "PIT", health: "Zdrow.", zus: "ZUS", fp: "FP", reserve: "Rez.", fees: "Stripe" }[key] || key;
    }

    /** Słupki dzienne (SVG). */
    get bars() {
        const chart = this.state.data.chart;
        const n = chart.days.length;
        const width = 600;
        const height = 140;
        const gap = 4;
        const barWidth = (width - gap * (n + 1)) / n;
        const max = chart.max || 1;
        return chart.days.map((d, i) => {
            const h = d.revenue > 0 ? Math.max(3, (d.revenue / max) * (height - 22)) : 0;
            const today = d.date === this.state.data.meta.date;
            return {
                x: gap + i * (barWidth + gap),
                y: height - 16 - h,
                w: barWidth,
                h,
                today,
                future: d.future,
                day: d.day,
                showDay: n <= 16 || d.day % 2 === 1,
                title: d.day + ". " + formatMoney(d.revenue),
                revenue: d.revenue,
            };
        });
    }

    get hasAnyRevenue() {
        const d = this.state.data;
        return d.year.revenue !== 0 || d.month.revenue !== 0 || d.today.revenue !== 0;
    }

    get changeText() {
        const m = this.state.data.month;
        if (m.change_pct === null || m.change_pct === undefined) {
            return "Brak danych z poprzedniego miesiąca do porównania";
        }
        const sign = m.change_pct > 0 ? "+" : "";
        return sign + formatPct(m.change_pct) + " wobec poprzedniego miesiąca (do tego samego dnia)";
    }
}

registry.category("actions").add("jdg_dashboard", JdgDashboard);
