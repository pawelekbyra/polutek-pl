export function formatDate(value: string | Date | null) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
