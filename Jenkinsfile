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

                bat '''
                    python ai_optimizer.py
                '''

                script {

                    def decision =
                        readFile('ai_decision.txt').trim()

                    echo '======================================'
                    echo "Gemini AI Decision: ${decision}"
                    echo '======================================'

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
                        echo 'Installing Python dependencies...'
                        echo '======================================'

                        bat '''
                            python -m pip install -r requirements.txt
                        '''

                    }

                    else if (env.AI_DECISION == 'USE_CACHE') {

                        echo '======================================'
                        echo 'AI DECISION: USE_CACHE'
                        echo 'Skipping dependency installation.'
                        echo 'Using existing Python environment.'
                        echo '======================================'

                    }

                    else {

                        error(
                            "Invalid Gemini AI decision: "
                            + env.AI_DECISION
                        )
                    }
                }
            }
        }


        stage('Run Tests') {

            steps {

                echo '======================================'
                echo 'Running Python tests...'
                echo '======================================'

                bat '''
                    python -m unittest test_app.py
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
