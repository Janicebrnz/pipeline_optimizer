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
                echo 'Checking Node.js and npm'
                echo '======================================'

                powershell '''
                    node --version
                    npm --version
                '''
            }
        }

        stage('AI Dependency Optimizer') {
            steps {

                echo '======================================'
                echo 'AI Dependency Optimization'
                echo '======================================'

                powershell '''

                    # Detect changed files
                    $changedFiles = git diff --name-only HEAD~1 HEAD

                    Write-Host ""
                    Write-Host "Changed files:"
                    Write-Host $changedFiles
                    Write-Host ""

                    # Check dependency changes
                    $dependencyChanged = $changedFiles -contains "package-lock.json"

                    # IMPORTANT:
                    # Check whether lodash is actually installed
                    $nodeModulesExists = Test-Path "node_modules/lodash"

                    Write-Host "package-lock.json changed: $dependencyChanged"
                    Write-Host "lodash installed: $nodeModulesExists"
                    Write-Host ""


                    # Gemini prompt
                    $prompt = @"
You are an AI dependency optimization engine inside a Jenkins CI/CD pipeline.

Changed files:
$changedFiles

package-lock.json changed:
$dependencyChanged

lodash installed:
$nodeModulesExists

Decision rules:

If package-lock.json changed OR lodash is not installed:
return RUN_INSTALL

Otherwise:
return USE_CACHE

Return ONLY:

RUN_INSTALL

or:

USE_CACHE
"@


                    # Create Gemini request
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


                    # Gemini API
                    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"

                    $headers = @{
                        "x-goog-api-key" = $env:GEMINI_API_KEY
                    }


                    # Call Gemini
                    $geminiSuccess = $false
                    $decision = ""


                    try {

                        Write-Host "Sending request to Gemini..."

                        $response = Invoke-RestMethod `
                            -Uri $url `
                            -Method Post `
                            -Headers $headers `
                            -ContentType "application/json" `
                            -Body $body

                        $decision = $response.candidates[0].content.parts[0].text.Trim()

                        $geminiSuccess = $true

                        Write-Host ""
                        Write-Host "Gemini response:"
                        Write-Host $decision
                        Write-Host ""

                    }

                    catch {

                        Write-Host ""
                        Write-Host "Gemini API unavailable."
                        Write-Host "Using safe fallback decision."
                        Write-Host ""

                    }


                    # Process Gemini decision
                    if ($geminiSuccess -and $decision -match "RUN_INSTALL") {

                        "RUN_INSTALL" | Out-File `
                            -FilePath ai_decision.txt `
                            -Encoding ascii

                        Write-Host "Decision source: Gemini AI"
                        Write-Host "Final decision: RUN_INSTALL"

                    }

                    elseif ($geminiSuccess -and $decision -match "USE_CACHE") {

                        "USE_CACHE" | Out-File `
                            -FilePath ai_decision.txt `
                            -Encoding ascii

                        Write-Host "Decision source: Gemini AI"
                        Write-Host "Final decision: USE_CACHE"

                    }

                    else {

                        # Safe fallback
                        if ($dependencyChanged -or !$nodeModulesExists) {

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

                    echo "======================================"
                    echo "FINAL AI DECISION: ${decision}"
                    echo "======================================"

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
                        echo 'RUN_INSTALL'
                        echo 'Installing dependencies with npm ci'
                        echo '======================================'

                        powershell '''
                            npm ci
                        '''
                    }

                    else if (env.AI_DECISION == 'USE_CACHE') {

                        echo '======================================'
                        echo 'USE_CACHE'
                        echo 'Skipping dependency installation'
                        echo 'Using existing node_modules'
                        echo '======================================'
                    }

                    else {

                        error("Invalid AI decision: ${env.AI_DECISION}")
                    }


                    def endTime = System.currentTimeMillis()

                    def duration =
                        (endTime - startTime) / 1000.0

                    echo "Dependency Management Time: ${duration} seconds"
                }
            }
        }


        stage('Build Application') {

            steps {

                echo '======================================'
                echo 'BUILDING APPLICATION'
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
            echo 'PIPELINE COMPLETED'
            echo '======================================'
        }

        success {

            echo '======================================'
            echo 'SUCCESS: AI-OPTIMIZED PIPELINE'
            echo '======================================'
        }

        failure {

            echo '======================================'
            echo 'PIPELINE FAILED'
            echo 'Check the console output.'
            echo '======================================'
        }
    }
}
