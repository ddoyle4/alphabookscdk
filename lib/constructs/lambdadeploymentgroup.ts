import * as codedeploy from "aws-cdk-lib/aws-codedeploy"
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export interface LambdaDeploymentProps
  extends codedeploy.LambdaApplicationProps {
  deploymentConfig: codedeploy.ILambdaDeploymentConfig;
  alias: lambda.Alias;
}


export class LambdaDeployment extends codedeploy.LambdaApplication {
    public readonly deploymentGroup: codedeploy.LambdaDeploymentGroup;
  
    constructor(scope: Construct, id: string, props: LambdaDeploymentProps) {
      super(scope, id, props);
  
  
      this.deploymentGroup = new codedeploy.LambdaDeploymentGroup(
        this,
        `${id} CodeDeploy Deployment Group`,
        {
          application: this,
          alias: props.alias,
          deploymentConfig: props.deploymentConfig,
        }
      );
    }
  }