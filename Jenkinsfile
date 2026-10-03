pipeline {

    agent any

    environment {
        GEMINI_API_KEY = credentials('gemini-api-key')
    }

    stages {

        stage('Checkout') {

            steps {

                echo 'Checking out source code...'

                checkout scm
            }
        }


        stage('AI Pipeline Optimizer') {

            steps {

                echo 'Running Gemini AI optimization...'

                sh '''
                    node ai_optimizer.js
                '''

                script {

                    def decision =
                        readFile('ai_decision.txt').trim()

                    echo "AI Decision: ${decision}"

                    env.AI_DECISION = decision
                }
            }
        }


        stage('Dependency Management') {

            steps {

                script {

                    if (env.AI_DECISION == 'RUN_INSTALL') {

                        echo 'AI detected dependency changes.'
                        echo 'Installing npm dependencies...'

                        sh '''
                            npm ci
                        '''

                    } else {

                        echo 'AI detected no dependency changes.'
                        echo 'Using npm cache...'

                        sh '''
                            npm cache verify
                        '''
                    }
                }
            }
        }


        stage('Build') {

            steps {

                echo 'Building application...'

                sh '''
                    npm run build
                '''
            }
        }


        stage('Test') {

            steps {

                echo 'Running tests...'

                sh '''
                    npm test -- --runInBand
                '''
            }
        }
    }


    post {

        always {

            echo 'Pipeline execution completed.'

        }

        success {

            echo 'SUCCESS: AI-optimized Jenkins pipeline completed.'

        }

        failure {

            echo 'Pipeline failed. Check the console output.'

        }
    }
}
