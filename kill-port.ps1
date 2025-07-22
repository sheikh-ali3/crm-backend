# Script to find and kill any process using port 5000
$port = 5000

Write-Host "Looking for processes using port $port..."
$processInfo = netstat -ano | findstr :$port

if ($processInfo) {
    $processInfo | ForEach-Object {
        $_ -match ":$port\s+.*LISTENING\s+(\d+)" | Out-Null
        if ($matches -and $matches[1]) {
            $processId = $matches[1]
            $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
            
            if ($processName) {
                Write-Host "Found process using port $port - PID: $processId, Name: $processName"
                Write-Host "Killing process $processId ($processName)..."
                Stop-Process -Id $processId -Force
                Write-Host "Process killed."
            }
        }
    }
} else {
    Write-Host "No process found using port $port."
}

Write-Host "Done." 