# PowerShell HTTP & REST API Server for Windows
# Running without external dependencies

$port = 8080
$rootDir = $PSScriptRoot
$dbFile = Join-Path $rootDir "data\database.json"

if (-not (Test-Path (Join-Path $rootDir "data"))) {
    New-Item -ItemType Directory -Path (Join-Path $rootDir "data") -Force | Out-Null
}

function Get-DatabaseData {
    if (Test-Path $dbFile) {
        try {
            return [System.IO.File]::ReadAllText($dbFile, [System.Text.Encoding]::UTF8)
        } catch {}
    }
    return '{"members":[], "tasks":[]}'
}

function Set-DatabaseData ($rawJson) {
    try {
        [System.IO.File]::WriteAllText($dbFile, $rawJson, [System.Text.Encoding]::UTF8)
        return $true
    } catch {
        return $false
    }
}

$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, $port)
$listener = New-Object System.Net.Sockets.TcpListener($endpoint)

try {
    $listener.Start()
} catch {
    Write-Host "Cannot start server on port $($port): $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$localIp = "localhost"
try {
    $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | 
           Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notmatch '^127\.' -and $_.IPAddressToString -notmatch '^169\.254\.' }
    if ($ips) {
        $localIp = $ips[0].IPAddressToString
    }
} catch {}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " TeamTask Local Server is running! (Server Online)" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " [1] Open on this computer:" -ForegroundColor White
Write-Host "     http://localhost:$($port)" -ForegroundColor Yellow
Write-Host ""
Write-Host " [2] Open from phone / other computers on same Wi-Fi:" -ForegroundColor White
Write-Host "     http://${localIp}:$($port)" -ForegroundColor Yellow
Write-Host ""
Write-Host " [3] Share via Cloudflare Tunnel (Worldwide):" -ForegroundColor White
Write-Host "     Run command: cloudflared tunnel --url http://localhost:$($port)" -ForegroundColor Gray
Write-Host ""
Write-Host " All tasks and members are synchronized in real-time!" -ForegroundColor Green
Write-Host " Press Ctrl + C to stop the server." -ForegroundColor DarkGray
Write-Host "-----------------------------------------------------------------" -ForegroundColor Cyan

try {
    Start-Process "http://localhost:$($port)"
} catch {}

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)

        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) {
            $client.Close()
            continue
        }

        $parts = $requestLine.Split(' ')
        if ($parts.Length -lt 2) {
            $client.Close()
            continue
        }

        $method = $parts[0].ToUpper()
        $rawUrl = $parts[1]
        $path = $rawUrl.Split('?')[0]

        $contentLength = 0
        while ($true) {
            $headerLine = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($headerLine)) { break }
            if ($headerLine -match '^Content-Length:\s*(\d+)') {
                $contentLength = [int]$matches[1]
            }
        }

        $body = ""
        if ($contentLength -gt 0) {
            $buffer = New-Object char[] $contentLength
            $readTotal = 0
            while ($readTotal -lt $contentLength) {
                $read = $reader.Read($buffer, $readTotal, $contentLength - $readTotal)
                if ($read -le 0) { break }
                $readTotal += $read
            }
            $body = New-Object string ($buffer, 0, $readTotal)
        }

        $SendResponse = {
            param($statusCode, $statusText, $contentType, [byte[]]$contentBytes)
            $writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::ASCII)
            $writer.WriteLine("HTTP/1.1 $statusCode $statusText")
            $writer.WriteLine("Content-Type: $contentType")
            $writer.WriteLine("Content-Length: " + $contentBytes.Length)
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS")
            $writer.WriteLine("Access-Control-Allow-Headers: Content-Type")
            $writer.WriteLine("Connection: close")
            $writer.WriteLine()
            $writer.Flush()
            if ($contentBytes.Length -gt 0) {
                $stream.Write($contentBytes, 0, $contentBytes.Length)
                $stream.Flush()
            }
        }

        if ($method -eq "OPTIONS") {
            & $SendResponse 204 "No Content" "text/plain" @()
            $client.Close()
            continue
        }

        # --- REST API ---
        if ($path.StartsWith("/api/")) {
            if ($path -eq "/api/data" -and $method -eq "GET") {
                $dbJson = Get-DatabaseData
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($dbJson)
                & $SendResponse 200 "OK" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path -eq "/api/tasks" -and $method -eq "POST") {
                $newTask = $body | ConvertFrom-Json
                if (-not $newTask.id) {
                    $newTask | Add-Member -MemberType NoteProperty -Name "id" -Value ("task-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Force
                }
                if (-not $newTask.createdAt) {
                    $newTask | Add-Member -MemberType NoteProperty -Name "createdAt" -Value ([DateTime]::UtcNow.ToString("o")) -Force
                }

                $dbObj = (Get-DatabaseData) | ConvertFrom-Json
                $taskList = [System.Collections.ArrayList]@($dbObj.tasks)
                $taskList.Insert(0, $newTask)
                $dbObj.tasks = $taskList
                Set-DatabaseData ($dbObj | ConvertTo-Json -Depth 10) | Out-Null

                $resJson = @{ success = $true; task = $newTask } | ConvertTo-Json -Depth 5
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                & $SendResponse 201 "Created" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path.StartsWith("/api/tasks/") -and $method -eq "PUT") {
                $taskId = $path.Replace("/api/tasks/", "")
                $updateObj = $body | ConvertFrom-Json
                $dbObj = (Get-DatabaseData) | ConvertFrom-Json

                for ($i = 0; $i -lt $dbObj.tasks.Count; $i++) {
                    if ($dbObj.tasks[$i].id -eq $taskId) {
                        foreach ($prop in $updateObj.PSObject.Properties) {
                            $dbObj.tasks[$i].($prop.Name) = $prop.Value
                        }
                        break
                    }
                }
                Set-DatabaseData ($dbObj | ConvertTo-Json -Depth 10) | Out-Null

                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"success": true}')
                & $SendResponse 200 "OK" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path.StartsWith("/api/tasks/") -and $method -eq "DELETE") {
                $taskId = $path.Replace("/api/tasks/", "")
                $dbObj = (Get-DatabaseData) | ConvertFrom-Json
                $dbObj.tasks = @($dbObj.tasks | Where-Object { $_.id -ne $taskId })
                Set-DatabaseData ($dbObj | ConvertTo-Json -Depth 10) | Out-Null

                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"success": true}')
                & $SendResponse 200 "OK" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path -eq "/api/members" -and $method -eq "POST") {
                $newMem = $body | ConvertFrom-Json
                if (-not $newMem.id) {
                    $newMem | Add-Member -MemberType NoteProperty -Name "id" -Value ("mem-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Force
                }
                $dbObj = (Get-DatabaseData) | ConvertFrom-Json
                $dbObj.members += $newMem
                Set-DatabaseData ($dbObj | ConvertTo-Json -Depth 10) | Out-Null

                $resJson = @{ success = $true; member = $newMem } | ConvertTo-Json -Depth 5
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                & $SendResponse 201 "Created" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path.StartsWith("/api/members/") -and $method -eq "DELETE") {
                $memberId = $path.Replace("/api/members/", "")
                $dbObj = (Get-DatabaseData) | ConvertFrom-Json
                $dbObj.members = @($dbObj.members | Where-Object { $_.id -ne $memberId })
                Set-DatabaseData ($dbObj | ConvertTo-Json -Depth 10) | Out-Null

                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"success": true}')
                & $SendResponse 200 "OK" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error": "Endpoint not found"}')
            & $SendResponse 404 "Not Found" "application/json; charset=utf-8" $bytes
            $client.Close()
            continue
        }

        # --- STATIC FILES ---
        if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) { $path = "/index.html" }
        $cleanRelPath = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $targetFile = Join-Path $rootDir $cleanRelPath

        if (-not (Test-Path $targetFile -PathType Leaf)) {
            $targetFile = Join-Path $rootDir "index.html"
        }

        $ext = [System.IO.Path]::GetExtension($targetFile).ToLower()
        $mime = "application/octet-stream"
        switch ($ext) {
            ".html" { $mime = "text/html; charset=utf-8" }
            ".css"  { $mime = "text/css; charset=utf-8" }
            ".js"   { $mime = "application/javascript; charset=utf-8" }
            ".json" { $mime = "application/json; charset=utf-8" }
            ".svg"  { $mime = "image/svg+xml" }
            ".png"  { $mime = "image/png" }
            ".jpg"  { $mime = "image/jpeg" }
            ".ico"  { $mime = "image/x-icon" }
        }

        $fileBytes = [System.IO.File]::ReadAllBytes($targetFile)
        & $SendResponse 200 "OK" $mime $fileBytes
        $client.Close()
    } catch {
        try { if ($client) { $client.Close() } } catch {}
    }
}


