$ErrorActionPreference = 'Stop'

$products = "e:\MatooPower\website\products.html"
$utf8Bom = New-Object System.Text.UTF8Encoding $True
$utf8NoBom = New-Object System.Text.UTF8Encoding $False

$content = [System.IO.File]::ReadAllText($products, $utf8NoBom)

# Idempotency
if ($content.Contains('MatooApp.submitLead')) {
    Write-Host "[SKIP] products.html downloadSpec already wired to MatooApp.submitLead" -ForegroundColor Yellow
    exit 0
}

# Use a precise, unambiguous anchor: the alert line is unique
$oldHandlerLine = "        alert('Thank you! The spec sheet link has been sent to your email.');"
$idx = $content.IndexOf($oldHandlerLine)
if ($idx -lt 0) {
    Write-Host "[ERROR] alert line not found" -ForegroundColor Red
    exit 1
}

# Replace just the alert line with the start of the new submit handler
# The handler will be wrapped between the modal submit addEventListener lines
$newBlock = @'

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const formEl = modal.querySelector('#spec-form');
        const data = Object.fromEntries(new FormData(formEl).entries());
        const lead = {
          name: data.company_name || '',
          company: data.company_name || '',
          email: data.email || '',
          whatsapp: data.whatsapp || '',
          product: product,
        };

        try {
          if (!window.MatooApp || !window.MatooApp.submitLead) {
            throw new Error('MatooApp not loaded');
          }
          await window.MatooApp.submitLead(lead, { form: 'spec-sheet-' + product });
          submitBtn.textContent = '✓ Sent!';
          setTimeout(() => modal.remove(), 800);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          alert('Submission failed: ' + err.message + '\nPlease email sales@matoopower.com directly.');
        }
'@

# Replace "        alert(...);\n        modal.remove();" with the new block
# First find the modal.remove() after the alert
$modalRemoveLine = '        modal.remove();'
$modalIdx = $content.IndexOf($modalRemoveLine, $idx)
if ($modalIdx -lt 0) {
    Write-Host "[ERROR] modal.remove() line not found after alert" -ForegroundColor Red
    exit 1
}

# Replace from alert line start through end of modal.remove()
$replacementEnd = $modalIdx + $modalRemoveLine.Length
$before = $content.Substring(0, $idx)
$after = $content.Substring($replacementEnd)
$newContent = $before + $newBlock + $after

# Replace the modal cancel button HTML (currently uses inline onclick)
$oldCancel = '<button type="button" onclick="this.closest(' + [char]39 + '[data-modal]' + [char]39 + ').remove()" style="flex: 1; padding: 12px; border: 1.5px solid #DFE1E6; border-radius: 8px; background: white;">Cancel</button>'
$newCancel = '<button type="button" data-modal-cancel style="flex: 1; padding: 12px; border: 1.5px solid #DFE1E6; border-radius: 8px; background: white;">Cancel</button>'
if ($newContent.Contains($oldCancel)) {
    $newContent = $newContent.Replace($oldCancel, $newCancel)
}

# Inject a cancel button handler just before the submit handler
# The submit handler is now async, so find it
$submitMarker = "      modal.querySelector('#spec-form').addEventListener('submit', async (e) => {"
$newContent = $newContent.Replace($submitMarker, @'

      // Cancel button: remove the modal
      const cancelBtn = modal.querySelector('[data-modal-cancel]');
      if (cancelBtn) cancelBtn.addEventListener('click', () => modal.remove());

'@ + $submitMarker)

[System.IO.File]::WriteAllText($products, $newContent, $utf8Bom)
Write-Host "[OK] products.html downloadSpec() now submits via MatooApp.submitLead (mailto fallback)" -ForegroundColor Green
