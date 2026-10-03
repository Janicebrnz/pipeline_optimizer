pipeline {

    agent any

    environment {
        GEMINI_API_KEY = credentials('gemini-api-key')
    }

    stages {

        stage('Checkout') {

            steps {

                echo 'Checking out GitHub repository...'

                checkout scm
            }
        }


        stage('AI Dependency Optimizer') {

            steps {

                echo 'Starting Gemini AI optimization...'

                bat '''
                    python3 ai_optimizer.py
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
                        echo 'requirements.txt changed.'
                        echo 'Installing Python dependencies...'
                        echo '======================================'

                        bat '''
                            python3 -m pip install -r requirements.txt
                        '''

                    }

                    else if (env.AI_DECISION == 'USE_CACHE') {

                        echo '======================================'
                        echo 'AI DECISION: USE_CACHE'
                        echo 'requirements.txt unchanged.'
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

                echo 'Running Python tests...'

                bat '''
                    python3 -m unittest test_app.py
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
