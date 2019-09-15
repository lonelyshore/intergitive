param (
    [Parameter(Mandatory=$true)]    
    [ValidateSet("x86", "x64")]
    $architecture
)

node .\dev\module-switch.js init

node .\dev\module-switch.js drop nodegit

Remove-Item -Force -Path .\.npmrc

# load for electron first
$content = @"
runtime = electron
target = 4.0.0
target_arch = $architecture
disturl = "https://atom.io/download/atom-shell"
"@

Write-Output $content | Out-File -FilePath .\.npmrc

node .\dev\module-switch.js save nodegit electron-4

# load for current node
Remove-Item -Force -Path .\.npmrc

node .\dev\module-switch.js save nodegit node-10-11