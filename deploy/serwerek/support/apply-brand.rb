# PP Support: ustawia wartosci marki w konfiguracji instalacji (tabela installation_configs).
# Uruchamiane przez apply-brand.sh (rails runner). Idempotentne. Nie dotyka planu/licencji (INSTALLATION_PRICING_PLAN itd.).
require 'json'

cfg = JSON.parse(ENV.fetch('PP_BRAND_JSON'))
name = cfg.fetch('name')

values = {
  'INSTALLATION_NAME' => name,
  'BRAND_NAME' => name,
  'BRAND_URL' => cfg.fetch('url'),
  'WIDGET_BRAND_URL' => cfg.fetch('url'),
  'TERMS_URL' => cfg.fetch('termsUrl'),
  'PRIVACY_URL' => cfg.fetch('privacyUrl'),
  # ?v= omija cache przegladarki po zmianie pliku logo (podbij wartosc po zmianie assets)
  'LOGO' => '/brand-assets/logo.svg?v=pp1',
  'LOGO_DARK' => '/brand-assets/logo_dark.svg?v=pp1',
  'LOGO_THUMBNAIL' => '/brand-assets/logo_thumbnail.svg?v=pp1',
  # false: panel nie dokleja domyslnych ikon/opisu/manifestu producenta; ikony i manifest dodaje warstwa Cloudflare (workers/support-brand)
  'DISPLAY_MANIFEST' => false,
  # wbudowany widget wsparcia producenta (konsola super-admina): puste = nie ladowac
  'CHATWOOT_SUPPORT_WEBSITE_TOKEN' => '',
  'CHATWOOT_SUPPORT_SCRIPT_URL' => '',
  'CHATWOOT_SUPPORT_IDENTIFIER_HASH' => ''
}

values.each do |key, value|
  config = InstallationConfig.find_or_initialize_by(name: key)
  config.value = value
  config.save!
  puts "#{key} = #{value.inspect}"
end

if (account_name = ENV['PP_ACCOUNT_NAME']).to_s != '' && (account = Account.first)
  account.update!(name: account_name)
  puts "account #{account.id} name = #{account_name}"
end

GlobalConfig.clear_cache
puts 'ok'
