import logging

from odoo import api, models

_logger = logging.getLogger(__name__)

CHANNEL_NAME = "Moja firma: terminy i alerty"
MANAGER_GROUP = "l10n_pl_jdg_ryczalt.group_jdg_manager"


class JdgNotify(models.AbstractModel):
    """Powiadomienia w Discuss: prywatny kanał „Moja firma: terminy i alerty” (tylko grupa Właściciel).

    Wiadomość zawiera wzmiankę właścicieli (partner_ids), więc Odoo wysyła powiadomienie (dzwonek, ewentualnie e-mail wg
    ustawień użytkownika), a nie tylko dopisuje wiersz w kanale. Błąd powiadomienia nigdy nie przerywa harmonogramu.
    """

    _name = "jdg.notify"
    _description = "Powiadomienia JDG (Discuss)"

    @api.model
    def _owners(self, company):
        group = self.env.ref(MANAGER_GROUP)
        root = self.env.ref("base.user_root")
        return group.sudo().user_ids.filtered(
            lambda u: u.active and not u.share and u != root and company in u.company_ids)

    @api.model
    def _channel(self, company):
        param_key = "l10n_pl_jdg_ryczalt.channel_id.%s" % company.id
        params = self.env["ir.config_parameter"].sudo()
        channel = self.env["discuss.channel"].sudo()
        stored = params.get_param(param_key)
        if stored and stored.isdigit():
            channel = channel.browse(int(stored)).exists()
        else:
            channel = channel.browse()
        if not channel:
            channel = self.env["discuss.channel"].sudo().create({
                "name": CHANNEL_NAME, "channel_type": "channel", "group_public_id": self.env.ref(MANAGER_GROUP).id,
                "description": "Terminy ZUS, zaliczek i PIT-28 oraz alerty progów (moduł Firma: JDG na ryczałcie).",
            })
            params.set_param(param_key, str(channel.id))
        owners = self._owners(company)
        if owners:
            channel._add_members(users=owners, post_joined_message=False)
        return channel

    @api.model
    def post(self, text, company=None):
        """Wysyła wiadomość do właścicieli. Zwraca True, gdy się udało."""
        company = company or self.env.company
        try:
            with self.env.cr.savepoint():
                channel = self._channel(company)
                partners = self._owners(company).partner_id
                channel.sudo().message_post(
                    body=text, author_id=self.env.ref("base.partner_root").id, message_type="comment",
                    subtype_xmlid="mail.mt_comment", partner_ids=partners.ids)
            return True
        except Exception:  # noqa: BLE001 - powiadomienie nie może zatrzymać obliczeń ani crona
            _logger.exception("jdg: nie udało się wysłać powiadomienia do Discuss")
            return False
