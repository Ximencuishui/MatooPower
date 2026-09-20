$ErrorActionPreference = 'Stop'

$mainJs = "e:\MatooPower\website\scripts\main.js"
$utf8Bom = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($mainJs, $utf8NoBom)

# Idempotency check
if ($content.Contains('window.MatooApp = {')) {
    Write-Host "[SKIP] main.js already exposes window.MatooApp" -ForegroundColor Yellow
    exit 0
}

# Insert window.MatooApp API block right before the closing IIFE
$marker = "  if (document.readyState === 'loading') {"
$apiBlock = @'

  /* ============================================
   * Public API · window.MatooApp
   *   Exposed so inline page scripts (e.g. downloadSpec
   *   on products.html) can submit leads without
   *   duplicating the mailto fallback logic.
   * ============================================ */
  window.MatooApp = {
    /**
     * Submit a lead. Returns { ok, channel, id }.
     * Tries /api/inquiries first; falls back to mailto.
     * @param {object} data - Lead fields (without _meta prefix)
     * @param {object} meta - Optional overrides (form, source, lang)
     */
    submitLead: function (data, meta) {
      const payload = Object.assign({}, data);
      payload._form = (meta && meta.form) || payload._form || 'inline';
      payload._lang = (meta && meta.lang) || document.documentElement.lang || 'en';
      payload._source = (meta && meta.source) || window.location.pathname;
      payload._timestamp = new Date().toISOString();
      payload._userAgent = navigator.userAgent;
      return FormHandler.submit(payload);
    },
    /**
     * Open the user's mail client with a pre-filled lead
     * email to sales@matoopower.com.
     */
    submitViaMailto: function (data, meta) {
      const payload = Object.assign({}, data);
      payload._form = (meta && meta.form) || payload._form || 'inline';
      payload._source = (meta && meta.source) || window.location.pathname;
      payload._timestamp = new Date().toISOString();
      return FormHandler.submitViaMailto(payload);
    },
    /**
     * The configured sales WhatsApp number, or null if
     * the placeholder has not been replaced yet.
     */
    whatsappNumber: function () {
      const cfg = window.MATOO_WHATSAPP;
      if (!cfg || !cfg.number || cfg.number === 'WHATSAPP_PLACEHOLDER') return null;
      return cfg.number;
    },
  };

'@

if (-not $content.Contains($marker)) {
    Write-Host "[ERROR] Could not find bootstrap marker in main.js" -ForegroundColor Red
    exit 1
}

$newContent = $content.Replace($marker, $apiBlock + $marker)

[System.IO.File]::WriteAllText($mainJs, $newContent, $utf8Bom)
Write-Host "[OK] main.js now exposes window.MatooApp for inline page scripts" -ForegroundColor Green
