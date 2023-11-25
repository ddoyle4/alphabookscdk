import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SecretValue, aws_ecr as ecr } from "aws-cdk-lib"
import { User } from "aws-cdk-lib/aws-iam"
import * as codedeploy from "aws-cdk-lib/aws-codedeploy"
import { LambdaDeployment } from "./lambdadeploymentgroup";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import { Lambda } from "aws-cdk-lib/aws-ses-actions";

export interface ApiGatewayEcrLambdaProps {
    readonly ecrRepo: ecr.Repository;
}

export class ApiGatewayEcrLambda extends Construct {
   
    private lambdaFunction: lambda.Function;
    private lambdaAlias: lambda.Alias;
    private lambdaDeployment: LambdaDeployment;
   
    constructor(scope: Construct, id: string, props: ApiGatewayEcrLambdaProps) {
        super(scope, id);

        this.lambdaFunction = this.createLamda(props.ecrRepo, id);

        this.lambdaAlias = this.createLambdaAlias(id);

        this.lambdaDeployment = this.createLambdaDeployment(id);

    }

    private createLambdaAlias(id: string) {
        return new lambda.Alias(this, `${id}LambdaLiveAlias`, {
            aliasName: 'live',
            version: this.lambdaFunction.currentVersion,
        });
    }

    private createLambdaDeployment(id: string): LambdaDeployment {
        return new LambdaDeployment(this, `${id}LambdaDeployment`, {
            alias: this.lambdaAlias,
            deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE
        });
    }

    private createLamda(repository: ecr.Repository, id: string): lambda.Function {

        const lambdaFunction = new lambda.Function(this, `${id}Lambda`, {
            runtime: lambda.Runtime.FROM_IMAGE,
            handler: lambda.Handler.FROM_IMAGE,
            code: new lambda.EcrImageCode(repository),
            functionName: `${id}Lambda`
        });

        return lambdaFunction;
    }
}