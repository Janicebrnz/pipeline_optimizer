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

                    # Get files changed in the latest commit
                    $changedFiles = git diff --name-only HEAD~1 HEAD

                    if (-not $changedFiles) {
                        $changedFiles = "No changed files detected"
                    }

                    Write-Host ""
                    Write-Host "Changed files:"
                    Write-Host $changedFiles
                    Write-Host ""

                    # Check whether dependency lock file changed
                    $dependencyChanged = $changedFiles -contains "package-lock.json"

                    Write-Host "package-lock.json changed: $dependencyChanged"
                    Write-Host ""


                    # Gemini prompt
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


                    # Create Gemini API request
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


                    # Gemini API endpoint
                    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"


                    # API authentication
                    $headers = @{
                        "x-goog-api-key" = $env:GEMINI_API_KEY
                    }


                    # Send request to Gemini
                    $response = Invoke-RestMethod `
                        -Uri $url `
                        -Method Post `
                        -Headers $headers `
                        -ContentType "application/json" `
                        -Body $body


                    # Extract Gemini decision
                    $decision = $response.candidates[0].content.parts[0].text.Trim()


                    Write-Host ""
                    Write-Host "======================================"
                    Write-Host "GEMINI AI DECISION"
                    Write-Host "======================================"
                    Write-Host $decision
                    Write-Host "======================================"
                    Write-Host ""


                    # Validate and save decision
                    if ($decision -match "RUN_INSTALL") {

                        "RUN_INSTALL" | Out-File `
                            -FilePath ai_decision.txt `
                            -Encoding ascii
                    }

                    elseif ($decision -match "USE_CACHE") {

                        "USE_CACHE" | Out-File `
                            -FilePath ai_decision.txt `
                            -Encoding ascii
                    }

                    else {

                        Write-Error "Invalid Gemini response: $decision"
                        exit 1
                    }
                '''


                script {

                    def decision = readFile('ai_decision.txt').trim()

                    echo "Gemini AI Decision: ${decision}"

                    env.AI_DECISION = decision
                }
            }
        }


        stage('Dependency Management') {

            steps {

                script {

                    // Start timing
                    def startTime = System.currentTimeMillis()


                    if (env.AI_DECISION == 'RUN_INSTALL') {

                        echo '======================================'
                        echo 'AI DECISION: RUN_INSTALL'
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
                        echo 'AI DECISION: USE_CACHE'
                        echo 'Skipping npm dependency installation.'
                        echo 'Using existing dependency state.'
                        echo '======================================'
                    }


                    else {

                        error(
                            "Invalid AI decision: "
                            + env.AI_DECISION
                        )
                    }


                    // End timing
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

            echo 'AI-optimized pipeline completed successfully.'
        }


        failure {

            echo 'Pipeline failed. Check console output.'
        }
    }
}
