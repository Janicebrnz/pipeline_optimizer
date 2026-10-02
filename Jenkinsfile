pipeline {
    agent any

    stages {

        stage('Build') {
            steps {
                echo 'Building application...'
                sleep 5
            }
        }

        stage('Quality Checks') {
            parallel {

                stage('Test') {

                }

                stage('Security Scan') {
                    steps {
                        echo 'Running security scan...'
                        sleep 5
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying application...'
                sleep 5
            }
        }
    }
}
