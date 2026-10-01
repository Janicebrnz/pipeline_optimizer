pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                echo 'Building application...'
                sleep 20
                echo 'Build completed successfully.'
            }
        }

        stage('Unit Tests') {
            steps {
                echo 'Running unit tests...'
                sleep 10
                echo 'Unit tests completed successfully.'
            }
        }

        stage('Security Check') {
            steps {
                echo 'Running security checks...'
                sleep 10
                echo 'Security checks completed successfully.'
            }
        }

        stage('Package') {
            steps {
                echo 'Packaging application...'
                sleep 10
                echo 'Packaging completed successfully.'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying application...'
                sleep 10
                echo 'Deployment completed successfully.'
            }
        }
    }
}
