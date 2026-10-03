pipeline {

    agent any

    options {
        timestamps()
    }

    environment {
        GEMINI_API_KEY = credentials('gemini-api-key')
    }

    stages {

        stage('AI Dependency Optimizer') {

            steps {

                echo '======================================'
                echo 'Starting Gemini AI optimization...'
                echo '======================================'

                powershell '''
                    $changedFiles = git diff --name-only HEAD~1 HEAD

                    if (-not $changedFiles) {
                        $changedFiles = "No changed files detected"
                    }

                    $requirementsChanged = $changedFiles -contains "requirements.txt"

                    Write-Host ""
                    Write-Host "Changed files:"
                    Write-Host $changedFiles
                    Write-Host ""
                    Write-Host "requirements.txt changed: $requirementsChanged"
                    Write-Host ""

                    $prompt = @"
You are an AI optimization engine inside a Jenkins CI/CD pipeline.

Your task is to decide whether Python dependencies need to be installed again.

Changed files:
$changedFiles

requirements.txt changed:
$requirementsChanged

Rules:

If requirements.txt changed:
return RUN_INSTALL

If requirements.txt did not change:
return USE_CACHE

Return ONLY:
RUN_INSTALL

or:
USE_CACHE

Do not provide explanations.
Do not provide markdown.
"@

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

                    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=$env:GEMINI_API_KEY"
                    $response = Invoke-RestMethod `
                        -Uri $url `
                        -Method Post `
                        -ContentType "application/json" `
                        -Body $body

                    $decision = $response.candidates[0].content.parts[0].text.Trim()

                    Write-Host "======================================"
                    Write-Host "GEMINI AI DECISION"
                    Write-Host "======================================"
                    Write-Host $decision
                    Write-Host "======================================"

                    if ($decision -match "RUN_INSTALL") {

                        "RUN_INSTALL" | Out-File -FilePath ai_decision.txt -Encoding ascii

                    }
                    elseif ($decision -match "USE_CACHE") {

                        "USE_CACHE" | Out-File -FilePath ai_decision.txt -Encoding ascii

                    }
                    else {

                        Write-Error "Invalid Gemini response: $decision"
                        exit 1
                    }
                '''

                script {

                    def decision =
                        readFile('ai_decision.txt').trim()

                    echo "Gemini AI Decision: ${decision}"

                    env.AI_DECISION = decision
                }
            }
        }


        stage('Dependency Management') {

            steps {

                script {

                    if (env.AI_DECISION == 'RUN_INSTALL') {

                        echo '======================================'
                        echo 'AI DECISION: RUN_INSTALL'
                        echo 'Installing dependencies...'
                        echo '======================================'

                        powershell '''
                            py -m pip install -r requirements.txt
                        '''

                    }

                    else if (env.AI_DECISION == 'USE_CACHE') {

                        echo '======================================'
                        echo 'AI DECISION: USE_CACHE'
                        echo 'Skipping dependency installation.'
                        echo '======================================'

                    }

                    else {

                        error(
                            "Invalid AI decision: "
                            + env.AI_DECISION
                        )
                    }
                }
            }
        }


        stage('Run Tests') {

            steps {

                echo '======================================'
                echo 'Running tests...'
                echo '======================================'

                powershell '''
                    py -m unittest test_app.py
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
