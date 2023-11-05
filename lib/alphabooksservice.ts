import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { aws_ecr as ecr } from "aws-cdk-lib"
import { User } from "aws-cdk-lib/aws-iam"
import * as codedeploy from "aws-cdk-lib/aws-codedeploy"
import { LambdaDeployment } from "./constructs/lambdadeploymentgroup";
import { GithubSourcedDockerEcr } from "./constructs/githubsourceddockerlecr";

export class AlphaBooksService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const solicitorLambda = new GithubSourcedDockerEcr(this, "SolicitorLambda", {
      githubRepo: 'alphabookssolicitor',
      githubAuthTokenSecretAlias: 'prod/github/accessToken',
      githubBranch: 'master',
      githubOwnerAlias: 'ddoyle4'
    });


  }
}