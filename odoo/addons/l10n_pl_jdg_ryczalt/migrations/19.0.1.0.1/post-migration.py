"""19.0.1.0.1: stawki ryczałtu (8,5% / 15%) z pewnością [PR] i opisem ryzyka 15% oraz interpretacji KIS.

Dane reguł mają noupdate=1 (żeby nie nadpisywać Twoich edycji), więc zmianę opisów istniejących rekordów robi migracja:
bierze wartości z pliku XML i zapisuje je tylko w polach opisowych (nie dotyka wartości liczbowych ani weryfikacji)."""

from lxml import etree

from odoo import SUPERUSER_ID, api
from odoo.tools import file_path

XML_IDS = ["rule_rate_vod_85_v1", "rule_rate_vod_12_v1", "rule_rate_vod_15_v1", "rule_donation_limit_v1", "rule_donation_window_v1"]
FIELDS = ["confidence", "source_note", "label", "description"]


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    tree = etree.parse(file_path("l10n_pl_jdg_ryczalt/data/jdg_tax_rules_2026.xml"))
    for xml_id in XML_IDS:
        record = tree.xpath("//record[@id='%s']" % xml_id)
        rule = env.ref("l10n_pl_jdg_ryczalt.%s" % xml_id, raise_if_not_found=False)
        if not record or not rule:
            continue
        vals = {}
        for name in FIELDS:
            node = record[0].xpath("field[@name='%s']" % name)
            if node is not None and len(node):
                vals[name] = node[0].text
        if rule.verified_on:  # zweryfikowanej przez właściciela nie ruszamy
            vals = {k: v for k, v in vals.items() if k in ("description",)}
        rule.with_context(jdg_force_rule_edit=True).write(vals)
