pipeline {
    agent any   // change to: agent { label 'your-windows-agent-label' } if needed

    parameters {
        choice(name: 'AI_PROVIDERS', choices: ['gemini,groq', 'groq,gemini'],
               description: 'Which LLM to ask first. Pick groq,gemini to demo the Groq (Llama) provider')
        booleanParam(name: 'SIMULATE_AI_FAILURE', defaultValue: false,
                     description: 'Tick to skip Gemini on purpose and demo the fallback decision')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Node.js / npm') {
            steps {
                bat 'node -v'
                bat 'npm -v'
            }
        }

        stage('Detect Changes & Dependency State') {
            steps {
                bat 'node ci\\collect-context.js'
            }
        }

        stage('AI Dependency Decision (Gemini)') {
            steps {
                // Two Jenkins "Secret text" credentials: gemini-api-key and groq-api-key
                withCredentials([
                    string(credentialsId: 'gemini-api-key', variable: 'GEMINI_API_KEY'),
                    string(credentialsId: 'groq-api-key', variable: 'GROQ_API_KEY')
                ]) {
                    withEnv(["SIMULATE_AI_FAILURE=${params.SIMULATE_AI_FAILURE}", "AI_PROVIDERS=${params.AI_PROVIDERS}"]) {
                        bat 'node ci\\decide.js'
                    }
                }
                script {
                    env.DECISION = readFile('decision.txt').trim()
                    env.DECISION_SOURCE = readFile('source.txt').trim()
                    currentBuild.description = "${env.DECISION} (${env.DECISION_SOURCE})"
                }
            }
        }

        stage('Dependency Management: npm ci') {
            when { expression { env.DECISION == 'RUN_INSTALL' } }
            steps {
                bat 'node ci\\deps.js RUN_INSTALL'
            }
        }

        stage('Dependency Management: skipped (cache)') {
            when { expression { env.DECISION == 'USE_CACHE' } }
            steps {
                bat 'node ci\\deps.js USE_CACHE'
            }
        }

        stage('Build') {
            steps {
                bat 'npm run build'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'decision.json, ci-history.json, context.json', allowEmptyArchive: true
        }
        success {
            echo "SUCCESS | decision=${env.DECISION} | source=${env.DECISION_SOURCE}"
        }
    }
}
