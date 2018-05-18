node('v2-slave'){
  stage('Clone'){
    git branch:env.BRANCH_NAME, credentialsId: 'stoicbot-github-ssh', url: 'git@github.com:sutoiku/hubot-civ2'
  }

  stage ('Install dependencies'){
    sh('npm i')
  }

  stage ('Test'){
    sh('npm test')
  }

  stage('Trigger hubot build'){
    build job:'Chore/hubot/stoic-hubot/master'
  }
}
