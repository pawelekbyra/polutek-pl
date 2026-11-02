"""Hook po instalacji: aktywuje waluty, które moduł potrzebuje (PLN, EUR, USD, GBP, CHF) i język polski."""


def post_init_hook(env):
    codes = ["PLN", "EUR", "USD", "GBP", "CHF"]
    env["res.currency"].with_context(active_test=False).search([("name", "in", codes)]).write({"active": True})
    lang = env["res.lang"].with_context(active_test=False).search([("code", "=", "pl_PL")], limit=1)
    if lang and not lang.active:
        env["res.lang"]._activate_lang("pl_PL")
