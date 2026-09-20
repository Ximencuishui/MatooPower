$ErrorActionPreference = 'Stop'

$mainJs = "e:\MatooPower\website\scripts\main.js"
$utf8Bom = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($mainJs, $utf8NoBom)

# Idempotency check
if ($content.Contains('FOOTER_MASK: /WhatsApp:')) {
    Write-Host "[SKIP] main.js already has the footer mask rewriter" -ForegroundColor Yellow
    exit 0
}

if (-not $content.Contains('const WhatsAppLinks = {')) {
    Write-Host "[ERROR] Could not find WhatsAppLinks block in main.js" -ForegroundColor Red
    exit 1
}

$newBlock = @'
  const WhatsAppLinks = {
    PLACEHOLDER: 'WHATSAPP_PLACEHOLDER',
    // Footer ships with this friendly masked number.
    // Once the real number is configured we replace it.
    FOOTER_MASK: /WhatsApp:\s*\+\d+\s*X+\s*\d?\s*X*/g,

    init() {
      const cfg = window.MATOO_WHATSAPP;
      if (!cfg || !cfg.number) return;

      // Skip rewrite if placeholder is still the literal "WHATSAPP_PLACEHOLDER"
      if (cfg.number === this.PLACEHOLDER) {
        console.warn('[Matoo] WhatsApp number is still a placeholder. Edit scripts/whatsapp-config.js before deploy.');
        return;
      }

      const number = cfg.number;
      const formatted = this.formatDisplayNumber(number);
      let rewrittenLinks = 0;
      let rewrittenText = 0;

      // 1) Rewrite wa.me/WHATSAPP_PLACEHOLDER links
      document.querySelectorAll('a[href*="wa.me/' + this.PLACEHOLDER + '"]').forEach((a) => {
        const href = a.getAttribute('href');
        a.setAttribute('href', href.replace('wa.me/' + this.PLACEHOLDER, 'wa.me/' + number));
        rewrittenLinks++;
      });

      // 2) Rewrite footer text "WhatsApp: +65 XXXX XXXX" -> "WhatsApp: +65 9123 4567"
      //    Use TreeWalker so we only touch text nodes, not HTML attributes.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        if (!this.FOOTER_MASK.test(node.nodeValue)) continue;
        node.nodeValue = node.nodeValue.replace(this.FOOTER_MASK, 'WhatsApp: ' + formatted);
        rewrittenText++;
      }

      if (rewrittenLinks > 0 || rewrittenText > 0) {
        console.info('[Matoo] Rewrote ' + rewrittenLinks + ' WhatsApp link(s) and ' +
                    rewrittenText + ' footer text node(s) with configured number.');
      }
    },

    /**
     * Format the configured E.164 number into a friendly display string.
     * Example: '6591234567' -> '+65 9123 4567' (assumes 8-digit subscriber)
     * Falls back to the raw number when format cannot be inferred.
     */
    formatDisplayNumber(number) {
      if (!number) return '';
      const digits = String(number).replace(/\D/g, '');
      // Assume 8-digit subscriber number after country code
      if (digits.length >= 10) {
        const cc = '+' + digits.slice(0, digits.length - 8);
        const a = digits.slice(-8, -4);
        const b = digits.slice(-4);
        return cc + ' ' + a + ' ' + b;
      }
      return '+' + digits;
    },
  };
'@

# Locate block boundaries by index
$startIndex = $content.IndexOf('  const WhatsAppLinks = {')
$endIndex = $content.IndexOf('  };', $startIndex)
if ($startIndex -lt 0 -or $endIndex -lt 0) {
    Write-Host "[ERROR] Could not locate WhatsAppLinks block boundaries" -ForegroundColor Red
    exit 1
}

# Skip past '  };'
$endIndex += 4

# Skip trailing newline(s)
while ($endIndex -lt $content.Length -and ($content[$endIndex] -eq "`r" -or $content[$endIndex] -eq "`n")) {
    $endIndex++
}

$before = $content.Substring(0, $startIndex)
$after = $content.Substring($endIndex)
$newContent = $before + $newBlock + "`r`n" + $after

[System.IO.File]::WriteAllText($mainJs, $newContent, $utf8Bom)
Write-Host "[OK] main.js updated with footer WhatsApp placeholder rewriter" -ForegroundColor Green
