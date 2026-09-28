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
            }
        }

stage('Unit Tests') {
    steps {
        echo 'Running unit tests...'
        sleep 30
        echo 'Unit tests completed successfully.'
    }
}

        stage('Security Check') {
            steps {
                echo 'Running security checks...'
                sleep 40
            }
        }

        stage('Package') {
            steps {
                echo 'Packaging application...'
                sleep 30
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying application...'
                sleep 20
            }
        }
    }
}
