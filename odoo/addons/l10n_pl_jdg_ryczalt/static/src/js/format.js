/** Formatowanie liczb i dat po polsku: 1 234,56 zł (spacja jako separator tysięcy, przecinek dziesiętny). */

const NBSP = " ";

export function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "—";
    }
    const fixed = Math.abs(value).toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    const sign = value < 0 && Number(fixed) !== 0 ? "−" : "";
    return sign + grouped + (decPart ? "," + decPart : "");
}

export function formatMoney(value, decimals = 2) {
    if (value === null || value === undefined) {
        return "—";
    }
    return formatNumber(value, decimals) + NBSP + "zł";
}

/** Kwota bez groszy, gdy jest całkowita (np. 3 480 zł), inaczej z groszami. */
export function formatMoneyAuto(value) {
    if (value === null || value === undefined) {
        return "—";
    }
    return formatMoney(value, Math.abs(value - Math.round(value)) < 0.005 ? 0 : 2);
}

export function formatPct(value, decimals = 1) {
    if (value === null || value === undefined) {
        return "—";
    }
    return formatNumber(value, decimals) + NBSP + "%";
}

export function daysText(days) {
    if (days === 0) {
        return "dziś";
    }
    if (days === 1) {
        return "jutro";
    }
    return "za " + days + " dni";
}
