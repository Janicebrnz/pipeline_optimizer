pipeline {

    agent any

    options {
        timestamps()
    }

    environment {
        GEMINI_API_KEY = credentials('gemini-api-key')
    }

    stages {

        stage('Check Build Environment') {

            steps {

                echo '======================================'
                echo 'Checking Node.js and npm...'
                echo '======================================'

                powershell '''
                    Write-Host "Node version:"
                    node --version

                    Write-Host "NPM version:"
                    npm --version
                '''
            }
        }


        stage('AI Dependency Optimizer') {

            steps {

                echo '======================================'
                echo 'Starting Gemini AI optimization...'
                echo '======================================'

                powershell '''

                    # ----------------------------------------
                    # Detect changed files
                    # ----------------------------------------

                    $changedFiles = git diff --name-only HEAD~1 HEAD

                    if (-not $changedFiles) {
                        $changedFiles = "No changed files detected"
                    }

                    Write-Host ""
                    Write-Host "Changed files:"
                    Write-Host $changedFiles
                    Write-Host ""

                    # Check dependency lock file
                    $dependencyChanged = $changedFiles -contains "package-lock.json"

                    Write-Host "package-lock.json changed: $dependencyChanged"
                    Write-Host ""


                    # ----------------------------------------
                    # Create Gemini prompt
                    # ----------------------------------------

                    $prompt = @"
You are an AI optimization engine inside a Jenkins CI/CD pipeline.

Your task is to decide whether npm dependencies need to be installed again.

Changed files:
$changedFiles

package-lock.json changed:
$dependencyChanged

Rules:

If package-lock.json changed:
return RUN_INSTALL

If package-lock.json did not change:
return USE_CACHE

Return ONLY:

RUN_INSTALL

or:

USE_CACHE

Do not provide explanations.
Do not provide markdown.
"@


                    # ----------------------------------------
                    # Gemini request body
                    # ----------------------------------------

                    $body = @{
                        contents = @(
                            @{
                                parts = @(
                                    @{
                                        text = $prompt
                                    }
                                )
                            }
                        )
                    } | ConvertTo-Json -Depth 10


                    # ----------------------------------------
                    # Gemini API
                    # ----------------------------------------

                    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"

                    $headers = @{
                        "x-goog-api-key" = $env:GEMINI_API_KEY
                    }


                    # ----------------------------------------
                    # Try Gemini
                    # ----------------------------------------

                    $response = $null
                    $geminiSuccess = $false

                    try {

                        Write-Host "Sending request to Gemini..."

                        $response = Invoke-RestMethod `
                            -Uri $url `
                            -Method Post `
                            -Headers $headers `
                            -ContentType "application/json" `
                            -Body $body

                        $geminiSuccess = $true

                    }

                    catch {

                        Write-Host ""
                        Write-Host "Gemini API request failed."

                        $statusCode = $_.Exception.Response.StatusCode.value__

                        Write-Host "HTTP Status Code: $statusCode"

                        if ($statusCode -eq 429) {

                            Write-Host ""
                            Write-Host "Gemini API returned HTTP 429."
                            Write-Host "Too many requests / quota limit reached."
                            Write-Host "Gemini decision cannot be obtained right now."

                        }

                        else {

                            Write-Host "Gemini API error:"
                            Write-Host $_.Exception.Message
                        }
                    }


                    # ----------------------------------------
                    # Process Gemini response
                    # ----------------------------------------

                    if ($geminiSuccess) {

                        $decision = $response.candidates[0].content.parts[0].text.Trim()

                        Write-Host ""
                        Write-Host "======================================"
                        Write-Host "GEMINI AI DECISION"
                        Write-Host "======================================"
                        Write-Host $decision
                        Write-Host "======================================"
                        Write-Host ""


                        if ($decision -match "RUN_INSTALL") {

                            "RUN_INSTALL" | Out-File `
                                -FilePath ai_decision.txt `
                                -Encoding ascii

                            Write-Host "Decision source: Gemini AI"
                        }

                        elseif ($decision -match "USE_CACHE") {

                            "USE_CACHE" | Out-File `
                                -FilePath ai_decision.txt `
                                -Encoding ascii

                            Write-Host "Decision source: Gemini AI"
                        }

                        else {

                            Write-Host "Gemini returned an invalid decision."

                            if ($dependencyChanged) {

                                "RUN_INSTALL" | Out-File `
                                    -FilePath ai_decision.txt `
                                    -Encoding ascii

                                Write-Host "Fallback decision: RUN_INSTALL"

                            }

                            else {

                                "USE_CACHE" | Out-File `
                                    -FilePath ai_decision.txt `
                                    -Encoding ascii

                                Write-Host "Fallback decision: USE_CACHE"
                            }
                        }

                    }

                    else {

                        # ----------------------------------------
                        # Gemini unavailable
                        # Use safe fallback
                        # ----------------------------------------

                        Write-Host ""
                        Write-Host "======================================"
                        Write-Host "GEMINI UNAVAILABLE"
                        Write-Host "======================================"
                        Write-Host "Using fallback dependency decision."
                        Write-Host "======================================"
                        Write-Host ""


                        if ($dependencyChanged) {

                            "RUN_INSTALL" | Out-File `
                                -FilePath ai_decision.txt `
                                -Encoding ascii

                            Write-Host "Fallback decision: RUN_INSTALL"

                        }

                        else {

                            "USE_CACHE" | Out-File `
                                -FilePath ai_decision.txt `
                                -Encoding ascii

                            Write-Host "Fallback decision: USE_CACHE"
                        }
                    }
                '''


                script {

                    def decision = readFile('ai_decision.txt').trim()

                    echo "Final Dependency Decision: ${decision}"

                    env.AI_DECISION = decision
                }
            }
        }


        stage('Dependency Management') {

            steps {

                script {

                    def startTime = System.currentTimeMillis()


                    if (env.AI_DECISION == 'RUN_INSTALL') {

                        echo '======================================'
                        echo 'DEPENDENCY DECISION: RUN_INSTALL'
                        echo 'Running npm dependency installation...'
                        echo '======================================'


                        powershell '''

                            Write-Host "Installing npm dependencies..."

                            npm ci

                            Write-Host "npm dependency installation completed."

                        '''
                    }


                    else if (env.AI_DECISION == 'USE_CACHE') {

                        echo '======================================'
                        echo 'DEPENDENCY DECISION: USE_CACHE'
                        echo 'Skipping npm dependency installation.'
                        echo 'Using existing dependency state.'
                        echo '======================================'
                    }


                    else {

                        error(
                            "Invalid dependency decision: "
                            + env.AI_DECISION
                        )
                    }


                    def endTime = System.currentTimeMillis()

                    def duration =
                        (endTime - startTime) / 1000.0


                    echo '======================================'
                    echo "Dependency Management Time: ${duration} seconds"
                    echo '======================================'
                }
            }
        }


        stage('Build Application') {

            steps {

                echo '======================================'
                echo 'Running application build...'
                echo '======================================'

                powershell '''

                    npm run build

                '''
            }
        }
    }


    post {

        always {

            echo '======================================'
            echo 'Jenkins pipeline completed.'
            echo '======================================'
        }


        success {

            echo '======================================'
            echo 'AI-optimized pipeline completed successfully.'
            echo '======================================'
        }


        failure {

            echo '======================================'
            echo 'Pipeline failed. Check console output.'
            echo '======================================'
        }
    }
}
