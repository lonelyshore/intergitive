param (
    [Parameter(Mandatory=$true)]    
    [ValidateSet("ia32", "x64")]
    $architecture
)

node .\dev\module-switch.js init

node .\dev\module-switch.js drop nodegit

Remove-Item -Force -Path .\.npmrc

# load for electron first
$content = @"
runtime = electron
target = 8.2.0
target_arch = $architecture
disturl = "https://atom.io/download/atom-shell"
"@

$outStream = New-Object -TypeName System.IO.StreamWriter $PSScriptRoot\.npmrc
$outStream.NewLine = "`n"
foreach($line in $content.Split("`r`n"))
{
    $outStream.WriteLine($line)
}
$outStream.Flush()
$outStream.Close()
$outStream.Dispose()

npm install nodegit@0.26.x

node .\dev\module-switch.js save nodegit electron

# # load for current node
Remove-Item -Force -Path .\.npmrc

npm install nodegit@0.26.x

node .\dev\module-switch.js save nodegit node