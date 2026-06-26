import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const actionsSource = readFileSync(join(repoRoot, "app/admin/users/UserPatronActions.tsx"), "utf8");
const pageSource = readFileSync(join(repoRoot, "app/admin/users/[userId]/page.tsx"), "utf8");
const diagnosticsSource = readFileSync(join(repoRoot, "app/admin/users/AdminAccessDiagnostics.tsx"), "utf8");

describe("admin user patron access action UI", () => {
  it("replaces prompt-based grant/revoke with separate structured dialogs", () => {
    expect(actionsSource).not.toContain("prompt(");
    expect(actionsSource).toContain("<Dialog open={dialogAction !== null}");
    expect(actionsSource).toContain("openDialog(\"grant\")");
    expect(actionsSource).toContain("openDialog(\"revoke\")");
    expect(actionsSource).toContain("Potwierdź nadanie dostępu Patrona");
    expect(actionsSource).toContain("Potwierdź cofnięcie dostępu Patrona");
  });

  it("allows cancel without sending the PATCH request", () => {
    expect(actionsSource).toContain("type=\"button\" variant=\"outline\" disabled={isPending} onClick={() => closeDialog(false)}");
    expect(actionsSource).toContain("Anuluj bez zmian");

    const cancelButtonStart = actionsSource.indexOf("Anuluj bez zmian");
    const submitHandlerStart = actionsSource.indexOf("async function updatePatron");
    expect(cancelButtonStart).toBeGreaterThan(submitHandlerStart);
    expect(actionsSource.slice(cancelButtonStart - 200, cancelButtonStart + 80)).not.toContain("fetch(");
  });

  it("requires a non-empty reason before submitting and sends the trimmed reason with the selected action", () => {
    expect(actionsSource).toContain("const trimmedReason = reason.trim();");
    expect(actionsSource).toContain("const canSubmit = Boolean(dialogAction) && trimmedReason.length > 0 && !isPending;");
    expect(actionsSource).toContain("if (!dialogAction || !trimmedReason || pendingRequestRef.current) return;");
    expect(actionsSource).toContain("body: JSON.stringify({ action, reason: trimmedReason })");
    expect(actionsSource).toContain("disabled={!canSubmit}");
  });

  it("blocks duplicate submission while a request is pending", () => {
    expect(actionsSource).toContain("const pendingRequestRef = useRef(false);");
    expect(actionsSource).toContain("pendingRequestRef.current");
    expect(actionsSource).toContain("pendingRequestRef.current = true;");
    expect(actionsSource).toContain("pendingRequestRef.current = false;");
    expect(actionsSource).toContain("disabled={isPending}");
    expect(actionsSource).toContain("disabled={!canSubmit}");
  });

  it("makes revoke visually destructive and explains patron access loss before confirmation", () => {
    expect(actionsSource).toContain("variant={dialogAction === \"revoke\" ? \"destructive\" : \"default\"}");
    expect(actionsSource).toContain("text-destructive");
    expect(actionsSource).toContain("użytkownik straci dostęp Patrona");
    expect(actionsSource).toContain("odtwarzanie premium");
    expect(actionsSource).toContain("uprawnienia komentowania/reagowania dla patronów");
  });

  it("keeps API failure visible and retryable", () => {
    expect(actionsSource).toContain("role=\"alert\"");
    expect(actionsSource).toContain("Popraw powód albo spróbuj ponownie.");
    expect(actionsSource).toContain("toast(message, \"error\")");
    expect(actionsSource).not.toContain("setDialogAction(null);\n      toast(message");
  });
});

describe("admin user paid-but-locked diagnostics", () => {
  it("uses active PatronGrant truth instead of cache, payment or subscription truth", () => {
    expect(pageSource).toContain("const isPatronByGrantTruth = patronTruth?.isPatron === true;");
    expect(pageSource).toContain("<AdminAccessDiagnostics user={user} formatDate={formatDate} />");
    expect(diagnosticsSource).toContain("Prawda dostępu PatronGrant");
    expect(diagnosticsSource).toContain("Fakty płatności (nie prawda dostępu)");
    expect(diagnosticsSource).not.toContain("Cache User.isPatron");
    expect(diagnosticsSource).not.toContain("tylko cache");
    expect(diagnosticsSource).toContain("Newsletter/subskrypcja (niezwiązane z dostępem)");
    expect(diagnosticsSource).toContain("nie nadaje ani nie cofa dostępu Patrona");
  });

  it("shows paid-but-locked as a read-only diagnostic when payments exist without active grants", () => {
    expect(diagnosticsSource).toContain("const paidButLocked = hasPaymentFacts && activeGrantCount === 0;");
    expect(diagnosticsSource).toContain("Paid-but-locked: istnieją fakty płatności, ale nie ma aktywnego PatronGrant");
    expect(diagnosticsSource).toContain("diagnostykę supportową, nie automatyczny dostęp");
    expect(diagnosticsSource).not.toContain("fetch(");
  });
});
