$path = $args[1]
if (-not $path) { $path = $args[0] }
(Get-Content $path) -replace '^pick ', 'edit ' | Set-Content $path
